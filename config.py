import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-please")
    JSON_AS_ASCII = False

    # LiveSklad
    LIVESKLAD_LOGIN = os.getenv("LIVESKLAD_LOGIN", "")
    LIVESKLAD_PASSWORD = os.getenv("LIVESKLAD_PASSWORD", "")
    AUTH_URL = "https://api.livesklad.com/auth"
    ORDERS_URL = "https://api.livesklad.com/company/orders"
    COUNTERAGENTS_URL = "https://api.livesklad.com/counteragents"
    ORDER_DETAIL_URL = "https://api.livesklad.com/orders"
    IMAGES_BASE_URL = os.getenv("IMAGES_BASE_URL", "")
    API_TIMEOUT = int(os.getenv("API_TIMEOUT", "20"))

    # SQLite
    DATABASE_PATH = os.getenv("DATABASE_PATH", "app.db")

    # SMS
    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "stub")
    SMS_API_EMAIL = os.getenv("SMS_API_EMAIL", "")
    SMS_API_KEY = os.getenv("SMS_API_KEY", "")
    SMS_SENDER = os.getenv("SMS_SENDER", "StarterSar")
    TEST_LOGIN_ENABLED = os.getenv("TEST_LOGIN_ENABLED", "false").lower() == "true"

    # Session
    SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))

    # Admin
    ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-admin-token")

    # Bonus program
    BONUS_PROGRAM_START_DATE = os.getenv("BONUS_PROGRAM_START_DATE", "2026-03-19")