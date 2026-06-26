// =============================================================================
// 1. GLOBAL CONFIG & UTILITIES
// =============================================================================
window.ADMIN_TOKEN_KEY = "admin_jwt_token";
window.ADMIN_ROLE = "admin";
const API_BASE_URL = "http://localhost"; // Gateway Port

// --- UI Utilities ---
window.showToast = function (message, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `fixed bottom-5 right-5 px-6 py-4 rounded-lg text-white font-medium shadow-2xl z-[60] transition-all duration-500 transform translate-y-0 flex items-center gap-2 ${
    isError ? "bg-red-600" : "bg-green-600"
  }`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-10");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

window.showLoading = function () {
  document.getElementById("loading-spinner")?.classList.remove("hidden");
  document.getElementById("loading-spinner")?.classList.add("flex");
};

window.hideLoading = function () {
  document.getElementById("loading-spinner")?.classList.add("hidden");
  document.getElementById("loading-spinner")?.classList.remove("flex");
};

// --- Formatters ---
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// 2. CORE API & AUTHENTICATION
// =============================================================================

window.apiRequestCore = async function (
  tokenKey,
  endpoint,
  method = "GET",
  body = null
) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = tokenKey ? localStorage.getItem(tokenKey) : null;

  const options = {
    method: method?.toString().toUpperCase() || "GET",
    headers: { "Content-Type": "application/json" },
  };

  if (token) options.headers["Authorization"] = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  try {
    showLoading();
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && token) {
        adminLogout();
        throw new Error("Token Admin hết hạn.");
      }
      const errorMessage =
        data.message || data.error || `HTTP Error ${response.status}`;
      window.showToast(errorMessage || "Lỗi hệ thống!", true);
      throw new Error(errorMessage || "API Error");
    }
    return data;
  } catch (err) {
    console.error("🚨 API Request Error:", err);
    throw err;
  } finally {
    hideLoading();
  }
};

// --- Auth Logic ---
const loginPage = document.getElementById("admin-login-page");
const dashboardPage = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboard-title");

function adminLogout() {
  localStorage.removeItem(window.ADMIN_TOKEN_KEY);
  window.showToast("Đã đăng xuất.", true);
  loginPage.classList.remove("hidden");
  dashboardPage.classList.add("hidden");
}
window.adminLogout = adminLogout;

function showDashboard() {
  loginPage.classList.add("hidden");
  dashboardPage.classList.remove("hidden");
}

// Login Form Submit
document
  .getElementById("admin-login-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email_username = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;

    try {
      const data = await window.apiRequestCore(null, "/api/login", "POST", {
        email_username,
        password,
      });

      const token = data.access_token;
      // Decode token payload to check role
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (payload.role !== window.ADMIN_ROLE) {
        adminLogout();
        window.showToast("Bạn không có quyền truy cập trang quản trị.", true);
        return;
      }

      localStorage.setItem(window.ADMIN_TOKEN_KEY, token);
      window.showToast("Đăng nhập quản trị thành công!");
      showDashboard();
      navigateToDashboardSection("inventory-section", "Quản lý Kho Phụ Tùng");
    } catch (error) {
      console.error("Login failed:", error);
    }
  });

// =============================================================================
// 3. NAVIGATION CONTROLLER
// =============================================================================
function navigateToDashboardSection(sectionId, title) {
  document.querySelectorAll(".dashboard-section").forEach((section) => {
    section.classList.add("hidden");
    section.classList.remove("active");
  });

  const activeSection = document.getElementById(sectionId);
  if (activeSection) {
    activeSection.classList.remove("hidden");
    activeSection.classList.add("active");
    if (dashboardTitle) dashboardTitle.textContent = title;
  }

  switch (sectionId) {
    case "inventory-section":
      loadAllInventory();
      break;
    case "users-section":
      loadAllUsers();
      break;
    case "bookings-section":
      loadAllBookings();
      break;
    case "invoices-section":
      loadAllInvoices();
      break;
    case "maintenance-section":
      loadAllMaintenanceTasks();
      break;
    case "payment-history-section":
      loadAllPaymentHistory();
      break;
    case "notifications-section":
      loadAllNotificationsAdmin();
      break;
    case "centers-section":
      loadServiceCenters();
      break;
    case "reports-section":
      loadDashboardData();
      switchReportTab("revenue");
      break;
  }
}
window.navigateToDashboardSection = navigateToDashboardSection;

// =============================================================================
// 4. MODULE: SERVICE CENTERS (Chi Nhánh)
// =============================================================================
async function loadServiceCenters() {
  const tbody = document.getElementById("centers-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center py-4 text-gray-500">Đang tải...</td></tr>';

  try {
    const centers = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/bookings/centers",
      "GET"
    );
    if (!centers || centers.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center py-4 text-gray-500">Chưa có chi nhánh nào.</td></tr>';
      return;
    }

    tbody.innerHTML = centers
      .map(
        (c) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 text-sm font-mono text-gray-500">${c.id}</td>
        <td class="px-6 py-4 text-sm font-medium text-indigo-600">${c.name}</td>
        <td class="px-6 py-4 text-sm">${c.address}</td>
        <td class="px-6 py-4 text-sm">${c.phone || "-"}</td>
        <td class="px-6 py-4 text-sm">
          <span class="px-2 py-1 text-xs rounded-full ${
            c.is_active
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }">
            ${c.is_active ? "Hoạt động" : "Đóng cửa"}
          </span>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-red-500 py-4">Lỗi tải dữ liệu.</td></tr>';
  }
}
window.loadServiceCenters = loadServiceCenters;

// --- Center Modal ---
const centerModal = document.getElementById("center-modal");
window.openCenterModal = () => centerModal?.classList.remove("hidden");
window.closeCenterModal = () => {
  centerModal?.classList.add("hidden");
  document.getElementById("center-form")?.reset();
};

document
  .getElementById("center-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("center-name").value,
      address: document.getElementById("center-address").value,
      phone: document.getElementById("center-phone").value,
      latitude: document.getElementById("center-lat").value
        ? parseFloat(document.getElementById("center-lat").value)
        : null,
      longitude: document.getElementById("center-lng").value
        ? parseFloat(document.getElementById("center-lng").value)
        : null,
      is_active: true,
    };
    try {
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/bookings/centers",
        "POST",
        data
      );
      window.showToast("Thêm chi nhánh thành công!");
      window.closeCenterModal();
      loadServiceCenters();
    } catch (error) {
      console.error(error);
    }
  });

