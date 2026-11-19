from datetime import datetime

from pydantic import BaseModel


class PastVisit(BaseModel):
    appointment_id: int
    booking_reference: str
    start_at: datetime
    status: str
    payment_status: str
    reason: str | None
    medical_notes: str | None
    visit_started: datetime | None
    visit_ended: datetime | None


class PatientHistory(BaseModel):
    patient_name: str
    patient_phone: str
    patient_age: int | None
    patient_gender: str | None
    visits: list[PastVisit]