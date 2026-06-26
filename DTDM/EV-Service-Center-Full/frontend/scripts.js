/**
 * EV Service Center - Frontend Scripts
 * Refactored & Optimized
 */

// ========================================================
// 1. GLOBAL CONFIG & STATE
// ========================================================
const API_BASE_URL = "http://localhost";
const TOKEN_KEY = "jwt_token";
let currentUserId = null;

// Element References
const navAuthLinks = document.getElementById("nav-auth-links");
let currentPageElement = document.getElementById("login-page");

// ========================================================
// 2. UI UTILITIES & FORMATTERS
// ========================================================

function showLoading() {
  document.getElementById("loading-spinner")?.classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading-spinner")?.classList.add("hidden");
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `fixed bottom-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 transition-opacity duration-500 ${
    isError ? "bg-red-600" : "bg-green-600"
  }`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
window.showToast = showToast;

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper: Định dạng trạng thái (Booking, Invoice, Maintenance)
function getStatusBadge(status, type = "default") {
  const styles = {
    pending: { text: "Chờ xử lý", class: "bg-yellow-100 text-yellow-800" },
    confirmed: { text: "Đã xác nhận", class: "bg-green-100 text-green-800" },
    completed: { text: "Hoàn thành", class: "bg-indigo-100 text-indigo-800" },
    canceled: { text: "Đã hủy", class: "bg-red-100 text-red-800" },
    issued: { text: "Đã xuất", class: "bg-blue-100 text-blue-800" },
    paid: { text: "Đã thanh toán", class: "bg-green-100 text-green-800" },
    success: { text: "Thành công", class: "bg-green-100 text-green-800" },
    failed: { text: "Thất bại", class: "bg-red-100 text-red-800" },
    in_progress: { text: "Đang tiến hành", class: "bg-blue-100 text-blue-800" },
  };

  // Mapping riêng cho từng loại nếu cần text khác nhau
  if (type === "booking" && status === "pending")
    styles.pending.text = "Chờ xác nhận";
  if (type === "invoice" && status === "pending")
    styles.pending.text = "Chờ thanh toán";
  if (type === "maintenance" && status === "pending")
    styles.pending.text = "Chờ thực hiện";

  return styles[status] || { text: status, class: "bg-gray-100 text-gray-800" };
}

// ========================================================
// 3. CORE API REQUEST
// ========================================================
async function apiRequestCore(tokenKey, endpoint, method = "GET", body = null) {
  showLoading();
  try {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem(tokenKey || TOKEN_KEY);
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      if (response.status === 401 && (tokenKey || TOKEN_KEY) === TOKEN_KEY) {
        logout();
        throw {
          message: "Phiên làm việc hết hạn. Vui lòng đăng nhập lại.",
          status: 401,
        };
      }
      const errMsg =
        data.error || data.message || `HTTP Error ${response.status}`;
      throw { message: errMsg, status: response.status };
    }
    return data;
  } catch (err) {
    const errMsg = err.message || "Lỗi kết nối máy chủ!";
    console.error("🚨 API Error:", err);
    showToast(errMsg, true);
    throw err;
  } finally {
    hideLoading();
  }
}

// ========================================================
// 4. AUTH & NAVIGATION
// ========================================================

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  showToast("Đã đăng xuất!");
  updateNav();
  navigateTo("login");
}
window.logout = logout;

function updateNav() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!navAuthLinks) return;

  if (token) {
    navAuthLinks.innerHTML = `
            <a href="#" onclick="navigateTo('booking')" class="nav-link text-gray-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Đặt Lịch</a>
            <a href="#" onclick="navigateTo('my-tasks')" class="nav-link text-gray-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Công Việc</a>
            <a href="#" onclick="navigateTo('invoice-history')" class="nav-link text-gray-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Hóa Đơn</a>
            <a href="#" onclick="navigateTo('profile')" class="nav-link text-gray-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Hồ Sơ</a>

            <div class="relative ml-4">
                <button onclick="toggleNotificationDropdown()" class="relative text-gray-300 hover:text-indigo-400 focus:outline-none">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <span id="notification-badge" class="hidden absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                </button>
                <div id="notification-dropdown" class="hidden absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50">
                    <div class="p-4 border-b border-gray-700"><h3 class="font-semibold text-white">Thông báo</h3></div>
                    <div id="notification-list" class="max-h-96 overflow-y-auto text-gray-300 text-sm">
                        <div class="p-4 text-center text-gray-400">Đang tải...</div>
                    </div>
                    <div class="p-2 border-t border-gray-700 text-center">
                        <a href="#" onclick="markAllNotificationsAsRead(); return false;" class="text-sm text-indigo-400 hover:text-indigo-300">Đánh dấu tất cả đã đọc</a>
                    </div>
                </div>
            </div>

            <a href="#" onclick="logout()" class="ml-4 bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-600">Đăng Xuất</a>
        `;
    setTimeout(() => loadUserNotifications(), 500);
  } else {
    navAuthLinks.innerHTML = `
            <a href="#" onclick="navigateTo('login')" class="nav-link text-gray-300 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Đăng Nhập</a>
            <a href="#" onclick="navigateTo('register')" class="ml-4 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700">Đăng Ký</a>
        `;
  }
}

