# File: services/booking-service/services/booking_service.py
import os
from datetime import datetime
from flask import current_app
from sqlalchemy import and_, or_
import requests 

from app import db
from models.booking_model import Booking, ServiceCenter 

class BookingService:
    """Service xử lý logic nghiệp vụ liên quan đến Đặt lịch"""
    
    # ================= SERVICE CENTER LOGIC =================
    @staticmethod
    def create_service_center(data):
        """Tạo mới một trung tâm dịch vụ"""
        required = ["name", "address"]
        if not all(k in data for k in required):
            return None, "Thiếu tên hoặc địa chỉ trung tâm"
        
        try:
            new_center = ServiceCenter(
                name=data["name"],
                address=data["address"],
                phone=data.get("phone"),
                latitude=data.get("latitude"),
                longitude=data.get("longitude"),
                is_active=data.get("is_active", True)
            )
            db.session.add(new_center)
            db.session.commit()
            return new_center, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi tạo trung tâm: {str(e)}"

    @staticmethod
    def get_all_service_centers(active_only=True):
        """Lấy danh sách trung tâm"""
        query = ServiceCenter.query
        if active_only:
            query = query.filter_by(is_active=True)
        return query.all()

    @staticmethod
    def get_service_center_by_id(center_id):
        return ServiceCenter.query.get(center_id)

    # ================= BOOKING LOGIC =================
    
    @staticmethod
    def _verify_user(user_id):
        """Hàm nội bộ: Gọi User Service để xác minh User tồn tại"""
        user_service_url = current_app.config.get("USER_SERVICE_URL")
        internal_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
        
        if not user_service_url or not internal_token:
            return None, "Lỗi cấu hình Service URL hoặc Internal Token"

        try:
            # Gọi Internal API của User Service
            url = f"{user_service_url}/internal/user/{user_id}"
            headers = {"X-Internal-Token": internal_token}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                return user_data, None
            else:
                return None, f"User Service lỗi: {response.json().get('error', 'Không tìm thấy người dùng')}"
        except requests.exceptions.RequestException as e:
            return None, f"Lỗi kết nối User Service: {str(e)}"

    @staticmethod
    def is_time_available(technician_id, station_id, start_time, end_time, exclude_booking_id=None):
        """Kiểm tra xem lịch có bị trùng không"""
        
        dt_start = datetime.fromisoformat(start_time)
        dt_end = datetime.fromisoformat(end_time)
        
        query = Booking.query.filter(
            and_(
                Booking.status == 'confirmed',
                Booking.technician_id == technician_id,
                Booking.station_id == station_id,
                or_(
                    and_(Booking.start_time <= dt_start, Booking.end_time > dt_start),
                    and_(Booking.start_time < dt_end, Booking.end_time >= dt_end),
                    and_(Booking.start_time >= dt_start, Booking.end_time <= dt_end)
                )
            )
        )
        
        if exclude_booking_id:
            query = query.filter(Booking.id != exclude_booking_id)

        return query.count() == 0

    @staticmethod
    def create_booking(data):
        """Tạo lịch đặt mới"""
        required_fields = ["user_id", "service_type", "technician_id", "station_id", "start_time", "end_time"]
        if not all(k in data for k in required_fields):
            return None, "Thiếu thông tin đặt lịch bắt buộc."
        
        user_id = data['user_id']
        start_time = data['start_time']
        end_time = data['end_time']
        technician_id = data['technician_id']
        station_id = data['station_id']
        center_id = data.get('center_id') # Lấy center_id (có thể null nếu legacy)
        
        # Check center valid if provided
        if center_id:
            center = ServiceCenter.query.get(center_id)
            if not center:
                return None, "Trung tâm dịch vụ không tồn tại."

        # 1. Xác minh người dùng tồn tại
        user_data, user_error = BookingService._verify_user(user_id)
        if user_error:
            return None, user_error
        
        # 2. Kiểm tra trùng lịch
        if not BookingService.is_time_available(technician_id, station_id, start_time, end_time):
            return None, "Thời gian này đã có lịch hẹn trùng."

        # 3. Tạo Booking
        try:
            customer_name = user_data.get('username') 
            
            new_booking = Booking(
                user_id=user_id,
                customer_name=customer_name, 
                service_type=data["service_type"],
                technician_id=technician_id,
                station_id=station_id,
                center_id=center_id, # Lưu center_id
                start_time=datetime.fromisoformat(start_time),
                end_time=datetime.fromisoformat(end_time),
                status='confirmed'
            )
            
            db.session.add(new_booking)
            db.session.commit()

            # Send notification after successful booking
            try:
                BookingService._notify_booking_created(new_booking)
            except Exception as e:
                print(f"⚠️ Failed to send notification: {e}")

            return new_booking, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi tạo lịch đặt: {str(e)}"

    @staticmethod
    def get_all_bookings():
        return Booking.query.all()
    
    @staticmethod
    def get_booking_by_id(booking_id):
        return Booking.query.get(booking_id)

    @staticmethod
    def update_booking_status(booking_id, new_status):
        booking = BookingService.get_booking_by_id(booking_id)
        if not booking:
            return None, "Không tìm thấy lịch đặt."
        
        old_status = booking.status
        
        valid_statuses = ["pending", "confirmed", "canceled", "completed"]
        if new_status not in valid_statuses:
            return None, f"Trạng thái '{new_status}' không hợp lệ."
        
        try:
            booking.status = new_status
            db.session.commit()
            
            # Gửi notification khi trạng thái thay đổi
            BookingService._notify_booking_status_changed(booking, old_status, new_status)
            
            return booking, None
        except Exception as e:
            db.session.rollback()
            return None, f"Lỗi khi cập nhật trạng thái: {str(e)}"
    
    @staticmethod
    def delete_booking(booking_id):
        booking = BookingService.get_booking_by_id(booking_id)
        if not booking:
            return False, "Không tìm thấy lịch đặt."

        try:
            db.session.delete(booking)
            db.session.commit()
            return True, "Xóa lịch đặt thành công."
        except Exception as e:
            db.session.rollback()
            return False, f"Lỗi khi xóa lịch đặt: {str(e)}"
    
    @staticmethod
    def get_bookings_by_user(user_id):
        """Lấy tất cả lịch đặt của một người dùng"""
        # Đảm bảo user_id là integer
        user_id_int = int(user_id)
        
        # Sắp xếp theo start_time để lịch sắp tới hiển thị trước
        return Booking.query.filter_by(user_id=user_id_int).order_by(Booking.start_time.desc()).all()

    # ================= NOTIFICATION HELPERS =================
    
    @staticmethod
    def _notify_booking_created(booking):
        """Thông báo khi tạo booking thành công"""
        try:
            # Cố gắng import NotificationHelper
            # Lưu ý: Cần đảm bảo helpers/notification_helper.py tồn tại và đúng logic
            from helpers.notification_helper import NotificationHelper
            
            location_info = ""
            if booking.center:
                location_info = f" tại {booking.center.name}"
            
            return NotificationHelper.send_notification(
                user_id=booking.user_id,
                notification_type="booking_status",
                title="✅ Đặt lịch thành công!",
                message=f"Lịch hẹn {booking.service_type} của bạn đã được xác nhận{location_info} vào ngày {booking.start_time.strftime('%d/%m/%Y %H:%M')}",
                channel="in_app",
                priority="high",
                related_entity_type="booking",
                related_entity_id=booking.id,
                metadata={
                    "service_type": booking.service_type,
                    "technician_id": booking.technician_id,
                    "station_id": booking.station_id,
                    "center_id": booking.center_id
                }
            )
        except ImportError:
            print("⚠️ NotificationHelper not available or import error, skipping notification")
            return True, "Notification skipped"
        except Exception as e:
            print(f"⚠️ Error sending notification: {str(e)}")
            return False, str(e)
    
    @staticmethod
    def _notify_booking_status_changed(booking, old_status, new_status):
        """Thông báo khi trạng thái booking thay đổi"""
        try:
            from helpers.notification_helper import NotificationHelper
            
            messages = {
                "confirmed": "✅ Lịch hẹn của bạn đã được xác nhận",
                "completed": "🎉 Dịch vụ đã hoàn tất! Cảm ơn bạn đã sử dụng dịch vụ",
                "canceled": "❌ Lịch hẹn đã bị hủy"
            }
            
            priorities = {
                "confirmed": "high",
                "completed": "medium",
                "canceled": "high"
            }
            
            return NotificationHelper.send_notification(
                user_id=booking.user_id,
                notification_type="booking_status",
                title=f"Cập nhật trạng thái: {new_status}",
                message=messages.get(new_status, f"Trạng thái đã chuyển từ {old_status} sang {new_status}"),
                channel="in_app",
                priority=priorities.get(new_status, "medium"),
                related_entity_type="booking",
                related_entity_id=booking.id
            )
        except ImportError:
             return True, "Notification skipped"
        except Exception:
             return False, "Error sending notification"
