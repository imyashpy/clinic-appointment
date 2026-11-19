from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TokenCredit(Base):
    __tablename__ = "token_credits"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    source_appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"), unique=True
    )  # the cancelled appointment this credit came from, one credit per cancel
    amount: Mapped[int] = mapped_column(Integer)  # in rupees
    status: Mapped[str] = mapped_column(
        String(20), default="active", index=True
    )  # active, used, refunded, expired
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_for_appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True
    )  # the new booking that used the credit
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )  # when it was used, refunded or expired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)