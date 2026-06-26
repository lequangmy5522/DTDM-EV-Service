import requests
import os
from app import db
from models.inventory_model import Inventory, InventoryCompatibility
from sqlalchemy import and_

# Cố gắng import NotificationHelper
try:
    from helpers.notification_helper import NotificationHelper
except ImportError:
    NotificationHelper = None

class InventoryService:
    """Service xử lý logic nghiệp vụ liên quan đến Inventory"""

    @staticmethod
    def get_item_by_id(item_id):
        item = Inventory.query.get(item_id)
        if item:
            pass
        return item

    @staticmethod
    def get_item_by_part_number(part_number, center_id=1):
        cid = center_id if center_id is not None else 1
        return Inventory.query.filter(
            and_(
                Inventory.part_number == part_number,
                Inventory.center_id == cid
            )
        ).first()

    @staticmethod
    def get_all_items(center_id=None):
        query = Inventory.query
        if center_id:
            query = query.filter_by(center_id=center_id)
        return query.order_by(Inventory.id.desc()).all()

    @staticmethod
    def get_all_parts(center_id=None):
        """Alias for get_all_items - used by report service"""
        return InventoryService.get_all_items(center_id)

    @staticmethod
    def create_item(data):
        part_number = data.get("part_number")
        center_id = data.get("center_id", 1) 

        existing_item = InventoryService.get_item_by_part_number(part_number, center_id)
        if existing_item:
            return None, f"Mã phụ tùng '{part_number}' đã tồn tại tại chi nhánh {center_id}"

        new_item = Inventory(
            part_number=part_number,
            name=data.get("name"),
            quantity=data.get("quantity", 0),
            min_quantity=data.get("min_quantity", 10),
            price=data.get("price", 0),
            center_id=center_id
        )

        try:
            db.session.add(new_item)
            db.session.commit()
            
            comp_models = data.get("compatible_models")
            category = data.get("category")
            if comp_models or category:
                new_comp = InventoryCompatibility(
                    inventory_id=new_item.id,
                    compatible_models=comp_models,
                    category=category
                )
                db.session.add(new_comp)
                db.session.commit()

            return new_item, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi tạo vật tư: {str(e)}"

    @staticmethod
    def update_item(item_id, data):
        item = InventoryService.get_item_by_id(item_id)
        if not item:
            return None, "Không tìm thấy vật tư"
        
        old_quantity = item.quantity
        
        try:
            if "name" in data: item.name = data["name"]
            if "quantity" in data: item.quantity = int(data["quantity"])
            if "min_quantity" in data: item.min_quantity = int(data["min_quantity"])
            if "price" in data: item.price = float(data["price"])
            if "center_id" in data: item.center_id = int(data["center_id"])
            
            # Update Compatibility Table
            comp = InventoryCompatibility.query.filter_by(inventory_id=item_id).first()
            if "compatible_models" in data or "category" in data:
                if not comp:
                    comp = InventoryCompatibility(inventory_id=item_id)
                    db.session.add(comp)
                
                if "compatible_models" in data: comp.compatible_models = data["compatible_models"]
                if "category" in data: comp.category = data["category"]

            db.session.commit()
            
            if NotificationHelper:
                if item.quantity == 0 and old_quantity > 0:
                    InventoryService._notify_out_of_stock(item)
                elif item.quantity < item.min_quantity and old_quantity >= item.min_quantity:
                    InventoryService._notify_low_stock(item)
            
            return item, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi cập nhật: {str(e)}"

    @staticmethod
    def delete_item(item_id):
        item = InventoryService.get_item_by_id(item_id)
        if not item:
            return False, "Không tìm thấy vật tư"

        try:
            InventoryCompatibility.query.filter_by(inventory_id=item_id).delete()
            db.session.delete(item)
            db.session.commit()
            return True, "Đã xóa vật tư thành công"
        except Exception as e:
            db.session.rollback()
            return False, f"Lỗi xóa vật tư: {str(e)}"
    
    @staticmethod
    def suggest_parts(vehicle_model, category=None):
        """AI Logic"""
        query = db.session.query(Inventory).join(InventoryCompatibility, Inventory.id == InventoryCompatibility.inventory_id)

        if category:
            query = query.filter(InventoryCompatibility.category == category)
        
        if vehicle_model:
            search_term = f"%{vehicle_model}%"
            query = query.filter(InventoryCompatibility.compatible_models.ilike(search_term))
        
        return query.order_by(Inventory.quantity.desc()).all()

    @staticmethod
    def seed_demo_data():
        """Tạo dữ liệu mẫu cho AI Demo"""
        # 1. Xóa dữ liệu cũ (nếu cần, ở đây ta chỉ thêm nếu chưa có)
        
        # Dữ liệu mẫu
        demo_items = [
            {
                "part_number": "BRK-VF8-001", "name": "Má phanh trước VF8 Premium", 
                "quantity": 50, "min_quantity": 5, "price": 2500000, "center_id": 1,
                "compatible_models": "VF8, VF9", "category": "brake"
            },
            {
                "part_number": "TIRE-VF8-001", "name": "Lốp Michelin 245/45R20 VF8", 
                "quantity": 20, "min_quantity": 4, "price": 6800000, "center_id": 1,
                "compatible_models": "VF8", "category": "tire"
            },
            {
                "part_number": "BAT-12V-GEN", "name": "Bình Ắc quy 12V Lithium", 
                "quantity": 15, "min_quantity": 2, "price": 1200000, "center_id": 1,
                "compatible_models": "VF8, VF9, e34, VF5", "category": "battery"
            },
            {
                "part_number": "FIL-AC-VF8", "name": "Lọc gió điều hòa VF8", 
                "quantity": 100, "min_quantity": 10, "price": 450000, "center_id": 1,
                "compatible_models": "VF8", "category": "filter"
            }
        ]

        for data in demo_items:
            # Check if exists
            exists = Inventory.query.filter_by(part_number=data["part_number"]).first()
            if not exists:
                InventoryService.create_item(data)
                print(f"✅ Seeded: {data['name']}")
            else:
                print(f"⏩ Skipped: {data['name']} (Already exists)")

    @staticmethod
    def _get_admin_user_ids():
        return [1]

    @staticmethod
    def _notify_low_stock(item):
        if not NotificationHelper: return
        admin_ids = InventoryService._get_admin_user_ids()
        title = "⚠️ Cảnh báo tồn kho thấp"
        message = f"Phụ tùng '{item.name}' (#{item.part_number}) tại Chi nhánh {item.center_id} sắp hết (Còn {item.quantity})."
        NotificationHelper.send_to_multiple_users(admin_ids, "inventory_alert", title, message, "high", "inventory", item.id)

    @staticmethod
    def _notify_out_of_stock(item):
        if not NotificationHelper: return
        admin_ids = InventoryService._get_admin_user_ids()
        title = "🚨 HẾT HÀNG KHẨN CẤP"
        message = f"Phụ tùng '{item.name}' (#{item.part_number}) tại Chi nhánh {item.center_id} ĐÃ HẾT HÀNG!"
        NotificationHelper.send_to_multiple_users(admin_ids, "inventory_alert", title, message, "urgent", "inventory", item.id)
