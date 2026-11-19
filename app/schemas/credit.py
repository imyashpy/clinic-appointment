from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CreditOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    patient_phone: str
    amount: int
    expires_at: datetime
    source_booking_reference: str
    source_doctor_name: str
    source_start_at: datetime


class RefundRequest(BaseModel):
    method: Literal["cash", "upi"]


class RefundResult(BaseModel):
    credit_id: int
    amount: int
    method: str
    status: str
    transaction_reference: str