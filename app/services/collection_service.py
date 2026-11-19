import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentHistory, AuditLog, Payment, User
from app.services.appointment_actions import _get_locked

PAYABLE_STATUSES = ("arrived", "in_consultation", "completed")


def collect_remaining(
    db: Session, user: User, appointment_id: int, method: str
) -> tuple[Appointment, Payment]:
    # Locks the row, so a double click cannot record the payment twice
    appointment = _get_locked(db, user, appointment_id)

    if appointment.status not in PAYABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="Cannot collect payment: appointment is " + appointment.status,
        )
    if appointment.payment_status == "fully_paid":
        raise HTTPException(
            status_code=409, detail="This appointment is already fully paid"
        )
    if appointment.payment_status != "token_paid":
        raise HTTPException(
            status_code=409, detail="Token payment is not verified for this appointment"
        )

    amount = appointment.consultation_fee - appointment.token_amount
    if amount <= 0:
        raise HTTPException(status_code=409, detail="Nothing is due for this appointment")

    now = datetime.now()
    payment = Payment(
        appointment_id=appointment.id,
        amount=amount,
        payment_type="remaining",
        method=method,
        status="success",
        transaction_reference="TXN-" + uuid.uuid4().hex[:16].upper(),
        collected_by_user_id=user.id,
        paid_at=now,
    )
    db.add(payment)

    appointment.payment_status = "fully_paid"

    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status=appointment.status,
            new_status=appointment.status,
            note=f"Remaining Rs {amount} collected ({method}), fully paid",
        )
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="payment_collected",
            entity_type="appointment",
            entity_id=appointment.id,
            details=f"amount={amount}; method={method}; ref={payment.transaction_reference}",
        )
    )
    db.commit()
    return appointment, payment