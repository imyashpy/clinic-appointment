from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(40))  # booked, reminder, no_show ...
    channel: Mapped[str] = mapped_column(String(15))  # sms, whatsapp, email
    recipient: Mapped[str] = mapped_column(String(150))  # phone number or email
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(15), default="pending"
    )  # pending, sent, failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)