from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentHistory, Payment, Slot
from app.services.credit_service import release_credit


def confirm_token_payment(
    db: Session,
    transaction_reference: str,
    gateway: str,
    gateway_payment_id: str,
    user_id: int | None = None,
) -> Appointment:
    # Lock these rows while we work, so two callbacks can't run at once
    payment = (
        db.query(Payment)
        .filter(Payment.transaction_reference == transaction_reference)
        .with_for_update()
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == payment.appointment_id)
        .with_for_update()
        .first()
    )

    # Duplicate callback: already confirmed, change nothing
    if payment.status == "success":
        return appointment

    if payment.payment_type != "token":
        raise HTTPException(status_code=400, detail="Not a token payment")

    if appointment.status != "payment_pending" or payment.status != "pending":
        raise HTTPException(
            status_code=409, detail="This booking can no longer be paid"
        )

    slot = db.query(Slot).filter(Slot.id == appointment.slot_id).with_for_update().first()
    now = datetime.now()

    # Time ran out: release the slot and cancel the booking
    if slot.status != "locked" or slot.locked_until is None or slot.locked_until <= now:
        appointment.status = "cancelled"
        payment.status = "failed"
        release_credit(db, appointment)
        if slot.status == "locked":
            slot.status = "available"
            slot.locked_until = None
        db.add(
            AppointmentHistory(
                appointment_id=appointment.id,
                changed_by_user_id=user_id,
                old_status="payment_pending",
                new_status="cancelled",
                note="Payment time expired, slot released",
            )
        )
        db.commit()
        raise HTTPException(
            status_code=409, detail="Payment time expired. Please book again."
        )

    payment.status = "success"
    payment.gateway = gateway
    payment.gateway_payment_id = gateway_payment_id
    payment.paid_at = now

    appointment.status = "confirmed"
    appointment.payment_status = "token_paid"

    slot.status = "booked"
    slot.locked_until = None

    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user_id,
            old_status="payment_pending",
            new_status="confirmed",
            note="Token payment verified (" + gateway + ")",
        )
    )
    db.commit()
    return appointment