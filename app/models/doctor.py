from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("clinics.id"))
    specialty: Mapped[str] = mapped_column(String(100))
    qualification: Mapped[str | None] = mapped_column(String(150), nullable=True)
    consultation_fee: Mapped[int] = mapped_column(Integer)  # in rupees
    token_amount: Mapped[int] = mapped_column(Integer)  # advance token, in rupees
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)