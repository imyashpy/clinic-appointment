from typing import Literal

from pydantic import BaseModel


class CollectRequest(BaseModel):
    method: Literal["cash", "upi"]


class CollectResult(BaseModel):
    appointment_id: int
    booking_reference: str
    status: str
    payment_status: str
    amount_collected: int
    method: str
    transaction_reference: str