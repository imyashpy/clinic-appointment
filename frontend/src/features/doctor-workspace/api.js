import { api, queryString } from "../../api/client.js";

export const listDoctorAppointments = (day) => api.get(`/doctors/me/appointments${queryString({ day })}`);
export const getDoctorSchedule = () => api.get("/doctors/me/schedule");
export const saveDoctorSchedule = (days) => api.put("/doctors/me/schedule", { days });
export const generateDoctorSlots = (daysAhead = 14, startDate = null) => api.post(`/doctors/me/slots/generate${queryString({ days_ahead: daysAhead, start_date: startDate })}`);
export const toggleSlotBlock = (slotId) => api.patch(`/doctors/me/slots/${slotId}/block`);
export const getDoctorSettings = () => api.get("/doctors/me/settings");
export const updateDoctorSettings = (data) => api.patch("/doctors/me/settings", data);
export const startConsultation = (appointmentId) => api.post(`/appointments/${appointmentId}/start`);
export const completeConsultation = (appointmentId) => api.post(`/appointments/${appointmentId}/complete`);
export const markNoShow = (appointmentId) => api.post(`/appointments/${appointmentId}/no-show`);