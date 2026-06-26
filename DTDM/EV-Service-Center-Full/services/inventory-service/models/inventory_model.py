from datetime import datetime
from app import db 
from sqlalchemy import func, UniqueConstraint

class Inventory(db.Model):
    __tablename__ = "inventory"

    id = db.Column(db.Integer, primary_key=True, index=True)
    
    # part_number không còn unique toàn cục nữa, mà unique theo center
    part_number = db.Column(db.String(100), nullable=False)
    
    name = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    min_quantity = db.Column(db.Integer, nullable=False, default=10)
    price = db.Column(db.Float, nullable=False)

    # Center ID (Mặc định 1)
    center_id = db.Column(db.Integer, nullable=False, default=1)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    # Ràng buộc: Một mã phụ tùng chỉ được xuất hiện 1 lần TRONG CÙNG 1 CHI NHÁNH
    __table_args__ = (
        UniqueConstraint('part_number', 'center_id', name='uix_part_number_center'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "part_number": self.part_number,
            "quantity": self.quantity,
            "min_quantity": self.min_quantity,
            "price": self.price,
            "center_id": self.center_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class InventoryCompatibility(db.Model):
    """Bảng phụ lưu thông tin tương thích cho AI Suggestion (Tránh sửa bảng Inventory chính)"""
    __tablename__ = "inventory_compatibility"

    id = db.Column(db.Integer, primary_key=True, index=True)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=False)
    
    # Lưu danh sách các model xe tương thích (ví dụ: "VF8, VF9")
    compatible_models = db.Column(db.String(255), nullable=True)
    
    # Loại phụ tùng (ví dụ: "brake", "tire")
    category = db.Column(db.String(100), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
