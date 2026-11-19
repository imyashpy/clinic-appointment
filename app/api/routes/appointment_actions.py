from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models import Appointment, User
from app.schemas.payment import CollectRequest, CollectResult
from app.services import appointment_actions as actions
from app.services.collection_service import collect_remaining

router = APIRouter(prefix="/appointments", tags=["Appointment Actions"])


class ActionResult(BaseModel):
    id: int
    booking_reference: str
    status: str


def _result(a: Appointment) -> ActionResult:
    return ActionResult(id=a.id, booking_reference=a.booking_reference, status=a.status)


@router.post("/{appointment_id}/check-in", response_model=ActionResult)
def check_in(
    appointment_id: int,
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    return _result(actions.check_in(db, user, appointment_id))


@router.post("/{appointment_id}/start", response_model=ActionResult)
def start(
    appointment_id: int,
    user: User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
):
    return _result(actions.start_consultation(db, user, appointment_id))


@router.post("/{appointment_id}/complete", response_model=ActionResult)
def complete(
    appointment_id: int,
    user: User = Depends(require_roles("doctor")),
    db: Session = Depends(get_db),
):
    return _result(actions.complete_consultation(db, user, appointment_id))


@router.post("/{appointment_id}/no-show", response_model=ActionResult)
def no_show(
    appointment_id: int,
    user: User = Depends(require_roles("receptionist", "doctor")),
    db: Session = Depends(get_db),
):
    return _result(actions.mark_no_show(db, user, appointment_id))


@router.post("/{appointment_id}/collect-payment", response_model=CollectResult)
def collect_payment(
    appointment_id: int,
    data: CollectRequest,
    user: User = Depends(require_roles("receptionist")),
    db: Session = Depends(get_db),
):
    appointment, payment = collect_remaining(db, user, appointment_id, data.method)
    return CollectResult(
        appointment_id=appointment.id,
        booking_reference=appointment.booking_reference,
        status=appointment.status,
        payment_status=appointment.payment_status,
        amount_collected=payment.amount,
        method=payment.method,
        transaction_reference=payment.transaction_reference,
    )