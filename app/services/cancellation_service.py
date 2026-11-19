import os
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    AuditLog,
    Patient,
    Payment,
    Slot,
    TokenCredit,
    User,
)


def _cutoff_hours() -> int:
    return int(os.getenv("CANCEL_CUTOFF_HOURS", "2"))


def _credit_days() -> int:
    return int(os.getenv("CREDIT_VALID_DAYS", "2"))


def cancel_by_patient(
    db: Session, user: User, appointment_id: int
) -> tuple[Appointment, TokenCredit]:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # Locks the row, so a double click cannot create two credits
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .with_for_update()
        .first()
    )
    if not appointment or appointment.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.status != "confirmed" or appointment.payment_status != "token_paid":
        raise HTTPException(
            status_code=409,
            detail="Cannot cancel: appointment is " + appointment.status,
        )

    now = datetime.now()
    hours = _cutoff_hours()
    if now > appointment.start_at - timedelta(hours=hours):
        raise HTTPException(
            status_code=409,
            detail=f"Cancelling is closed {hours} hours before the appointment",
        )

    # Everything paid toward the token counts, whether online or from an earlier credit
    paid_payments = (
        db.query(Payment)
        .filter(
            Payment.appointment_id == appointment.id,
            Payment.payment_type.in_(["token", "token_transfer"]),
            Payment.status == "success",
        )
        .all()
    )
    paid_amount = sum(p.amount for p in paid_payments)
    if paid_amount <= 0:
        raise HTTPException(
            status_code=409, detail="No verified token payment found for this appointment"
        )

    # Free the slot for other patients
    slot = (
        db.query(Slot).filter(Slot.id == appointment.slot_id).with_for_update().first()
    )
    if slot and slot.status == "booked":
        slot.status = "available"
        slot.locked_until = None

    credit = TokenCredit(
        patient_id=patient.id,
        source_appointment_id=appointment.id,
        amount=paid_amount,
        status="active",
        expires_at=now + timedelta(days=_credit_days()),
    )
    db.add(credit)

    appointment.status = "cancelled"
    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status="confirmed",
            new_status="cancelled",
            note=f"Cancelled by patient, token Rs {credit.amount} kept as credit",
        )
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="appointment_cancelled",
            entity_type="appointment",
            entity_id=appointment.id,
            details=f"credit={credit.amount}; expires={credit.expires_at:%Y-%m-%d %H:%M}",
        )
    )
    db.commit()
    return appointment, credit