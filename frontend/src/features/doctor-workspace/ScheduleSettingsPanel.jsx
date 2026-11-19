import React, { useEffect, useState } from "react";
import { generateDoctorSlots, getDoctorSchedule, saveDoctorSchedule } from "./api.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDayDate(day_of_week) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDay = today.getDay(); // 0 = Sunday
  // Map: schema day_of_week 0=Monday..6=Sunday -> JS getDay 0=Sunday..6=Saturday
  const jsDay = day_of_week === 6 ? 0 : day_of_week + 1;
  let diff = jsDay - todayDay;
  if (diff <= 0) diff += 7;
  const date = new Date(today);
  date.setDate(date.getDate() + diff);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function emptyDay(day_of_week) {
  return { day_of_week, enabled: false, start_time: "09:00", end_time: "17:00", break_start: "", break_end: "" };
}

export default function ScheduleSettingsPanel() {
  const [days, setDays] = useState(WEEKDAYS.map((_, index) => emptyDay(index)));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [daysAhead, setDaysAhead] = useState(14);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    getDoctorSchedule()
      .then((schedule) => {
        const byDay = new Map(schedule.map((item) => [item.day_of_week, item]));
        setDays(WEEKDAYS.map((_, index) => {
          const item = byDay.get(index);
          return item ? {
            day_of_week: index,
            enabled: true,
            start_time: item.start_time.slice(0, 5),
            end_time: item.end_time.slice(0, 5),
            break_start: item.break_start?.slice(0, 5) || "",
            break_end: item.break_end?.slice(0, 5) || "",
          } : emptyDay(index);
        }));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function updateDay(index, patch) {
    setDays((current) => current.map((day) => day.day_of_week === index ? { ...day, ...patch } : day));
  }

  function copyToAll(day) {
    const enabledDays = days.filter(d => d.enabled);
    if (enabledDays.length === 0) return;
    
    const source = enabledDays[0];
    setDays(current => current.map(d => d.enabled ? {
      ...d,
      start_time: source.start_time,
      end_time: source.end_time,
      break_start: source.break_start,
      break_end: source.break_end,
    } : d));
  }

  async function saveSchedule(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const enabled = days.filter((day) => day.enabled);
    if (enabled.length === 0) {
      setError("Enable at least one working day.");
      return;
    }
    if (enabled.some((day) => Boolean(day.break_start) !== Boolean(day.break_end))) {
      setError("Enter both break times or leave both blank for each working day.");
      return;
    }
    setBusy(true);
    try {
      const payload = enabled.map(({ day_of_week, start_time, end_time, break_start, break_end }) => ({
        day_of_week,
        start_time,
        end_time,
        break_start: break_start || null,
        break_end: break_end || null,
      }));
      await saveDoctorSchedule(payload);
      setMessage(`Weekly schedule saved (${payload.length} working days).`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateSlots() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await generateDoctorSlots(Number(daysAhead), startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Number(daysAhead) - 1);
      setMessage(`Generated ${result.created} slots from ${new Date(startDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} to ${endDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} (${result.days_ahead} days).`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  function getDuration(start, end) {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const diff = endMin - startMin;
    if (diff <= 0) return "";
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  }

  function hasBreak(day) {
    return day.break_start && day.break_end;
  }

  return (
    <section className="panel schedule-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">DOCTOR SETTINGS</p>
          <h2>Weekly availability</h2>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}
      {loading ? (
        <p className="muted">Loading schedule...</p>
      ) : (
        <form onSubmit={saveSchedule}>
          <div className="schedule-days">
            {days.map((day) => (
              <article className={`schedule-day ${day.enabled ? "enabled" : "disabled"}`} key={day.day_of_week}>
                <div className="day-header">
                  <label className="day-toggle">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) => updateDay(day.day_of_week, { enabled: event.target.checked })}
                    />
                    <span className="day-name">
                      <strong>{WEEKDAYS[day.day_of_week]}</strong>
                      <span className="day-short">{WEEKDAYS_SHORT[day.day_of_week]} · {formatDayDate(day.day_of_week)}</span>
                    </span>
                  </label>
                  {day.enabled && (
                    <div className="day-summary">
                      <span className="time-range">
                        <span className="time-icon" aria-hidden="true">🕐</span>
                        {formatTime(day.start_time)} – {formatTime(day.end_time)}
                      </span>
                      <span className="duration">{getDuration(day.start_time, day.end_time)}</span>
                      {hasBreak(day) && (
                        <span className="break-badge">
                          <span className="break-icon" aria-hidden="true">☕</span>
                          {formatTime(day.break_start)} – {formatTime(day.break_end)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {day.enabled && (
                  <div className="time-fields">
                    <div className="field-group">
                      <label>
                        <span className="field-label">Shift starts</span>
                        <input
                          type="time"
                          value={day.start_time}
                          onChange={(event) => updateDay(day.day_of_week, { start_time: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                    <div className="field-group">
                      <label>
                        <span className="field-label">Shift ends</span>
                        <input
                          type="time"
                          value={day.end_time}
                          onChange={(event) => updateDay(day.day_of_week, { end_time: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                    <div className="field-group">
                      <label>
                        <span className="field-label">Break starts</span>
                        <input
                          type="time"
                          value={day.break_start}
                          onChange={(event) => updateDay(day.day_of_week, { break_start: event.target.value })}
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                    <div className="field-group">
                      <label>
                        <span className="field-label">Break ends</span>
                        <input
                          type="time"
                          value={day.break_end}
                          onChange={(event) => updateDay(day.day_of_week, { break_end: event.target.value })}
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="schedule-actions">
            <div className="action-group">
              <button className="button button-primary" disabled={busy} type="submit">
                {busy ? "Saving..." : "Save weekly schedule"}
              </button>
              <button className="button button-secondary" disabled={busy} onClick={copyToAll} type="button">
                Copy first to all
              </button>
            </div>
            <div className="action-group">
              <label className="compact-field">
                Generate through
                <input max="60" min="1" onChange={(event) => setDaysAhead(event.target.value)} type="number" value={daysAhead} />
                <span className="helper-text">days ahead</span>
              </label>
              <label className="compact-field">
                Start from
                <input max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
              </label>
              <button className="button button-secondary" disabled={busy} onClick={generateSlots} type="button">
                {busy ? "Generating..." : "Generate slots"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}