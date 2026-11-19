from datetime import datetime

from pydantic import BaseModel


class DoctorOut(BaseModel):
    id: int
    name: str
    specialty: str
    qualification: str | None
    clinic_name: str
    consultation_fee: int
    token_amount: int
    slot_duration_minutes: int


class SlotOut(BaseModel):
    id: int
    start_at: datetime
    end_at: datetime
    status: str  # available, locked, booked