import React, { useCallback, useEffect, useState } from "react";
import { api, queryString } from "../../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  completeConsultation,
  generateDoctorSlots,
  getDoctorSettings,
  listDoctorAppointments,
  markNoShow,
  saveDoctorSchedule,
  startConsultation,
  toggleSlotBlock,
} from "./api.js";

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(value));
}

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const [day, setDay] = useState(localDateValue());
  const [appointments, setAppointments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsDay, setSlotsDay] = useState(localDateValue());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [slotBusyId, setSlotBusyId] = useState(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [daysAhead, setDaysAhead] = useState(14);

  const refreshAppointments = useCallback(async () => {
    setError("");
    try {
      setAppointments(await listDoctorAppointments(day));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [day]);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getDoctorSettings());
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    try {
      setSlots(await apiGetSlots(slotsDay));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [slotsDay]);

  async function apiGetSlots(dateValue) {
    const { doctor_id } = settings || {};
    if (!doctor_id) return [];
    return api.get(`/doctors/${doctor_id}/slots${queryString({ day: dateValue })}`);
  }

  useEffect(() => {
    loadSettings();
    refreshAppointments();
    loadSlots();
    setLoading(false);
  }, [refreshAppointments, loadSettings, loadSlots]);

  async function act(appointmentId, action) {
    setBusyId(appointmentId);
    setError("");
    setMessage("");
    try {
      const result = action === "start"
        ? await startConsultation(appointmentId)
        : action === "complete"
          ? await completeConsultation(appointmentId)
          : await markNoShow(appointmentId);
      setMessage(`${result.booking_reference} is now ${result.status.replaceAll("_", " ")}.`);
      await refreshAppointments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlock(slotId) {
    setSlotBusyId((prev) => (prev === slotId ? null : slotId));
    setError("");
    try {
      await toggleSlotBlock(slotId);
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSlotBusyId(null);
    }
  }

  async function generateSlots() {
    setGenerateBusy(true);
    setError("");
    try {
      const result = await generateDoctorSlots(daysAhead);
      setMessage(`Generated ${result.created} slots for the next ${result.days_ahead} days.`);
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGenerateBusy(false);
    }
  }

  const counts = appointments.reduce((result, appointment) => {
    result[appointment.status] = (result[appointment.status] || 0) + 1;
    return result;
  }, {});
  const activeConsultation = appointments.find((appointment) => appointment.status === "in_consultation");
  const waitingCount = (counts.waiting || 0) + (counts.arrived || 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const receptionistName = settings?.receptionist_name || "Not assigned";

  return (
    <section className="page-wrap doctor-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DOCTOR WORKSPACE</p>
          <h1>{greeting}, {user?.name}</h1>
          <p className="muted">{settings?.clinic_name} · {settings?.specialty}</p>
        </div>
        <div className="doctor-header-meta">
          <div className="meta-card">
            <span className="meta-label">Today</span>
            <strong className="meta-value">{formatDate(new Date())}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-label">Receptionist</span>
            <strong className="meta-value">{receptionistName}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-label">Slot duration</span>
            <strong className="meta-value">{settings?.slot_duration_minutes} min</strong>
          </div>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}

      <div className="metric-grid metric-grid-five doctor-kpis">
        <article className="metric-card">
          <span>Total patients</span>
          <strong>{appointments.length}</strong>
          <small>Verified appointments today</small>
        </article>
        <article className="metric-card">
          <span>Waiting</span>
          <strong>{waitingCount}</strong>
          <small>Arrived or awaiting care</small>
        </article>
        <article className="metric-card metric-card-accent">
          <span>In consultation</span>
          <strong>{counts.in_consultation || 0}</strong>
          <small>Active visits</small>
        </article>
        <article className="metric-card">
          <span>Completed</span>
          <strong>{counts.completed || 0}</strong>
          <small>Closed visits</small>
        </article>
        <article className="metric-card">
          <span>No-show / cancelled</span>
          <strong>{(counts.no_show || 0) + (counts.cancelled || 0)}</strong>
          <small>Closed without care</small>
        </article>
      </div>

      <div className="doctor-dashboard-grid">
        <section className="panel today-appointments-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TODAY'S APPOINTMENTS</p>
              <h2>{formatDate(new Date(day))}</h2>
            </div>
            <div className="panel-actions">
              <label className="compact-field">Date<input onChange={(event) => setDay(event.target.value)} type="date" value={day} /></label>
              <button className="button button-secondary" onClick={refreshAppointments} type="button">Refresh</button>
            </div>
          </div>
          {loading ? (
            <p className="muted">Loading today's visits...</p>
          ) : appointments.length === 0 ? (
            <div className="empty-state"><h3>No appointments today</h3><p>Appointments appear after token payment is verified.</p></div>
          ) : (
            <div className="appointment-list">
              {appointments.map((appointment) => {
                const canStart = ["arrived", "waiting"].includes(appointment.status);
                const canNoShow = appointment.status === "confirmed" && new Date() >= new Date(appointment.start_at);
                return (
                  <article className={`appointment-row ${appointment.id === activeConsultation?.id ? "is-active" : ""}`} key={appointment.id}>
                    <div className="appointment-time"><strong>{formatTime(appointment.start_at)}</strong><span>{formatTime(appointment.end_at)}</span></div>
                    <div className="appointment-main">
                      <h3>{appointment.patient_name} <span className={`status-pill status-${appointment.status}`}>{appointment.status.replaceAll("_", " ")}</span></h3>
                      <p>{appointment.patient_age ?? "Age unavailable"} · {appointment.patient_gender || "Gender unavailable"} · {appointment.patient_phone}</p>
                      <p className="helper-text">{appointment.booking_reference} · {appointment.reason || "No visit reason provided"} · {appointment.payment_status.replaceAll("_", " ")}</p>
                    </div>
                    <div className="appointment-amount"><strong>{appointment.payment_status.replaceAll("_", " ")}</strong><small>₹{appointment.remaining_amount} remaining</small></div>
                    <div className="row-actions">
                      {canStart && <button className="button button-primary button-small" disabled={busyId === appointment.id} onClick={() => act(appointment.id, "start")} type="button">Start consult</button>}
                      {appointment.status === "in_consultation" && <button className="button button-primary button-small" disabled={busyId === appointment.id} onClick={() => act(appointment.id, "complete")} type="button">Complete</button>}
                      {canNoShow && <button className="button button-danger button-small" disabled={busyId === appointment.id} onClick={() => { if (window.confirm(`Mark ${appointment.patient_name} as no-show?`)) act(appointment.id, "no-show"); }} type="button">No-show</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="panel quick-actions-panel">
          <div className="panel-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Manage slots</h2></div></div>
          <div className="quick-actions-grid">
            <article className="action-card">
              <span className="action-icon" aria-hidden="true">📅</span>
              <div>
                <h3>Generate slots</h3>
                <p>Create bookable slots ahead</p>
              </div>
              <div className="action-controls">
                <label className="compact-field">Days<input max="60" min="1" onChange={(event) => setDaysAhead(event.target.value)} type="number" value={daysAhead} /></label>
                <button className="button button-primary button-small" disabled={generateBusy} onClick={generateSlots} type="button">{generateBusy ? "Generating..." : "Generate"}</button>
              </div>
            </article>
            <article className="action-card">
              <span className="action-icon" aria-hidden="true">⏱️</span>
              <div>
                <h3>Weekly schedule</h3>
                <p>Set working days &amp; hours</p>
              </div>
              <div className="action-controls">
                <button className="button button-secondary button-small" onClick={() => window.location.href = "/doctor/availability"} type="button">Open settings</button>
              </div>
            </article>
            <article className="action-card">
              <span className="action-icon" aria-hidden="true">💰</span>
              <div>
                <h3>Consultation settings</h3>
                <p>Fee, token, slot duration</p>
              </div>
              <div className="action-controls">
                <button className="button button-secondary button-small" onClick={() => window.location.href = "/doctor/settings"} type="button">Open settings</button>
              </div>
            </article>
          </div>
          <div className="panel-footnote">
            <p className="helper-text">Slot blocking toggles individual time slots between available and blocked. Blocked slots cannot be booked by patients.</p>
          </div>
        </aside>

        <section className="panel today-slots-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TODAY'S SLOTS</p>
              <h2>{formatDate(new Date(slotsDay))}</h2>
            </div>
            <div className="panel-actions">
              <label className="compact-field">Date<input onChange={(event) => setSlotsDay(event.target.value)} type="date" value={slotsDay} /></label>
            </div>
          </div>
          {slots.length === 0 ? (
            <div className="empty-state"><h3>No slots for this date</h3><p>Generate slots first, then toggle availability here.</p></div>
          ) : (
            <div className="slots-grid">
              {slots.map((slot) => {
                const isBlocked = slot.status === "blocked";
                const isBooked = slot.status === "booked";
                return (
                  <article className={`slot-card ${isBlocked ? "slot-blocked" : ""} ${isBooked ? "slot-booked" : ""}`} key={slot.id}>
                    <div className="slot-time"><strong>{formatTime(slot.start_at)}</strong><span>{formatTime(slot.end_at)}</span></div>
                    <div className="slot-status">{isBlocked ? "Blocked" : isBooked ? "Booked" : "Available"}</div>
                    <button className={`slot-toggle ${isBlocked ? "slot-toggle-unblock" : "slot-toggle-block"}`} disabled={slotBusyId === slot.id || isBooked} onClick={() => isBooked ? undefined : toggleBlock(slot.id)} type="button" title={isBlocked ? "Unblock slot" : "Block slot"}>
                      {slotBusyId === slot.id ? "…" : isBlocked ? "Unblock" : "Block"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
