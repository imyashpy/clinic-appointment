import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import DoctorAvatar from "../../shared/DoctorAvatar.jsx";

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function PdfReceipt({ appointment, patientName, onClose }) {
  const [downloaded, setDownloaded] = useState(false);

  if (!appointment) return null;

  const docName = appointment.doctor_name || "Doctor";
  const docSpecialty = appointment.specialty || "N/A";
  const docClinic = appointment.clinic_name || "N/A";
  const docBookingRef = appointment.booking_reference || "N/A";
  const docStatus = appointment.status ? appointment.status.replaceAll("_", " ") : "N/A";
  const docPaymentStatus = appointment.payment_status ? appointment.payment_status.replaceAll("_", " ") : "N/A";
  const docConsultationFee = appointment.consultation_fee ?? 0;
  const docTokenAmount = appointment.token_amount ?? 0;
  const docRemainingAmount = appointment.remaining_amount ?? 0;
  const docStartAt = appointment.start_at ? new Date(appointment.start_at) : new Date();
  const docEndAt = appointment.end_at ? new Date(appointment.end_at) : new Date();

  useEffect(() => {
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 83, 219);
    doc.text("CuraPulse Clinic", 20, 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Appointment Receipt", 20, 42);
    doc.text(`Booking Reference: ${docBookingRef}`, 20, 52);

    doc.setDrawColor(0, 83, 219);
    doc.setLineWidth(0.5);
    doc.line(20, 58, 190, 58);

    doc.setFontSize(13);
    doc.setTextColor(19, 27, 46);
    doc.text("Appointment Details", 20, 72);

    const rows = [
      ["Doctor", docName],
      ["Specialty", docSpecialty],
      ["Clinic", docClinic],
      ["Date", formatDate(docStartAt)],
      ["Time", `${formatTime(docStartAt)} – ${formatTime(docEndAt)}`],
      ["Patient", patientName || "N/A"],
      ["Booking Reference", docBookingRef],
      ["Status", docStatus],
      ["Payment Status", docPaymentStatus],
    ];

    let y = 82;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(19, 27, 46);
      doc.text(value, 60, y);
      y += 10;
    });

    y += 6;
    doc.setDrawColor(0, 83, 219);
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 83, 219);
    doc.text("Fee Breakdown", 20, y);
    y += 8;

    const feeRows = [
      ["Consultation fee", `₹${docConsultationFee}`],
      ["Advance token", `₹${docTokenAmount}`],
      ["Balance at clinic", `₹${docRemainingAmount}`],
    ];
    feeRows.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, 20, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(19, 27, 46);
      doc.text(value, 140, y, { align: "right" });
      y += 8;
    });

    y += 10;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("This is a computer-generated receipt from CuraPulse Clinic.", 20, y);
    doc.text("Token payment confirmed. Present this receipt at the clinic.", 20, y + 6);

    const fileName = `receipt_${docBookingRef}.pdf`;
    doc.save(fileName);
    setDownloaded(true);
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [appointment, patientName, onClose, docName, docSpecialty, docClinic, docBookingRef, docStatus, docPaymentStatus, docConsultationFee, docTokenAmount, docRemainingAmount, docStartAt, docEndAt]);

  return (
    <div className="receipt-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="receipt-dialog">
        <header className="receipt-header">
          <span className="material-symbols-outlined" aria-hidden="true">receipt</span>
          <div>
            <p className="receipt-eyebrow">TOKEN PAYMENT CONFIRMED</p>
            <h2>Appointment Receipt</h2>
          </div>
          <button aria-label="Close receipt" className="receipt-close material-symbols-outlined" onClick={onClose} type="button">close</button>
        </header>
        <div className="receipt-body">
          <div className="receipt-summary">
            <DoctorAvatar name={docName} size="medium" />
            <div className="receipt-summary-info">
              <strong>{docName}</strong>
              <span>{docSpecialty}</span>
              <small>Ref {docBookingRef}</small>
            </div>
          </div>
          <div className="receipt-details">
            <div className="receipt-row">
              <span>Date</span>
              <strong>{formatDate(docStartAt)}</strong>
            </div>
            <div className="receipt-row">
              <span>Time</span>
              <strong>{formatTime(docStartAt)} – {formatTime(docEndAt)}</strong>
            </div>
            <div className="receipt-row">
              <span>Patient</span>
              <strong>{patientName || "N/A"}</strong>
            </div>
            <div className="receipt-row total">
              <span>Total paid</span>
              <strong>₹{docTokenAmount}</strong>
            </div>
          </div>
          {downloaded ? (
            <div className="receipt-downloaded">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <span>PDF receipt downloaded: <strong>receipt_{docBookingRef}.pdf</strong></span>
            </div>
          ) : (
            <div className="receipt-downloading">
              <span className="material-symbols-outlined" aria-hidden="true">file_download</span>
              <span>Generating PDF receipt…</span>
            </div>
          )}
        </div>
        <footer className="receipt-footer">
          <p className="receipt-footnote">This receipt will close automatically in 3 seconds.</p>
        </footer>
      </section>
    </div>
  );
}
