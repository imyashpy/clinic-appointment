import { api, queryString } from "../../api/client.js";

export const getReceptionDashboard = (day) => api.get(`/reception/dashboard${queryString({ day })}`);
export const listReceptionAppointments = (day) => api.get(`/reception/appointments${queryString({ day })}`);
export const searchPatients = (query) => api.get(`/reception/patients${queryString({ q: query })}`);
export const listPatientCredits = (patientId) => api.get(`/reception/credits${queryString({ patient_id: patientId })}`);
export const checkInAppointment = (appointmentId) => api.post(`/appointments/${appointmentId}/check-in`);
export const markReceptionNoShow = (appointmentId) => api.post(`/appointments/${appointmentId}/no-show`);
export const collectAppointmentPayment = (appointmentId, method) => api.post(`/appointments/${appointmentId}/collect-payment`, { method });
export const refundPatientCredit = (creditId, method) => api.post(`/reception/credits/${creditId}/refund`, { method });

// Walk-in registration
export const listWalkInSlots = (doctorId) => api.get(`/reception/walk-in/slots${queryString({ doctor_id: doctorId })}`);
export const registerWalkIn = (details) => api.post("/reception/walk-in", details);
export const listWalkIns = (day) => api.get(`/reception/walk-ins${queryString({ day })}`);