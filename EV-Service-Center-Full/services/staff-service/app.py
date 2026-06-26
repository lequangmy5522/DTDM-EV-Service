import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

# Initialize Extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    """Create and configure Flask app for Staff Service"""
    app = Flask(__name__)
    CORS(app)

    # ===== CONFIGURATION =====
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["INTERNAL_SERVICE_TOKEN"] = os.getenv("INTERNAL_SERVICE_TOKEN")

    # ===== INITIALIZE EXTENSIONS =====
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db, directory='migrations', version_table='alembic_version_staff')

    # ===== IMPORT MODELS & CREATE TABLES =====
    with app.app_context():
        from models.staff_model import Staff, StaffCertificate, StaffShift, StaffAssignment, StaffPerformance
        db.create_all()

    # ===== REGISTER BLUEPRINTS =====
    from controllers.staff_controller import staff_bp
    from controllers.shift_controller import shift_bp
    from controllers.assignment_controller import assignment_bp
    from controllers.certificate_controller import certificate_bp
    from controllers.performance_controller import performance_bp
    from controllers.internal_controller import internal_bp

    app.register_blueprint(staff_bp)
    app.register_blueprint(shift_bp)
    app.register_blueprint(assignment_bp)
    app.register_blueprint(certificate_bp)
    app.register_blueprint(performance_bp)
    app.register_blueprint(internal_bp)

    # ===== HEALTH CHECK =====
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "Staff Service is running!"}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=8008, debug=True)
