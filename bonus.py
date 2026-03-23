# bonus.py
from datetime import date, datetime
from flask import Blueprint, jsonify, request, session

from config import Config
from livesklad import fetch_orders_by_counteragent_id, parse_iso, status_meta
from models import (
    find_user_by_phone,
    get_session,
    get_bonus_account,
    get_bonus_balance,
    set_bonus_balance,
    ensure_bonus_account,
    increase_bonus_balance,
    add_bonus_operation,
    mark_first_login_bonus_given,
    set_birthday_bonus_year,
    has_order_bonus_accrual,
    create_order_bonus_accrual,
    list_order_bonus_accruals,
    get_order_cashback_operations_total,
    reset_order_cashback_state,
    increase_total_spent,
    list_bonus_operations,
)


bonus_bp = Blueprint("bonus", __name__, url_prefix="/bonus")


BONUS_OPERATION_TITLES = {
    "first_login_bonus": "Приветственный бонус",
    "birthday_bonus": "Бонус ко дню рождения",
    "order_cashback": "Кэшбэк за заказ",
    "set": "Ручная корректировка",
    "writeoff": "Списание бонусов",
}


def parse_program_start_date():
    try:
        return datetime.strptime(Config.BONUS_PROGRAM_START_DATE, "%Y-%m-%d").date()
    except Exception:
        return date(2026, 3, 15)


def get_cashback_percent(total_spent: float) -> float:
    total_spent = float(total_spent or 0)

    if total_spent > 200000:
        return 0.05
    if total_spent > 100000:
        return 0.04
    if total_spent > 50000:
        return 0.03
    return 0.02


def get_next_tier(total_spent: float):
    total_spent = float(total_spent or 0)

    if total_spent <= 50000:
        return {"threshold": 50001, "percent": 0.03}
    if total_spent <= 100000:
        return {"threshold": 100001, "percent": 0.04}
    if total_spent <= 200000:
        return {"threshold": 200001, "percent": 0.05}
    return None


def get_order_total(order: dict) -> float:
    sold_price = float(order.get("soldPrice") or 0)
    price = float(order.get("price") or 0)

    if sold_price > 0:
        return round(sold_price, 2)

    if price > 0:
        return round(price, 2)

    summ = order.get("summ") or {}
    sold_price = float(summ.get("soldPrice") or 0)
    price = float(summ.get("price") or 0)

    if sold_price > 0:
        return round(sold_price, 2)

    if price > 0:
        return round(price, 2)

    positions = order.get("positions") or []
    if isinstance(positions, list) and positions:
        line_total = round(sum(float((p or {}).get("lineTotal") or 0) for p in positions), 2)
        if line_total > 0:
            return line_total

    paid = float(order.get("paid") or 0)
    debt = float(order.get("debt") or 0)
    total_by_payment = round(paid + debt, 2)
    if total_by_payment > 0:
        return total_by_payment

    return 0.0


def is_cancelled_order(order: dict) -> bool:
    status_name = ((order.get("status") or {}).get("name") or "").strip()
    meta = status_meta(status_name)
    return meta.get("stage") == "cancelled"


def is_completed_order(order: dict) -> bool:
    status_name = ((order.get("status") or {}).get("name") or "").strip()
    meta = status_meta(status_name)
    return meta.get("stage") in ("done", "issued")


def is_bonus_eligible_order(order: dict) -> bool:
    if is_cancelled_order(order):
        return False

    if not is_completed_order(order):
        return False

    order_total = get_order_total(order)
    if order_total <= 0:
        return False

    dt = parse_iso(order.get("dateCreate"))
    if not dt:
        return False

    return dt.date() >= parse_program_start_date()


def apply_first_login_bonus(user_id: int):
    account = get_bonus_account(user_id)
    if int(account.get("first_login_bonus_given") or 0) == 1:
        return False

    increase_bonus_balance(user_id, 300)
    add_bonus_operation(
        user_id=user_id,
        amount=300,
        operation_type="first_login_bonus",
        comment="Приветственный бонус за первый вход"
    )
    mark_first_login_bonus_given(user_id)
    return True


def apply_birthday_bonus_if_needed(user: dict):
    birth_date = (user or {}).get("birth_date")
    if not birth_date:
        return False

    try:
        birthday = datetime.strptime(birth_date, "%Y-%m-%d").date()
    except Exception:
        return False

    today = date.today()
    if birthday.month != today.month or birthday.day != today.day:
        return False

    account = get_bonus_account(user["id"])
    last_year = account.get("birthday_bonus_year")
    if last_year and int(last_year) == today.year:
        return False

    increase_bonus_balance(user["id"], 1000)
    add_bonus_operation(
        user_id=user["id"],
        amount=1000,
        operation_type="birthday_bonus",
        comment=f"Бонус на день рождения за {today.year} год"
    )
    set_birthday_bonus_year(user["id"], today.year)
    return True


