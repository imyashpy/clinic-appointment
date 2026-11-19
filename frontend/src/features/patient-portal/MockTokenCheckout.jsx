import React from "react";
import DoctorAvatar from "../../shared/DoctorAvatar.jsx";

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function MockTokenCheckout({ appointment, patientName, busy, feedback, onClose, onConfirm }) {
  const tokenDue = appointment.token_due || appointment.token_amount;

  return (
    <div className="checkout-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="checkout-title" aria-modal="true" className="checkout-dialog" role="dialog">
        <header className="checkout-heading"><div><p className="eyebrow">CuraPulse secure checkout</p><h2 id="checkout-title">Confirm token payment</h2></div><button aria-label="Close checkout" className="sidebar-signout material-symbols-outlined" onClick={onClose} type="button">close</button></header>
        <div className="checkout-progress"><span className="is-complete">Doctor</span><i /><span className="is-complete">Appointment</span><i /><span className="is-current">Token payment</span></div>
        <div className="checkout-grid">
          <div className="checkout-details">
            <section className="checkout-profile"><DoctorAvatar name={appointment.doctor_name} size="large" /><div><strong>{appointment.doctor_name}</strong><span>{appointment.specialty}</span><small>{appointment.booking_reference}</small></div></section>
            <section className="checkout-visit"><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><div><strong>{formatDate(appointment.start_at)}</strong><span>{formatTime(appointment.start_at)} – {formatTime(appointment.end_at)}</span></div></section>
            <section className="checkout-patient"><p className="eyebrow">PATIENT</p><strong>{patientName}</strong></section>
            <section className="checkout-ledger"><h3>Transparent token ledger</h3><div><span>Consultation fee</span><strong>₹{appointment.consultation_fee}</strong></div><div><span>Advance token</span><strong>₹{appointment.token_amount}</strong></div><div><span>Clinic balance</span><strong>₹{appointment.remaining_amount}</strong></div>{appointment.credit_applied > 0 && <div><span>Credit applied</span><strong>−₹{appointment.credit_applied}</strong></div>}</section>
          </div>
          <aside className="checkout-payment"><p className="eyebrow">DEVELOPMENT PAYMENT</p><h3>Mock token confirmation</h3><p>This test action records a token payment in the development backend. It does not charge a card, UPI account, or bank.</p><div className="checkout-amount"><span>Pay now</span><strong>₹{tokenDue}</strong></div>{appointment.pay_before && <p className="checkout-deadline">Booking hold expires {new Date(appointment.pay_before).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>}
            {feedback && <p className={`checkout-feedback ${feedback.isError ? "is-error" : "is-success"}`} role={feedback.isError ? "alert" : "status"}>{feedback.text}</p>}
            <button className="button button-primary button-wide" disabled={busy || (!feedback?.isError && feedback?.isSuccess)} onClick={onConfirm} type="button">{busy ? "Confirming..." : feedback?.isSuccess ? "Token confirmed" : `Confirm mock token · ₹${tokenDue}`}</button>
            <button className="checkout-back-button" onClick={onClose} type="button">Back to appointments</button>
            <p className="checkout-security"><span className="material-symbols-outlined" aria-hidden="true">info</span>Real payment processing is not configured in the backend.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}