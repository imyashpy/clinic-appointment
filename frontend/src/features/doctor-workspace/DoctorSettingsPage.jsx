import React, { useEffect, useState } from "react";
import { getDoctorSettings, updateDoctorSettings } from "./api.js";

const SLOT_DURATIONS = [15, 20, 30, 45, 60];

export default function DoctorSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    qualification: "",
    consultation_fee: "",
    token_amount: "",
    slot_duration_minutes: 30,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getDoctorSettings();
      setSettings(data);
      setFormData({
        qualification: data.qualification || "",
        consultation_fee: data.consultation_fee,
        token_amount: data.token_amount,
        slot_duration_minutes: data.slot_duration_minutes,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload = {};
    if (formData.qualification !== (settings?.qualification || "")) {
      payload.qualification = formData.qualification.trim() || null;
    }
    if (Number(formData.consultation_fee) !== settings?.consultation_fee) {
      payload.consultation_fee = Number(formData.consultation_fee);
    }
    if (Number(formData.token_amount) !== settings?.token_amount) {
      payload.token_amount = Number(formData.token_amount);
    }
    if (formData.slot_duration_minutes !== settings?.slot_duration_minutes) {
      payload.slot_duration_minutes = formData.slot_duration_minutes;
    }

    if (Object.keys(payload).length === 0) {
      setMessage("No changes to save.");
      return;
    }

    if (payload.token_amount > payload.consultation_fee) {
      setError("Token amount cannot exceed consultation fee.");
      return;
    }

    setBusy(true);
    try {
      const result = await updateDoctorSettings(payload);
      setSettings(result.settings);
      setMessage(result.message || "Settings saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading settings...</p>;
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">DOCTOR SETTINGS</p>
          <h2>Profile & consultation</h2>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}
      <form onSubmit={saveSettings} className="form-stack">
        <div className="field-group">
          <label>
            <span className="field-label">Qualification</span>
            <input
              type="text"
              value={formData.qualification}
              onChange={(e) => handleChange("qualification", e.target.value)}
              placeholder="e.g., MBBS, MD (Dermatology)"
              maxLength={150}
            />
          </label>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label>
              <span className="field-label">Consultation fee (₹)</span>
              <input
                type="number"
                value={formData.consultation_fee}
                onChange={(e) => handleChange("consultation_fee", e.target.value)}
                min="1"
                max="100000"
                required
              />
            </label>
          </div>
          <div className="field-group">
            <label>
              <span className="field-label">Token amount (₹)</span>
              <input
                type="number"
                value={formData.token_amount}
                onChange={(e) => handleChange("token_amount", e.target.value)}
                min="1"
                max="100000"
                required
              />
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>
            <span className="field-label">Slot duration (minutes)</span>
            <select
              value={formData.slot_duration_minutes}
              onChange={(e) => handleChange("slot_duration_minutes", Number(e.target.value))}
            >
              {SLOT_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
            <p className="helper-text">
              Changing this will regenerate future available slots (booked appointments are unaffected).
            </p>
          </label>
        </div>
        <div className="settings-actions">
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Saving..." : "Save settings"}
          </button>
          <button className="button button-secondary" type="button" onClick={loadSettings} disabled={busy}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}