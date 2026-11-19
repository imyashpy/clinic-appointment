from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Appointment, Doctor, Patient, User
from app.schemas.walk_in import WalkInRequest, WalkInResult, WalkInRow, WalkInSlot
from app.services.expiry_service import expire_stale_bookings
from app.services.walk_in_service import (
    get_receptionist,
    list_free_slots,
    register_walk_in,
)

router = APIRouter(prefix="/reception", tags=["Reception"])


@router.get("/walk-in/slots", response_model=list[WalkInSlot])
def walk_in_slots(
    doctor_id: int = Query(...),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    expire_stale_bookings(db)
    slots = list_free_slots(db, user, doctor_id)
    return [WalkInSlot(id=s.id, start_at=s.start_at, end_at=s.end_at) for s in slots]


@router.post("/walk-in", response_model=WalkInResult, status_code=201)
def create_walk_in(
    data: WalkInRequest,
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    expire_stale_bookings(db)
    return register_walk_in(db, user, data)


@router.get("/walk-ins", response_model=list[WalkInRow])
def walk_in_report(
    day: date | None = Query(None, description="Defaults to today"),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    receptionist = get_receptionist(db, user)
    day = day or date.today()
    start = datetime.combine(day, time.min)

    query = (
        db.query(Appointment, Patient, User)
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .filter(
            Appointment.is_walk_in == True,  # noqa: E712
            Appointment.clinic_id == receptionist.clinic_id,
            Appointment.start_at >= start,
            Appointment.start_at < start + timedelta(days=1),
        )
    )
    if receptionist.doctor_id:
        query = query.filter(Appointment.doctor_id == receptionist.doctor_id)

    return [
        WalkInRow(
            appointment_id=a.id,
            booking_reference=a.booking_reference,
            patient_name=p.full_name,
            patient_phone=p.phone,
            doctor_name=du.name,
            start_at=a.start_at,
            status=a.status,
            payment_status=a.payment_status,
        )
        for a, p, du in query.order_by(Appointment.start_at).all()
    ]