// =============================================================================
// 5. MODULE: INVENTORY (Kho Phụ Tùng)
// =============================================================================
async function loadAllInventory() {
  try {
    const items = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/inventory/items"
    );
    const tbody = document.getElementById("inventory-table-body");
    tbody.innerHTML = "";

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">Kho trống.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        const isLowStock = item.quantity <= item.min_quantity;
        const rowClass = isLowStock
          ? "bg-red-50 hover:bg-red-100"
          : "hover:bg-gray-50";
        const statusBadge = isLowStock
          ? '<span class="p-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cần bổ sung</span>'
          : '<span class="p-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Đủ hàng</span>';

        return `
            <tr class="${rowClass}">
                <td class="px-6 py-4 text-sm">${item.id}</td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-700">${
                  item.name
                }</td>
                <td class="px-6 py-4 text-sm font-mono text-gray-500">${
                  item.part_number
                }</td>
                <td class="px-6 py-4 text-sm text-center text-blue-600 font-medium">
                    ${item.center_id ? `CN ${item.center_id}` : "Kho Tổng"}
                </td>
                <td class="px-6 py-4 text-sm text-center font-bold">${
                  item.quantity
                }</td>
                <td class="px-6 py-4 text-sm text-center text-gray-500">${
                  item.min_quantity
                }</td>
                <td class="px-6 py-4 text-sm font-medium">${formatCurrency(
                  item.price
                )}</td>
                <td class="px-6 py-4 text-center space-x-2">
                    <button onclick="openItemModal('edit', ${
                      item.id
                    })" class="text-indigo-600 hover:text-indigo-900 font-medium">Sửa</button>
                    <button onclick="deleteItem(${
                      item.id
                    })" class="text-red-600 hover:text-red-900 font-medium">Xóa</button>
                </td>
            </tr>`;
      })
      .join("");
  } catch (err) {
    document.getElementById(
      "inventory-table-body"
    ).innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-4">Lỗi tải kho.</td></tr>`;
  }
}
window.loadAllInventory = loadAllInventory;

// --- Inventory Modal & Actions ---
const itemModal = document.getElementById("item-modal");
const itemForm = document.getElementById("item-form");

window.closeItemModal = function () {
  if (itemModal) itemModal.classList.add("hidden");
  itemForm?.reset();
  document.getElementById("item-id-hidden").value = "";
};

window.openItemModal = async function (mode, itemId = null) {
  itemForm.dataset.mode = mode;
  itemForm.reset();

  // 1. Load danh sách chi nhánh vào dropdown
  try {
    const centers = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/bookings/centers",
      "GET"
    );
    const select = document.getElementById("item-center-id");
    if (select && centers.length > 0) {
      select.innerHTML = centers
        .map((c) => `<option value="${c.id}">${c.name} (ID: ${c.id})</option>`)
        .join("");
    }
  } catch (e) {
    console.warn("Lỗi load centers cho dropdown inventory");
  }

  // 2. Handle Mode
  if (mode === "add") {
    document.getElementById("item-modal-title").textContent = "Thêm Vật tư Mới";
    document.getElementById("item-submit-button").textContent = "Thêm";
    document.getElementById("item-part-number").disabled = false;
    // Mặc định chọn chi nhánh đầu tiên hoặc theo logic
  } else if (mode === "edit" && itemId) {
    document.getElementById("item-modal-title").textContent =
      "Chỉnh Sửa Vật tư";
    document.getElementById("item-submit-button").textContent = "Lưu Thay Đổi";
    document.getElementById("item-id-hidden").value = itemId;
    document.getElementById("item-part-number").disabled = true; // Không sửa mã Part

    try {
      // Load Item Details
      const item = await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/inventory/items/${itemId}`
      );

      document.getElementById("item-name").value = item.name;
      document.getElementById("item-part-number").value = item.part_number;
      document.getElementById("item-quantity").value = item.quantity;
      document.getElementById("item-min-quantity").value = item.min_quantity;
      document.getElementById("item-price").value = item.price;

      // Pre-select Center
      const centerSelect = document.getElementById("item-center-id");
      if (centerSelect && item.center_id) {
        centerSelect.value = item.center_id;
      }
    } catch (error) {
      /* Error handled in apiRequestCore */
    }
  }
  itemModal?.classList.remove("hidden");
};

itemForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = itemForm.dataset.mode;
  const itemId = document.getElementById("item-id-hidden").value;

  const data = {
    name: document.getElementById("item-name").value,
    part_number: document.getElementById("item-part-number").value,
    quantity: parseInt(document.getElementById("item-quantity").value),
    min_quantity: parseInt(document.getElementById("item-min-quantity").value),
    price: parseFloat(document.getElementById("item-price").value),
    center_id: parseInt(document.getElementById("item-center-id").value), // Send center_id
  };

  try {
    if (mode === "add") {
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/inventory/items",
        "POST",
        data
      );
      window.showToast("Thêm vật tư thành công!");
    } else if (mode === "edit" && itemId) {
      delete data.part_number; // Prevent update
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/inventory/items/${itemId}`,
        "PUT",
        data
      );
      window.showToast("Cập nhật vật tư thành công!");
    }
    window.closeItemModal();
    loadAllInventory();
  } catch (error) {
    console.error("Lỗi lưu vật tư:", error);
  }
});

window.deleteItem = async function (itemId) {
  if (!confirm(`Bạn có chắc chắn muốn xóa vật tư ID ${itemId}?`)) return;
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/inventory/items/${itemId}`,
      "DELETE"
    );
    window.showToast("Đã xóa vật tư!");
    loadAllInventory();
  } catch (error) {}
};

// =============================================================================
// 6. MODULE: USERS (Quản lý Người dùng)
// =============================================================================
async function loadAllUsers() {
  try {
    const users = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/admin/users"
    );
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML =
      users
        .map(
          (u) => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm">${u.user_id}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${
              u.username
            }</td>
            <td class="px-6 py-4 text-sm text-gray-500">${u.email}</td>
            <td class="px-6 py-4 text-sm"><span class="px-2 py-1 rounded-full bg-gray-100 text-xs font-bold uppercase">${
              u.role
            }</span></td>
            <td class="px-6 py-4 text-sm">
                <span class="px-2 py-1 rounded-full text-xs font-bold ${
                  u.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }">
                    ${u.status}
                </span>
            </td>
            <td class="px-6 py-4 text-center space-x-2">
                <button onclick="toggleUserLock(${
                  u.user_id
                })" class="text-indigo-600 hover:text-indigo-900 font-medium">
                    ${u.status === "active" ? "Khóa" : "Mở khóa"}
                </button>
                <button onclick="deleteUser(${
                  u.user_id
                })" class="text-red-600 hover:text-red-900 font-medium">Xóa</button>
            </td>
        </tr>`
        )
        .join("") ||
      '<tr><td colspan="6" class="text-center py-4">Không có user.</td></tr>';
  } catch (err) {
    document.getElementById(
      "users-table-body"
    ).innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Lỗi tải user.</td></tr>`;
  }
}
window.loadAllUsers = loadAllUsers;

window.toggleUserLock = async (userId) => {
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/admin/users/${userId}/toggle-lock`,
      "PUT"
    );
    window.showToast("Cập nhật trạng thái thành công.");
    loadAllUsers();
  } catch (error) {}
};

