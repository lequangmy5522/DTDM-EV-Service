# File: services/booking-service/models/booking_model.py
from datetime import datetime
from app import db 
from sqlalchemy import func

class ServiceCenter(db.Model):
    __tablename__ = "service_centers"

    id = db.Column(db.Integer, primary_key=True, index=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    
    # Lưu trữ tọa độ (vĩ độ, kinh độ) nếu cần hiển thị bản đồ
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "phone": self.phone,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "is_active": self.is_active
        }

class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True, index=True)
    # user_id lưu trữ ID từ User Service (External Key)
    user_id = db.Column(db.Integer, nullable=False, index=True) 
    
    customer_name = db.Column(db.String(100), nullable=False)
    service_type = db.Column(db.String(100), nullable=False)
    
    # Giả định Kỹ thuật viên và Trạm được quản lý ở đây
    technician_id = db.Column(db.Integer, nullable=False)
    station_id = db.Column(db.Integer, nullable=False)
    
    # --- THÊM MỚI: Liên kết với Chi nhánh ---
    center_id = db.Column(db.Integer, db.ForeignKey('service_centers.id'), nullable=True)
    center = db.relationship("ServiceCenter", backref="bookings")
    
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    
    status = db.Column(
        db.Enum("pending", "confirmed", "canceled", "completed", name="booking_statuses"),
        nullable=False,
        default="pending"
    )

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        """Chuyển đổi đối tượng Booking thành dictionary để trả về API"""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "customer_name": self.customer_name,
            "service_type": self.service_type,
            "technician_id": self.technician_id,
            "station_id": self.station_id,
            "center_id": self.center_id, # Trả về center_id
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": str(self.status), 
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Nếu có thông tin chi nhánh, trả về thêm tên chi nhánh
        if self.center:
            data["center_name"] = self.center.name
            data["center_address"] = self.center.address
            
        return data