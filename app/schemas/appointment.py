from datetime import datetime

from pydantic import BaseModel, Field


class BookRequest(BaseModel):
    slot_id: int
    reason: str = Field(min_length=1, max_length=255)
    medical_notes: str | None = Field(default=None, max_length=2000)


class AppointmentOut(BaseModel):
    id: int
    booking_reference: str
    doctor_name: str
    specialty: str
    start_at: datetime
    end_at: datetime
    status: str
    payment_status: str
    consultation_fee: int
    token_amount: int
    remaining_amount: int
    credit_applied: int = 0
    token_due: int = 0
    pay_before: datetime | None = None


class DoctorAppointmentOut(BaseModel):
    id: int
    booking_reference: str
    start_at: datetime
    end_at: datetime
    status: str
    payment_status: str
    remaining_amount: int
    patient_name: str
    patient_phone: str
    patient_age: int | None
    patient_gender: str | None
    reason: str | None
    medical_notes: str | None