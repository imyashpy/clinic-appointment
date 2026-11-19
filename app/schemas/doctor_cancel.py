from datetime import datetime

from pydantic import BaseModel, Field


class DoctorCancelRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=255)


class DoctorCancelResult(BaseModel):
    appointment_id: int
    booking_reference: str
    patient_name: str
    patient_phone: str
    status: str
    credit_amount: int
    credit_valid_until: datetime
    message: str