function navigateTo(pageId) {
  const nextPageElement = document.getElementById(`${pageId}-page`);
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.add("hidden");
    p.classList.remove("active");
  });

  if (nextPageElement) {
    nextPageElement.classList.remove("hidden");
    nextPageElement.classList.add("active");
  }
  currentPageElement = nextPageElement;

  // Trigger logic based on page
  if (pageId === "home") {
    loadMyBookingsForHome();
  }
  if (pageId === "profile") loadProfileDetails();
  if (pageId === "forget-password") resetForgetForm();
  if (pageId === "inventory-list") loadInventoryList();
  if (pageId === "booking") {
    loadMyBookings();
    loadServiceCentersForBooking();
  }
  if (pageId === "invoice-history") {
    showHistory("invoices", document.getElementById("tab-invoices"));
  }
  if (pageId === "my-tasks") {
    loadMyTasks();
  }

  updateNav();
}
window.navigateTo = navigateTo;

// ========================================================
// 5. USER PROFILE LOGIC
// ========================================================

function toggleProfileForm(forceShow) {
  const form = document.getElementById("profile-update-form");
  const btnBox = document.getElementById("edit-profile-btn");
  const details = document.getElementById("profile-details");

  if (!form) return;
  const show = forceShow ?? form.classList.contains("hidden");

  if (show) {
    form.classList.remove("hidden");
    btnBox?.classList.add("hidden");
    details?.classList.add("hidden");
  } else {
    form.classList.add("hidden");
    btnBox?.classList.remove("hidden");
    details?.classList.remove("hidden");
  }
}
window.toggleProfileForm = toggleProfileForm;

async function loadProfileDetails() {
  const bookingListEl = document.getElementById("profile-booking-list");
  if (bookingListEl)
    bookingListEl.innerHTML =
      '<div class="text-center text-gray-400">Đang tải lịch sử...</div>';

  try {
    const profile = await apiRequestCore(TOKEN_KEY, "/api/profile", "GET");

    // 1. Fill Details Display
    document.getElementById("profile-fullname-display").textContent =
      profile.full_name || "Chưa cập nhật";
    document.getElementById("profile-phone-display").textContent =
      profile.phone_number || "Chưa cập nhật";
    document.getElementById("profile-address-display").textContent =
      profile.address || "Chưa cập nhật";
    document.getElementById("profile-vehicle-model-display").textContent =
      profile.vehicle_model || "Chưa cập nhật";
    document.getElementById("profile-vin-number-display").textContent =
      profile.vin_number || "---";

    // 2. Fill Form Inputs
    const fields = {
      "profile-fullname": profile.full_name,
      "profile-phone": profile.phone_number,
      "profile-address": profile.address,
      "profile-vehicle-model": profile.vehicle_model,
      "profile-vin-number": profile.vin_number,
    };
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    }

    toggleProfileForm(false);
    await loadBookingsForProfile();
  } catch (err) {
    console.error("Profile Load Error:", err);
    if (err.status === 404) toggleProfileForm(true);
  }
}

