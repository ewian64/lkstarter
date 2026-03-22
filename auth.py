import secrets
from flask import Blueprint, jsonify, request, session

from bonus import apply_birthday_bonus_if_needed, apply_first_login_bonus
from config import Config
from livesklad import normalize_phone, find_exact_counteragent_by_phone
from models import (
    find_user_by_phone,
    create_user,
    save_sms_code,
    get_active_sms_code,
    mark_sms_code_used,
    create_session,
    get_session,
    delete_session,
    update_user_counteragent,
    get_user_by_id,
)


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def generate_code():
    return str(secrets.randbelow(9000) + 1000)


def send_sms_code(phone: str, code: str):
    print(f"[SMS TEST] phone={phone}, code={code}")
    return True


@auth_bp.route("/send-code", methods=["POST"])
def send_code():
    data = request.get_json(silent=True) or {}
    phone = normalize_phone(data.get("phone"))

    if len(phone) < 11:
        return jsonify({"error": "Введите корректный номер телефона"}), 400

    if Config.TEST_LOGIN_ENABLED:
        return jsonify({"ok": True, "test_mode": True})

    counteragent = find_exact_counteragent_by_phone(phone)
    if not counteragent:
        return jsonify({"error": "Клиент с таким номером не найден"}), 404

    code = generate_code()
    save_sms_code(phone, code)
    send_sms_code(phone, code)

    return jsonify({"ok": True})


@auth_bp.route("/verify-code", methods=["POST"])
def verify_code():
    data = request.get_json(silent=True) or {}
    phone = normalize_phone(data.get("phone"))
    code = str(data.get("code", "")).strip()

    if not (Config.TEST_LOGIN_ENABLED and code == "0000"):
        row = get_active_sms_code(phone, code)
        if not row:
            return jsonify({"error": "Неверный или просроченный код"}), 400

        mark_sms_code_used(row["id"])

    counteragent = find_exact_counteragent_by_phone(phone)
    if not counteragent:
        return jsonify({"error": "Клиент в CRM не найден"}), 404

    user = find_user_by_phone(phone)
    if not user:
        user = create_user(
            phone=phone,
            name=counteragent.get("name", "") or "",
            livesklad_counteragent_id=counteragent.get("id", "") or ""
        )
    else:
        if not user.get("livesklad_counteragent_id"):
            update_user_counteragent(
                user_id=user["id"],
                counteragent_id=counteragent.get("id", "") or "",
                name=counteragent.get("name", "") or ""
            )
            user = get_user_by_id(user["id"])

    session_token = secrets.token_urlsafe(32)
    create_session(user["id"], session_token, Config.SESSION_DAYS)
    session["session_token"] = session_token

    apply_first_login_bonus(user["id"])
    user = get_user_by_id(user["id"])
    apply_birthday_bonus_if_needed(user)

    return jsonify({
        "ok": True,
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "name": user.get("name") or "",
            "birth_date": user.get("birth_date"),
            "profile_completed": bool(user.get("profile_completed")),
        }
    })


@auth_bp.route("/me", methods=["GET"])
def me():
    session_token = session.get("session_token")
    if not session_token:
        return jsonify({"error": "Не авторизован"}), 401

    current = get_session(session_token)
    if not current:
        return jsonify({"error": "Сессия недействительна"}), 401

    return jsonify({
        "id": current["user_id"],
        "phone": current["phone"],
        "name": current["name"],
        "birth_date": current.get("birth_date"),
        "profile_completed": bool(current.get("profile_completed")),
        "livesklad_counteragent_id": current["livesklad_counteragent_id"],
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session_token = session.get("session_token")
    if session_token:
        delete_session(session_token)
    session.clear()
    return jsonify({"ok": True})
