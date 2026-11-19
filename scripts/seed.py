from datetime import date

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Clinic, Doctor, Patient, Receptionist, User

PASSWORD = "Test@123"  # same password for every seeded user, testing only

CLINIC = {
    "name": "Sharma Skin & Care Clinic",
    "address": "14, City Center Plaza, MG Road",
    "city": "Indore",
    "phone": "9826140352",
}

ADMIN = {
    "name": "Clinic Admin",
    "phone": "9826140352",
    "email": "admin@example.com",
}

CLINIC_ADMIN = {
    "name": "Clinic Owner",
    "phone": "9988776655",
    "email": "owner@sharmaclinic.com",
}

DOCTORS = [
    {
        "name": "Dr. Anil Sharma",
        "phone": "9425873104",
        "email": "anil.sharma@example.com",
        "specialty": "Dermatology",
        "qualification": "MBBS, MD (Dermatology)",
        "fee": 500,
        "token": 100,
        "slot_minutes": 30,
    },
    {
        "name": "Dr. Neha Gupta",
        "phone": "9302518647",
        "email": "neha.gupta@example.com",
        "specialty": "General Physician",
        "qualification": "MBBS, MD (Medicine)",
        "fee": 400,
        "token": 100,
        "slot_minutes": 15,
    },
    {
        "name": "Dr. Rohit Mehta",
        "phone": "9753206481",
        "email": "rohit.mehta@example.com",
        "specialty": "Pediatrics",
        "qualification": "MBBS, DCH",
        "fee": 600,
        "token": 150,
        "slot_minutes": 20,
    },
]

RECEPTIONISTS = [
    {
        "name": "Priya Verma",
        "phone": "8109374256",
        "email": "priya.verma@example.com",
        "doctor_phone": "9425873104",  # works with Dr. Anil Sharma only
    },
    {
        "name": "Sunita Joshi",
        "phone": "7898164023",
        "email": "sunita.joshi@example.com",
        "doctor_phone": None,  # works for the whole clinic
    },
]

PATIENTS = [
    {"name": "Rahul Mishra", "phone": "9893417652", "email": "rahul.mishra@example.com", "dob": date(1992, 3, 14), "gender": "male"},
    {"name": "Anjali Singh", "phone": "9179602348", "email": "anjali.singh@example.com", "dob": date(1998, 7, 22), "gender": "female"},
    {"name": "Mohit Agarwal", "phone": "8878534196", "email": "mohit.agarwal@example.com", "dob": date(1985, 11, 5), "gender": "male"},
    {"name": "Kavita Patel", "phone": "9926371845", "email": "kavita.patel@example.com", "dob": date(1979, 1, 30), "gender": "female"},
    {"name": "Suresh Yadav", "phone": "7581094263", "email": "suresh.yadav@example.com", "dob": date(1968, 9, 18), "gender": "male"},
]


def get_or_create_user(db, name, phone, role, email=None, clinic_id=None):
    user = db.query(User).filter(User.phone == phone).first()
    if user:
        return user
    user = User(
        name=name,
        phone=phone,
        email=email,
        role=role,
        clinic_id=clinic_id,
        password_hash=hash_password(PASSWORD),
    )
    db.add(user)
    db.flush()
    return user


def main():
    db = SessionLocal()
    try:
        clinic = db.query(Clinic).filter(Clinic.name == CLINIC["name"]).first()
        if not clinic:
            clinic = Clinic(**CLINIC)
            db.add(clinic)
            db.flush()

        get_or_create_user(
            db, ADMIN["name"], ADMIN["phone"], "super_admin", ADMIN["email"]
        )

        # Create clinic admin
        get_or_create_user(
            db, CLINIC_ADMIN["name"], CLINIC_ADMIN["phone"], "clinic_admin", CLINIC_ADMIN["email"], clinic.id
        )

        doctors_by_phone = {}
        for d in DOCTORS:
            user = get_or_create_user(db, d["name"], d["phone"], "doctor", d["email"], clinic.id)
            doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
            if not doctor:
                doctor = Doctor(
                    user_id=user.id,
                    clinic_id=clinic.id,
                    specialty=d["specialty"],
                    qualification=d["qualification"],
                    consultation_fee=d["fee"],
                    token_amount=d["token"],
                    slot_duration_minutes=d["slot_minutes"],
                )
                db.add(doctor)
                db.flush()
            doctors_by_phone[d["phone"]] = doctor

        for r in RECEPTIONISTS:
            user = get_or_create_user(
                db, r["name"], r["phone"], "receptionist", r["email"], clinic.id
            )
            exists = (
                db.query(Receptionist).filter(Receptionist.user_id == user.id).first()
            )
            if not exists:
                doctor_id = None
                if r["doctor_phone"]:
                    doctor_id = doctors_by_phone[r["doctor_phone"]].id
                db.add(
                    Receptionist(
                        user_id=user.id, clinic_id=clinic.id, doctor_id=doctor_id
                    )
                )

        for p in PATIENTS:
            user = get_or_create_user(db, p["name"], p["phone"], "patient", p["email"], clinic.id)
            exists = db.query(Patient).filter(Patient.user_id == user.id).first()
            if not exists:
                db.add(
                    Patient(
                        user_id=user.id,
                        full_name=p["name"],
                        phone=p["phone"],
                        date_of_birth=p["dob"],
                        gender=p["gender"],
                        clinic_id=clinic.id,
                    )
                )

        db.commit()
        print("Seed done")
    finally:
        db.close()


if __name__ == "__main__":
    main()