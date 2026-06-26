"""
Reminder Scheduler Service
Tự động gửi nhắc nhở bảo dưỡng định kỳ và thanh toán
"""

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from app import db
from models.notification_model import Notification
import requests
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReminderScheduler:
    def __init__(self, app=None):
        self.scheduler = BackgroundScheduler()
        self.app = app

        # Service URLs
        self.BOOKING_SERVICE_URL = os.getenv('BOOKING_SERVICE_URL', 'http://booking-service:8001')
        self.MAINTENANCE_SERVICE_URL = os.getenv('MAINTENANCE_SERVICE_URL', 'http://maintenance-service:8003')
        self.PAYMENT_SERVICE_URL = os.getenv('PAYMENT_SERVICE_URL', 'http://payment-service:8004')
        self.INTERNAL_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN')

    def init_app(self, app):
        """Initialize scheduler with Flask app context"""
        self.app = app

    def start(self):
        """Start the scheduler with all jobs"""
        if self.scheduler.running:
            logger.warning("Scheduler is already running")
            return

        # Job 1: Check maintenance reminders - Daily at 8:00 AM
        self.scheduler.add_job(
            self.check_maintenance_reminders,
            'cron',
            hour=8,
            minute=0,
            id='maintenance_reminders',
            name='Check Maintenance Reminders',
            replace_existing=True
        )

        # Job 2: Check payment reminders - Daily at 9:00 AM
        self.scheduler.add_job(
            self.check_payment_reminders,
            'cron',
            hour=9,
            minute=0,
            id='payment_reminders',
            name='Check Payment Reminders',
            replace_existing=True
        )

        # Job 3: Send scheduled notifications - Every 5 minutes
        self.scheduler.add_job(
            self.send_scheduled_notifications,
            'interval',
            minutes=5,
            id='send_scheduled',
            name='Send Scheduled Notifications',
            replace_existing=True
        )

        self.scheduler.start()
        logger.info("✅ Reminder scheduler started successfully")
        logger.info(f"📅 Jobs scheduled: {len(self.scheduler.get_jobs())}")

    def stop(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("⏹️ Reminder scheduler stopped")

    def check_maintenance_reminders(self):
        """
        Kiểm tra và tạo nhắc nhở bảo dưỡng định kỳ
        - Nhắc theo km: khi gần đến mốc bảo dưỡng
        - Nhắc theo thời gian: khi gần đến chu kỳ bảo dưỡng
        """
        if not self.app:
            logger.error("App context not available")
            return

        with self.app.app_context():
            try:
                logger.info("🔍 Checking maintenance reminders...")

                # Gọi API lấy danh sách booking cần nhắc nhở
                headers = {'X-Internal-Token': self.INTERNAL_TOKEN}
                response = requests.get(
                    f"{self.MAINTENANCE_SERVICE_URL}/internal/maintenance/due-soon",
                    headers=headers,
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    maintenances = data.get('maintenances', [])

                    logger.info(f"Found {len(maintenances)} maintenance due soon")

                    for maintenance in maintenances:
                        self._create_maintenance_reminder(maintenance)
                else:
                    logger.warning(f"Failed to fetch maintenance data: {response.status_code}")

            except Exception as e:
                logger.error(f"Error checking maintenance reminders: {e}")

    def _create_maintenance_reminder(self, maintenance):
        """Tạo notification nhắc nhở bảo dưỡng"""
        try:
            user_id = maintenance.get('user_id')
            vehicle_info = maintenance.get('vehicle_info', {})
            due_date = maintenance.get('due_date')
            due_mileage = maintenance.get('due_mileage')
            current_mileage = maintenance.get('current_mileage')

            # Tính toán thông tin
            if due_mileage and current_mileage:
                km_left = due_mileage - current_mileage
                km_msg = f"Còn {km_left} km nữa"
            else:
                km_msg = ""

            if due_date:
                days_left = (datetime.fromisoformat(due_date) - datetime.now()).days
                time_msg = f"Còn {days_left} ngày"
            else:
                time_msg = ""

            # Tạo title và message
            title = f"⚠️ Nhắc nhở bảo dưỡng xe {vehicle_info.get('license_plate', 'N/A')}"
            message = f"""
Xe của bạn sắp đến thời gian bảo dưỡng định kỳ.

📊 Thông tin:
{f'• {km_msg}' if km_msg else ''}
{f'• {time_msg}' if time_msg else ''}

💡 Khuyến nghị: Vui lòng đặt lịch bảo dưỡng sớm để đảm bảo xe hoạt động tốt nhất.

👉 Đặt lịch ngay tại mục "Lịch Hẹn"
            """.strip()

            # Tạo notification
            notification = Notification(
                user_id=user_id,
                notification_type='reminder',
                title=title,
                message=message,
                channel='in_app',
                status='pending',
                priority='high',
                related_entity_type='maintenance',
                related_entity_id=maintenance.get('id'),
                scheduled_at=datetime.now()
            )

            db.session.add(notification)
            db.session.commit()

            logger.info(f"✅ Created maintenance reminder for user {user_id}")

        except Exception as e:
            logger.error(f"Error creating maintenance reminder: {e}")
            db.session.rollback()

    def check_payment_reminders(self):
        """
        Kiểm tra và tạo nhắc nhở thanh toán/gia hạn
        - Nhắc trước 7 ngày, 3 ngày, 1 ngày
        """
        if not self.app:
            logger.error("App context not available")
            return

        with self.app.app_context():
            try:
                logger.info("🔍 Checking payment reminders...")

                # Gọi API lấy các payment sắp đến hạn
                headers = {'X-Internal-Token': self.INTERNAL_TOKEN}
                response = requests.get(
                    f"{self.PAYMENT_SERVICE_URL}/internal/payments/due-soon",
                    headers=headers,
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    payments = data.get('payments', [])

                    logger.info(f"Found {len(payments)} payments due soon")

                    for payment in payments:
                        self._create_payment_reminder(payment)
                else:
                    logger.warning(f"Failed to fetch payment data: {response.status_code}")

            except Exception as e:
                logger.error(f"Error checking payment reminders: {e}")

    def _create_payment_reminder(self, payment):
        """Tạo notification nhắc nhở thanh toán"""
        try:
            user_id = payment.get('user_id')
            due_date = payment.get('due_date')
            amount = payment.get('amount')
            service_name = payment.get('service_name', 'Dịch vụ')
            payment_id = payment.get('id')

            # Tính số ngày còn lại
            if due_date:
                days_left = (datetime.fromisoformat(due_date) - datetime.now()).days
            else:
                days_left = 0

            # Xác định priority
            if days_left <= 1:
                priority = 'urgent'
                urgency = '🚨 Khẩn cấp'
            elif days_left <= 3:
                priority = 'high'
                urgency = '⚠️ Quan trọng'
            else:
                priority = 'medium'
                urgency = '📢 Thông báo'

            # Tạo title và message
            title = f"{urgency} - Nhắc thanh toán {service_name}"
            message = f"""
Bạn có khoản thanh toán sắp đến hạn:

💰 Số tiền: {amount:,.0f} VNĐ
📅 Hạn thanh toán: {due_date}
⏰ Còn lại: {days_left} ngày

{f'⚠️ Lưu ý: Vui lòng thanh toán trước hạn để tránh gián đoạn dịch vụ.' if days_left <= 3 else ''}

👉 Thanh toán ngay tại mục "Thanh Toán"
            """.strip()

            # Tạo notification
            notification = Notification(
                user_id=user_id,
                notification_type='payment',
                title=title,
                message=message,
                channel='in_app',
                status='pending',
                priority=priority,
                related_entity_type='payment',
                related_entity_id=payment_id,
                scheduled_at=datetime.now()
            )

            db.session.add(notification)
            db.session.commit()

            logger.info(f"✅ Created payment reminder for user {user_id}")

        except Exception as e:
            logger.error(f"Error creating payment reminder: {e}")
            db.session.rollback()

    def send_scheduled_notifications(self):
        """Gửi các notification đã được lên lịch"""
        if not self.app:
            return

        with self.app.app_context():
            try:
                # Lấy các notification pending và scheduled_at <= now
                notifications = Notification.query.filter(
                    Notification.status == 'pending',
                    Notification.scheduled_at <= datetime.now()
                ).limit(50).all()

                if notifications:
                    logger.info(f"📤 Sending {len(notifications)} scheduled notifications...")

                for notif in notifications:
                    try:
                        # Đánh dấu là sent
                        notif.status = 'sent'
                        notif.sent_at = datetime.now()
                        db.session.commit()

                        # TODO: Nếu có email/SMS service, gửi thêm ở đây

                    except Exception as e:
                        logger.error(f"Error sending notification {notif.id}: {e}")
                        notif.status = 'failed'
                        db.session.commit()

            except Exception as e:
                logger.error(f"Error in send_scheduled_notifications: {e}")

# Global scheduler instance
reminder_scheduler = ReminderScheduler()
