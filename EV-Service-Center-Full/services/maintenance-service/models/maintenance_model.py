# File: services/maintenance-service/models/maintenance_model.py
from app import db 
from sqlalchemy import func

# Định nghĩa các trạng thái của Công việc bảo trì
TASK_STATUSES = db.Enum(
    "pending", "in_progress", "completed", "failed", 
    name="maintenance_task_statuses"
)

class MaintenanceTask(db.Model):
    __tablename__ = "maintenance_tasks"

    task_id = db.Column(db.Integer, primary_key=True, index=True)
    # Booking ID là external key, 1 booking có thể có nhiều tasks (nhiều KTV)
    booking_id = db.Column(db.Integer, nullable=False, index=True)
    # User ID (technician) để dễ tra cứu
    user_id = db.Column(db.Integer, nullable=False, index=True) 
    # Thông tin xe (VIN) lấy từ Booking/User Profile
    vehicle_vin = db.Column(db.String(100), nullable=False)
    
    # Mô tả công việc (Lấy từ Booking service_type)
    description = db.Column(db.String(255), nullable=False)
    # Kỹ thuật viên phụ trách
    technician_id = db.Column(db.Integer, nullable=False) 
    
    # Trạng thái công việc
    status = db.Column(
        TASK_STATUSES,
        nullable=False,
        default="pending"
    )

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        """Chuyển đổi đối tượng sang dictionary để trả về API"""
        return {
            "task_id": self.task_id,
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "vehicle_vin": self.vehicle_vin,
            "description": self.description,
            "technician_id": self.technician_id,
            "status": str(self.status),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TaskPart(db.Model):
    """Bảng lưu các phụ tùng đã sử dụng cho mỗi task"""
    __tablename__ = "task_parts"

    id = db.Column(db.Integer, primary_key=True, index=True)
    task_id = db.Column(db.Integer, nullable=False, index=True)
    item_id = db.Column(db.Integer, nullable=False)  # ID từ inventory
    quantity = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, nullable=False, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "item_id": self.item_id,
            "quantity": self.quantity,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class MaintenanceChecklist(db.Model):
    """Bảng lưu checklist các hạng mục kiểm tra (Lốp, Phanh, Pin, Động cơ...)"""
    __tablename__ = "maintenance_checklists"

    id = db.Column(db.Integer, primary_key=True, index=True)
    task_id = db.Column(db.Integer, nullable=False, index=True)
    item_name = db.Column(db.String(100), nullable=False) # Tên hạng mục (Lốp, Phanh, v.v.)
    status = db.Column(db.String(50), nullable=False) # Trạng thái: "pass", "fail", "needs_repair", etc.
    note = db.Column(db.String(255), nullable=True) # Ghi chú thêm
    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "item_name": self.item_name,
            "status": self.status,
            "note": self.note,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
