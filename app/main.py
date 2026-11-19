from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (loads all tables)
from app.api.routes import (
    admin_clinics,
    admin_staff,
    admin_stats,
    admin_users,
    admin_views,
    appointment_actions,
    appointments,
    auth,
    doctor_appointments,
    doctor_cancel,
    doctor_earnings,
    doctor_patients,
    doctor_settings,
    doctors,
    patient_account,
    reception,
    reception_credits,
    reception_patients,
    reception_walkin,
    schedule,
    slots,
)
from app.core.database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Clinic Appointment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(schedule.router)
app.include_router(slots.router)
app.include_router(doctor_appointments.router)
app.include_router(doctor_patients.router)
app.include_router(doctor_cancel.router)
app.include_router(doctor_earnings.router)
app.include_router(doctor_settings.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(appointment_actions.router)
app.include_router(patient_account.router)
app.include_router(reception.router)
app.include_router(reception_patients.router)
app.include_router(reception_credits.router)
app.include_router(reception_walkin.router)
app.include_router(admin_clinics.router)
app.include_router(admin_staff.router)
app.include_router(admin_users.router)
app.include_router(admin_views.router)
app.include_router(admin_stats.router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}