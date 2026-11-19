from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Appointment, Doctor, Patient, Receptionist, TokenCredit, User
from app.schemas.credit import CreditOut, RefundRequest, RefundResult
from app.services.refund_service import refund_credit_at_desk

router = APIRouter(prefix="/reception/credits", tags=["Reception"])


@router.get("", response_model=list[CreditOut])
def list_credits(
    patient_id: int = Query(..., description="From the patient search"),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    receptionist = db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
    if not receptionist:
        raise HTTPException(status_code=404, detail="Receptionist profile not found")

    now = datetime.now()
    rows = (
        db.query(TokenCredit, Appointment, Patient, Doctor, User)
        .join(Appointment, Appointment.id == TokenCredit.source_appointment_id)
        .join(Patient, Patient.id == TokenCredit.patient_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .filter(
            TokenCredit.patient_id == patient_id,
            TokenCredit.status == "active",
            TokenCredit.expires_at > now,
            # Any receptionist of the clinic can see it, whichever doctor it came from
            Appointment.clinic_id == receptionist.clinic_id,
        )
        .order_by(TokenCredit.expires_at)
        .all()
    )

    return [
        CreditOut(
            id=c.id,
            patient_id=p.id,
            patient_name=p.full_name,
            patient_phone=p.phone,
            amount=c.amount,
            expires_at=c.expires_at,
            source_booking_reference=a.booking_reference,
            source_doctor_name=du.name,
            source_start_at=a.start_at,
        )
        for c, a, p, d, du in rows
    ]


@router.post("/{credit_id}/refund", response_model=RefundResult)
def return_money(
    credit_id: int,
    data: RefundRequest,
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    credit, refund = refund_credit_at_desk(db, user, credit_id, data.method)
    return RefundResult(
        credit_id=credit.id,
        amount=credit.amount,
        method=data.method,
        status=credit.status,
        transaction_reference=refund.transaction_reference,
    )