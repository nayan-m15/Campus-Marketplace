import { useState } from "react";
import "../styles/AdminDashboard.css";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";

// ── Constants (Marketplace Reports) ─────────────────────────────
const MARKETPLACE_REPORT_TYPES = [
  { value: "overview", label: "Listings Overview" },
  { value: "category", label: "Category Breakdown" },
  { value: "trend", label: "Listings Trend" },
  { value: "condition", label: "Condition Distribution" },
  { value: "top_sellers", label: "Top Sellers" },
  { value: "price_distribution", label: "Price Distribution" },
];

// ── Constants (Facility Management) ─────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const INITIAL_FACILITIES = [
  {
    id: 1,
    name: "Sports Hall",
    icon: "🏀",
    capacity: 40,
    hours: {
      Mon: { open: true, start: "07:00", end: "21:00" },
      Tue: { open: true, start: "07:00", end: "21:00" },
      Wed: { open: true, start: "07:00", end: "21:00" },
      Thu: { open: true, start: "07:00", end: "21:00" },
      Fri: { open: true, start: "07:00", end: "18:00" },
      Sat: { open: true, start: "09:00", end: "15:00" },
      Sun: { open: false, start: "09:00", end: "13:00" },
    },
  },
  {
    id: 2,
    name: "Library Study Rooms",
    icon: "📚",
    capacity: 8,
    hours: {
      Mon: { open: true, start: "08:00", end: "22:00" },
      Tue: { open: true, start: "08:00", end: "22:00" },
      Wed: { open: true, start: "08:00", end: "22:00" },
      Thu: { open: true, start: "08:00", end: "22:00" },
      Fri: { open: true, start: "08:00", end: "20:00" },
      Sat: { open: true, start: "10:00", end: "18:00" },
      Sun: { open: true, start: "12:00", end: "18:00" },
    },
  },
  {
    id: 3,
    name: "Computer Lab",
    icon: "💻",
    capacity: 30,
    hours: {
      Mon: { open: true, start: "08:00", end: "20:00" },
      Tue: { open: true, start: "08:00", end: "20:00" },
      Wed: { open: true, start: "08:00", end: "20:00" },
      Thu: { open: true, start: "08:00", end: "20:00" },
      Fri: { open: true, start: "08:00", end: "17:00" },
      Sat: { open: false, start: "09:00", end: "13:00" },
      Sun: { open: false, start: "09:00", end: "13:00" },
    },
  },
];

// ── Sub-components (Facility Management) ────────────────────────

function SaveToast({ visible }) {
  return (
    <aside className={`save-toast ${visible ? "save-toast--visible" : ""}`} role="status" aria-live="polite">
      <span className="save-toast__icon">✓</span>
      Changes saved successfully
    </aside>
  );
}

