from datetime import datetime

from pydantic import BaseModel


class PaymentHistoryRow(BaseModel):
    payment_id: int
    booking_reference: str
    doctor_name: str
    appointment_start: datetime
    payment_type: str
    method: str
    status: str
    amount: int
    transaction_reference: str
    paid_at: datetime | None


class PaymentHistoryPage(BaseModel):
    total: int
    items: list[PaymentHistoryRow]


class Receipt(BaseModel):
    receipt_number: str
    patient_name: str
    patient_phone: str
    clinic_name: str
    clinic_address: str | None
    doctor_name: str
    specialty: str
    booking_reference: str
    appointment_start: datetime
    appointment_end: datetime
    payment_type: str
    method: str
    payment_status: str
    amount: int
    paid_at: datetime | None
    consultation_fee: int
    token_amount: int
    paid_so_far: int
    balance_due: int


class CreditRow(BaseModel):
    id: int
    amount: int
    status: str  # active, used, refunded, expired
    expires_at: datetime
    source_booking_reference: str
    source_start_at: datetime
    used_for_booking_reference: str | None


class CreditsOut(BaseModel):
    active_total: int
    items: list[CreditRow]


class NoShowRow(BaseModel):
    appointment_id: int
    booking_reference: str
    doctor_name: str
    start_at: datetime
    token_forfeited: int