def sync_order_cashback(user: dict, raw_orders=None):
    counteragent_id = (user or {}).get("livesklad_counteragent_id")
    if not counteragent_id:
        return 0.0

    if raw_orders is None:
        try:
            raw_orders = fetch_orders_by_counteragent_id(counteragent_id) or []
        except Exception as e:
            print(f"[BONUS SYNC] counteragent={counteragent_id} skipped due to: {e}")
            return 0.0

    eligible_orders = [o for o in (raw_orders or []) if is_bonus_eligible_order(o)]
    eligible_orders.sort(key=lambda item: item.get("dateCreate") or "")

    current_orders = {}
    for order in eligible_orders:
        order_id = str(order.get("id") or "").strip()
        if not order_id:
            continue
        current_orders[order_id] = round(get_order_total(order), 2)

    existing_accruals = {
        str(item.get("order_id") or ""): item
        for item in list_order_bonus_accruals(user["id"])
    }

    needs_rebuild = len(current_orders) != len(existing_accruals)

    if not needs_rebuild:
        for order_id, current_total in current_orders.items():
            existing = existing_accruals.get(order_id)
            if not existing:
                needs_rebuild = True
                break

            existing_total = round(float(existing.get("order_total") or 0), 2)
            if existing_total != current_total:
                needs_rebuild = True
                break

    if not needs_rebuild:
        return 0.0

    previous_cashback_total = get_order_cashback_operations_total(user["id"])
    reset_order_cashback_state(user["id"])

    accrued_total = 0.0

    for order in eligible_orders:
        order_id = str(order.get("id") or "").strip()
        if not order_id:
            continue

        account = get_bonus_account(user["id"])
        current_total_spent = float(account.get("total_spent") or 0)
        percent = get_cashback_percent(current_total_spent)

        order_total = round(get_order_total(order), 2)
        bonus_amount = round(order_total * percent, 2)

        create_order_bonus_accrual(
            user_id=user["id"],
            order_id=order_id,
            order_total=order_total,
            percent=percent,
            bonus_amount=bonus_amount
        )

        increase_total_spent(user["id"], order_total)

        if bonus_amount > 0:
            increase_bonus_balance(user["id"], bonus_amount)
            add_bonus_operation(
                user_id=user["id"],
                amount=bonus_amount,
                operation_type="order_cashback",
                comment="Кэшбэк {}% за заказ {}".format(int(percent * 100), order.get("number") or order_id),
                order_id=order_id
            )
            accrued_total += bonus_amount

    return round(accrued_total - previous_cashback_total, 2)


def build_bonus_payload(user_id: int):
    ensure_bonus_account(user_id)
    account = get_bonus_account(user_id)

    balance = round(float(account.get("balance") or 0), 2)
    total_spent = round(float(account.get("total_spent") or 0), 2)
    tier_percent = get_cashback_percent(total_spent)
    next_tier = get_next_tier(total_spent)

    payload = {
        "balance": balance,
        "currency": "RUB",
        "total_spent": total_spent,
        "tier_percent": tier_percent,
        "tier_label": f"{int(tier_percent * 100)}%",
        "next_tier_at": next_tier["threshold"] if next_tier else None,
        "next_tier_percent": next_tier["percent"] if next_tier else None,
        "next_tier_label": f"{int(next_tier['percent'] * 100)}%" if next_tier else None,
        "to_next_tier": round(max(0, (next_tier["threshold"] - total_spent)) if next_tier else 0, 2),
    }
    return payload


def format_bonus_operation(item: dict):
    created_at_raw = item.get("created_at")
    created_label = created_at_raw or ""
    dt = None

    try:
        dt = datetime.fromisoformat(str(created_at_raw)) if created_at_raw else None
    except Exception:
        dt = None

    if dt:
        created_label = dt.strftime("%d.%m.%Y %H:%M")

    amount = round(float(item.get("amount") or 0), 2)
    amount_label = f"{amount:,.2f}".replace(",", " ").replace(".00", "") + " ₽"
    if amount > 0:
        amount_label = "+" + amount_label

    operation_type = str(item.get("operation_type") or "").strip()
    title = BONUS_OPERATION_TITLES.get(operation_type, "Операция с бонусами")
    comment = str(item.get("comment") or "").strip()
    order_id = str(item.get("order_id") or "").strip()

    if operation_type == "order_cashback" and order_id and not comment:
        comment = f"Начисление за заказ {order_id}"

    return {
        "id": item.get("id"),
        "amount": amount,
        "amount_label": amount_label,
        "direction": "positive" if amount >= 0 else "negative",
        "operation_type": operation_type,
        "title": title,
        "comment": comment,
        "order_id": order_id or None,
        "created_at": created_at_raw,
        "created_label": created_label,
    }


@bonus_bp.route("/me", methods=["GET"])
def my_bonus():
    session_token = session.get("session_token")
    if not session_token:
        return jsonify({"error": "Не авторизован"}), 401

    auth_session = get_session(session_token)
    if not auth_session:
        return jsonify({"error": "Сессия не найдена"}), 401

    user = find_user_by_phone(auth_session["phone"])
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    ensure_bonus_account(user["id"])
    payload = build_bonus_payload(user["id"])
    operations = [format_bonus_operation(item) for item in list_bonus_operations(user["id"], limit=30)]

    return jsonify({
        "ok": True,
        "bonus": payload,
        "operations": operations,
    })

@bonus_bp.route("/history", methods=["GET"])
def bonus_history():
    session_token = session.get("session_token")
    if not session_token:
        return jsonify({"error": "Не авторизован"}), 401

    auth_session = get_session(session_token)
    if not auth_session:
        return jsonify({"error": "Сессия не найдена"}), 401

    user = find_user_by_phone(auth_session["phone"])
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    operations = [format_bonus_operation(item) for item in list_bonus_operations(user["id"], limit=30)]

    return jsonify({
        "ok": True,
        "operations": operations,
    })
