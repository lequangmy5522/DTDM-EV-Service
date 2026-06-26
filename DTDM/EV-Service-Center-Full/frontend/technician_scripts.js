// ==================== CONSTANTS ====================
const TECH_TOKEN_KEY = "tech_access_token";
// Sử dụng API Gateway (Cổng 80) làm đầu mối duy nhất, thay vì trỏ thẳng vào một service
const API_BASE_URL = window.location.origin; // Sẽ là http://localhost nếu chạy local

// ==================== UTILITY FUNCTIONS ====================
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");
  toastMessage.textContent = message;
  toast.classList.remove("hidden", "bg-green-500", "bg-red-500", "opacity-0");
  toast.classList.add(isError ? "bg-red-500" : "bg-green-500", "opacity-100");
  setTimeout(() => {
    toast.classList.remove("opacity-100");
    toast.classList.add("opacity-0");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
}

async function apiRequest(endpoint, method = "GET", body = null) {
  const token = localStorage.getItem(TECH_TOKEN_KEY);
  if (!token) {
    window.location.href = "/index.html";
    return;
  }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    // Gọi qua Gateway: http://localhost/api/...
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (response.status === 401) {
      localStorage.removeItem(TECH_TOKEN_KEY);
      window.location.href = "/index.html";
      return;
    }
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || data.message || "API Error");
    return data;
  } catch (error) {
    console.error("🚨 API Request Error:", error);
    throw error;
  }
}

// ==================== NAVIGATION ====================
function navigateToDashboardSection(sectionId, title) {
  document
    .querySelectorAll(".dashboard-section")
    .forEach((section) => section.classList.add("hidden"));
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove("hidden");
    document.getElementById("dashboard-title").textContent = title;
  }
  if (sectionId === "work-list-section") loadWorkList();
  else if (sectionId === "inventory-section") loadInventoryList();
}

// ==================== AUTH FUNCTIONS ====================
function checkAuth() {
  const token = localStorage.getItem(TECH_TOKEN_KEY);
  if (!token) {
    window.location.href = "/index.html";
    return false;
  }
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = `KTV: ${payload.sub || "User"}`;
    if (payload.role !== "technician") {
      showToast("Bạn không có quyền truy cập trang này", true);
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 2000);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Invalid token:", error);
    localStorage.removeItem(TECH_TOKEN_KEY);
    window.location.href = "/index.html";
    return false;
  }
}

function handleLogout() {
  localStorage.removeItem(TECH_TOKEN_KEY);
  showToast("Đăng xuất thành công!");
  setTimeout(() => {
    window.location.href = "/index.html";
  }, 1000);
}

// ==================== WORK LIST FUNCTIONS ====================
async function loadWorkList() {
  try {
    const tasks = await apiRequest("/api/maintenance/my-tasks", "GET");
    const tbody = document.getElementById("work-list-tbody");
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Không có công việc nào được phân công</td></tr>`;
      return;
    }

    tbody.innerHTML = tasks
      .map((task) => {
        const statusBadge = formatTaskStatus(task.status);
        // Dùng vehicle_vin và description để truyền vào modal AI suggestion
        const vehicleVin = task.vehicle_vin || 'N/A';
        const description = task.description || 'N/A';

        return `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-mono">#${task.task_id}</td>
            <td class="px-6 py-4 text-sm">Booking #${task.booking_id}</td>
            <td class="px-6 py-4 text-sm font-semibold">${vehicleVin}</td>
            <td class="px-6 py-4 text-sm">${description}</td>
            <td class="px-6 py-4 text-sm"><span class="px-2 py-1 text-xs rounded-full ${
              statusBadge.class
            }">${statusBadge.text}</span></td>
            <td class="px-6 py-4 text-sm space-x-2">
              ${
                task.status === "pending"
                  ? `<button onclick="updateTaskStatus(${task.task_id}, 'in_progress')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition">Bắt Đầu</button>`
                  : task.status === "in_progress"
                  ? `<div class="flex flex-col space-y-2">
                         <button onclick="openChecklistModal(${task.task_id})" class="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-xs transition flex items-center justify-center gap-1">📋 Checklist</button>
                         <button onclick="openAddPartsModal(${task.task_id}, '${vehicleVin}', '${description}')" class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs transition flex items-center justify-center gap-1">🔧 Phụ Tùng</button>
                         <button onclick="updateTaskStatus(${task.task_id}, 'completed')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs transition">✅ Hoàn Thành</button>
                       </div>`
                  : '<span class="text-gray-400 italic">Đã khóa</span>'
              }
            </td>
          </tr>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading work list:", error);
    showToast("Không thể tải danh sách công việc", true);
  }
}

