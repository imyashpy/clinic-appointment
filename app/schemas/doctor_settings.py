from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DoctorSettingsOut(BaseModel):
    doctor_id: int
    name: str
    clinic_name: str
    specialty: str
    qualification: str | None
    consultation_fee: int
    token_amount: int
    slot_duration_minutes: int
    receptionist_name: str | None = None


class DoctorSettingsUpdate(BaseModel):
    qualification: str | None = Field(default=None, max_length=150)
    consultation_fee: int | None = Field(default=None, ge=1, le=100000)
    token_amount: int | None = Field(default=None, ge=1, le=100000)
    slot_duration_minutes: Literal[15, 20, 30, 45, 60] | None = None

    @model_validator(mode="after")
    def at_least_one(self):
        if all(
            v is None
            for v in (
                self.qualification,
                self.consultation_fee,
                self.token_amount,
                self.slot_duration_minutes,
            )
        ):
            raise ValueError("Send at least one setting to change")
        return self


class SettingsResult(BaseModel):
    settings: DoctorSettingsOut
    slots_removed: int
    slots_hidden: int
    slots_created: int
    message: str