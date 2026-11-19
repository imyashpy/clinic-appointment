import React, { useCallback, useEffect, useState } from "react";
import { completeConsultation, listDoctorAppointments, markNoShow, startConsultation } from "./api.js";

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function dateTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function DoctorAppointmentsPage({ view = "overview" }) {
  const [day, setDay] = useState(localDateValue());
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAppointments(await listDoctorAppointments(day));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => { refresh(); }, [refresh]);

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
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = appointments.reduce((result, appointment) => {
    result[appointment.status] = (result[appointment.status] || 0) + 1;
    return result;
  }, {});
  const activeConsultation = appointments.find((appointment) => appointment.status === "in_consultation");
  const nextPatient = appointments.find((appointment) => ["arrived", "waiting"].includes(appointment.status))
    ?? appointments.find((appointment) => appointment.status === "confirmed");
  const focusPatient = activeConsultation ?? nextPatient;
  const isQueue = view === "queue";
  const isSchedule = view === "schedule";
  const visibleAppointments = appointments.filter((appointment) => statusFilter === "all" || appointment.status === statusFilter);
  const scheduleFilters = [
    ["all", "All", appointments.length],
    ["in_consultation", "In consultation", counts.in_consultation || 0],
    ["waiting", "Waiting", counts.waiting || 0],
    ["confirmed", "Confirmed", counts.confirmed || 0],
    ["completed", "Completed", counts.completed || 0],
    ["no_show", "No-show", counts.no_show || 0],
    ["cancelled", "Cancelled", counts.cancelled || 0],
  ];
  const title = isQueue ? "Dynamic queue" : view === "schedule" ? "Today's schedule" : "Doctor overview";

  return (
    <section className="page-wrap">
      <div className="page-heading"><div><p className="eyebrow">DOCTOR WORKSPACE</p><h1>{title}</h1><p className="muted">{isSchedule ? "Chronological clinic visits and consultation status." : isQueue ? "Live queue based on backend appointment states." : "Live appointments and status actions from your clinic schedule."}</p></div><label className="compact-field">Clinic date<input onChange={(event) => setDay(event.target.value)} type="date" value={day} /></label></div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}
      <div className="metric-grid metric-grid-six doctor-kpis">
        <article className="metric-card"><span>Total visits</span><strong>{appointments.length}</strong><small>Verified appointments</small></article>
        <article className="metric-card"><span>In consultation</span><strong>{counts.in_consultation || 0}</strong><small>Active visits</small></article>
        <article className="metric-card"><span>Waiting</span><strong>{(counts.waiting || 0) + (counts.arrived || 0)}</strong><small>Arrived or awaiting care</small></article>
        <article className="metric-card"><span>Completed</span><strong>{counts.completed || 0}</strong><small>Closed visits</small></article>
        <article className="metric-card"><span>Confirmed</span><strong>{counts.confirmed || 0}</strong><small>Not yet checked in</small></article>
        <article className="metric-card"><span>No-show / cancelled</span><strong>{(counts.no_show || 0) + (counts.cancelled || 0)}</strong><small>{counts.no_show || 0} no-show · {counts.cancelled || 0} cancelled</small></article>
      </div>
      <div className={isSchedule ? "schedule-workspace-grid" : ""}>
      <section className={`panel ${isSchedule ? "schedule-timeline-panel" : ""}`}>
        <div className="panel-heading"><div><p className="eyebrow">APPOINTMENTS</p><h2>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</h2></div><button className="button button-secondary" onClick={refresh} type="button">Refresh</button></div>
        {isSchedule && <div className="timeline-filters" aria-label="Filter appointments">{scheduleFilters.map(([value, label, count]) => <button aria-pressed={statusFilter === value} className="timeline-filter" key={value} onClick={() => setStatusFilter(value)} type="button">{label}<span>{count}</span></button>)}</div>}
        {loading ? <p className="muted">Loading your appointments...</p> : appointments.length === 0 ? <div className="empty-state"><h3>No appointments on this date</h3><p>Appointments appear after token payment is verified.</p></div> : visibleAppointments.length === 0 ? <div className="empty-state"><h3>No {statusFilter.replaceAll("_", " ")} appointments</h3><p>Choose another status to see more of the day.</p></div> : <div className={`appointment-list ${isSchedule ? "schedule-timeline" : ""}`}>{visibleAppointments.map((appointment) => {
          const canStart = ["arrived", "waiting"].includes(appointment.status);
          const canComplete = appointment.status === "in_consultation";
          const canNoShow = appointment.status === "confirmed" && new Date() >= new Date(appointment.start_at);
          return <article className="appointment-row doctor-appointment" key={appointment.id}>
            <div className="appointment-date"><strong>{dateTime(appointment.start_at)}</strong><span>{dateTime(appointment.end_at)}</span></div>
            <div className="appointment-main"><h3>{appointment.patient_name} <span className={`status-pill status-${appointment.status}`}>{appointment.status.replaceAll("_", " ")}</span></h3><p>{appointment.patient_age ?? "Age unavailable"} · {appointment.patient_gender || "Gender unavailable"} · {appointment.patient_phone}</p><p className="helper-text">{appointment.booking_reference} · {appointment.reason || "No visit reason provided"}</p>{appointment.medical_notes && <p className="clinical-note">{appointment.medical_notes}</p>}</div>
            <div className="appointment-amount"><strong>{appointment.payment_status.replaceAll("_", " ")}</strong><small>₹{appointment.remaining_amount} remaining</small></div>
            <div className="row-actions">
              {canStart && <button className="button button-primary button-small" disabled={busyId === appointment.id} onClick={() => act(appointment.id, "start")} type="button">Start consult</button>}
              {canComplete && <button className="button button-primary button-small" disabled={busyId === appointment.id} onClick={() => act(appointment.id, "complete")} type="button">Complete</button>}
              {canNoShow && <button className="button button-danger button-small" disabled={busyId === appointment.id} onClick={() => { if (window.confirm(`Mark ${appointment.patient_name} as no-show?`)) act(appointment.id, "no-show"); }} type="button">No-show</button>}
            </div>
          </article>;
        })}</div>}
      </section>
      {isSchedule && <aside className="panel active-consult-panel schedule-consultation-panel">
        <div className="panel-heading"><div><p className="eyebrow">CONSULTATION DESK</p><h2>{activeConsultation ? "Current active consult" : focusPatient ? "Patient focus" : "No active consult"}</h2></div>{activeConsultation && <span className="live-indicator">In progress</span>}</div>
        {focusPatient ? <>
          <div className="consult-patient"><h3>{focusPatient.patient_name}</h3><p>{focusPatient.patient_age ?? "Age unavailable"} · {focusPatient.patient_gender || "Gender unavailable"} · {focusPatient.patient_phone}</p><p className="consult-time">{dateTime(focusPatient.start_at)}–{dateTime(focusPatient.end_at)} · {focusPatient.booking_reference}</p></div>
          <dl className="consult-details"><div><dt>Appointment status</dt><dd><span className={`status-pill status-${focusPatient.status}`}>{focusPatient.status.replaceAll("_", " ")}</span></dd></div><div><dt>Visit reason</dt><dd>{focusPatient.reason || "Not provided"}</dd></div><div><dt>Patient notes</dt><dd>{focusPatient.medical_notes || "No notes supplied at booking."}</dd></div><div><dt>Balance due at clinic</dt><dd>₹{focusPatient.remaining_amount}</dd></div></dl>
          {activeConsultation && <button className="button button-primary button-wide" disabled={busyId === activeConsultation.id} onClick={() => act(activeConsultation.id, "complete")} type="button">Complete consultation</button>}
          {!activeConsultation && ["arrived", "waiting"].includes(focusPatient.status) && <button className="button button-primary button-wide" disabled={busyId === focusPatient.id} onClick={() => act(focusPatient.id, "start")} type="button">Start consultation</button>}
        </> : <div className="empty-state"><p>{loading ? "Loading consultation status..." : "No patient is currently in consultation or waiting to be seen."}</p></div>}
        <p className="helper-text panel-footnote">Vitals and prescription editing aren’t exposed by the current backend.</p>
      </aside>}
      </div>
      {isQueue && <p className="helper-text queue-limitation">This queue reflects appointment status from the backend. Automatic early-slot dispatch and patient messaging are not implemented by the current API.</p>}
    </section>
  );
}