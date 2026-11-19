from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Appointment, Doctor, Payment, Refund
from app.schemas.earnings import EarningsOut

router = APIRouter(prefix="/doctors/me/earnings", tags=["Doctor Earnings"])

OPEN_STATUSES = ["confirmed", "arrived", "waiting", "in_consultation", "completed"]


def _range(period: str, anchor: date) -> tuple[date, date]:
    if period == "day":
        return anchor, anchor
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())  # Monday
        return start, start + timedelta(days=6)
    start = anchor.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)


@router.get("", response_model=EarningsOut)
def earnings(
    period: Literal["day", "week", "month"] = Query("day"),
    day: date | None = Query(None, description="Any day inside the period, defaults to today"),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    start_day, end_day = _range(period, day or date.today())
    start = datetime.combine(start_day, time.min)
    end = datetime.combine(end_day, time.min) + timedelta(days=1)

    # Money received in the period. A payment later refunded still counts as received.
    rows = (
        db.query(
            Payment.payment_type,
            Payment.method,
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .join(Appointment, Appointment.id == Payment.appointment_id)
        .filter(
            Appointment.doctor_id == doctor.id,
            Payment.paid_at >= start,
            Payment.paid_at < end,
            Payment.status.in_(["success", "refunded"]),
            Payment.payment_type.in_(["token", "remaining"]),
        )
        .group_by(Payment.payment_type, Payment.method)
        .all()
    )
    token = remaining = online = cash = upi = 0
    for payment_type, method, total in rows:
        total = int(total)
        if payment_type == "token":
            token += total
        else:
            remaining += total
        if method == "online":
            online += total
        elif method == "cash":
            cash += total
        elif method == "upi":
            upi += total

    refunds = int(
        db.query(func.coalesce(func.sum(Refund.amount), 0))
        .join(Appointment, Appointment.id == Refund.appointment_id)
        .filter(
            Appointment.doctor_id == doctor.id,
            Refund.status == "processed",
            Refund.processed_at >= start,
            Refund.processed_at < end,
        )
        .scalar()
    )

    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.start_at >= start,
            Appointment.start_at < end,
        )
        .all()
    )

    completed = [a for a in appointments if a.status == "completed"]
    no_shows = [a for a in appointments if a.status == "no_show"]
    cancelled = [a for a in appointments if a.status == "cancelled"]

    outstanding = sum(
        a.consultation_fee - a.token_amount
        for a in appointments
        if a.payment_status == "token_paid" and a.status in OPEN_STATUSES
    )

    total_collected = token + remaining
    return EarningsOut(
        period=period,
        start=start_day,
        end=end_day,
        token_collected=token,
        remaining_collected=remaining,
        online_collected=online,
        cash_collected=cash,
        upi_collected=upi,
        total_collected=total_collected,
        refunds=refunds,
        net_collected=total_collected - refunds,
        consultation_revenue=sum(a.consultation_fee for a in completed),
        forfeited_tokens=sum(
            a.token_amount for a in no_shows if a.payment_status == "token_paid"
        ),
        outstanding=outstanding,
        appointments_total=len(appointments),
        completed=len(completed),
        no_show=len(no_shows),
        cancelled=len(cancelled),
    )