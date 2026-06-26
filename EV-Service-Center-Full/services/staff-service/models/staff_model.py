from datetime import datetime
from app import db
from sqlalchemy import func

class Staff(db.Model):
    """Nhân viên kỹ thuật"""
    __tablename__ = "staff"

    id = db.Column(db.Integer, primary_key=True, index=True)
    user_id = db.Column(db.Integer, nullable=True, index=True)  # Liên kết với user-service

    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)

    role = db.Column(
        db.Enum("technician", "senior_technician", "team_leader", "manager", "admin",
                name="staff_roles"),
        nullable=False,
        default="technician"
    )

    specialization = db.Column(
        db.Enum("ev_specialist", "battery_expert", "electrical_systems",
                "mechanical_systems", "diagnostics", "general",
                name="staff_specializations"),
        nullable=False,
        default="general"
    )

    status = db.Column(
        db.Enum("active", "on_leave", "busy", "resigned", name="staff_statuses"),
        nullable=False,
        default="active"
    )

    hire_date = db.Column(db.Date, nullable=True)
    department = db.Column(db.String(50), nullable=True)
    employee_code = db.Column(db.String(20), unique=True, nullable=True)

    # Metrics
    total_tasks_completed = db.Column(db.Integer, default=0)
    average_rating = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    # Relationships
    certificates = db.relationship('StaffCertificate', backref='staff', lazy=True, cascade='all, delete-orphan')
    shifts = db.relationship('StaffShift', backref='staff', lazy=True, cascade='all, delete-orphan')
    assignments = db.relationship('StaffAssignment', backref='staff', lazy=True, cascade='all, delete-orphan')
    performance_records = db.relationship('StaffPerformance', backref='staff', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "role": str(self.role),
            "specialization": str(self.specialization),
            "status": str(self.status),
            "hire_date": self.hire_date.isoformat() if self.hire_date else None,
            "department": self.department,
            "employee_code": self.employee_code,
            "total_tasks_completed": self.total_tasks_completed,
            "average_rating": self.average_rating,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class StaffCertificate(db.Model):
    """Chứng chỉ chuyên môn của nhân viên"""
    __tablename__ = "staff_certificates"

    id = db.Column(db.Integer, primary_key=True, index=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('staff.id'), nullable=False, index=True)

    certificate_name = db.Column(db.String(200), nullable=False)
    certificate_type = db.Column(
        db.Enum("ev_certification", "battery_safety", "electrical_engineering",
                "mechanical_engineering", "diagnostic_tools", "safety_training", "other",
                name="certificate_types"),
        nullable=False
    )

    issued_date = db.Column(db.Date, nullable=True)
    expiry_date = db.Column(db.Date, nullable=True)
    issuing_organization = db.Column(db.String(200), nullable=True)
    certificate_number = db.Column(db.String(100), nullable=True)
    certificate_file_url = db.Column(db.String(500), nullable=True)

    status = db.Column(
        db.Enum("valid", "expired", "pending_renewal", name="certificate_statuses"),
        nullable=False,
        default="valid"
    )

    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "certificate_name": self.certificate_name,
            "certificate_type": str(self.certificate_type),
            "issued_date": self.issued_date.isoformat() if self.issued_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "issuing_organization": self.issuing_organization,
            "certificate_number": self.certificate_number,
            "certificate_file_url": self.certificate_file_url,
            "status": str(self.status),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class StaffShift(db.Model):
    """Ca làm việc của nhân viên"""
    __tablename__ = "staff_shifts"

    id = db.Column(db.Integer, primary_key=True, index=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('staff.id'), nullable=False, index=True)

    shift_date = db.Column(db.Date, nullable=False, index=True)
    shift_type = db.Column(
        db.Enum("morning", "afternoon", "night", "full_day", name="shift_types"),
        nullable=False
    )

    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

    status = db.Column(
        db.Enum("scheduled", "in_progress", "completed", "cancelled", "no_show",
                name="shift_statuses"),
        nullable=False,
        default="scheduled"
    )

    actual_start_time = db.Column(db.DateTime, nullable=True)
    actual_end_time = db.Column(db.DateTime, nullable=True)

    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "shift_date": self.shift_date.isoformat() if self.shift_date else None,
            "shift_type": str(self.shift_type),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": str(self.status),
            "actual_start_time": self.actual_start_time.isoformat() if self.actual_start_time else None,
            "actual_end_time": self.actual_end_time.isoformat() if self.actual_end_time else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class StaffAssignment(db.Model):
    """Phân công công việc cho nhân viên"""
    __tablename__ = "staff_assignments"

    id = db.Column(db.Integer, primary_key=True, index=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('staff.id'), nullable=False, index=True)
    maintenance_task_id = db.Column(db.Integer, nullable=False, index=True)  # Reference to maintenance-service

    assigned_at = db.Column(db.DateTime, nullable=False, default=func.now())
    assigned_by = db.Column(db.Integer, nullable=True)  # Manager/Admin user_id

    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    status = db.Column(
        db.Enum("assigned", "accepted", "in_progress", "completed", "cancelled",
                name="assignment_statuses"),
        nullable=False,
        default="assigned"
    )

    priority = db.Column(
        db.Enum("low", "medium", "high", "urgent", name="assignment_priorities"),
        nullable=False,
        default="medium"
    )

    estimated_duration_minutes = db.Column(db.Integer, nullable=True)
    actual_duration_minutes = db.Column(db.Integer, nullable=True)

    notes = db.Column(db.Text, nullable=True)
    completion_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "maintenance_task_id": self.maintenance_task_id,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "assigned_by": self.assigned_by,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": str(self.status),
            "priority": str(self.priority),
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "actual_duration_minutes": self.actual_duration_minutes,
            "notes": self.notes,
            "completion_notes": self.completion_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class StaffPerformance(db.Model):
    """Hiệu suất làm việc của nhân viên"""
    __tablename__ = "staff_performance"

    id = db.Column(db.Integer, primary_key=True, index=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('staff.id'), nullable=False, index=True)

    period_type = db.Column(
        db.Enum("weekly", "monthly", "quarterly", "yearly", name="period_types"),
        nullable=False,
        default="monthly"
    )

    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)

    # Metrics
    tasks_assigned = db.Column(db.Integer, default=0)
    tasks_completed = db.Column(db.Integer, default=0)
    tasks_cancelled = db.Column(db.Integer, default=0)

    avg_completion_time_minutes = db.Column(db.Float, default=0.0)
    on_time_completion_rate = db.Column(db.Float, default=0.0)  # Percentage

    customer_rating_avg = db.Column(db.Float, default=0.0)
    customer_rating_count = db.Column(db.Integer, default=0)

    manager_rating = db.Column(db.Float, nullable=True)
    manager_notes = db.Column(db.Text, nullable=True)

    total_work_hours = db.Column(db.Float, default=0.0)
    overtime_hours = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, nullable=False, default=func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "period_type": str(self.period_type),
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "tasks_assigned": self.tasks_assigned,
            "tasks_completed": self.tasks_completed,
            "tasks_cancelled": self.tasks_cancelled,
            "avg_completion_time_minutes": self.avg_completion_time_minutes,
            "on_time_completion_rate": self.on_time_completion_rate,
            "customer_rating_avg": self.customer_rating_avg,
            "customer_rating_count": self.customer_rating_count,
            "manager_rating": self.manager_rating,
            "manager_notes": self.manager_notes,
            "total_work_hours": self.total_work_hours,
            "overtime_hours": self.overtime_hours,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
