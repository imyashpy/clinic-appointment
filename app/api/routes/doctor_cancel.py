from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Doctor, User
from app.schemas.doctor_cancel import DoctorCancelRequest, DoctorCancelResult
from app.services.doctor_cancel_service import cancel_by_doctor

router = APIRouter(prefix="/doctors/me/appointments", tags=["Doctor Appointments"])


@router.post("/{appointment_id}/cancel", response_model=DoctorCancelResult)
def doctor_cancel(
    appointment_id: int,
    data: DoctorCancelRequest,
    user: User = Depends(require_roles("doctor")),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    appointment, credit, patient = cancel_by_doctor(
        db, user, doctor, appointment_id, data.reason.strip()
    )
    return DoctorCancelResult(
        appointment_id=appointment.id,
        booking_reference=appointment.booking_reference,
        patient_name=patient.full_name,
        patient_phone=patient.phone,
        status=appointment.status,
        credit_amount=credit.amount,
        credit_valid_until=credit.expires_at,
        message=(
            f"Rs {credit.amount} is kept for {patient.full_name} until "
            f"{credit.expires_at:%d %b %Y}. Please tell the patient: they can rebook "
            "with it or collect it at the clinic."
        ),
    )