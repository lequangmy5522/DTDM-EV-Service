"""
Background Scheduler để tự động hủy giao dịch pending quá hạn
"""
from apscheduler.schedulers.background import BackgroundScheduler
from services.payment_service import PaymentService
import logging

logger = logging.getLogger(__name__)

def init_scheduler(app):
    """
    Khởi tạo scheduler với Flask app context
    Job chạy mỗi phút để kiểm tra và hủy giao dịch quá hạn
    """
    scheduler = BackgroundScheduler()

    def expire_pending_payments():
        """Wrapper function để chạy trong app context"""
        with app.app_context():
            try:
                print("⏰ Scheduler job running - checking for expired pending transactions...")
                expired_count = PaymentService.expire_pending_transactions()
                if expired_count == 0:
                    print("✅ No expired transactions found")
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}")
                print(f"❌ Scheduler error: {str(e)}")

    # Thêm job chạy mỗi phút
    scheduler.add_job(
        func=expire_pending_payments,
        trigger="interval",
        minutes=1,
        id="expire_pending_payments",
        name="Hủy giao dịch pending quá 1 phút",
        replace_existing=True
    )

    scheduler.start()
    logger.info("✅ Payment expiration scheduler started - checking every 1 minute")

    return scheduler
