from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from sqlalchemy.orm import Session

from app.api.routes.schedule import get_my_doctor
from app.core.database import get_db
from app.models import Doctor, Slot
from app.services.slot_service import generate_slots
from app.schemas.doctor import SlotOut

router = APIRouter(prefix="/doctors/me/slots", tags=["Doctor Slots"])


@router.post("/generate")
def generate(
    days_ahead: int = Query(14, ge=1, le=60),
    start_date: date | None = Query(None),
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    created = generate_slots(db, doctor, days_ahead, start_date)
    return {"created": created, "days_ahead": days_ahead, "start_date": str(start_date or date.today())}


@router.patch("/{slot_id}/block", response_model=SlotOut)
def block_slot(
    slot_id: int,
    doctor: Doctor = Depends(get_my_doctor),
    db: Session = Depends(get_db),
):
    slot = db.get(Slot, slot_id)
    if not slot or slot.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.status = "blocked" if slot.status == "available" else "available"
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return SlotOut(id=slot.id, start_at=slot.start_at, end_at=slot.end_at, status=slot.status)