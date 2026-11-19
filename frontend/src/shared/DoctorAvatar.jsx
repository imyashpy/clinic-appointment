import React, { useState } from "react";

const doctorPortraits = {
  "dr. rajesh sharma": "https://lh3.googleusercontent.com/aida-public/AB6AXuD1zKdn45Kc-lfdKi9dSYCUhTDSVhjP-ZMn8mQdNCx4FLIy9TB4Q55jYc9mgMXGbqR0YP00_Heqz7EBFkoPUNJUUdH0Lqo2ycZEYeBD_fdOh60HRMOWIvjiIMpdL40p0euwPnBRNnOI_3Qzo-vFtpWQOzxILuye8clV4YTpWqUAGv2Xws4BOJqmzEPg1wCl1K9u2cQNMYH0vdMr6v8RuXwZzBqjj2-Mn6rUDTK5-cCE",
};

function getInitials(name) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase() || "DR";
}

export default function DoctorAvatar({ name = "Doctor", size = "medium" }) {
  const [failed, setFailed] = useState(false);
  const normalizedName = name.trim().toLowerCase().replace(/^doctor\s+/, "dr. ");
  const portrait = doctorPortraits[normalizedName];
  const className = `doctor-avatar doctor-avatar-${size}`;

  if (!portrait || failed) {
    return <span aria-label={`${name} profile`} className={`${className} doctor-avatar-fallback`} role="img">{getInitials(name)}</span>;
  }

  return <img alt={`${name} profile`} className={className} onError={() => setFailed(true)} src={portrait} />;
}