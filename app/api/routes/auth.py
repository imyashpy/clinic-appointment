from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.models import AuditLog, Clinic, Patient, User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    OtpRequest,
    OtpVerifyRequest,
)
from app.services.otp_service import normalize_phone, request_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/otp/request", response_model=MessageResponse)
def otp_request(data: OtpRequest, db: Session = Depends(get_db)):
    request_otp(db, data.phone)
    # Same reply for every number, so nobody can find out who is registered
    return MessageResponse(message="If this number can receive a code, it has been sent")


@router.post("/otp/verify", response_model=LoginResponse)
def otp_verify(data: OtpVerifyRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(data.phone)
    user = db.query(User).filter(User.phone == phone).first()

    # Validate clinic_id if provided (only for new patients)
    clinic = None
    if data.clinic_id is not None:
        clinic = db.get(Clinic, data.clinic_id)
        if not clinic or not clinic.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid clinic",
            )

    if user is None and not data.name:
        # New number: check the code without using it up, then ask for the name
        verify_otp(db, phone, data.code, consume=False)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name is required to create your account",
        )

    verify_otp(db, phone, data.code, consume=True)

    is_new = False
    if user is None:
        user = User(
            name=data.name,
            phone=phone,
            email=data.email,
            password_hash=None,  # patients have no password
            role="patient",  # always patient, never taken from the request
            clinic_id=clinic.id if clinic else None,
        )
        db.add(user)
        try:
            db.flush()

            # Link a walk-in record only when exactly one record uses this number
            walk_ins = (
                db.query(Patient)
                .filter(Patient.phone == phone, Patient.user_id.is_(None))
                .all()
            )
            if len(walk_ins) == 1:
                record = walk_ins[0]
                record.user_id = user.id
                if clinic and not record.clinic_id:
                    record.clinic_id = clinic.id
                if data.date_of_birth and not record.date_of_birth:
                    record.date_of_birth = data.date_of_birth
                if data.gender and not record.gender:
                    record.gender = data.gender
                db.add(
                    AuditLog(
                        user_id=user.id,
                        action="walk_in_record_linked",
                        entity_type="patient",
                        entity_id=record.id,
                        details="linked to the account that verified this phone by OTP",
                    )
                )
            else:
                db.add(
                    Patient(
                        user_id=user.id,
                        full_name=data.name,
                        phone=phone,
                        clinic_id=clinic.id if clinic else None,
                        date_of_birth=data.date_of_birth,
                        gender=data.gender,
                    )
                )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This mobile number is already registered",
            )
        is_new = True
    elif user.role != "patient" or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot use OTP login",
        )

    # Attach/update clinic when the patient signs in through a clinic link
    if data.clinic_id is not None and user.clinic_id != data.clinic_id:
        clinic_row = db.get(Clinic, data.clinic_id)
        if clinic_row and clinic_row.is_active:
            user.clinic_id = clinic_row.id
            db.add(user)
            db.commit()
            db.refresh(user)

    token = create_access_token(user.id, user.role)
    clinic_name = None
    if user.clinic_id:
        clinic_row = db.get(Clinic, user.clinic_id)
        if clinic_row:
            clinic_name = clinic_row.name
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        role=user.role,
        clinic_id=user.clinic_id,
        clinic_name=clinic_name,
        is_new_user=is_new,
    )


@router.post("/login", response_model=LoginResponse)
def staff_login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == data.phone).first()

    # Patients have no password and use OTP. Same message for every failure.
    if (
        not user
        or user.role == "patient"
        or not user.password_hash
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled",
        )

    token = create_access_token(user.id, user.role)
    clinic_name = None
    if user.clinic_id:
        clinic_row = db.get(Clinic, user.clinic_id)
        if clinic_row:
            clinic_name = clinic_row.name
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        role=user.role,
        clinic_id=user.clinic_id,
        clinic_name=clinic_name,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    clinic_name = None
    if user.clinic_id:
        clinic = db.get(Clinic, user.clinic_id)
        if clinic:
            clinic_name = clinic.name
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "role": user.role,
        "clinic_id": user.clinic_id,
        "clinic_name": clinic_name,
    }