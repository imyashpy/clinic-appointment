from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Appointment, Doctor, Patient, PatientVisit
from app.schemas.patient_history import PastVisit, PatientHistory

router = APIRouter(prefix="/doctors/me/appointments", tags=["Doctor Appointments"])


def _age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.get("/{appointment_id}/history", response_model=PatientHistory)
def patient_history(
    appointment_id: int,
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    appointment = db.get(Appointment, appointment_id)
    # Same answer whether it does not exist or belongs to another doctor
    if not appointment or appointment.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Appointment not found")

    patient = db.get(Patient, appointment.patient_id)
    rows = (
        db.query(Appointment, PatientVisit)
        .outerjoin(PatientVisit, PatientVisit.appointment_id == Appointment.id)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == doctor.id,  # only this doctor's own visits
            Appointment.status != "payment_pending",
        )
        .order_by(Appointment.start_at.desc())
        .all()
    )

    return PatientHistory(
        patient_name=patient.full_name,
        patient_phone=patient.phone,
        patient_age=_age(patient.date_of_birth),
        patient_gender=patient.gender,
        visits=[
            PastVisit(
                appointment_id=a.id,
                booking_reference=a.booking_reference,
                start_at=a.start_at,
                status=a.status,
                payment_status=a.payment_status,
                reason=a.reason,
                medical_notes=a.medical_notes,
                visit_started=v.started_at if v else None,
                visit_ended=v.ended_at if v else None,
            )
            for a, v in rows
        ],
    )