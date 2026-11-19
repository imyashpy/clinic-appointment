import { api, queryString } from "../../api/client.js";

export const listDoctors = () => api.get("/doctors");
export const listDoctorSlots = (doctorId, day) => api.get(`/doctors/${doctorId}/slots${queryString({ day })}`);
export const bookAppointment = (details) => api.post("/appointments", details);
export const listMyAppointments = (when = "all") => api.get(`/appointments/my${queryString({ when })}`);
export const cancelAppointment = (appointmentId) => api.post(`/appointments/${appointmentId}/cancel`);
export const payAppointmentToken = (appointmentId) => api.post(`/appointments/${appointmentId}/pay-mock`);