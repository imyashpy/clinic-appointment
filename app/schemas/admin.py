from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ClinicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    phone: str | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        v = v.replace(" ", "").replace("-", "")
        if not v.isdigit() or not (8 <= len(v) <= 15):
            raise ValueError("Enter a valid phone number")
        return v


class ClinicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str | None
    city: str | None
    phone: str | None
    is_active: bool
    admin_name: str | None = None


class StaffBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str
    email: str | None = Field(default=None, max_length=150)
    password: str = Field(min_length=8, max_length=72)
    clinic_id: int

    @field_validator("name")
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

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if "@" not in v or v.startswith("@") or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def check_password_bytes(cls, v: str) -> str:
        # bcrypt only accepts up to 72 bytes
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        return v


class DoctorCreate(StaffBase):
    specialty: str = Field(min_length=2, max_length=100)
    qualification: str | None = Field(default=None, max_length=150)
    consultation_fee: int = Field(ge=1, le=100000)
    token_amount: int = Field(ge=1, le=100000)
    slot_duration_minutes: Literal[15, 20, 30, 45, 60] = 30

    @model_validator(mode="after")
    def token_not_above_fee(self):
        if self.token_amount > self.consultation_fee:
            raise ValueError("token_amount cannot be more than the consultation fee")
        return self


class ReceptionistCreate(StaffBase):
    doctor_id: int | None = None  # leave empty for a receptionist of the whole clinic


class StaffOut(BaseModel):
    user_id: int
    profile_id: int
    name: str
    phone: str
    role: str
    clinic_id: int


class ClinicAdminCreate(StaffBase):
    pass