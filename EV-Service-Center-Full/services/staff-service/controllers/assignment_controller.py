from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from models.staff_model import Staff, StaffAssignment
from datetime import datetime

assignment_bp = Blueprint("assignments", __name__, url_prefix="/api/assignments")


@assignment_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_assignments():
    """Lấy danh sách phân công"""
    try:
        staff_id = request.args.get('staff_id', type=int)
        status = request.args.get('status')

        query = StaffAssignment.query

        if staff_id:
            query = query.filter(StaffAssignment.staff_id == staff_id)
        if status:
            query = query.filter(StaffAssignment.status == status)

        assignments = query.order_by(StaffAssignment.created_at.desc()).all()

        return jsonify({
            "success": True,
            "assignments": [a.to_dict() for a in assignments],
            "count": len(assignments)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment_detail(assignment_id):
    """Lấy chi tiết phân công"""
    try:
        assignment = StaffAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"success": False, "error": "Assignment not found"}), 404

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


@assignment_bp.route("/", methods=["POST"])
@jwt_required()
def create_assignment():
    """
    Phân công kỹ thuật viên cho công việc

    Body:
    {
        "staff_id": 1,
        "maintenance_task_id": 123,
        "priority": "high",
        "estimated_duration_minutes": 120,
        "notes": "Ưu tiên khách hàng VIP"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate required fields
        if 'staff_id' not in data or 'maintenance_task_id' not in data:
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Check if staff exists and is available
        staff = Staff.query.get(data['staff_id'])
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        if staff.status not in ['active']:
            return jsonify({"success": False, "error": "Staff is not available"}), 400

        # Check if task already assigned
        existing = StaffAssignment.query.filter_by(
            maintenance_task_id=data['maintenance_task_id'],
            status='assigned'
        ).first()

        if existing:
            return jsonify({"success": False, "error": "Task already assigned"}), 400

        assignment = StaffAssignment(
            staff_id=data['staff_id'],
            maintenance_task_id=data['maintenance_task_id'],
            assigned_by=current_user_id,
            priority=data.get('priority', 'medium'),
            estimated_duration_minutes=data.get('estimated_duration_minutes'),
            notes=data.get('notes'),
            status='assigned'
        )

        db.session.add(assignment)

        # Update staff status
        staff.status = 'busy'

        db.session.commit()

        # TODO: Send notification to staff via notification-service

        return jsonify({
            "success": True,
            "message": "Assignment created successfully",
            "assignment": assignment.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/<int:assignment_id>/accept", methods=["PUT"])
@jwt_required()
def accept_assignment(assignment_id):
    """Kỹ thuật viên chấp nhận công việc"""
    try:
        assignment = StaffAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"success": False, "error": "Assignment not found"}), 404

        assignment.status = 'accepted'
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Assignment accepted",
            "assignment": assignment.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/<int:assignment_id>/start", methods=["PUT"])
@jwt_required()
def start_assignment(assignment_id):
    """Bắt đầu làm việc"""
    try:
        assignment = StaffAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"success": False, "error": "Assignment not found"}), 404

        assignment.status = 'in_progress'
        assignment.started_at = datetime.now()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Assignment started",
            "assignment": assignment.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/<int:assignment_id>/complete", methods=["PUT"])
@jwt_required()
def complete_assignment(assignment_id):
    """
    Hoàn thành công việc

    Body:
    {
        "completion_notes": "Đã thay pin thành công"
    }
    """
    try:
        assignment = StaffAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"success": False, "error": "Assignment not found"}), 404

        data = request.get_json()

        assignment.status = 'completed'
        assignment.completed_at = datetime.now()
        assignment.completion_notes = data.get('completion_notes')

        # Calculate actual duration
        if assignment.started_at:
            duration = (assignment.completed_at - assignment.started_at).total_seconds() / 60
            assignment.actual_duration_minutes = int(duration)

        # Update staff status back to active
        staff = Staff.query.get(assignment.staff_id)
        if staff:
            staff.status = 'active'
            staff.total_tasks_completed += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Assignment completed",
            "assignment": assignment.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/<int:assignment_id>/cancel", methods=["PUT"])
@jwt_required()
def cancel_assignment(assignment_id):
    """Hủy phân công"""
    try:
        assignment = StaffAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"success": False, "error": "Assignment not found"}), 404

        assignment.status = 'cancelled'

        # Update staff status back to active
        staff = Staff.query.get(assignment.staff_id)
        if staff and staff.status == 'busy':
            staff.status = 'active'

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Assignment cancelled",
            "assignment": assignment.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/staff/<int:staff_id>/current", methods=["GET"])
@jwt_required()
def get_staff_current_assignment(staff_id):
    """Lấy công việc hiện tại của kỹ thuật viên"""
    try:
        assignment = StaffAssignment.query.filter_by(
            staff_id=staff_id,
            status='in_progress'
        ).first()

        if not assignment:
            return jsonify({
                "success": True,
                "assignment": None,
                "message": "No current assignment"
            }), 200

        return jsonify({
            "success": True,
            "assignment": assignment.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
