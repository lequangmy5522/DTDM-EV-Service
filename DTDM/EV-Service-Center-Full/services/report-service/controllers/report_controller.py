from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from functools import wraps
from services.report_service import ReportService

report_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

def admin_required():
    """Decorator kiểm tra role admin"""
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") != "admin":
                return jsonify({"error": "Admin only"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# ==================== BÁO CÁO DOANH THU ====================

@report_bp.route("/revenue", methods=["GET"])
@admin_required()
def get_revenue_report():
    """
    GET /api/reports/revenue?start_date=2024-01-01&end_date=2024-01-31
    Báo cáo doanh thu trong khoảng thời gian
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    report, error = ReportService.get_revenue_report(start_date, end_date)
    
    if error:
        return jsonify({"error": error}), 500
    
    return jsonify(report), 200

# ==================== BÁO CÁO KHO ====================

@report_bp.route("/inventory", methods=["GET"])
@admin_required()
def get_inventory_report():
    """
    GET /api/reports/inventory
    Báo cáo tình trạng kho
    """
    report, error = ReportService.get_inventory_report()
    
    if error:
        return jsonify({"error": error}), 500
    
    return jsonify(report), 200

# ==================== DASHBOARD TỔNG QUAN ====================

@report_bp.route("/dashboard", methods=["GET"])
@admin_required()
def get_dashboard():
    """
    GET /api/reports/dashboard
    Dashboard tổng quan các metrics quan trọng
    """
    dashboard, error = ReportService.get_dashboard_overview()
    
    if error:
        return jsonify({"error": error}), 500
    
    return jsonify(dashboard), 200
