// app.js
const SERVICE_CONTACT_URL = "https://t.me/Startersaratov";
const SERVICE_PHONE = "+79372252188";
const SERVICE_REVIEW_URL = "https://yandex.ru/maps/org/starter/1045866863/reviews/?add-review=true&ll=46.027951%2C51.555866&z=17";

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
const mobileBonusBalance = document.getElementById("mobileBonusBalance");
const profileMoreBtn = document.getElementById("profileMoreBtn");
const profileDetailsBlock = document.getElementById("profileDetailsBlock");
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
const lastRecommendationCard = document.getElementById("lastRecommendationCard");
const lastRecommendationText = document.getElementById("lastRecommendationText");
const lastRecommendationMeta = document.getElementById("lastRecommendationMeta");

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

const mobileTabProfile = document.getElementById("mobileTabProfile");
const mobileTabVehicles = document.getElementById("mobileTabVehicles");
const mobileTabOrders = document.getElementById("mobileTabOrders");

const mobileProfileSection = document.getElementById("mobileProfileSection");
const mobileVehiclesSection = document.getElementById("mobileVehiclesSection");
const mobileOrdersSection = document.getElementById("mobileOrdersSection");

const loginPromoToggleBtn = document.getElementById("loginPromoToggleBtn");

let currentPhone = "";
let allOrders = [];
let allVehicles = [];
let currentProfile = null;
let currentVehicleContext = null;

let lastOrderOpenedFromVehicle = false;

function syncLandingVisibility() {
  const hero = document.querySelector(".login-hero");
  const isCabinetVisible = cabinetScreen && !cabinetScreen.classList.contains("hidden");
  if (hero) {
    hero.classList.toggle("hidden", !!isCabinetVisible);
  }
}


function setCabinetMode(enabled) {
  document.body.classList.toggle("cabinet-mode", !!enabled);
}


function getPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhoneInputValue(value) {
  let digits = getPhoneDigits(value);

  if (digits.startsWith("7")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 8);
  const p4 = digits.slice(8, 10);

  let formatted = "";
  if (p1) formatted += p1;
  if (p2) formatted += (formatted ? " " : "") + p2;
  if (p3) formatted += (formatted ? "-" : "") + p3;
  if (p4) formatted += (formatted ? "-" : "") + p4;

  return {
    digits,
    formatted,
    full: "7" + digits
  };
}

function initPhoneInput() {
  if (!phoneInput) return;

  const apply = (raw) => {
    const normalized = normalizePhoneInputValue(raw);
    phoneInput.value = normalized.formatted;
    return normalized;
  };

  apply(phoneInput.value);

  phoneInput.addEventListener("input", (e) => {
    apply(e.target.value);
  });

  phoneInput.addEventListener("focus", () => {
    apply(phoneInput.value);
  });

  phoneInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text") || "";
    apply(text);
  });
}


function setMobileCabinetSection(section) {
  const isMobile = window.innerWidth <= 700;
  const sections = {
    profile: mobileProfileSection,
    vehicles: mobileVehiclesSection,
    orders: mobileOrdersSection,
  };
  const tabs = {
    profile: mobileTabProfile,
    vehicles: mobileTabVehicles,
    orders: mobileTabOrders,
  };

  Object.entries(sections).forEach(([key, el]) => {
    if (!el) return;
    if (!isMobile) {
      el.classList.remove("hidden-mobile-section");
      return;
    }
    el.classList.toggle("hidden-mobile-section", key !== section);
  });

  Object.entries(tabs).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("active", key === section);
  });
}


