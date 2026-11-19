from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Appointment, AuditLog, Clinic, Doctor, Receptionist, Slot, User
from app.schemas.doctor_settings import (
    DoctorSettingsOut,
    DoctorSettingsUpdate,
    SettingsResult,
)
from app.services.expiry_service import expire_stale_bookings
from app.services.slot_service import generate_slots

router = APIRouter(prefix="/doctors/me/settings", tags=["Doctor Settings"])


def _out(db: Session, doctor: Doctor) -> DoctorSettingsOut:
    user = db.get(User, doctor.user_id)
    clinic = db.get(Clinic, doctor.clinic_id) if doctor.clinic_id else None
    receptionist_row = (
        db.query(Receptionist)
        .filter(Receptionist.doctor_id == doctor.id)
        .first()
    )
    receptionist_name = None
    if receptionist_row:
        receptionist_user = db.get(User, receptionist_row.user_id)
        receptionist_name = receptionist_user.name if receptionist_user else None
    return DoctorSettingsOut(
        doctor_id=doctor.id,
        name=user.name,
        clinic_name=clinic.name if clinic else "Unassigned",
        specialty=doctor.specialty,
        qualification=doctor.qualification,
        consultation_fee=doctor.consultation_fee,
        token_amount=doctor.token_amount,
        slot_duration_minutes=doctor.slot_duration_minutes,
        receptionist_name=receptionist_name,
    )


@router.get("", response_model=DoctorSettingsOut)
def get_settings(
    user: User = Depends(require_roles("doctor")),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    return _out(db, doctor)


@router.patch("", response_model=SettingsResult)
def update_settings(
    data: DoctorSettingsUpdate,
    user: User = Depends(require_roles("doctor")),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    expire_stale_bookings(db)  # so expired locks count as free slots

    new_fee = (
        data.consultation_fee
        if data.consultation_fee is not None
        else doctor.consultation_fee
    )
    new_token = (
        data.token_amount if data.token_amount is not None else doctor.token_amount
    )
    if new_token > new_fee:
        raise HTTPException(
            status_code=422, detail="The token cannot be more than the consultation fee"
        )

    changes = []
    if data.qualification is not None:
        qualification = data.qualification.strip() or None
        if qualification != doctor.qualification:
            changes.append("qualification")
            doctor.qualification = qualification
    if new_fee != doctor.consultation_fee:
        changes.append(f"fee {doctor.consultation_fee}->{new_fee}")
        doctor.consultation_fee = new_fee
    if new_token != doctor.token_amount:
        changes.append(f"token {doctor.token_amount}->{new_token}")
        doctor.token_amount = new_token

    duration_changed = (
        data.slot_duration_minutes is not None
        and data.slot_duration_minutes != doctor.slot_duration_minutes
    )
    removed = hidden = 0
    if duration_changed:
        changes.append(
            f"slot length {doctor.slot_duration_minutes}->{data.slot_duration_minutes}"
        )
        doctor.slot_duration_minutes = data.slot_duration_minutes

        future_free = (
            db.query(Slot)
            .filter(
                Slot.doctor_id == doctor.id,
                Slot.start_at > datetime.now(),
                Slot.status == "available",
            )
            .all()
        )
        ids = [s.id for s in future_free]
        referenced = set()
        if ids:
            referenced = {
                sid
                for (sid,) in db.query(Appointment.slot_id)
                .filter(Appointment.slot_id.in_(ids))
                .distinct()
            }
        for slot in future_free:
            if slot.id in referenced:
                slot.status = "retired"  # an old cancelled booking points to it
                hidden += 1
            else:
                db.delete(slot)
                removed += 1

    if not changes:
        return SettingsResult(
            settings=_out(db, doctor),
            slots_removed=0,
            slots_hidden=0,
            slots_created=0,
            message="Nothing changed",
        )

    db.add(
        AuditLog(
            user_id=user.id,
            action="doctor_settings_changed",
            entity_type="doctor",
            entity_id=doctor.id,
            details="; ".join(changes),
        )
    )
    db.commit()

    created = 0
    if duration_changed:
        created = generate_slots(db, doctor, 14)
        message = (
            f"Slot length is now {doctor.slot_duration_minutes} minutes. "
            f"{removed} unused future slots were replaced, {hidden} old ones were hidden, "
            f"and {created} slots were created for the next 14 days. "
            "Appointments that are already booked were not changed."
        )
    else:
        message = (
            "Saved. Fee and token changes apply to new bookings only. "
            "Existing bookings keep their own amounts."
        )

    return SettingsResult(
        settings=_out(db, doctor),
        slots_removed=removed,
        slots_hidden=hidden,
        slots_created=created,
        message=message,
    )