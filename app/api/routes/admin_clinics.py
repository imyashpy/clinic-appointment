from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_clinic_scope, require_roles, require_super_admin
from app.core.database import get_db
from app.models import AuditLog, Clinic, User
from app.schemas.admin import ClinicCreate, ClinicOut

router = APIRouter(prefix="/admin/clinics", tags=["Admin"])


@router.post("", response_model=ClinicOut, status_code=201)
def create_clinic(
    data: ClinicCreate,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    exists = (
        db.query(Clinic)
        .filter(Clinic.name == data.name, Clinic.city == data.city)
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=409, detail="A clinic with this name already exists in this city"
        )

    clinic = Clinic(
        name=data.name, address=data.address, city=data.city, phone=data.phone
    )
    db.add(clinic)
    db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="clinic_created",
            entity_type="clinic",
            entity_id=clinic.id,
            details=f"name={clinic.name}; city={clinic.city}",
        )
    )
    db.commit()
    return clinic


@router.get("", response_model=list[ClinicOut])
def list_clinics(
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = db.query(Clinic).order_by(Clinic.name)
    if clinic_scope:
        query = query.filter(Clinic.id == clinic_scope)
    clinics = query.all()
    
    # Find admin for each clinic
    result = []
    for clinic in clinics:
        admin = (
            db.query(User)
            .filter(User.role == "clinic_admin", User.clinic_id == clinic.id)
            .first()
        )
        clinic.admin_name = admin.name if admin else None
        result.append(clinic)
    
    return result


@router.patch("/{clinic_id}/toggle", response_model=ClinicOut)
def toggle_clinic(
    clinic_id: int,
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if clinic_scope is not None and clinic.id != clinic_scope:
        raise HTTPException(status_code=403, detail="Not your clinic")
    clinic.is_active = not clinic.is_active
    db.add(
        AuditLog(
            user_id=user.id,
            action="clinic_toggled",
            entity_type="clinic",
            entity_id=clinic.id,
            details=f"name={clinic.name}; is_active={clinic.is_active}",
        )
    )
    db.commit()
    db.refresh(clinic)
    return clinic