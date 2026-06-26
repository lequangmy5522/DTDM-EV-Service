from flask import Blueprint, request, jsonify, current_app
from app import db
from models.staff_model import Staff, StaffAssignment

internal_bp = Blueprint("internal_staff", __name__, url_prefix="/internal/staff")


@internal_bp.before_request
def verify_internal_token():
    """Xác thực Internal Service Token"""
    token = request.headers.get("X-Internal-Token")
    expected_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")

    if not token or token != expected_token:
        return jsonify({"error": "Unauthorized internal request"}), 401


@internal_bp.route("/available", methods=["GET"])
def get_available_staff_internal():
    """
    Lấy danh sách kỹ thuật viên có sẵn (cho maintenance-service)

    Query params:
    - specialization: Chuyên môn yêu cầu
    - date: Ngày cần check
    """
    try:
        specialization = request.args.get('specialization')

        query = Staff.query.filter(Staff.status == 'active')

        if specialization:
            query = query.filter(Staff.specialization == specialization)

        staff_list = query.all()

        return jsonify({
            "success": True,
            "staff": [s.to_dict() for s in staff_list],
            "count": len(staff_list)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@internal_bp.route("/<int:staff_id>", methods=["GET"])
def get_staff_info_internal(staff_id):
    """Lấy thông tin nhân viên (cho các service khác)"""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        return jsonify({
            "success": True,
            "staff": staff.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@internal_bp.route("/assignment/task/<int:task_id>", methods=["GET"])
def get_assignment_by_task(task_id):
    """
    Lấy thông tin phân công theo maintenance task
    (cho maintenance-service check xem task đã assign chưa)
    """
    try:
        assignment = StaffAssignment.query.filter_by(
            maintenance_task_id=task_id
        ).first()

        if not assignment:
            return jsonify({
                "success": True,
                "assignment": None,
                "message": "No assignment found"
            }), 200

        assignment_data = assignment.to_dict()

        # Include staff info
        if assignment.staff:
            assignment_data['staff_info'] = assignment.staff.to_dict()

        return jsonify({
            "success": True,
            "assignment": assignment_data
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@internal_bp.route("/health", methods=["GET"])
def internal_health():
    """Health check for internal API"""
    return jsonify({
        "success": True,
        "service": "staff-internal",
        "status": "healthy"
    }), 200