window.deleteUser = async (userId) => {
  if (!confirm("Xóa người dùng này?")) return;
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/admin/users/${userId}`,
      "DELETE"
    );
    window.showToast("Đã xóa người dùng!");
    loadAllUsers();
  } catch (error) {}
};

// Modal Add User
const addUserModal = document.getElementById("add-user-modal");
window.openAddUserModal = () => addUserModal?.classList.remove("hidden");
window.closeAddUserModal = () => {
  addUserModal?.classList.add("hidden");
  document.getElementById("add-user-form")?.reset();
};

document
  .getElementById("add-user-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      username: document.getElementById("add-username").value,
      email: document.getElementById("add-email").value,
      password: document.getElementById("add-password").value,
      role: document.getElementById("add-role").value,
    };
    try {
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/admin/users",
        "POST",
        data
      );
      window.showToast("Tạo user thành công!");
      window.closeAddUserModal();
      loadAllUsers();
    } catch (error) {
      console.error(error);
    }
  });

// =============================================================================
// 7. MODULE: BOOKINGS (Lịch hẹn)
// =============================================================================
function formatBookingStatus(status) {
  switch (status) {
    case "pending":
      return { text: "Chờ xác nhận", class: "bg-yellow-100 text-yellow-800" };
    case "confirmed":
      return { text: "Đã xác nhận", class: "bg-green-100 text-green-800" };
    case "completed":
      return { text: "Hoàn thành", class: "bg-indigo-100 text-indigo-800" };
    case "canceled":
      return { text: "Đã hủy", class: "bg-red-100 text-red-800" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-800" };
  }
}

async function loadAllBookings() {
  const tbody = document.getElementById("bookings-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center py-4">Đang tải...</td></tr>';

  try {
    const bookings = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/bookings/items",
      "GET"
    );
    if (!bookings || bookings.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4">Không có lịch hẹn.</td></tr>';
      return;
    }
    tbody.innerHTML = bookings
      .reverse()
      .map((b) => {
        const dateStr = formatDateTime(b.start_time);
        const statusInfo = formatBookingStatus(b.status);
        return `
            <tr id="booking-row-${b.id}" class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-mono">${b.id}</td>
                <td class="px-6 py-4 text-sm">
                    <div class="font-medium text-gray-900">${
                      b.customer_name
                    }</div>
                    <div class="text-xs text-gray-500">User ID: ${
                      b.user_id
                    }</div>
                </td>
                <td class="px-6 py-4 text-sm">${dateStr}</td>
                <td class="px-6 py-4 text-sm">${b.service_type}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${
                      b.center_id
                        ? `<span class="block text-indigo-600 font-medium">CN: ${b.center_id}</span>`
                        : ""
                    }
                    KTV: ${b.technician_id || "?"}
                </td>
                <td class="px-6 py-4 text-sm">
                    <select class="border rounded p-1 text-xs ${
                      statusInfo.class
                    }" 
                            onchange="updateBookingStatus(${b.id}, this.value)">
                        <option value="pending" ${
                          b.status === "pending" ? "selected" : ""
                        }>Chờ xác nhận</option>
                        <option value="confirmed" ${
                          b.status === "confirmed" ? "selected" : ""
                        }>Đã xác nhận</option>
                        <option value="completed" ${
                          b.status === "completed" ? "selected" : ""
                        }>Hoàn thành</option>
                        <option value="canceled" ${
                          b.status === "canceled" ? "selected" : ""
                        }>Hủy</option>
                    </select>
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="deleteBooking(${
                      b.id
                    })" class="text-red-600 hover:text-red-900 font-medium">Xóa</button>
                </td>
            </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-red-500 py-4">Lỗi tải lịch hẹn.</td></tr>';
  }
}
window.loadAllBookings = loadAllBookings;

window.updateBookingStatus = async (id, status) => {
  if (!confirm(`Cập nhật trạng thái lịch hẹn ${id} thành ${status}?`)) {
    loadAllBookings();
    return;
  }
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/bookings/items/${id}/status`,
      "PUT",
      { status }
    );
    window.showToast("Cập nhật thành công!");
    loadAllBookings();
  } catch (e) {
    loadAllBookings();
  }
};

window.deleteBooking = async (id) => {
  if (!confirm("Xóa vĩnh viễn lịch hẹn này?")) return;
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/bookings/items/${id}`,
      "DELETE"
    );
    window.showToast("Đã xóa lịch hẹn!");
    document.getElementById(`booking-row-${id}`)?.remove();
  } catch (e) {}
};

// =============================================================================
// 8. MODULE: MAINTENANCE (Bảo trì)
// =============================================================================
function formatMaintenanceStatus(status) {
  switch (status) {
    case "pending":
      return { text: "Chờ thực hiện", class: "bg-yellow-100 text-yellow-800" };
    case "in_progress":
      return { text: "Đang tiến hành", class: "bg-blue-100 text-blue-800" };
    case "completed":
      return { text: "Hoàn thành", class: "bg-green-100 text-green-800" };
    case "failed":
      return { text: "Thất bại/Hủy", class: "bg-red-100 text-red-800" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-800" };
  }
}

async function loadAllMaintenanceTasks() {
  const tbody = document.getElementById("maintenance-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center text-gray-500 py-4">Đang tải...</td></tr>';

  try {
    const tasks = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/maintenance/tasks",
      "GET"
    );
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4">Không có công việc nào.</td></tr>';
      return;
    }
    tbody.innerHTML = tasks
      .map((t) => {
        const statusInfo = formatMaintenanceStatus(t.status);
        const disabled =
          t.status === "completed" || t.status === "failed" ? "disabled" : "";
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-mono text-gray-600">#${
                  t.task_id
                }</td>
                <td class="px-6 py-4 text-sm">Booking #${t.booking_id}</td>
                <td class="px-6 py-4 text-sm">${t.description}</td>
                <td class="px-6 py-4 text-sm font-mono">${
                  t.vehicle_vin || "-"
                }</td>
                <td class="px-6 py-4 text-sm">KTV ID: ${t.technician_id}</td>
                <td class="px-6 py-4 text-sm">
                     <select class="border rounded p-1 text-xs ${
                       statusInfo.class
                     }" ${disabled} onchange="updateMaintenanceTaskStatus(${
          t.task_id
        }, this.value)">
                        <option value="pending" ${
                          t.status === "pending" ? "selected" : ""
                        }>Chờ thực hiện</option>
                        <option value="in_progress" ${
                          t.status === "in_progress" ? "selected" : ""
                        }>Đang tiến hành</option>
                        <option value="completed" ${
                          t.status === "completed" ? "selected" : ""
                        }>Hoàn thành</option>
                        <option value="failed" ${
                          t.status === "failed" ? "selected" : ""
                        }>Thất bại</option>
                    </select>
                </td>
                <td class="px-6 py-4 text-center space-x-2">
                    <button onclick="viewMaintenanceDetail(${
                      t.task_id
                    })" class="text-blue-600 hover:text-blue-900 font-medium bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition">Chi Tiết</button>
                    ${
                      disabled
                        ? ""
                        : `<button onclick="if(confirm('Hoàn thành công việc?')) updateMaintenanceTaskStatus(${t.task_id}, 'completed')" class="text-green-600 hover:text-green-900 font-medium">Xong</button>`
                    }
                </td>
            </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-red-500">Lỗi tải dữ liệu.</td></tr>';
  }
}
window.loadAllMaintenanceTasks = loadAllMaintenanceTasks;

