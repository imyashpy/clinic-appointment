from datetime import date

from pydantic import BaseModel

from app.schemas.appointment import DoctorAppointmentOut


class ReceptionAppointmentOut(DoctorAppointmentOut):
    doctor_name: str
    specialty: str


class ReceptionDashboard(BaseModel):
    day: date
    total_appointments: int
    arrived: int
    waiting: int
    in_consultation: int
    completed: int
    not_arrived: int
    no_show: int
    cancelled: int
    token_collected: int
    remaining_collected: int
    total_received: int
    remaining_pending: int