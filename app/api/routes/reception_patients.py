from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Patient, User

router = APIRouter(prefix="/reception/patients", tags=["Reception"])


class PatientSearchOut(BaseModel):
    id: int
    full_name: str
    phone: str
    age: int | None
    gender: str | None
    has_account: bool  # false for walk-in patients with no login


def _age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.get("", response_model=list[PatientSearchOut])
def search_patients(
    q: str = Query(..., min_length=3, max_length=50, description="Name or mobile number"),
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    q = q.strip()
    # Treat % and _ as normal characters, not as wildcards
    safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{safe}%"

    patients = (
        db.query(Patient)
        .filter(
            or_(
                Patient.full_name.ilike(pattern, escape="\\"),
                Patient.phone.like(pattern, escape="\\"),
            )
        )
        .order_by(Patient.full_name)
        .limit(20)
        .all()
    )

    return [
        PatientSearchOut(
            id=p.id,
            full_name=p.full_name,
            phone=p.phone,
            age=_age(p.date_of_birth),
            gender=p.gender,
            has_account=p.user_id is not None,
        )
        for p in patients
    ]