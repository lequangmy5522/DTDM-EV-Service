from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from models.staff_model import StaffPerformance, Staff, StaffAssignment
from datetime import datetime, timedelta
from sqlalchemy import func

performance_bp = Blueprint("performance", __name__, url_prefix="/api/performance")


@performance_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_performance():
    """Lấy báo cáo hiệu suất"""
    try:
        staff_id = request.args.get('staff_id', type=int)
        period_type = request.args.get('period_type')

        query = StaffPerformance.query

        if staff_id:
            query = query.filter(StaffPerformance.staff_id == staff_id)
        if period_type:
            query = query.filter(StaffPerformance.period_type == period_type)

        performances = query.order_by(StaffPerformance.period_start.desc()).all()

        return jsonify({
            "success": True,
            "performances": [p.to_dict() for p in performances],
            "count": len(performances)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@performance_bp.route("/staff/<int:staff_id>/current", methods=["GET"])
@jwt_required()
def get_staff_current_performance(staff_id):
    """Lấy hiệu suất tháng hiện tại của nhân viên"""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        # Calculate current month performance
        today = datetime.now().date()
        month_start = today.replace(day=1)

        # Get or create current month performance
        performance = StaffPerformance.query.filter_by(
            staff_id=staff_id,
            period_type='monthly',
            period_start=month_start
        ).first()

        if not performance:
            # Calculate from assignments
            month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

            assignments = StaffAssignment.query.filter(
                StaffAssignment.staff_id == staff_id,
                StaffAssignment.created_at >= datetime.combine(month_start, datetime.min.time()),
                StaffAssignment.created_at <= datetime.combine(month_end, datetime.max.time())
            ).all()

            tasks_assigned = len(assignments)
            tasks_completed = len([a for a in assignments if a.status == 'completed'])
            tasks_cancelled = len([a for a in assignments if a.status == 'cancelled'])

            # Calculate average completion time
            completed_with_duration = [a for a in assignments
                                      if a.status == 'completed' and a.actual_duration_minutes]
            avg_time = 0
            if completed_with_duration:
                avg_time = sum(a.actual_duration_minutes for a in completed_with_duration) / len(completed_with_duration)

            performance = StaffPerformance(
                staff_id=staff_id,
                period_type='monthly',
                period_start=month_start,
                period_end=month_end,
                tasks_assigned=tasks_assigned,
                tasks_completed=tasks_completed,
                tasks_cancelled=tasks_cancelled,
                avg_completion_time_minutes=avg_time
            )

            db.session.add(performance)
            db.session.commit()

        return jsonify({
            "success": True,
            "performance": performance.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@performance_bp.route("/", methods=["POST"])
@jwt_required()
def create_performance_record():
    """
    Tạo báo cáo hiệu suất thủ công

    Body:
    {
        "staff_id": 1,
        "period_type": "monthly",
        "period_start": "2025-12-01",
        "period_end": "2025-12-31",
        "manager_rating": 4.5,
        "manager_notes": "Làm việc xuất sắc"
    }
    """
    try:
        data = request.get_json()

        # Validate required fields
        required = ['staff_id', 'period_type', 'period_start', 'period_end']
        if not all(field in data for field in required):
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        performance = StaffPerformance(
            staff_id=data['staff_id'],
            period_type=data['period_type'],
            period_start=datetime.fromisoformat(data['period_start']).date(),
            period_end=datetime.fromisoformat(data['period_end']).date(),
            tasks_assigned=data.get('tasks_assigned', 0),
            tasks_completed=data.get('tasks_completed', 0),
            tasks_cancelled=data.get('tasks_cancelled', 0),
            avg_completion_time_minutes=data.get('avg_completion_time_minutes', 0),
            on_time_completion_rate=data.get('on_time_completion_rate', 0),
            customer_rating_avg=data.get('customer_rating_avg', 0),
            customer_rating_count=data.get('customer_rating_count', 0),
            manager_rating=data.get('manager_rating'),
            manager_notes=data.get('manager_notes'),
            total_work_hours=data.get('total_work_hours', 0),
            overtime_hours=data.get('overtime_hours', 0)
        )

        db.session.add(performance)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Performance record created successfully",
            "performance": performance.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@performance_bp.route("/<int:performance_id>", methods=["PUT"])
@jwt_required()
def update_performance_record(performance_id):
    """Cập nhật báo cáo hiệu suất"""
    try:
        performance = StaffPerformance.query.get(performance_id)
        if not performance:
            return jsonify({"success": False, "error": "Performance record not found"}), 404

        data = request.get_json()

        if 'manager_rating' in data:
            performance.manager_rating = data['manager_rating']
        if 'manager_notes' in data:
            performance.manager_notes = data['manager_notes']
        if 'total_work_hours' in data:
            performance.total_work_hours = data['total_work_hours']
        if 'overtime_hours' in data:
            performance.overtime_hours = data['overtime_hours']

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Performance record updated successfully",
            "performance": performance.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@performance_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_performance_dashboard():
    """
    Lấy dashboard tổng quan hiệu suất của tất cả nhân viên

    Returns:
    - Top performers
    - Average metrics
    - Trends
    """
    try:
        # Get current month
        today = datetime.now().date()
        month_start = today.replace(day=1)

        # Get all staff with their current month performance
        staff_list = Staff.query.filter_by(status='active').all()

        dashboard_data = []
        for staff in staff_list:
            performance = StaffPerformance.query.filter_by(
                staff_id=staff.id,
                period_type='monthly',
                period_start=month_start
            ).first()

            if performance:
                dashboard_data.append({
                    "staff": staff.to_dict(),
                    "performance": performance.to_dict()
                })

        # Sort by tasks completed
        dashboard_data.sort(key=lambda x: x['performance']['tasks_completed'], reverse=True)

        return jsonify({
            "success": True,
            "dashboard": dashboard_data,
            "period": f"{month_start.isoformat()}"
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
