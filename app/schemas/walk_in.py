from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class NewPatient(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str
    date_of_birth: date | None = None
    gender: Literal["male", "female", "other"] | None = None

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        v = v.replace(" ", "")
        if len(v) != 10 or not v.isdigit() or v[0] not in "6789":
            raise ValueError("Enter a valid 10-digit mobile number")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def check_dob(cls, v: date | None) -> date | None:
        if v is None:
            return v
        if v >= date.today():
            raise ValueError("Date of birth must be in the past")
        if v.year < date.today().year - 120:
            raise ValueError("Enter a valid date of birth")
        return v


class WalkInRequest(BaseModel):
    doctor_id: int
    patient_id: int | None = None  # an existing patient, from the search
    new_patient: NewPatient | None = None  # or a new one
    slot_id: int | None = None  # leave empty for the next free slot today
    reason: str = Field(min_length=1, max_length=255)
    medical_notes: str | None = Field(default=None, max_length=2000)
    collect: Literal["token", "full"] = "token"
    method: Literal["cash", "upi"]

    @model_validator(mode="after")
    def one_patient(self):
        if (self.patient_id is None) == (self.new_patient is None):
            raise ValueError(
                "Send either patient_id or new_patient, not both and not neither"
            )
        return self


class WalkInResult(BaseModel):
    appointment_id: int
    booking_reference: str
    patient_id: int
    patient_name: str
    doctor_name: str
    slot_start: datetime
    slot_end: datetime
    status: str
    payment_status: str
    amount_collected: int
    remaining_amount: int
    method: str


class WalkInSlot(BaseModel):
    id: int
    start_at: datetime
    end_at: datetime


class WalkInRow(BaseModel):
    appointment_id: int
    booking_reference: str
    patient_name: str
    patient_phone: str
    doctor_name: str
    start_at: datetime
    status: str
    payment_status: str