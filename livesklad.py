# livesklad.py
import re
import requests
from datetime import datetime, timedelta, timezone
from config import Config

TOKEN_CACHE = {
    "token": None,
    "expires_at": None,
}


def normalize_phone(phone):
    digits = re.sub(r"\D", "", str(phone or ""))
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    return digits


def normalize_phone_last10(phone):
    digits = normalize_phone(phone)
    return digits[-10:]


def cleanup_spaces(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def to_number(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def format_money_short(value):
    return f"{int(round(to_number(value))):,}".replace(",", " ") + " ₽"


def parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def format_datetime_label(value):
    dt = parse_iso(value)
    if not dt:
        return ""
    return dt.strftime("%d.%m.%Y %H:%M")


def format_date_label(value):
    dt = parse_iso(value)
    if not dt:
        return ""
    return dt.strftime("%d.%m.%Y")


def status_meta(status_name):
    raw = cleanup_spaces(status_name).lower()

    if any(x in raw for x in ["отмен", "отказ", "возврат"]):
        return {
            "tone": "rose",
            "short": "Отменён",
            "group": "done",
            "stage": "cancelled",
            "next_action": "Если хотите, можно создать новый заказ.",
            "next_note": "Свяжитесь с сервисом для уточнения деталей."
        }

    if "выдан" in raw:
        return {
            "tone": "emerald",
            "short": "Выдан",
            "group": "done",
            "stage": "issued",
            "next_action": "Автомобиль выдан.",
            "next_note": "Спасибо за обращение."
        }

    if any(x in raw for x in ["готов", "заверш", "закрыт", "успешно"]):
        return {
            "tone": "teal",
            "short": "Готов к выдаче",
            "group": "done",
            "stage": "done",
            "next_action": "Автомобиль готов к выдаче.",
            "next_note": "Можно забрать автомобиль или уточнить время выдачи."
        }

    if any(x in raw for x in ["ожид", "соглас", "запчаст", "диагност", "провер", "подтверж"]):
        return {
            "tone": "sand",
            "short": "Ожидает",
            "group": "waiting",
            "stage": "waiting",
            "next_action": "Заказ на этапе ожидания или согласования.",
            "next_note": "Сервис может ждать подтверждение или запчасти."
        }

    return {
        "tone": "slate",
        "short": "В работе",
        "group": "active",
        "stage": "active",
        "next_action": "Заказ в работе.",
        "next_note": "Если нужен быстрый статус, свяжитесь с сервисом."
    }


def build_timeline(order, status_info):
    created = format_datetime_label(order.get("dateCreate"))
    last_action = format_datetime_label(order.get("lastAction"))
    finished = format_datetime_label(order.get("dateFinish"))
    stage = status_info["stage"]

    return [
        {
            "key": "created",
            "title": "Заказ создан",
            "subtitle": created or "Дата создания не указана",
            "state": "done",
        },
        {
            "key": "diagnostics",
            "title": "Диагностика и согласование",
            "subtitle": last_action or "Статус обновляется сервисом",
            "state": "done" if stage in ["active", "waiting", "done", "issued"] else "active",
        },
        {
            "key": "repair",
            "title": "Ремонт / подготовка",
            "subtitle": cleanup_spaces((order.get("status") or {}).get("name")) or "Текущий этап заказа",
            "state": "active" if stage in ["active", "waiting"] else ("done" if stage in ["done", "issued"] else ""),
        },
        {
            "key": "ready",
            "title": "Выдан клиенту" if stage == "issued" else "Готов к выдаче",
            "subtitle": finished or "Появится после завершения работ",
            "state": "done" if stage in ["done", "issued"] else "",
        },
    ]


def get_token():
    now = datetime.now(timezone.utc)

    if TOKEN_CACHE["token"] and TOKEN_CACHE["expires_at"] and now < TOKEN_CACHE["expires_at"]:
        return TOKEN_CACHE["token"]

    response = requests.post(
        Config.AUTH_URL,
        json={
            "login": Config.LIVESKLAD_LOGIN,
            "password": Config.LIVESKLAD_PASSWORD
        },
        timeout=Config.API_TIMEOUT,
    )
    data = response.json()

    if response.status_code != 200:
        raise Exception(data.get("error", {}).get("message", "Ошибка авторизации LiveSklad"))

    token = data.get("token")
    ttl = data.get("ttl", 900)

    if not token:
        raise Exception("Токен LiveSklad не получен")

    TOKEN_CACHE["token"] = token
    TOKEN_CACHE["expires_at"] = now + timedelta(seconds=max(ttl - 30, 60))
    return token


def get_headers():
    return {
        "Authorization": get_token(),
        "Accept": "application/json",
    }


def fetch_counteragents_by_phone(phone):
    response = requests.get(
        Config.COUNTERAGENTS_URL,
        headers=get_headers(),
        params={
            "phone": phone,
            "page": 1,
            "pageSize": 50,
        },
        timeout=Config.API_TIMEOUT,
    )
    data = response.json()
    if response.status_code != 200:
        raise Exception(f"Ошибка поиска контрагентов: {data}")
    return data.get("data", [])


def find_exact_counteragent_by_phone(phone):
    target = normalize_phone_last10(phone)
    candidates = fetch_counteragents_by_phone(phone)

    for ca in candidates:
        phones = ca.get("phones", [])
        if isinstance(phones, str):
            phones = [phones]

        for p in phones:
            if normalize_phone_last10(p) == target:
                return ca

    return None


def fetch_orders_by_counteragent_id(counteragent_id):
    page = 1
    page_size = 50
    all_orders = []

    while True:
        response = requests.get(
            Config.ORDERS_URL,
            headers=get_headers(),
            params={
                "counteragentId": counteragent_id,
                "page": page,
                "pageSize": page_size,
                "sort": "dateCreate DESC",
            },
            timeout=Config.API_TIMEOUT,
        )
        data = response.json()

        if response.status_code != 200:
            raise Exception(f"Ошибка загрузки заказов: {data}")

        orders = data.get("data", [])
        if not orders:
            break

        all_orders.extend(orders)

        if len(orders) < page_size:
            break

        page += 1

    return all_orders


def fetch_order_detail(order_id):
    response = requests.get(
        f"{Config.ORDER_DETAIL_URL}/{order_id}",
        headers=get_headers(),
        timeout=Config.API_TIMEOUT,
    )
    data = response.json()

    if response.status_code != 200:
        raise Exception(f"Ошибка загрузки заказа: {data}")

    return data.get("data", {})


def build_problem_text(problem):
    if isinstance(problem, list):
        return cleanup_spaces("; ".join([str(x) for x in problem if str(x).strip()]))
    return cleanup_spaces(problem)


def build_device_label(order):
    parts = [
        cleanup_spaces(order.get("brand")),
        cleanup_spaces(order.get("model")),
        cleanup_spaces(order.get("device")),
    ]
    unique = []
    for part in parts:
        if part and part not in unique:
            unique.append(part)
    return " · ".join(unique) if unique else "Автомобиль не указан"


def extract_vin(order):
    candidates = [
        order.get("vin"),
        order.get("VIN"),
        order.get("sn"),
        order.get("serialNumber"),
        order.get("serial_number"),
        order.get("deviceSn"),
        order.get("deviceSN"),
        (order.get("device") or {}).get("vin") if isinstance(order.get("device"), dict) else None,
        (order.get("device") or {}).get("sn") if isinstance(order.get("device"), dict) else None,
        (order.get("car") or {}).get("vin") if isinstance(order.get("car"), dict) else None,
        (order.get("transport") or {}).get("vin") if isinstance(order.get("transport"), dict) else None,
    ]

    for value in candidates:
        cleaned = cleanup_spaces(value)
        if cleaned:
            return cleaned

    return ""


def build_vehicle_key(order):
    brand = cleanup_spaces(order.get("brand"))
    model = cleanup_spaces(order.get("model"))
    device = cleanup_spaces(order.get("device")) if not isinstance(order.get("device"), dict) else cleanup_spaces((order.get("device") or {}).get("name"))
    vin = extract_vin(order)

    base = " ".join([x for x in [brand, model, device] if x]).strip()
    if not base:
        base = "Неизвестный автомобиль"

    if vin:
        return f"{base} · {vin}"
    return base


def split_vehicle_key(value: str):
    text = cleanup_spaces(value)
    if not text:
        return {"label": "Неизвестный автомобиль", "vin": ""}

    parts = [part.strip() for part in text.split("·") if part.strip()]
    if len(parts) >= 2:
        vin = parts[-1]
        label = " · ".join(parts[:-1]).strip()
        return {"label": label or text, "vin": vin}

    return {"label": text, "vin": ""}


def normalize_image_url(value):
    url = cleanup_spaces(value)
    if not url:
        return ""

    if url.startswith("http://") or url.startswith("https://"):
        return url

    base = cleanup_spaces(getattr(Config, "IMAGES_BASE_URL", ""))
    if base:
        return base.rstrip("/") + "/" + url.lstrip("/")

    return url


def extract_image_urls(order):
    raw_images = order.get("images") or []
    result = []

    if isinstance(raw_images, dict):
        raw_images = raw_images.get("items") or raw_images.get("data") or [raw_images]

    if not isinstance(raw_images, list):
        raw_images = [raw_images]

    for item in raw_images:
        if isinstance(item, str):
            url = normalize_image_url(item)
            if url:
                result.append(url)
            continue

        if not isinstance(item, dict):
            continue

        candidates = [
            item.get("url"),
            item.get("src"),
            item.get("path"),
            item.get("original"),
            item.get("preview"),
            item.get("downloadUrl"),
            item.get("image"),
        ]

        for candidate in candidates:
            url = normalize_image_url(candidate)
            if url:
                result.append(url)
                break

    unique = []
    seen = set()

    for url in result:
        if url not in seen:
            unique.append(url)
            seen.add(url)

    return unique


def format_order(order):
    counteragent = order.get("counteragent", {})
    status = order.get("status", {})
    summ = order.get("summ", {})
    status_info = status_meta(status.get("name"))

    price = to_number(summ.get("price", 0))
    sold_price = to_number(summ.get("soldPrice", 0))
    total = sold_price if sold_price > 0 else price

    device_label = build_device_label(order)
    vehicle_key = build_vehicle_key(order)
    vehicle_info = split_vehicle_key(vehicle_key)
    vin = extract_vin(order)
    problem_text = build_problem_text(order.get("problem", []))
    summary = problem_text or f"{device_label}. Статус: {status_info['short'].lower()}."
    image_urls = extract_image_urls(order)

    return {
        "id": order.get("id"),
        "number": order.get("number"),
        "dateCreate": order.get("dateCreate"),
        "createdLabel": format_datetime_label(order.get("dateCreate")),
        "createdDateLabel": format_date_label(order.get("dateCreate")),
        "client": counteragent.get("name"),
        "phones": counteragent.get("phones", []),
        "device": order.get("device"),
        "deviceLabel": device_label,
        "vehicleKey": vehicle_key,
        "vehicleLabel": vehicle_info["label"],
        "vehicleVin": vehicle_info["vin"] or vin,
        "problemText": problem_text,
        "status": status.get("name"),
        "shortStatus": status_info["short"],
        "statusTone": status_info["tone"],
        "statusStage": status_info["stage"],
        "price": price,
        "soldPrice": sold_price,
        "paymentLabel": format_money_short(total),
        "summary": summary,
        "vin": vin,
        "hasPhotos": bool(image_urls),
        "photos": image_urls,
        "photosCount": len(image_urls),
    }


def format_order_detail(order):
    counteragent = order.get("counteragent", {})
    status = order.get("status", {})
    summ = order.get("summ", {})
    cash = order.get("cash", {})
    raw_positions = order.get("positions", [])
    status_info = status_meta(status.get("name"))

    positions = []
    for p in raw_positions:
        count = to_number(p.get("count", 0))
        line_price = to_number(p.get("soldPrice", 0)) * count
        if line_price <= 0:
            line_price = to_number(p.get("price", 0)) * count

        positions.append({
            "name": p.get("name"),
            "article": p.get("article"),
            "isWork": bool(p.get("isWork", False)),
            "price": to_number(p.get("price", 0)),
            "soldPrice": to_number(p.get("soldPrice", 0)),
            "count": count,
            "countLabel": f"{int(count) if float(count).is_integer() else count} шт",
            "lineTotal": line_price,
        })

    price = to_number(summ.get("price", 0))
    sold_price = to_number(summ.get("soldPrice", 0))
    paid_value = 0.0

    if isinstance(cash, dict):
        paid_value = to_number(cash.get("order", 0)) or to_number(cash.get("summ", 0)) or 0.0

    total = sold_price if sold_price > 0 else price
    debt = max(total - paid_value, 0)
    device_label = build_device_label(order)
    vehicle_key = build_vehicle_key(order)
    vehicle_info = split_vehicle_key(vehicle_key)
    vin = extract_vin(order)
    problem_text = build_problem_text(order.get("problem", []))
    image_urls = extract_image_urls(order)

    return {
        "id": order.get("id"),
        "number": order.get("number"),
        "dateCreate": order.get("dateCreate"),
        "createdLabel": format_datetime_label(order.get("dateCreate")),
        "dateFinish": order.get("dateFinish"),
        "lastAction": order.get("lastAction"),
        "lastActionLabel": format_datetime_label(order.get("lastAction")),
        "client": counteragent.get("name"),
        "phones": counteragent.get("phones", []),
        "deviceLabel": device_label,
        "vehicleKey": vehicle_key,
        "vehicleLabel": vehicle_info["label"],
        "vehicleVin": vehicle_info["vin"] or vin,
        "vin": vin,
        "problemText": problem_text,
        "comment": cleanup_spaces(order.get("comment", "")),
        "status": status.get("name"),
        "shortStatus": status_info["short"],
        "statusTone": status_info["tone"],
        "statusStage": status_info["stage"],
        "nextAction": status_info["next_action"],
        "nextActionNote": status_info["next_note"],
        "price": price,
        "soldPrice": sold_price,
        "paid": paid_value,
        "debt": debt,
        "positions": positions,
        "summary": problem_text or f"{device_label}. Текущий статус: {status_info['short'].lower()}.",
        "timeline": build_timeline(order, status_info),
        "photos": image_urls,
        "photosCount": len(image_urls),
    }


def build_customer_summary(orders):
    if not orders:
        return {
            "first_visit_date": None,
            "first_visit_label": "Нет обращений",
            "orders_count": 0,
            "total_repairs_sum": 0,
            "total_repairs_label": "0 ₽",
            "favorite_client_since": "Нет обращений",
            "vehicles": [],
        }

    sorted_orders = sorted(orders, key=lambda x: x.get("dateCreate") or "")
    first_order = sorted_orders[0]
    first_dt = parse_iso(first_order.get("dateCreate"))
    first_label = format_date_label(first_order.get("dateCreate")) or "Не указано"

    total_repairs_sum = 0.0
    vehicles = {}

    for order in orders:
        order_sum = to_number(order.get("soldPrice", 0)) or to_number(order.get("price", 0))
        total_repairs_sum += order_sum

        vehicle_key = cleanup_spaces(order.get("vehicleKey")) or "Неизвестный автомобиль"
        item = vehicles.get(vehicle_key)
        if not item:
            split_info = split_vehicle_key(vehicle_key)
            item = {
                "name": vehicle_key,
                "label": split_info["label"],
                "vin": split_info["vin"] or cleanup_spaces(order.get("vin")),
                "orders_count": 0,
                "total_sum": 0.0,
                "last_order_date": None,
                "last_order_label": "",
                "last_status": "",
                "last_status_short": "",
                "last_status_tone": "slate",
                "last_order_number": "",
                "photos": [],
                "photos_count": 0,
            }
            vehicles[vehicle_key] = item

        if not item["vin"]:
            item["vin"] = cleanup_spaces(order.get("vin"))

        item["orders_count"] += 1
        item["total_sum"] += order_sum

        photos = order.get("photos") or []
        if photos and not item["photos"]:
            item["photos"] = photos[:4]
            item["photos_count"] = len(order.get("photos") or [])

        dt = parse_iso(order.get("dateCreate"))
        if dt and (item["last_order_date"] is None or dt > item["last_order_date"]):
            item["last_order_date"] = dt
            item["last_order_label"] = format_date_label(order.get("dateCreate"))
            item["last_status"] = order.get("status") or ""
            item["last_status_short"] = order.get("shortStatus") or ""
            item["last_status_tone"] = order.get("statusTone") or "slate"
            item["last_order_number"] = order.get("number") or ""
            if cleanup_spaces(order.get("vin")):
                item["vin"] = cleanup_spaces(order.get("vin"))

    vehicles_list = []
    for item in vehicles.values():
        vehicles_list.append({
            "name": item["name"],
            "label": item["label"],
            "vin": item["vin"],
            "orders_count": item["orders_count"],
            "total_sum": round(item["total_sum"], 2),
            "total_sum_label": format_money_short(item["total_sum"]),
            "last_order_label": item["last_order_label"] or "—",
            "last_status": item["last_status"],
            "last_status_short": item["last_status_short"],
            "last_status_tone": item["last_status_tone"],
            "last_order_number": item["last_order_number"] or "—",
            "photos": item["photos"],
            "photos_count": item["photos_count"],
        })

    vehicles_list.sort(key=lambda x: (-x["orders_count"], -x["total_sum"], x["name"]))

    return {
        "first_visit_date": first_dt.date().isoformat() if first_dt else None,
        "first_visit_label": first_label,
        "orders_count": len(orders),
        "total_repairs_sum": round(total_repairs_sum, 2),
        "total_repairs_label": format_money_short(total_repairs_sum),
        "favorite_client_since": first_label,
        "vehicles": vehicles_list,
    }