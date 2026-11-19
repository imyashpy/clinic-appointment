from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"), index=True
    )
    amount: Mapped[int] = mapped_column(Integer)  # in rupees
    payment_type: Mapped[str] = mapped_column(String(20))  # token, remaining, token_transfer
    method: Mapped[str] = mapped_column(String(20))  # online, cash, upi
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, success, failed, refunded
    gateway: Mapped[str | None] = mapped_column(String(30), nullable=True)
    gateway_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )  # unique, so a duplicate gateway callback cannot be saved twice
    transaction_reference: Mapped[str] = mapped_column(String(100), unique=True)
    collected_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)