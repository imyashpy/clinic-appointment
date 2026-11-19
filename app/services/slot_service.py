from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models import Doctor, DoctorSchedule, ScheduleException, Slot


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


def generate_slots(db: Session, doctor: Doctor, days_ahead: int, start_date: date | None = None) -> int:
    today = start_date or date.today()
    now = datetime.now()
    last_day = today + timedelta(days=days_ahead - 1)
    step = timedelta(minutes=doctor.slot_duration_minutes)

    schedules = {
        s.day_of_week: s
        for s in db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == doctor.id,
            DoctorSchedule.is_active == True,  # noqa: E712
        )
    }

    exceptions = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id == doctor.id,
            ScheduleException.exception_date >= today,
            ScheduleException.exception_date <= last_day,
        )
        .all()
    )

    existing_slots = (
        db.query(Slot)
        .filter(
            Slot.doctor_id == doctor.id,
            Slot.start_at >= datetime.combine(today, time.min),
        )
        .all()
    )
    by_start = {s.start_at: s for s in existing_slots}
    # Booked or in-payment slots must never be overlapped by a new slot
    live = [(s.start_at, s.end_at) for s in existing_slots if s.status in ("booked", "locked")]

    created = 0
    for offset in range(days_ahead):
        day = today + timedelta(days=offset)
        schedule = schedules.get(day.weekday())
        if not schedule:
            continue

        # Times in this day that must stay free of slots
        blocked = []
        for ex in exceptions:
            if ex.exception_date != day:
                continue
            if ex.start_time is None or ex.end_time is None:
                blocked.append(
                    (datetime.combine(day, time.min), datetime.combine(day, time.max))
                )
            else:
                blocked.append(
                    (
                        datetime.combine(day, ex.start_time),
                        datetime.combine(day, ex.end_time),
                    )
                )
        if schedule.break_start and schedule.break_end:
            blocked.append(
                (
                    datetime.combine(day, schedule.break_start),
                    datetime.combine(day, schedule.break_end),
                )
            )

        cursor = datetime.combine(day, schedule.start_time)
        day_end = datetime.combine(day, schedule.end_time)

        while cursor + step <= day_end:
            slot_end = cursor + step

            clash = next(
                (b for b in blocked if _overlaps(cursor, slot_end, b[0], b[1])), None
            )
            if clash:
                cursor = clash[1]  # jump to the end of the break or block
                continue

            if cursor > now:
                touches_live = any(_overlaps(cursor, slot_end, s, e) for s, e in live)
                found = by_start.get(cursor)
                if found is not None:
                    # A hidden slot from an old slot length is reused when it fits
                    if found.status == "retired" and not touches_live:
                        found.end_at = slot_end
                        found.status = "available"
                        found.locked_until = None
                        created += 1
                elif not touches_live:
                    db.add(
                        Slot(
                            doctor_id=doctor.id,
                            start_at=cursor,
                            end_at=slot_end,
                            status="available",
                        )
                    )
                    created += 1

            cursor = slot_end

    db.commit()
    return created