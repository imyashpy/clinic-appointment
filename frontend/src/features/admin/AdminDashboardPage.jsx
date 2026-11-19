import React, { useCallback, useEffect, useState } from "react";
import { api, queryString } from "../../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const money = (amount = 0) => `₹${Number(amount).toLocaleString("en-IN")}`;

export default function AdminDashboardPage({ view = "dashboard" }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isClinicAdmin = user?.role === "clinic_admin";
  const userClinicId = user?.clinic_id;

  const [tab, setTab] = useState((view || "dashboard").replace("admin-", ""));

  const [day, setDay] = useState(localDateValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [clinics, setClinics] = useState([]);
  const [users, setUsers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  // Create modals
  const [showCreateClinic, setShowCreateClinic] = useState(false);
  const [showCreateClinicAdmin, setShowCreateClinicAdmin] = useState(false);
  const [showCreateDoctor, setShowCreateDoctor] = useState(false);
  const [showCreateReceptionist, setShowCreateReceptionist] = useState(false);

  // Create clinic form
  const [newClinic, setNewClinic] = useState({ name: "", address: "", city: "", phone: "" });
  const [createClinicBusy, setCreateClinicBusy] = useState(false);

  // Create clinic admin form
  const [newClinicAdmin, setNewClinicAdmin] = useState({
    name: "", phone: "", email: "", password: "", clinic_id: ""
  });
  const [createClinicAdminBusy, setCreateClinicAdminBusy] = useState(false);

  // Create doctor form
  const [newDoctor, setNewDoctor] = useState({
    name: "", phone: "", email: "", password: "",
    clinic_id: "", specialty: "", qualification: "",
    consultation_fee: 500, token_amount: 100, slot_duration_minutes: 30
  });
  const [createDoctorBusy, setCreateDoctorBusy] = useState(false);

  // Create receptionist form
  const [newReceptionist, setNewReceptionist] = useState({
    name: "", phone: "", email: "", password: "",
    clinic_id: "", doctor_id: ""
  });
  const [createReceptionistBusy, setCreateReceptionistBusy] = useState(false);

  const [toggleClinicBusy, setToggleClinicBusy] = useState(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      switch (tab) {
        case "clinics": {
          const data = await api.get("/admin/clinics");
          setClinics(data);
          break;
        }
        case "users": {
          const data = await api.get("/admin/users");
          setUsers(data.items || []);
          break;
        }
        case "staff": {
          const data = await api.get("/admin/staff");
          setStaff(data);
          break;
        }
        case "stats": {
          const data = await api.get("/admin/stats");
          setStats(data);
          break;
        }
        case "appointments": {
          const data = await api.get(`/admin/appointments${queryString({ day })}`);
          setAppointments(data.items || []);
          break;
        }
        case "payments": {
          const data = await api.get(`/admin/payments${queryString({ day })}`);
          setPayments(data.items || []);
          break;
        }
        case "refunds": {
          const data = await api.get(`/admin/refunds${queryString({ day })}`);
          setRefunds(data.items || []);
          break;
        }
        case "audit": {
          const data = await api.get("/admin/audit-logs");
          setAuditLogs(data.items || []);
          break;
        }
        default: {
          const [clinicsData, statsData, appointmentsData] = await Promise.all([
            api.get("/admin/clinics"),
            api.get("/admin/stats"),
            api.get(`/admin/appointments${queryString({ day })}`),
          ]);
          setClinics(clinicsData);
          setStats(statsData);
          setAppointments(appointmentsData.items || []);
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [tab, day]);

  async function createClinic() {
    if (!newClinic.name || !newClinic.city) {
      setError("Name and city are required");
      return;
    }
    setCreateClinicBusy(true);
    setError("");
    try {
      await api.post("/admin/clinics", newClinic);
      setMessage("Clinic created");
      setShowCreateClinic(false);
      setNewClinic({ name: "", address: "", city: "", phone: "" });
      if (tab === "clinics") await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreateClinicBusy(false);
    }
  }

  async function createClinicAdmin() {
    if (!newClinicAdmin.name || !newClinicAdmin.phone || !newClinicAdmin.password || !newClinicAdmin.clinic_id) {
      setError("All required fields must be filled");
      return;
    }
    setCreateClinicAdminBusy(true);
    setError("");
    try {
      await api.post("/admin/clinic-admins", {
        name: newClinicAdmin.name,
        phone: newClinicAdmin.phone,
        email: newClinicAdmin.email || null,
        password: newClinicAdmin.password,
        clinic_id: Number(newClinicAdmin.clinic_id),
      });
      setMessage("Clinic admin created");
      setShowCreateClinicAdmin(false);
      setNewClinicAdmin({ name: "", phone: "", email: "", password: "", clinic_id: "" });
      if (tab === "staff" || tab === "clinics") await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreateClinicAdminBusy(false);
    }
  }

  async function createDoctor() {
    if (!newDoctor.name || !newDoctor.phone || !newDoctor.password || !newDoctor.clinic_id || !newDoctor.specialty) {
      setError("All required fields must be filled");
      return;
    }
    setCreateDoctorBusy(true);
    setError("");
    try {
      await api.post("/admin/doctors", {
        name: newDoctor.name,
        phone: newDoctor.phone,
        email: newDoctor.email || null,
        password: newDoctor.password,
        clinic_id: Number(newDoctor.clinic_id),
        specialty: newDoctor.specialty,
        qualification: newDoctor.qualification || null,
        consultation_fee: newDoctor.consultation_fee,
        token_amount: newDoctor.token_amount,
        slot_duration_minutes: newDoctor.slot_duration_minutes,
      });
      setMessage("Doctor created");
      setShowCreateDoctor(false);
      setNewDoctor({ name: "", phone: "", email: "", password: "", clinic_id: "", specialty: "", qualification: "", consultation_fee: 500, token_amount: 100, slot_duration_minutes: 30 });
      if (tab === "staff") await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreateDoctorBusy(false);
    }
  }

  async function createReceptionist() {
    if (!newReceptionist.name || !newReceptionist.phone || !newReceptionist.password || !newReceptionist.clinic_id) {
      setError("All required fields must be filled");
      return;
    }
    setCreateReceptionistBusy(true);
    setError("");
    try {
      await api.post("/admin/receptionists", {
        name: newReceptionist.name,
        phone: newReceptionist.phone,
        email: newReceptionist.email || null,
        password: newReceptionist.password,
        clinic_id: Number(newReceptionist.clinic_id),
        doctor_id: newReceptionist.doctor_id ? Number(newReceptionist.doctor_id) : null,
      });
      setMessage("Receptionist created");
      setShowCreateReceptionist(false);
      setNewReceptionist({ name: "", phone: "", email: "", password: "", clinic_id: "", doctor_id: "" });
      if (tab === "staff") await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreateReceptionistBusy(false);
    }
  }

  async function toggleClinic(clinicId, currentlyActive) {
    setToggleClinicBusy((prev) => new Set([...prev, clinicId]));
    setError("");
    try {
      await api.patch(`/admin/clinics/${clinicId}/toggle`, {});
      setMessage(currentlyActive ? "Clinic deactivated" : "Clinic activated");
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setToggleClinicBusy((prev) => {
        const next = new Set(prev);
        next.delete(clinicId);
        return next;
      });
    }
  }

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (isClinicAdmin && userClinicId) {
      setNewDoctor((prev) => ({ ...prev, clinic_id: String(userClinicId) }));
      setNewReceptionist((prev) => ({ ...prev, clinic_id: String(userClinicId) }));
    }
  }, [isClinicAdmin, userClinicId]);

  const allTabs = [
    ["dashboard", "Dashboard"],
    ["clinics", "Clinics"],
    ["users", "Users"],
    ["staff", "Staff"],
    ["stats", "Statistics"],
    ["appointments", "All Appointments"],
    ["payments", "Payments"],
    ["refunds", "Refunds"],
    ["audit", "Audit Logs"],
  ];

  const tabs = isClinicAdmin ? allTabs : allTabs.slice(0, 2);

  const activeClinics = clinics.filter((c) => c.is_active).length;
  const inactiveClinics = clinics.filter((c) => !c.is_active).length;

  const filteredClinics = clinics.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  });

  return (
    <section className="page-wrap admin-page">
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">PLATFORM ADMIN</p>
          <h1>Admin Dashboard</h1>
          <p className="muted">Manage your clinics and platform settings</p>
        </div>
        {!isClinicAdmin && (
          <label className="compact-field">Date<input onChange={(event) => setDay(event.target.value)} type="date" value={day} /></label>
        )}
      </div>
      {error && <div className="notice notice-error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span>{error}</div>}
      {message && <div className="notice notice-success" role="status"><span className="material-symbols-outlined" aria-hidden="true">check_circle</span>{message}</div>}

      <div className="admin-tabs" aria-label="Admin sections" style={{ marginBottom: "24px" }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={`admin-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-empty-state"><p className="muted">Loading...</p></div>
      ) : tab === "dashboard" && (
        <>
          <div className="admin-metric-grid">
            <article className="admin-metric-card admin-metric-primary">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Total Clinics</span>
                  <strong className="admin-metric-value">{clinics.length}</strong>
                </div>
                <div className="admin-metric-icon">🏥</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-success">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Active Clinics</span>
                  <strong className="admin-metric-value">{activeClinics}</strong>
                </div>
                <div className="admin-metric-icon">✅</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-warning">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Inactive Clinics</span>
                  <strong className="admin-metric-value">{inactiveClinics}</strong>
                </div>
                <div className="admin-metric-icon">⏸️</div>
              </div>
            </article>
          </div>
          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>All Clinics</h2>
            </div>
            {clinics.length === 0 ? (
              <div className="admin-empty-state"><h3>No clinics found</h3><p>Get started by adding your first clinic.</p></div>
            ) : (
              <div className="admin-clinic-list">
                {clinics.map((c) => (
                  <article className="admin-clinic-row" key={c.id}>
                    <div className="admin-clinic-badge">#{c.id}</div>
                    <div className="admin-clinic-main">
                      <h3>{c.name}</h3>
                      <p>{c.address || "No address"} · {c.city || ""}</p>
                    </div>
                    <div className="admin-clinic-status">
                      <span className={`admin-status-pill ${c.is_active ? "admin-status-active" : "admin-status-inactive"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                      {isSuperAdmin && (
                        <button
                          className={`admin-toggle-button ${c.is_active ? "admin-toggle-deactivate" : "admin-toggle-activate"}`}
                          disabled={toggleClinicBusy.has(c.id)}
                          onClick={() => toggleClinic(c.id, c.is_active)}
                          type="button"
                        >
                          {toggleClinicBusy.has(c.id) ? "…" : c.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "clinics" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Clinics ({filteredClinics.length})</h2>
            </div>
            <div className="admin-panel-actions">
              <label className="admin-search">
                <span className="material-symbols-outlined" aria-hidden="true">search</span>
                <input
                  className="admin-search-input"
                  placeholder="Search clinics by name, city, or address"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              {isSuperAdmin && (
                <>
                  <button className="button button-primary" onClick={() => setShowCreateClinic(true)} type="button"><span className="material-symbols-outlined" aria-hidden="true">add</span> Add Clinic</button>
                  <button className="button button-secondary" onClick={() => setShowCreateClinicAdmin(true)} type="button"><span className="material-symbols-outlined" aria-hidden="true">person_add</span> Add Clinic Admin</button>
                </>
              )}
            </div>
          </div>
          {filteredClinics.length === 0 ? (
            <div className="admin-empty-state"><h3>No clinics found</h3><p>Try a different search term or add your first clinic.</p></div>
          ) : (
            <div className="admin-clinic-list">
              {filteredClinics.map((c) => (
                <article className="admin-clinic-row" key={c.id}>
                  <div className="admin-clinic-badge">#{c.id}</div>
                  <div className="admin-clinic-main">
                    <h3>{c.name}</h3>
                    <p>{c.address || "No address"} · {c.city || ""}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className={`admin-status-pill ${c.is_active ? "admin-status-active" : "admin-status-inactive"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    {isSuperAdmin && (
                      <button
                        className={`admin-toggle-button ${c.is_active ? "admin-toggle-deactivate" : "admin-toggle-activate"}`}
                        disabled={toggleClinicBusy.has(c.id)}
                        onClick={() => toggleClinic(c.id, c.is_active)}
                        type="button"
                      >
                        {toggleClinicBusy.has(c.id) ? "…" : c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "users" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Users ({users.length})</h2></div>
          {users.length === 0 ? (
            <div className="admin-empty-state">No users found.</div>
          ) : (
            <div className="admin-clinic-list">
              {users.map((u) => (
                <article className="admin-clinic-row" key={u.id}>
                  <div className="admin-clinic-badge">#{u.id}</div>
                  <div className="admin-clinic-main">
                    <h3>{u.name}</h3>
                    <p>{u.phone} · {u.email || "No email"}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className={`admin-status-pill ${u.is_active ? "admin-status-active" : "admin-status-inactive"}`}>
                      {u.role} · {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "staff" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><h2>Staff ({staff.length})</h2></div>
            <div className="admin-panel-actions">
              <button className="button button-primary" onClick={() => setShowCreateDoctor(true)} type="button"><span className="material-symbols-outlined" aria-hidden="true">add</span> Add Doctor</button>
              <button className="button button-secondary" onClick={() => setShowCreateReceptionist(true)} type="button"><span className="material-symbols-outlined" aria-hidden="true">person_add</span> Add Receptionist</button>
            </div>
          </div>
          {staff.length === 0 ? (
            <div className="admin-empty-state">No staff found.</div>
          ) : (
            <div className="admin-clinic-list">
              {staff.map((s) => (
                <article className="admin-clinic-row" key={s.user_id}>
                  <div className="admin-clinic-badge">#{s.profile_id}</div>
                  <div className="admin-clinic-main">
                    <h3>{s.name}</h3>
                    <p>{s.role} · Clinic: {s.clinic_id}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className="admin-status-pill admin-status-active">{s.phone}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "stats" && !loading && stats && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Platform Statistics</h2></div>
          <div className="admin-metric-grid">
            <article className="admin-metric-card admin-metric-primary">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Total Clinics</span>
                  <strong className="admin-metric-value">{stats.clinic_wise?.length ?? "—"}</strong>
                </div>
                <div className="admin-metric-icon">🏥</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-success">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Active Doctors</span>
                  <strong className="admin-metric-value">{stats.doctors ?? "—"}</strong>
                </div>
                <div className="admin-metric-icon">👨‍⚕️</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-primary">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Total Patients</span>
                  <strong className="admin-metric-value">{stats.patients ?? "—"}</strong>
                </div>
                <div className="admin-metric-icon">👤</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-success">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Appointments Today</span>
                  <strong className="admin-metric-value">{stats.appointments_total ?? "—"}</strong>
                </div>
                <div className="admin-metric-icon">📅</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-warning">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Revenue Today</span>
                  <strong className="admin-metric-value">{money(stats.net_collected)}</strong>
                </div>
                <div className="admin-metric-icon">💰</div>
              </div>
            </article>
            <article className="admin-metric-card admin-metric-primary">
              <div className="admin-metric-inner">
                <div>
                  <span className="admin-metric-label">Pending Refunds</span>
                  <strong className="admin-metric-value">{stats.refunds ?? "—"}</strong>
                </div>
                <div className="admin-metric-icon">↩️</div>
              </div>
            </article>
          </div>
          {stats.clinic_wise && stats.clinic_wise.length > 0 && (
            <section className="admin-panel" style={{ marginTop: "20px" }}>
              <div className="admin-panel-head"><h2>Clinics ({stats.clinic_wise.length})</h2></div>
              <div className="admin-clinic-list">
                {stats.clinic_wise.map((c) => (
                  <article className="admin-clinic-row" key={c.clinic_id}>
                    <div className="admin-clinic-badge">#{c.clinic_id}</div>
                    <div className="admin-clinic-main">
                      <h3>{c.clinic_name}</h3>
                      <p>Appointments today: {c.appointments} · Completed: {c.completed}</p>
                    </div>
                    <div className="admin-clinic-status">
                      <span className="admin-status-pill admin-status-active">{money(c.collected)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {tab === "appointments" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>All Appointments · {formatDate(day)}</h2></div>
          {appointments.length === 0 ? (
            <div className="admin-empty-state">No appointments found.</div>
          ) : (
            <div className="admin-clinic-list">
              {appointments.map((a) => (
                <article className="admin-clinic-row" key={a.id}>
                  <div className="admin-clinic-badge">{a.booking_reference}</div>
                  <div className="admin-clinic-main">
                    <h3>{a.patient_name} · {a.patient_phone}</h3>
                    <p>{a.doctor_name} · {a.clinic_name} · {a.specialty}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className={`admin-status-pill ${a.payment_status === "token_paid" ? "admin-status-active" : "admin-status-inactive"}`}>
                      {a.status.replaceAll("_", " ")} · {a.payment_status.replaceAll("_", " ")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "payments" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Payments · {formatDate(day)}</h2></div>
          {payments.length === 0 ? (
            <div className="admin-empty-state">No payments found.</div>
          ) : (
            <div className="admin-clinic-list">
              {payments.map((p) => (
                <article className="admin-clinic-row" key={p.id}>
                  <div className="admin-clinic-badge">{p.transaction_reference}</div>
                  <div className="admin-clinic-main">
                    <h3>{p.booking_reference}</h3>
                    <p>{p.payment_type} · {p.method} · {p.status}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className="admin-status-pill admin-status-active">{money(p.amount)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "refunds" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Refunds · {formatDate(day)}</h2></div>
          {refunds.length === 0 ? (
            <div className="admin-empty-state">No refunds found.</div>
          ) : (
            <div className="admin-clinic-list">
              {refunds.map((r) => (
                <article className="admin-clinic-row" key={r.id}>
                  <div className="admin-clinic-badge">{r.transaction_reference}</div>
                  <div className="admin-clinic-main">
                    <h3>{r.booking_reference}</h3>
                    <p>{r.reason || "No reason"} · Status: {r.status}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className="admin-status-pill admin-status-active">{money(r.amount)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "audit" && !loading && (
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>Audit Logs</h2></div>
          {auditLogs.length === 0 ? (
            <div className="admin-empty-state">No audit logs found.</div>
          ) : (
            <div className="admin-clinic-list">
              {auditLogs.map((log) => (
                <article className="admin-clinic-row" key={log.id}>
                  <div className="admin-clinic-badge">{formatDateTime(log.created_at)}</div>
                  <div className="admin-clinic-main">
                    <h3>{log.action}</h3>
                    <p>{log.entity_type} #{log.entity_id}</p>
                  </div>
                  <div className="admin-clinic-status">
                    <span className="admin-status-pill admin-status-active">{log.user_name || "System"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create Clinic Modal (super_admin only) */}
      {isSuperAdmin && showCreateClinic && (
        <div className="modal-overlay" onClick={() => setShowCreateClinic(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Clinic</h3>
              <button className="modal-close" onClick={() => setShowCreateClinic(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createClinic(); }}>
                <p className="helper-text" style={{marginTop: "-8px"}}>Clinic will be created and can have doctors/receptionists assigned</p>
                <div className="modal-grid">
                  <label>Clinic Name <span className="required-badge">Required</span><input required value={newClinic.name} onChange={(e) => setNewClinic({ ...newClinic, name: e.target.value })} placeholder="e.g., Apollo Dermatology Center" /></label>
                  <label>City <span className="required-badge">Required</span><input required value={newClinic.city} onChange={(e) => setNewClinic({ ...newClinic, city: e.target.value })} placeholder="e.g., Mumbai" /></label>
                </div>
                <label>Full Address <span className="required-badge">Required</span><textarea required value={newClinic.address} onChange={(e) => setNewClinic({ ...newClinic, address: e.target.value })} placeholder="Complete address with landmarks" rows={2} /></label>
                <label>Phone Number <span className="required-badge">Required</span><input required value={newClinic.phone} onChange={(e) => setNewClinic({ ...newClinic, phone: e.target.value })} placeholder="e.g., 022-26789012 or 9876543210" /></label>
                <div className="modal-actions">
                  <button className="button button-secondary" onClick={() => setShowCreateClinic(false)} type="button">Cancel</button>
                  <button className="button button-primary" disabled={createClinicBusy} type="submit">{createClinicBusy ? "Creating Clinic..." : "Create Clinic"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin && showCreateClinicAdmin && (
        <div className="modal-overlay" onClick={() => setShowCreateClinicAdmin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Clinic Admin</h3>
              <button className="modal-close" onClick={() => setShowCreateClinicAdmin(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createClinicAdmin(); }}>
                <p className="helper-text" style={{marginTop: "-8px"}}>Clinic admin will have full management access to their assigned clinic only</p>
                <div className="modal-grid">
                  <label>Clinic <span className="required-badge">Required</span><select required value={newClinicAdmin.clinic_id} onChange={(e) => setNewClinicAdmin({ ...newClinicAdmin, clinic_id: e.target.value })}>
                    <option value="">— Select clinic —</option>
                    {clinics.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
                  </select></label>
                </div>
                <label>Full Name <span className="required-badge">Required</span><input required value={newClinicAdmin.name} onChange={(e) => setNewClinicAdmin({ ...newClinicAdmin, name: e.target.value })} placeholder="e.g., Rajesh Kumar" /></label>
                <div className="modal-grid">
                  <label>Mobile Number <span className="required-badge">Required</span><input required inputMode="numeric" maxLength={10} value={newClinicAdmin.phone} onChange={(e) => setNewClinicAdmin({ ...newClinicAdmin, phone: e.target.value })} placeholder="9876543210" /></label>
                  <label>Email (optional)<input type="email" value={newClinicAdmin.email} onChange={(e) => setNewClinicAdmin({ ...newClinicAdmin, email: e.target.value })} placeholder="rajesh@clinic.com" /></label>
                </div>
                <label>Login Password <span className="required-badge">Required</span><input required type="password" minLength={8} value={newClinicAdmin.password} onChange={(e) => setNewClinicAdmin({ ...newClinicAdmin, password: e.target.value })} placeholder="Min 8 characters" /></label>
                <div className="modal-actions">
                  <button className="button button-secondary" onClick={() => setShowCreateClinicAdmin(false)} type="button">Cancel</button>
                  <button className="button button-primary" disabled={createClinicAdminBusy} type="submit">{createClinicAdminBusy ? "Creating Clinic Admin..." : "Create Clinic Admin"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCreateDoctor && (
        <div className="modal-overlay" onClick={() => setShowCreateDoctor(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Doctor</h3>
              <button className="modal-close" onClick={() => setShowCreateDoctor(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createDoctor(); }}>
                <p className="helper-text" style={{marginTop: "-8px"}}>Doctor will be created as a staff user with login access</p>
                {!isClinicAdmin && (
                  <div className="modal-grid">
                    <label>Clinic <span className="required-badge">Required</span><select required value={newDoctor.clinic_id} onChange={(e) => setNewDoctor({ ...newDoctor, clinic_id: e.target.value })}>
                      <option value="">— Select clinic —</option>
                      {clinics.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
                    </select></label>
                    <label>Slot Duration <span className="required-badge">Required</span><select required value={newDoctor.slot_duration_minutes} onChange={(e) => setNewDoctor({ ...newDoctor, slot_duration_minutes: Number(e.target.value) })}>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min (default)</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select></label>
                  </div>
                )}
                {isClinicAdmin && (
                  <>
                    <input type="hidden" value={userClinicId} onChange={(e) => setNewDoctor({ ...newDoctor, clinic_id: e.target.value })} />
                    <label>Slot Duration <span className="required-badge">Required</span><select required value={newDoctor.slot_duration_minutes} onChange={(e) => setNewDoctor({ ...newDoctor, slot_duration_minutes: Number(e.target.value) })}>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min (default)</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select></label>
                  </>
                )}
                <label>Full Name <span className="required-badge">Required</span><input required value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} placeholder="e.g., Dr. Priya Sharma" /></label>
                <div className="modal-grid">
                  <label>Mobile Number <span className="required-badge">Required</span><input required inputMode="numeric" maxLength={10} value={newDoctor.phone} onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })} placeholder="9876543210" /></label>
                  <label>Email (optional)<input type="email" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} placeholder="priya.sharma@clinic.com" /></label>
                </div>
                <label>Login Password <span className="required-badge">Required</span><input required type="password" minLength={8} value={newDoctor.password} onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })} placeholder="Min 8 characters" /></label>
                <div className="modal-grid">
                  <label>Specialty <span className="required-badge">Required</span><input required value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })} placeholder="e.g., Dermatology, Cardiology" /></label>
                  <label>Qualification (optional)<input value={newDoctor.qualification} onChange={(e) => setNewDoctor({ ...newDoctor, qualification: e.target.value })} placeholder="MBBS, MD (Dermatology)" /></label>
                </div>
                <div className="modal-grid">
                  <label>Consultation Fee (₹) <span className="required-badge">Required</span><input type="number" min="1" required value={newDoctor.consultation_fee} onChange={(e) => setNewDoctor({ ...newDoctor, consultation_fee: Number(e.target.value) })} placeholder="500" /></label>
                  <label>Token Amount (₹) <span className="required-badge">Required</span><input type="number" min="1" required value={newDoctor.token_amount} onChange={(e) => setNewDoctor({ ...newDoctor, token_amount: Number(e.target.value) })} placeholder="100" /></label>
                </div>
                <div className="modal-actions">
                  <button className="button button-secondary" onClick={() => setShowCreateDoctor(false)} type="button">Cancel</button>
                  <button className="button button-primary" disabled={createDoctorBusy} type="submit">{createDoctorBusy ? "Creating Doctor..." : "Create Doctor"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCreateReceptionist && (
        <div className="modal-overlay" onClick={() => setShowCreateReceptionist(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Receptionist</h3>
              <button className="modal-close" onClick={() => setShowCreateReceptionist(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createReceptionist(); }}>
                <p className="helper-text" style={{marginTop: "-8px"}}>Receptionist will be created as a staff user with login access</p>
                {!isClinicAdmin && (
                  <label>Clinic <span className="required-badge">Required</span><select required value={newReceptionist.clinic_id} onChange={(e) => setNewReceptionist({ ...newReceptionist, clinic_id: e.target.value })}>
                    <option value="">— Select clinic —</option>
                    {clinics.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
                  </select></label>
                )}
                {isClinicAdmin && (
                  <input type="hidden" value={userClinicId} onChange={(e) => setNewReceptionist({ ...newReceptionist, clinic_id: e.target.value })} />
                )}
                <label>Assigned Doctor (optional)<select value={newReceptionist.doctor_id} onChange={(e) => setNewReceptionist({ ...newReceptionist, doctor_id: e.target.value })}>
                  <option value="">— None (clinic-wide access) —</option>
                  {staff.filter(s => s.role === "doctor").map((d) => <option key={d.profile_id} value={d.profile_id}>{d.name} (Dr.)</option>)}
                </select></label>
                <label>Full Name <span className="required-badge">Required</span><input required value={newReceptionist.name} onChange={(e) => setNewReceptionist({ ...newReceptionist, name: e.target.value })} placeholder="e.g., Sunita Verma" /></label>
                <div className="modal-grid">
                  <label>Mobile Number <span className="required-badge">Required</span><input required inputMode="numeric" maxLength={10} value={newReceptionist.phone} onChange={(e) => setNewReceptionist({ ...newReceptionist, phone: e.target.value })} placeholder="9876543210" /></label>
                  <label>Email (optional)<input type="email" value={newReceptionist.email} onChange={(e) => setNewReceptionist({ ...newReceptionist, email: e.target.value })} placeholder="sunita.verma@clinic.com" /></label>
                </div>
                <label>Login Password <span className="required-badge">Required</span><input required type="password" minLength={8} value={newReceptionist.password} onChange={(e) => setNewReceptionist({ ...newReceptionist, password: e.target.value })} placeholder="Min 8 characters" /></label>
                <div className="modal-actions">
                  <button className="button button-secondary" onClick={() => setShowCreateReceptionist(false)} type="button">Cancel</button>
                  <button className="button button-primary" disabled={createReceptionistBusy} type="submit">{createReceptionistBusy ? "Creating Receptionist..." : "Create Receptionist"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
