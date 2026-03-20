// app.js
const SERVICE_CONTACT_URL = "https://t.me/your_service_username";
const SERVICE_REVIEW_URL = "https://yandex.ru/maps/your-review-link";

const loginScreen = document.getElementById("loginScreen");
const codeScreen = document.getElementById("codeScreen");
const profileSetupScreen = document.getElementById("profileSetupScreen");
const cabinetScreen = document.getElementById("cabinetScreen");

const phoneInput = document.getElementById("phoneInput");
const codeInput = document.getElementById("codeInput");
const setupNameInput = document.getElementById("setupNameInput");
const setupBirthDateInput = document.getElementById("setupBirthDateInput");

const sendCodeBtn = document.getElementById("sendCodeBtn");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const backToPhoneBtn = document.getElementById("backToPhoneBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const closeDetailBtn = document.getElementById("closeDetailBtn");
const closeVehicleBtn = document.getElementById("closeVehicleBtn");
const backToVehicleBtn = document.getElementById("backToVehicleBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const vehicleFilter = document.getElementById("vehicleFilter");

const loginMessage = document.getElementById("loginMessage");
const codeMessage = document.getElementById("codeMessage");
const profileSetupMessage = document.getElementById("profileSetupMessage");
const ordersMessage = document.getElementById("ordersMessage");

const profileName = document.getElementById("profileName");
const profilePhone = document.getElementById("profilePhone");
const mobileProfileName = document.getElementById("mobileProfileName");
const mobileProfilePhone = document.getElementById("mobileProfilePhone");
const profileBirthDate = document.getElementById("profileBirthDate");
const favoriteClientSince = document.getElementById("favoriteClientSince");
const totalRepairsSum = document.getElementById("totalRepairsSum");
const ordersCount = document.getElementById("ordersCount");
const firstVisitDate = document.getElementById("firstVisitDate");

const bonusBalance = document.getElementById("bonusBalance");
const bonusTier = document.getElementById("bonusTier");
const bonusTotalSpent = document.getElementById("bonusTotalSpent");
const bonusNextTier = document.getElementById("bonusNextTier");
const bonusToNextTier = document.getElementById("bonusToNextTier");
const bonusHistoryList = document.getElementById("bonusHistoryList");

const ordersList = document.getElementById("ordersList");
const vehiclesList = document.getElementById("vehiclesList");

const profileContactLink = document.getElementById("profileContactLink");
const profileReviewLink = document.getElementById("profileReviewLink");
const topbarContactLink = document.getElementById("topbarContactLink");

const orderModal = document.getElementById("orderModal");
const orderModalBackdrop = document.getElementById("orderModalBackdrop");
const orderDetailContent = document.getElementById("orderDetailContent");

const vehicleModal = document.getElementById("vehicleModal");
const vehicleModalBackdrop = document.getElementById("vehicleModalBackdrop");
const vehicleDetailContent = document.getElementById("vehicleDetailContent");

let currentPhone = "";
let allOrders = [];
let allVehicles = [];
let currentProfile = null;
let currentVehicleContext = null;
let lastOrderOpenedFromVehicle = false;

const ORDERS_CACHE_KEY = "cabinet_orders_cache";

function loadCachedOrders() {
  try {
    const data = JSON.parse(localStorage.getItem(ORDERS_CACHE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCachedOrders(orders) {
  try {
    localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(Array.isArray(orders) ? orders : []));
  } catch {}
}

const PROFILE_CACHE_KEY = "cabinet_profile_cache";

function loadCachedProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveCachedProfile(profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {}
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  topbarContactLink.classList.add("hidden");
  closeOrderModal(false);
  closeVehicleModal(true);
}

function showCode() {
  loginScreen.classList.add("hidden");
  codeScreen.classList.remove("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  topbarContactLink.classList.add("hidden");
}

function showProfileSetup(user = null) {
  loginScreen.classList.add("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.remove("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
  topbarContactLink.classList.add("hidden");

  if (user) {
    setupNameInput.value = user.name || "";
    setupBirthDateInput.value = user.birth_date || "";
  }
}

function showCabinet() {
  loginScreen.classList.add("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  topbarContactLink.classList.remove("hidden");
}

function setMessage(el, text, isError = false) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("error-text", !!isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Ошибка запроса");
  }

  return data;
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("ru-RU");
}

function statusClass(tone) {
  if (tone === "emerald") return "status-emerald";
  if (tone === "teal") return "status-teal";
  if (tone === "sand") return "status-sand";
  if (tone === "rose") return "status-rose";
  return "status-slate";
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("cabinet_theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️ Тема" : "🌙 Тема";
}

function initTheme() {
  const saved = localStorage.getItem("cabinet_theme") || "light";
  applyTheme(saved);

  themeToggleBtn.addEventListener("click", () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  });
}

function applyStaticLinks() {
  [topbarContactLink, profileContactLink].forEach((link) => {
    if (!link) return;
    link.href = SERVICE_CONTACT_URL;
    link.classList.remove("hidden");
  });

  if (profileReviewLink) {
    profileReviewLink.href = SERVICE_REVIEW_URL;
    profileReviewLink.classList.remove("hidden");
  }
}

async function sendCode() {
  const phone = phoneInput.value.trim();
  currentPhone = phone;

  setMessage(loginMessage, "Отправка кода...");

  try {
    await api("/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone })
    });

    setMessage(loginMessage, "Код отправлен");
    codeInput.value = "";
    showCode();
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  }
}

async function verifyCode() {
  const code = codeInput.value.trim();

  setMessage(codeMessage, "Проверка кода...");

  try {
    const data = await api("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({
        phone: currentPhone,
        code
      })
    });

    setMessage(codeMessage, "");

    if (!data.user?.profile_completed) {
      showProfileSetup(data.user);
      return;
    }

    await loadCabinet();
    showCabinet();
  } catch (error) {
    setMessage(codeMessage, error.message, true);
  }
}

async function saveProfile() {
  const name = setupNameInput.value.trim();
  const birth_date = setupBirthDateInput.value;

  setMessage(profileSetupMessage, "Сохранение профиля...");

  try {
    await api("/me/profile", {
      method: "POST",
      body: JSON.stringify({ name, birth_date })
    });

    setMessage(profileSetupMessage, "");
    await loadCabinet();
    showCabinet();
  } catch (error) {
    setMessage(profileSetupMessage, error.message, true);
  }
}

function renderBonus(profile) {
  const bonus = profile.bonus || {};

  bonusBalance.textContent = formatMoney(bonus.balance || 0);
  bonusTier.textContent = bonus.tier_label || "2%";
  bonusTotalSpent.textContent = formatMoney(bonus.total_spent || 0);

  if (bonus.next_tier_label && bonus.to_next_tier > 0) {
    bonusNextTier.textContent = `${bonus.next_tier_label} от ${formatMoney(bonus.next_tier_at || 0)}`;
    bonusToNextTier.textContent = formatMoney(bonus.to_next_tier || 0);
  } else {
    bonusNextTier.textContent = "Максимальный уровень";
    bonusToNextTier.textContent = "—";
  }
}

function renderBonusHistory(operations) {
  if (!bonusHistoryList) return;

  if (!operations.length) {
    bonusHistoryList.innerHTML = `<div class="muted">История бонусов пока пуста</div>`;
    return;
  }

  bonusHistoryList.innerHTML = operations.map((item) => `
    <div class="bonus-history-item">
      <div class="bonus-history-main">
        <div class="bonus-history-title">${escapeHtml(item.title || "Операция")}</div>
        <div class="bonus-history-meta">${escapeHtml(item.comment || "Без комментария")}</div>
        <div class="bonus-history-meta">${escapeHtml(item.created_label || "—")}${item.order_id ? ` · Заказ ${escapeHtml(item.order_id)}` : ""}</div>
      </div>
      <div class="bonus-history-amount ${item.direction === "negative" ? "bonus-negative" : "bonus-positive"}">${escapeHtml(item.amount_label || "0 ₽")}</div>
    </div>
  `).join("");
}

function renderCustomerSummary(profile) {
  const summary = profile.customer_summary || {};
  const vehicles = summary.vehicles || [];

  favoriteClientSince.textContent = summary.favorite_client_since || "—";
  totalRepairsSum.textContent = summary.total_repairs_label || "0 ₽";
  ordersCount.textContent = String(summary.orders_count || 0);
  firstVisitDate.textContent = summary.first_visit_label || "—";
  profileBirthDate.textContent = formatDate(profile.birth_date);

  if (mobileProfileName) mobileProfileName.textContent = profile.name || "Без имени";
  if (mobileProfilePhone) mobileProfilePhone.textContent = profile.phone || "—";

  allVehicles = vehicles;

  if (!vehicles.length) {
    vehiclesList.innerHTML = `<div class="muted">Автомобили пока не найдены</div>`;
    vehicleFilter.innerHTML = `<option value="all">Все автомобили</option>`;
    return;
  }

  vehiclesList.innerHTML = vehicles.map((vehicle) => `
    <button class="vehicle-card" type="button" onclick="openVehicleDetail('${escapeJs(vehicle.name)}')">
      <div class="vehicle-card-head">
        <div>
          <div class="vehicle-name">${escapeHtml(vehicle.label || vehicle.name || "Автомобиль")}</div>
          <div class="vehicle-subtitle">VIN / SN: ${escapeHtml(vehicle.vin || "—")}</div>
        </div>
        <div class="vehicle-badge">${escapeHtml(vehicle.last_status_short || "Без статуса")}</div>
      </div>

      <div class="vehicle-meta-grid">
        <div class="vehicle-meta-box">
          <div class="vehicle-meta-label">Заказов</div>
          <div class="vehicle-meta-value">${escapeHtml(String(vehicle.orders_count || 0))}</div>
        </div>
        <div class="vehicle-meta-box">
          <div class="vehicle-meta-label">Сумма ремонтов</div>
          <div class="vehicle-meta-value">${escapeHtml(vehicle.total_sum_label || "0 ₽")}</div>
        </div>
        <div class="vehicle-meta-box">
          <div class="vehicle-meta-label">Последний заказ</div>
          <div class="vehicle-meta-value">${escapeHtml(vehicle.last_order_number || "—")}</div>
        </div>
        <div class="vehicle-meta-box">
          <div class="vehicle-meta-label">Последний визит</div>
          <div class="vehicle-meta-value">${escapeHtml(vehicle.last_order_label || "—")}</div>
        </div>
      </div>
    </button>
  `).join("");

  vehicleFilter.innerHTML = `
    <option value="all">Все автомобили</option>
    ${vehicles.map((vehicle) => `
      <option value="${escapeHtml(vehicle.name)}">${escapeHtml(vehicle.label || vehicle.name)}</option>
    `).join("")}
  `;
}

async function loadProfile() {
  const profile = await api("/me/profile");

  if (!profile.profile_completed) {
    showProfileSetup(profile);
    return { profile, incomplete: true };
  }

  const cached = loadCachedProfile();

  const summary = profile.customer_summary || {};
  const summaryLooksEmpty =
    !summary.orders_count &&
    (!Array.isArray(summary.vehicles) || summary.vehicles.length === 0) &&
    (!summary.total_repairs_sum || Number(summary.total_repairs_sum) === 0);

  if (summaryLooksEmpty && cached?.customer_summary?.orders_count > 0) {
    profile.customer_summary = cached.customer_summary;
  }

  if ((!profile.bonus || profile.bonus.balance == null) && cached?.bonus) {
    profile.bonus = cached.bonus;
  }

  currentProfile = profile;
  saveCachedProfile(profile);

  profileName.textContent = profile.name || "Без имени";
  profilePhone.textContent = profile.phone || "—";

  applyStaticLinks();
  renderBonus(profile);
  renderCustomerSummary(profile);

  return { profile, incomplete: false };
}

async function loadBonusHistory() {
  if (!bonusHistoryList) return;

  try {
    const data = await api("/bonus/history");
    renderBonusHistory(data.operations || []);
  } catch (error) {
    bonusHistoryList.innerHTML = `<div class="error-text">${escapeHtml(error.message)}</div>`;
  }
}

function filterOrders() {
  const selectedVehicle = vehicleFilter.value || "all";

  if (selectedVehicle === "all") {
    renderOrders(allOrders);
    return;
  }

  const filtered = allOrders.filter((order) => (order.vehicleKey || "") === selectedVehicle);
  renderOrders(filtered);
}

function renderOrderPhotoPreview(order) {
  const photos = Array.isArray(order.photos) ? order.photos.slice(0, 3) : [];
  if (!photos.length) return "";

  return `
    <div class="order-preview-photos">
      ${photos.map((url, index) => `
        <a class="order-preview-photo-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
          <img class="order-preview-photo" src="${escapeAttribute(url)}" alt="Фото заказа ${index + 1}" loading="lazy" />
        </a>
      `).join("")}
    </div>
  `;
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `<div class="muted">Заказов пока нет</div>`;
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <div class="order-card">
      <div class="order-top">
        <div class="order-head-left">
          <div class="order-number">Заказ № ${escapeHtml(order.number || order.id)}</div>
          <div class="order-meta">${escapeHtml(order.createdLabel || "Дата не указана")}</div>
        </div>

        <div class="order-status ${statusClass(order.statusTone)}">
          ${escapeHtml(order.shortStatus || order.status || "Без статуса")}
        </div>
      </div>

      <div class="order-chip-row">
        <span class="order-chip">${escapeHtml(order.vehicleLabel || order.vehicleKey || order.deviceLabel || "—")}</span>
        ${order.photosCount ? `<span class="order-chip photo-chip">Фото: ${order.photosCount}</span>` : ""}
      </div>

      <div class="order-meta"><strong>Автомобиль:</strong> ${escapeHtml(order.deviceLabel || order.vehicleLabel || "—")}</div>
      <div class="order-meta"><strong>VIN / SN:</strong> ${escapeHtml(order.vin || order.vehicleVin || "—")}</div>
      <div class="order-summary">${escapeHtml(order.summary || "Описание отсутствует")}</div>

      ${renderOrderPhotoPreview(order)}

      <div class="order-footer">
        <div class="order-price">${escapeHtml(order.paymentLabel || formatMoney(0))}</div>
        <button class="btn btn-secondary" onclick="openOrderDetail('${escapeJs(String(order.id))}', false)">Подробнее</button>
      </div>
    </div>
  `).join("");
}

function syncBodyModalState() {
  const hasVisibleModal =
    !orderModal.classList.contains("hidden") ||
    !vehicleModal.classList.contains("hidden");

  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function setBackButtonVisible(visible) {
  if (!backToVehicleBtn) return;
  backToVehicleBtn.classList.toggle("hidden", !visible);
}

function openOrderModal() {
  orderModal.classList.remove("hidden");
  syncBodyModalState();
}

function closeOrderModal(resetVehicleState = false) {
  orderModal.classList.add("hidden");
  orderDetailContent.innerHTML = "";
  setBackButtonVisible(false);

  if (resetVehicleState) {
    currentVehicleContext = null;
    lastOrderOpenedFromVehicle = false;
  }

  syncBodyModalState();
}

function openVehicleModal() {
  vehicleModal.classList.remove("hidden");
  syncBodyModalState();
}

function closeVehicleModal(resetContext = false) {
  vehicleModal.classList.add("hidden");
  vehicleDetailContent.innerHTML = "";

  if (resetContext) {
    currentVehicleContext = null;
    lastOrderOpenedFromVehicle = false;
  }

  syncBodyModalState();
}

function renderPhotos(order) {
  const photos = Array.isArray(order.photos) ? order.photos : [];
  if (!photos.length) {
    return `<div class="small">Фотографии пока не загружены</div>`;
  }

  return `
    <div class="photo-grid">
      ${photos.map((url, index) => `
        <a class="photo-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
          <img class="order-photo" src="${escapeAttribute(url)}" alt="Фото заказа ${index + 1}" loading="lazy" />
        </a>
      `).join("")}
    </div>
  `;
}

function renderActionButtons() {
  return `
    <div class="action-buttons">
      <a class="btn btn-primary action-link" href="${escapeAttribute(SERVICE_CONTACT_URL)}" target="_blank" rel="noopener noreferrer">Связаться с сервисом</a>
      <a class="btn btn-secondary action-link" href="${escapeAttribute(SERVICE_REVIEW_URL)}" target="_blank" rel="noopener noreferrer">Оставить отзыв</a>
    </div>
  `;
}

function renderOrderDetail(order, fromVehicle = false) {
  setBackButtonVisible(fromVehicle);

  const timeline = (order.timeline || []).map((item) => `
    <div class="timeline-item ${item.state || ""}">
      <div><strong>${escapeHtml(item.title || "")}</strong></div>
      <div class="small">${escapeHtml(item.subtitle || "")}</div>
    </div>
  `).join("");

  const positions = (order.positions || []).map((pos) => `
    <div class="position-item">
      <div>
        <div><strong>${escapeHtml(pos.name || "Позиция")}</strong></div>
        <div class="small">
          ${pos.isWork ? "Работа" : "Запчасть"} · ${escapeHtml(pos.countLabel || "")} · ${formatMoney(pos.soldPrice || pos.price || 0)}
        </div>
      </div>
      <div><strong>${formatMoney(pos.lineTotal || 0)}</strong></div>
    </div>
  `).join("");

  orderDetailContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-box">
        <h3>Основная информация</h3>
        <div class="profile-row"><span>Номер:</span><strong>${escapeHtml(order.number || order.id || "—")}</strong></div>
        <div class="profile-row"><span>Статус:</span><strong>${escapeHtml(order.shortStatus || order.status || "—")}</strong></div>
        <div class="profile-row"><span>Создан:</span><strong>${escapeHtml(order.createdLabel || "—")}</strong></div>
        <div class="profile-row"><span>Автомобиль:</span><strong>${escapeHtml(order.vehicleLabel || order.vehicleKey || order.deviceLabel || "—")}</strong></div>
        <div class="profile-row"><span>VIN / SN:</span><strong>${escapeHtml(order.vin || order.vehicleVin || "—")}</strong></div>
      </div>

      <div class="detail-box">
        <h3>Суммы</h3>
        <div class="profile-row"><span>Итого:</span><strong>${formatMoney(order.soldPrice || order.price || 0)}</strong></div>
        <div class="profile-row"><span>Оплачено:</span><strong>${formatMoney(order.paid || 0)}</strong></div>
        <div class="profile-row"><span>Долг:</span><strong>${formatMoney(order.debt || 0)}</strong></div>
      </div>

      <div class="detail-box">
        <h3>Описание</h3>
        <div>${escapeHtml(order.summary || "—")}</div>
        ${order.comment ? `<div class="small detail-comment">Комментарий: ${escapeHtml(order.comment)}</div>` : ""}
      </div>

      <div class="detail-box">
        <h3>Этапы</h3>
        <div class="timeline">${timeline || '<div class="small">Нет данных</div>'}</div>
      </div>

      <div class="detail-box">
        <h3>Фото</h3>
        ${renderPhotos(order)}
      </div>

      <div class="detail-box">
        <h3>Действия</h3>
        ${renderActionButtons()}
      </div>

      <div class="detail-box">
        <h3>Позиции</h3>
        <div class="positions">${positions || '<div class="small">Нет позиций</div>'}</div>
      </div>
    </div>
  `;

  openOrderModal();
}

function getVehicleOrders(vehicleName) {
  return allOrders
    .filter((order) => (order.vehicleKey || "") === vehicleName)
    .sort((a, b) => String(b.dateCreate || "").localeCompare(String(a.dateCreate || "")));
}

function renderVehicleDetail(vehicle) {
  const vehicleOrders = getVehicleOrders(vehicle.name);

  const photos = Array.isArray(vehicle.photos) ? vehicle.photos : [];
  const photosBlock = photos.length
    ? `
      <div class="photo-grid">
        ${photos.map((url, index) => `
          <a class="photo-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
            <img class="order-photo" src="${escapeAttribute(url)}" alt="Фото автомобиля ${index + 1}" loading="lazy" />
          </a>
        `).join("")}
      </div>
    `
    : `<div class="small">Фото автомобиля пока не загружены</div>`;

  const ordersBlock = vehicleOrders.length
    ? `
      <div class="vehicle-orders-list">
        ${vehicleOrders.map((order) => `
          <div class="vehicle-order-item">
            <div class="vehicle-order-top">
              <div>
                <div class="vehicle-order-number">Заказ № ${escapeHtml(order.number || order.id || "—")}</div>
                <div class="vehicle-order-date">${escapeHtml(order.createdLabel || "Дата не указана")}</div>
              </div>
              <div class="order-status ${statusClass(order.statusTone)}">${escapeHtml(order.shortStatus || order.status || "—")}</div>
            </div>
            <div class="small">${escapeHtml(order.summary || "Описание отсутствует")}</div>
            <div class="row">
              <button class="btn btn-secondary" onclick="openOrderFromVehicle('${escapeJs(String(order.id))}', '${escapeJs(vehicle.name)}')">Открыть заказ</button>
            </div>
          </div>
        `).join("")}
      </div>
    `
    : `<div class="small">Заказов по автомобилю пока нет</div>`;

  vehicleDetailContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-box">
        <h3>${escapeHtml(vehicle.label || vehicle.name || "Автомобиль")}</h3>
        <div class="profile-row"><span>VIN / SN:</span><strong>${escapeHtml(vehicle.vin || "—")}</strong></div>
        <div class="profile-row"><span>Заказов:</span><strong>${escapeHtml(String(vehicle.orders_count || 0))}</strong></div>
        <div class="profile-row"><span>Сумма ремонтов:</span><strong>${escapeHtml(vehicle.total_sum_label || "0 ₽")}</strong></div>
        <div class="profile-row"><span>Последний заказ:</span><strong>${escapeHtml(vehicle.last_order_number || "—")}</strong></div>
        <div class="profile-row"><span>Последний визит:</span><strong>${escapeHtml(vehicle.last_order_label || "—")}</strong></div>
        <div class="profile-row"><span>Текущий статус:</span><strong>${escapeHtml(vehicle.last_status_short || "—")}</strong></div>
      </div>

      <div class="detail-box">
        <h3>Фото автомобиля</h3>
        ${photosBlock}
      </div>

      <div class="detail-box">
        <h3>Заказы по автомобилю</h3>
        ${ordersBlock}
      </div>

      <div class="detail-box">
        <h3>Действия</h3>
        ${renderActionButtons()}
      </div>
    </div>
  `;

  openVehicleModal();
}

function openVehicleDetail(vehicleName) {
  const vehicle = allVehicles.find((item) => (item.name || "") === vehicleName);
  if (!vehicle) return;

  currentVehicleContext = vehicle.name;
  lastOrderOpenedFromVehicle = false;
  renderVehicleDetail(vehicle);
}

async function openOrderDetail(orderId, fromVehicle = false) {
  try {
    const data = await api(`/me/orders/${orderId}`);

    const detailVin = data.vin || data.vehicleVin || "";

    if (detailVin) {
      allOrders = (allOrders || []).map((order) => {
        if (String(order.id) === String(orderId)) {
          return {
            ...order,
            vin: order.vin || detailVin,
            vehicleVin: order.vehicleVin || detailVin,
          };
        }
        return order;
      });

      if (typeof saveCachedOrders === "function") {
        saveCachedOrders(allOrders);
      }

      if (currentProfile?.customer_summary?.vehicles?.length) {
        currentProfile.customer_summary.vehicles = currentProfile.customer_summary.vehicles.map((vehicle) => {
          const linked = allOrders.find((order) =>
            (order.vehicleKey || "") === (vehicle.name || "") &&
            (order.vin || order.vehicleVin)
          );

          if (linked && !(vehicle.vin || "").trim()) {
            return {
              ...vehicle,
              vin: linked.vin || linked.vehicleVin || ""
            };
          }
          return vehicle;
        });

        if (typeof saveCachedProfile === "function") {
          saveCachedProfile(currentProfile);
        }

        renderCustomerSummary(currentProfile);
      }

      if (typeof filterOrders === "function") {
        filterOrders();
      }
    }

    renderOrderDetail(data, fromVehicle);
  } catch (error) {
    alert(error.message);
  }
}

async function openOrderFromVehicle(orderId, vehicleName) {
  currentVehicleContext = vehicleName;
  lastOrderOpenedFromVehicle = true;
  await openOrderDetail(orderId, true);
}

function backToVehicleCard() {
  if (!currentVehicleContext) {
    closeOrderModal(true);
    return;
  }

  closeOrderModal(false);
  openVehicleDetail(currentVehicleContext);
}

async function loadOrders() {
  setMessage(ordersMessage, "Загрузка заказов...");

  try {
    const data = await api("/me/orders");
    const incomingOrders = Array.isArray(data.orders) ? data.orders : [];
    const cachedOrders = loadCachedOrders();
    const profileOrdersCount = Number(currentProfile?.customer_summary?.orders_count || 0);

    // Если сервер внезапно вернул пусто, но мы знаем, что заказы есть,
    // используем последний хороший список из localStorage.
    if (incomingOrders.length === 0 && profileOrdersCount > 0 && cachedOrders.length > 0) {
      allOrders = cachedOrders;
      filterOrders();
      setMessage(ordersMessage, "");
      return;
    }

    allOrders = incomingOrders;

    if (incomingOrders.length > 0) {
      saveCachedOrders(incomingOrders);
    }

    filterOrders();
    setMessage(ordersMessage, incomingOrders.length ? "" : "Заказов пока нет");
  } catch (error) {
    const cachedOrders = loadCachedOrders();
    if (cachedOrders.length > 0) {
      allOrders = cachedOrders;
      filterOrders();
      setMessage(ordersMessage, "");
      return;
    }
    setMessage(ordersMessage, error.message, true);
  }
}

async function loadCabinet() {
  const result = await loadProfile();
  if (result.incomplete) {
    return;
  }

  await Promise.all([
    loadOrders(),
    loadBonusHistory()
  ]);
}

async function checkSession() {
  try {
    const me = await api("/auth/me");

    if (!me.profile_completed) {
      showProfileSetup(me);
      return;
    }

    showCabinet();

    try {
      await loadCabinet();
    } catch (error) {
      console.error("loadCabinet failed:", error);
      setMessage(ordersMessage, error.message, true);
    }
  } catch {
    showLogin();
  }
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {}

  currentProfile = null;
  allOrders = [];
  allVehicles = [];
  currentVehicleContext = null;
  lastOrderOpenedFromVehicle = false;
  showLogin();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

sendCodeBtn.addEventListener("click", sendCode);
verifyCodeBtn.addEventListener("click", verifyCode);
backToPhoneBtn.addEventListener("click", showLogin);
saveProfileBtn.addEventListener("click", saveProfile);
logoutBtn.addEventListener("click", logout);
refreshOrdersBtn.addEventListener("click", loadOrders);
closeDetailBtn.addEventListener("click", () => closeOrderModal(true));
closeVehicleBtn.addEventListener("click", () => closeVehicleModal(true));
backToVehicleBtn.addEventListener("click", backToVehicleCard);
orderModalBackdrop.addEventListener("click", () => closeOrderModal(true));
vehicleModalBackdrop.addEventListener("click", () => closeVehicleModal(true));
vehicleFilter.addEventListener("change", filterOrders);

window.openOrderDetail = openOrderDetail;
window.openVehicleDetail = openVehicleDetail;
window.openOrderFromVehicle = openOrderFromVehicle;

initTheme();
checkSession();
