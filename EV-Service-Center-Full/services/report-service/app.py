import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

jwt = JWTManager()

def create_app():
    """Tạo và cấu hình Flask app cho Report Service"""
    app = Flask(__name__)
    CORS(app)

    # JWT Configuration
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if jwt_secret:
        app.config["JWT_SECRET_KEY"] = jwt_secret.strip()
    
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False

    # Internal Service Token
    internal_token = os.getenv("INTERNAL_SERVICE_TOKEN")
    if internal_token:
        app.config["INTERNAL_SERVICE_TOKEN"] = internal_token.strip()

    # Service URLs
    app.config["FINANCE_SERVICE_URL"] = os.getenv("FINANCE_SERVICE_URL")
    app.config["PAYMENT_SERVICE_URL"] = os.getenv("PAYMENT_SERVICE_URL")
    app.config["INVENTORY_SERVICE_URL"] = os.getenv("INVENTORY_SERVICE_URL")
    app.config["BOOKING_SERVICE_URL"] = os.getenv("BOOKING_SERVICE_URL")
    app.config["MAINTENANCE_SERVICE_URL"] = os.getenv("MAINTENANCE_SERVICE_URL")

    jwt.init_app(app)

    # Register Blueprints
    from controllers.report_controller import report_bp
    app.register_blueprint(report_bp)

    # Health Check
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "Report Service is running!"}), 200

    return app
