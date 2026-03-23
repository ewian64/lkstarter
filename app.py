from dotenv import load_dotenv
load_dotenv()

from datetime import datetime, timezone
import time
from flask import Flask, jsonify, render_template, request, session, make_response
from flask_cors import CORS

from auth import auth_bp
from bonus import bonus_bp, apply_birthday_bonus_if_needed, build_bonus_payload, sync_order_cashback, format_bonus_operation
from config import Config
from livesklad import (
    fetch_orders_by_counteragent_id,
    enrich_orders_with_vin,
    fetch_order_detail,
    format_order,
    format_order_detail,
    build_customer_summary,
)
from models import (
    init_db,
    get_session,
    get_user_by_id,
    update_user_profile,
    update_user_birth_date,
    find_users_for_admin,
    get_bonus_account,
    list_bonus_operations,
    adjust_bonus_balance,
)


ADMIN_ORDER_CACHE = {}
ADMIN_ORDER_CACHE_TTL = 300


def get_admin_cached_orders(counteragent_id):
    if not counteragent_id:
        return []

    now = time.time()
    cached = ADMIN_ORDER_CACHE.get(str(counteragent_id))
    if cached and (now - cached["ts"] < ADMIN_ORDER_CACHE_TTL):
        return cached["orders"]

    raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
    orders = [format_order(o) for o in raw_orders]
    ADMIN_ORDER_CACHE[str(counteragent_id)] = {
        "ts": now,
        "orders": orders,
    }
    return orders


