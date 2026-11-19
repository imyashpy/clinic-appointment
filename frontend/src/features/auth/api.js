import { api } from "../../api/client.js";

export const staffLogin = (phone, password) => api.post("/auth/login", { phone, password });
export const requestPatientOtp = (phone) => api.post("/auth/otp/request", { phone });
export const verifyPatientOtp = (details) => api.post("/auth/otp/verify", details);
export const getCurrentUser = () => api.get("/auth/me");