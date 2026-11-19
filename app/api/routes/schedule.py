from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Doctor, DoctorSchedule, User
from app.schemas.schedule import ScheduleDay, ScheduleUpdate

router = APIRouter(prefix="/doctors/me/schedule", tags=["Doctor Schedule"])


def get_my_doctor(
    user: User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    return doctor


@router.get("", response_model=list[ScheduleDay])
def get_schedule(
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    return (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.doctor_id == doctor.id)
        .order_by(DoctorSchedule.day_of_week)
        .all()
    )


@router.put("", response_model=list[ScheduleDay])
def set_schedule(
    data: ScheduleUpdate,
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    # Replace the whole weekly schedule with what the doctor sent
    db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == doctor.id).delete()
    for day in data.days:
        db.add(DoctorSchedule(doctor_id=doctor.id, **day.model_dump()))
    db.commit()

    return (
        db.query(DoctorSchedule)
        .filter(DoctorSchedule.doctor_id == doctor.id)
        .order_by(DoctorSchedule.day_of_week)
        .all()
    )