window.updateMaintenanceTaskStatus = async (taskId, newStatus) => {
  if (!confirm(`Cập nhật trạng thái Task ${taskId} -> ${newStatus}?`)) {
    loadAllMaintenanceTasks();
    return;
  }
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/maintenance/tasks/${taskId}/status`,
      "PUT",
      { status: newStatus }
    );
    window.showToast("Cập nhật thành công!");
    loadAllMaintenanceTasks();
  } catch (e) {
    loadAllMaintenanceTasks();
  }
};

// Modal Tạo Task
const createTaskModal = document.getElementById("create-task-modal");
window.closeCreateTaskModal = () => {
  createTaskModal?.classList.add("hidden");
  document.getElementById("create-task-form")?.reset();
};

window.openCreateTaskModal = async () => {
  if (!createTaskModal) return;
  createTaskModal.classList.remove("hidden");

  // Load Dropdowns
  try {
    // 1. Load incomplete bookings
    const bookings = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/bookings/items",
      "GET"
    );
    const incomplete = bookings.filter(
      (b) => b.status !== "completed" && b.status !== "canceled"
    );
    const bookingSelect = document.getElementById("task-booking-id");
    bookingSelect.innerHTML =
      '<option value="">-- Chọn lịch hẹn --</option>' +
      incomplete
        .map(
          (b) =>
            `<option value="${b.id}">#${b.id} - ${
              b.service_type
            } - ${formatDateTime(b.start_time)}</option>`
        )
        .join("");

    // 2. Load Technicians
    const users = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/admin/users",
      "GET"
    );
    const techs = users.filter((u) => u.role === "technician");
    const techSelect = document.getElementById("task-technician-id");
    techSelect.innerHTML =
      '<option value="">-- Chọn KTV --</option>' +
      techs
        .map(
          (t) =>
            `<option value="${t.user_id}">#${t.user_id} - ${t.username}</option>`
        )
        .join("");
  } catch (e) {
    window.showToast("Lỗi tải dữ liệu dropdown", true);
  }
};
// --- LOGIC XEM CHI TIẾT BẢO TRÌ (MỚI) ---
const maintDetailModal = document.getElementById("maintenance-detail-modal");
window.closeMaintenanceDetailModal = () =>
  maintDetailModal?.classList.add("hidden");

window.viewMaintenanceDetail = async (taskId) => {
  try {
    window.showLoading();
    const [task, parts, checklist, inventory] = await Promise.all([
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/maintenance/tasks/${taskId}`,
        "GET"
      ),
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/maintenance/tasks/${taskId}/parts`,
        "GET"
      ),
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/maintenance/tasks/${taskId}/checklist`,
        "GET"
      ),
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        `/api/inventory/items`,
        "GET"
      ),
    ]);

    const statusInfo = formatMaintenanceStatus(task.status);
    document.getElementById("maint-detail-id").textContent = task.task_id;
    document.getElementById("maint-detail-vin").textContent =
      task.vehicle_vin || "N/A";
    document.getElementById("maint-detail-desc").textContent = task.description;
    document.getElementById(
      "maint-detail-tech"
    ).textContent = `ID: ${task.technician_id}`;
    const statusEl = document.getElementById("maint-detail-status");
    statusEl.textContent = statusInfo.text;
    statusEl.className = `font-bold px-2 py-1 rounded text-sm ${statusInfo.class}`;

    const partsBody = document.getElementById("maint-detail-parts-body");
    if (!parts || parts.length === 0) {
      partsBody.innerHTML =
        '<tr><td colspan="2" class="px-4 py-2 text-center text-gray-500 italic">Chưa sử dụng phụ tùng nào.</td></tr>';
    } else {
      partsBody.innerHTML = parts
        .map((p) => {
          const itemInfo = inventory.find((i) => i.id === p.item_id);
          const itemName = itemInfo ? itemInfo.name : `Mã PT #${p.item_id}`;
          return `<tr class="border-b last:border-0"><td class="px-4 py-2 text-sm font-medium text-gray-800">${itemName}</td><td class="px-4 py-2 text-sm text-right font-mono font-bold text-indigo-600">x${p.quantity}</td></tr>`;
        })
        .join("");
    }

    const checklistBody = document.getElementById(
      "maint-detail-checklist-body"
    );
    if (!checklist || checklist.length === 0) {
      checklistBody.innerHTML =
        '<tr><td colspan="3" class="px-4 py-2 text-center text-gray-500 italic">Chưa có checklist.</td></tr>';
    } else {
      checklistBody.innerHTML = checklist
        .map((c) => {
          let statusBadge = "";
          if (c.status === "pass")
            statusBadge =
              '<span class="text-green-600 font-bold flex items-center">✅ Đạt</span>';
          else if (c.status === "fail")
            statusBadge =
              '<span class="text-red-600 font-bold flex items-center">❌ Hỏng</span>';
          else if (c.status === "needs_repair")
            statusBadge =
              '<span class="text-yellow-600 font-bold flex items-center">⚠️ Cần sửa</span>';
          else
            statusBadge =
              '<span class="text-gray-400 italic">Chưa kiểm tra</span>';
          return `<tr class="border-b last:border-0 hover:bg-gray-50"><td class="px-4 py-2 text-sm font-medium">${
            c.item_name
          }</td><td class="px-4 py-2 text-sm">${statusBadge}</td><td class="px-4 py-2 text-sm text-gray-600 italic">${
            c.note || "-"
          }</td></tr>`;
        })
        .join("");
    }
    maintDetailModal?.classList.remove("hidden");
  } catch (e) {
    console.error(e);
    window.showToast("Không thể tải chi tiết công việc", true);
  } finally {
    window.hideLoading();
  }
};
document
  .getElementById("create-task-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      booking_id: parseInt(document.getElementById("task-booking-id").value),
      technician_id: parseInt(
        document.getElementById("task-technician-id").value
      ),
    };
    try {
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/maintenance/tasks",
        "POST",
        data
      );
      window.showToast("Tạo công việc thành công!");
      window.closeCreateTaskModal();
      loadAllMaintenanceTasks();
    } catch (e) {
      console.error(e);
    }
  });

