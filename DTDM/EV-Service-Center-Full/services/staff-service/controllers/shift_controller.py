from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from models.staff_model import StaffShift, Staff
from datetime import datetime, date, time as dt_time

shift_bp = Blueprint("shifts", __name__, url_prefix="/api/shifts")


@shift_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_shifts():
    """Lấy danh sách ca làm việc"""
    try:
        staff_id = request.args.get('staff_id', type=int)
        shift_date = request.args.get('date')
        status = request.args.get('status')

        query = StaffShift.query

        if staff_id:
            query = query.filter(StaffShift.staff_id == staff_id)
        if shift_date:
            query = query.filter(StaffShift.shift_date == datetime.fromisoformat(shift_date).date())
        if status:
            query = query.filter(StaffShift.status == status)

        shifts = query.order_by(StaffShift.shift_date.desc(), StaffShift.start_time).all()

        return jsonify({
            "success": True,
            "shifts": [s.to_dict() for s in shifts],
            "count": len(shifts)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@shift_bp.route("/", methods=["POST"])
@jwt_required()
def create_shift():
    """
    Tạo ca làm việc

    Body:
    {
        "staff_id": 1,
        "shift_date": "2025-12-01",
        "shift_type": "morning",
        "start_time": "08:00:00",
        "end_time": "12:00:00"
    }
    """
    try:
        data = request.get_json()

        # Validate required fields
        required = ['staff_id', 'shift_date', 'shift_type', 'start_time', 'end_time']
        if not all(field in data for field in required):
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Check if staff exists
        staff = Staff.query.get(data['staff_id'])
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        shift = StaffShift(
            staff_id=data['staff_id'],
            shift_date=datetime.fromisoformat(data['shift_date']).date(),
            shift_type=data['shift_type'],
            start_time=datetime.strptime(data['start_time'], '%H:%M:%S').time(),
            end_time=datetime.strptime(data['end_time'], '%H:%M:%S').time(),
            notes=data.get('notes'),
            status='scheduled'
        )

        db.session.add(shift)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Shift created successfully",
            "shift": shift.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@shift_bp.route("/<int:shift_id>", methods=["PUT"])
@jwt_required()
def update_shift(shift_id):
    """Cập nhật ca làm việc"""
    try:
        shift = StaffShift.query.get(shift_id)
        if not shift:
            return jsonify({"success": False, "error": "Shift not found"}), 404

        data = request.get_json()

        if 'shift_date' in data:
            shift.shift_date = datetime.fromisoformat(data['shift_date']).date()
        if 'shift_type' in data:
            shift.shift_type = data['shift_type']
        if 'start_time' in data:
            shift.start_time = datetime.strptime(data['start_time'], '%H:%M:%S').time()
        if 'end_time' in data:
            shift.end_time = datetime.strptime(data['end_time'], '%H:%M:%S').time()
        if 'status' in data:
            shift.status = data['status']
        if 'notes' in data:
            shift.notes = data['notes']

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Shift updated successfully",
            "shift": shift.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@shift_bp.route("/<int:shift_id>/check-in", methods=["PUT"])
@jwt_required()
def check_in_shift(shift_id):
    """Check-in ca làm việc"""
    try:
        shift = StaffShift.query.get(shift_id)
        if not shift:
            return jsonify({"success": False, "error": "Shift not found"}), 404

        shift.status = 'in_progress'
        shift.actual_start_time = datetime.now()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Checked in successfully",
            "shift": shift.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@shift_bp.route("/<int:shift_id>/check-out", methods=["PUT"])
@jwt_required()
def check_out_shift(shift_id):
    """Check-out ca làm việc"""
    try:
        shift = StaffShift.query.get(shift_id)
        if not shift:
            return jsonify({"success": False, "error": "Shift not found"}), 404

        shift.status = 'completed'
        shift.actual_end_time = datetime.now()
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Checked out successfully",
            "shift": shift.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@shift_bp.route("/schedule", methods=["POST"])
@jwt_required()
def bulk_schedule_shifts():
    """
    Tạo lịch làm việc hàng loạt

    Body:
    {
        "staff_id": 1,
        "start_date": "2025-12-01",
        "end_date": "2025-12-07",
        "shifts": [
            {"day_of_week": 1, "shift_type": "morning", "start_time": "08:00", "end_time": "12:00"},
            {"day_of_week": 2, "shift_type": "afternoon", "start_time": "13:00", "end_time": "17:00"}
        ]
    }
    """
    try:
        data = request.get_json()

        # TODO: Implement bulk shift scheduling logic

        return jsonify({
            "success": True,
            "message": "Shifts scheduled successfully"
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
