import React, { useCallback, useEffect, useState } from "react";
import { cancelAppointment, listMyAppointments, payAppointmentToken } from "../appointments/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import DoctorAvatar from "../../shared/DoctorAvatar.jsx";
import MockTokenCheckout from "./MockTokenCheckout.jsx";
import PdfReceipt from "./PdfReceipt.jsx";

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatFullDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatShort(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export default function PatientDashboardPage({ onNavigate }) {
  const { user } = useAuth();
  const [when, setWhen] = useState("upcoming");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [checkoutAppointment, setCheckoutAppointment] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptAppointment, setReceiptAppointment] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAppointments(await listMyAppointments(when));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [when]);

  useEffect(() => { refresh(); }, [refresh]);

  async function act(appointment, action) {
    setBusyId(appointment.id);
    setError("");
    setActionFeedback(null);
    try {
      const result = action === "cancel"
        ? await cancelAppointment(appointment.id)
        : await payAppointmentToken(appointment.id);
      const filter = action === "cancel" ? "all" : when;
      if (action === "cancel") setWhen("all");
      if (action === "pay") {
        setReceiptAppointment(appointment);
        setShowReceipt(true);
        setCheckoutAppointment(null);
      }
      setActionFeedback({
        appointmentId: appointment.id,
        text: action === "cancel" ? result.message : `Token payment confirmed for ${result.booking_reference}.`,
        isError: false,
        isSuccess: true,
      });
      try {
        setAppointments(await listMyAppointments(filter));
      } catch (refreshError) {
        setError(`Action completed, but the list could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setActionFeedback({ appointmentId: appointment.id, text: requestError.message, isError: true });
    } finally {
      setBusyId(null);
    }
  }

  const upcomingAppointments = appointments.filter((appointment) =>
    ["payment_pending", "confirmed", "arrived", "waiting", "in_consultation"].includes(appointment.status)
    && new Date(appointment.end_at) > new Date());
  const nextAppointment = upcomingAppointments[0];
  const completedCount = appointments.filter((appointment) => appointment.status === "completed").length;
  const creditsApplied = appointments.reduce((sum, appointment) => sum + appointment.credit_applied, 0);
  const pendingToken = appointments.reduce((sum, appointment) => sum + appointment.token_due, 0);

  return (
    <section className="page-wrap patient-dashboard">
      {/* Clinic header */}
      {user?.clinic_id && (
        <section className="clinic-header">
          <div className="clinic-header-body">
            <div className="clinic-badge">#{user.clinic_id}</div>
            <div className="clinic-header-copy">
              <p className="clinic-eyebrow">YOUR CLINIC</p>
              <h2 className="clinic-title">{user.clinic_name || `Clinic #${user.clinic_id}`}</h2>
              <p className="clinic-sub">All your doctors and appointments belong to this clinic.</p>
            </div>
          </div>
          <button className="clinic-book-btn" onClick={() => onNavigate?.("calendar")} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">add</span> Book appointment
          </button>
        </section>
      )}

      {/* Profile hero */}
      <section className="patient-hero">
        <div className="patient-avatar">{user?.name?.slice(0, 1)?.toUpperCase() || "P"}</div>
        <div className="patient-hero-copy">
          <p className="eyebrow">PATIENT PORTAL</p>
          <h1>Welcome back, {user?.name}</h1>
          <p>{user?.phone} · {user?.role}</p>
        </div>
      </section>

      {error && <div className="notice notice-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span>{error}</div>}

      {/* KPI cards */}
      <div className="patient-kpi-grid">
        <article className="patient-kpi-card kpi-blue">
          <div className="kpi-body">
            <span className="kpi-label">Upcoming visits</span>
            <strong className="kpi-value">{loading ? "—" : upcomingAppointments.length}</strong>
            <small className="kpi-caption">Active appointments</small>
          </div>
          <div className="kpi-icon">🏥</div>
        </article>
        <article className="patient-kpi-card kpi-green">
          <div className="kpi-body">
            <span className="kpi-label">Token due</span>
            <strong className="kpi-value">{loading ? "—" : `₹${pendingToken.toLocaleString("en-IN")}`}</strong>
            <small className="kpi-caption">Pending token payment</small>
          </div>
          <div className="kpi-icon">💳</div>
        </article>
        <article className="patient-kpi-card kpi-purple">
          <div className="kpi-body">
            <span className="kpi-label">Credits applied</span>
            <strong className="kpi-value">{loading ? "—" : `₹${creditsApplied.toLocaleString("en-IN")}`}</strong>
            <small className="kpi-caption">Across listed visits</small>
          </div>
          <div className="kpi-icon">🎁</div>
        </article>
        <article className="patient-kpi-card kpi-teal">
          <div className="kpi-body">
            <span className="kpi-label">Completed visits</span>
            <strong className="kpi-value">{loading ? "—" : completedCount}</strong>
            <small className="kpi-caption">In this view</small>
          </div>
          <div className="kpi-icon">✅</div>
        </article>
      </div>

      {/* Next appointment */}
      {nextAppointment && (
        <section className="panel next-visit-card">
          <div className="panel-heading">
            <div><p className="eyebrow">NEXT APPOINTMENT</p><h2>Upcoming visit</h2></div>
            <span className={`status-pill status-${nextAppointment.status}`}>{nextAppointment.status.replaceAll("_", " ")}</span>
          </div>
          <div className="next-visit-body">
            <div className="next-visit-time-block">
              <div className="time-label"><span className="material-symbols-outlined" aria-hidden="true">schedule</span>Appointment time</div>
              <div className="time-value">{formatTime(nextAppointment.start_at)} – {formatTime(nextAppointment.end_at)}</div>
              <div className="time-date">{formatFullDate(nextAppointment.start_at)}</div>
            </div>
            <DoctorAvatar name={nextAppointment.doctor_name} size="large" />
            <div className="next-visit-info">
              <h3>{nextAppointment.doctor_name}</h3>
              <p>{nextAppointment.specialty}</p>
              <p className="helper-text">Booking {nextAppointment.booking_reference}</p>
            </div>
            <div className="next-visit-fee">
              <strong>₹{nextAppointment.consultation_fee}</strong>
              <div className="fee-breakdown">₹{nextAppointment.token_amount} token · ₹{nextAppointment.remaining_amount} at clinic</div>
            </div>
          </div>
        </section>
      )}

      {/* Appointment history */}
      <section className="panel history-card">
        <div className="panel-heading">
          <div><p className="eyebrow">YOUR VISITS</p><h2>Appointment history</h2></div>
          <label className="compact-field">Show<select className="history-filter" onChange={(event) => setWhen(event.target.value)} value={when}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All</option></select></label>
        </div>
        {loading ? (
          <div className="patient-empty"><h3>Loading…</h3><p>Your appointments are being fetched.</p></div>
        ) : appointments.length === 0 ? (
          <div className="patient-empty"><h3>No appointments found</h3><p>Your {when} appointments will appear here.</p></div>
        ) : (
          <div className="appointment-list">
            {appointments.map((appointment) => (
              <article className="appointment-row" key={appointment.id}>
                <div className="appointment-date">
                  <strong>{new Date(appointment.start_at).getDate()}</strong>
                  <span>{new Date(appointment.start_at).toLocaleDateString(undefined, { month: "short" })}</span>
                </div>
                <div className="appointment-main">
                  <h3 className="appointment-doctor-heading"><DoctorAvatar name={appointment.doctor_name} size="small" />{appointment.doctor_name}</h3>
                  <p>{appointment.specialty} · {formatShort(appointment.start_at)}</p>
                  <p className="helper-text">Ref {appointment.booking_reference} · {appointment.status.replaceAll("_", " ")} · payment {appointment.payment_status.replaceAll("_", " ")}</p>
                </div>
                <div className="appointment-amount">
                  <strong>₹{appointment.consultation_fee}</strong>
                  <small>₹{appointment.token_amount} token · ₹{appointment.remaining_amount} at clinic</small>
                  {appointment.credit_applied > 0 && <small>₹{appointment.credit_applied} credit applied</small>}
                </div>
                <div className="row-actions patient-row-actions">
                  {appointment.status === "payment_pending" && <button className="button button-primary button-small" onClick={() => { setCheckoutAppointment(appointment); setActionFeedback(null); }} type="button">Pay token</button>}
                  {appointment.status === "confirmed" && appointment.payment_status === "token_paid" && <button className="button button-danger button-small" disabled={busyId === appointment.id} onClick={() => { if (window.confirm("Cancel this appointment? The verified token is returned as clinic credit.")) act(appointment, "cancel"); }} type="button">Cancel</button>}
                  {actionFeedback?.appointmentId === appointment.id && <span className={`action-feedback ${actionFeedback.isError ? "action-feedback-error" : "action-feedback-success"}`} role={actionFeedback.isError ? "alert" : "status"}>{actionFeedback.text}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="helper-text panel-footnote">Mock payment is available only when the backend is started with ENABLE_MOCK_PAYMENT=true. Cancellation is subject to the backend’s cutoff policy.</p>
      </section>

      {checkoutAppointment && <MockTokenCheckout appointment={checkoutAppointment} busy={busyId === checkoutAppointment.id} feedback={actionFeedback?.appointmentId === checkoutAppointment.id ? actionFeedback : null} onClose={() => setCheckoutAppointment(null)} onConfirm={() => act(checkoutAppointment, "pay")} patientName={user?.name || "Patient"} />}
      {showReceipt && receiptAppointment && <PdfReceipt appointment={receiptAppointment} patientName={user?.name || "Patient"} onClose={() => { setShowReceipt(false); setReceiptAppointment(null); }} />}
    </section>
  );
}
