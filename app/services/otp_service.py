import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import OtpCode, User

OTP_VALID_MINUTES = 5
MAX_WRONG_TRIES = 5
RESEND_AFTER_SECONDS = 60
MAX_REQUESTS_PER_HOUR = 5

BAD_CODE = "Incorrect or expired code"


def normalize_phone(phone: str) -> str:
    phone = phone.replace(" ", "")
    if len(phone) != 10 or not phone.isdigit() or phone[0] not in "6789":
        raise HTTPException(
            status_code=422, detail="Enter a valid 10-digit mobile number"
        )
    return phone


def _dev_mode() -> bool:
    return True


def _deliver(phone: str, code: str) -> None:
    if _dev_mode():
        print(f"[DEV OTP] {phone}: {code}")
        return
    # The real SMS provider goes here once it is chosen
    raise HTTPException(status_code=503, detail="SMS sending is not set up yet")


def request_otp(db: Session, phone: str) -> None:
    phone = normalize_phone(phone)
    now = datetime.now()

    existing = db.query(User).filter(User.phone == phone).first()
    if existing and (existing.role != "patient" or not existing.is_active):
        # Staff use the password login. The reply looks the same, nothing is sent.
        if _dev_mode():
            print(f"[DEV OTP] {phone} is a staff or disabled account, no code sent")
        return

    latest = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone)
        .order_by(OtpCode.id.desc())
        .first()
    )
    if latest:
        elapsed = (now - latest.created_at).total_seconds()
        if elapsed < RESEND_AFTER_SECONDS:
            wait = int(RESEND_AFTER_SECONDS - elapsed) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait} seconds before asking for a new code",
            )

    recent = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.created_at >= now - timedelta(hours=1))
        .count()
    )
    if recent >= MAX_REQUESTS_PER_HOUR:
        raise HTTPException(
            status_code=429, detail="Too many code requests. Try again in an hour."
        )

    code = f"{secrets.randbelow(1_000_000):06d}"

    # Only the newest code may work
    db.query(OtpCode).filter(
        OtpCode.phone == phone, OtpCode.used_at.is_(None)
    ).update({"used_at": now}, synchronize_session=False)

    db.add(
        OtpCode(
            phone=phone,
            code_hash=hash_password(code),
            expires_at=now + timedelta(minutes=OTP_VALID_MINUTES),
            created_at=now,
        )
    )
    _deliver(phone, code)  # if sending fails, nothing is saved
    db.commit()


def verify_otp(db: Session, phone: str, code: str, consume: bool = True) -> str:
    phone = normalize_phone(phone)
    now = datetime.now()

    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail=BAD_CODE)

    otp = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.used_at.is_(None))
        .order_by(OtpCode.id.desc())
        .with_for_update()
        .first()
    )
    if not otp or otp.expires_at <= now or otp.attempts >= MAX_WRONG_TRIES:
        db.rollback()
        raise HTTPException(status_code=400, detail=BAD_CODE)

    if not verify_password(code, otp.code_hash):
        otp.attempts += 1
        db.commit()  # the wrong try must be saved even though we raise an error
        raise HTTPException(status_code=400, detail=BAD_CODE)

    if consume:
        otp.used_at = now
        db.commit()
    else:
        db.rollback()  # code is right but stays usable, nothing is changed
    return phone