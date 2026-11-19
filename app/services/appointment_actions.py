from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    Doctor,
    PatientVisit,
    Receptionist,
    User,
)


def _can_manage(db: Session, user: User, appointment: Appointment) -> bool:
    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        return doctor is not None and doctor.id == appointment.doctor_id
    if user.role == "receptionist":
        rec = db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
        return (
            rec is not None
            and rec.clinic_id == appointment.clinic_id
            and (rec.doctor_id is None or rec.doctor_id == appointment.doctor_id)
        )
    return False


def _get_locked(db: Session, user: User, appointment_id: int) -> Appointment:
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .with_for_update()
        .first()
    )
    # Same answer whether it does not exist or belongs to someone else
    if not appointment or not _can_manage(db, user, appointment):
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


def _move(db: Session, appointment: Appointment, user: User, new_status: str, note: str):
    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status=appointment.status,
            new_status=new_status,
            note=note,
        )
    )
    appointment.status = new_status


def check_in(db: Session, user: User, appointment_id: int) -> Appointment:
    appointment = _get_locked(db, user, appointment_id)
    if appointment.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail="Cannot check in: appointment is " + appointment.status,
        )
    if appointment.start_at.date() != datetime.now().date():
        raise HTTPException(
            status_code=409,
            detail="Check-in is only possible on the day of the appointment",
        )
    appointment.checked_in_at = datetime.now()
    _move(db, appointment, user, "arrived", "Patient checked in")
    db.commit()
    return appointment


def start_consultation(db: Session, user: User, appointment_id: int) -> Appointment:
    appointment = _get_locked(db, user, appointment_id)
    if appointment.status not in ("arrived", "waiting"):
        raise HTTPException(
            status_code=409,
            detail="Cannot start: appointment is " + appointment.status,
        )
    visit = (
        db.query(PatientVisit)
        .filter(PatientVisit.appointment_id == appointment.id)
        .first()
    )
    if not visit:
        db.add(PatientVisit(appointment_id=appointment.id, started_at=datetime.now()))
    _move(db, appointment, user, "in_consultation", "Consultation started")
    db.commit()
    return appointment


def complete_consultation(db: Session, user: User, appointment_id: int) -> Appointment:
    appointment = _get_locked(db, user, appointment_id)
    if appointment.status != "in_consultation":
        raise HTTPException(
            status_code=409,
            detail="Cannot complete: appointment is " + appointment.status,
        )
    visit = (
        db.query(PatientVisit)
        .filter(PatientVisit.appointment_id == appointment.id)
        .first()
    )
    if not visit:
        visit = PatientVisit(appointment_id=appointment.id)
        db.add(visit)
    visit.ended_at = datetime.now()
    _move(db, appointment, user, "completed", "Consultation completed")
    db.commit()
    return appointment


def mark_no_show(db: Session, user: User, appointment_id: int) -> Appointment:
    appointment = _get_locked(db, user, appointment_id)
    if appointment.status != "confirmed":
        raise HTTPException(
            status_code=409,
            detail="Cannot mark no-show: appointment is " + appointment.status,
        )
    if datetime.now() < appointment.start_at:
        raise HTTPException(
            status_code=409,
            detail="Cannot mark no-show before the appointment time",
        )
    _move(db, appointment, user, "no_show", "Marked no-show, token forfeited per policy")
    db.commit()
    return appointment