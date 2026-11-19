from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScheduleDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day_of_week: int = Field(ge=0, le=6)  # 0 = Monday ... 6 = Sunday
    start_time: time
    end_time: time
    break_start: time | None = None
    break_end: time | None = None

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if (self.break_start is None) != (self.break_end is None):
            raise ValueError("break_start and break_end must be given together")
        if self.break_start is not None:
            if self.break_end <= self.break_start:
                raise ValueError("break_end must be after break_start")
            if self.break_start < self.start_time or self.break_end > self.end_time:
                raise ValueError("break must be inside working hours")
        return self


class ScheduleUpdate(BaseModel):
    days: list[ScheduleDay]

    @model_validator(mode="after")
    def no_duplicate_days(self):
        days = [d.day_of_week for d in self.days]
        if len(days) != len(set(days)):
            raise ValueError("Each day can appear only once")
        return self