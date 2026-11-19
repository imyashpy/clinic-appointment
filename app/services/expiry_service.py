from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentHistory, Payment, Slot, TokenCredit
from app.services.credit_service import release_credit


def expire_stale_bookings(db: Session, patient_id: int | None = None) -> int:
    now = datetime.now()

    query = (
        db.query(Appointment, Slot)
        .join(Slot, Slot.id == Appointment.slot_id)
        .filter(
            Appointment.status == "payment_pending",
            or_(Slot.locked_until.is_(None), Slot.locked_until <= now),
        )
    )
    if patient_id is not None:
        query = query.filter(Appointment.patient_id == patient_id)

    count = 0
    for appointment, slot in query.all():
        appointment.status = "cancelled"
        db.query(Payment).filter(
            Payment.appointment_id == appointment.id, Payment.status == "pending"
        ).update({"status": "failed"}, synchronize_session=False)
        release_credit(db, appointment)
        if slot.status == "locked":
            slot.status = "available"
            slot.locked_until = None
        db.add(
            AppointmentHistory(
                appointment_id=appointment.id,
                old_status="payment_pending",
                new_status="cancelled",
                note="Payment time expired, slot released",
            )
        )
        count += 1

    # Credits that were not used or collected within their days are lost
    expired = (
        db.query(TokenCredit)
        .filter(TokenCredit.status == "active", TokenCredit.expires_at <= now)
        .update({"status": "expired", "closed_at": now}, synchronize_session=False)
    )

    if count or expired:
        db.commit()
    return count