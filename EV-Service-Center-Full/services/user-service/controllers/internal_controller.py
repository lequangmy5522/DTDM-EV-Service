from flask import Blueprint, request, jsonify, current_app
from services.services_refactored import UserService
from models.user import User
from app import db

internal_bp = Blueprint("internal", __name__, url_prefix="/internal")

# Middleware để xác thực token nội bộ
@internal_bp.before_request
def verify_internal_token():
    token = request.headers.get("X-Internal-Token")
    expected_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
    if not token or token != expected_token:
        return jsonify({"error": "Unauthorized internal request"}), 403


# Lấy thông tin người dùng qua email hoặc id (cho các service khác gọi)
@internal_bp.route("/user/<int:user_id>", methods=["GET"])
def internal_get_user(user_id):
    user = UserService.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "Không tìm thấy người dùng"}), 404

    return jsonify({
        "id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    })


# Lấy danh sách tất cả users (cho staff-service sync)
@internal_bp.route("/users", methods=["GET"])
def internal_get_all_users():
    """Lấy danh sách tất cả users để sync sang staff-service"""
    try:
        role_filter = request.args.get('role')  # Optional filter by role

        query = User.query
        if role_filter:
            query = query.filter(User.role == role_filter)

        users = query.all()

        users_list = []
        for user in users:
            user_dict = {
                "id": user.user_id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "full_name": user.profile.full_name if user.profile else user.username,
                "phone": user.profile.phone_number if user.profile else None,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
            users_list.append(user_dict)

        return jsonify({
            "success": True,
            "users": users_list,
            "count": len(users_list)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Tạo user mới (được gọi từ staff-service khi tạo nhân viên mới)
@internal_bp.route("/users/create", methods=["POST"])
def internal_create_user():
    """Tạo user mới từ staff-service với mật khẩu mặc định"""
    try:
        data = request.get_json()

        # Validate required fields
        username = data.get('username')
        email = data.get('email')
        full_name = data.get('full_name')
        role = data.get('role', 'technician')  # Default role
        phone = data.get('phone')

        if not username or not email:
            return jsonify({
                "success": False,
                "error": "Username and email are required"
            }), 400

        # Check if username already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({
                "success": False,
                "error": f"Username '{username}' already exists"
            }), 400

        # Check if email already exists
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({
                "success": False,
                "error": f"Email '{email}' already exists"
            }), 400

        # Create new user with default password "1"
        new_user = User(
            username=username,
            email=email,
            role=role,
            status='active'
        )
        new_user.set_password("1")  # Default password

        db.session.add(new_user)
        db.session.flush()  # Get user_id before commit

        # Create profile
        from models.profile import Profile
        new_profile = Profile(
            user_id=new_user.user_id,
            full_name=full_name or username,
            phone_number=phone
        )
        db.session.add(new_profile)
        db.session.commit()

        return jsonify({
            "success": True,
            "user": {
                "id": new_user.user_id,
                "username": new_user.username,
                "email": new_user.email,
                "role": new_user.role,
                "full_name": new_profile.full_name,
                "phone": new_profile.phone_number
            },
            "message": "User created successfully with default password '1'"
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