// =============================================================================
// 9. MODULE: INVOICES (Hóa đơn)
// =============================================================================
function formatInvoiceStatus(status) {
  switch (status) {
    case "pending":
      return { text: "Chờ thanh toán", class: "bg-yellow-100 text-yellow-800" };
    case "issued":
      return { text: "Đã xuất", class: "bg-blue-100 text-blue-800" };
    case "paid":
      return { text: "Đã thanh toán", class: "bg-green-100 text-green-800" };
    case "canceled":
      return { text: "Đã hủy", class: "bg-red-100 text-red-800" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-800" };
  }
}

async function loadAllInvoices() {
  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center text-gray-500 py-4">Đang tải...</td></tr>';

  try {
    const invoices = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/invoices/",
      "GET"
    );
    if (!invoices || invoices.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4">Không có hóa đơn.</td></tr>';
      return;
    }
    tbody.innerHTML = invoices
      .map((inv) => {
        const statusInfo = formatInvoiceStatus(inv.status);
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm">${inv.id}</td>
                <td class="px-6 py-4 text-sm">${inv.booking_id}</td>
                <td class="px-6 py-4 text-sm">${inv.user_id}</td>
                <td class="px-6 py-4 text-sm font-semibold text-red-600">${formatCurrency(
                  inv.total_amount
                )}</td>
                <td class="px-6 py-4 text-sm">
                     <select class="border rounded p-1 text-xs ${
                       statusInfo.class
                     }"
                            onchange="updateInvoiceStatus(${
                              inv.id
                            }, this.value)">
                        <option value="issued" ${
                          inv.status === "issued" ? "selected" : ""
                        }>Đã xuất</option>
                        <option value="pending" ${
                          inv.status === "pending" ? "selected" : ""
                        }>Chờ thanh toán</option>
                        <option value="paid" ${
                          inv.status === "paid" ? "selected" : ""
                        }>Đã thanh toán</option>
                        <option value="canceled" ${
                          inv.status === "canceled" ? "selected" : ""
                        }>Đã hủy</option>
                    </select>
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="showAdminInvoiceDetails(${
                      inv.id
                    })" class="text-indigo-600 hover:text-indigo-900 font-medium">Chi Tiết</button>
                </td>
            </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-red-500">Lỗi tải hóa đơn.</td></tr>';
  }
}
window.loadAllInvoices = loadAllInvoices;

window.updateInvoiceStatus = async (id, status) => {
  if (!confirm(`Đổi trạng thái hóa đơn ${id} -> ${status}?`)) {
    loadAllInvoices();
    return;
  }
  try {
    await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/invoices/${id}/status`,
      "PUT",
      { status }
    );
    window.showToast("Cập nhật thành công!");
    loadAllInvoices();
  } catch (e) {
    loadAllInvoices();
  }
};

// --- Invoice Detail Modal ---
const adminInvoiceDetailModal = document.getElementById(
  "admin-invoice-detail-modal"
);
window.closeAdminInvoiceDetailModal = () =>
  adminInvoiceDetailModal?.classList.add("hidden");

window.showAdminInvoiceDetails = async (id) => {
  try {
    const detail = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      `/api/invoices/${id}`,
      "GET"
    );
    if (!detail) throw new Error("No details");

    const statusInfo = formatInvoiceStatus(detail.status);
    document.getElementById("admin-invoice-detail-id").textContent = detail.id;
    document.getElementById("admin-invoice-detail-date").textContent =
      formatDateTime(detail.created_at);
    const statusEl = document.getElementById("admin-invoice-detail-status");
    statusEl.textContent = statusInfo.text;
    statusEl.className = `font-bold ${statusInfo.class} p-1 rounded`;
    document.getElementById("admin-invoice-detail-total").textContent =
      formatCurrency(detail.total_amount);

    document.getElementById("admin-invoice-items-table-body").innerHTML =
      detail.items
        .map(
          (item) => `
            <tr>
                <td class="px-3 py-2 text-sm">${item.description}</td>
                <td class="px-3 py-2 text-sm text-right">${item.quantity}</td>
                <td class="px-3 py-2 text-sm text-right">${formatCurrency(
                  item.unit_price
                )}</td>
                <td class="px-3 py-2 text-sm text-right font-medium">${formatCurrency(
                  item.sub_total
                )}</td>
            </tr>
        `
        )
        .join("");
    adminInvoiceDetailModal?.classList.remove("hidden");
  } catch (e) {
    window.showToast("Lỗi xem chi tiết", true);
  }
};

// --- Create Invoice Logic ---
const createInvoiceModal = document.getElementById("create-invoice-modal");
const partsInputContainer = document.getElementById("parts-input-container");

window.closeCreateInvoiceModal = () => {
  createInvoiceModal?.classList.add("hidden");
  document.getElementById("create-invoice-form")?.reset();
  if (partsInputContainer) partsInputContainer.innerHTML = "";
};

window.openCreateInvoiceModal = async () => {
  createInvoiceModal?.classList.remove("hidden");
  try {
    // Load bookings confirmed chưa có hóa đơn và Inventory
    const [bookings, invoices, items] = await Promise.all([
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/bookings/items",
        "GET"
      ),
      window.apiRequestCore(window.ADMIN_TOKEN_KEY, "/api/invoices/", "GET"),
      window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/inventory/items",
        "GET"
      ),
    ]);
    window.inventoryItems = items; // Cache for dropdown

    const invoiceBookingIds = invoices.map((i) => i.booking_id);
    const available = bookings.filter(
      (b) => b.status === "confirmed" && !invoiceBookingIds.includes(b.id)
    );

    const select = document.getElementById("invoice-booking-id");
    select.innerHTML =
      '<option value="">-- Chọn lịch hẹn --</option>' +
      available
        .map(
          (b) =>
            `<option value="${b.id}">#${b.id} - ${b.service_type} - ${b.customer_name}</option>`
        )
        .join("");
  } catch (e) {
    window.showToast("Lỗi tải dữ liệu form", true);
  }
};

window.addPartInput = () => {
  if (!partsInputContainer) return;
  const count = partsInputContainer.children.length + 1;
  const itemOptions =
    window.inventoryItems
      ?.map(
        (i) =>
          `<option value="${i.id}">#${i.id} ${i.name} (${
            i.quantity
          }) - ${formatCurrency(i.price)}</option>`
      )
      .join("") || "";

  const html = `
        <div class="flex space-x-2 part-input-group mb-2" data-id="${count}">
            <select name="item_id" class="w-1/2 px-3 py-2 border rounded bg-white" required>
                <option value="">-- Chọn PT --</option>
                ${itemOptions}
            </select>
            <input type="number" name="quantity" placeholder="SL" class="w-1/4 px-3 py-2 border rounded" required min="1" value="1" />
            <button type="button" onclick="this.parentElement.remove()" class="text-red-500">&times;</button>
        </div>`;
  partsInputContainer.insertAdjacentHTML("beforeend", html);
};

document
  .getElementById("create-invoice-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bookingId = parseInt(
      document.getElementById("invoice-booking-id").value
    );
    try {
      await window.apiRequestCore(
        window.ADMIN_TOKEN_KEY,
        "/api/invoices/",
        "POST",
        { booking_id: bookingId }
      );
      window.showToast("Tạo hóa đơn thành công!");
      window.closeCreateInvoiceModal();
      loadAllInvoices();
    } catch (e) {
      console.error(e);
    }
  });

