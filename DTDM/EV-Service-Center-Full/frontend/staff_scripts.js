// API Base URL
const API_URL = window.location.origin;

// Authentication
function checkAuth() {
  const token = localStorage.getItem("admin_jwt_token");
  console.log("Checking auth, token:", token ? "exists" : "not found");

  if (!token) {
    console.log("No token found, redirecting to admin.html");
    alert("Vui lòng đăng nhập trước khi truy cập Quản Lý Nhân Sự!");
    window.location.href = "admin.html";
    return false;
  }

  console.log("Auth check passed");
  return true;
}

function logout() {
  localStorage.removeItem("admin_jwt_token");
  window.location.href = "admin.html";
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  if (!checkAuth()) return;

  // Load user info
  const userInfo = JSON.parse(localStorage.getItem("user") || "{}");
  document.getElementById("user-info").textContent = `Xin chào, ${
    userInfo.full_name || "Admin"
  }`;

  // Load initial data
  loadStaff();
  loadAssignments();
  loadShifts();
  loadCertificates();
  loadPerformance();
  checkExpiringCertificates();
});

// Tab Switching
function switchTab(tabId) {
  // Remove active class from all tabs and sections
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelectorAll(".dashboard-section").forEach((section) => {
    section.classList.remove("active");
  });

  // Add active class to selected tab and section
  event.target.classList.add("active");
  document.getElementById(tabId).classList.add("active");

  // Reload data for the selected tab
  if (tabId === "staff-list") loadStaff();
  else if (tabId === "assignments") loadAssignments();
  else if (tabId === "shifts") loadShifts();
  else if (tabId === "certificates") loadCertificates();
  else if (tabId === "performance") loadPerformance();
}

// ===== STAFF MANAGEMENT =====

let allStaff = [];