function formatTaskStatus(status) {
  switch (status) {
    case "pending":
      return { text: "Chờ xử lý", class: "bg-yellow-100 text-yellow-800" };
    case "in_progress":
      return { text: "Đang làm", class: "bg-blue-100 text-blue-800" };
    case "completed":
      return { text: "Hoàn thành", class: "bg-green-100 text-green-800" };
    case "failed":
      return { text: "Thất bại", class: "bg-red-100 text-red-800" };
    default:
      return { text: status, class: "bg-gray-100 text-gray-800" };
  }
}

async function updateTaskStatus(taskId, newStatus) {
  const statusText = newStatus === "in_progress" ? "Đang làm" : "Hoàn thành";
  if (!confirm(`Xác nhận chuyển trạng thái sang "${statusText}"?`)) return;
  try {
    await apiRequest(`/api/maintenance/tasks/${taskId}/status`, "PUT", {
      status: newStatus,
    });
    showToast("Cập nhật trạng thái thành công!");
    loadWorkList();
  } catch (error) {
    showToast("Không thể cập nhật trạng thái", true);
  }
}

// ==================== INVENTORY FUNCTIONS ====================
async function loadInventoryList() {
  try {
    const items = await apiRequest("/api/inventory/items", "GET");
    const tbody = document.getElementById("inventory-tbody");
    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Kho trống</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map((item) => {
        const isLowStock = item.quantity <= item.min_quantity;
        return `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-mono text-gray-600">${
              item.part_number
            }</td>
            <td class="px-6 py-4 text-sm font-medium">${item.name}</td>
            <td class="px-6 py-4 text-sm ${
              isLowStock ? "text-red-600 font-bold" : ""
            }">${item.quantity}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${
              item.min_quantity
            }</td>
            <td class="px-6 py-4 text-sm">${item.price?.toLocaleString(
              "vi-VN"
            )} ₫</td>
            <td class="px-6 py-4 text-sm">
              <span class="px-2 py-1 text-xs rounded-full ${
                isLowStock
                  ? "bg-red-100 text-red-800"
                  : "bg-green-100 text-green-800"
              }">${isLowStock ? "Sắp hết" : "Đủ hàng"}</span>
            </td>
          </tr>`;
      })
      .join("");
  } catch (error) {
    showToast("Lỗi tải kho vật tư", true);
  }
}

// ==================== PARTS MODAL LOGIC ====================
let currentTaskId = null;
let availableInventoryItems = [];

async function openAddPartsModal(taskId, vehicleVin = null, description = null) {
  currentTaskId = taskId;
  document.getElementById("current-task-id-parts").textContent = taskId;
  document.getElementById("add-parts-modal").classList.remove("hidden");
  
  // Reset AI Suggestion
  const aiBox = document.getElementById("ai-suggestion-box");
  aiBox.classList.add("hidden");
  
  // Parallel loading
  await Promise.all([loadInventoryItemsForParts(), loadTaskParts(taskId)]);
  
  // AI Recommendation Logic
  if (vehicleVin && vehicleVin !== "N/A") {
    await loadAiSuggestions(vehicleVin, description);
  }
}
window.openAddPartsModal = openAddPartsModal;

async function loadAiSuggestions(vehicleVin, description) {
    const aiBox = document.getElementById("ai-suggestion-box");
    const aiList = document.getElementById("ai-suggestions-list");
    const vehicleInfo = document.getElementById("ai-vehicle-info");
    
    try {
        // Trích xuất Model từ VIN
        let vehicleModel = "";
        if (vehicleVin.includes("VF8")) vehicleModel = "VF8";
        else if (vehicleVin.includes("VF9")) vehicleModel = "VF9";
        else if (vehicleVin.includes("e34")) vehicleModel = "e34";
        else vehicleModel = "VF8"; // Default demo

        vehicleInfo.textContent = vehicleModel;

        // Guess category from description
        let category = null;
        const descLower = description ? description.toLowerCase() : "";
        if (descLower.includes("phanh") || descLower.includes("thắng")) category = "brake";
        else if (descLower.includes("lốp") || descLower.includes("bánh")) category = "tire";
        else if (descLower.includes("pin") || descLower.includes("sạc")) category = "battery";
        else if (descLower.includes("nhớt") || descLower.includes("lọc")) category = "filter";

        // Call API via Gateway!
        // Chú ý: Sử dụng apiRequest để đi qua Gateway
        const suggestions = await apiRequest("/api/inventory/suggest-parts", "POST", { 
            vehicle_model: vehicleModel, 
            category: category 
        });

        if (suggestions && suggestions.length > 0) {
            aiList.innerHTML = suggestions.map(item => 
                `<li class="cursor-pointer hover:underline flex justify-between items-center py-1 border-b border-blue-100 last:border-0" onclick="selectSuggestedPart(${item.id})">
                    <span><b>${item.name}</b> <span class="text-xs text-gray-500">(${item.part_number})</span></span>
                    <span class="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Kho: ${item.quantity}</span>
                </li>`
            ).join("");
            aiBox.classList.remove("hidden");
        } else {
             aiList.innerHTML = `<li class="text-xs text-gray-500 italic">Không có gợi ý phù hợp cho xe ${vehicleModel}.</li>`;
             aiBox.classList.remove("hidden");
        }
    } catch (e) {
        console.warn("AI Suggestion failed", e);
    }
}