def create_app():
    app = Flask(__name__, template_folder="templates")
    app.config.from_object(Config)

    CORS(app, supports_credentials=True)
    init_db()

    app.register_blueprint(auth_bp)
    app.register_blueprint(bonus_bp)

    @app.route("/")
    def home():
        return render_template("index.html")

    @app.route("/health")
    def health():
        return jsonify({"ok": True})


    def require_admin():
        return bool(session.get("is_admin"))

    @app.route("/admin", methods=["GET"])
    def admin_home():
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        response = make_response(render_template("admin.html", admin_phone=session.get("admin_phone")))
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    @app.route("/admin/logout", methods=["POST"])
    def admin_logout():
        session.pop("is_admin", None)
        session.pop("admin_phone", None)
        return jsonify({"ok": True})


    @app.route("/admin/search", methods=["GET"])
    def admin_search():
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        q = str(request.args.get("q", "")).strip()
        query = q.lower()
        digits_only = "".join(ch for ch in q if ch.isdigit())
        phone_like_query = bool(q) and all(ch.isdigit() or ch in "+-() " for ch in q) and len(digits_only) >= 4

        users = find_users_for_admin("")
        results = []

        for user in users:
            counteragent_id = user.get("livesklad_counteragent_id")
            formatted_orders = []

            user_phone = str(user.get("phone") or "")
            user_name = str(user.get("name") or "").lower()

            user_matches = (
                not q
                or query in user_name
                or (phone_like_query and digits_only in "".join(ch for ch in user_phone if ch.isdigit()))
            )

            should_load_orders = bool(counteragent_id) and (not phone_like_query or user_matches)

            if should_load_orders:
                try:
                    formatted_orders = get_admin_cached_orders(counteragent_id)
                except Exception as e:
                    cached = ADMIN_ORDER_CACHE.get(str(counteragent_id))
                    if cached:
                        formatted_orders = cached.get("orders") or []
                    else:
                        formatted_orders = []
                    print(f"[ADMIN SEARCH] counteragent={counteragent_id} fallback to cache/empty due to: {e}")

            matched_orders = []
            for order in formatted_orders:
                order_number = str(order.get("number") or "").lower()
                order_vin = str(order.get("vin") or order.get("vehicleVin") or "").lower()
                vehicle_label = str(order.get("vehicleLabel") or order.get("deviceLabel") or "").lower()
                summary = str(order.get("summary") or "").lower()

                order_match = (
                    not q
                    or query in order_number
                    or (q.isdigit() and digits_only in "".join(ch for ch in order_number if ch.isdigit()))
                    or query in order_vin
                    or query in vehicle_label
                    or query in summary
                )

                if order_match:
                    matched_orders.append({
                        "id": order.get("id"),
                        "number": order.get("number"),
                        "createdLabel": order.get("createdLabel"),
                        "status": order.get("shortStatus") or order.get("status"),
                        "vehicleLabel": order.get("vehicleLabel") or order.get("deviceLabel"),
                        "vin": order.get("vin") or order.get("vehicleVin") or "",
                        "summary": order.get("summary") or "",
                        "paymentLabel": order.get("paymentLabel") or "",
                    })

            if matched_orders or (phone_like_query and user_matches):
                results.append({
                    "user": {
                        "id": user.get("id"),
                        "phone": user.get("phone"),
                        "name": user.get("name") or "",
                        "birth_date": user.get("birth_date"),
                        "profile_completed": bool(user.get("profile_completed")),
                        "livesklad_counteragent_id": user.get("livesklad_counteragent_id") or "",
                    },
                    "orders": (formatted_orders[:20] if phone_like_query and user_matches else matched_orders[:20]),
                })

        return jsonify({
            "ok": True,
            "count": len(results),
            "results": results[:50],
        })


    @app.route("/admin/client/<int:user_id>", methods=["GET"])
    def admin_client_detail(user_id):
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "Клиент не найден"}), 404

        orders = []
        raw_orders = []
        counteragent_id = user.get("livesklad_counteragent_id")

        if counteragent_id:
            try:
                raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
                orders = [format_order(o) for o in raw_orders]
                ADMIN_ORDER_CACHE[str(counteragent_id)] = {
                    "ts": time.time(),
                    "orders": orders,
                }
            except Exception as e:
                cached = ADMIN_ORDER_CACHE.get(str(counteragent_id))
                if cached:
                    orders = cached.get("orders") or []
                else:
                    orders = []
                raw_orders = None
                print(f"[ADMIN CLIENT] counteragent={counteragent_id} fallback to cache/empty due to: {e}")

        try:
            sync_order_cashback(user, raw_orders=raw_orders)
        except Exception as e:
            print(f"[ADMIN CLIENT BONUS SYNC] user_id={user_id} skipped due to: {e}")

        user = get_user_by_id(user_id)
        bonus = build_bonus_payload(user_id)
        bonus_history = [format_bonus_operation(item) for item in list_bonus_operations(user_id, limit=30)]
        bonus_account = get_bonus_account(user_id) or {}

        return jsonify({
            "ok": True,
            "client": {
                "id": user.get("id"),
                "phone": user.get("phone"),
                "name": user.get("name") or "",
                "birth_date": user.get("birth_date") or "",
                "profile_completed": bool(user.get("profile_completed")),
                "livesklad_counteragent_id": user.get("livesklad_counteragent_id") or "",
            },
            "bonus": bonus,
            "bonus_account": {
                "balance": float(bonus_account.get("balance") or 0),
                "total_spent": float(bonus_account.get("total_spent") or 0),
                "birthday_bonus_year": bonus_account.get("birthday_bonus_year"),
                "first_login_bonus_given": bool(bonus_account.get("first_login_bonus_given")),
            },
            "bonus_history": bonus_history,
            "orders": orders[:50],
        })


    @app.route("/admin/order/<order_id>", methods=["GET"])
    def admin_order_detail(order_id):
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        try:
            order = fetch_order_detail(order_id)
            return jsonify({
                "ok": True,
                "order": format_order_detail(order)
            })
        except Exception as e:
            return jsonify({"error": str(e) or "Не удалось загрузить заказ"}), 500

    @app.route("/admin/client/<int:user_id>/birth-date", methods=["POST"])
    def admin_update_client_birth_date(user_id):
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "Клиент не найден"}), 404

        data = request.get_json(silent=True) or {}
        birth_date = str(data.get("birth_date", "")).strip()

        if not birth_date:
            return jsonify({"error": "Укажите дату рождения"}), 400

        try:
            dt = datetime.strptime(birth_date, "%Y-%m-%d").date()
            if dt.year < 1900:
                return jsonify({"error": "Дата рождения указана некорректно"}), 400
            if dt > datetime.now(timezone.utc).date():
                return jsonify({"error": "Дата рождения не может быть в будущем"}), 400
        except Exception:
            return jsonify({"error": "Введите дату рождения в формате ГГГГ-ММ-ДД"}), 400

        update_user_birth_date(user_id, birth_date)
        fresh = get_user_by_id(user_id)

        return jsonify({
            "ok": True,
            "birth_date": fresh.get("birth_date") or ""
        })

    @app.route("/admin/client/<int:user_id>/bonus", methods=["POST"])
    def admin_adjust_client_bonus(user_id):
        if not require_admin():
            return jsonify({"error": "Доступ запрещён"}), 403

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "Клиент не найден"}), 404

        data = request.get_json(silent=True) or {}
        action = str(data.get("action", "")).strip()
        amount_raw = data.get("amount", 0)
        comment = str(data.get("comment", "")).strip()

        try:
            amount = float(amount_raw)
        except Exception:
            return jsonify({"error": "Некорректная сумма"}), 400

        if amount <= 0:
            return jsonify({"error": "Сумма должна быть больше нуля"}), 400

        if action == "add":
            delta = amount
            operation_type = "set"
        elif action == "subtract":
            delta = -amount
            operation_type = "writeoff"
        else:
            return jsonify({"error": "Некорректное действие"}), 400

        try:
            balance = adjust_bonus_balance(user_id, delta, operation_type, comment)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        bonus = build_bonus_payload(user_id)
        bonus_history = [format_bonus_operation(item) for item in list_bonus_operations(user_id, limit=30)]

        return jsonify({
            "ok": True,
            "balance": balance,
            "bonus": bonus,
            "bonus_history": bonus_history,
        })

    def require_current_user():
        session_token = session.get("session_token")
        if not session_token:
            return None
        current = get_session(session_token)
        if not current:
            return None
        return get_user_by_id(current["user_id"])

    @app.route("/me/profile", methods=["GET"])
    def my_profile():
        current = require_current_user()
        if not current:
            return jsonify({"error": "Не авторизован"}), 401

        apply_birthday_bonus_if_needed(current)

        raw_orders = []
        orders = []
        counteragent_id = current.get("livesklad_counteragent_id")

        if counteragent_id:
            try:
                raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
                orders = [format_order(o) for o in raw_orders]
            except Exception as e:
                raw_orders = None
                orders = []
                print(f"[MY PROFILE] counteragent={counteragent_id} fallback to empty due to: {e}")

        try:
            sync_order_cashback(current, raw_orders=raw_orders)
        except Exception as e:
            print(f"[MY PROFILE BONUS SYNC] user_id={current['id']} skipped due to: {e}")

        bonus = build_bonus_payload(current["id"])
        customer_summary = build_customer_summary(orders)

        return jsonify({
            "id": current["id"],
            "name": current.get("name") or "",
            "phone": current["phone"],
            "birth_date": current.get("birth_date"),
            "profile_completed": bool(current.get("profile_completed")),
            "bonus_balance": bonus["balance"],
            "bonus": bonus,
            "customer_summary": customer_summary,
        })

    @app.route("/me/profile", methods=["POST"])
    def update_profile():
        current = require_current_user()
        if not current:
            return jsonify({"error": "Не авторизован"}), 401

        data = request.get_json(silent=True) or {}
        name = str(data.get("name", "")).strip()
        birth_date = str(data.get("birth_date", "")).strip()

        if len(name) < 2:
            return jsonify({"error": "Введите имя"}), 400

        if birth_date:
            try:
                dt = datetime.strptime(birth_date, "%Y-%m-%d").date()
                if dt.year < 1900:
                    return jsonify({"error": "Дата рождения указана некорректно"}), 400
                if dt > datetime.now(timezone.utc).date():
                    return jsonify({"error": "Дата рождения не может быть в будущем"}), 400
            except Exception:
                return jsonify({"error": "Введите дату рождения в формате ГГГГ-ММ-ДД"}), 400

        update_user_profile(current["id"], name, birth_date)

        fresh = get_user_by_id(current["id"])
        apply_birthday_bonus_if_needed(fresh)

        raw_orders = []
        orders = []
        counteragent_id = fresh.get("livesklad_counteragent_id")

        if counteragent_id:
            try:
                raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
                orders = [format_order(o) for o in raw_orders]
            except Exception as e:
                raw_orders = None
                orders = []
                print(f"[UPDATE PROFILE] counteragent={counteragent_id} fallback to empty due to: {e}")

        try:
            sync_order_cashback(fresh, raw_orders=raw_orders)
        except Exception as e:
            print(f"[UPDATE PROFILE BONUS SYNC] user_id={fresh['id']} skipped due to: {e}")

        bonus = build_bonus_payload(fresh["id"])
        customer_summary = build_customer_summary(orders)

        return jsonify({
            "ok": True,
            "profile": {
                "id": fresh["id"],
                "name": fresh.get("name") or "",
                "phone": fresh["phone"],
                "birth_date": fresh.get("birth_date"),
                "profile_completed": bool(fresh.get("profile_completed")),
                "bonus_balance": bonus["balance"],
                "bonus": bonus,
                "customer_summary": customer_summary,
            }
        })

    @app.route("/me/orders", methods=["GET"])
    def my_orders():
        current = require_current_user()
        if not current:
            return jsonify({"error": "Не авторизован"}), 401

        counteragent_id = current.get("livesklad_counteragent_id")
        if not counteragent_id:
            return jsonify({"count": 0, "orders": []})

        try:
            orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id))
        except Exception:
            orders = []
        result = [format_order(o) for o in orders]
        result.sort(key=lambda x: x.get("dateCreate") or "", reverse=True)

        return jsonify({
            "count": len(result),
            "orders": result
        })

    @app.route("/me/orders/<order_id>", methods=["GET"])
    def my_order_detail(order_id):
        current = require_current_user()
        if not current:
            return jsonify({"error": "Не авторизован"}), 401

        order = fetch_order_detail(order_id)
        order_counteragent = (order.get("counteragent") or {}).get("id")
        current_counteragent = current.get("livesklad_counteragent_id")

        if not current_counteragent or str(order_counteragent) != str(current_counteragent):
            return jsonify({"error": "Доступ запрещён"}), 403

        return jsonify(format_order_detail(order))

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
