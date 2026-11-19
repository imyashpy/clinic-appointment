from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_clinic_scope, require_clinic_admin, require_roles, require_super_admin
from app.core.database import get_db
from app.core.security import hash_password
from app.models import AuditLog, Clinic, Doctor, Receptionist, User
from app.schemas.admin import DoctorCreate, ReceptionistCreate, StaffOut, ClinicAdminCreate

router = APIRouter(prefix="/admin", tags=["Admin"])

PHONE_TAKEN = "This mobile number is already registered"


def _active_clinic(db: Session, clinic_id: int) -> Clinic:
    clinic = db.get(Clinic, clinic_id)
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


def _new_user(db: Session, data, role: str, clinic_id: int | None = None) -> User:
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(status_code=409, detail=PHONE_TAKEN)
    user = User(
        name=data.name,
        phone=data.phone,
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
        clinic_id=clinic_id,
    )
    db.add(user)
    db.flush()
    return user


def _resolve_clinic_id(
    requested_clinic_id: int | None,
    clinic_scope: int | None,
    user: User,
    is_write: bool = False,
) -> int:
    # For write operations, clinic_scope should not override the requested clinic_id
    # clinic_scope is for read filtering only
    if is_write:
        if requested_clinic_id:
            return requested_clinic_id
        raise HTTPException(status_code=400, detail="Clinic ID required")
    
    # For read operations, use clinic_scope for filtering
    if clinic_scope:
        return clinic_scope
    if requested_clinic_id:
        return requested_clinic_id
    raise HTTPException(status_code=400, detail="Clinic ID required")


@router.get("/staff", response_model=list[StaffOut])
def list_staff(
    clinic_scope: int | None = Depends(get_clinic_scope),
    user: User = Depends(require_roles("super_admin", "clinic_admin")),
    db: Session = Depends(get_db),
):
    doctor_query = (
        db.query(Doctor, User, Clinic)
        .join(User, User.id == Doctor.user_id)
        .join(Clinic, Clinic.id == Doctor.clinic_id)
    )
    receptionist_query = (
        db.query(Receptionist, User, Clinic)
        .join(User, User.id == Receptionist.user_id)
        .join(Clinic, Clinic.id == Receptionist.clinic_id)
    )

    if clinic_scope:
        doctor_query = doctor_query.filter(Doctor.clinic_id == clinic_scope)
        receptionist_query = receptionist_query.filter(Receptionist.clinic_id == clinic_scope)

    doctors = doctor_query.all()
    receptionists = receptionist_query.all()

    staff = []
    for doctor, u, clinic in doctors:
        staff.append(
            StaffOut(
                user_id=u.id,
                profile_id=doctor.id,
                name=u.name,
                phone=u.phone,
                role=u.role,
                clinic_id=clinic.id,
            )
        )
    for receptionist, u, clinic in receptionists:
        staff.append(
            StaffOut(
                user_id=u.id,
                profile_id=receptionist.id,
                name=u.name,
                phone=u.phone,
                role=u.role,
                clinic_id=clinic.id,
            )
        )
    return staff


@router.post("/doctors", response_model=StaffOut, status_code=201)
def create_doctor(
    data: DoctorCreate,
    user: User = Depends(require_clinic_admin),
    db: Session = Depends(get_db),
):
    clinic_id = _resolve_clinic_id(data.clinic_id, user.clinic_id, user, is_write=True)
    clinic = _active_clinic(db, clinic_id)

    if user.role == "clinic_admin" and clinic_id != user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot create doctor in another clinic")

    try:
        u = _new_user(db, data, "doctor", clinic_id)
        doctor = Doctor(
            user_id=u.id,
            clinic_id=clinic.id,
            specialty=data.specialty,
            qualification=data.qualification,
            consultation_fee=data.consultation_fee,
            token_amount=data.token_amount,
            slot_duration_minutes=data.slot_duration_minutes,
        )
        db.add(doctor)
        db.flush()
        db.add(
            AuditLog(
                user_id=user.id,
                action="doctor_created",
                entity_type="doctor",
                entity_id=doctor.id,
                details=f"name={u.name}; clinic={clinic.id}; specialty={data.specialty}",
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=PHONE_TAKEN)

    return StaffOut(
        user_id=u.id,
        profile_id=doctor.id,
        name=u.name,
        phone=u.phone,
        role=u.role,
        clinic_id=clinic.id,
    )


@router.post("/receptionists", response_model=StaffOut, status_code=201)
def create_receptionist(
    data: ReceptionistCreate,
    user: User = Depends(require_clinic_admin),
    db: Session = Depends(get_db),
):
    clinic_id = _resolve_clinic_id(data.clinic_id, user.clinic_id, user, is_write=True)
    clinic = _active_clinic(db, clinic_id)

    if user.role == "clinic_admin" and clinic_id != user.clinic_id:
        raise HTTPException(status_code=403, detail="Cannot create receptionist in another clinic")

    if data.doctor_id is not None:
        doctor = db.get(Doctor, data.doctor_id)
        if not doctor or doctor.clinic_id != clinic.id:
            raise HTTPException(
                status_code=404, detail="Doctor not found in this clinic"
            )

    try:
        u = _new_user(db, data, "receptionist", clinic_id)
        receptionist = Receptionist(
            user_id=u.id, clinic_id=clinic.id, doctor_id=data.doctor_id
        )
        db.add(receptionist)
        db.flush()
        db.add(
            AuditLog(
                user_id=user.id,
                action="receptionist_created",
                entity_type="receptionist",
                entity_id=receptionist.id,
                details=f"name={u.name}; clinic={clinic.id}; doctor={data.doctor_id}",
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=PHONE_TAKEN)

    return StaffOut(
        user_id=u.id,
        profile_id=receptionist.id,
        name=u.name,
        phone=u.phone,
        role=u.role,
        clinic_id=clinic.id,
    )


@router.post("/clinic-admins", response_model=StaffOut, status_code=201)
def create_clinic_admin(
    data: ClinicAdminCreate,
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    clinic = _active_clinic(db, data.clinic_id)

    try:
        u = _new_user(db, data, "clinic_admin", clinic.id)
        db.flush()
        db.add(
            AuditLog(
                user_id=user.id,
                action="clinic_admin_created",
                entity_type="user",
                entity_id=u.id,
                details=f"name={u.name}; clinic={clinic.id}",
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=PHONE_TAKEN)

    return StaffOut(
        user_id=u.id,
        profile_id=u.id,
        name=u.name,
        phone=u.phone,
        role=u.role,
        clinic_id=clinic.id,
    )