function initPromoSlider() {
  const slides = Array.from(document.querySelectorAll(".promo-slide"));
  const prevBtn = document.getElementById("promoPrevBtn");
  const nextBtn = document.getElementById("promoNextBtn");

  if (!slides.length) return;

  let currentIndex = slides.findIndex((slide) => slide.classList.contains("active"));
  if (currentIndex < 0) currentIndex = 0;

  function renderSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    renderSlide(currentIndex);
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % slides.length;
    renderSlide(currentIndex);
  }

  renderSlide(currentIndex);

  if (prevBtn) prevBtn.addEventListener("click", showPrev);
  if (nextBtn) nextBtn.addEventListener("click", showNext);
}

function initMobilePromoSliderToggle() {
  const sliderWrap = document.querySelector(".promo-slider-wrap");
  if (!loginPromoToggleBtn || !sliderWrap) return;

  function syncMobilePromoState() {
    if (window.innerWidth <= 700) {
      sliderWrap.classList.toggle("mobile-promo-hidden", !sliderWrap.classList.contains("mobile-promo-open"));
    } else {
      sliderWrap.classList.remove("mobile-promo-hidden");
      sliderWrap.classList.remove("mobile-promo-open");
    }
  }

  loginPromoToggleBtn.addEventListener("click", () => {
    if (window.innerWidth > 700) return;
    const willOpen = !sliderWrap.classList.contains("mobile-promo-open");
    sliderWrap.classList.toggle("mobile-promo-open", willOpen);
    sliderWrap.classList.toggle("mobile-promo-hidden", !willOpen);
  });

  syncMobilePromoState();
  window.addEventListener("resize", syncMobilePromoState);
}

function initMobileCabinetTabs() {
  if (mobileTabProfile) {
    mobileTabProfile.addEventListener("click", () => setMobileCabinetSection("profile"));
  }
  if (mobileTabVehicles) {
    mobileTabVehicles.addEventListener("click", () => setMobileCabinetSection("vehicles"));
  }
  if (mobileTabOrders) {
    mobileTabOrders.addEventListener("click", () => setMobileCabinetSection("orders"));
  }

  setMobileCabinetSection("profile");

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 700) {
      const active =
        mobileTabProfile?.classList.contains("active") ? "profile" :
        mobileTabVehicles?.classList.contains("active") ? "vehicles" :
        "orders";
      setMobileCabinetSection(active);
    } else {
      setMobileCabinetSection("profile");
    }
  });
}


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
  setCabinetMode(false);
  loginScreen.classList.remove("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  closeOrderModal(false);
  closeVehicleModal(true);
  syncLandingVisibility();
}

