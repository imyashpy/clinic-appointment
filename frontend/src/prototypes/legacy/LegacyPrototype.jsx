import React, { useCallback, useEffect, useMemo, useState } from "react";
import parse, { attributesToProps, domToReact } from "html-react-parser";

const consolePatients = {
  "Arjun Singhania": {
    sub: "62/M",
    token: "Token #08",
    status: "In Consultation",
    bp: "138/88",
    pulse: "74 bpm",
    spo2: "98%",
    paid: "₹200",
    due: "₹500",
  },
  "Priya Nair": {
    sub: "34/F",
    token: "Token #09",
    status: "Ready in Vitals",
    bp: "128/82",
    pulse: "72 bpm",
    spo2: "99%",
    paid: "₹200",
    due: "₹500",
  },
  "Amit Saxena": {
    sub: "52/M",
    token: "Token #10",
    status: "Waiting in Lounge",
    bp: "144/92",
    pulse: "88 bpm",
    spo2: "97%",
    paid: "₹300",
    due: "₹900",
  },
  "Sunita Kulkarni": {
    sub: "48/F",
    token: "Token #11",
    status: "Confirmed (En Route)",
    bp: "124/80",
    pulse: "68 bpm",
    spo2: "99%",
    paid: "₹200",
    due: "₹700",
  },
};

