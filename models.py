# models.py
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from config import Config


@contextmanager
def get_db():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row["name"] == column_name for row in rows)


def _add_column_if_missing(conn, table_name: str, column_name: str, sql_type: str, default_sql: str = ""):
    if not _column_exists(conn, table_name, column_name):
        default_part = f" DEFAULT {default_sql}" if default_sql else ""
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sql_type}{default_part}")


def init_db():
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            name TEXT,
            birth_date TEXT,
            profile_completed INTEGER NOT NULL DEFAULT 0,
            livesklad_counteragent_id TEXT,
            created_at TEXT NOT NULL
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS sms_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            is_used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS bonus_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            total_spent REAL NOT NULL DEFAULT 0,
            first_login_bonus_given INTEGER NOT NULL DEFAULT 0,
            birthday_bonus_year INTEGER,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS bonus_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            operation_type TEXT NOT NULL,
            comment TEXT,
            order_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS order_bonus_accruals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id TEXT NOT NULL,
            order_total REAL NOT NULL,
            percent REAL NOT NULL,
            bonus_amount REAL NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, order_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """)

        _add_column_if_missing(conn, "users", "birth_date", "TEXT")
        _add_column_if_missing(conn, "users", "profile_completed", "INTEGER", "0")

        _add_column_if_missing(conn, "bonus_accounts", "total_spent", "REAL", "0")
        _add_column_if_missing(conn, "bonus_accounts", "first_login_bonus_given", "INTEGER", "0")
        _add_column_if_missing(conn, "bonus_accounts", "birthday_bonus_year", "INTEGER")

        if not _column_exists(conn, "bonus_operations", "order_id"):
            conn.execute("ALTER TABLE bonus_operations ADD COLUMN order_id TEXT")


def find_user_by_phone(phone: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE phone = ?",
            (phone,)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()
        return dict(row) if row else None


def find_users_for_admin(phone_query: str = ""):
    normalized = "".join(ch for ch in str(phone_query or "") if ch.isdigit())

    with get_db() as conn:
        if normalized:
            rows = conn.execute(
                "SELECT * FROM users WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', '') LIKE ? ORDER BY created_at DESC LIMIT 50",
                (f"%{normalized}%",)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM users ORDER BY created_at DESC LIMIT 50"
            ).fetchall()

        return [dict(row) for row in rows]


def create_user(phone: str, name: str = "", livesklad_counteragent_id: str = ""):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO users (phone, name, birth_date, profile_completed, livesklad_counteragent_id, created_at)
            VALUES (?, ?, NULL, 0, ?, ?)
        """, (phone, name, livesklad_counteragent_id, now))

    return find_user_by_phone(phone)


def update_user_counteragent(user_id: int, counteragent_id: str, name: str = ""):
    with get_db() as conn:
        conn.execute("""
            UPDATE users
            SET livesklad_counteragent_id = ?,
                name = CASE
                    WHEN (? IS NOT NULL AND ? != '') THEN ?
                    ELSE name
                END
            WHERE id = ?
        """, (counteragent_id, name, name, name, user_id))


def update_user_profile(user_id: int, name: str, birth_date: str):
    with get_db() as conn:
        conn.execute("""
            UPDATE users
            SET name = ?, birth_date = ?, profile_completed = 1
            WHERE id = ?
        """, (name, birth_date, user_id))


def update_user_birth_date(user_id: int, birth_date: str):
    with get_db() as conn:
        conn.execute("""
            UPDATE users
            SET birth_date = ?
            WHERE id = ?
        """, (birth_date, user_id))


def save_sms_code(phone: str, code: str, ttl_minutes: int = 5):
    now = datetime.utcnow()
    expires_at = (now + timedelta(minutes=ttl_minutes)).isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO sms_codes (phone, code, expires_at, is_used, created_at)
            VALUES (?, ?, ?, 0, ?)
        """, (phone, code, expires_at, now.isoformat()))


def get_active_sms_code(phone: str, code: str):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        row = conn.execute("""
            SELECT * FROM sms_codes
            WHERE phone = ? AND code = ? AND is_used = 0 AND expires_at > ?
            ORDER BY id DESC
            LIMIT 1
        """, (phone, code, now)).fetchone()
        return dict(row) if row else None


def mark_sms_code_used(code_id: int):
    with get_db() as conn:
        conn.execute(
            "UPDATE sms_codes SET is_used = 1 WHERE id = ?",
            (code_id,)
        )


def create_session(user_id: int, session_token: str, days: int = 30):
    now = datetime.utcnow()
    expires_at = (now + timedelta(days=days)).isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO sessions (user_id, session_token, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        """, (user_id, session_token, expires_at, now.isoformat()))


def get_session(session_token: str):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        row = conn.execute("""
            SELECT
                s.*,
                u.phone,
                u.name,
                u.birth_date,
                u.profile_completed,
                u.livesklad_counteragent_id
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.session_token = ? AND s.expires_at > ?
            LIMIT 1
        """, (session_token, now)).fetchone()
        return dict(row) if row else None