function showCode() {
  setCabinetMode(false);
  loginScreen.classList.add("hidden");
  codeScreen.classList.remove("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  syncLandingVisibility();
}

function showProfileSetup(user = null) {
  setCabinetMode(false);
  loginScreen.classList.add("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.remove("hidden");
  cabinetScreen.classList.add("hidden");
  logoutBtn.classList.remove("hidden");

  if (user) {
    setupNameInput.value = user.name || "";
    setupBirthDateInput.value = user.birth_date || "";
  }
  syncLandingVisibility();
}

function showCabinet() {
  setCabinetMode(true);
  loginScreen.classList.add("hidden");
  codeScreen.classList.add("hidden");
  profileSetupScreen.classList.add("hidden");
  cabinetScreen.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  syncLandingVisibility();
}

function setMessage(el, text, isError = false) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("error-text", !!isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
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

function getPositionDisplayName(pos) {
  const rawName = String(pos?.name || "Позиция").trim();
  const article = String(pos?.article || "").trim();

  if (!article) return rawName;

  const escaped = article.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = new RegExp(`(?:\\s+|[()\\-–—]+)${escaped}$`, "i");

  return rawName.replace(tail, "").trim() || rawName;
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


function syncMobileProfileDetailsState() {
  const isMobile = window.innerWidth <= 700;
  if (!profileDetailsBlock || !profileMoreBtn) return;

  if (!isMobile) {
    profileDetailsBlock.classList.remove("hidden-mobile-details");
    profileMoreBtn.classList.add("hidden");
    profileMoreBtn.textContent = "Подробнее";
    return;
  }

  profileMoreBtn.classList.remove("hidden");
  profileMoreBtn.textContent = profileDetailsBlock.classList.contains("hidden-mobile-details") ? "Подробнее" : "Скрыть";
}

function initMobileProfileMore() {
  if (!profileDetailsBlock || !profileMoreBtn) return;

  if (window.innerWidth <= 700) {
    profileDetailsBlock.classList.add("hidden-mobile-details");
  }

  profileMoreBtn.addEventListener("click", () => {
    profileDetailsBlock.classList.toggle("hidden-mobile-details");
    syncMobileProfileDetailsState();
  });

  syncMobileProfileDetailsState();

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 700) {
      if (!profileDetailsBlock.classList.contains("hidden-mobile-details") && profileMoreBtn.textContent !== "Скрыть") {
        profileDetailsBlock.classList.add("hidden-mobile-details");
      }
    }
    syncMobileProfileDetailsState();
  });
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
  const phoneHref = `tel:${SERVICE_PHONE}`;
  const tgHref = SERVICE_CONTACT_URL;
  const reviewHref = SERVICE_REVIEW_URL;

  const phoneIds = ["contactBtn", "profileContactBtn", "callBtn"];
  const tgIds = ["telegramBtn", "profileTelegramBtn"];
  const reviewIds = ["reviewBtn", "profileReviewBtn"];

  for (const id of phoneIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.tagName === "A") el.href = phoneHref;
    el.onclick = () => { window.location.href = phoneHref; };
    if (id !== "contactBtn") el.textContent = "Позвонить";
  }

  for (const id of tgIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.tagName === "A") el.href = tgHref;
    else el.onclick = () => window.open(tgHref, "_blank", "noopener,noreferrer");
    if (el.tagName === "A") {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
    el.textContent = "Telegram";
  }

  for (const id of reviewIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.tagName === "A") el.href = reviewHref;
    else el.onclick = () => window.open(reviewHref, "_blank", "noopener,noreferrer");
    if (el.tagName === "A") {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
    el.textContent = "Оставить отзыв";
  }
}

