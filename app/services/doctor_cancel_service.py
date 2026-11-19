import os
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    AuditLog,
    Doctor,
    Patient,
    Payment,
    Slot,
    TokenCredit,
    User,
)


def _credit_days() -> int:
    return int(os.getenv("DOCTOR_CANCEL_CREDIT_DAYS", "30"))


def cancel_by_doctor(
    db: Session, user: User, doctor: Doctor, appointment_id: int, reason: str
) -> tuple[Appointment, TokenCredit, Patient]:
    # Locks the row, so a double click cannot create two credits
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .with_for_update()
        .first()
    )
    # Same answer whether it does not exist or belongs to another doctor
    if not appointment or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.status != "confirmed" or appointment.payment_status != "token_paid":
        raise HTTPException(
            status_code=409,
            detail="Cannot cancel: appointment is " + appointment.status,
        )

    now = datetime.now()
    if appointment.start_at <= now:
        raise HTTPException(
            status_code=409,
            detail="This appointment has already started or passed",
        )

    # Everything paid toward the token counts, online or from an earlier credit
    paid_amount = sum(
        p.amount
        for p in db.query(Payment).filter(
            Payment.appointment_id == appointment.id,
            Payment.payment_type.in_(["token", "token_transfer"]),
            Payment.status == "success",
        )
    )
    if paid_amount <= 0:
        raise HTTPException(
            status_code=409, detail="No verified token payment found for this appointment"
        )

    # The doctor cannot do this time, so the slot is blocked, not reopened
    slot = (
        db.query(Slot).filter(Slot.id == appointment.slot_id).with_for_update().first()
    )
    if slot and slot.status == "booked":
        slot.status = "blocked"
        slot.locked_until = None

    credit = TokenCredit(
        patient_id=appointment.patient_id,
        source_appointment_id=appointment.id,
        amount=paid_amount,
        status="active",
        expires_at=now + timedelta(days=_credit_days()),
    )
    db.add(credit)

    appointment.status = "doctor_cancelled"
    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status="confirmed",
            new_status="doctor_cancelled",
            note=f"Cancelled by the doctor ({reason}), token Rs {paid_amount} kept as credit",
        )
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="appointment_cancelled_by_doctor",
            entity_type="appointment",
            entity_id=appointment.id,
            details=(
                f"reason={reason}; credit={paid_amount}; "
                f"expires={credit.expires_at:%Y-%m-%d %H:%M}"
            ),
        )
    )
    db.commit()

    patient = db.get(Patient, appointment.patient_id)
    return appointment, credit, patient