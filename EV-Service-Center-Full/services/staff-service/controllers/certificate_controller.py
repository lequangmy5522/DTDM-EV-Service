from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from models.staff_model import StaffCertificate, Staff
from datetime import datetime

certificate_bp = Blueprint("certificates", __name__, url_prefix="/api/certificates")


@certificate_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_certificates():
    """Lấy danh sách chứng chỉ"""
    try:
        staff_id = request.args.get('staff_id', type=int)
        status = request.args.get('status')

        query = StaffCertificate.query

        if staff_id:
            query = query.filter(StaffCertificate.staff_id == staff_id)
        if status:
            query = query.filter(StaffCertificate.status == status)

        certificates = query.order_by(StaffCertificate.created_at.desc()).all()

        return jsonify({
            "success": True,
            "certificates": [c.to_dict() for c in certificates],
            "count": len(certificates)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@certificate_bp.route("/", methods=["POST"])
@jwt_required()
def create_certificate():
    """
    Thêm chứng chỉ mới

    Body:
    {
        "staff_id": 1,
        "certificate_name": "EV Battery Specialist",
        "certificate_type": "ev_certification",
        "issued_date": "2024-01-01",
        "expiry_date": "2026-01-01",
        "issuing_organization": "VinFast Academy",
        "certificate_number": "EVBS-2024-001"
    }
    """
    try:
        data = request.get_json()

        # Validate required fields
        required = ['staff_id', 'certificate_name', 'certificate_type']
        if not all(field in data for field in required):
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Check if staff exists
        staff = Staff.query.get(data['staff_id'])
        if not staff:
            return jsonify({"success": False, "error": "Staff not found"}), 404

        certificate = StaffCertificate(
            staff_id=data['staff_id'],
            certificate_name=data['certificate_name'],
            certificate_type=data['certificate_type'],
            issued_date=datetime.fromisoformat(data['issued_date']).date() if data.get('issued_date') else None,
            expiry_date=datetime.fromisoformat(data['expiry_date']).date() if data.get('expiry_date') else None,
            issuing_organization=data.get('issuing_organization'),
            certificate_number=data.get('certificate_number'),
            certificate_file_url=data.get('certificate_file_url'),
            notes=data.get('notes'),
            status='valid'
        )

        db.session.add(certificate)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Certificate added successfully",
            "certificate": certificate.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@certificate_bp.route("/<int:certificate_id>", methods=["PUT"])
@jwt_required()
def update_certificate(certificate_id):
    """Cập nhật chứng chỉ"""
    try:
        certificate = StaffCertificate.query.get(certificate_id)
        if not certificate:
            return jsonify({"success": False, "error": "Certificate not found"}), 404

        data = request.get_json()

        if 'certificate_name' in data:
            certificate.certificate_name = data['certificate_name']
        if 'certificate_type' in data:
            certificate.certificate_type = data['certificate_type']
        if 'issued_date' in data:
            certificate.issued_date = datetime.fromisoformat(data['issued_date']).date()
        if 'expiry_date' in data:
            certificate.expiry_date = datetime.fromisoformat(data['expiry_date']).date()
        if 'issuing_organization' in data:
            certificate.issuing_organization = data['issuing_organization']
        if 'certificate_number' in data:
            certificate.certificate_number = data['certificate_number']
        if 'certificate_file_url' in data:
            certificate.certificate_file_url = data['certificate_file_url']
        if 'status' in data:
            certificate.status = data['status']
        if 'notes' in data:
            certificate.notes = data['notes']

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Certificate updated successfully",
            "certificate": certificate.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@certificate_bp.route("/<int:certificate_id>", methods=["DELETE"])
@jwt_required()
def delete_certificate(certificate_id):
    """Xóa chứng chỉ"""
    try:
        certificate = StaffCertificate.query.get(certificate_id)
        if not certificate:
            return jsonify({"success": False, "error": "Certificate not found"}), 404

        db.session.delete(certificate)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Certificate deleted successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@certificate_bp.route("/expiring-soon", methods=["GET"])
@jwt_required()
def get_expiring_certificates():
    """Lấy danh sách chứng chỉ sắp hết hạn (trong vòng 30 ngày)"""
    try:
        from datetime import timedelta

        today = datetime.now().date()
        expiry_threshold = today + timedelta(days=30)

        certificates = StaffCertificate.query.filter(
            StaffCertificate.expiry_date <= expiry_threshold,
            StaffCertificate.expiry_date >= today,
            StaffCertificate.status == 'valid'
        ).all()

        return jsonify({
            "success": True,
            "certificates": [c.to_dict() for c in certificates],
            "count": len(certificates)
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