// =============================================================================
// 10. MODULE: PAYMENT HISTORY (Lịch sử thanh toán)
// =============================================================================
function formatPaymentStatus(status) {
  switch (status) {
    case "pending":
      return { text: "Chờ thanh toán", class: "bg-yellow-100 text-yellow-800" };
    case "success":
      return { text: "Thành công", class: "bg-green-100 text-green-800" };
    case "failed":
      return { text: "Thất bại", class: "bg-red-100 text-red-800" };
    case "expired":
      return { text: "Hết Hạn", class: "bg-gray-100 text-gray-800" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-800" };
  }
}

async function loadAllPaymentHistory() {
  const tbody = document.getElementById("payment-history-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center py-4">Đang tải...</td></tr>';

  try {
    const history = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/payments/history/all",
      "GET"
    );
    if (!history || history.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4">Không có giao dịch.</td></tr>';
      return;
    }
    tbody.innerHTML = history
      .map((t) => {
        const statusInfo = formatPaymentStatus(t.status);
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-semibold">${t.id}</td>
                <td class="px-6 py-4 text-sm">${t.invoice_id}</td>
                <td class="px-6 py-4 text-sm">${t.user_id}</td>
                <td class="px-6 py-4 text-sm font-bold text-red-600">${formatCurrency(
                  t.amount
                )}</td>
                <td class="px-6 py-4 text-sm uppercase">${t.method}</td>
                <td class="px-6 py-4 text-sm font-mono">${
                  t.pg_transaction_id
                }</td>
                <td class="px-6 py-4 text-sm">
                    <span class="p-1 rounded-full text-xs font-semibold ${
                      statusInfo.class
                    }">${statusInfo.text}</span>
                </td>
            </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-red-500">Lỗi tải dữ liệu.</td></tr>';
  }
}
window.loadAllPaymentHistory = loadAllPaymentHistory;

// =============================================================================
// 11. MODULE: NOTIFICATIONS
// =============================================================================
function formatNotificationPriority(p) {
  switch (p) {
    case "low":
      return { text: "Low", class: "bg-green-100 text-green-800" };
    case "medium":
      return { text: "Medium", class: "bg-yellow-100 text-yellow-800" };
    case "high":
      return { text: "High", class: "bg-orange-100 text-orange-800" };
    case "urgent":
      return { text: "Urgent", class: "bg-red-100 text-red-800" };
    default:
      return { text: p, class: "bg-gray-100" };
  }
}

async function loadAllNotificationsAdmin() {
  const tbody = document.getElementById("notifications-table-body");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center py-4">Đang tải...</td></tr>';
  try {
    const notifs = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/notifications/admin/all",
      "GET"
    );
    if (!notifs || notifs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4">Không có thông báo.</td></tr>';
      return;
    }
    tbody.innerHTML = notifs
      .map((n) => {
        const pInfo = formatNotificationPriority(n.priority);
        const isUnread = !n.read_at;
        return `
            <tr class="${isUnread ? "bg-blue-50" : ""}">
                <td class="px-6 py-4 text-sm">${n.id}</td>
                <td class="px-6 py-4 text-sm">${n.user_id}</td>
                <td class="px-6 py-4 text-sm"><span class="badge">${
                  n.notification_type
                }</span></td>
                <td class="px-6 py-4 text-sm truncate max-w-xs">${n.title}</td>
                <td class="px-6 py-4 text-sm"><span class="badge ${
                  pInfo.class
                }">${pInfo.text}</span></td>
                <td class="px-6 py-4 text-sm">${n.status}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="viewNotificationDetail(${
                      n.id
                    })" class="text-indigo-600 hover:text-indigo-900 font-medium">Xem</button>
                </td>
            </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-red-500 text-center">Lỗi tải dữ liệu.</td></tr>';
  }
}
window.loadAllNotificationsAdmin = loadAllNotificationsAdmin;

// Modal Notification Detail & Create
const viewNotifModal = document.getElementById("view-notification-modal");
window.closeViewNotificationModal = () =>
  viewNotifModal?.classList.add("hidden");

window.viewNotificationDetail = async (id) => {
  try {
    const notifs = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/notifications/admin/all",
      "GET"
    );
    const n = notifs.find((i) => i.id === id);
    if (!n) return;

    document.getElementById("notif-detail-id").textContent = n.id;
    document.getElementById("notif-detail-user-id").textContent = n.user_id;
    document.getElementById("notif-detail-type").textContent =
      n.notification_type;
    document.getElementById("notif-detail-title").textContent = n.title;
    document.getElementById("notif-detail-message").textContent = n.message;
    document.getElementById("notif-detail-created").textContent =
      formatDateTime(n.created_at);

    viewNotifModal?.classList.remove("hidden");
  } catch (e) {}
};

const createNotifModal = document.getElementById("create-notification-modal");
window.openCreateNotificationModal = () =>
  createNotifModal?.classList.remove("hidden");
window.closeCreateNotificationModal = () => {
  createNotifModal?.classList.add("hidden");
  document.getElementById("create-notification-form")?.reset();
};

document
  .getElementById("create-notification-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Giả lập internal call
    const token = prompt("Nhập INTERNAL_SERVICE_TOKEN:", "Bearer eyJhbGci...");
    if (!token) return;

    const data = {
      user_id: parseInt(document.getElementById("notif-user-id").value),
      notification_type: document.getElementById("notif-type").value,
      title: document.getElementById("notif-title").value,
      message: document.getElementById("notif-message").value,
      priority: document.getElementById("notif-priority").value,
      channel: "in_app",
    };

    try {
      const res = await fetch(
        "http://localhost/internal/notifications/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Token": token,
          },
          body: JSON.stringify(data),
        }
      );
      if (res.ok) {
        window.showToast("Tạo notification thành công!");
        window.closeCreateNotificationModal();
        loadAllNotificationsAdmin();
      } else {
        window.showToast("Lỗi tạo notification", true);
      }
    } catch (e) {
      window.showToast("Lỗi kết nối", true);
    }
  });

// =============================================================================
// 12. MODULE: REPORTS (Báo cáo)
// =============================================================================
window.switchReportTab = function (tabName) {
  document
    .querySelectorAll(".report-content")
    .forEach((tab) => tab.classList.add("hidden"));
  document.querySelectorAll(".report-tab").forEach((tab) => {
    tab.classList.remove("border-indigo-600", "text-indigo-600");
    tab.classList.add("border-transparent", "text-gray-500");
  });

  if (tabName === "revenue") {
    document.getElementById("revenue-report-tab").classList.remove("hidden");
    document
      .getElementById("tab-revenue")
      .classList.add("border-indigo-600", "text-indigo-600");
    loadRevenueReport();
  } else if (tabName === "inventory") {
    document.getElementById("inventory-report-tab").classList.remove("hidden");
    document
      .getElementById("tab-inventory")
      .classList.add("border-indigo-600", "text-indigo-600");
    loadInventoryReport();
  }
};

async function loadDashboardData() {
  try {
    const response = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/reports/dashboard",
      "GET"
    );
    document.getElementById("revenue-today").textContent = formatCurrency(
      response.revenue.today.total_revenue
    );
    document.getElementById(
      "transactions-today"
    ).textContent = `${response.revenue.today.transaction_count} giao dịch`;
    document.getElementById("revenue-month").textContent = formatCurrency(
      response.revenue.month.total_revenue
    );
    document.getElementById(
      "transactions-month"
    ).textContent = `${response.revenue.month.transaction_count} giao dịch`;
    document.getElementById("low-stock-count").textContent =
      response.inventory.low_stock_count;
  } catch (error) {
    console.error("Lỗi dashboard:", error);
  }
}

async function loadRevenueReport() {
  try {
    const res = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/reports/revenue",
      "GET"
    );

    const details = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Tổng Doanh Thu</p>
                    <p class="text-2xl font-bold text-green-600">${formatCurrency(
                      res.total_revenue
                    )}</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Số Giao Dịch</p>
                    <p class="text-2xl font-bold text-blue-600">${
                      res.transaction_count
                    }</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Giá Trị TB</p>
                    <p class="text-2xl font-bold text-indigo-600">${formatCurrency(
                      res.avg_transaction_value
                    )}</p>
                </div>
            </div>`;
    document.getElementById("revenue-details-container").innerHTML = details;

    let methods = '<div class="space-y-3">';
    for (const [method, data] of Object.entries(res.payment_methods)) {
      methods += `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div><p class="font-semibold">${method}</p><p class="text-sm text-gray-600">${
        data.count
      } GD</p></div>
                    <p class="text-lg font-bold text-green-600">${formatCurrency(
                      data.amount
                    )}</p>
                </div>`;
    }
    document.getElementById("payment-methods-container").innerHTML =
      methods + "</div>";
  } catch (e) {}
}

async function loadInventoryReport() {
  try {
    const res = await window.apiRequestCore(
      window.ADMIN_TOKEN_KEY,
      "/api/reports/inventory",
      "GET"
    );

    const overview = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Tổng Loại PT</p>
                    <p class="text-2xl font-bold text-blue-600">${
                      res.total_parts
                    }</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Tổng SL</p>
                    <p class="text-2xl font-bold text-indigo-600">${
                      res.total_quantity
                    }</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Giá Trị Kho</p>
                    <p class="text-2xl font-bold text-green-600">${formatCurrency(
                      res.total_inventory_value
                    )}</p>
                </div>
                <div class="text-center p-4 bg-gray-50 rounded">
                    <p class="text-sm text-gray-600">Sắp Hết</p>
                    <p class="text-2xl font-bold text-red-600">${
                      res.low_stock_count
                    }</p>
                </div>
            </div>`;
    document.getElementById("inventory-overview-container").innerHTML =
      overview;

    const lowStock = res.low_stock_parts
      .map(
        (p) => `
            <div class="flex justify-between items-center p-3 border border-red-200 bg-red-50 rounded mb-2">
                <div><p class="font-semibold">${p.name}</p><p class="text-sm text-gray-600">SKU: ${p.sku}</p></div>
                <div class="text-right"><p class="text-lg font-bold text-red-600">Còn: ${p.quantity}</p></div>
            </div>
        `
      )
      .join("");
    document.getElementById("low-stock-container").innerHTML =
      lowStock || '<p class="text-green-600">✅ Kho ổn định</p>';
  } catch (e) {}
}

// =============================================================================
// 13. INITIALIZATION
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem(window.ADMIN_TOKEN_KEY);
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const isValid = payload.exp * 1000 > Date.now();

    if (isValid && payload.role === window.ADMIN_ROLE) {
      showDashboard();
      // Mặc định vào Inventory Section
      navigateToDashboardSection("inventory-section", "Quản lý Kho Phụ Tùng");

      // Initialize admin chat
      initializeAdminChat();
    } else {
      adminLogout();
    }
  } catch (e) {
    adminLogout();
  }
});

// =============================================================================
// 14. ADMIN CHAT MANAGEMENT
// =============================================================================

const ADMIN_CHAT_API_URL = "/api/chat";
let adminChatSocket = null;
let currentAdminChatRoom = null;
let currentChatTab = "waiting";
let adminTypingTimeout = null;

// Helper function to get admin info from JWT token
function getAdminUserInfo() {
  const token = localStorage.getItem(window.ADMIN_TOKEN_KEY);
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub,
      username: payload.username || "Admin",
      fullname: payload.fullname || payload.username || "Admin",
      role: payload.role
    };
  } catch (e) {
    console.error("Error parsing admin token:", e);
    return null;
  }
}

function initializeAdminChat() {
  // Connect to Socket.IO
  connectAdminChatSocket();

  // Load chat rooms
  loadChatRooms();

  // Refresh rooms every 10 seconds
  setInterval(loadChatRooms, 10000);
}

function connectAdminChatSocket() {
  if (adminChatSocket) return;

  adminChatSocket = io("/", {
    path: "/socket.io",
    transports: ["websocket", "polling"]
  });

  adminChatSocket.on("connect", () => {
    console.log("✅ Admin connected to chat server");
  });

  adminChatSocket.on("disconnect", () => {
    console.log("❌ Admin disconnected from chat server");
  });

  adminChatSocket.on("new_message", (message) => {
    // Reload rooms to update counts
    loadChatRooms();

    // If this is the current room, append message
    if (currentAdminChatRoom && message.room_id === currentAdminChatRoom.id) {
      appendAdminChatMessage(message);
    }
  });

  adminChatSocket.on("user_typing", (data) => {
    if (currentAdminChatRoom) {
      document.getElementById("admin-typing-indicator").classList.remove("hidden");
    }
  });

  adminChatSocket.on("user_stop_typing", (data) => {
    document.getElementById("admin-typing-indicator").classList.add("hidden");
  });
}

async function loadChatRooms() {
  try {
    // Load waiting rooms
    const waitingRes = await fetch(`${ADMIN_CHAT_API_URL}/rooms/waiting`);
    const waitingData = await waitingRes.json();

    // Load active rooms
    const activeRes = await fetch(`${ADMIN_CHAT_API_URL}/rooms/active`);
    const activeData = await activeRes.json();

    // Update counts
    document.getElementById("waiting-count").textContent = waitingData.rooms?.length || 0;
    document.getElementById("active-count").textContent = activeData.rooms?.length || 0;

    // Render rooms
    renderChatRoomList("waiting-rooms-list", waitingData.rooms, "waiting");
    renderChatRoomList("active-rooms-list", activeData.rooms, "active");
  } catch (error) {
    console.error("Error loading chat rooms:", error);
  }
}

function renderChatRoomList(containerId, rooms, status) {
  const container = document.getElementById(containerId);

  if (!rooms || rooms.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center py-8">Không có phòng ${
      status === "waiting" ? "chờ" : status === "active" ? "đang hỗ trợ" : "đã đóng"
    }</p>`;
    return;
  }

  container.innerHTML = rooms.map(room => `
    <div
      onclick="selectAdminChatRoom(${room.id})"
      class="p-4 mb-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition ${
        currentAdminChatRoom && currentAdminChatRoom.id === room.id ? "bg-indigo-50 border-indigo-500" : ""
      }"
    >
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-semibold text-gray-800">${room.user_name}</h4>
        ${room.unread_count > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full">${room.unread_count}</span>` : ""}
      </div>
      <p class="text-sm text-gray-600 truncate">${room.subject || "Hỗ trợ khách hàng"}</p>
      <p class="text-xs text-gray-400 mt-1">${formatAdminChatTime(room.updated_at)}</p>
    </div>
  `).join("");
}

async function selectAdminChatRoom(roomId) {
  try {
    const response = await fetch(`${ADMIN_CHAT_API_URL}/rooms/${roomId}`);
    const data = await response.json();

    if (!data.success) {
      alert("Không thể tải phòng chat");
      return;
    }

    currentAdminChatRoom = data.room;

    // Join room
    if (adminChatSocket) {
      adminChatSocket.emit("join_room", { room_id: roomId });
    }

    // Update header with user info
    document.getElementById("admin-chat-user-name").textContent = data.room.user_name;
    document.getElementById("admin-chat-user-id").textContent = `User ID: ${data.room.user_id}`;

    const statusText = data.room.status === "waiting" ? "Đang chờ hỗ trợ" :
      data.room.status === "active" ? `Đang hỗ trợ bởi ${data.room.support_user_name}` : "";

    // Create status element with user ID
    const statusElement = document.getElementById("admin-chat-status");
    statusElement.innerHTML = `${statusText} • <span id="admin-chat-user-id">User ID: ${data.room.user_id}</span>`;

    // Always show input for waiting and active rooms
    const inputContainer = document.getElementById("admin-chat-input-container");
    inputContainer.classList.remove("hidden");

    // If room is waiting, assign it to this admin
    if (data.room.status === "waiting") {
      await assignRoomToAdmin(roomId);
    }

    // Load messages
    await loadAdminChatMessages(roomId);
  } catch (error) {
    console.error("Error selecting chat room:", error);
  }
}

async function assignRoomToAdmin(roomId) {
  const admin = getAdminUserInfo();
  if (!admin) {
    console.error("Admin not logged in");
    return;
  }

  try {
    const response = await fetch(`${ADMIN_CHAT_API_URL}/rooms/${roomId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        support_user_id: admin.id,
        support_user_name: admin.fullname || admin.username,
        support_role: admin.role
      })
    });

    const data = await response.json();
    if (data.success) {
      currentAdminChatRoom = data.room;

      // Notify via Socket.IO
      if (adminChatSocket) {
        adminChatSocket.emit("room_assigned", { room_id: roomId });
      }

      // Reload rooms
      loadChatRooms();
    }
  } catch (error) {
    console.error("Error assigning room:", error);
  }
}

