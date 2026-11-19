import AppointmentCalendarPage from "../features/appointments/AppointmentCalendarPage.jsx";
import AvailabilitySlotsPage from "../features/doctor-workspace/AvailabilitySlotsPage.jsx";
import DoctorOverviewPage from "../features/doctor-workspace/DoctorOverviewPage.jsx";
import DoctorSettingsPage from "../features/doctor-workspace/DoctorSettingsPage.jsx";
import DynamicQueuePage from "../features/doctor-workspace/DynamicQueuePage.jsx";
import TodaySchedulePage from "../features/doctor-workspace/TodaySchedulePage.jsx";
import PatientDashboardPage from "../features/patient-portal/PatientDashboardPage.jsx";
import ReceptionDeskPage from "../features/reception/ReceptionDeskPage.jsx";
import AdminDashboardPage from "../features/admin/AdminDashboardPage.jsx";

export const routes = [
  { id: "doctor", label: "Overview", section: "Workspace", icon: "dashboard", Component: DoctorOverviewPage, roles: ["doctor"] },
  { id: "schedule", label: "Today's Schedule", section: "Workspace", icon: "schedule", Component: TodaySchedulePage, roles: ["doctor"] },
  { id: "queue", label: "Dynamic Queue", section: "Clinical Operations", icon: "groups", Component: DynamicQueuePage, roles: ["doctor"] },
  { id: "availability", label: "Availability & Slots", section: "Clinical Operations", icon: "calendar_month", Component: AvailabilitySlotsPage, roles: ["doctor"] },
  { id: "settings", label: "Settings", section: "Clinical Operations", icon: "settings", Component: DoctorSettingsPage, roles: ["doctor"] },
  { id: "reception-dashboard", label: "Reception Desk", section: "Workspace", icon: "dashboard", Component: ReceptionDeskPage, view: "dashboard", roles: ["receptionist"] },
  { id: "reception-appointments", label: "Appointments", section: "Operations", icon: "event_available", Component: ReceptionDeskPage, view: "appointments", roles: ["receptionist"] },
  { id: "reception-patients", label: "Patients & Credits", section: "Operations", icon: "person_search", Component: ReceptionDeskPage, view: "patients", roles: ["receptionist"] },
  { id: "patient", label: "My Appointments", section: "My Care", icon: "event_note", Component: PatientDashboardPage, roles: ["patient"] },
  { id: "calendar", label: "Book Appointment", section: "My Care", icon: "add_circle", Component: AppointmentCalendarPage, roles: ["patient"] },
  // Super admin: only Dashboard + Clinics
  { id: "admin-dashboard", label: "Dashboard", section: "Platform", icon: "dashboard", Component: AdminDashboardPage, view: "dashboard", roles: ["super_admin", "clinic_admin"] },
  { id: "admin-clinics", label: "Clinics", section: "Platform", icon: "local_hospital", Component: AdminDashboardPage, view: "clinics", roles: ["super_admin", "clinic_admin"] },
  // Clinic admin only: full management
  { id: "admin-users", label: "Users", section: "Platform", icon: "manage_accounts", Component: AdminDashboardPage, view: "users", roles: ["clinic_admin"] },
  { id: "admin-staff", label: "Staff", section: "Platform", icon: "badge", Component: AdminDashboardPage, view: "staff", roles: ["clinic_admin"] },
  { id: "admin-stats", label: "Statistics", section: "Platform", icon: "analytics", Component: AdminDashboardPage, view: "stats", roles: ["clinic_admin"] },
  { id: "admin-appointments", label: "All Appointments", section: "Platform", icon: "event", Component: AdminDashboardPage, view: "appointments", roles: ["clinic_admin"] },
  { id: "admin-payments", label: "Payments", section: "Platform", icon: "payments", Component: AdminDashboardPage, view: "payments", roles: ["clinic_admin"] },
  { id: "admin-refunds", label: "Refunds", section: "Platform", icon: "money_off", Component: AdminDashboardPage, view: "refunds", roles: ["clinic_admin"] },
  { id: "admin-audit", label: "Audit Logs", section: "Platform", icon: "history", Component: AdminDashboardPage, view: "audit", roles: ["clinic_admin"] },
];