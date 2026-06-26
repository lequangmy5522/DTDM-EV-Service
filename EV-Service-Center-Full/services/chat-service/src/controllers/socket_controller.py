from flask import request
from flask_socketio import emit, join_room, leave_room
from app import socketio
from src.services.chat_service import ChatService

@socketio.on("connect")
def handle_connect():
    """Client kết nối"""
    print(f"Client connected: {request.sid}")
    emit("connected", {"sid": request.sid})

@socketio.on("disconnect")
def handle_disconnect():
    """Client ngắt kết nối"""
    print(f"Client disconnected: {request.sid}")

@socketio.on("join_room")
def handle_join_room(data):
    """Join vào một chat room"""
    room_id = data.get("room_id")
    if not room_id:
        emit("error", {"message": "Missing room_id"})
        return

    join_room(str(room_id))
    emit("joined_room", {"room_id": room_id}, room=request.sid)
    print(f"Client {request.sid} joined room {room_id}")

@socketio.on("leave_room")
def handle_leave_room(data):
    """Leave khỏi một chat room"""
    room_id = data.get("room_id")
    if not room_id:
        emit("error", {"message": "Missing room_id"})
        return

    leave_room(str(room_id))
    emit("left_room", {"room_id": room_id}, room=request.sid)
    print(f"Client {request.sid} left room {room_id}")

@socketio.on("send_message")
def handle_send_message(data):
    """Gửi tin nhắn"""
    required_fields = ["room_id", "sender_id", "sender_name", "sender_role", "message"]
    if not all(field in data for field in required_fields):
        emit("error", {"message": "Missing required fields"})
        return

    message, error = ChatService.send_message(data)
    if error:
        emit("error", {"message": error}, room=request.sid)
        return

    # Broadcast tin nhắn đến tất cả clients trong room
    emit("new_message", message.to_dict(), room=str(data["room_id"]))
    print(f"Message sent in room {data['room_id']}")

@socketio.on("typing")
def handle_typing(data):
    """User đang gõ"""
    room_id = data.get("room_id")
    user_name = data.get("user_name")

    if not room_id or not user_name:
        return

    # Broadcast typing indicator đến room (trừ sender)
    emit("user_typing", {"user_name": user_name}, room=str(room_id), skip_sid=request.sid)

@socketio.on("stop_typing")
def handle_stop_typing(data):
    """User dừng gõ"""
    room_id = data.get("room_id")
    user_name = data.get("user_name")

    if not room_id or not user_name:
        return

    # Broadcast stop typing đến room (trừ sender)
    emit("user_stop_typing", {"user_name": user_name}, room=str(room_id), skip_sid=request.sid)

@socketio.on("room_assigned")
def handle_room_assigned(data):
    """Admin nhận phòng chat"""
    room_id = data.get("room_id")
    if not room_id:
        return

    room = ChatService.get_room(room_id)
    if room:
        # Thông báo cho tất cả clients trong room
        emit("room_status_changed", room.to_dict(), room=str(room_id))

@socketio.on("room_closed")
def handle_room_closed(data):
    """Phòng chat được đóng"""
    room_id = data.get("room_id")
    if not room_id:
        return

    room = ChatService.get_room(room_id)
    if room:
        # Thông báo cho tất cả clients trong room
        emit("room_status_changed", room.to_dict(), room=str(room_id))