async function loadBookingsForProfile() {
  const bookingListEl = document.getElementById("profile-booking-list");
  if (!bookingListEl) return;

  try {
    const bookings = await apiRequestCore(
      TOKEN_KEY,
      "/api/bookings/my-bookings",
      "GET"
    );
    if (!bookings || bookings.length === 0) {
      bookingListEl.innerHTML =
        '<div class="text-center text-gray-500">Chưa có lịch hẹn nào.</div>';
      return;
    }

    bookingListEl.innerHTML = bookings
      .map((booking) => {
        const startDate = new Date(booking.start_time).toLocaleString("vi-VN", {
          dateStyle: "short",
          timeStyle: "short",
        });
        const status = getStatusBadge(booking.status, "booking");

        return `
                <div class="bg-gray-700 p-4 rounded-lg border-l-4 border-indigo-500">
                    <div class="flex justify-between">
                        <h4 class="font-bold text-white">${
                          booking.service_type
                        }</h4>
                        <span class="px-2 py-1 rounded text-xs font-bold ${
                          status.class
                        }">${status.text}</span>
                    </div>
                    <p class="text-sm text-gray-300 mt-1">Thời gian: ${startDate}</p>
                    <p class="text-xs text-gray-400 mt-1">Tại: ${
                      booking.center_name || "Chưa rõ"
                    }</p>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    bookingListEl.innerHTML =
      '<div class="text-red-400">Lỗi tải lịch sử.</div>';
  }
}

// ========================================================
// 6. BOOKING & SERVICE CENTERS
// ========================================================

async function loadServiceCentersForBooking() {
  const select = document.getElementById("center-id");
  const hint = document.getElementById("center-address-hint");
  if (!select) return;

  try {
    const centers = await apiRequestCore(null, "/api/bookings/centers", "GET");
    select.innerHTML = '<option value="">-- Chọn Trung tâm Dịch vụ --</option>';

    if (!centers || centers.length === 0) {
      select.innerHTML =
        '<option value="" disabled>Hiện không có chi nhánh nào hoạt động</option>';
      if (hint) hint.textContent = "Vui lòng liên hệ hotline.";
      return;
    }

    centers.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.id;
      option.textContent = center.name;
      option.dataset.address = center.address;
      select.appendChild(option);
    });

    select.onchange = function () {
      const selected = this.options[this.selectedIndex];
      if (hint && selected.dataset.address) {
        hint.textContent = `📍 Địa chỉ: ${selected.dataset.address}`;
      } else if (hint) {
        hint.textContent = "";
      }
    };
  } catch (error) {
    console.error("Error loading centers:", error);
    select.innerHTML = '<option value="">Lỗi tải dữ liệu</option>';
  }
}

async function loadMyBookings() {
  // Tải danh sách đặt lịch cho trang /booking (hiện chi tiết hơn profile)
  // Logic tương tự loadBookingsForProfile nhưng có thể render khác
  // Ở đây tôi dùng lại logic tương tự để code gọn
  await loadBookingsForProfile();
}

async function loadMyBookingsForHome() {
  // Load bookings for home page (booking-list container)
  const bookingListEl = document.getElementById("booking-list");
  if (!bookingListEl) return;

  bookingListEl.innerHTML = '<div class="text-center text-gray-400 py-4">Đang tải lịch hẹn...</div>';

  try {
    const bookings = await apiRequestCore(
      TOKEN_KEY,
      "/api/bookings/my-bookings",
      "GET"
    );

    if (!bookings || bookings.length === 0) {
      bookingListEl.innerHTML =
        '<div class="text-center text-gray-500 py-8">Chưa có lịch hẹn nào.</div>';
      return;
    }

    bookingListEl.innerHTML = bookings
      .slice(0, 5) // Chỉ hiển thị 5 lịch hẹn gần đây nhất
      .map((booking) => {
        const startDate = new Date(booking.start_time).toLocaleString("vi-VN", {
          dateStyle: "short",
          timeStyle: "short",
        });
        const endDate = new Date(booking.end_time).toLocaleString("vi-VN", {
          timeStyle: "short",
        });
        const status = getStatusBadge(booking.status, "booking");

        return `
          <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-indigo-500 transition">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h4 class="font-bold text-white text-lg">${booking.service_type}</h4>
                <p class="text-gray-400 text-sm mt-1">
                  <span class="mr-3">📅 ${startDate} - ${endDate}</span>
                </p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-bold ${status.class}">
                ${status.text}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-gray-400">
                <span class="text-gray-500">Booking ID:</span>
                <span class="text-white font-mono">#${booking.id}</span>
              </div>
              ${booking.technician_id ? `
                <div class="text-gray-400">
                  <span class="text-gray-500">Kỹ thuật viên:</span>
                  <span class="text-indigo-400">#${booking.technician_id}</span>
                </div>
              ` : '<div class="text-gray-500 italic">Chưa có KTV</div>'}
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading bookings:", error);
    bookingListEl.innerHTML =
      '<div class="text-center text-red-400 py-4">Không thể tải lịch hẹn</div>';
  }
}

function setServiceType(itemName) {
  setTimeout(() => {
    const select = document.getElementById("service-type");
    const value = `Thay thế/Lắp đặt: ${itemName}`;

    let exists = Array.from(select.options).some((opt) => opt.value === value);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    }
    select.value = value;
    document
      .getElementById("booking-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }, 100);
}
window.setServiceType = setServiceType;

function copyBookingDetails(techId, stationId) {
  document.getElementById("technician-id").value = techId;
  // station-id is hidden but we set it anyway
  const stationInput = document.getElementById("station-id");
  if (stationInput) stationInput.value = stationId;

  showToast(`Đã copy KTV #${techId}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.copyBookingDetails = copyBookingDetails;

// ========================================================
// 7. INVENTORY
// ========================================================

async function loadInventoryList() {
  const container = document.getElementById("inventory-list-container");
  if (!container) return;
  container.innerHTML =
    '<div class="col-span-full text-center py-8 text-gray-400">Đang tải...</div>';

  try {
    const items = await apiRequestCore(null, "/api/inventory/items");
    if (!items || items.length === 0) {
      container.innerHTML =
        '<div class="col-span-full text-center py-12 bg-gray-800 rounded-lg text-gray-400">Chưa có phụ tùng nào.</div>';
      return;
    }
    container.innerHTML = items.map(renderItemCard).join("");
  } catch (error) {
    container.innerHTML =
      '<div class="col-span-full text-center text-red-400">Lỗi tải danh sách vật tư.</div>';
  }
}

function renderItemCard(item) {
  return `
    <div class="bg-gray-800 p-5 rounded-lg shadow-md border border-gray-700 hover:shadow-lg transition duration-200">
        <h3 class="text-xl font-semibold text-indigo-400">${item.name}</h3>
        <p class="text-gray-400 text-sm mt-1">Mã Part: <span class="font-mono text-gray-300">${
          item.part_number
        }</span></p>
        <div class="mt-4 flex justify-between items-center">
            <div>
                <p class="text-lg font-bold text-green-500">${formatCurrency(
                  item.price
                )}</p>
                <p class="text-xs text-gray-500">Giá tham khảo</p>
            </div>
            <div class="text-right">
                <span class="text-sm font-medium text-white p-2 bg-indigo-700 rounded-full">
                    Còn: ${item.quantity || "Liên hệ"}
                </span>
            </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-700">
            <button onclick="navigateTo('booking'); setServiceType('${
              item.name
            }')" 
                class="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition">
                Đặt Lịch Với Phụ Tùng Này
            </button>
        </div>
    </div>`;
}

// ========================================================
// 8. MAINTENANCE (MY TASKS)
// ========================================================

async function loadMyTasks() {
  const container = document.getElementById("my-tasks-list-container");
  if (!container) return;
  container.innerHTML =
    '<div class="col-span-full text-center text-gray-400">Đang tải...</div>';

  try {
    const tasks = await apiRequestCore(
      TOKEN_KEY,
      "/api/maintenance/my-tasks",
      "GET"
    );
    if (!tasks || tasks.length === 0) {
      container.innerHTML =
        '<div class="col-span-full text-center text-gray-500">Bạn chưa có công việc bảo trì nào.</div>';
      return;
    }
    container.innerHTML = tasks.map(renderTaskCard).join("");
  } catch (error) {
    container.innerHTML =
      '<div class="col-span-full text-center text-red-400">Lỗi tải danh sách công việc.</div>';
  }
}

function renderTaskCard(task) {
  const status = getStatusBadge(task.status, "maintenance");
  const date = new Date(task.created_at).toLocaleDateString("vi-VN");

  return `
        <div class="bg-gray-800 p-5 rounded-lg shadow-md border-l-4 ${
          status.class.includes("green")
            ? "border-green-500"
            : "border-blue-500"
        }">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-xl font-bold text-white">${
                      task.description
                    }</h3>
                    <p class="text-sm text-gray-400 mt-1">Booking: #${
                      task.booking_id
                    } | Task: #${task.id}</p>
                    <p class="text-sm text-gray-300 mt-1">VIN: <span class="font-mono text-indigo-400">${
                      task.vehicle_vin
                    }</span></p>
                    <p class="text-xs text-gray-500 mt-2">Ngày tạo: ${date}</p>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${
                      status.class
                    }">${status.text}</span>
                </div>
            </div>
        </div>
    `;
}

// ========================================================
// 9. FINANCE (INVOICES & PAYMENTS)
// ========================================================

function showHistory(type, element) {
  // Reset tabs
  document
    .querySelectorAll('#invoice-history-page button[id^="tab-"]')
    .forEach((tab) => {
      tab.className =
        "inline-block p-4 text-gray-400 hover:text-gray-300 border-b-2 border-transparent hover:border-gray-300 rounded-t-lg";
    });
  // Set active tab
  element.className =
    "inline-block p-4 text-indigo-400 border-b-2 border-indigo-400 rounded-t-lg active";

  // Toggle content
  document
    .querySelectorAll(".history-content")
    .forEach((content) => content.classList.add("hidden"));
  document.getElementById(`history-content-${type}`).classList.remove("hidden");

  if (type === "invoices") loadMyInvoicesList();
  if (type === "payments") loadMyPaymentHistoryList();
}
window.showHistory = showHistory;

async function loadMyInvoicesList() {
  const container = document.getElementById("invoice-list-container");
  if (!container) return;
  container.innerHTML =
    '<div class="text-center text-gray-400">Đang tải...</div>';

  try {
    const invoices = await apiRequestCore(TOKEN_KEY, "/api/invoices/my", "GET");
    if (!invoices || invoices.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-500">Chưa có hóa đơn nào.</div>';
      return;
    }
    container.innerHTML = invoices.map(renderInvoiceCard).join("");
  } catch (e) {
    container.innerHTML =
      '<div class="text-center text-red-400">Lỗi tải hóa đơn.</div>';
  }
}

function renderInvoiceCard(invoice) {
  const status = getStatusBadge(invoice.status, "invoice");
  const date = new Date(invoice.created_at).toLocaleDateString("vi-VN");
  const isPaid = invoice.status === "paid";

  const actionBtn = isPaid
    ? '<span class="text-green-500 font-bold text-sm">ĐÃ THANH TOÁN</span>'
    : `<button onclick="showPaymentModal(${invoice.id}, ${invoice.total_amount}, '${invoice.status}')" 
             class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition">Thanh Toán</button>`;

  return `
        <div class="bg-gray-800 p-5 rounded-lg shadow-md border-l-4 border-indigo-500 flex justify-between items-center">
            <div>
                <h3 class="text-xl font-bold text-white">Hóa Đơn #${
                  invoice.id
                }</h3>
                <p class="text-sm text-gray-400 mt-1">Ngày: ${date} | Booking ID: ${
    invoice.booking_id
  }</p>
                <p class="text-2xl font-bold text-white mt-2">${formatCurrency(
                  invoice.total_amount
                )}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                <span class="px-3 py-1 rounded-full text-xs font-medium ${
                  status.class
                }">${status.text}</span>
                <div class="flex gap-2 mt-2">
                    <button onclick="showInvoiceDetails(${
                      invoice.id
                    })" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition">Chi Tiết</button>
                    ${actionBtn}
                </div>
            </div>
        </div>
    `;
}

async function loadMyPaymentHistoryList() {
  const container = document.getElementById("payment-history-list-container");
  container.innerHTML =
    '<div class="text-center text-gray-400">Đang tải...</div>';
  try {
    const history = await apiRequestCore(
      TOKEN_KEY,
      "/api/payments/history/my",
      "GET"
    );
    if (!history.length) {
      container.innerHTML =
        '<div class="text-center text-gray-500">Chưa có giao dịch nào.</div>';
      return;
    }
    container.innerHTML = history
      .map((t) => {
        const status = getStatusBadge(t.status);
        return `
            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                <div>
                    <p class="text-white font-bold">Giao dịch #${t.id}</p>
                    <p class="text-sm text-gray-400">${t.method.toUpperCase()} - ${formatCurrency(
          t.amount
        )}</p>
                    <p class="text-xs text-gray-500">${new Date(
                      t.created_at
                    ).toLocaleString("vi-VN")}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${
                  status.class
                }">${status.text}</span>
            </div>`;
      })
      .join("");
  } catch (e) {
    container.innerHTML =
      '<div class="text-center text-red-400">Lỗi tải lịch sử giao dịch.</div>';
  }
}

// --- Invoice Details Modal ---
const invoiceDetailModal = document.getElementById("invoice-detail-modal");
function closeInvoiceDetailModal() {
  invoiceDetailModal?.classList.add("hidden");
}
window.closeInvoiceDetailModal = closeInvoiceDetailModal;

async function showInvoiceDetails(invoiceId) {
  try {
    const detail = await apiRequestCore(
      TOKEN_KEY,
      `/api/invoices/${invoiceId}`,
      "GET"
    );

    const status = getStatusBadge(detail.status, "invoice");
    document.getElementById("invoice-detail-id").textContent = detail.id;
    document.getElementById("invoice-detail-date").textContent = new Date(
      detail.created_at
    ).toLocaleString("vi-VN");
    document.getElementById("invoice-detail-status").textContent = status.text;
    document.getElementById(
      "invoice-detail-status"
    ).className = `px-3 py-1 rounded text-sm font-bold ${status.class}`;
    document.getElementById("invoice-detail-total").textContent =
      formatCurrency(detail.total_amount);

    const tbody = document.getElementById("invoice-items-table-body");
    tbody.innerHTML = detail.items
      .map(
        (item) => `
            <tr class="text-gray-300">
                <td class="px-4 py-3">${item.description}</td>
                <td class="px-4 py-3 text-right">${item.quantity}</td>
                <td class="px-4 py-3 text-right">${formatCurrency(
                  item.unit_price
                )}</td>
                <td class="px-4 py-3 text-right font-medium text-white">${formatCurrency(
                  item.sub_total
                )}</td>
            </tr>
        `
      )
      .join("");

    invoiceDetailModal?.classList.remove("hidden");
  } catch (e) {
    console.error(e);
    showToast("Lỗi tải chi tiết", true);
  }
}
window.showInvoiceDetails = showInvoiceDetails;

// --- Payment Modal & Process ---
const paymentModal = document.getElementById("payment-modal");
window.currentTransaction = null;

function showPaymentModal(invoiceId, amount, status) {
  if (status === "paid") return showToast("Đã thanh toán rồi.", true);

  paymentModal.classList.remove("hidden");
  paymentModal.dataset.invoiceId = invoiceId;
  paymentModal.dataset.amount = amount;

  document.getElementById("payment-invoice-id").textContent = invoiceId;
  document.getElementById("payment-amount").textContent =
    formatCurrency(amount);

  // Reset view
  document
    .getElementById("payment-method-selection")
    .classList.remove("hidden");
  document.getElementById("payment-details-container").classList.add("hidden");
  document.getElementById("qr-code-display").classList.add("hidden");
  document.getElementById("bank-info-display").classList.add("hidden");
}
window.showPaymentModal = showPaymentModal;

function closePaymentModal() {
  paymentModal.classList.add("hidden");
  window.currentTransaction = null;
  // Refresh list
  loadMyInvoicesList();
}
window.closePaymentModal = closePaymentModal;

async function processPayment(method) {
  const invoiceId = paymentModal.dataset.invoiceId;
  const amount = parseFloat(paymentModal.dataset.amount);

  try {
    const res = await apiRequestCore(
      TOKEN_KEY,
      `/api/invoices/${invoiceId}/pay`,
      "POST",
      { method, amount }
    );
    window.currentTransaction = res.transaction;
    const details = JSON.parse(res.transaction.payment_data);

    // UI Update
    document.getElementById("payment-method-selection").classList.add("hidden");
    document
      .getElementById("payment-details-container")
      .classList.remove("hidden");

    document.getElementById("test-code-display").textContent =
      details.test_code || res.transaction.pg_transaction_id;

    if (method === "momo_qr") {
      document.getElementById("qr-code-display").classList.remove("hidden");
      document.getElementById("qr-image").src = details.qr_code_url;
      document.getElementById("payment-note-qr").textContent =
        details.payment_text;
    } else {
      document.getElementById("bank-info-display").classList.remove("hidden");
      document.getElementById("bank-name").textContent = details.bank_name;
      document.getElementById("account-name").textContent =
        details.account_name;
      document.getElementById("account-number").textContent =
        details.account_number;
      document.getElementById("amount-bank").textContent = formatCurrency(
        details.amount
      );
      document.getElementById("payment-note-bank").textContent = details.note;
    }
  } catch (e) {
    console.error(e);
  }
}
window.processPayment = processPayment;

async function simulatePaymentSuccess() {
  if (!window.currentTransaction) return showToast("Chưa có giao dịch.", true);

  if (!confirm("Xác nhận mô phỏng thanh toán thành công?")) return;

  try {
    await apiRequestCore(null, "/api/payments/webhook", "POST", {
      pg_transaction_id: window.currentTransaction.pg_transaction_id,
      status: "success",
    });
    showToast("✅ Thanh toán thành công!");
    closePaymentModal();
  } catch (e) {
    console.error(e);
  }
}
window.simulatePaymentSuccess = simulatePaymentSuccess;

// ========================================================
// 10. NOTIFICATIONS
// ========================================================

function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notification-dropdown");
  dropdown?.classList.toggle("hidden");
  if (!dropdown?.classList.contains("hidden")) loadUserNotifications();
}
window.toggleNotificationDropdown = toggleNotificationDropdown;

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notification-dropdown");
  const btn = e.target.closest("button");
  if (
    dropdown &&
    !dropdown.contains(e.target) &&
    !btn?.onclick?.toString().includes("toggleNotificationDropdown")
  ) {
    dropdown.classList.add("hidden");
  }
});

