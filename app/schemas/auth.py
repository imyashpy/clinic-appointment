from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    phone: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    role: str
    clinic_id: int | None = None
    clinic_name: str | None = None
    is_new_user: bool = False


class OtpRequest(BaseModel):
    phone: str


class MessageResponse(BaseModel):
    message: str


class OtpVerifyRequest(BaseModel):
    phone: str
    code: str
    clinic_id: int | None = None
    # Only needed the first time, when the number has no account yet
    name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=150)
    date_of_birth: date | None = None
    gender: Literal["male", "female", "other"] | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = " ".join(v.split())
        if v == "":
            return None
        if len(v) < 2:
            raise ValueError("Name is too short")
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