from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Receptionist(Base):
    __tablename__ = "receptionists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    clinic_id: Mapped[int] = mapped_column(ForeignKey("clinics.id"))
    doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("doctors.id"), nullable=True
    )  # set if assigned to one doctor only
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)