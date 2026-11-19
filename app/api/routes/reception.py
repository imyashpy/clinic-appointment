from collections import Counter
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Appointment, Doctor, Patient, Payment, Receptionist, User
from app.schemas.reception import ReceptionAppointmentOut, ReceptionDashboard
from app.services.expiry_service import expire_stale_bookings

router = APIRouter(prefix="/reception", tags=["Reception"])


def _age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _my_receptionist(db: Session, user: User) -> Receptionist:
    receptionist = db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
    if not receptionist:
        raise HTTPException(status_code=404, detail="Receptionist profile not found")
    return receptionist


def _day_bounds(day: date | None):
    day = day or date.today()
    start = datetime.combine(day, time.min)
    return day, start, start + timedelta(days=1)


@router.get("/appointments", response_model=list[ReceptionAppointmentOut])
def day_list(
    day: date | None = Query(None, description="Defaults to today"),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    receptionist = _my_receptionist(db, user)
    expire_stale_bookings(db)
    day, day_start, day_end = _day_bounds(day)

    query = (
        db.query(Appointment, Patient, Doctor, User)
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .filter(
            Appointment.clinic_id == receptionist.clinic_id,
            Appointment.start_at >= day_start,
            Appointment.start_at < day_end,
            Appointment.payment_status != "pending",
        )
    )
    if receptionist.doctor_id:
        query = query.filter(Appointment.doctor_id == receptionist.doctor_id)

    return [
        ReceptionAppointmentOut(
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
            doctor_name=du.name,
            specialty=d.specialty,
        )
        for a, p, d, du in query.order_by(Appointment.start_at).all()
    ]


@router.get("/dashboard", response_model=ReceptionDashboard)
def dashboard(
    day: date | None = Query(None, description="Defaults to today"),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    receptionist = _my_receptionist(db, user)
    expire_stale_bookings(db)
    day, day_start, day_end = _day_bounds(day)

    query = db.query(Appointment).filter(
        Appointment.clinic_id == receptionist.clinic_id,
        Appointment.start_at >= day_start,
        Appointment.start_at < day_end,
        Appointment.payment_status != "pending",
    )
    if receptionist.doctor_id:
        query = query.filter(Appointment.doctor_id == receptionist.doctor_id)
    appointments = query.all()

    counts = Counter(a.status for a in appointments)

    money = {"token": 0, "remaining": 0}
    ids = [a.id for a in appointments]
    if ids:
        rows = (
            db.query(Payment.payment_type, func.coalesce(func.sum(Payment.amount), 0))
            .filter(Payment.appointment_id.in_(ids), Payment.status == "success")
            .group_by(Payment.payment_type)
            .all()
        )
        for payment_type, total in rows:
            if payment_type in money:
                money[payment_type] = int(total)

    remaining_pending = sum(
        a.consultation_fee - a.token_amount
        for a in appointments
        if a.payment_status == "token_paid"
        and a.status in ("confirmed", "arrived", "waiting", "in_consultation", "completed")
    )

    return ReceptionDashboard(
        day=day,
        total_appointments=len(appointments),
        arrived=(
            counts["arrived"]
            + counts["waiting"]
            + counts["in_consultation"]
            + counts["completed"]
        ),
        waiting=counts["arrived"] + counts["waiting"],
        in_consultation=counts["in_consultation"],
        completed=counts["completed"],
        not_arrived=counts["confirmed"],
        no_show=counts["no_show"],
        cancelled=counts["cancelled"],
        token_collected=money["token"],
        remaining_collected=money["remaining"],
        total_received=money["token"] + money["remaining"],
        remaining_pending=remaining_pending,
    )