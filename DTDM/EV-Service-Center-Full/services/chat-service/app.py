import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_socketio import SocketIO

db = SQLAlchemy()
socketio = SocketIO()

def create_app():
    app = Flask(__name__)

    # CORS configuration
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
    CORS(app, resources={
        r"/*": {
            "origins": allowed_origins,
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "supports_credentials": True
        }
    })

    # Configuration
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql://ev_user:ev_pass@localhost:5432/ev_chat_db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "supersecretkey")

    # Initialize extensions
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins=allowed_origins, async_mode='eventlet')

    @app.route("/health", methods=["GET"])
    def health():
        return {"status": "healthy", "service": "chat-service"}, 200

    # Register blueprints
    with app.app_context():
        from src.models import chat_model
        from src.controllers.chat_controller import chat_bp
        import src.controllers.socket_controller

        app.register_blueprint(chat_bp)

        # Create tables
        db.create_all()
        print("✅ [Chat Service] Database tables created")

    return app

if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=8007, debug=True)
