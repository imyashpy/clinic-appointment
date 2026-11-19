import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    AuditLog,
    Payment,
    Receptionist,
    Refund,
    TokenCredit,
    User,
)


def refund_credit_at_desk(
    db: Session, user: User, credit_id: int, method: str
) -> tuple[TokenCredit, Refund]:
    receptionist = db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
    if not receptionist:
        raise HTTPException(status_code=404, detail="Receptionist profile not found")

    # Locks the credit, so two clicks cannot return the money twice
    credit = (
        db.query(TokenCredit)
        .filter(TokenCredit.id == credit_id)
        .with_for_update()
        .first()
    )
    source = db.get(Appointment, credit.source_appointment_id) if credit else None

    # Same answer whether it does not exist or belongs to another clinic
    if not credit or not source or source.clinic_id != receptionist.clinic_id:
        raise HTTPException(status_code=404, detail="Credit not found")

    now = datetime.now()
    if credit.status != "active":
        raise HTTPException(
            status_code=409, detail="This credit is already " + credit.status
        )
    if credit.expires_at <= now:
        credit.status = "expired"
        credit.closed_at = now
        db.commit()
        raise HTTPException(status_code=409, detail="This credit has expired")

    payment = (
        db.query(Payment)
        .filter(
            Payment.appointment_id == source.id,
            Payment.payment_type.in_(["token", "token_transfer"]),
            Payment.status == "success",
        )
        .order_by(Payment.id.desc())
        .first()
    )
    if not payment:
        raise HTTPException(status_code=409, detail="No payment found to refund")

    reference = "RFD-" + uuid.uuid4().hex[:16].upper()
    refund = Refund(
        payment_id=payment.id,
        appointment_id=source.id,
        amount=credit.amount,
        status="processed",
        reason=f"Token credit returned at the clinic desk ({method})",
        transaction_reference=reference,
        created_at=now,
        processed_at=now,
    )
    db.add(refund)

    payment.status = "refunded"
    source.payment_status = "refunded"
    credit.status = "refunded"
    credit.closed_at = now

    db.add(
        AppointmentHistory(
            appointment_id=source.id,
            changed_by_user_id=user.id,
            old_status=source.status,
            new_status=source.status,
            note=f"Token Rs {credit.amount} returned at the desk ({method})",
        )
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="token_refunded",
            entity_type="token_credit",
            entity_id=credit.id,
            details=(
                f"amount={credit.amount}; method={method}; ref={reference}; "
                f"appointment={source.booking_reference}"
            ),
        )
    )
    db.commit()
    return credit, refund