async function loadAdminChatMessages(roomId) {
  try {
    const response = await fetch(`${ADMIN_CHAT_API_URL}/rooms/${roomId}/messages`);
    const data = await response.json();

    const messagesContainer = document.getElementById("admin-chat-messages");
    messagesContainer.innerHTML = "";

    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => appendAdminChatMessage(msg, false));
    } else {
      messagesContainer.innerHTML = `
        <div class="text-center text-gray-500 py-20">
          <p class="text-lg">Chưa có tin nhắn</p>
        </div>
      `;
    }

    scrollAdminChatToBottom();
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function switchChatTab(tab) {
  currentChatTab = tab;

  // Update tab styles
  document.querySelectorAll(".chat-tab").forEach(t => {
    t.classList.remove("border-indigo-600", "text-indigo-600");
    t.classList.add("border-transparent", "text-gray-500");
  });

  document.getElementById(`tab-chat-${tab}`).classList.remove("border-transparent", "text-gray-500");
  document.getElementById(`tab-chat-${tab}`).classList.add("border-indigo-600", "text-indigo-600");

  // Show/hide room lists
  document.querySelectorAll(".chat-rooms-list").forEach(list => list.classList.add("hidden"));
  document.getElementById(`${tab}-rooms-list`).classList.remove("hidden");
}

