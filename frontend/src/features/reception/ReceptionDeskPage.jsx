import React, { useCallback, useEffect, useState } from "react";
import {
  checkInAppointment,
  collectAppointmentPayment,
  getReceptionDashboard,
  listPatientCredits,
  listReceptionAppointments,
  listWalkInSlots,
  listWalkIns,
  markReceptionNoShow,
  registerWalkIn,
  refundPatientCredit,
  searchPatients,
} from "./api.js";
import { listDoctors } from "../appointments/api.js";

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

const money = (amount = 0) => `₹${Number(amount).toLocaleString("en-IN")}`;

export default function ReceptionDeskPage({ view = "dashboard", onNavigate }) {
  const [day, setDay] = useState(localDateValue());
  const [dashboard, setDashboard] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState("cash");
  const [refundMethod, setRefundMethod] = useState("upi");
  const [query, setQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [credits, setCredits] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Walk-in state
  const [doctors, setDoctors] = useState([]);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInDoctorId, setWalkInDoctorId] = useState("");
  const [walkInSlots, setWalkInSlots] = useState([]);
  const [walkInSlotId, setWalkInSlotId] = useState("");
  const [walkInPatientType, setWalkInPatientType] = useState("existing");
  const [walkInPatientId, setWalkInPatientId] = useState("");
  const [walkInNewPatient, setWalkInNewPatient] = useState({ full_name: "", phone: "", date_of_birth: "", gender: "" });
  const [walkInReason, setWalkInReason] = useState("");
  const [walkInMedicalNotes, setWalkInMedicalNotes] = useState("");
  const [walkInCollect, setWalkInCollect] = useState("token");
  const [walkInMethod, setWalkInMethod] = useState("cash");
  const [walkInBusy, setWalkInBusy] = useState(false);
  const [walkInError, setWalkInError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, rows] = await Promise.all(view === "patients"
        ? [Promise.resolve(null), Promise.resolve([])]
        : [getReceptionDashboard(day), listReceptionAppointments(day)]);
      setDashboard(summary);
      setAppointments(rows);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [day, view]);

  useEffect(() => { refresh(); }, [refresh]);

  // Load doctors for walk-in
  useEffect(() => {
    listDoctors().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setCredits([]);
      return;
    }
    listPatientCredits(selectedPatient.id)
      .then(setCredits)
      .catch((requestError) => setError(requestError.message));
  }, [selectedPatient]);

  async function doAction(appointmentId, action) {
    setBusyId(appointmentId);
    setError("");
    setMessage("");
    try {
      const result = action === "check-in"
        ? await checkInAppointment(appointmentId)
        : action === "no-show"
          ? await markReceptionNoShow(appointmentId)
          : await collectAppointmentPayment(appointmentId, collectionMethod);
      setMessage(action === "collect" ? `${money(result.amount_collected)} collected via ${result.method}.` : `${result.booking_reference} is now ${result.status.replaceAll("_", " ")}.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitSearch(event) {
    event.preventDefault();
    setError("");
    setSelectedPatient(null);
    if (query.trim().length < 3) {
      setError("Enter at least 3 characters to search.");
      return;
    }
    setSearchSubmitted(true);
    try {
      setPatients(await searchPatients(query.trim()));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refund(credit) {
    setBusyId(`credit-${credit.id}`);
    setError("");
    setMessage("");
    try {
      const result = await refundPatientCredit(credit.id, refundMethod);
      setMessage(`${money(result.amount)} refunded via ${result.method}. Reference ${result.transaction_reference}.`);
      setCredits(await listPatientCredits(selectedPatient.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function loadWalkInSlots() {
    if (!walkInDoctorId) return;
    setWalkInError("");
    setWalkInSlots([]);
    setWalkInSlotId("");
    try {
      const slots = await listWalkInSlots(Number(walkInDoctorId));
      setWalkInSlots(slots);
    } catch (requestError) {
      setWalkInError(requestError.message);
    }
  }

  async function registerWalkInAppointment(event) {
    event.preventDefault();
    if (!walkInDoctorId || !walkInSlotId || !walkInReason.trim()) {
      setWalkInError("Select doctor, slot, and enter a reason.");
      return;
    }
    const payload = {
      doctor_id: Number(walkInDoctorId),
      slot_id: Number(walkInSlotId),
      reason: walkInReason.trim(),
      medical_notes: walkInMedicalNotes.trim() || null,
      collect: walkInCollect,
      method: walkInMethod,
    };
    if (walkInPatientType === "existing") {
      if (!walkInPatientId) { setWalkInError("Select an existing patient."); return; }
      payload.patient_id = Number(walkInPatientId);
    } else {
      payload.new_patient = walkInNewPatient;
    }
    setWalkInBusy(true);
    setWalkInError("");
    try {
      const result = await registerWalkIn(payload);
      setMessage(`Walk-in registered: ${result.booking_reference} · ₹${result.amount_collected} collected`);
      setShowWalkIn(false);
      setWalkInSlotId(""); setWalkInReason(""); setWalkInMedicalNotes("");
      setWalkInNewPatient({ full_name: "", phone: "", date_of_birth: "", gender: "" });
      setWalkInPatientId("");
      await refresh();
    } catch (requestError) {
      setWalkInError(requestError.message);
    } finally {
      setWalkInBusy(false);
    }
  }

  const isToday = day === localDateValue();
  const pageTitle = view === "patients" ? "Patients & credits" : view === "appointments" ? "Appointments" : "Reception dashboard";
  const patientLookupPanel = (
    <section className="panel patient-lookup-panel">
      <div className="panel-heading"><div><p className="eyebrow">PATIENT LOOKUP</p><h2>{view === "dashboard" ? "Express patient verification" : "Search records and token credit"}</h2></div></div>
      <form className="search-row" onSubmit={submitSearch}><input aria-label="Search patients" onChange={(event) => { setQuery(event.target.value); setSearchSubmitted(false); setPatients([]); setSelectedPatient(null); }} placeholder="Name or mobile number" value={query} /><button className="button button-primary" type="submit">Search patients</button></form>
      {patients.length > 0 && <div className="search-results">{patients.map((patient) => <button className="search-result" key={patient.id} onClick={() => { setSelectedPatient(patient); setPatients([]); }} type="button"><strong>{patient.full_name}</strong><span>{patient.phone} · {patient.age ?? "Age unavailable"} · {patient.has_account ? "Online account" : "Walk-in record"}</span></button>)}</div>}
      {searchSubmitted && patients.length === 0 && !selectedPatient && <p className="helper-text">No matching patient records.</p>}
      {selectedPatient && <div className="selected-patient"><div><strong>{selectedPatient.full_name}</strong><p>{selectedPatient.phone} · {selectedPatient.age ?? "Age unavailable"} · {selectedPatient.gender || "Gender unavailable"}</p></div><button className="button button-quiet" onClick={() => setSelectedPatient(null)} type="button">Clear</button></div>}
      {selectedPatient && <div className="credit-list"><h3>Active clinic credits</h3>{credits.length === 0 ? <p className="helper-text">No active credits found for this patient at your clinic.</p> : credits.map((credit) => <div className="credit-row" key={credit.id}><div><strong>{money(credit.amount)}</strong><span>From {credit.source_doctor_name} · expires {new Date(credit.expires_at).toLocaleDateString()}</span></div><button className="button button-secondary button-small" disabled={busyId === `credit-${credit.id}`} onClick={() => refund(credit)} type="button">Refund</button></div>)}{credits.length > 0 && <label className="compact-field">Refund via<select onChange={(event) => setRefundMethod(event.target.value)} value={refundMethod}><option value="upi">UPI</option><option value="cash">Cash</option></select></label>}</div>}
    </section>
  );

  const walkInPanel = (
    <section className="panel walk-in-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">WALK-IN REGISTRATION</p><h2>Register a patient without prior booking</h2></div>
        <button className="button button-secondary" onClick={() => { setShowWalkIn(!showWalkIn); if (showWalkIn) setWalkInError(""); }} type="button">
          {showWalkIn ? "Hide walk-in form" : "New walk-in"}
        </button>
      </div>
      {showWalkIn && (
        <form className="form-stack" onSubmit={registerWalkInAppointment}>
          {walkInError && <p className="notice notice-error" role="alert">{walkInError}</p>}
          <div className="field-heading"><label>Doctor</label></div>
          <select required value={walkInDoctorId} onChange={(e) => { setWalkInDoctorId(e.target.value); setWalkInSlotId(""); setWalkInSlots([]); }}>
            <option value="">Select a doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.specialty} (₹{d.consultation_fee}, token ₹{d.token_amount})</option>)}
          </select>
          {walkInDoctorId && (
            <>
              <button type="button" className="button button-secondary" onClick={loadWalkInSlots}>
                Load today's free slots
              </button>
              {walkInSlots.length > 0 && (
                <>
                  <div className="field-heading"><label>Available slot</label></div>
                  <select required value={walkInSlotId} onChange={(e) => setWalkInSlotId(e.target.value)}>
                    <option value="">Select a slot</option>
                    {walkInSlots.map((s) => <option key={s.id} value={s.id}>
                      {new Date(s.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –
                      {new Date(s.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </option>)}
                  </select>
                </>
              )}
            </>
          )}
          <div className="field-heading"><label>Patient</label></div>
          <div className="segmented-control" role="radiogroup">
            <button type="button" className={walkInPatientType === "existing" ? "is-active" : ""} onClick={() => setWalkInPatientType("existing")}>Existing patient</button>
            <button type="button" className={walkInPatientType === "new" ? "is-active" : ""} onClick={() => setWalkInPatientType("new")}>New patient</button>
          </div>
          {walkInPatientType === "existing" && (
            <select value={walkInPatientId} onChange={(e) => setWalkInPatientId(e.target.value)}>
              <option value="">Select from search results or search first</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.phone}</option>)}
            </select>
          )}
          {walkInPatientType === "new" && (
            <div className="form-stack">
              <label>Full name<input required value={walkInNewPatient.full_name} onChange={(e) => setWalkInNewPatient({ ...walkInNewPatient, full_name: e.target.value })} /></label>
              <label>Mobile<input required inputMode="numeric" maxLength={10} value={walkInNewPatient.phone} onChange={(e) => setWalkInNewPatient({ ...walkInNewPatient, phone: e.target.value })} /></label>
              <label>Date of birth<input type="date" value={walkInNewPatient.date_of_birth} onChange={(e) => setWalkInNewPatient({ ...walkInNewPatient, date_of_birth: e.target.value })} /></label>
              <label>Gender<select value={walkInNewPatient.gender} onChange={(e) => setWalkInNewPatient({ ...walkInNewPatient, gender: e.target.value })}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select></label>
            </div>
          )}
          <label>Reason for visit<textarea required value={walkInReason} onChange={(e) => setWalkInReason(e.target.value)} rows={2} /></label>
          <label>Clinical notes (optional)<textarea value={walkInMedicalNotes} onChange={(e) => setWalkInMedicalNotes(e.target.value)} rows={2} /></label>
          <div className="field-heading"><label>Collect</label></div>
          <select value={walkInCollect} onChange={(e) => setWalkInCollect(e.target.value)}>
            <option value="token">Token only</option>
            <option value="full">Full amount</option>
          </select>
          <div className="field-heading"><label>Payment method</label></div>
          <select value={walkInMethod} onChange={(e) => setWalkInMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
          <button className="button button-primary button-wide" disabled={walkInBusy} type="submit">
            {walkInBusy ? "Registering..." : "Register walk-in"}
          </button>
        </form>
      )}
      {!showWalkIn && <p className="helper-text">Walk-in creates an arrived appointment instantly with payment collected at the desk.</p>}
    </section>
  );

  const dashboardAppointmentsPanel = (
    <section className="panel dashboard-preview-panel"><div className="panel-heading"><div><p className="eyebrow">TODAY'S REGISTER</p><h2>Appointment queue</h2></div><button className="button button-secondary" onClick={() => onNavigate?.("reception-appointments")} type="button">View all</button></div>
      {loading ? <p className="muted">Loading clinic appointments...</p> : appointments.length === 0 ? <div className="empty-inline">No paid appointments for this date.</div> : <><div className="dashboard-preview-head"><span>Time</span><span>Patient</span><span>Doctor</span><span>Status</span></div><div className="dashboard-preview-list">{appointments.slice(0, 6).map((appointment) => <div className="dashboard-preview-row" key={appointment.id}><strong>{formatTime(appointment.start_at)}</strong><span>{appointment.patient_name}</span><span>{appointment.doctor_name}</span><span className={`status-pill status-${appointment.status}`}>{appointment.status.replaceAll("_", " ")}</span></div>)}</div></>}
    </section>
  );

  return (
    <section className="page-wrap">
      <div className="page-heading"><div><p className="eyebrow">RECEPTION WORKSPACE</p><h1>{pageTitle}</h1><p className="muted">{view === "patients" ? "Find patient records and manage available clinic credit." : view === "appointments" ? "Check in patients, record balance payments, and manage no-shows." : "Live clinic attendance, appointments, and payment collections."}</p></div>{view !== "patients" && <label className="compact-field">Clinic date<input onChange={(event) => setDay(event.target.value)} type="date" value={day} /></label>}</div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}
      {view === "dashboard" && <>
      <div className="metric-grid metric-grid-six reception-kpis">
        <article className="metric-card"><span>Today's appointments</span><strong>{dashboard?.total_appointments ?? "—"}</strong><small>Paid bookings on this date</small></article>
        <article className="metric-card"><span>Waiting</span><strong>{dashboard?.waiting ?? "—"}</strong><small>Checked in and awaiting care</small></article>
        <article className="metric-card metric-card-accent"><span>In consultation</span><strong>{dashboard?.in_consultation ?? "—"}</strong><small>Active doctor visits</small></article>
        <article className="metric-card"><span>Completed</span><strong>{dashboard?.completed ?? "—"}</strong><small>Consultations closed</small></article>
        <article className="metric-card"><span>Not arrived</span><strong>{dashboard?.not_arrived ?? "—"}</strong><small>Confirmed appointments</small></article>
        <article className="metric-card metric-card-accent"><span>Net collection</span><strong>{dashboard ? money(dashboard.total_received) : "—"}</strong><small>Verified payments</small></article>
      </div>
      <section className="panel reception-summary-panel">
        <div className="panel-heading"><div><p className="eyebrow">CLINIC OPERATIONS</p><h2>Attendance & collections</h2></div></div>
        <div className="reception-summary-grid">
          <article><span>Arrived / seen</span><strong>{dashboard?.arrived ?? "—"}</strong><small>Includes waiting, consulting, and completed</small></article>
          <article><span>Completed</span><strong>{dashboard?.completed ?? "—"}</strong><small>Consultations closed today</small></article>
          <article><span>No-show</span><strong>{dashboard?.no_show ?? "—"}</strong><small>Marked by clinic staff</small></article>
          <article><span>Cancelled</span><strong>{dashboard?.cancelled ?? "—"}</strong><small>Appointment status</small></article>
        </div>
        <div className="reception-finance-grid">
          <article><span>Token collected</span><strong>{dashboard ? money(dashboard.token_collected) : "—"}</strong></article>
          <article><span>Balance collected</span><strong>{dashboard ? money(dashboard.remaining_collected) : "—"}</strong></article>
          <article className="finance-total"><span>Total received</span><strong>{dashboard ? money(dashboard.total_received) : "—"}</strong></article>
          <article><span>Balance pending</span><strong>{dashboard ? money(dashboard.remaining_pending) : "—"}</strong></article>
        </div>
      </section>
      <div className="reception-dashboard-grid">{patientLookupPanel}{walkInPanel}{dashboardAppointmentsPanel}</div>
      </>}
      {view === "patients" && patientLookupPanel}
      {view === "appointments" && <>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">DAILY REGISTER</p><h2>Appointments · {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</h2></div><div className="panel-controls reception-register-controls"><label className="compact-field">Collect via<select onChange={(event) => setCollectionMethod(event.target.value)} value={collectionMethod}><option value="cash">Cash</option><option value="upi">UPI</option></select></label><button className="button button-secondary" onClick={refresh} type="button">Refresh</button></div></div>
        {loading ? <p className="muted">Loading clinic register...</p> : appointments.length === 0 ? <div className="empty-state"><h3>No appointments found</h3><p>Unpaid bookings are not included in the reception register.</p></div> : <div className="appointment-list">{appointments.map((appointment) => {
          const canCheckIn = isToday && appointment.status === "confirmed";
          const canNoShow = appointment.status === "confirmed" && new Date() >= new Date(appointment.start_at);
          const canCollect = ["arrived", "waiting", "in_consultation", "completed"].includes(appointment.status) && appointment.payment_status === "token_paid" && appointment.remaining_amount > 0;
          return <article className="appointment-row reception-appointment" key={appointment.id}>
            <div className="appointment-date"><strong>{formatTime(appointment.start_at)}</strong><span>{appointment.booking_reference}</span></div>
            <div className="appointment-main"><h3>{appointment.patient_name}<span className={`status-pill status-${appointment.status}`}>{appointment.status.replaceAll("_", " ")}</span></h3><p>{appointment.patient_phone} · {appointment.doctor_name} · {appointment.specialty}</p><p className="helper-text">{appointment.reason || "No visit reason provided"} · {appointment.payment_status.replaceAll("_", " ")}</p></div>
            <div className="appointment-amount"><strong>{money(appointment.remaining_amount)}</strong><small>remaining balance</small></div>
            <div className="row-actions">
              {canCheckIn && <button className="button button-primary button-small" disabled={busyId === appointment.id} onClick={() => doAction(appointment.id, "check-in")} type="button">Check in</button>}
              {canCollect && <button className="button button-secondary button-small" disabled={busyId === appointment.id} onClick={() => doAction(appointment.id, "collect")} type="button">Collect balance</button>}
              {canNoShow && <button className="button button-danger button-small" disabled={busyId === appointment.id} onClick={() => { if (window.confirm(`Mark ${appointment.patient_name} as no-show?`)) doAction(appointment.id, "no-show"); }} type="button">No-show</button>}
            </div>
          </article>;
        })}</div>}
        <p className="helper-text panel-footnote">Use the dashboard view for walk-in registration.</p>
      </section>
      </>}
    </section>
  );
}
