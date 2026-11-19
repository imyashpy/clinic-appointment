from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_clinic_scope, require_roles
from app.core.database import get_db
from app.models import (
    Appointment,
    AuditLog,
    Clinic,
    Doctor,
    Patient,
    Payment,
    Refund,
    User,
)
from app.schemas.admin_views import (
    AdminAppointmentPage,
    AdminAppointmentRow,
    AuditPage,
    AuditRow,
    PaymentPage,
    PaymentRow,
    RefundPage,
    RefundRow,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


def _day_range(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    return start, start + timedelta(days=1)


@router.get("/appointments", response_model=AdminAppointmentPage)
def all_appointments(
    day: date | None = Query(None, description="Appointment date"),
    clinic_id: int | None = Query(None),
    doctor_id: int | None = Query(None),
    status: str | None = Query(None, max_length=20),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Appointment, Patient, Doctor, User, Clinic)
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .join(Clinic, Clinic.id == Appointment.clinic_id)
    )
    if clinic_scope:
        query = query.filter(Appointment.clinic_id == clinic_scope)
    elif clinic_id:
        query = query.filter(Appointment.clinic_id == clinic_id)
    if day:
        start, end = _day_range(day)
        query = query.filter(Appointment.start_at >= start, Appointment.start_at < end)
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)
    if status:
        query = query.filter(Appointment.status == status)

    total = query.count()
    rows = (
        query.order_by(Appointment.start_at.desc()).offset(offset).limit(limit).all()
    )
    return AdminAppointmentPage(
        total=total,
        items=[
            AdminAppointmentRow(
                id=a.id,
                booking_reference=a.booking_reference,
                patient_name=p.full_name,
                patient_phone=p.phone,
                doctor_name=du.name,
                clinic_name=c.name,
                start_at=a.start_at,
                status=a.status,
                payment_status=a.payment_status,
                consultation_fee=a.consultation_fee,
                token_amount=a.token_amount,
            )
            for a, p, d, du, c in rows
        ],
    )


@router.get("/payments", response_model=PaymentPage)
def all_payments(
    day: date | None = Query(None, description="Date the payment was created"),
    payment_type: str | None = Query(None, max_length=20),
    status: str | None = Query(None, max_length=20),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Payment, Appointment, User)
        .join(Appointment, Appointment.id == Payment.appointment_id)
        .outerjoin(User, User.id == Payment.collected_by_user_id)
    )
    if clinic_scope:
        query = query.filter(Appointment.clinic_id == clinic_scope)
    if day:
        start, end = _day_range(day)
        query = query.filter(Payment.created_at >= start, Payment.created_at < end)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type)
    if status:
        query = query.filter(Payment.status == status)

    total = query.count()
    rows = query.order_by(Payment.id.desc()).offset(offset).limit(limit).all()
    return PaymentPage(
        total=total,
        items=[
            PaymentRow(
                id=p.id,
                appointment_id=a.id,
                booking_reference=a.booking_reference,
                payment_type=p.payment_type,
                method=p.method,
                status=p.status,
                amount=p.amount,
                transaction_reference=p.transaction_reference,
                paid_at=p.paid_at,
                collected_by=u.name if u else None,
            )
            for p, a, u in rows
        ],
    )


@router.get("/refunds", response_model=RefundPage)
def all_refunds(
    day: date | None = Query(None, description="Date the refund was created"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = db.query(Refund, Appointment).join(
        Appointment, Appointment.id == Refund.appointment_id
    )
    if clinic_scope:
        query = query.filter(Appointment.clinic_id == clinic_scope)
    if day:
        start, end = _day_range(day)
        query = query.filter(Refund.created_at >= start, Refund.created_at < end)

    total = query.count()
    rows = query.order_by(Refund.id.desc()).offset(offset).limit(limit).all()
    return RefundPage(
        total=total,
        items=[
            RefundRow(
                id=r.id,
                appointment_id=a.id,
                booking_reference=a.booking_reference,
                amount=r.amount,
                status=r.status,
                transaction_reference=r.transaction_reference,
                reason=r.reason,
                processed_at=r.processed_at,
            )
            for r, a in rows
        ],
    )


@router.get("/audit-logs", response_model=AuditPage)
def audit_logs(
    action: str | None = Query(None, max_length=60),
    entity_type: str | None = Query(None, max_length=40),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)
    if clinic_scope:
        query = query.filter(AuditLog.clinic_id == clinic_scope)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    total = query.count()
    rows = query.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
    return AuditPage(
        total=total,
        items=[
            AuditRow(
                id=log.id,
                user_name=u.name if u else None,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=log.details,
                created_at=log.created_at,
            )
            for log, u in rows
        ],
    )