async function loadUserNotifications() {
  const list = document.getElementById("notification-list");
  const badge = document.getElementById("notification-badge");
  if (!list) return;

  try {
    const notifs = await apiRequestCore(
      TOKEN_KEY,
      "/api/notifications/my-notifications",
      "GET"
    );
    const unread = notifs.filter((n) => n.status !== "read").length;

    if (badge) {
      badge.textContent = unread > 99 ? "99+" : unread;
      badge.classList.toggle("hidden", unread === 0);
    }

    if (notifs.length === 0) {
      list.innerHTML =
        '<div class="p-4 text-center text-gray-500">Không có thông báo.</div>';
      return;
    }

    list.innerHTML = notifs
      .map((n) => {
        const isUnread = n.status !== "read";
        return `
            <div onclick="markNotificationAsRead(${n.id})" 
                 class="p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
                   isUnread ? "bg-blue-900/30" : ""
                 }">
                <div class="flex justify-between items-start">
                    <h4 class="font-semibold text-indigo-400 text-sm">${
                      n.title
                    }</h4>
                    ${
                      isUnread
                        ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>'
                        : ""
                    }
                </div>
                <p class="text-sm text-gray-300 mt-1">${n.message}</p>
                <p class="text-xs text-gray-500 mt-1">${formatDateTime(
                  n.created_at
                )}</p>
            </div>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
  }
}
window.loadUserNotifications = loadUserNotifications;

async function markNotificationAsRead(id) {
  try {
    await apiRequestCore(TOKEN_KEY, `/api/notifications/${id}/read`, "PUT");
    loadUserNotifications();
  } catch (e) {
    console.error(e);
  }
}
window.markNotificationAsRead = markNotificationAsRead;

async function markAllNotificationsAsRead() {
  try {
    await apiRequestCore(TOKEN_KEY, "/api/notifications/read-all", "PUT");
    loadUserNotifications();
  } catch (e) {
    console.error(e);
  }
}
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// ========================================================
// 11. INITIALIZATION & EVENT LISTENERS
// ========================================================

// Helper reset form
function resetForgetForm() {
  document.getElementById("forget-password-form")?.classList.remove("hidden");
  document.getElementById("reset-password-form")?.classList.add("hidden");
  document.getElementById("forget-email").value = "";
  document.getElementById("otp-code").value = "";
  document.getElementById("new-password").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  updateNav();

  // Check Auth on Init
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) logout();
      else {
        currentUserId = payload.sub;
        navigateTo("home");
      }
    } catch {
      logout();
    }
  } else {
    navigateTo("login");
  }

  // --- Login Form ---
  document
    .getElementById("login-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email_username = document.getElementById(
        "login-email-username"
      ).value;
      const password = document.getElementById("login-password").value;

      try {
        const data = await apiRequestCore(null, "/api/login", "POST", {
          email_username,
          password,
        });
        if (data?.access_token) {
          localStorage.setItem(TOKEN_KEY, data.access_token);
          showToast("Đăng nhập thành công!");

          const payload = JSON.parse(atob(data.access_token.split(".")[1]));
          currentUserId = payload.sub;

          if (payload.role === "admin") window.location.href = "/admin.html";
          else if (payload.role === "technician") {
            localStorage.setItem("tech_access_token", data.access_token);
            window.location.href = "/technician.html";
          } else {
            updateNav();
            navigateTo("home");
            // Initialize chat after login
            initializeChat();
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

  // --- Register Form ---
  document
    .getElementById("register-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await apiRequestCore(null, "/api/register", "POST", {
          username: document.getElementById("register-username").value,
          email: document.getElementById("register-email").value,
          password: document.getElementById("register-password").value,
        });
        showToast("Đăng ký thành công! Vui lòng đăng nhập.");
        e.target.reset();
        navigateTo("login");
      } catch (e) {
        console.error(e);
      }
    });

  // --- Profile Update ---
  document
    .getElementById("profile-update-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        full_name: document.getElementById("profile-fullname").value,
        phone_number: document.getElementById("profile-phone").value,
        address: document.getElementById("profile-address").value,
        vehicle_model: document.getElementById("profile-vehicle-model").value,
        vin_number: document.getElementById("profile-vin-number").value,
      };
      try {
        await apiRequestCore(TOKEN_KEY, "/api/profile", "PUT", data);
        showToast("Cập nhật hồ sơ thành công!");
        loadProfileDetails();
      } catch (e) {
        console.error(e);
      }
    });

  // --- Booking Submit ---
  document
    .getElementById("booking-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const centerId = document.getElementById("center-id").value;

      if (!centerId) {
        showToast("Vui lòng chọn Chi Nhánh!", true);
        return;
      }

      const data = {
        service_type: document.getElementById("service-type").value,
        technician_id: parseInt(document.getElementById("technician-id").value),
        station_id: parseInt(document.getElementById("station-id")?.value || 1),
        center_id: parseInt(centerId),
        start_time: document.getElementById("start-time").value + ":00",
        end_time: document.getElementById("end-time").value + ":00",
      };

      try {
        await apiRequestCore(TOKEN_KEY, "/api/bookings/items", "POST", data);
        showToast("Đặt lịch thành công!");
        e.target.reset();
        navigateTo("profile"); // Chuyển về profile để xem lịch sử
      } catch (e) {
        console.error(e);
      }
    });

  // --- Forgot Password Flow ---
  const forgetForm = document.getElementById("forget-password-form");
  if (forgetForm) {
    forgetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forget-email").value;
      try {
        await apiRequestCore(null, "/api/send-otp", "POST", { email });
        showToast("Đã gửi mã OTP!");
        document.getElementById("reset-email-hidden").value = email;
        forgetForm.classList.add("hidden");
        document
          .getElementById("reset-password-form")
          .classList.remove("hidden");
      } catch (e) {
        console.error(e);
      }
    });
  }

  const resetForm = document.getElementById("reset-password-form");
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await apiRequestCore(null, "/api/reset-password", "POST", {
          email: document.getElementById("reset-email-hidden").value,
          otp: document.getElementById("otp-code").value,
          new_password: document.getElementById("new-password").value,
        });
        showToast("Đổi mật khẩu thành công!");
        navigateTo("login");
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Initialize chat after DOM loaded
  initializeChat();
});

// ========================
// CHAT FUNCTIONALITY
// ========================

const CHAT_API_URL = "/api/chat";
let chatSocket = null;
let currentChatRoom = null;
let chatOpen = false;
let typingTimeout = null;

function getChatUserInfo() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub,
      username: payload.username || "User",
      fullname: payload.fullname || payload.username || "User",
      role: payload.role
    };
  } catch (e) {
    return null;
  }
}

function initializeChat() {
  const chatBtn = document.getElementById("chat-toggle-btn");
  if (!chatBtn) return;

  const user = getChatUserInfo();
  if (!user) {
    chatBtn.style.display = "none";
    return;
  }

  // Only show for regular users, not admin/technician
  if (user.role !== "admin" && user.role !== "technician") {
    chatBtn.style.display = "block";

    // Connect to Socket.IO
    connectChatSocket();

    // Load existing chat room or create new one
    loadOrCreateChatRoom();
  } else {
    chatBtn.style.display = "none";
  }
}

function connectChatSocket() {
  if (chatSocket) return;

  chatSocket = io("/", {
    path: "/socket.io",
    transports: ["websocket", "polling"]
  });

  chatSocket.on("connect", () => {
    console.log("✅ Connected to chat server");
    updateChatStatus("Đã kết nối");
  });

  chatSocket.on("disconnect", () => {
    console.log("❌ Disconnected from chat server");
    updateChatStatus("Mất kết nối");
  });

  chatSocket.on("new_message", (message) => {
    appendChatMessage(message);

    // Show notification if chat is closed
    if (!chatOpen && message.sender_role !== "user") {
      showChatNotification();
    }
  });

  chatSocket.on("user_typing", (data) => {
    document.getElementById("typing-indicator").classList.remove("hidden");
  });

  chatSocket.on("user_stop_typing", (data) => {
    document.getElementById("typing-indicator").classList.add("hidden");
  });

  chatSocket.on("room_status_changed", (room) => {
    currentChatRoom = room;
    updateChatStatus(room.status === "active" ? "Đang hỗ trợ" : "Đang chờ");
  });
}

async function loadOrCreateChatRoom() {
  const user = getChatUserInfo();
  if (!user) return;

  try {
    // Get user's chat rooms
    const response = await fetch(`${CHAT_API_URL}/rooms/user/${user.id}`);
    const data = await response.json();

    if (data.rooms && data.rooms.length > 0) {
      // Use the most recent room that's not closed
      const activeRoom = data.rooms.find(r => r.status !== "closed");
      if (activeRoom) {
        currentChatRoom = activeRoom;
        joinChatRoom(activeRoom.id);
        loadChatMessages(activeRoom.id);
        updateChatStatus(activeRoom.status === "active" ? "Đang hỗ trợ" : "Đang chờ");
        return;
      }
    }

    // Create new room if no active room exists
    await createNewChatRoom();
  } catch (error) {
    console.error("Error loading chat room:", error);
  }
}

async function createNewChatRoom() {
  const user = getChatUserInfo();
  if (!user) return;

  try {
    const response = await fetch(`${CHAT_API_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        user_name: user.fullname,
        subject: "Hỗ trợ khách hàng"
      })
    });

    const data = await response.json();
    if (data.success) {
      currentChatRoom = data.room;
      joinChatRoom(data.room.id);
      loadChatMessages(data.room.id);
      updateChatStatus("Đang chờ");
    }
  } catch (error) {
    console.error("Error creating chat room:", error);
  }
}

