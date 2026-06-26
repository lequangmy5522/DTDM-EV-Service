"""
Internal API Controller for Maintenance Service
Được gọi bởi các service khác (notification-service)
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from functools import wraps

from services.maintenance_service import MaintenanceService as service

internal_bp = Blueprint("internal", __name__, url_prefix="/internal/maintenance")


def internal_token_required(f):
    """Decorator to verify internal service token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Internal-Token')
        expected_token = current_app.config.get('INTERNAL_SERVICE_TOKEN')

        if not token or token != expected_token:
            return jsonify({
                "success": False,
                "error": "Unauthorized - Invalid internal token"
            }), 401

        return f(*args, **kwargs)
    return decorated_function


@internal_bp.route("/due-soon", methods=["GET"])
@internal_token_required
def get_maintenance_due_soon():
    """
    Lấy danh sách xe/task cần bảo dưỡng sớm

    Logic nhắc nhở:
    - Nhắc trước 7 ngày nếu có scheduled_date
    - Nhắc khi gần hoàn thành task (status = in_progress và sắp xong)

    Returns:
        {
            "success": true,
            "maintenances": [
                {
                    "id": 1,
                    "user_id": 123,
                    "vehicle_info": {
                        "license_plate": "30A-12345",
                        "brand": "VinFast",
                        "model": "VF8"
                    },
                    "due_date": "2025-12-01T00:00:00",
                    "task_type": "Bảo dưỡng định kỳ",
                    "description": "Kiểm tra hệ thống điện"
                }
            ]
        }
    """
    try:
        # Tính ngày nhắc nhở (7 ngày trước)
        remind_date = datetime.now() + timedelta(days=7)

        maintenances = []

        # Lấy tất cả tasks có scheduled_date trong 7 ngày tới
        all_tasks = service.get_all_tasks()  # Giả sử có method này

        for task in all_tasks:
            # Chỉ nhắc cho tasks chưa hoàn thành
            if task.status in ['completed', 'cancelled']:
                continue

            # Kiểm tra scheduled_date
            if task.scheduled_date:
                scheduled = datetime.fromisoformat(str(task.scheduled_date)) if isinstance(task.scheduled_date, str) else task.scheduled_date

                # Nhắc nếu trong vòng 7 ngày tới
                if datetime.now() <= scheduled <= remind_date:
                    maintenances.append({
                        "id": task.id,
                        "user_id": task.user_id,
                        "vehicle_info": {
                            "license_plate": task.license_plate or "N/A",
                            "brand": task.brand or "N/A",
                            "model": task.model or "N/A"
                        },
                        "due_date": scheduled.isoformat(),
                        "task_type": task.task_type or "Bảo dưỡng",
                        "description": task.description or "Kiểm tra định kỳ",
                        "status": task.status
                    })

        return jsonify({
            "success": True,
            "maintenances": maintenances,
            "count": len(maintenances)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in get_maintenance_due_soon: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@internal_bp.route("/task/<int:task_id>/info", methods=["GET"])
@internal_token_required
def get_task_info(task_id):
    """
    Lấy thông tin chi tiết của một task (cho notification service)

    Args:
        task_id: ID của maintenance task

    Returns:
        Task information
    """
    try:
        task = service.get_task_by_id(task_id)

        if not task:
            return jsonify({
                "success": False,
                "error": "Task not found"
            }), 404

        return jsonify({
            "success": True,
            "task": {
                "id": task.id,
                "user_id": task.user_id,
                "technician_id": task.technician_id,
                "license_plate": task.license_plate,
                "brand": task.brand,
                "model": task.model,
                "task_type": task.task_type,
                "description": task.description,
                "status": task.status,
                "priority": task.priority,
                "scheduled_date": task.scheduled_date.isoformat() if task.scheduled_date else None,
                "completed_date": task.completed_date.isoformat() if task.completed_date else None,
                "created_at": task.created_at.isoformat() if task.created_at else None
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in get_task_info: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@internal_bp.route("/technician/<int:technician_id>/stats", methods=["GET"])
@internal_token_required
def get_technician_stats(technician_id):
    """
    Lấy thống kê tasks của technician

    Args:
        technician_id: ID của technician (user_id)

    Returns:
        {
            "success": true,
            "stats": {
                "total_tasks": 10,
                "completed_tasks": 8,
                "in_progress_tasks": 2,
                "completion_rate": 80.0
            }
        }
    """
    try:
        all_tasks = service.get_all_tasks()

        # Filter tasks by technician_id
        tech_tasks = [t for t in all_tasks if t.technician_id == technician_id]

        total = len(tech_tasks)
        completed = len([t for t in tech_tasks if t.status == 'completed'])
        in_progress = len([t for t in tech_tasks if t.status == 'in_progress'])

        completion_rate = (completed / total * 100) if total > 0 else 0.0

        return jsonify({
            "success": True,
            "stats": {
                "total_tasks": total,
                "completed_tasks": completed,
                "in_progress_tasks": in_progress,
                "pending_tasks": total - completed - in_progress,
                "completion_rate": round(completion_rate, 2)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in get_technician_stats: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@internal_bp.route("/health", methods=["GET"])
def internal_health():
    """Health check for internal API"""
    return jsonify({
        "success": True,
        "service": "maintenance-internal",
        "status": "healthy"
    }), 200
