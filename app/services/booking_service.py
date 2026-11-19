import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentHistory,
    Doctor,
    Patient,
    Payment,
    Slot,
    User,
)
from app.schemas.appointment import AppointmentOut
from app.services.credit_service import (
    apply_credit,
    find_usable_credit,
    release_credit,
)

LOCK_MINUTES = 10


def start_booking(
    db: Session,
    user: User,
    slot_id: int,
    reason: str,
    medical_notes: str | None,
) -> Appointment:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    slot = db.get(Slot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    doctor = db.get(Doctor, slot.doctor_id)

    now = datetime.now()
    locked_until = now + timedelta(minutes=LOCK_MINUTES)

    # One atomic UPDATE: only one patient can win the slot.
    # A lock whose time has run out counts as free again.
    won = (
        db.query(Slot)
        .filter(
            Slot.id == slot_id,
            Slot.start_at > now,
            or_(
                Slot.status == "available",
                and_(Slot.status == "locked", Slot.locked_until <= now),
            ),
        )
        .update(
            {"status": "locked", "locked_until": locked_until},
            synchronize_session=False,
        )
    )
    if won != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot is no longer available")

    # Release whoever held this slot before and never paid
    stale = (
        db.query(Appointment)
        .filter(Appointment.slot_id == slot_id, Appointment.status == "payment_pending")
        .all()
    )
    for old in stale:
        old.status = "cancelled"
        db.add(
            AppointmentHistory(
                appointment_id=old.id,
                old_status="payment_pending",
                new_status="cancelled",
                note="Payment time expired",
            )
        )
        db.query(Payment).filter(
            Payment.appointment_id == old.id, Payment.status == "pending"
        ).update({"status": "failed"}, synchronize_session=False)
        release_credit(db, old)

    appointment = Appointment(
        booking_reference="APT-" + secrets.token_hex(4).upper(),
        patient_id=patient.id,
        doctor_id=doctor.id,
        clinic_id=doctor.clinic_id,
        slot_id=slot.id,
        start_at=slot.start_at,
        end_at=slot.end_at,
        status="payment_pending",
        payment_status="pending",
        consultation_fee=doctor.consultation_fee,
        token_amount=doctor.token_amount,
        reason=reason,
        medical_notes=medical_notes,
    )
    db.add(appointment)
    db.flush()

    db.add(
        AppointmentHistory(
            appointment_id=appointment.id,
            changed_by_user_id=user.id,
            old_status=None,
            new_status="payment_pending",
            note="Booking started, slot locked",
        )
    )

    # A token credit from an earlier cancel pays the token, fully or in part
    token_due = doctor.token_amount
    credit = find_usable_credit(db, patient.id)
    if credit:
        token_due = apply_credit(db, appointment, credit, doctor.token_amount)

    if token_due > 0:
        db.add(
            Payment(
                appointment_id=appointment.id,
                amount=token_due,
                payment_type="token",
                method="online",
                status="pending",
                transaction_reference="TXN-" + uuid.uuid4().hex[:16].upper(),
            )
        )
    else:
        # Nothing left to pay: the booking is confirmed straight away
        appointment.status = "confirmed"
        appointment.payment_status = "token_paid"
        db.query(Slot).filter(Slot.id == slot.id).update(
            {"status": "booked", "locked_until": None}, synchronize_session=False
        )
        db.add(
            AppointmentHistory(
                appointment_id=appointment.id,
                changed_by_user_id=user.id,
                old_status="payment_pending",
                new_status="confirmed",
                note="Token covered by credit",
            )
        )

    db.commit()
    return appointment


def to_appointment_out(db: Session, appointment: Appointment) -> AppointmentOut:
    doctor = db.get(Doctor, appointment.doctor_id)
    doctor_user = db.get(User, doctor.user_id)

    pay_before = None
    if appointment.status == "payment_pending":
        pay_before = db.get(Slot, appointment.slot_id).locked_until

    payments = (
        db.query(Payment).filter(Payment.appointment_id == appointment.id).all()
    )
    credit_applied = sum(
        p.amount
        for p in payments
        if p.payment_type == "token_transfer" and p.status == "success"
    )
    token_due = sum(
        p.amount
        for p in payments
        if p.payment_type == "token" and p.status == "pending"
    )

    remaining = (
        0
        if appointment.payment_status == "fully_paid"
        else appointment.consultation_fee - appointment.token_amount
    )

    return AppointmentOut(
        id=appointment.id,
        booking_reference=appointment.booking_reference,
        doctor_name=doctor_user.name,
        specialty=doctor.specialty,
        start_at=appointment.start_at,
        end_at=appointment.end_at,
        status=appointment.status,
        payment_status=appointment.payment_status,
        consultation_fee=appointment.consultation_fee,
        token_amount=appointment.token_amount,
        remaining_amount=remaining,
        credit_applied=credit_applied,
        token_due=token_due,
        pay_before=pay_before,
    )