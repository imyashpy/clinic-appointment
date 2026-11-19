from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_reference: Mapped[str] = mapped_column(String(20), unique=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    clinic_id: Mapped[int] = mapped_column(ForeignKey("clinics.id"))
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(
        String(20), default="payment_pending", index=True
    )  # payment_pending, confirmed, arrived, waiting, in_consultation, completed,
    # cancelled, no_show, rescheduled, doctor_cancelled
    payment_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, token_paid, partially_paid, fully_paid, refunded, refund_pending
    consultation_fee: Mapped[int] = mapped_column(Integer)  # fee at the time of booking
    token_amount: Mapped[int] = mapped_column(Integer)  # token at the time of booking
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    medical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_walk_in: Mapped[bool] = mapped_column(Boolean, default=False)
    rescheduled_from_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True
    )
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )