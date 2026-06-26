"""
Gunicorn configuration file với scheduler hook
"""
import os

bind = "0.0.0.0:8004"
workers = 1
worker_class = "sync"

# Scheduler instance
scheduler = None

def on_starting(server):
    """
    Hook được gọi khi Gunicorn master process khởi động
    Đây là nơi tốt nhất để khởi động scheduler vì chỉ chạy 1 lần
    """
    print("🚀 Gunicorn master process starting...")

    # Import inside the hook to avoid circular imports
    from scheduler import init_scheduler
    from app import create_app

    # Create app instance
    app = create_app()

    # Start scheduler
    global scheduler
    scheduler = init_scheduler(app)
    print("✅ Scheduler initialized in Gunicorn master process")

def on_exit(server):
    """
    Hook được gọi khi Gunicorn master process shutdown
    Dọn dẹp scheduler
    """
    global scheduler
    if scheduler:
        try:
            scheduler.shutdown()
            print("✅ Scheduler shutdown successfully")
        except Exception as e:
            print(f"❌ Error shutting down scheduler: {e}")