window.selectSuggestedPart = function(itemId) {
    const select = document.getElementById("part-item-id");
    // Đảm bảo item tồn tại
    const itemExists = Array.from(select.options).some(opt => opt.value === String(itemId));

    if (itemExists) {
        select.value = itemId;
        // Kích hoạt sự kiện change để cập nhật giá trị max cho input quantity
        select.dispatchEvent(new Event('change')); 
        // Tạo hiệu ứng highlight
        select.classList.add("ring-2", "ring-blue-500");
        setTimeout(() => select.classList.remove("ring-2", "ring-blue-500"), 1000);
    } else {
        showToast("Phụ tùng gợi ý không tìm thấy trong danh sách kho", true);
    }
}

function closeAddPartsModal() {
  document.getElementById("add-parts-modal").classList.add("hidden");
  document.getElementById("add-part-form").reset();
  currentTaskId = null;
}
window.closeAddPartsModal = closeAddPartsModal;

async function loadInventoryItemsForParts() {
  try {
    const items = await apiRequest("/api/inventory/items", "GET");
    availableInventoryItems = items;
    const select = document.getElementById("part-item-id");
    select.innerHTML = '<option value="">-- Chọn phụ tùng --</option>';
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.name} (Tồn: ${
        item.quantity
      }) - ${item.price.toLocaleString()}₫`;
      opt.dataset.max = item.quantity;
      select.appendChild(opt);
    });
    
    // Tối ưu: Lọc giá trị max và tự động cập nhật số lượng
    select.onchange = function () {
      const selectedOpt = this.options[this.selectedIndex];
      if (!selectedOpt || !selectedOpt.dataset.max) return;
      
      const max = parseInt(selectedOpt.dataset.max);
      const qtyInput = document.getElementById("part-quantity");
      
      qtyInput.max = max;
      qtyInput.title = `Tối đa ${max}`;
      
      // Tự động điều chỉnh số lượng nếu vượt quá tồn kho
      if (parseInt(qtyInput.value) > max) {
          qtyInput.value = max;
      }
    };
  } catch (e) {
    console.error(e);
  }
}

async function loadTaskParts(taskId) {
  try {
    const parts = await apiRequest(
      `/api/maintenance/tasks/${taskId}/parts`,
      "GET"
    );
    const container = document.getElementById("added-parts-list");
    if (!parts || parts.length === 0) {
      container.innerHTML =
        '<p class="text-gray-500 text-sm text-center italic">Chưa có phụ tùng nào được thêm.</p>';
      return;
    }
    container.innerHTML = parts
      .map((p) => {
        const name =
          availableInventoryItems.find((i) => i.id === p.item_id)?.name ||
          `Item #${p.item_id}`;
        return `
            <div class="flex justify-between items-center bg-white border p-2 rounded shadow-sm mb-1">
                <div class="text-sm"><span class="font-medium text-gray-800">${name}</span><span class="text-gray-500 ml-2">x${p.quantity}</span></div>
                <button onclick="removeTaskPart(${p.id})" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">Xóa</button>
            </div>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
  }
}

window.removeTaskPart = async function (partId) {
  if (!confirm("Xóa phụ tùng này khỏi công việc?")) return;
  try {
    await apiRequest(`/api/maintenance/parts/${partId}`, "DELETE");
    showToast("Đã xóa phụ tùng");
    loadTaskParts(currentTaskId);
  } catch (e) {
    showToast("Lỗi xóa phụ tùng", true);
  }
};

document
  .getElementById("add-part-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const itemId = document.getElementById("part-item-id").value;
    const qty = document.getElementById("part-quantity").value;
    try {
      await apiRequest(
        `/api/maintenance/tasks/${currentTaskId}/parts`,
        "POST",
        { item_id: parseInt(itemId), quantity: parseInt(qty) }
      );
      showToast("Đã thêm phụ tùng!");
      loadTaskParts(currentTaskId);
      document.getElementById("add-part-form").reset();
    } catch (e) {
      showToast(e.message || "Lỗi thêm phụ tùng", true);
    }
  });

// ==================== CHECKLIST FUNCTIONS (NEW) ====================
let currentChecklistTaskId = null;

async function openChecklistModal(taskId) {
  currentChecklistTaskId = taskId;
  document.getElementById("checklist-task-id").textContent = taskId;
  document.getElementById("checklist-modal").classList.remove("hidden");
  await loadChecklist(taskId);
}
window.openChecklistModal = openChecklistModal;

function closeChecklistModal() {
  document.getElementById("checklist-modal").classList.add("hidden");
  currentChecklistTaskId = null;
}
window.closeChecklistModal = closeChecklistModal;

async function loadChecklist(taskId) {
  const tbody = document.getElementById("checklist-tbody");
  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center py-4">Đang tải dữ liệu...</td></tr>';
  try {
    const items = await apiRequest(
      `/api/maintenance/tasks/${taskId}/checklist`,
      "GET"
    );
    if (!items || items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center py-4">Chưa có checklist.</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map((item) => {
        const isPass = item.status === "pass";
        const isFail = item.status === "fail" || item.status === "needs_repair";
        return `
                <tr class="hover:bg-gray-50 transition-colors" id="checklist-row-${
                  item.id
                }">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${
                      item.item_name
                    }</td>
                    <td class="px-4 py-3">
                        <select id="status-${
                          item.id
                        }" class="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${
          isPass
            ? "bg-green-50 text-green-800"
            : isFail
            ? "bg-red-50 text-red-800"
            : ""
        }">
                            <option value="pending" ${
                              item.status === "pending" ? "selected" : ""
                            }>Chưa kiểm tra</option>
                            <option value="pass" ${
                              item.status === "pass" ? "selected" : ""
                            }>✅ Đạt (Pass)</option>
                            <option value="needs_repair" ${
                              item.status === "needs_repair" ? "selected" : ""
                            }>⚠️ Cần sửa chữa</option>
                            <option value="fail" ${
                              item.status === "fail" ? "selected" : ""
                            }>❌ Hỏng (Fail)</option>
                        </select>
                    </td>
                    <td class="px-4 py-3">
                        <input type="text" id="note-${item.id}" value="${
          item.note || ""
        }" placeholder="Ghi chú..." class="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="saveChecklistItem(${
                          item.id
                        })" class="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-xs px-3 py-1.5 focus:outline-none transition">Lưu</button>
                    </td>
                </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-red-500">Lỗi tải checklist.</td></tr>';
  }
}

