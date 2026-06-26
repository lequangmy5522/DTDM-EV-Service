from datetime import datetime
from app import db
from sqlalchemy import func

class ChatRoom(db.Model):
    """Chat room giữa user và admin/technician"""
    __tablename__ = "chat_rooms"

    id = db.Column(db.Integer, primary_key=True, index=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    user_name = db.Column(db.String(100), nullable=False)

    support_user_id = db.Column(db.Integer, nullable=True, index=True)
    support_user_name = db.Column(db.String(100), nullable=True)
    support_role = db.Column(db.String(20), nullable=True)

    subject = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="waiting")  # waiting, active, closed

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())
    closed_at = db.Column(db.DateTime, nullable=True)

    messages = db.relationship("ChatMessage", backref="room", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "support_user_id": self.support_user_id,
            "support_user_name": self.support_user_name,
            "support_role": self.support_role,
            "subject": self.subject,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "unread_count": sum(1 for msg in self.messages if not msg.is_read and msg.sender_id != self.user_id)
        }


class ChatMessage(db.Model):
    """Tin nhắn trong chat room"""
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True, index=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_rooms.id'), nullable=False, index=True)

    sender_id = db.Column(db.Integer, nullable=False, index=True)
    sender_name = db.Column(db.String(100), nullable=False)
    sender_role = db.Column(db.String(20), nullable=False)

    message = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), nullable=False, default="text")  # text, system

    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "room_id": self.room_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender_name,
            "sender_role": self.sender_role,
            "message": self.message,
            "message_type": self.message_type,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