async function sendCode() {
  const phone = normalizePhoneInputValue(phoneInput.value).full;
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

    if (data.admin) {
      window.location.href = "/admin";
      return;
    }

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
  const birth_date = "";

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
  if (mobileBonusBalance) mobileBonusBalance.textContent = formatMoney(bonus.balance || 0);
  if (mobileBonusBalance) mobileBonusBalance.textContent = formatMoney(bonus.balance || 0);
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


function renderLastRecommendation(detail, sourceOrder = null) {
  if (!lastRecommendationCard || !lastRecommendationText || !lastRecommendationMeta) return;

  const text = String(detail?.recommendationText || detail?.recommendation || "").trim();

  if (!text) {
    lastRecommendationCard.classList.add("hidden");
    lastRecommendationText.textContent = "";
    lastRecommendationMeta.textContent = "Что советуем сделать дальше";
    return;
  }

  const orderId = String(detail?.id || sourceOrder?.id || "").trim();
  const orderNumber = detail?.number || sourceOrder?.number || sourceOrder?.id || "—";
  const orderDate = detail?.createdLabel || sourceOrder?.createdLabel || sourceOrder?.createdDateLabel || "—";
  const vehicleLabel = detail?.vehicleLabel || sourceOrder?.vehicleLabel || sourceOrder?.deviceLabel || "—";

  if (orderId && Array.isArray(allOrders)) {
    allOrders = allOrders.map((order) => {
      if (String(order?.id || "") !== orderId) return order;
      return {
        ...order,
        recommendationText: text,
        recommendation: text,
      };
    });
  }

  lastRecommendationMeta.textContent = `Заказ № ${orderNumber} · ${orderDate} · ${vehicleLabel}`;
  lastRecommendationText.textContent = text;
  lastRecommendationCard.classList.remove("hidden");

  if (typeof renderOrders === "function" && Array.isArray(allOrders)) {
    const selectedVehicle = vehicleFilter?.value || "";
    const ordersToRender = selectedVehicle
      ? allOrders.filter((order) => String(order.vehicleKey || "") === selectedVehicle)
      : allOrders;
    renderOrders(ordersToRender);
  }
}

async function loadLatestRecommendation() {
  if (!lastRecommendationCard || !lastRecommendationText || !lastRecommendationMeta) return;

  lastRecommendationCard.classList.add("hidden");
  lastRecommendationText.textContent = "";
  lastRecommendationMeta.textContent = "Что советуем сделать дальше";

  const sortedOrders = [...(allOrders || [])]
    .filter((order) => order && order.id)
    .sort((a, b) => String(b.dateCreate || "").localeCompare(String(a.dateCreate || "")));

  if (!sortedOrders.length) return;

  const latestOrder = sortedOrders[0];

  try {
    const detail = await api(`/me/orders/${latestOrder.id}`);
    renderLastRecommendation(detail, latestOrder);
  } catch (error) {
    console.error("loadLatestRecommendation failed:", error);
    lastRecommendationCard.classList.add("hidden");
  }
}

function renderCustomerSummary(profile) {
  const summary = profile.customer_summary || {};
  const vehicles = summary.vehicles || [];

  favoriteClientSince.textContent = summary.favorite_client_since || "—";
  totalRepairsSum.textContent = summary.total_repairs_label || "0 ₽";
  ordersCount.textContent = String(summary.orders_count || 0);
  firstVisitDate.textContent = summary.first_visit_label || "—";
  profileBirthDate.textContent = formatDate(profile.birth_date);

  if (profileName) profileName.textContent = profile.name || "Без имени";
  if (profilePhone) profilePhone.textContent = profile.phone || "—";

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


  currentProfile = profile;
  saveCachedProfile(profile);

  if (profileName) profileName.textContent = profile.name || "Без имени";
  if (profilePhone) profilePhone.textContent = profile.phone || "—";

  applyStaticLinks();
  ensureServiceButtons();
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
        <a class="order-preview-photo-link" href="#" onclick="openImageViewer('${escapeJs(url)}'); return false;">
          <img class="order-preview-photo" src="${escapeAttribute(url)}" alt="Фото заказа ${index + 1}" loading="lazy" />
        </a>
      `).join("")}
    </div>
  `;
}

function getRecommendationPreview(order) {
  const direct = String(order?.recommendationText || order?.recommendation || "").trim();
  if (direct) return direct;

  const meta = document.getElementById("lastRecommendationMeta");
  const text = document.getElementById("lastRecommendationText");
  if (!meta || !text) return "";

  const metaText = String(meta.textContent || "");
  const number = String(order?.number || "").trim();
  if (!number) return "";

  if (metaText.includes(`Заказ № ${number}`)) {
    return String(text.textContent || "").trim();
  }

  return "";
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `<div class="muted">Заказов пока нет</div>`;
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <div class="order-card order-card-clickable"
         role="button"
         tabindex="0"
         onclick="openOrderDetail('${escapeJs(String(order.id))}', false)"
         onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openOrderDetail('${escapeJs(String(order.id))}', false); }">
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
      ${(() => {
        const recommendation = getRecommendationPreview(order);
        if (!recommendation) return "";
        return `<div class="order-recommendation-row order-recommendation-row-accent">
        <span class="order-recommendation-label">Рекомендации:</span>
        <span class="order-recommendation-text" title="${escapeAttribute(recommendation)}">${escapeHtml(recommendation)}</span>
      </div>`;
      })()}

      ${renderOrderPhotoPreview(order)}

      <div class="order-footer">
        <div class="order-price">${escapeHtml(order.paymentLabel || formatMoney(0))}</div>
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
        <a class="photo-link" href="#" onclick="openImageViewer('${escapeJs(url)}'); return false;">
          <img class="order-photo" src="${escapeAttribute(url)}" alt="Фото заказа ${index + 1}" loading="lazy" />
        </a>
      `).join("")}
    </div>
  `;
}

