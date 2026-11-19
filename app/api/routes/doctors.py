from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Clinic, Doctor, Slot, User
from app.schemas.doctor import DoctorOut, SlotOut

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("", response_model=list[DoctorOut])
def list_doctors(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        db.query(Doctor, User, Clinic)
        .join(User, User.id == Doctor.user_id)
        .join(Clinic, Clinic.id == Doctor.clinic_id)
        .filter(User.is_active == True, Clinic.is_active == True)  # noqa: E712
    )
    # If patient, only show doctors from their clinic
    if user.role == "patient" and user.clinic_id:
        query = query.filter(Doctor.clinic_id == user.clinic_id)
    rows = query.order_by(User.name).all()
    return [
        DoctorOut(
            id=d.id,
            name=u.name,
            specialty=d.specialty,
            qualification=d.qualification,
            clinic_name=c.name,
            consultation_fee=d.consultation_fee,
            token_amount=d.token_amount,
            slot_duration_minutes=d.slot_duration_minutes,
        )
        for d, u, c in rows
    ]


@router.get("/{doctor_id}/slots", response_model=list[SlotOut])
def doctor_slots(
    doctor_id: int,
    day: date = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.get(Doctor, doctor_id):
        raise HTTPException(status_code=404, detail="Doctor not found")

    day_start = datetime.combine(day, time.min)
    day_end = day_start + timedelta(days=1)
    now = datetime.now()

    slots = (
        db.query(Slot)
        .filter(
            Slot.doctor_id == doctor_id,
            Slot.start_at >= day_start,
            Slot.start_at < day_end,
            Slot.start_at > now,  # past slots are never shown
            Slot.status.notin_(["blocked", "retired"]),
        )
        .order_by(Slot.start_at)
        .all()
    )

    result = []
    for s in slots:
        slot_status = s.status
        # A lock that has expired counts as free again
        if slot_status == "locked" and (s.locked_until is None or s.locked_until <= now):
            slot_status = "available"
        result.append(
            SlotOut(id=s.id, start_at=s.start_at, end_at=s.end_at, status=slot_status)
        )
    return result