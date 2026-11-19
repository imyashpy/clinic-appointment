import os
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Appointment, Patient, Payment, User
from app.schemas.appointment import AppointmentOut, BookRequest
from app.services.booking_service import start_booking, to_appointment_out
from app.services.cancellation_service import cancel_by_patient
from app.services.expiry_service import expire_stale_bookings
from app.services.payment_service import confirm_token_payment

router = APIRouter(prefix="/appointments", tags=["Appointments"])

ACTIVE_STATUSES = [
    "payment_pending",
    "confirmed",
    "arrived",
    "waiting",
    "in_consultation",
]


class CancelResult(BaseModel):
    appointment_id: int
    booking_reference: str
    status: str
    credit_amount: int
    credit_valid_until: datetime
    message: str


def get_my_patient(user: User, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient


@router.post("", response_model=AppointmentOut, status_code=201)
def book(
    data: BookRequest,
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    appointment = start_booking(
        db, user, data.slot_id, data.reason, data.medical_notes
    )
    return to_appointment_out(db, appointment)


@router.get("/my", response_model=list[AppointmentOut])
def my_appointments(
    when: Literal["upcoming", "past", "all"] = Query("all"),
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    patient = get_my_patient(user, db)
    expire_stale_bookings(db, patient.id)

    now = datetime.now()
    query = db.query(Appointment).filter(Appointment.patient_id == patient.id)

    if when == "upcoming":
        query = query.filter(
            Appointment.status.in_(ACTIVE_STATUSES), Appointment.end_at > now
        ).order_by(Appointment.start_at)
    elif when == "past":
        query = query.filter(
            or_(
                ~Appointment.status.in_(ACTIVE_STATUSES),
                Appointment.end_at <= now,
            )
        ).order_by(Appointment.start_at.desc())
    else:
        query = query.order_by(Appointment.start_at.desc())

    return [to_appointment_out(db, a) for a in query.all()]


@router.post("/{appointment_id}/pay-mock", response_model=AppointmentOut)
def pay_mock(
    appointment_id: int,
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    # Development only: replaced by the real gateway callback later
    if os.getenv("ENABLE_MOCK_PAYMENT") != "true":
        raise HTTPException(status_code=404, detail="Not found")

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    appointment = db.get(Appointment, appointment_id)
    if not patient or not appointment or appointment.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    payment = (
        db.query(Payment)
        .filter(
            Payment.appointment_id == appointment.id,
            Payment.payment_type == "token",
        )
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    appointment = confirm_token_payment(
        db,
        payment.transaction_reference,
        "mock",
        "MOCK-" + uuid.uuid4().hex[:16].upper(),
        user.id,
    )
    return to_appointment_out(db, appointment)


@router.post("/{appointment_id}/cancel", response_model=CancelResult)
def cancel(
    appointment_id: int,
    user: User = Depends(require_roles("patient")),
    db: Session = Depends(get_db),
):
    appointment, credit = cancel_by_patient(db, user, appointment_id)
    return CancelResult(
        appointment_id=appointment.id,
        booking_reference=appointment.booking_reference,
        status=appointment.status,
        credit_amount=credit.amount,
        credit_valid_until=credit.expires_at,
        message=(
            f"Rs {credit.amount} is kept for you until {credit.expires_at:%d %b %Y, %I:%M %p}. "
            "Book a new slot or collect it at the hospital."
        ),
    )