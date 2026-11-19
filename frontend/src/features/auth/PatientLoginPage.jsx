import React, { useState } from "react";
import { requestPatientOtp, verifyPatientOtp } from "./api.js";

export default function PatientLoginPage({ onSignIn, clinicId }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!otpRequested) {
        const result = await requestPatientOtp(phone.trim());
        setOtpRequested(true);
        setMessage(`${result.message}. In development, check the backend terminal for the code.`);
      } else {
        onSignIn(await verifyPatientOtp({ phone: phone.trim(), code: code.trim(), clinic_id: clinicId }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changePhone() {
    setOtpRequested(false);
    setCode("");
    setError("");
    setMessage("");
  }

  return (
    <div className="auth-bg" role="region" aria-label="Patient sign-in">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <span className="material-symbols-outlined">local_hospital</span>
          </div>
          <div>
            <h1>CuraPulse</h1>
            <p className="auth-subtitle">Patient Portal</p>
          </div>
        </div>

        <div className="auth-header">
          <h2>Sign in to your care</h2>
          <p className="auth-hint">Enter your mobile number to receive a one-time code.</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label">Mobile Number</label>
            <div className="input-with-icon">
              <span className="material-symbols-outlined">phone</span>
              <input
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit mobile number"
                required
                value={phone}
              />
            </div>
          </div>

          {otpRequested && (
            <div className="field">
              <label className="field-label">6-Digit Code</label>
              <div className="input-with-icon">
                <span className="material-symbols-outlined">lock</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  value={code}
                />
              </div>
              <button className="link-button" onClick={changePhone} type="button">
                Change number
              </button>
            </div>
          )}

          {error && <div className="notice notice-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span>{error}</div>}
          {message && <div className="notice notice-info" role="status"><span className="material-symbols-outlined" aria-hidden="true">info</span>{message}</div>}

          <button className="btn-primary btn-wide" disabled={busy} type="submit">
            {busy ? (
              <><span className="spinner"></span> Please wait...</>
            ) : otpRequested ? (
              "Verify code"
            ) : (
              "Send one-time code"
            )}
          </button>
        </form>

        <p className="auth-footnote">New patients are registered automatically on first sign-in.</p>
      </div>
    </div>
  );
}