function joinChatRoom(roomId) {
  if (chatSocket) {
    chatSocket.emit("join_room", { room_id: roomId });
  }
}

async function loadChatMessages(roomId) {
  try {
    const response = await fetch(`${CHAT_API_URL}/rooms/${roomId}/messages`);
    const data = await response.json();

    const messagesContainer = document.getElementById("chat-messages");
    messagesContainer.innerHTML = "";

    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => appendChatMessage(msg, false));
    } else {
      messagesContainer.innerHTML = `
        <div class="text-center text-gray-500 text-sm py-8">
          Chào mừng! Hãy gửi tin nhắn để bắt đầu trò chuyện.
        </div>
      `;
    }

    scrollChatToBottom();
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function toggleChat() {
  chatOpen = !chatOpen;
  const widget = document.getElementById("chat-widget");
  const iconOpen = document.getElementById("chat-icon-open");
  const iconClose = document.getElementById("chat-icon-close");

  if (chatOpen) {
    widget.classList.remove("hidden");
    iconOpen.classList.add("hidden");
    iconClose.classList.remove("hidden");
    document.getElementById("chat-input").focus();
    clearChatNotification();

    // Mark messages as read
    if (currentChatRoom) {
      markMessagesAsRead(currentChatRoom.id);
    }
  } else {
    widget.classList.add("hidden");
    iconOpen.classList.remove("hidden");
    iconClose.classList.add("hidden");
  }
}