function renderActionButtons() {
  return `
    <div class="action-buttons">
      <a class="btn btn-primary action-link" href="tel:${escapeAttribute(SERVICE_PHONE)}">Позвонить</a>
      <a class="btn btn-secondary action-link" href="${escapeAttribute(SERVICE_CONTACT_URL)}" target="_blank" rel="noopener noreferrer" title="Telegram">Telegram</a>
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
        <div><strong>${escapeHtml(getPositionDisplayName(pos))}</strong></div>
        <div class="small">
          ${pos.isWork ? "Работа" : "Запчасть"} · ${escapeHtml(pos.countLabel || "")} · ${formatMoney(pos.soldPrice || pos.price || 0)}
        </div>
      </div>
      <div><strong>${formatMoney(pos.lineTotal || 0)}</strong></div>
    </div>
  `).join("");

  const detailTotal =
    Number(order.soldPrice || 0) ||
    Number(order.price || 0) ||
    (Number(order.paid || 0) + Number(order.debt || 0)) ||
    (Array.isArray(order.positions)
      ? order.positions.reduce((sum, pos) => sum + Number(pos.lineTotal || 0), 0)
      : 0);

  const hideTimeline = ["issued", "closed", "done", "completed"].includes(
    String(order.statusStage || "").toLowerCase()
  );

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
        <div class="profile-row"><span>Итого:</span><strong>${formatMoney(detailTotal)}</strong></div>
        <div class="profile-row"><span>Оплачено:</span><strong>${formatMoney(order.paid || 0)}</strong></div>
        <div class="profile-row"><span>Долг:</span><strong>${formatMoney(order.debt || 0)}</strong></div>
      </div>

      <div class="detail-box">
        <h3>Описание</h3>
        <div>${escapeHtml(order.summary || "—")}</div>
        <div class="detail-recommendation-card">
          <div class="detail-recommendation-title">Рекомендации</div>
          <div class="detail-recommendation">${escapeHtml(order.recommendationText || order.recommendation || "—")}</div>
        </div>
        ${order.comment ? `<div class="small detail-comment">Комментарий: ${escapeHtml(order.comment)}</div>` : ""}
      </div>

      ${hideTimeline ? "" : `
      <div class="detail-box">
        <h3>Этапы</h3>
        <div class="timeline">${timeline || '<div class="small">Нет данных</div>'}</div>
      </div>`}

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
          <a class="photo-link" href="#" onclick="openImageViewer('${escapeJs(url)}'); return false;">
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
  let data;

  try {
    data = await api(`/me/orders/${orderId}`);
  } catch (error) {
    const fallback = (allOrders || []).find((order) => String(order.id) === String(orderId));

    if (fallback) {
      const fallbackDetail = {
        ...fallback,
        positions: Array.isArray(fallback.positions) ? fallback.positions : [],
        timeline: Array.isArray(fallback.timeline) ? fallback.timeline : [],
        photos: Array.isArray(fallback.photos) ? fallback.photos : [],
        paid: Number(fallback.paid || 0),
        debt: Number(fallback.debt || 0),
        comment: fallback.comment || "",
        shortStatus: fallback.shortStatus || fallback.status || "—",
        createdLabel: fallback.createdLabel || fallback.createdDateLabel || "—",
        vehicleLabel: fallback.vehicleLabel || fallback.vehicleKey || fallback.deviceLabel || "—",
        summary: fallback.summary || fallback.problemText || "Описание временно недоступно",
      };

      renderOrderDetail(fallbackDetail, fromVehicle);
      return;
    }

    alert(error.message || "Не удалось открыть заказ");
    return;
  }

  renderOrderDetail(data, fromVehicle);

  try {
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
  } catch (syncError) {
    console.error("openOrderDetail post-sync failed:", syncError);
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

  await loadLatestRecommendation();
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


function ensureServiceButtons() {
  const phoneHref = `tel:${SERVICE_PHONE}`;
  const tgHref = SERVICE_CONTACT_URL;
  const reviewHref = SERVICE_REVIEW_URL;

  if (topbarContactLink) {
    topbarContactLink.remove();
  }

  const row = document.querySelector(".profile-card .quick-actions");
  if (!row) return;

  row.id = "profileServiceButtons";
  row.classList.remove("hidden");
  row.innerHTML = `
    <a id="profileContactBtn" class="btn btn-primary" href="${phoneHref}">Позвонить</a>
    <a id="profileTelegramBtn" class="btn btn-secondary" href="${tgHref}" target="_blank" rel="noopener noreferrer">Telegram</a>
    <a id="profileReviewBtn" class="btn review-emphasis" href="${reviewHref}" target="_blank" rel="noopener noreferrer">Оставить отзыв</a>
  `;
}

sendCodeBtn.addEventListener("click", sendCode);
verifyCodeBtn.addEventListener("click", verifyCode);
backToPhoneBtn.addEventListener("click", showLogin);
saveProfileBtn.addEventListener("click", saveProfile);
logoutBtn.addEventListener("click", logout);
refreshOrdersBtn.addEventListener("click", async () => {
  await loadOrders();
  await loadLatestRecommendation();
});
closeDetailBtn.addEventListener("click", () => closeOrderModal(true));
closeVehicleBtn.addEventListener("click", () => closeVehicleModal(true));
backToVehicleBtn.addEventListener("click", backToVehicleCard);
orderModalBackdrop.addEventListener("click", () => closeOrderModal(true));
vehicleModalBackdrop.addEventListener("click", () => closeVehicleModal(true));
vehicleFilter.addEventListener("change", filterOrders);

window.openOrderDetail = openOrderDetail;
window.openVehicleDetail = openVehicleDetail;
window.openOrderFromVehicle = openOrderFromVehicle;

let imageViewerOverlay = null;
let imageViewerImage = null;
let imageViewerPrevBtn = null;
let imageViewerNextBtn = null;
let imageViewerCounter = null;
let imageViewerItems = [];
let imageViewerIndex = 0;
let imageViewerTouchStartX = 0;
let imageViewerTouchEndX = 0;

function collectViewerImages(url) {
  if (!url) return [url];

  const urls = [];
  document.querySelectorAll(".photo-link img, .order-preview-photo-link img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !urls.includes(src)) urls.push(src);
  });

  if (!urls.length) return [url];
  if (!urls.includes(url)) urls.unshift(url);
  return urls;
}

