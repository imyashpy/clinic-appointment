from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_clinic_scope, require_roles
from app.core.database import get_db
from app.models import Appointment, Clinic, Doctor, Patient, Payment, Refund, User
from app.schemas.admin_views import ClinicStat, DoctorStat, PlatformStats

router = APIRouter(prefix="/admin/stats", tags=["Admin"])


def _range(period: str, anchor: date) -> tuple[date, date]:
    if period == "day":
        return anchor, anchor
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)
    start = anchor.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)


@router.get("", response_model=PlatformStats)
def platform_stats(
    period: Literal["day", "week", "month"] = Query("day"),
    day: date | None = Query(None, description="Any day inside the period, defaults to today"),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    start_day, end_day = _range(period, day or date.today())
    start = datetime.combine(start_day, time.min)
    end = datetime.combine(end_day, time.min) + timedelta(days=1)

    appointment_query = db.query(Appointment).filter(Appointment.start_at >= start, Appointment.start_at < end)
    if clinic_scope:
        appointment_query = appointment_query.filter(Appointment.clinic_id == clinic_scope)
    appointments = appointment_query.all()
    by_status = Counter(a.status for a in appointments)

    money_filters = [
        Payment.paid_at >= start,
        Payment.paid_at < end,
        Payment.status.in_(["success", "refunded"]),
        Payment.payment_type.in_(["token", "remaining"]),
    ]
    if clinic_scope:
        money_filters.append(Appointment.clinic_id == clinic_scope)

    collected_by_clinic = dict(
        db.query(Appointment.clinic_id, func.coalesce(func.sum(Payment.amount), 0))
        .join(Appointment, Appointment.id == Payment.appointment_id)
        .filter(*money_filters)
        .group_by(Appointment.clinic_id)
        .all()
    )
    total_collected = sum(int(v) for v in collected_by_clinic.values())

    refund_query = db.query(Refund).filter(
        Refund.status == "processed",
        Refund.processed_at >= start,
        Refund.processed_at < end,
    )
    if clinic_scope:
        refund_query = refund_query.join(Appointment, Appointment.id == Refund.appointment_id).filter(
            Appointment.clinic_id == clinic_scope
        )
    refunds = int(refund_query.with_entities(func.coalesce(func.sum(Refund.amount), 0)).scalar() or 0)

    doctor_query = (
        db.query(Doctor.id, User.name, Clinic.name, Clinic.id)
        .join(User, User.id == Doctor.user_id)
        .join(Clinic, Clinic.id == Doctor.clinic_id)
    )
    if clinic_scope:
        doctor_query = doctor_query.filter(Doctor.clinic_id == clinic_scope)
    doctors = doctor_query.all()

    clinic_query = db.query(Clinic.id, Clinic.name).order_by(Clinic.name)
    if clinic_scope:
        clinic_query = clinic_query.filter(Clinic.id == clinic_scope)
    clinics = clinic_query.all()

    doctor_wise = []
    for doctor_id, doctor_name, clinic_name, _clinic_id in doctors:
        mine = [a for a in appointments if a.doctor_id == doctor_id]
        counts = Counter(a.status for a in mine)
        doctor_wise.append(
            DoctorStat(
                doctor_id=doctor_id,
                doctor_name=doctor_name,
                clinic_name=clinic_name,
                appointments=len(mine),
                completed=counts.get("completed", 0),
                no_show=counts.get("no_show", 0),
                cancelled=counts.get("cancelled", 0),
            )
        )
    doctor_wise.sort(key=lambda d: d.appointments, reverse=True)

    clinic_wise = []
    for clinic_id, clinic_name in clinics:
        mine = [a for a in appointments if a.clinic_id == clinic_id]
        clinic_wise.append(
            ClinicStat(
                clinic_id=clinic_id,
                clinic_name=clinic_name,
                appointments=len(mine),
                completed=sum(1 for a in mine if a.status == "completed"),
                collected=int(collected_by_clinic.get(clinic_id, 0)),
            )
        )

    return PlatformStats(
        period=period,
        start=start_day,
        end=end_day,
        doctors=len(doctors),
        patients=db.query(func.count(Patient.id))
            .filter(Patient.clinic_id == clinic_scope if clinic_scope else True)
            .scalar(),
        appointments_total=len(appointments),
        completed=by_status.get("completed", 0),
        no_show=by_status.get("no_show", 0),
        cancelled=by_status.get("cancelled", 0),
        total_collected=total_collected,
        refunds=refunds,
        net_collected=total_collected - refunds,
        forfeited_tokens=sum(
            a.token_amount
            for a in appointments
            if a.status == "no_show" and a.payment_status == "token_paid"
        ),
        doctor_wise=doctor_wise,
        clinic_wise=clinic_wise,
    )