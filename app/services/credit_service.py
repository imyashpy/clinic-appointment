import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentHistory, Payment, TokenCredit


def find_usable_credit(db: Session, patient_id: int) -> TokenCredit | None:
    now = datetime.now()
    return (
        db.query(TokenCredit)
        .filter(
            TokenCredit.patient_id == patient_id,
            TokenCredit.status == "active",
            TokenCredit.expires_at > now,
        )
        .order_by(TokenCredit.expires_at)
        .with_for_update()
        .first()
    )


def apply_credit(
    db: Session, appointment: Appointment, credit: TokenCredit, token_amount: int
) -> int:
    """Uses the credit for this appointment. Returns the token still to pay online."""
    now = datetime.now()
    applied = min(credit.amount, token_amount)
    leftover = credit.amount - applied  # lost, by the clinic's rule
    token_due = token_amount - applied

    credit.status = "used"
    credit.used_for_appointment_id = appointment.id
    credit.closed_at = now

    db.add(
        Payment(
            appointment_id=appointment.id,
            amount=applied,
            payment_type="token_transfer",
            method="credit",
            status="success",
            gateway="credit",
            transaction_reference="TXN-" + uuid.uuid4().hex[:16].upper(),
            paid_at=now,
        )
    )

    note = f"Token credit Rs {applied} applied"
    if leftover:
        note += f", Rs {leftover} of the credit is not refundable"
    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            old_status="payment_pending",
            new_status="payment_pending",
            note=note,
        )
    )
    return token_due


def release_credit(db: Session, appointment: Appointment) -> None:
    """Gives the credit back when an unpaid booking that used it falls through."""
    credit = (
        db.query(TokenCredit)
        .filter(
            TokenCredit.used_for_appointment_id == appointment.id,
            TokenCredit.status == "used",
        )
        .first()
    )
    if not credit:
        return

    for payment in db.query(Payment).filter(
        Payment.appointment_id == appointment.id,
        Payment.payment_type == "token_transfer",
        Payment.status == "success",
    ):
        payment.status = "failed"

    now = datetime.now()
    credit.used_for_appointment_id = None
    if credit.expires_at > now:
        credit.status = "active"
        credit.closed_at = None
    else:
        credit.status = "expired"
        credit.closed_at = now

    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            old_status="payment_pending",
            new_status="cancelled",
            note="Booking not paid, token credit released",
        )
    )