function updateImageViewer() {
  if (!imageViewerImage || !imageViewerItems.length) return;

  imageViewerImage.src = imageViewerItems[imageViewerIndex] || "";
  if (imageViewerCounter) {
    imageViewerCounter.textContent = `${imageViewerIndex + 1} / ${imageViewerItems.length}`;
  }

  const many = imageViewerItems.length > 1;
  if (imageViewerPrevBtn) imageViewerPrevBtn.style.display = many ? "flex" : "none";
  if (imageViewerNextBtn) imageViewerNextBtn.style.display = many ? "flex" : "none";
}

function showPrevImage() {
  if (!imageViewerItems.length) return;
  imageViewerIndex = (imageViewerIndex - 1 + imageViewerItems.length) % imageViewerItems.length;
  updateImageViewer();
}

function showNextImage() {
  if (!imageViewerItems.length) return;
  imageViewerIndex = (imageViewerIndex + 1) % imageViewerItems.length;
  updateImageViewer();
}

function ensureImageViewer() {
  if (imageViewerOverlay) return;

  imageViewerOverlay = document.createElement("div");
  imageViewerOverlay.id = "imageViewerOverlay";
  imageViewerOverlay.className = "hidden";
  imageViewerOverlay.style.position = "fixed";
  imageViewerOverlay.style.inset = "0";
  imageViewerOverlay.style.background = "rgba(0, 0, 0, 0.88)";
  imageViewerOverlay.style.display = "flex";
  imageViewerOverlay.style.alignItems = "center";
  imageViewerOverlay.style.justifyContent = "center";
  imageViewerOverlay.style.padding = "24px";
  imageViewerOverlay.style.zIndex = "9999";
  imageViewerOverlay.style.touchAction = "pan-y";
  imageViewerOverlay.innerHTML = `
    <button id="imageViewerClose" type="button" style="position:absolute;top:16px;right:16px;font-size:28px;line-height:1;border:none;border-radius:10px;padding:8px 12px;cursor:pointer;z-index:2;">×</button>
    <button id="imageViewerPrev" type="button" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:30px;line-height:1;border:none;border-radius:999px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;">‹</button>
    <img id="imageViewerImg" src="" alt="Просмотр фото" style="max-width:95vw;max-height:90vh;object-fit:contain;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.45);" />
    <button id="imageViewerNext" type="button" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:30px;line-height:1;border:none;border-radius:999px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;">›</button>
    <div id="imageViewerCounter" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:14px;z-index:2;">1 / 1</div>
  `;

  document.body.appendChild(imageViewerOverlay);
  imageViewerImage = document.getElementById("imageViewerImg");
  imageViewerPrevBtn = document.getElementById("imageViewerPrev");
  imageViewerNextBtn = document.getElementById("imageViewerNext");
  imageViewerCounter = document.getElementById("imageViewerCounter");

  imageViewerOverlay.addEventListener("click", (e) => {
    if (e.target === imageViewerOverlay || e.target.id === "imageViewerClose") {
      closeImageViewer();
    }
  });

  imageViewerPrevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrevImage();
  });

  imageViewerNextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showNextImage();
  });

  imageViewerOverlay.addEventListener("touchstart", (e) => {
    imageViewerTouchStartX = e.changedTouches[0].clientX;
    imageViewerTouchEndX = imageViewerTouchStartX;
  }, { passive: true });

  imageViewerOverlay.addEventListener("touchmove", (e) => {
    imageViewerTouchEndX = e.changedTouches[0].clientX;
  }, { passive: true });

  imageViewerOverlay.addEventListener("touchend", () => {
    const delta = imageViewerTouchEndX - imageViewerTouchStartX;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) showNextImage();
    else showPrevImage();
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!imageViewerOverlay || imageViewerOverlay.classList.contains("hidden")) return;
    if (e.key === "Escape") closeImageViewer();
    if (e.key === "ArrowLeft") showPrevImage();
    if (e.key === "ArrowRight") showNextImage();
  });
}