function handleChatKeyPress(event) {
  if (event.key === "Enter") {
    sendChatMessage();
  } else {
    // Send typing indicator
    if (chatSocket && currentChatRoom) {
      const user = getChatUserInfo();
      if (!user) return;

      chatSocket.emit("typing", {
        room_id: currentChatRoom.id,
        user_name: user.fullname
      });

      // Clear previous timeout
      if (typingTimeout) clearTimeout(typingTimeout);

      // Stop typing after 2 seconds
      typingTimeout = setTimeout(() => {
        const u = getChatUserInfo();
        if (u) {
          chatSocket.emit("stop_typing", {
            room_id: currentChatRoom.id,
            user_name: u.fullname
          });
        }
      }, 2000);
    }
  }
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();

  if (!message || !currentChatRoom) return;

  const user = getChatUserInfo();
  if (!user) return;

  const messageData = {
    room_id: currentChatRoom.id,
    sender_id: user.id,
    sender_name: user.fullname,
    sender_role: "user",
    message: message,
    message_type: "text"
  };

  // Send via Socket.IO
  if (chatSocket) {
    chatSocket.emit("send_message", messageData);
    chatSocket.emit("stop_typing", {
      room_id: currentChatRoom.id,
      user_name: user.fullname
    });
  }

  input.value = "";
}

