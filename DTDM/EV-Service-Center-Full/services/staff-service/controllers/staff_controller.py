from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from models.staff_model import Staff
from datetime import datetime
import requests
import os

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:5000")
MAINTENANCE_SERVICE_URL = os.getenv("MAINTENANCE_SERVICE_URL", "http://maintenance-service:8003")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN")


def get_technician_completed_tasks(user_id):
    """Lấy số tasks hoàn thành từ maintenance-service"""
    try:
        response = requests.get(
            f"{MAINTENANCE_SERVICE_URL}/internal/maintenance/technician/{user_id}/stats",
            headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
            timeout=5
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data.get('stats', {}).get('completed_tasks', 0)

        return 0
    except Exception as e:
        print(f"Error fetching technician stats for user {user_id}: {e}")
        return 0


def sync_staff_from_users():
    """Đồng bộ danh sách staff từ user-service"""
    try:
        # Call internal API của user-service để lấy danh sách users
        response = requests.get(
            f"{USER_SERVICE_URL}/internal/users",
            headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
            timeout=5
        )

        if response.status_code != 200:
            return []

        users_data = response.json()
        users = users_data.get('users', [])

        staff_list = []

        for user in users:
            user_role = user.get('role', '').lower()

            # Chỉ lấy technician và admin
            if user_role not in ['technician', 'admin']:
                continue

            # Map role từ user sang staff
            staff_role_map = {
                'technician': 'technician',
                'admin': 'manager'
            }
            staff_role = staff_role_map.get(user_role, 'technician')

            # Kiểm tra xem staff đã tồn tại chưa (dựa vào user_id)
            staff = Staff.query.filter_by(user_id=user['id']).first()

            # Ensure full_name is never None
            full_name = user.get('full_name') or user.get('username') or f"User {user['id']}"
            email = user.get('email') or f"user{user['id']}@example.com"

            # Lấy số tasks hoàn thành từ maintenance-service (chỉ cho technician)
            completed_tasks = 0
            if user_role == 'technician':
                completed_tasks = get_technician_completed_tasks(user['id'])

            if not staff:
                # Tạo mới staff từ user
                staff = Staff(
                    user_id=user['id'],
                    full_name=full_name,
                    email=email,
                    phone=user.get('phone'),
                    role=staff_role,
                    specialization='general',  # Default
                    status='active',
                    employee_code=f"EMP{user['id']:04d}",
                    total_tasks_completed=completed_tasks
                )
                db.session.add(staff)
            else:
                # Cập nhật thông tin từ user
                staff.full_name = full_name
                staff.email = email
                staff.phone = user.get('phone')
                staff.role = staff_role
                staff.total_tasks_completed = completed_tasks

            staff_list.append(staff)

        db.session.commit()
        return staff_list

    except Exception as e:
        print(f"Error syncing staff from users: {e}")
        db.session.rollback()
        return []


@staff_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_staff():
    """Lấy danh sách tất cả nhân viên (tự động sync từ user-service)"""
    try:
        # Tự động sync từ user-service
        sync_staff_from_users()

        # Filter parameters
        role = request.args.get('role')
        specialization = request.args.get('specialization')
        status = request.args.get('status', 'active')

        query = Staff.query

        if role:
            query = query.filter(Staff.role == role)
        if specialization:
            query = query.filter(Staff.specialization == specialization)
        if status:
            query = query.filter(Staff.status == status)

        staff_list = query.order_by(Staff.created_at.desc()).all()

        return jsonify({
            "success": True,
            "staff": [s.to_dict() for s in staff_list],
            "count": len(staff_list)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@staff_bp.route("/<int:staff_id>", methods=["GET"])
@jwt_required()
def get_staff_detail(staff_id):
    """Lấy chi tiết một nhân viên"""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        staff_data = staff.to_dict()

        # Include certificates, shifts, and assignments
        staff_data['certificates'] = [c.to_dict() for c in staff.certificates]
        staff_data['recent_shifts'] = [s.to_dict() for s in staff.shifts[:10]]
        staff_data['recent_assignments'] = [a.to_dict() for a in staff.assignments[:10]]

        return jsonify({
            "success": True,
            "staff": staff_data
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@staff_bp.route("/", methods=["POST"])
@jwt_required()
def create_staff():
    """Tạo mới nhân viên (tự động tạo user account với mật khẩu mặc định '1')"""
    try:
        data = request.get_json()

        # Validate required fields
        required = ['full_name', 'email', 'role']
        if not all(field in data for field in required):
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Check if email already exists in staff table
        existing = Staff.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({"success": False, "error": "Email already exists"}), 400

        # Step 1: Tạo user account tự động qua user-service
        # Map staff role to user role
        staff_role = data['role'].lower()
        user_role_map = {
            'technician': 'technician',
            'manager': 'admin',
            'supervisor': 'admin'
        }
        user_role = user_role_map.get(staff_role, 'technician')

        # Generate username from email (before @ sign)
        username = data['email'].split('@')[0]

        # Call user-service to create user account
        user_payload = {
            'username': username,
            'email': data['email'],
            'full_name': data['full_name'],
            'role': user_role,
            'phone': data.get('phone')
        }

        try:
            user_response = requests.post(
                f"{USER_SERVICE_URL}/internal/users/create",
                json=user_payload,
                headers={"X-Internal-Token": INTERNAL_SERVICE_TOKEN},
                timeout=5
            )

            if user_response.status_code != 201:
                error_msg = user_response.json().get('error', 'Failed to create user account')
                return jsonify({
                    "success": False,
                    "error": f"User creation failed: {error_msg}"
                }), 400

            user_data = user_response.json().get('user', {})
            user_id = user_data.get('id')

        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Failed to connect to user service: {str(e)}"
            }), 500

        # Step 2: Tạo staff record với user_id vừa tạo
        staff = Staff(
            user_id=user_id,
            full_name=data['full_name'],
            email=data['email'],
            phone=data.get('phone'),
            role=data['role'],
            specialization=data.get('specialization', 'general'),
            status=data.get('status', 'active'),
            hire_date=datetime.fromisoformat(data['hire_date']) if data.get('hire_date') else None,
            department=data.get('department'),
            employee_code=f"EMP{user_id:04d}"  # Auto-generate employee code
        )

        db.session.add(staff)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Staff and user account created successfully. Default password is '1'",
            "staff": staff.to_dict(),
            "user_info": {
                "username": username,
                "default_password": "1"
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@staff_bp.route("/<int:staff_id>", methods=["PUT"])
@jwt_required()
def update_staff(staff_id):
    """Cập nhật thông tin nhân viên"""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        data = request.get_json()

        # Update fields
        if 'full_name' in data:
            staff.full_name = data['full_name']
        if 'email' in data:
            staff.email = data['email']
        if 'phone' in data:
            staff.phone = data['phone']
        if 'role' in data:
            staff.role = data['role']
        if 'specialization' in data:
            staff.specialization = data['specialization']
        if 'status' in data:
            staff.status = data['status']
        if 'department' in data:
            staff.department = data['department']
        if 'employee_code' in data:
            staff.employee_code = data['employee_code']

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Staff updated successfully",
            "staff": staff.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@staff_bp.route("/<int:staff_id>", methods=["DELETE"])
@jwt_required()
def delete_staff(staff_id):
    """Xóa nhân viên (soft delete - chuyển status sang resigned)"""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        staff.status = 'resigned'
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Staff deleted successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@staff_bp.route("/available", methods=["GET"])
@jwt_required()
def get_available_staff():
    """Lấy danh sách nhân viên có sẵn (không busy)"""
    try:
        date_str = request.args.get('date')
        shift_type = request.args.get('shift_type')

        staff_list = Staff.query.filter(
            Staff.status.in_(['active'])
        ).all()

        # TODO: Filter by shift availability

        return jsonify({
            "success": True,
            "staff": [s.to_dict() for s in staff_list],
            "count": len(staff_list)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
