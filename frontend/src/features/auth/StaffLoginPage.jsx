import React, { useState } from "react";
import { staffLogin } from "./api.js";

export default function StaffLoginPage({ onSignIn }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      onSignIn(await staffLogin(phone.trim(), password));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-bg" role="region" aria-label="Clinic staff sign-in">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <span className="material-symbols-outlined">medical_services</span>
          </div>
          <div>
            <h1>CuraPulse</h1>
            <p className="auth-subtitle">Clinic Workspace</p>
          </div>
        </div>

        <div className="auth-header">
          <h2>Staff sign-in</h2>
          <p className="auth-hint">Sign in with your clinic credentials to access the workspace.</p>
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

          <div className="field">
            <label className="field-label">Password</label>
            <div className="input-with-icon">
              <span className="material-symbols-outlined">lock</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          {error && <div className="notice notice-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span>{error}</div>}

          <button className="btn-primary btn-wide" disabled={busy} type="submit">
            {busy ? (
              <><span className="spinner"></span> Please wait...</>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="auth-footnote">Access is limited by your clinic account role.</p>
      </div>
    </div>
  );
}
