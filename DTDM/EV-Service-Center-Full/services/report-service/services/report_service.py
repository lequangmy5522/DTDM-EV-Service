import requests
from flask import current_app
from datetime import datetime, timedelta
from functools import wraps

class ReportService:
    """Service tổng hợp dữ liệu từ các microservice khác để tạo báo cáo"""

    @staticmethod
    def _call_internal_api(service_url, endpoint, method="GET", json_data=None):
        """Gọi Internal API của các service khác"""
        internal_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
        url = f"{service_url}{endpoint}"
        headers = {"X-Internal-Token": internal_token}

        if not service_url or not internal_token:
            return None, "Lỗi cấu hình Service URL hoặc Internal Token"

        try:
            response = requests.request(method, url, headers=headers, json=json_data, timeout=10)
            if response.status_code in [200, 201]:
                return response.json(), None
            else:
                error_msg = response.json().get('error', f"Lỗi Service (HTTP {response.status_code})")
                return None, error_msg
        except requests.exceptions.RequestException as e:
            return None, f"Lỗi kết nối Service: {str(e)}"

    # ==================== BÁO CÁO DOANH THU ====================
    
    @staticmethod
    def get_revenue_report(start_date=None, end_date=None):
        """
        Báo cáo doanh thu từ Payment Service
        Args:
            start_date: Ngày bắt đầu (YYYY-MM-DD)
            end_date: Ngày kết thúc (YYYY-MM-DD)
        """
        payment_url = current_app.config.get("PAYMENT_SERVICE_URL")
        
        # Lấy tất cả giao dịch thành công
        transactions, error = ReportService._call_internal_api(
            payment_url, 
            "/internal/payments/all"
        )
        
        if error:
            return None, error
        
        # Lọc giao dịch success trong khoảng thời gian
        successful_transactions = [t for t in transactions if t.get('status') == 'success']

        if start_date and end_date:
            # Parse dates - nếu chỉ có ngày thì thêm time để so sánh đúng
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if 'T' not in end_date:
                # Nếu end_date chỉ là date, thêm 23:59:59 để bao gồm cả ngày
                end = datetime.fromisoformat(end_date + 'T23:59:59')
            else:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

            successful_transactions = [
                t for t in successful_transactions
                if start <= datetime.fromisoformat(t['created_at'].replace('Z', '+00:00')) <= end
            ]
        
        # Tính toán thống kê
        total_revenue = sum(t.get('amount', 0) for t in successful_transactions)
        transaction_count = len(successful_transactions)
        avg_transaction = total_revenue / transaction_count if transaction_count > 0 else 0
        
        # Thống kê theo phương thức thanh toán
        payment_methods = {}
        for t in successful_transactions:
            method = t.get('method', 'unknown')
            if method not in payment_methods:
                payment_methods[method] = {'count': 0, 'amount': 0}
            payment_methods[method]['count'] += 1
            payment_methods[method]['amount'] += t.get('amount', 0)
        
        return {
            "total_revenue": total_revenue,
            "transaction_count": transaction_count,
            "avg_transaction_value": avg_transaction,
            "payment_methods": payment_methods,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }, None

    # ==================== BÁO CÁO KHO ====================
    
    @staticmethod
    def get_inventory_report():
        """Báo cáo tình trạng kho từ Inventory Service"""
        inventory_url = current_app.config.get("INVENTORY_SERVICE_URL")
        
        # Lấy tất cả parts
        parts, error = ReportService._call_internal_api(
            inventory_url,
            "/internal/parts/all"
        )
        
        if error:
            return None, error
        
        # Phân loại parts
        low_stock_parts = [p for p in parts if p.get('quantity', 0) < 10]
        out_of_stock_parts = [p for p in parts if p.get('quantity', 0) == 0]
        
        # Tính giá trị tồn kho
        total_inventory_value = sum(
            p.get('quantity', 0) * p.get('price', 0) 
            for p in parts
        )
        
        total_parts = len(parts)
        total_quantity = sum(p.get('quantity', 0) for p in parts)
        
        return {
            "total_parts": total_parts,
            "total_quantity": total_quantity,
            "total_inventory_value": total_inventory_value,
            "low_stock_count": len(low_stock_parts),
            "out_of_stock_count": len(out_of_stock_parts),
            "low_stock_parts": low_stock_parts,
            "out_of_stock_parts": out_of_stock_parts
        }, None

    # ==================== DASHBOARD TỔNG QUAN ====================
    
    @staticmethod
    def get_dashboard_overview():
        """Dashboard tổng quan tất cả các metrics quan trọng"""
        
        # 1. Doanh thu hôm nay và tháng này
        today = datetime.now().date()
        month_start = today.replace(day=1)
        
        revenue_today, _ = ReportService.get_revenue_report(
            start_date=today.isoformat(),
            end_date=today.isoformat()
        )
        
        revenue_month, _ = ReportService.get_revenue_report(
            start_date=month_start.isoformat(),
            end_date=today.isoformat()
        )
        
        # 2. Thông tin kho
        inventory_report, _ = ReportService.get_inventory_report()
        
        # 3. Thống kê booking (nếu có API)
        booking_url = current_app.config.get("BOOKING_SERVICE_URL")
        bookings, _ = ReportService._call_internal_api(
            booking_url,
            "/internal/bookings/all"
        )
        
        booking_stats = {
            "total": len(bookings) if bookings else 0,
            "pending": len([b for b in (bookings or []) if b.get('status') == 'pending']),
            "confirmed": len([b for b in (bookings or []) if b.get('status') == 'confirmed']),
            "completed": len([b for b in (bookings or []) if b.get('status') == 'completed'])
        }
        
        return {
            "revenue": {
                "today": revenue_today or {"total_revenue": 0, "transaction_count": 0},
                "month": revenue_month or {"total_revenue": 0, "transaction_count": 0}
            },
            "inventory": inventory_report or {
                "total_parts": 0,
                "low_stock_count": 0,
                "out_of_stock_count": 0
            },
            "bookings": booking_stats,
            "timestamp": datetime.now().isoformat()
        }, None