function FacilityCard({ facility, onUpdate }) {
  const [expanded, setExpanded] = useState(false);

  const toggleDay = (day) => {
    onUpdate(facility.id, {
      hours: {
        ...facility.hours,
        [day]: { ...facility.hours[day], open: !facility.hours[day].open },
      },
    });
  };

  const updateHour = (day, field, value) => {
    onUpdate(facility.id, {
      hours: {
        ...facility.hours,
        [day]: { ...facility.hours[day], [field]: value },
      },
    });
  };

  const updateCapacity = (value) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) onUpdate(facility.id, { capacity: parsed });
  };

  const openDays = DAYS.filter((d) => facility.hours[d].open).length;

  return (
    <section className="AdminDash">
      <article className={`facility-card ${expanded ? "facility-card--open" : ""}`}>
        <header className="facility-card__header" onClick={() => setExpanded(!expanded)}>
          <span className="facility-card__icon">{facility.icon}</span>
          <hgroup className="facility-card__title-group">
            <h3 className="facility-card__name">{facility.name}</h3>
            <p className="facility-card__meta">
              {openDays} day{openDays !== 1 ? "s" : ""} open · {facility.capacity} slots/session
            </p>
          </hgroup>
          <span className="facility-card__chevron" aria-hidden="true">
            {expanded ? "▲" : "▼"}
          </span>
        </header>

        {expanded && (
          <section className="facility-card__body">
            {/* Slot capacity */}
            <fieldset className="capacity-fieldset">
              <legend className="fieldset-legend">Slot Capacity per Session</legend>
              <label className="capacity-label" htmlFor={`cap-${facility.id}`}>
                Max participants
              </label>
              <input
                id={`cap-${facility.id}`}
                type="number"
                min="1"
                max="500"
                value={facility.capacity}
                onChange={(e) => updateCapacity(e.target.value)}
                className="capacity-input"
              />
            </fieldset>

            {/* Operating hours */}
            <fieldset className="hours-fieldset">
              <legend className="fieldset-legend">Operating Hours</legend>
              <ul className="hours-list" role="list">
                {DAYS.map((day) => {
                  const slot = facility.hours[day];
                  return (
                    <li key={day} className={`hours-row ${!slot.open ? "hours-row--closed" : ""}`}>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          className="toggle-checkbox"
                          checked={slot.open}
                          onChange={() => toggleDay(day)}
                          aria-label={`${day} open`}
                        />
                        <span className="toggle-track" aria-hidden="true">
                          <span className="toggle-thumb" />
                        </span>
                        <span className="day-name">{day}</span>
                      </label>

                      {slot.open ? (
                        <span className="time-inputs">
                          <label className="sr-only" htmlFor={`${facility.id}-${day}-start`}>
                            Open time
                          </label>
                          <input
                            id={`${facility.id}-${day}-start`}
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateHour(day, "start", e.target.value)}
                            className="time-input"
                          />
                          <span className="time-separator">–</span>
                          <label className="sr-only" htmlFor={`${facility.id}-${day}-end`}>
                            Close time
                          </label>
                          <input
                            id={`${facility.id}-${day}-end`}
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateHour(day, "end", e.target.value)}
                            className="time-input"
                          />
                        </span>
                      ) : (
                        <span className="closed-badge">Closed</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </section>
        )}
      </article>
    </section>
  );
}

function FacilityPanel({ facilities, onUpdate, onSave }) {
  return (
    <section className="panel" aria-labelledby="facility-heading">
      <header className="panel__header">
        <hgroup>
          <h2 id="facility-heading" className="panel__title">Facility Configuration</h2>
          <p className="panel__subtitle">Set operating hours and slot capacity for each campus facility.</p>
        </hgroup>
        <button className="btn-primary" onClick={onSave}>
          <span aria-hidden="true">💾</span> Save Changes
        </button>
      </header>

      <ul className="facility-list" role="list">
        {facilities.map((f) => (
          <li key={f.id}>
            <FacilityCard facility={f} onUpdate={onUpdate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Reports Panel (Marketplace Reports with Supabase) ───────────
function ReportsPanel() {
  const [reportType, setReportType] = useState("overview");
  const [dateFrom, setDateFrom] = useState("2025-03-01");
  const [dateTo, setDateTo] = useState("2025-03-31");
  const [format, setFormat] = useState("table");
  const [reportData, setReportData] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    let query;

    switch (reportType) {
      case "overview":
        query = supabase.rpc("get_listings_overview", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      case "category":
        query = supabase.rpc("get_category_report", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      case "trend":
        query = supabase.rpc("get_trend_report", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      case "condition":
        query = supabase.rpc("get_condition_report", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      case "top_sellers":
        query = supabase.rpc("get_top_sellers", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      case "price_distribution":
        query = supabase.rpc("get_price_distribution", {
          start_date: dateFrom,
          end_date: dateTo,
        });
        break;

      default:
        return;
    }

    const { data, error } = await query;

    if (error) {
      console.error("REPORT ERROR:", error);
      alert("Failed to generate report. Check console.");
      return;
    }

    setReportData(data || []);
    setGenerated(true);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGenerated(false);
    await fetchReport();
    setLoading(false);
  };

  const downloadCSV = () => {
    if (!reportData.length) return;

    const headers = Object.keys(reportData[0]).join(",");
    const rows = reportData.map(r => Object.values(r).join(",")).join("\n");

    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "report.csv";
    link.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 10;

    reportData.forEach((row) => {
      doc.text(JSON.stringify(row), 10, y);
      y += 10;
    });

    doc.save("report.pdf");
  };

  const handleDownload = () => {
    if (format === "csv") downloadCSV();
    if (format === "pdf") downloadPDF();
  };

  return (
    <section className="panel" aria-labelledby="reports-heading">
      <header className="panel__header">
        <hgroup>
          <h2 id="reports-heading" className="panel__title">Generate Reports</h2>
          <p className="panel__subtitle">Export marketplace analytics based on listings data.</p>
        </hgroup>
      </header>

      <form
        className="report-form"
        onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}
        aria-label="Report configuration"
      >
        <fieldset className="report-fieldset">
          <legend className="fieldset-legend">Report Parameters</legend>

          <ul className="report-fields" role="list">
            <li className="report-field">
              <label htmlFor="report-type" className="field-label">Report Type</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="field-select"
              >
                {MARKETPLACE_REPORT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </li>

            <li className="report-field">
              <label htmlFor="date-from" className="field-label">From</label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="field-input"
              />
            </li>

            <li className="report-field">
              <label htmlFor="date-to" className="field-label">To</label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="field-input"
              />
            </li>

            <li className="report-field">
              <label className="field-label">Export Format</label>
              <ul className="format-options" role="list">
                {["table", "csv", "pdf"].map((f_opt) => (
                  <li key={f_opt}>
                    <label className={`format-chip ${format === f_opt ? "format-chip--active" : ""}`}>
                      <input
                        type="radio"
                        name="format"
                        value={f_opt}
                        checked={format === f_opt}
                        onChange={() => setFormat(f_opt)}
                        className="sr-only"
                      />
                      {f_opt.toUpperCase()}
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </fieldset>

        <footer className="report-actions">
          <button type="submit" className="btn-primary report-generate-btn" disabled={loading}>
            {loading ? (
              <><span className="spinner" aria-hidden="true" /> Generating…</>
            ) : (
              <><span aria-hidden="true">📊</span> Generate Report</>
            )}
          </button>
          {generated && (
            <button type="button" className="btn-export" onClick={handleDownload}>
              <span aria-hidden="true">⬇︎</span> Download {format.toUpperCase()}
            </button>
          )}
        </footer>
      </form>

      {loading && (
        <figure className="report-loading" aria-label="Loading report">
          <span className="report-loading__bar" />
        </figure>
      )}

      {generated && !loading && reportData.length > 0 && (
        <section className="report-preview" aria-labelledby="preview-heading">
          <header className="report-preview__header">
            <h3 id="preview-heading" className="report-preview__title">
              {MARKETPLACE_REPORT_TYPES.find((r) => r.value === reportType)?.label}
              <span className="report-preview__badge">
                {new Date(dateFrom).toLocaleDateString()} – {new Date(dateTo).toLocaleDateString()}
              </span>
            </h3>
            <p className="report-preview__meta">
              Generated {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </header>

          <figure className="table-figure">
            <table className="report-table">
              <thead>
                <tr>
                  {Object.keys(reportData[0]).map((key) => (
                    <th key={key} scope="col">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((val, i) => (
                      <td key={i}>{val?.toString()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </section>
      )}
    </section>
  );
}

// ── Main AdminDashboard Component ───────────────────────────────
export default function AdminDashboard({ onSignOut }) {
  const [activeTab, setActiveTab] = useState("facilities");
  const [facilities, setFacilities] = useState(INITIAL_FACILITIES);
  const [toastVisible, setToastVisible] = useState(false);

  const updateFacility = (id, changes) => {
    setFacilities((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...changes } : f))
    );
  };

  const handleSave = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const NAV_ITEMS = [
    { id: "facilities", icon: "🏛️", label: "Facility Hours" },
    { id: "reports", icon: "📊", label: "Reports" },
  ];

  return (
    <section className="admin-dashboard-wrapper">
      <SaveToast visible={toastVisible} />

      {/* Sidebar */}
      <nav className="sidebar" aria-label="Admin navigation">
        <header className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">⚡</span>
          <hgroup className="sidebar__brand-text">
            <h1 className="sidebar__app-name">Unexus</h1>
            <p className="sidebar__role">Admin Portal</p>
          </hgroup>
        </header>

        <ul className="sidebar__nav" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`sidebar__nav-btn ${activeTab === item.id ? "sidebar__nav-btn--active" : ""}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <footer className="sidebar__footer">
          <figure className="admin-avatar" aria-hidden="true">A</figure>
          <hgroup className="admin-info">
            <p className="admin-name">Admin User</p>
            <p className="admin-email">admin@un.com</p>
          </hgroup>
          {onSignOut && (
            <button
              className="sidebar__signout-btn"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              ⏻
            </button>
          )}
        </footer>
      </nav>

      {/* Main content */}
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <hgroup>
            <h2 className="topbar-title">
              {activeTab === "facilities" ? "🏛️ Facility Configuration" : "📊 Marketplace Reports"}
            </h2>
            <p className="topbar-date">
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </hgroup>
        </header>

        {activeTab === "facilities" && (
          <FacilityPanel
            facilities={facilities}
            onUpdate={updateFacility}
            onSave={handleSave}
          />
        )}
        {activeTab === "reports" && <ReportsPanel />}
      </main>
    </section>
  );
}