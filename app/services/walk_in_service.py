import secrets
import uuid
from datetime import datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    AuditLog,
    Doctor,
    Patient,
    Payment,
    Receptionist,
    Slot,
    User,
)
from app.schemas.walk_in import WalkInRequest, WalkInResult

ACTIVE = ["confirmed", "arrived", "waiting", "in_consultation"]


def get_receptionist(db: Session, user: User) -> Receptionist:
    receptionist = db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
    if not receptionist:
        raise HTTPException(status_code=404, detail="Receptionist profile not found")
    return receptionist


def scoped_doctor(db: Session, receptionist: Receptionist, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if (
        not doctor
        or doctor.clinic_id != receptionist.clinic_id
        or (receptionist.doctor_id is not None and receptionist.doctor_id != doctor.id)
    ):
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor_user = db.get(User, doctor.user_id)
    if not doctor_user or not doctor_user.is_active:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


def free_slots_today(db: Session, doctor_id: int, now: datetime):
    end_of_day = datetime.combine(now.date(), time.min) + timedelta(days=1)
    return (
        db.query(Slot)
        .filter(
            Slot.doctor_id == doctor_id,
            Slot.end_at > now,  # a slot that has started but not ended still counts
            Slot.start_at < end_of_day,
            or_(
                Slot.status == "available",
                and_(Slot.status == "locked", Slot.locked_until <= now),
            ),
        )
        .order_by(Slot.start_at)
    )


def list_free_slots(db: Session, user: User, doctor_id: int) -> list[Slot]:
    receptionist = get_receptionist(db, user)
    doctor = scoped_doctor(db, receptionist, doctor_id)
    return free_slots_today(db, doctor.id, datetime.now()).all()


def register_walk_in(db: Session, user: User, data: WalkInRequest) -> WalkInResult:
    receptionist = get_receptionist(db, user)
    doctor = scoped_doctor(db, receptionist, data.doctor_id)
    doctor_user = db.get(User, doctor.user_id)
    now = datetime.now()

    # The patient: an existing record, or a new one (reused if it already exists)
    if data.patient_id is not None:
        patient = db.get(Patient, data.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    else:
        new = data.new_patient
        patient = (
            db.query(Patient)
            .filter(
                Patient.phone == new.phone,
                func.lower(Patient.full_name) == new.full_name.lower(),
            )
            .first()
        )
        if not patient:
            patient = Patient(
                user_id=None,
                full_name=new.full_name,
                phone=new.phone,
                date_of_birth=new.date_of_birth,
                gender=new.gender,
            )
            db.add(patient)
            db.flush()

    # A patient who already has a booking today should be checked in on that booking
    day_start = datetime.combine(now.date(), time.min)
    duplicate = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == doctor.id,
            Appointment.status.in_(ACTIVE),
            Appointment.start_at >= day_start,
            Appointment.start_at < day_start + timedelta(days=1),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "This patient already has an appointment with this doctor today "
                f"({duplicate.booking_reference}). Check that one in instead."
            ),
        )

    # Pick the slot: the chosen one, or the next free one today
    query = free_slots_today(db, doctor.id, now)
    if data.slot_id is not None:
        slot = query.filter(Slot.id == data.slot_id).first()
        if not slot:
            raise HTTPException(status_code=409, detail="This slot is not free")
    else:
        slot = query.first()
        if not slot:
            raise HTTPException(
                status_code=409, detail="No free slot left today for this doctor"
            )

    # One atomic UPDATE: a booked slot can never be taken by a walk-in
    claimed = (
        db.query(Slot)
        .filter(
            Slot.id == slot.id,
            or_(
                Slot.status == "available",
                and_(Slot.status == "locked", Slot.locked_until <= now),
            ),
        )
        .update({"status": "booked", "locked_until": None}, synchronize_session=False)
    )
    if claimed != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot was just taken")

    fee = doctor.consultation_fee
    token = doctor.token_amount
    remaining = max(fee - token, 0)
    fully_paid = data.collect == "full" or remaining == 0

    appointment = Appointment(
        booking_reference="APT-" + secrets.token_hex(4).upper(),
        patient_id=patient.id,
        doctor_id=doctor.id,
        clinic_id=doctor.clinic_id,
        slot_id=slot.id,
        start_at=slot.start_at,
        end_at=slot.end_at,
        status="arrived",
        payment_status="fully_paid" if fully_paid else "token_paid",
        consultation_fee=fee,
        token_amount=token,
        reason=data.reason,
        medical_notes=data.medical_notes,
        is_walk_in=True,
        checked_in_at=now,
    )
    db.add(appointment)
    db.flush()

    db.add(
        Payment(
            appointment_id=appointment.id,
            amount=token,
            payment_type="token",
            method=data.method,
            status="success",
            transaction_reference="TXN-" + uuid.uuid4().hex[:16].upper(),
            collected_by_user_id=user.id,
            paid_at=now,
        )
    )
    collected = token
    if fully_paid and remaining > 0:
        db.add(
            Payment(
                appointment_id=appointment.id,
                amount=remaining,
                payment_type="remaining",
                method=data.method,
                status="success",
                transaction_reference="TXN-" + uuid.uuid4().hex[:16].upper(),
                collected_by_user_id=user.id,
                paid_at=now,
            )
        )
        collected += remaining

    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status=None,
            new_status="arrived",
            note=f"Walk-in registered at the desk, Rs {collected} collected ({data.method})",
        )
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="walk_in_registered",
            entity_type="appointment",
            entity_id=appointment.id,
            details=(
                f"patient={patient.id}; doctor={doctor.id}; slot={slot.id}; "
                f"collected={collected}; method={data.method}"
            ),
        )
    )
    db.commit()

    return WalkInResult(
        appointment_id=appointment.id,
        booking_reference=appointment.booking_reference,
        patient_id=patient.id,
        patient_name=patient.full_name,
        doctor_name=doctor_user.name,
        slot_start=appointment.start_at,
        slot_end=appointment.end_at,
        status=appointment.status,
        payment_status=appointment.payment_status,
        amount_collected=collected,
        remaining_amount=0 if fully_paid else remaining,
        method=data.method,
    )