function appendChatMessage(message, scroll = true) {
  const messagesContainer = document.getElementById("chat-messages");
  const user = getChatUserInfo();
  if (!user) return;

  // Remove welcome message if exists
  const welcomeMsg = messagesContainer.querySelector(".text-center");
  if (welcomeMsg) welcomeMsg.remove();

  const isOwnMessage = message.sender_id === user.id;
  const isSystem = message.message_type === "system";

  const messageDiv = document.createElement("div");

  if (isSystem) {
    messageDiv.className = "text-center text-gray-500 text-xs py-2";
    messageDiv.innerHTML = `<span class="bg-gray-800 px-3 py-1 rounded-full">${message.message}</span>`;
  } else {
    messageDiv.className = `flex ${isOwnMessage ? "justify-end" : "justify-start"}`;
    messageDiv.innerHTML = `
      <div class="max-w-[70%]">
        <div class="text-xs ${isOwnMessage ? "text-right" : "text-left"} mb-1 text-gray-400">
          ${message.sender_name}
        </div>
        <div class="${isOwnMessage ? "bg-indigo-600" : "bg-gray-700"} text-white px-4 py-2 rounded-lg">
          ${escapeHtml(message.message)}
        </div>
        <div class="text-xs ${isOwnMessage ? "text-right" : "text-left"} mt-1 text-gray-500">
          ${formatChatTime(message.created_at)}
        </div>
      </div>
    `;
  }

  messagesContainer.appendChild(messageDiv);

  if (scroll) {
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  const messagesContainer = document.getElementById("chat-messages");
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateChatStatus(status) {
  document.getElementById("chat-status-indicator").textContent = `(${status})`;
}

function showChatNotification() {
  const badge = document.getElementById("chat-unread-badge");
  badge.classList.remove("hidden");

  // Get current count and increment
  let count = parseInt(badge.textContent || "0") + 1;
  badge.textContent = count > 9 ? "9+" : count;
}

function clearChatNotification() {
  const badge = document.getElementById("chat-unread-badge");
  badge.classList.add("hidden");
  badge.textContent = "";
}

async function markMessagesAsRead(roomId) {
  const user = getChatUserInfo();
  if (!user) return;

  try {
    await fetch(`${CHAT_API_URL}/rooms/${roomId}/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id })
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";

  // Parse timestamp - handle both ISO string and Python datetime string
  let date;
  if (typeof timestamp === 'string') {
    // If timestamp doesn't end with 'Z', it's likely server local time, treat as UTC
    if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
      date = new Date(timestamp + 'Z');
    } else {
      date = new Date(timestamp);
    }
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  // Handle negative differences (future dates due to timezone issues)
  if (diffMins < 0) return "Vừa xong";
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return date.toLocaleDateString("vi-VN", {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