function handleAdminChatKeyPress(event) {
  if (event.key === "Enter") {
    sendAdminChatMessage();
  } else {
    // Send typing indicator
    if (adminChatSocket && currentAdminChatRoom) {
      const admin = getAdminUserInfo();
      if (admin) {
        adminChatSocket.emit("typing", {
          room_id: currentAdminChatRoom.id,
          user_name: admin.fullname || admin.username
        });

        // Clear previous timeout
        if (adminTypingTimeout) clearTimeout(adminTypingTimeout);

        // Stop typing after 2 seconds
        adminTypingTimeout = setTimeout(() => {
          adminChatSocket.emit("stop_typing", {
            room_id: currentAdminChatRoom.id,
            user_name: admin.fullname || admin.username
          });
        }, 2000);
      }
    }
  }
}

async function sendAdminChatMessage() {
  const input = document.getElementById("admin-chat-input");
  const message = input.value.trim();

  if (!message || !currentAdminChatRoom) return;

  const admin = getAdminUserInfo();
  if (!admin) {
    console.error("Admin not logged in");
    return;
  }

  const messageData = {
    room_id: currentAdminChatRoom.id,
    sender_id: admin.id,
    sender_name: admin.fullname || admin.username,
    sender_role: admin.role,
    message: message,
    message_type: "text"
  };

  // Send via Socket.IO
  if (adminChatSocket) {
    adminChatSocket.emit("send_message", messageData);
    adminChatSocket.emit("stop_typing", {
      room_id: currentAdminChatRoom.id,
      user_name: admin.fullname || admin.username
    });
  }

  input.value = "";
}

function appendAdminChatMessage(message, scroll = true) {
  const messagesContainer = document.getElementById("admin-chat-messages");
  const admin = getAdminUserInfo();

  // Remove empty state if exists
  const emptyState = messagesContainer.querySelector(".text-center");
  if (emptyState && emptyState.textContent.includes("Chưa có tin nhắn")) {
    emptyState.remove();
  }

  const isOwnMessage = admin && message.sender_id === admin.id;
  const isSystem = message.message_type === "system";

  const messageDiv = document.createElement("div");

  if (isSystem) {
    messageDiv.className = "text-center text-gray-500 text-xs py-2";
    messageDiv.innerHTML = `<span class="bg-gray-200 px-3 py-1 rounded-full">${message.message}</span>`;
  } else {
    messageDiv.className = `flex ${isOwnMessage ? "justify-end" : "justify-start"}`;
    messageDiv.innerHTML = `
      <div class="max-w-[70%]">
        <div class="text-xs ${isOwnMessage ? "text-right" : "text-left"} mb-1 text-gray-500">
          ${message.sender_name}
        </div>
        <div class="${isOwnMessage ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"} px-4 py-2 rounded-lg">
          ${escapeHtml(message.message)}
        </div>
        <div class="text-xs ${isOwnMessage ? "text-right" : "text-left"} mt-1 text-gray-400">
          ${formatAdminChatTime(message.created_at)}
        </div>
      </div>
    `;
  }

  messagesContainer.appendChild(messageDiv);

  if (scroll) {
    scrollAdminChatToBottom();
  }
}

function scrollAdminChatToBottom() {
  const messagesContainer = document.getElementById("admin-chat-messages");
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Chat rooms are never closed - all history is preserved

function formatAdminChatTime(timestamp) {
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
