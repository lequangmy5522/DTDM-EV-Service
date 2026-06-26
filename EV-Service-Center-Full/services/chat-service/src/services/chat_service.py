from datetime import datetime
from app import db
from src.models.chat_model import ChatRoom, ChatMessage

class ChatService:
    @staticmethod
    def create_room(data):
        """Tạo chat room mới"""
        try:
            room = ChatRoom(
                user_id=data["user_id"],
                user_name=data["user_name"],
                subject=data.get("subject", "Hỗ trợ khách hàng"),
                status="waiting"
            )
            db.session.add(room)
            db.session.commit()

            system_msg = ChatMessage(
                room_id=room.id,
                sender_id=0,
                sender_name="System",
                sender_role="system",
                message=f"Phòng chat được tạo. Đang chờ hỗ trợ...",
                message_type="system"
            )
            db.session.add(system_msg)
            db.session.commit()

            return room, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_room(room_id):
        return ChatRoom.query.get(room_id)

    @staticmethod
    def get_user_rooms(user_id):
        return ChatRoom.query.filter_by(user_id=user_id).order_by(ChatRoom.updated_at.desc()).all()

    @staticmethod
    def get_waiting_rooms():
        return ChatRoom.query.filter_by(status="waiting").order_by(ChatRoom.created_at.asc()).all()

    @staticmethod
    def get_active_rooms():
        return ChatRoom.query.filter_by(status="active").order_by(ChatRoom.updated_at.desc()).all()

    @staticmethod
    def get_closed_rooms():
        return ChatRoom.query.filter_by(status="closed").order_by(ChatRoom.closed_at.desc()).all()

    @staticmethod
    def assign_support(room_id, support_user_id, support_user_name, support_role):
        room = ChatRoom.query.get(room_id)
        if not room:
            return None, "Room not found"

        try:
            room.support_user_id = support_user_id
            room.support_user_name = support_user_name
            room.support_role = support_role
            room.status = "active"

            system_msg = ChatMessage(
                room_id=room.id,
                sender_id=0,
                sender_name="System",
                sender_role="system",
                message=f"{support_user_name} đã tham gia hỗ trợ",
                message_type="system"
            )
            db.session.add(system_msg)
            db.session.commit()

            return room, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def close_room(room_id):
        room = ChatRoom.query.get(room_id)
        if not room:
            return None, "Room not found"

        try:
            room.status = "closed"
            room.closed_at = datetime.now()

            system_msg = ChatMessage(
                room_id=room.id,
                sender_id=0,
                sender_name="System",
                sender_role="system",
                message="Phòng chat đã đóng",
                message_type="system"
            )
            db.session.add(system_msg)
            db.session.commit()

            return room, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def send_message(data):
        try:
            message = ChatMessage(
                room_id=data["room_id"],
                sender_id=data["sender_id"],
                sender_name=data["sender_name"],
                sender_role=data["sender_role"],
                message=data["message"],
                message_type=data.get("message_type", "text")
            )
            db.session.add(message)

            room = ChatRoom.query.get(data["room_id"])
            if room:
                room.updated_at = datetime.now()

            db.session.commit()
            return message, None
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_messages(room_id, limit=100):
        return ChatMessage.query.filter_by(room_id=room_id)\
            .order_by(ChatMessage.created_at.asc())\
            .limit(limit)\
            .all()

    @staticmethod
    def mark_messages_as_read(room_id, user_id):
        try:
            messages = ChatMessage.query.filter_by(room_id=room_id, is_read=False)\
                .filter(ChatMessage.sender_id != user_id)\
                .all()

            for msg in messages:
                msg.is_read = True
                msg.read_at = datetime.now()

            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)