window.saveChecklistItem = async function (itemId) {
  const status = document.getElementById(`status-${itemId}`).value;
  const note = document.getElementById(`note-${itemId}`).value;
  try {
    await apiRequest(`/api/maintenance/checklist/${itemId}`, "PUT", {
      status: status,
      note: note,
    });
    const row = document.getElementById(`checklist-row-${itemId}`);
    row.classList.add("bg-green-100");
    setTimeout(() => row.classList.remove("bg-green-100"), 500);
    showToast("Đã lưu mục kiểm tra!");
  } catch (e) {
    showToast("Lỗi khi lưu mục kiểm tra", true);
  }
};

// ====== DEMO DATA SEEDER ======
window.seedAiData = async function() {
    if (!confirm("Nạp dữ liệu mẫu AI (Má phanh, Lốp, Pin) vào kho?")) return;
    try {
        // Cần đảm bảo endpoint này có tồn tại trong inventory service controller
        await apiRequest("/api/inventory/seed-ai-data", "POST");
        showToast("✅ Đã nạp dữ liệu demo thành công! Hãy thử lại.");
    } catch (e) {
        showToast("Lỗi nạp dữ liệu demo", true);
    }
};

document.addEventListener("DOMContentLoaded", () => {
  if (checkAuth())
    navigateToDashboardSection("work-list-section", "Danh Sách Công Việc");
});