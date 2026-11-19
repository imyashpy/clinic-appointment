import React from "react";
import ScheduleSettingsPanel from "./ScheduleSettingsPanel.jsx";

export default function AvailabilitySlotsPage() {
  return <section className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">CLINIC OPERATIONS</p><h1>Availability & slots</h1><p className="muted">Manage weekly hours, breaks, and bookable appointment slots.</p></div></div>
    <ScheduleSettingsPanel />
  </section>;
}