function openImageViewer(url) {
  if (!url) return;
  ensureImageViewer();
  imageViewerItems = collectViewerImages(url);
  imageViewerIndex = Math.max(0, imageViewerItems.indexOf(url));
  updateImageViewer();
  imageViewerOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  if (!imageViewerOverlay) return;
  imageViewerOverlay.classList.add("hidden");
  if (imageViewerImage) imageViewerImage.src = "";
  imageViewerItems = [];
  imageViewerIndex = 0;
  document.body.style.overflow = "";
}

window.openImageViewer = openImageViewer;

initTheme();
initPhoneInput();
ensureServiceButtons();
initMobileProfileMore();
initMobileCabinetTabs();
initPromoSlider();
initMobilePromoSliderToggle();
syncLandingVisibility();
checkSession();

/* 2026-03-31: refresh order previews after latest recommendation loads */
(() => {
  if (typeof renderLastRecommendation !== "function" || typeof renderOrders !== "function") return;
  const originalRenderLastRecommendation = renderLastRecommendation;

  renderLastRecommendation = function(detail, sourceOrder = null) {
    const result = originalRenderLastRecommendation(detail, sourceOrder);

    try {
      if (!Array.isArray(allOrders) || !ordersList) return result;

      const visibleIds = new Set(
        Array.from(ordersList.querySelectorAll("[data-order-id]"))
          .map((el) => String(el.dataset.orderId || "").trim())
          .filter(Boolean)
      );

      const ordersToRender = visibleIds.size
        ? allOrders.filter((order) => visibleIds.has(String(order.id)))
        : allOrders;

      renderOrders(ordersToRender);
    } catch (error) {
      console.error("recommendation preview refresh failed:", error);
    }

    return result;
  };
})();

