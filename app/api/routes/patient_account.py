from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import (
    Appointment,
    Clinic,
    Doctor,
    Patient,
    Payment,
    TokenCredit,
    User,
)
from app.schemas.patient_views import (
    CreditRow,
    CreditsOut,
    NoShowRow,
    PaymentHistoryPage,
    PaymentHistoryRow,
    Receipt,
)
from app.services.expiry_service import expire_stale_bookings

router = APIRouter(prefix="/patients/me", tags=["Patient Account"])


def _me(db: Session, user: User) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient


@router.get("/payments", response_model=PaymentHistoryPage)
def payment_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    patient = _me(db, user)
    query = (
        db.query(Payment, Appointment, User)
        .join(Appointment, Appointment.id == Payment.appointment_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .filter(
            Appointment.patient_id == patient.id,
            # Only money that really moved, not pending or failed attempts
            Payment.status.in_(["success", "refunded"]),
        )
    )
    total = query.count()
    rows = (
        query.order_by(Payment.paid_at.desc(), Payment.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return PaymentHistoryPage(
        total=total,
        items=[
            PaymentHistoryRow(
                payment_id=p.id,
                booking_reference=a.booking_reference,
                doctor_name=du.name,
                appointment_start=a.start_at,
                payment_type=p.payment_type,
                method=p.method,
                status=p.status,
                amount=p.amount,
                transaction_reference=p.transaction_reference,
                paid_at=p.paid_at,
            )
            for p, a, du in rows
        ],
    )


@router.get("/receipts/{payment_id}", response_model=Receipt)
def receipt(
    payment_id: int,
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    patient = _me(db, user)
    row = (
        db.query(Payment, Appointment, Doctor, User, Clinic)
        .join(Appointment, Appointment.id == Payment.appointment_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .join(Clinic, Clinic.id == Appointment.clinic_id)
        .filter(Payment.id == payment_id, Appointment.patient_id == patient.id)
        .first()
    )
    # Same answer whether it does not exist or belongs to someone else
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment, appointment, doctor, doctor_user, clinic = row
    if payment.status not in ("success", "refunded") or payment.payment_type not in (
        "token",
        "remaining",
    ):
        raise HTTPException(
            status_code=404, detail="Receipts are issued for money payments only"
        )

    paid_so_far = int(
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.appointment_id == appointment.id,
            Payment.status == "success",
            Payment.payment_type.in_(["token", "token_transfer", "remaining"]),
        )
        .scalar()
    )
    balance_due = (
        0
        if appointment.payment_status == "fully_paid"
        else max(appointment.consultation_fee - paid_so_far, 0)
    )

    return Receipt(
        receipt_number=payment.transaction_reference,
        patient_name=patient.full_name,
        patient_phone=patient.phone,
        clinic_name=clinic.name,
        clinic_address=clinic.address,
        doctor_name=doctor_user.name,
        specialty=doctor.specialty,
        booking_reference=appointment.booking_reference,
        appointment_start=appointment.start_at,
        appointment_end=appointment.end_at,
        payment_type=payment.payment_type,
        method=payment.method,
        payment_status=payment.status,
        amount=payment.amount,
        paid_at=payment.paid_at,
        consultation_fee=appointment.consultation_fee,
        token_amount=appointment.token_amount,
        paid_so_far=paid_so_far,
        balance_due=balance_due,
    )


@router.get("/credits", response_model=CreditsOut)
def my_credits(
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    patient = _me(db, user)
    expire_stale_bookings(db, patient.id)  # also marks old credits as expired

    rows = (
        db.query(TokenCredit, Appointment)
        .join(Appointment, Appointment.id == TokenCredit.source_appointment_id)
        .filter(TokenCredit.patient_id == patient.id)
        .order_by(TokenCredit.id.desc())
        .all()
    )

    used_ids = [c.used_for_appointment_id for c, _ in rows if c.used_for_appointment_id]
    used_refs = {}
    if used_ids:
        used_refs = dict(
            db.query(Appointment.id, Appointment.booking_reference)
            .filter(Appointment.id.in_(used_ids))
            .all()
        )

    items = [
        CreditRow(
            id=c.id,
            amount=c.amount,
            status=c.status,
            expires_at=c.expires_at,
            source_booking_reference=a.booking_reference,
            source_start_at=a.start_at,
            used_for_booking_reference=used_refs.get(c.used_for_appointment_id),
        )
        for c, a in rows
    ]
    return CreditsOut(
        active_total=sum(i.amount for i in items if i.status == "active"),
        items=items,
    )


@router.get("/no-shows", response_model=list[NoShowRow])
def my_no_shows(
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    patient = _me(db, user)
    rows = (
        db.query(Appointment, User)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .filter(Appointment.patient_id == patient.id, Appointment.status == "no_show")
        .order_by(Appointment.start_at.desc())
        .all()
    )
    return [
        NoShowRow(
            appointment_id=a.id,
            booking_reference=a.booking_reference,
            doctor_name=du.name,
            start_at=a.start_at,
            token_forfeited=a.token_amount if a.payment_status == "token_paid" else 0,
        )
        for a, du in rows
    ]