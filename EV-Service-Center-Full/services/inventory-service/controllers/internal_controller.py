from flask import Blueprint, request, jsonify, current_app
from services.inventory_service import InventoryService

internal_bp = Blueprint("internal_inventory", __name__, url_prefix="/internal/parts")

@internal_bp.before_request
def verify_internal_token():
    """Xác thực Internal Service Token"""
    token = request.headers.get("X-Internal-Token")
    expected_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
    
    if not token or token != expected_token:
        return jsonify({"error": "Unauthorized internal request"}), 401

@internal_bp.route("/all", methods=["GET"])
def get_all_parts():
    """Lấy tất cả parts (cho report-service)"""
    parts = InventoryService.get_all_parts()
    return jsonify([p.to_dict() for p in parts]), 200