def delete_session(session_token: str):
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE session_token = ?", (session_token,))


def ensure_bonus_account(user_id: int):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        row = conn.execute("""
            SELECT id FROM bonus_accounts WHERE user_id = ?
        """, (user_id,)).fetchone()
        if not row:
            conn.execute("""
                INSERT INTO bonus_accounts (
                    user_id,
                    balance,
                    total_spent,
                    first_login_bonus_given,
                    birthday_bonus_year,
                    updated_at
                )
                VALUES (?, 0, 0, 0, NULL, ?)
            """, (user_id, now))


def get_bonus_account(user_id: int):
    ensure_bonus_account(user_id)
    with get_db() as conn:
        row = conn.execute("""
            SELECT * FROM bonus_accounts WHERE user_id = ?
        """, (user_id,)).fetchone()
        return dict(row) if row else None


def get_bonus_balance(user_id: int) -> float:
    account = get_bonus_account(user_id)
    return float(account["balance"]) if account else 0.0


def add_bonus_operation(user_id: int, amount: float, operation_type: str, comment: str = "", order_id: str = None):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO bonus_operations (user_id, amount, operation_type, comment, order_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, amount, operation_type, comment, order_id, now))


def list_bonus_operations(user_id: int, limit: int = 30):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT *
            FROM bonus_operations
            WHERE user_id = ?
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
        """, (user_id, int(limit))).fetchall()
        return [dict(row) for row in rows]


def set_bonus_balance(user_id: int, amount: float, comment: str = ""):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE bonus_accounts
            SET balance = ?, updated_at = ?
            WHERE user_id = ?
        """, (amount, now, user_id))
    add_bonus_operation(user_id, amount, "set", comment)


def increase_bonus_balance(user_id: int, amount: float):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE bonus_accounts
            SET balance = balance + ?, updated_at = ?
            WHERE user_id = ?
        """, (amount, now, user_id))


def adjust_bonus_balance(user_id: int, delta: float, operation_type: str, comment: str = ""):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()

    with get_db() as conn:
        row = conn.execute(
            "SELECT balance FROM bonus_accounts WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        current_balance = float(row["balance"]) if row else 0.0
        new_balance = current_balance + float(delta)

        if new_balance < 0:
            raise ValueError("Недостаточно бонусов для списания")

        conn.execute("""
            UPDATE bonus_accounts
            SET balance = ?, updated_at = ?
            WHERE user_id = ?
        """, (new_balance, now, user_id))

    add_bonus_operation(user_id, float(delta), operation_type, comment)
    return new_balance


def increase_total_spent(user_id: int, amount: float):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE bonus_accounts
            SET total_spent = total_spent + ?, updated_at = ?
            WHERE user_id = ?
        """, (amount, now, user_id))


def mark_first_login_bonus_given(user_id: int):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE bonus_accounts
            SET first_login_bonus_given = 1, updated_at = ?
            WHERE user_id = ?
        """, (now, user_id))


def set_birthday_bonus_year(user_id: int, year: int):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE bonus_accounts
            SET birthday_bonus_year = ?, updated_at = ?
            WHERE user_id = ?
        """, (year, now, user_id))


def has_order_bonus_accrual(user_id: int, order_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute("""
            SELECT id FROM order_bonus_accruals
            WHERE user_id = ? AND order_id = ?
            LIMIT 1
        """, (user_id, order_id)).fetchone()
        return bool(row)


def create_order_bonus_accrual(user_id: int, order_id: str, order_total: float, percent: float, bonus_amount: float):
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO order_bonus_accruals (user_id, order_id, order_total, percent, bonus_amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, order_id, order_total, percent, bonus_amount, now))
def list_order_bonus_accruals(user_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT *
            FROM order_bonus_accruals
            WHERE user_id = ?
            ORDER BY created_at ASC, id ASC
        """, (user_id,)).fetchall()
        return [dict(row) for row in rows]


def get_order_cashback_operations_total(user_id: int) -> float:
    with get_db() as conn:
        row = conn.execute("""
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM bonus_operations
            WHERE user_id = ? AND operation_type = 'order_cashback'
        """, (user_id,)).fetchone()
        return float((dict(row).get("total") if row else 0) or 0.0)


def reset_order_cashback_state(user_id: int):
    ensure_bonus_account(user_id)
    now = datetime.utcnow().isoformat()
    cashback_total = get_order_cashback_operations_total(user_id)

    with get_db() as conn:
        conn.execute("""
            DELETE FROM order_bonus_accruals
            WHERE user_id = ?
        """, (user_id,))

        conn.execute("""
            DELETE FROM bonus_operations
            WHERE user_id = ? AND operation_type = 'order_cashback'
        """, (user_id,))

        conn.execute("""
            UPDATE bonus_accounts
            SET balance = balance - ?, total_spent = 0, updated_at = ?
            WHERE user_id = ?
        """, (cashback_total, now, user_id))