function getBody(source) {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  return (body ?? source).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function getNodeText(nodes = []) {
  return nodes.map((node) => node.data ?? getNodeText(node.children)).join(" ").replace(/\s+/g, " ").trim();
}

function decodeText(value) {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

export default function LegacyPrototype({ page, source }) {
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState("");
  const [hiddenSections, setHiddenSections] = useState(new Set());
  const [selectedPatient, setSelectedPatient] = useState("Arjun Singhania");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [activeSession, setActiveSession] = useState("Morning");
  const [enginePaused, setEnginePaused] = useState(false);
  const [patientResponse, setPatientResponse] = useState("");
  const [earlyCount, setEarlyCount] = useState(4);
  const [countdown, setCountdown] = useState(78);
  const [consultDuration, setConsultDuration] = useState(8 * 60 + 24);
  const [notificationSent, setNotificationSent] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const patient = consolePatients[selectedPatient];

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 3000);
  }, []);

  const hideSection = useCallback((id) => {
    setHiddenSections((current) => new Set(current).add(id));
  }, []);

  const handleClick = useCallback(
    (expression, node, event) => {
      if (expression.includes("event.stopPropagation()")) event.stopPropagation();

      const patientMatch = expression.match(/switchPatient\('([^']+)'/);
      if (patientMatch) {
        setSelectedPatient(patientMatch[1]);
        showToast(`Loaded ${patientMatch[1]} into console`);
        return;
      }

      if (expression.includes("toggleEngineState")) {
        setEnginePaused((paused) => !paused);
        return;
      }
      if (expression.includes("patientAccepts")) {
        setPatientResponse("accepted");
        setEarlyCount((count) => count + 1);
        return;
      }
      if (expression.includes("patientDeclines")) {
        setPatientResponse("declined");
        return;
      }
      if (expression.includes("triggerNotifyPatient")) {
        setNotificationSent(true);
        showToast("WhatsApp notification sent to Priya Nair");
        return;
      }
      if (expression.includes("copyRebook")) {
        showToast("Rebooking link copied");
        return;
      }
      if (expression.includes("dismissAlert")) {
        hideSection("earlyAlertRibbon");
        showToast("Slot shifted: Priya Nair notified.");
        return;
      }

      const removeMatch = expression.match(/getElementById\('([^']+)'\)\.remove\(\)/);
      if (removeMatch) {
        hideSection(removeMatch[1]);
        if (removeMatch[1] === "fastTrackBanner") showToast("Earlier slot dismissed");
        return;
      }

      if (node.name === "form") {
        event.preventDefault();
        if (page === "reception") {
          setModal("");
          showToast("Walk-in patient registered. Token #15 generated.");
        } else {
          setModal("");
          showToast("Appointment booking saved.");
        }
        return;
      }

      if (page === "calendar" && node.attribs.class?.includes("date-chip")) {
        setSelectedDate(getNodeText(node.children));
      }
      if (page === "calendar" && node.attribs.class?.includes("slot-btn")) {
        setSelectedSlot(getNodeText(node.children));
        showToast("Appointment time selected");
      }
      if (page === "calendar" && node.attribs.id === "tabMorning") setActiveSession("Morning");
      if (page === "calendar" && node.attribs.id === "tabEvening") setActiveSession("Evening");

      if (page === "patient" && node.attribs.id === "bookModalBtn") {
        setModal("newBookingModal");
        return;
      }
      if (
        page === "patient" &&
        ["viewTokenSlipBtn", "opdScanBtn"].includes(node.attribs.id)
      ) {
        setModal("tokenSlipModal");
        return;
      }

      const modalId = expression.match(/getElementById\('([^']+)'\)\.classList\.add\('hidden'\)/)?.[1];
      if (modalId) {
        setModal("");
        return;
      }
      if (expression.includes("toggleWalkInModal(true)")) {
        setModal(page === "schedule" ? "walkInModal" : "walkin-modal");
        return;
      }
      if (expression.includes("toggleWalkInModal(false)") || expression.includes("toggleWalkInModal()")) {
        setModal("");
        return;
      }
      if (expression.includes("focusQuickSearch")) {
        document.getElementById("quick-search-input")?.focus();
        return;
      }
      if (expression.includes("focusDeskNotepad")) {
        const note = document.getElementById("clinicalNotes");
        note?.focus();
        note?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (expression.includes("window.print")) {
        window.print();
        return;
      }
      if (expression.includes("confirm(")) {
        showToast("Appointment cancellation requested");
        return;
      }
      if (expression.includes("alert(")) {
        const message = expression.match(/alert\('([^']*)'\)/)?.[1];
        showToast(message ? decodeText(message) : "Action recorded");
        return;
      }

      const message = expression.match(/(?:showQuickToast|triggerToast|handleCheckInSuccess)\('([^']*)'/)?.[1];
      if (message) {
        showToast(decodeText(message));
      } else if (node.attribs.id === "closeBookingModal" || node.attribs.id === "closeTokenSlipModal") {
        setModal("");
      } else if (expression.includes("document.getElementById('fastTrackBanner').remove()")) {
        hideSection("fastTrackBanner");
      } else if (expression.includes("innerText='Accepted!'")) {
        showToast("Earlier slot accepted");
        hideSection("fastTrackBanner");
      }
    },
    [hideSection, page, showToast],
  );

  const parserOptions = useMemo(
    () => ({
      replace(node) {
        if (node.type !== "tag") return;
        const originalClick = node.attribs.onclick;
        const originalSubmit = node.attribs.onsubmit;
        const attrs = { ...node.attribs };
        delete attrs.onclick;
        delete attrs.onsubmit;
        delete attrs.onkeydown;
        const props = attributesToProps(attrs);
        const children = domToReact(node.children ?? [], parserOptions);

        if (node.name === "input" && props.value !== undefined) {
          props.defaultValue = props.value;
          delete props.value;
        }
        if (node.name === "textarea") {
          props.defaultValue = getNodeText(node.children);
        }

        if (node.attribs.id && hiddenSections.has(node.attribs.id)) {
          props.className = `${props.className ?? ""} hidden`.trim();
        }

        if (page === "doctor") {
          const valueById = {
            consoleName: selectedPatient,
            consoleSub: `${patient.sub} • ${patient.token} • APX-88219`,
            consoleTokenTag: patient.token,
            patientStatusPill: patient.status,
            vitalBP: patient.bp,
            vitalPulse: patient.pulse,
            vitalSpo2: patient.spo2,
            consoleBalanceDue: `${patient.due} (${patient.paid} pre-paid)`,
          };
          if (valueById[node.attribs.id]) {
            return React.createElement(node.name, props, valueById[node.attribs.id]);
          }
        }

        if (page === "queue") {
          if (node.attribs.id === "pauseBtnLabel") {
            return React.createElement(node.name, props, enginePaused ? "Resume Engine" : "Pause Engine");
          }
          if (node.attribs.id === "kpiEarlyCount") {
            return React.createElement(node.name, props, String(earlyCount));
          }
          if (node.attribs.id === "dispatchBtnText" && notificationSent) {
            return React.createElement(node.name, props, "WhatsApp Sent to Priya");
          }
          if (node.attribs.id === "dispatchNotifyBtn" && notificationSent) {
            props.disabled = true;
            props.className = `${props.className} bg-emerald-600 hover:bg-emerald-700`.replace(/bg-brand-600|hover:bg-brand-700/g, "").trim();
          }
          if (node.attribs.id === "simBar") {
            props.style = {
              ...props.style,
              width: `${Math.max(5, (countdown / 90) * 100)}%`,
            };
          }
          if (node.attribs.id === "simBarText") {
            const minutes = Math.floor(countdown / 60);
            const seconds = countdown % 60;
            return React.createElement(node.name, props, `0${minutes}:${String(seconds).padStart(2, "0")} remaining`);
          }
          if (node.attribs.id === "patientFeedback") {
            const responseText = patientResponse === "accepted"
              ? "✓ Accepted! Moved to 10:18 AM. Proceed to Room 02."
              : patientResponse === "declined"
                ? "Understood. Your 10:30 AM slot is preserved."
                : "";
            if (patientResponse) props.className = "text-center p-2 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800";
            return React.createElement(node.name, props, responseText);
          }
          if (node.attribs.id === "patientAcceptBtn" && patientResponse === "accepted") {
            props.disabled = true;
            props.className = `${props.className} opacity-50`;
          }
          if (node.attribs.id === "patientKeepBtn" && patientResponse === "accepted") {
            props.className = `${props.className} hidden`;
          }
          if (node.attribs.id === "patientAcceptBtn" && patientResponse === "declined") {
            props.className = `${props.className} hidden`;
          }
          if (node.attribs.id === "patientKeepBtn" && patientResponse === "declined") {
            props.disabled = true;
            props.className = `${props.className} opacity-50`;
          }
        }

        if (page === "schedule" && node.attribs.id === "consultTimer") {
          const minutes = Math.floor(consultDuration / 60);
          const seconds = consultDuration % 60;
          return React.createElement(
            node.name,
            props,
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
          );
        }

        if (page === "reception" && node.attribs.id === "quick-search-input") {
          props.value = searchValue || props.defaultValue || "";
          delete props.defaultValue;
          props.onChange = (event) => setSearchValue(event.target.value);
        }

        if (page === "calendar") {
          if (node.attribs.class?.includes("date-chip")) {
            const text = getNodeText(node.children);
            if (selectedDate) {
              const isSelected = selectedDate === text;
              props.className = isSelected
                ? "date-chip flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-primary text-white shadow-sm ring-1 ring-primary transition-all text-center cursor-pointer"
                : "date-chip flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white text-on-surface border border-outline-variant/70 hover:border-primary/40 hover:bg-slate-50 transition-all text-center cursor-pointer";
            }
          }
          if (node.attribs.class?.includes("slot-btn") && selectedSlot) {
            const text = getNodeText(node.children);
            if (selectedSlot === text) props.className = `${props.className} border-primary ring-2 ring-blue-100`;
          }
          if (node.attribs.id === "tabMorning" || node.attribs.id === "tabEvening") {
            const isActive = node.attribs.id === `tab${activeSession}`;
            props.className = isActive
              ? "px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold transition-all"
              : "px-4 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface text-xs font-medium transition-all";
          }
        }

        if (node.attribs.id && node.attribs.id === modal) {
          props.className = `${props.className ?? ""} flex`.replace(/\bhidden\b/g, "").trim();
        }

        const hasReactInteraction =
          originalClick ||
          (page === "calendar" &&
            (node.attribs.class?.includes("date-chip") ||
              node.attribs.class?.includes("slot-btn") ||
              ["tabMorning", "tabEvening"].includes(node.attribs.id))) ||
          (page === "patient" &&
            ["bookModalBtn", "viewTokenSlipBtn", "opdScanBtn", "closeBookingModal", "closeTokenSlipModal"].includes(node.attribs.id));
        if (hasReactInteraction) props.onClick = (event) => handleClick(originalClick ?? "", node, event);
        if (originalSubmit) props.onSubmit = (event) => handleClick(originalSubmit, node, event);
        return node.name !== "textarea" && node.children?.length
          ? React.createElement(node.name, props, children)
          : React.createElement(node.name, props);
      },
    }),
    [
      activeSession,
      countdown,
      consultDuration,
      earlyCount,
      handleClick,
      hiddenSections,
      modal,
      page,
      patient,
      patientResponse,
      searchValue,
      selectedDate,
      selectedPatient,
      selectedSlot,
      enginePaused,
      notificationSent,
    ],
  );

  useEffect(() => {
    if (page !== "queue" || enginePaused || countdown === 0 || patientResponse) return undefined;
    const timer = window.setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown, enginePaused, page, patientResponse]);

  useEffect(() => {
    if (page !== "schedule") return undefined;
    const timer = window.setInterval(() => setConsultDuration((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (page !== "reception") return undefined;
    const handleShortcut = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        setModal("walkin-modal");
      } else if (event.key === "F1") {
        event.preventDefault();
        document.getElementById("quick-search-input")?.focus();
      } else if (event.key === "Escape") {
        setModal("");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [page]);

  const markup = useMemo(() => getBody(source), [source]);
  const bodyClass = source.match(/<body\b[^>]*\bclass="([^"]*)"/i)?.[1] ?? "";

  return (
    <div className={`prototype-screen ${bodyClass}`}>
      {parse(markup, parserOptions)}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}
