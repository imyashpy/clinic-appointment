from datetime import date, datetime

from pydantic import BaseModel


class UserRow(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    role: str
    is_active: bool
    created_at: datetime


class UserPage(BaseModel):
    total: int
    items: list[UserRow]


class ActiveRequest(BaseModel):
    is_active: bool


class AdminAppointmentRow(BaseModel):
    id: int
    booking_reference: str
    patient_name: str
    patient_phone: str
    doctor_name: str
    clinic_name: str
    start_at: datetime
    status: str
    payment_status: str
    consultation_fee: int
    token_amount: int


class AdminAppointmentPage(BaseModel):
    total: int
    items: list[AdminAppointmentRow]


class PaymentRow(BaseModel):
    id: int
    appointment_id: int
    booking_reference: str
    payment_type: str
    method: str
    status: str
    amount: int
    transaction_reference: str
    paid_at: datetime | None
    collected_by: str | None


class PaymentPage(BaseModel):
    total: int
    items: list[PaymentRow]


class RefundRow(BaseModel):
    id: int
    appointment_id: int
    booking_reference: str
    amount: int
    status: str
    transaction_reference: str
    reason: str | None
    processed_at: datetime | None


class RefundPage(BaseModel):
    total: int
    items: list[RefundRow]


class AuditRow(BaseModel):
    id: int
    user_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    details: str | None
    created_at: datetime


class AuditPage(BaseModel):
    total: int
    items: list[AuditRow]


class DoctorStat(BaseModel):
    doctor_id: int
    doctor_name: str
    clinic_name: str
    appointments: int
    completed: int
    no_show: int
    cancelled: int


class ClinicStat(BaseModel):
    clinic_id: int
    clinic_name: str
    appointments: int
    completed: int
    collected: int


class PlatformStats(BaseModel):
    period: str
    start: date
    end: date
    doctors: int
    patients: int
    appointments_total: int
    completed: int
    no_show: int
    cancelled: int
    total_collected: int
    refunds: int
    net_collected: int
    forfeited_tokens: int
    doctor_wise: list[DoctorStat]
    clinic_wise: list[ClinicStat]