/* 2026-03-31: keep recommendation visible in order previews after page refresh */
(() => {
  function rerenderOrdersWithCurrentFilter() {
    try {
      if (!Array.isArray(window.allOrders)) return;
      if (typeof window.filterOrders === "function") {
        window.filterOrders();
        return;
      }
      if (typeof window.renderOrders === "function") {
        const selectedVehicle = window.vehicleFilter?.value || "all";
        const ordersToRender = selectedVehicle === "all"
          ? window.allOrders
          : window.allOrders.filter((order) => String(order.vehicleKey || "") === selectedVehicle);
        window.renderOrders(ordersToRender);
      }
    } catch (error) {
      console.error("rerenderOrdersWithCurrentFilter failed:", error);
    }
  }

  function persistRecommendation(detail, sourceOrder = null) {
    try {
      const text = String(detail?.recommendationText || detail?.recommendation || "").trim();
      if (!text || !Array.isArray(window.allOrders)) return;

      const orderId = String(detail?.id || sourceOrder?.id || "").trim();
      const orderNumber = String(detail?.number || sourceOrder?.number || "").trim();

      window.allOrders = window.allOrders.map((order) => {
        const sameId = orderId && String(order?.id || "") === orderId;
        const sameNumber = orderNumber && String(order?.number || "") === orderNumber;
        if (!sameId && !sameNumber) return order;

        return {
          ...order,
          recommendationText: text,
          recommendation: text,
        };
      });

      if (typeof window.saveCachedOrders === "function") {
        window.saveCachedOrders(window.allOrders);
      } else {
        try {
          localStorage.setItem("cabinet_orders_cache", JSON.stringify(window.allOrders));
        } catch {}
      }
    } catch (error) {
      console.error("persistRecommendation failed:", error);
    }
  }

  if (typeof window.renderLastRecommendation === "function") {
    const originalRenderLastRecommendation = window.renderLastRecommendation;
    window.renderLastRecommendation = function(detail, sourceOrder = null) {
      const result = originalRenderLastRecommendation(detail, sourceOrder);
      persistRecommendation(detail, sourceOrder);
      rerenderOrdersWithCurrentFilter();
      return result;
    };
  }

  if (typeof window.openOrderDetail === "function") {
    const originalOpenOrderDetail = window.openOrderDetail;
    window.openOrderDetail = async function(orderId, fromVehicle = false) {
      const result = await originalOpenOrderDetail(orderId, fromVehicle);

      try {
        const order = Array.isArray(window.allOrders)
          ? window.allOrders.find((item) => String(item?.id || "") === String(orderId))
          : null;

        if (order) {
          const text = String(order?.recommendationText || order?.recommendation || "").trim();
          if (text) {
            persistRecommendation(order, order);
            rerenderOrdersWithCurrentFilter();
          }
        }
      } catch (error) {
        console.error("openOrderDetail recommendation sync failed:", error);
      }

      return result;
    };
  }

  window.addEventListener("load", () => {
    setTimeout(() => {
      rerenderOrdersWithCurrentFilter();
    }, 700);
  });
})();