async function loadStaff() {
  try {
    const role = document.getElementById("filter-role")?.value || "";
    const specialization =
      document.getElementById("filter-specialization")?.value || "";
    const status = document.getElementById("filter-status")?.value || "active";

    const params = new URLSearchParams();
    if (role) params.append("role", role);
    if (specialization) params.append("specialization", specialization);
    if (status) params.append("status", status);

    const response = await fetch(`${API_URL}/api/staff/?${params}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load staff");

    const data = await response.json();
    allStaff = data.staff || [];
    renderStaffTable(allStaff);
  } catch (error) {
    console.error("Error loading staff:", error);
    showNotification("Lỗi khi tải danh sách nhân viên", "error");
  }
}

function filterStaff() {
  loadStaff();
}

function renderStaffTable(staff) {
  const tbody = document.getElementById("staff-table-body");
  if (!tbody) return;

  if (staff.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-4 text-center text-gray-500">
          Không có nhân viên nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = staff
    .map(
      (s) => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${s.employee_code || "N/A"}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${s.full_name}</div>
        <div class="text-sm text-gray-500">${s.email}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatRole(s.role)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatSpecialization(s.specialization)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="status-badge status-${s.status}">
          ${formatStatus(s.status)}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${s.total_tasks_completed || 0}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ⭐ ${(s.average_rating || 0).toFixed(1)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button
          onclick="viewStaffDetail(${s.id})"
          class="text-indigo-600 hover:text-indigo-900 mr-3"
        >
          Chi tiết
        </button>
        <button
          onclick="editStaff(${s.id})"
          class="text-blue-600 hover:text-blue-900 mr-3"
        >
          Sửa
        </button>
        <button
          onclick="deleteStaff(${s.id})"
          class="text-red-600 hover:text-red-900"
        >
          Xóa
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

function openAddStaffModal() {
  const modal = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="staff-modal">
      <div class="relative top-20 mx-auto p-8 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Thêm Nhân Viên Mới</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <form id="add-staff-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Họ Tên *</label>
              <input type="text" name="full_name" required
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" name="email" required
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Số Điện Thoại</label>
              <input type="tel" name="phone"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Mã Nhân Viên</label>
              <input type="text" name="employee_code"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Vai Trò *</label>
              <select name="role" required
                class="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="technician">Kỹ thuật viên</option>
                <option value="senior_technician">Kỹ thuật viên chính</option>
                <option value="team_leader">Trưởng nhóm</option>
                <option value="manager">Quản lý</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Chuyên Môn *</label>
              <select name="specialization" required
                class="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="general">Tổng hợp</option>
                <option value="ev_specialist">Chuyên gia EV</option>
                <option value="battery_expert">Chuyên gia Pin</option>
                <option value="electrical_systems">Hệ thống điện</option>
                <option value="mechanical_systems">Hệ thống cơ khí</option>
                <option value="diagnostics">Chẩn đoán</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ngày Vào Làm</label>
              <input type="date" name="hire_date"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phòng Ban</label>
              <input type="text" name="department"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div class="flex justify-end space-x-3 mt-6">
            <button type="button" onclick="closeModal()"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Thêm Nhân Viên
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("modal-container").innerHTML = modal;

  document
    .getElementById("add-staff-form")
    .addEventListener("submit", handleAddStaff);
}

async function handleAddStaff(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch(`${API_URL}/api/staff/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to add staff");

    showNotification("Thêm nhân viên thành công!", "success");
    closeModal();
    loadStaff();
  } catch (error) {
    console.error("Error adding staff:", error);
    showNotification("Lỗi khi thêm nhân viên", "error");
  }
}

async function viewStaffDetail(staffId) {
  try {
    const response = await fetch(`${API_URL}/api/staff/${staffId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load staff detail");

    const data = await response.json();
    const staff = data.staff;

    const modal = `
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="detail-modal">
        <div class="relative top-10 mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-lg bg-white">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold">Chi Tiết Nhân Viên</h3>
            <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 class="font-semibold text-gray-700 mb-3">Thông Tin Cá Nhân</h4>
              <div class="space-y-2">
                <p><span class="font-medium">Mã NV:</span> ${staff.employee_code || "N/A"}</p>
                <p><span class="font-medium">Họ Tên:</span> ${staff.full_name}</p>
                <p><span class="font-medium">Email:</span> ${staff.email}</p>
                <p><span class="font-medium">SĐT:</span> ${staff.phone || "N/A"}</p>
                <p><span class="font-medium">Vai trò:</span> ${formatRole(staff.role)}</p>
                <p><span class="font-medium">Chuyên môn:</span> ${formatSpecialization(staff.specialization)}</p>
                <p><span class="font-medium">Trạng thái:</span> <span class="status-badge status-${staff.status}">${formatStatus(staff.status)}</span></p>
              </div>
            </div>
            <div>
              <h4 class="font-semibold text-gray-700 mb-3">Hiệu Suất</h4>
              <div class="space-y-2">
                <p><span class="font-medium">Tasks hoàn thành:</span> ${staff.total_tasks_completed || 0}</p>
                <p><span class="font-medium">Đánh giá trung bình:</span> ⭐ ${(staff.average_rating || 0).toFixed(1)}</p>
                <p><span class="font-medium">Ngày vào làm:</span> ${staff.hire_date || "N/A"}</p>
                <p><span class="font-medium">Phòng ban:</span> ${staff.department || "N/A"}</p>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h4 class="font-semibold text-gray-700 mb-3">Chứng Chỉ (${staff.certificates?.length || 0})</h4>
            <div class="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
              ${
                staff.certificates && staff.certificates.length > 0
                  ? staff.certificates
                      .map(
                        (cert) => `
                <div class="bg-white p-3 rounded mb-2">
                  <p class="font-medium">${cert.certificate_name}</p>
                  <p class="text-sm text-gray-600">Hết hạn: ${cert.expiry_date || "N/A"}</p>
                </div>
              `
                      )
                      .join("")
                  : '<p class="text-gray-500">Chưa có chứng chỉ</p>'
              }
            </div>
          </div>

          <div class="flex justify-end">
            <button onclick="closeModal()" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("modal-container").innerHTML = modal;
  } catch (error) {
    console.error("Error loading staff detail:", error);
    showNotification("Lỗi khi tải chi tiết nhân viên", "error");
  }
}

async function deleteStaff(staffId) {
  if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

  try {
    const response = await fetch(`${API_URL}/api/staff/${staffId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to delete staff");

    showNotification("Xóa nhân viên thành công!", "success");
    loadStaff();
  } catch (error) {
    console.error("Error deleting staff:", error);
    showNotification("Lỗi khi xóa nhân viên", "error");
  }
}

// ===== ASSIGNMENTS =====

async function loadAssignments() {
  try {
    const response = await fetch(`${API_URL}/api/assignments/`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load assignments");

    const data = await response.json();
    renderAssignmentsTable(data.assignments || []);
  } catch (error) {
    console.error("Error loading assignments:", error);
    showNotification("Lỗi khi tải danh sách phân công", "error");
  }
}

function renderAssignmentsTable(assignments) {
  const tbody = document.getElementById("assignments-table-body");
  if (!tbody) return;

  if (assignments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-gray-500">
          Chưa có phân công nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = assignments
    .map(
      (a) => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#${a.id}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        Staff #${a.staff_id}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        Task #${a.maintenance_task_id}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded ${
          a.priority === "urgent"
            ? "bg-red-100 text-red-800"
            : a.priority === "high"
            ? "bg-orange-100 text-orange-800"
            : "bg-blue-100 text-blue-800"
        }">
          ${a.priority}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded ${
          a.status === "completed"
            ? "bg-green-100 text-green-800"
            : a.status === "in_progress"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-800"
        }">
          ${a.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${new Date(a.assigned_at).toLocaleString("vi-VN")}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        ${
          a.status === "assigned"
            ? `<button onclick="cancelAssignment(${a.id})" class="text-red-600 hover:text-red-900">Hủy</button>`
            : "-"
        }
      </td>
    </tr>
  `
    )
    .join("");
}

function openAssignTaskModal() {
  const modal = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="assign-modal">
      <div class="relative top-20 mx-auto p-8 border w-full max-w-lg shadow-lg rounded-lg bg-white">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Phân Công Công Việc</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <form id="assign-task-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nhân Viên *</label>
            <select name="staff_id" required id="assign-staff-select"
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Chọn nhân viên...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Task ID *</label>
            <input type="number" name="maintenance_task_id" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ưu Tiên</label>
            <select name="priority"
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Thời Gian Ước Tính (phút)</label>
            <input type="number" name="estimated_duration_minutes"
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ghi Chú</label>
            <textarea name="notes" rows="3"
              class="w-full border border-gray-300 rounded-lg px-3 py-2"></textarea>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" onclick="closeModal()"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Phân Công
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("modal-container").innerHTML = modal;

  // Load available staff
  loadAvailableStaff();

  document
    .getElementById("assign-task-form")
    .addEventListener("submit", handleAssignTask);
}

async function loadAvailableStaff() {
  try {
    const response = await fetch(`${API_URL}/api/staff/?status=active`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    const select = document.getElementById("assign-staff-select");
    if (select) {
      select.innerHTML =
        '<option value="">Chọn nhân viên...</option>' +
        data.staff
          .map(
            (s) =>
              `<option value="${s.id}">${s.full_name} - ${formatSpecialization(
                s.specialization
              )}</option>`
          )
          .join("");
    }
  } catch (error) {
    console.error("Error loading available staff:", error);
  }
}

async function handleAssignTask(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch(`${API_URL}/api/assignments/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to assign task");

    showNotification("Phân công thành công!", "success");
    closeModal();
    loadAssignments();
  } catch (error) {
    console.error("Error assigning task:", error);
    showNotification("Lỗi khi phân công công việc", "error");
  }
}

async function cancelAssignment(assignmentId) {
  if (!confirm("Bạn có chắc muốn hủy phân công này?")) return;

  try {
    const response = await fetch(
      `${API_URL}/api/assignments/${assignmentId}/cancel`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
        },
      }
    );

    if (!response.ok) throw new Error("Failed to cancel assignment");

    showNotification("Hủy phân công thành công!", "success");
    loadAssignments();
  } catch (error) {
    console.error("Error canceling assignment:", error);
    showNotification("Lỗi khi hủy phân công", "error");
  }
}

// ===== SHIFTS =====

async function loadShifts() {
  try {
    const response = await fetch(`${API_URL}/api/shifts/`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load shifts");

    const data = await response.json();
    renderShiftsTable(data.shifts || []);
  } catch (error) {
    console.error("Error loading shifts:", error);
    showNotification("Lỗi khi tải lịch làm việc", "error");
  }
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById("shifts-table-body");
  if (!tbody) return;

  if (shifts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
          Chưa có ca làm việc nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = shifts
    .map(
      (s) => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        Staff #${s.staff_id}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${new Date(s.shift_date).toLocaleDateString("vi-VN")}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatShiftType(s.shift_type)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${s.start_time} - ${s.end_time}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded ${
          s.status === "completed"
            ? "bg-green-100 text-green-800"
            : s.status === "in_progress"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-800"
        }">
          ${s.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="editShift(${s.id})" class="text-blue-600 hover:text-blue-900 mr-3">
          Sửa
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

function openAddShiftModal() {
  const modal = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="shift-modal">
      <div class="relative top-20 mx-auto p-8 border w-full max-w-lg shadow-lg rounded-lg bg-white">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Tạo Ca Làm Việc</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <form id="add-shift-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nhân Viên *</label>
            <select name="staff_id" required id="shift-staff-select"
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Chọn nhân viên...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày *</label>
            <input type="date" name="shift_date" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ca Làm Việc *</label>
            <select name="shift_type" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="morning">Sáng (8h-12h)</option>
              <option value="afternoon">Chiều (13h-17h)</option>
              <option value="night">Tối (18h-22h)</option>
              <option value="full_day">Cả ngày (8h-17h)</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Giờ Bắt Đầu *</label>
              <input type="time" name="start_time" required value="08:00"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Giờ Kết Thúc *</label>
              <input type="time" name="end_time" required value="17:00"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ghi Chú</label>
            <textarea name="notes" rows="3"
              class="w-full border border-gray-300 rounded-lg px-3 py-2"></textarea>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" onclick="closeModal()"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Tạo Ca
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("modal-container").innerHTML = modal;

  // Load staff list
  loadStaffForSelect("shift-staff-select");

  document
    .getElementById("add-shift-form")
    .addEventListener("submit", handleAddShift);
}

async function handleAddShift(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch(`${API_URL}/api/shifts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to create shift");

    showNotification("Tạo ca làm việc thành công!", "success");
    closeModal();
    loadShifts();
  } catch (error) {
    console.error("Error creating shift:", error);
    showNotification("Lỗi khi tạo ca làm việc", "error");
  }
}

// ===== CERTIFICATES =====

async function loadCertificates() {
  try {
    const response = await fetch(`${API_URL}/api/certificates/`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load certificates");

    const data = await response.json();
    renderCertificatesTable(data.certificates || []);
  } catch (error) {
    console.error("Error loading certificates:", error);
    showNotification("Lỗi khi tải danh sách chứng chỉ", "error");
  }
}

async function checkExpiringCertificates() {
  try {
    const response = await fetch(`${API_URL}/api/certificates/expiring-soon`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data.count > 0) {
      document.getElementById("expiring-alert").classList.remove("hidden");
      document.getElementById("expiring-count").textContent = data.count;
    }
  } catch (error) {
    console.error("Error checking expiring certificates:", error);
  }
}

function renderCertificatesTable(certificates) {
  const tbody = document.getElementById("certificates-table-body");
  if (!tbody) return;

  if (certificates.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-gray-500">
          Chưa có chứng chỉ nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = certificates
    .map(
      (c) => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        Staff #${c.staff_id}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${c.certificate_name}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatCertificateType(c.certificate_type)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${c.issued_date || "N/A"}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${c.expiry_date || "N/A"}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded ${
          c.status === "valid"
            ? "bg-green-100 text-green-800"
            : c.status === "expired"
            ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800"
        }">
          ${c.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="deleteCertificate(${c.id})" class="text-red-600 hover:text-red-900">
          Xóa
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

function openAddCertificateModal() {
  const modal = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="cert-modal">
      <div class="relative top-20 mx-auto p-8 border w-full max-w-lg shadow-lg rounded-lg bg-white">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Thêm Chứng Chỉ</h3>
          <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <form id="add-cert-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nhân Viên *</label>
            <select name="staff_id" required id="cert-staff-select"
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Chọn nhân viên...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tên Chứng Chỉ *</label>
            <input type="text" name="certificate_name" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Loại Chứng Chỉ *</label>
            <select name="certificate_type" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="ev_certification">EV Certification</option>
              <option value="battery_safety">Battery Safety</option>
              <option value="electrical_engineering">Electrical Engineering</option>
              <option value="mechanical_engineering">Mechanical Engineering</option>
              <option value="diagnostic_tools">Diagnostic Tools</option>
              <option value="safety_training">Safety Training</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ngày Cấp</label>
              <input type="date" name="issued_date"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ngày Hết Hạn</label>
              <input type="date" name="expiry_date"
                class="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tổ Chức Cấp</label>
            <input type="text" name="issuing_organization"
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số Chứng Chỉ</label>
            <input type="text" name="certificate_number"
              class="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" onclick="closeModal()"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Thêm Chứng Chỉ
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("modal-container").innerHTML = modal;

  // Load staff list
  loadStaffForSelect("cert-staff-select");

  document
    .getElementById("add-cert-form")
    .addEventListener("submit", handleAddCertificate);
}

async function handleAddCertificate(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch(`${API_URL}/api/certificates/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to add certificate");

    showNotification("Thêm chứng chỉ thành công!", "success");
    closeModal();
    loadCertificates();
    checkExpiringCertificates();
  } catch (error) {
    console.error("Error adding certificate:", error);
    showNotification("Lỗi khi thêm chứng chỉ", "error");
  }
}

async function deleteCertificate(certId) {
  if (!confirm("Bạn có chắc muốn xóa chứng chỉ này?")) return;

  try {
    const response = await fetch(`${API_URL}/api/certificates/${certId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to delete certificate");

    showNotification("Xóa chứng chỉ thành công!", "success");
    loadCertificates();
  } catch (error) {
    console.error("Error deleting certificate:", error);
    showNotification("Lỗi khi xóa chứng chỉ", "error");
  }
}

// ===== PERFORMANCE =====

async function loadPerformance() {
  try {
    const response = await fetch(`${API_URL}/api/performance/dashboard`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load performance");

    const data = await response.json();
    renderPerformanceDashboard(data.dashboard || []);
  } catch (error) {
    console.error("Error loading performance:", error);
    showNotification("Lỗi khi tải hiệu suất", "error");
  }
}

function renderPerformanceDashboard(dashboard) {
  // Calculate summary stats
  const activeStaff = dashboard.length;
  const totalTasks = dashboard.reduce(
    (sum, d) => sum + (d.performance?.tasks_completed || 0),
    0
  );
  const avgRating =
    dashboard.reduce(
      (sum, d) => sum + (d.performance?.customer_rating_avg || 0),
      0
    ) / (dashboard.length || 1);

  document.getElementById("total-active-staff").textContent = activeStaff;
  document.getElementById("total-tasks-month").textContent = totalTasks;
  document.getElementById("avg-rating").textContent = avgRating.toFixed(1);

  // Top performers (top 3)
  const topPerformers = [...dashboard]
    .sort(
      (a, b) =>
        (b.performance?.tasks_completed || 0) -
        (a.performance?.tasks_completed || 0)
    )
    .slice(0, 3);

  const topPerformersHtml = topPerformers
    .map(
      (p, index) => `
    <div class="bg-white border-2 ${
      index === 0 ? "border-yellow-400" : "border-gray-200"
    } rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold">${index + 1}. ${p.staff?.full_name}</p>
          <p class="text-sm text-gray-600">${formatRole(p.staff?.role)}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-indigo-600">${
            p.performance?.tasks_completed || 0
          }</p>
          <p class="text-xs text-gray-500">tasks</p>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  document.getElementById("top-performers").innerHTML =
    topPerformersHtml ||
    '<p class="text-gray-500">Chưa có dữ liệu hiệu suất</p>';

  // Performance table
  renderPerformanceTable(dashboard);
}

function renderPerformanceTable(dashboard) {
  const tbody = document.getElementById("performance-table-body");
  if (!tbody) return;

  if (dashboard.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
          Chưa có dữ liệu hiệu suất
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = dashboard
    .map(
      (d) => `
    <tr>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${d.staff?.full_name}</div>
        <div class="text-sm text-gray-500">${formatRole(d.staff?.role)}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${d.performance?.tasks_assigned || 0}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${d.performance?.tasks_completed || 0}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${
          d.performance?.tasks_assigned > 0
            ? (
                ((d.performance?.tasks_completed || 0) /
                  d.performance.tasks_assigned) *
                100
              ).toFixed(1)
            : 0
        }%
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${(d.performance?.avg_completion_time_minutes || 0).toFixed(0)} phút
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ⭐ ${(d.performance?.customer_rating_avg || 0).toFixed(1)}
      </td>
    </tr>
  `
    )
    .join("");
}

// ===== HELPER FUNCTIONS =====

async function loadStaffForSelect(selectId) {
  try {
    const response = await fetch(`${API_URL}/api/staff/?status=active`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_jwt_token")}`,
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML =
        '<option value="">Chọn nhân viên...</option>' +
        data.staff
          .map(
            (s) => `<option value="${s.id}">${s.full_name} (${s.employee_code || ""})</option>`
          )
          .join("");
    }
  } catch (error) {
    console.error("Error loading staff for select:", error);
  }
}

function closeModal() {
  document.getElementById("modal-container").innerHTML = "";
}

function showNotification(message, type = "info") {
  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-blue-500";

  const notification = document.createElement("div");
  notification.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Format helpers
function formatRole(role) {
  const roles = {
    technician: "Kỹ thuật viên",
    senior_technician: "Kỹ thuật viên chính",
    team_leader: "Trưởng nhóm",
    manager: "Quản lý",
    admin: "Quản trị viên",
  };
  return roles[role] || role;
}

function formatSpecialization(spec) {
  const specs = {
    ev_specialist: "Chuyên gia EV",
    battery_expert: "Chuyên gia Pin",
    electrical_systems: "Hệ thống điện",
    mechanical_systems: "Hệ thống cơ khí",
    diagnostics: "Chẩn đoán",
    general: "Tổng hợp",
  };
  return specs[spec] || spec;
}

function formatStatus(status) {
  const statuses = {
    active: "Hoạt động",
    busy: "Đang bận",
    on_leave: "Nghỉ phép",
    resigned: "Đã nghỉ việc",
  };
  return statuses[status] || status;
}

function formatShiftType(type) {
  const types = {
    morning: "Sáng",
    afternoon: "Chiều",
    night: "Tối",
    full_day: "Cả ngày",
  };
  return types[type] || type;
}

function formatCertificateType(type) {
  const types = {
    ev_certification: "Chứng chỉ EV",
    battery_safety: "An toàn Pin",
    electrical_engineering: "Kỹ thuật điện",
    mechanical_engineering: "Kỹ thuật cơ khí",
    diagnostic_tools: "Công cụ chẩn đoán",
    safety_training: "Đào tạo an toàn",
    other: "Khác",
  };
  return types[type] || type;
}
