from dotenv import load_dotenv
load_dotenv()

from datetime import datetime, timezone
from flask import Flask, jsonify, render_template, request, session
from flask_cors import CORS

from auth import auth_bp
from bonus import bonus_bp, apply_birthday_bonus_if_needed, build_bonus_payload, sync_order_cashback
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
)


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
        # sync_order_cashback(current)
        bonus = build_bonus_payload(current["id"])

        orders = []
        counteragent_id = current.get("livesklad_counteragent_id")
        if counteragent_id:
            try:
                raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
                orders = [format_order(o) for o in raw_orders]
            except Exception:
                orders = []

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
        # sync_order_cashback(fresh)
        bonus = build_bonus_payload(fresh["id"])

        orders = []
        counteragent_id = fresh.get("livesklad_counteragent_id")
        if counteragent_id:
            try:
                raw_orders = enrich_orders_with_vin(fetch_orders_by_counteragent_id(counteragent_id) or [])
                orders = [format_order(o) for o in raw_orders]
            except Exception:
                orders = []

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
