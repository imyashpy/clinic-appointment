import React, { useCallback, useEffect, useState } from "react";
import { bookAppointment, listDoctorSlots, listDoctors } from "./api.js";
import DoctorAvatar from "../../shared/DoctorAvatar.jsx";

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(value));
}

export default function AppointmentCalendarPage({ onNavigate }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [day, setDay] = useState(localDateValue());
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAppointment, setConfirmAppointment] = useState(null);

  useEffect(() => {
    listDoctors()
      .then((items) => {
        setDoctors(items);
        if (items.length) setDoctorId(String(items[0].id));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoadingDoctors(false));
  }, []);

  const refreshSlots = useCallback(async () => {
    if (!doctorId || !day) return;
    let active = true;
    setLoadingSlots(true);
    setSlots([]);
    setSlotId("");
    listDoctorSlots(doctorId, day)
      .then((items) => { if (active) setSlots(items); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [doctorId, day]);

  useEffect(() => {
    const sub = refreshSlots();
    return () => { if (typeof sub?.return === "function") sub.return(); };
  }, [refreshSlots]);

  const doctor = doctors.find((item) => String(item.id) === doctorId);
  const selectedSlot = slots.find((slot) => String(slot.id) === slotId);
  const availableSlots = slots.filter((slot) => slot.status === "available");
  const bookedSlots = slots.filter((slot) => slot.status === "booked");
  const lockedSlots = slots.filter((slot) => slot.status === "locked");

  async function submitBooking(event) {
    event.preventDefault();
    if (!slotId) return;
    setBusy(true);
    setError("");
    try {
      const result = await bookAppointment({
        slot_id: Number(slotId),
        reason: reason.trim(),
        medical_notes: medicalNotes.trim() || null,
      });
      setConfirmAppointment(result);
      setShowConfirm(true);
      setSlotId("");
      setReason("");
      setMedicalNotes("");
      const updated = await listDoctorSlots(doctorId, day);
      setSlots(updated);
    } catch (requestError) {
      setError(requestError.message);
      const updated = await listDoctorSlots(doctorId, day).catch(() => slots);
      setSlots(updated);
    } finally {
      setBusy(false);
    }
  }

  const slotStatusChip = (status) => {
    switch (status) {
      case "available": return { label: "Available", color: "slot-chip-available" };
      case "locked": return { label: "Temporarily held", color: "slot-chip-locked" };
      default: return { label: "Booked", color: "slot-chip-booked" };
    }
  };

  const goToMyAppointments = () => {
    setShowConfirm(false);
    setConfirmAppointment(null);
    onNavigate?.("patient");
  };

  return (
    <>
      {showConfirm && confirmAppointment && (
        <section className="booking-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) goToMyAppointments(); }}>
          <section className="booking-confirm-dialog">
            <div className="booking-confirm-header">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <div>
                <p className="receipt-eyebrow">APPOINTMENT BOOKED</p>
                <h2>Slot reserved successfully</h2>
              </div>
            </div>
            <div className="booking-confirm-body">
              <h2>{confirmAppointment.doctor_name || doctor?.name}</h2>
              <p>Your appointment is booked with booking reference <strong>{confirmAppointment.booking_reference}</strong>. Please go to <strong>My Appointments</strong> to complete your token payment before the hold expires.</p>
            </div>
            <div className="booking-confirm-actions">
              <button className="button button-secondary" onClick={goToMyAppointments} type="button">Go to My Appointments</button>
            </div>
          </section>
        </section>
      )}

      <section className="page-wrap booking-page">
        <header className="booking-header">
          <div className="booking-header-content">
            <p className="eyebrow">PATIENT SERVICES</p>
            <h1>Book an appointment</h1>
            <p className="muted">Choose a doctor, then pick an available time slot.</p>
          </div>
          <div className="booking-progress" aria-label="Booking progress">
            <span className={`step ${slotId ? "active" : ""}`}><span className="step-number">1</span><span className="step-label">Doctor</span></span>
            <span className="step-connector" />
            <span className={`step ${slotId ? "active" : ""}`}><span className="step-number">2</span><span className="step-label">Time</span></span>
            <span className="step-connector" />
            <span className={`step ${slotId ? "active" : ""}`}><span className="step-number">3</span><span className="step-label">Review</span></span>
          </div>
        </header>

        {error && <p className="notice notice-error" role="alert">{error}</p>}

        <div className="booking-grid">
          <form className="panel booking-form" onSubmit={submitBooking}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">01 / VISIT DETAILS</p>
                <h2>Choose your doctor</h2>
              </div>
            </div>

            {loadingDoctors ? (
              <div className="empty-state"><div className="empty-icon">⏳</div><h3>Loading doctors…</h3><p>Please wait while we fetch available doctors.</p></div>
            ) : doctors.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🚫</div><h3>No doctors available</h3><p>There are no active doctors at this clinic right now.</p></div>
            ) : (
              <>
                <div className="doctor-select-section">
                  <div className="field-heading"><label>Choose your doctor</label><span className="helper-text">{doctors.length} doctor{doctors.length !== 1 ? "s" : ""} available at this clinic</span></div>
                  <div className="doctor-cards-grid">
                    {doctors.map((item) => {
                      const isSelected = String(item.id) === doctorId;
                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`doctor-card ${isSelected ? "doctor-card-selected" : ""}`}
                          key={item.id}
                          onClick={() => setDoctorId(String(item.id))}
                          type="button"
                        >
                          <div className="doctor-card-avatar-wrap">
                            <DoctorAvatar name={item.name} size="medium" />
                          </div>
                          <div className="doctor-card-body">
                            <div className="doctor-card-header-row">
                              <div className="doctor-card-name-box">
                                <div className="doctor-card-name">{item.name}</div>
                                <div className="doctor-card-specialty">{item.specialty}</div>
                              </div>
                              <span className="doctor-card-badge">{item.clinic_name}</span>
                            </div>
                            <div className="doctor-card-meta">
                              <span className="meta-chip">
                                <span className="material-symbols-outlined" aria-hidden="true">medical_services</span>
                                {item.qualification}
                              </span>
                              <span className="meta-chip">
                                <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                                {item.slot_duration_minutes} min slot
                              </span>
                            </div>
                            <div className="doctor-card-fee">
                              <span className="fee-amount">₹{item.consultation_fee}</span>
                              <span className="fee-label">consultation</span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="doctor-card-check">Selected</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="date-select-section">
                  <label className="field-label">
                    <span className="field-label-text">Appointment date</span>
                    <span className="field-label-hint">Select a date to view available slots</span>
                  </label>
                  <input className="date-input" min={localDateValue()} onChange={(event) => setDay(event.target.value)} required type="date" value={day} />
                </div>

                <div className="slots-section">
                  <div className="slots-header">
                    <div>
                      <div className="field-heading"><label>Available times</label><span className="helper-text">{availableSlots.length} open · {bookedSlots.length} booked · {lockedSlots.length} held</span></div>
                    </div>
                    <div className="slots-count-badge">
                      <span className="badge available">{availableSlots.length} open</span>
                    </div>
                  </div>

                  {loadingSlots ? (
                    <div className="empty-state"><div className="empty-icon">⏳</div><h3>Loading availability…</h3><p>Please wait while we fetch time slots.</p></div>
                  ) : slots.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">📭</div><h3>No slots for this date</h3><p>No upcoming time slots are available for {doctor?.name} on {formatDate(day)}. Please try another date.</p></div>
                  ) : (
                    <div className="slot-grid">
                      {slots.map((slot) => {
                        const isSelected = String(slot.id) === slotId;
                        const status = slotStatusChip(slot.status);
                        const isAvailable = slot.status === "available";
                        return (
                          <button
                            aria-pressed={isSelected}
                            className={`slot-card ${isSelected ? "slot-card-selected" : ""} ${!isAvailable ? "slot-card-unavailable" : ""}`}
                            disabled={!isAvailable}
                            key={slot.id}
                            onClick={() => setSlotId(String(slot.id))}
                            type="button"
                          >
                            <div className="slot-time">
                              <span className="slot-start">{formatTime(slot.start_at)}</span>
                              <span className="slot-separator">–</span>
                              <span className="slot-end">{formatTime(slot.end_at)}</span>
                            </div>
                            <span className={`slot-chip ${status.color}`}>{status.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="form-fields-section">
                  <label className="field-label">
                    <span className="field-label-text">Reason for visit</span>
                    <span className="field-label-required">Required</span>
                  </label>
                  <input className="text-input" maxLength={255} onChange={(event) => setReason(event.target.value)} required value={reason} placeholder="e.g. Follow-up consultation, skin rash, joint pain" />

                  <label className="field-label">
                    <span className="field-label-text">Notes for the doctor</span>
                    <span className="field-label-optional">Optional</span>
                  </label>
                  <textarea className="notes-input" maxLength={2000} onChange={(event) => setMedicalNotes(event.target.value)} rows={3} value={medicalNotes} placeholder="Anything the doctor should know before your visit…" />
                </div>

                <button className="button button-primary button-wide" disabled={busy || loadingSlots || !slotId || !reason.trim()} type="submit">
                  {busy ? "Booking your appointment…" : `Reserve this slot · ₹${doctor?.token_amount} advance`}
                </button>
                <p className="form-footnote">Booking temporarily holds the slot. Payment confirmation must be completed before the hold expires.</p>
              </>
            )}
          </form>

          <aside className="panel booking-summary">
            <div className="summary-heading">
              <p className="eyebrow">BOOKING SUMMARY</p>
              <h2>Your appointment</h2>
            </div>
            <div className="summary-doctor-card">
              <DoctorAvatar name={doctor?.name || "Doctor"} size="large" />
              <div className="summary-doctor-info">
                <div className="summary-doctor-name">{doctor?.name || "Choose a doctor"}</div>
                {doctor && <div className="summary-doctor-line">{doctor.specialty} · {doctor.clinic_name}</div>}
              </div>
            </div>
            <div className="summary-time-card">
              <span className="summary-icon material-symbols-outlined" aria-hidden="true">calendar_month</span>
              <div className="summary-time-info">
                <strong className="summary-date">
                  {selectedSlot ? new Date(selectedSlot.start_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </strong>
                <span className="summary-time">
                  {selectedSlot ? `${formatTime(selectedSlot.start_at)} – ${formatTime(selectedSlot.end_at)}` : "Select a time to continue"}
                </span>
              </div>
            </div>
            <div className="summary-pricing">
              <div className="price-row">
                <span>Consultation fee</span>
                <span>{doctor ? `₹${doctor.consultation_fee}` : "—"}</span>
              </div>
              <div className="price-row">
                <span>Advance token</span>
                <span>{doctor ? `₹${doctor.token_amount}` : "—"}</span>
              </div>
              <div className="price-row total">
                <span>Due at clinic</span>
                <span>{doctor ? `₹${doctor.consultation_fee - doctor.token_amount}` : "—"}</span>
              </div>
            </div>
            <p className="summary-footnote">Token payment is confirmed at checkout. Live online payment isn’t available yet.</p>
          </aside>
        </div>
      </section>
    </>
  );
}
