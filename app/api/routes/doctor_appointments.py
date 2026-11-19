from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Appointment, Doctor, Patient
from app.schemas.appointment import DoctorAppointmentOut
from app.services.expiry_service import expire_stale_bookings

router = APIRouter(prefix="/doctors/me/appointments", tags=["Doctor Appointments"])


def _age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.get("", response_model=list[DoctorAppointmentOut])
def my_day(
    day: date | None = Query(None, description="Defaults to today"),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    expire_stale_bookings(db)

    day = day or date.today()
    day_start = datetime.combine(day, time.min)
    day_end = day_start + timedelta(days=1)

    rows = (
        db.query(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.start_at >= day_start,
            Appointment.start_at < day_end,
            # Bookings that were never paid never reached the doctor
            Appointment.payment_status != "pending",
        )
        .order_by(Appointment.start_at)
        .all()
    )

    return [
        DoctorAppointmentOut(
            id=a.id,
            booking_reference=a.booking_reference,
            start_at=a.start_at,
            end_at=a.end_at,
            status=a.status,
            payment_status=a.payment_status,
            remaining_amount=(
                0
                if a.payment_status == "fully_paid"
                else a.consultation_fee - a.token_amount
            ),
            patient_name=p.full_name,
            patient_phone=p.phone,
            patient_age=_age(p.date_of_birth),
            patient_gender=p.gender,
            reason=a.reason,
            medical_notes=a.medical_notes,
        )
        for a, p in rows
    ]