import React, { useState } from "react";
import { requestPatientOtp, staffLogin, verifyPatientOtp } from "./api.js";

export default function LoginPage({ onSignIn }) {
  const [mode, setMode] = useState("patient");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
      if (mode === "staff") {
        onSignIn(await staffLogin(phone.trim(), password));
      } else if (!otpRequested) {
        const result = await requestPatientOtp(phone.trim());
        setOtpRequested(true);
        setMessage(`${result.message}. In development, check the backend terminal for the code.`);
      } else {
        onSignIn(await verifyPatientOtp({ phone: phone.trim(), code: code.trim() }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setOtpRequested(false);
    setCode("");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-lockup"><span className="brand-mark">C</span><span>CuraPulse<small>CLINIC OPERATIONS</small></span></div>
        <p className="eyebrow">SECURE WORKSPACE</p>
        <h1>Sign in to your clinic</h1>
        <p className="muted">Use your patient mobile number or staff credentials.</p>
        <div className="segmented-control" role="tablist" aria-label="Account type">
          <button type="button" aria-selected={mode === "patient"} onClick={() => changeMode("patient")}>Patient</button>
          <button type="button" aria-selected={mode === "staff"} onClick={() => changeMode("staff")}>Clinic staff</button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>Mobile number<input autoComplete="tel" inputMode="numeric" maxLength={10} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" required value={phone} /></label>
          {mode === "staff" ? (
            <label>Password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          ) : otpRequested ? (
            <>
              <label>6-digit code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value)} required value={code} /></label>
              <button className="link-button" onClick={() => { setOtpRequested(false); setCode(""); }} type="button">Change number</button>
            </>
          ) : null}
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          {message && <p className="notice notice-info" role="status">{message}</p>}
          <button className="button button-primary button-wide" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "staff" ? "Sign in" : otpRequested ? "Verify code" : "Send one-time code"}</button>
        </form>
        <p className="auth-footnote">Access is limited by your clinic account role.</p>
      </section>
    </main>
  );
}