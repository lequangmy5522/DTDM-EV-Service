from flask import Blueprint, request, jsonify
from src.services.chat_service import ChatService

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

@chat_bp.route("/rooms", methods=["POST"])
def create_room():
    """Tạo chat room mới"""
    data = request.get_json()

    if not data.get("user_id") or not data.get("user_name"):
        return jsonify({"error": "Missing user_id or user_name"}), 400

    room, error = ChatService.create_room(data)
    if error:
        return jsonify({"error": error}), 500

    return jsonify({"success": True, "room": room.to_dict()}), 201

@chat_bp.route("/rooms/user/<int:user_id>", methods=["GET"])
def get_user_rooms(user_id):
    """Lấy danh sách phòng chat của user"""
    rooms = ChatService.get_user_rooms(user_id)
    return jsonify({
        "success": True,
        "rooms": [room.to_dict() for room in rooms]
    }), 200

@chat_bp.route("/rooms/waiting", methods=["GET"])
def get_waiting_rooms():
    """Lấy danh sách phòng chat đang chờ (cho admin)"""
    rooms = ChatService.get_waiting_rooms()
    return jsonify({
        "success": True,
        "rooms": [room.to_dict() for room in rooms]
    }), 200

@chat_bp.route("/rooms/active", methods=["GET"])
def get_active_rooms():
    """Lấy danh sách phòng chat đang hoạt động"""
    rooms = ChatService.get_active_rooms()
    return jsonify({
        "success": True,
        "rooms": [room.to_dict() for room in rooms]
    }), 200

@chat_bp.route("/rooms/closed", methods=["GET"])
def get_closed_rooms():
    """Lấy danh sách phòng chat đã đóng"""
    rooms = ChatService.get_closed_rooms()
    return jsonify({
        "success": True,
        "rooms": [room.to_dict() for room in rooms]
    }), 200

@chat_bp.route("/rooms/<int:room_id>", methods=["GET"])
def get_room(room_id):
    """Lấy thông tin chi tiết phòng chat"""
    room = ChatService.get_room(room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    return jsonify({
        "success": True,
        "room": room.to_dict()
    }), 200

@chat_bp.route("/rooms/<int:room_id>/messages", methods=["GET"])
def get_messages(room_id):
    """Lấy lịch sử tin nhắn của phòng"""
    limit = request.args.get("limit", 100, type=int)
    messages = ChatService.get_messages(room_id, limit)

    return jsonify({
        "success": True,
        "messages": [msg.to_dict() for msg in messages]
    }), 200

@chat_bp.route("/rooms/<int:room_id>/assign", methods=["PUT"])
def assign_support(room_id):
    """Admin nhận phòng chat để hỗ trợ"""
    data = request.get_json()

    if not data.get("support_user_id") or not data.get("support_user_name") or not data.get("support_role"):
        return jsonify({"error": "Missing support user information"}), 400

    room, error = ChatService.assign_support(
        room_id,
        data["support_user_id"],
        data["support_user_name"],
        data["support_role"]
    )

    if error:
        return jsonify({"error": error}), 404 if error == "Room not found" else 500

    return jsonify({
        "success": True,
        "room": room.to_dict()
    }), 200

@chat_bp.route("/rooms/<int:room_id>/close", methods=["PUT"])
def close_room(room_id):
    """Đóng phòng chat"""
    room, error = ChatService.close_room(room_id)

    if error:
        return jsonify({"error": error}), 404 if error == "Room not found" else 500

    return jsonify({
        "success": True,
        "room": room.to_dict()
    }), 200

@chat_bp.route("/rooms/<int:room_id>/read", methods=["PUT"])
def mark_as_read(room_id):
    """Đánh dấu tin nhắn đã đọc"""
    data = request.get_json()

    if not data.get("user_id"):
        return jsonify({"error": "Missing user_id"}), 400

    success, error = ChatService.mark_messages_as_read(room_id, data["user_id"])

    if error:
        return jsonify({"error": error}), 500

    return jsonify({"success": True}), 200
