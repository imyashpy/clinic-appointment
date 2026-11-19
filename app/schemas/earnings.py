from datetime import date

from pydantic import BaseModel


class EarningsOut(BaseModel):
    period: str
    start: date
    end: date  # last day included
    token_collected: int
    remaining_collected: int
    online_collected: int
    cash_collected: int
    upi_collected: int
    total_collected: int
    refunds: int
    net_collected: int
    consultation_revenue: int
    forfeited_tokens: int
    outstanding: int
    appointments_total: int
    completed: int
    no_show: int
    cancelled: int