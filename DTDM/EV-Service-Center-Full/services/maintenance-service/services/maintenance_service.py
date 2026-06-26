import requests
from flask import current_app
from app import db
from models.maintenance_model import MaintenanceTask, TaskPart, MaintenanceChecklist

class MaintenanceService:
    """Service xử lý logic nghiệp vụ về Công việc bảo trì"""
    
    @staticmethod
    def _call_internal_api(service_url, endpoint, method="GET", json_data=None):
        internal_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
        url = f"{service_url}{endpoint}"
        headers = {"X-Internal-Token": internal_token}
        
        if not service_url or not internal_token:
             return None, "Lỗi cấu hình Service URL hoặc Internal Token."

        try:
            response = requests.request(method, url, headers=headers, json=json_data)

            if response.status_code == 200 or response.status_code == 201:
                return response.json(), None
            else:
                # Một số API trả về list trực tiếp hoặc dict không có key error
                return None, f"Lỗi Service (HTTP {response.status_code})"
        except requests.exceptions.RequestException as e:
            return None, f"Lỗi kết nối Service: {str(e)}"

    @staticmethod
    def _get_booking_details(booking_id):
        booking_url = current_app.config.get("BOOKING_SERVICE_URL")
        return MaintenanceService._call_internal_api(booking_url, f"/internal/bookings/items/{booking_id}")

    @staticmethod
    def _get_user_profile(user_id):
        user_url = current_app.config.get("USER_SERVICE_URL")
        return MaintenanceService._call_internal_api(user_url, f"/internal/user/{user_id}")
    
    @staticmethod
    def get_task_by_id(task_id):
        return MaintenanceTask.query.get(task_id)

    @staticmethod
    def get_all_tasks():
        return MaintenanceTask.query.order_by(MaintenanceTask.created_at.desc()).all()

    @staticmethod
    def get_tasks_by_user(user_id):
        """Lấy danh sách task của Customer"""
        return MaintenanceTask.query.filter_by(user_id=int(user_id)).order_by(MaintenanceTask.created_at.desc()).all()

    @staticmethod
    def get_tasks_by_technician(technician_id):
        """Lấy danh sách task được phân công cho Technician"""
        return MaintenanceTask.query.filter_by(technician_id=int(technician_id)).order_by(MaintenanceTask.created_at.desc()).all()

    @staticmethod
    def create_task_from_booking(booking_id, technician_id):
        existing_task = MaintenanceTask.query.filter_by(
            booking_id=booking_id,
            technician_id=technician_id
        ).first()

        if existing_task:
            return None, "Kỹ thuật viên này đã được phân công cho Booking này rồi."

        booking_data, error = MaintenanceService._get_booking_details(booking_id)
        if error:
            return None, f"Lỗi khi lấy Booking: {error}"
            
        user_id = booking_data.get('user_id')
        service_type = booking_data.get('service_type')

        user_data, error = MaintenanceService._get_user_profile(user_id)
        if error:
            user_data = {} # Fallback nếu lỗi user service
        
        vehicle_vin = f"VIN_{booking_id}_{user_data.get('username', 'Unknown')}" 

        try:
            new_task = MaintenanceTask(
                booking_id=booking_id,
                user_id=user_id,
                vehicle_vin=vehicle_vin, 
                description=service_type,
                technician_id=technician_id,
                status='pending'
            )
            db.session.add(new_task)
            db.session.commit()
            
            # --- THÊM CHECKLIST MẶC ĐỊNH ---
            default_checklist_items = ["Lốp", "Phanh", "Pin", "Động cơ", "Hệ thống điện", "Hệ thống làm mát", "Ngoại thất/Thân vỏ"]
            for item_name in default_checklist_items:
                checklist_item = MaintenanceChecklist(
                    task_id=new_task.task_id,
                    item_name=item_name,
                    status="pending"
                )
                db.session.add(checklist_item)
            db.session.commit()

            return new_task, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi tạo công việc bảo trì: {str(e)}"

    @staticmethod
    def update_task_status(task_id, new_status):
        task = MaintenanceTask.query.get(task_id)
        if not task:
            return None, "Không tìm thấy Công việc bảo trì."

        valid_statuses = ["pending", "in_progress", "completed", "failed"]
        if new_status not in valid_statuses:
            return None, f"Trạng thái '{new_status}' không hợp lệ. Phải là: {', '.join(valid_statuses)}"
        
        try:
            task.status = new_status
            db.session.commit()
            return task, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi cập nhật trạng thái: {str(e)}"

    @staticmethod
    def _check_inventory_stock(item_id):
        inventory_url = current_app.config.get("INVENTORY_SERVICE_URL")
        if not inventory_url:
            return None, "Lỗi cấu hình INVENTORY_SERVICE_URL"

        try:
            # Gọi API nội bộ hoặc public của Inventory
            return MaintenanceService._call_internal_api(inventory_url, f"/api/inventory/items/{item_id}")
        except requests.exceptions.RequestException as e:
            return None, f"Lỗi kết nối inventory service: {str(e)}"

    @staticmethod
    def add_part_to_task(task_id, item_id, quantity):
        task = MaintenanceTask.query.filter_by(task_id=task_id).first()
        if not task:
            return None, "Task không tồn tại"

        inventory_data, error = MaintenanceService._check_inventory_stock(item_id)
        if error:
            return None, f"Lỗi kiểm tra kho: {error}"
        if not inventory_data:
            return None, "Phụ tùng không tồn tại trong kho"

        available_quantity = inventory_data.get("quantity", 0)
        existing_part = TaskPart.query.filter_by(task_id=task_id, item_id=item_id).first()

        current_qty = existing_part.quantity if existing_part else 0
        if (current_qty + quantity) > available_quantity:
             return None, f"Số lượng vượt quá tồn kho. Có sẵn: {available_quantity}"

        # TODO: Gọi Inventory Service để trừ kho (Deduct)
        
        if existing_part:
            existing_part.quantity += quantity
            db.session.commit()
            return existing_part, None

        new_part = TaskPart(
            task_id=task_id,
            item_id=item_id,
            quantity=quantity
        )
        db.session.add(new_part)
        db.session.commit()
        return new_part, None

    @staticmethod
    def get_task_parts(task_id):
        return TaskPart.query.filter_by(task_id=task_id).all()

    @staticmethod
    def remove_part_from_task(part_id):
        part = TaskPart.query.filter_by(id=part_id).first()
        if not part:
            return False, "Phụ tùng không tồn tại"
        db.session.delete(part)
        db.session.commit()
        return True, None

    @staticmethod
    def get_completed_tasks_with_parts():
        # Tối ưu Query N+1 bằng join
        results = db.session.query(MaintenanceTask, TaskPart)\
            .outerjoin(TaskPart, MaintenanceTask.task_id == TaskPart.task_id)\
            .filter(MaintenanceTask.status == 'completed').all()
            
        tasks_map = {}
        for task, part in results:
            if task.task_id not in tasks_map:
                tasks_map[task.task_id] = task.to_dict()
                tasks_map[task.task_id]['parts'] = []
            if part:
                tasks_map[task.task_id]['parts'].append(part.to_dict())
        return list(tasks_map.values())

    @staticmethod
    def get_task_parts_by_booking_id(booking_id):
        task = MaintenanceTask.query.filter_by(booking_id=booking_id).first()
        if not task:
            return None, "Task không tồn tại cho booking này"
        parts = TaskPart.query.filter_by(task_id=task.task_id).all()
        return [p.to_dict() for p in parts], None

    # ============= Checklist Methods =============
    @staticmethod
    def add_checklist_item(task_id, item_name, status, note=None):
        task = MaintenanceTask.query.get(task_id)
        if not task: return None, "Task không tồn tại"
        new_item = MaintenanceChecklist(task_id=task_id, item_name=item_name, status=status, note=note)
        db.session.add(new_item)
        db.session.commit()
        return new_item, None

    @staticmethod
    def get_task_checklist(task_id):
        return MaintenanceChecklist.query.filter_by(task_id=task_id).all()

    @staticmethod
    def update_checklist_item(item_id, status=None, note=None, current_user_id=None, is_admin=False):
        item = MaintenanceChecklist.query.get(item_id)
        if not item:
            return None, "Hạng mục kiểm tra không tồn tại"

        # Kiểm tra quyền: Admin hoặc KTV owner của task
        if not is_admin and current_user_id:
            # Lấy task liên quan đến checklist item
            task = MaintenanceTask.query.get(item.task_id)
            if task and task.technician_id:
                # Convert both to int for comparison
                try:
                    tech_id = int(task.technician_id)
                    user_id = int(current_user_id) if not isinstance(current_user_id, int) else current_user_id
                    if tech_id != user_id:
                        return None, "Bạn không có quyền cập nhật checklist này"
                except (ValueError, TypeError):
                    return None, "Lỗi xác thực người dùng"

        if status:
            item.status = status
        if note is not None:
            item.note = note
        db.session.commit()
        return item, None

    @staticmethod
    def remove_checklist_item(item_id):
        item = MaintenanceChecklist.query.get(item_id)
        if not item: return None, "Hạng mục kiểm tra không tồn tại"
        db.session.delete(item)
        db.session.commit()
        return True, None