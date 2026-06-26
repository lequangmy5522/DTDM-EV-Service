from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from services.payment_service import PaymentService

internal_bp = Blueprint("internal_payment", __name__, url_prefix="/internal/payments")

@internal_bp.before_request
def verify_internal_token():
    """Xác thực Internal Service Token"""
    token = request.headers.get("X-Internal-Token")
    expected_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")

    if not token or token != expected_token:
        return jsonify({"error": "Unauthorized internal request"}), 401

@internal_bp.route("/all", methods=["GET"])
def get_all_transactions():
    """Lấy tất cả giao dịch thanh toán (cho report-service)"""
    transactions = PaymentService.get_all_history()
    return jsonify([t.to_dict() for t in transactions]), 200


@internal_bp.route("/due-soon", methods=["GET"])
def get_payments_due_soon():
    """
    Lấy danh sách payments sắp đến hạn (cho notification-service)

    Logic nhắc nhở:
    - Nhắc trước 7 ngày, 3 ngày, và 1 ngày trước hạn thanh toán
    - Chỉ lấy payments có status = 'pending' hoặc 'partially_paid'

    Returns:
        {
            "success": true,
            "payments": [
                {
                    "id": 1,
                    "user_id": 123,
                    "amount": 500000,
                    "due_date": "2025-12-01",
                    "service_name": "Gói bảo dưỡng định kỳ",
                    "status": "pending",
                    "days_left": 5
                }
            ]
        }
    """
    try:
        # Lấy tất cả payments
        all_payments = PaymentService.get_all_history()

        today = datetime.now()
        remind_periods = [1, 3, 7]  # Nhắc trước 1, 3, 7 ngày

        payments_due_soon = []

        for payment in all_payments:
            # Chỉ nhắc cho payments chưa hoàn thành
            if payment.status not in ['pending', 'partially_paid']:
                continue

            # Kiểm tra nếu có due_date (một số payment có thể không có)
            # Giả sử payment có field created_at, tạm tính due_date = created_at + 30 days
            if hasattr(payment, 'due_date') and payment.due_date:
                due_date = payment.due_date
            elif hasattr(payment, 'created_at') and payment.created_at:
                # Nếu không có due_date, giả sử hạn thanh toán là 30 ngày sau khi tạo
                due_date = payment.created_at + timedelta(days=30)
            else:
                continue

            # Chuyển đổi sang datetime nếu cần
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date)

            # Tính số ngày còn lại
            days_left = (due_date - today).days

            # Chỉ nhắc nếu trong khoảng 1-7 ngày
            if 0 <= days_left <= 7 and days_left in remind_periods:
                payment_dict = payment.to_dict() if hasattr(payment, 'to_dict') else {}

                payments_due_soon.append({
                    "id": payment.id,
                    "user_id": payment.user_id if hasattr(payment, 'user_id') else None,
                    "amount": payment.amount if hasattr(payment, 'amount') else 0,
                    "due_date": due_date.isoformat(),
                    "service_name": payment_dict.get('service_name', 'Dịch vụ'),
                    "status": payment.status if hasattr(payment, 'status') else 'pending',
                    "days_left": days_left,
                    "description": payment_dict.get('description', '')
                })

        return jsonify({
            "success": True,
            "payments": payments_due_soon,
            "count": len(payments_due_soon)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in get_payments_due_soon: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@internal_bp.route("/health", methods=["GET"])
def internal_health():
    """Health check for internal API"""
    return jsonify({
        "success": True,
        "service": "payment-internal",
        "status": "healthy"
    }), 200
