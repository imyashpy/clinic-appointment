from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_clinic_scope, require_roles
from app.core.database import get_db
from app.models import AuditLog, User
from app.schemas.admin_views import ActiveRequest, UserPage, UserRow

router = APIRouter(prefix="/admin/users", tags=["Admin"])


def _row(u: User) -> UserRow:
    return UserRow(
        id=u.id,
        name=u.name,
        phone=u.phone,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("", response_model=UserPage)
def list_users(
    role: Literal["patient", "doctor", "receptionist", "super_admin", "clinic_admin"] | None = Query(None),
    q: str | None = Query(None, min_length=3, max_length=50, description="Name or phone"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if clinic_scope:
        query = query.filter(User.clinic_id == clinic_scope)
    if role:
        query = query.filter(User.role == role)
    if q:
        safe = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{safe}%"
        query = query.filter(
            or_(
                User.name.ilike(pattern, escape="\\"),
                User.phone.like(pattern, escape="\\"),
            )
        )
    total = query.count()
    users = query.order_by(User.id.desc()).offset(offset).limit(limit).all()
    return UserPage(total=total, items=[_row(u) for u in users])


@router.patch("/{user_id}/active", response_model=UserRow)
def set_active(
    user_id: int,
    data: ActiveRequest,
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=409, detail="You cannot change your own account")
    if clinic_scope and target.clinic_id != clinic_scope:
        raise HTTPException(status_code=403, detail="Cannot modify user in another clinic")

    if target.is_active != data.is_active:
        target.is_active = data.is_active
        db.add(
            AuditLog(
                user_id=user.id,
                action="user_enabled" if data.is_active else "user_disabled",
                entity_type="user",
                entity_id=target.id,
                details=f"name={target.name}; role={target.role}",
            )
        )
        db.commit()
    return _row(target)