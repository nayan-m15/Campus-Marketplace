// Main structure for the admin dashboard feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect } from "react";
import "../styles/AdminDashboard.css";
import "../styles/analytics.css";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminModerateListingsPanel from "./AdminModerateListingsPanel";
import FacilitiesManagementPanel from "./FacilitiesManagementPanel";
import ModernReportsDashboard from "./analytics/ModernReportsDashboard";

// ── Constants ───────────────────────────────────────────────────
const MARKETPLACE_REPORT_TYPES = [
  { value: "executive", label: "Executive Overview" },
  { value: "seller_performance", label: "Seller Performance" },
  { value: "pricing", label: "Pricing Intelligence" },
  { value: "listing_health", label: "Listing Health" },
  { value: "trend", label: "Listings Trend" },
];


// ── Reports Panel Component ─────────────────────────────────────
function ReportsPanel() {
  const [reportType, setReportType] = useState("executive");
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-07-31");
  const [format, setFormat] = useState("table");
  const [reportData, setReportData] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizeKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const findValue = (row, candidates = []) => {
    if (!row) return null;

    const entryMap = Object.entries(row).reduce((acc, [key, value]) => {
      acc[normalizeKey(key)] = value;
      return acc;
    }, {});

    for (const candidate of candidates) {
      const directMatch = entryMap[normalizeKey(candidate)];
      if (directMatch !== undefined && directMatch !== null && directMatch !== "") {
        return directMatch;
      }
    }

    return null;
  };

  const formatValue = (value, options = {}) => {
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "number") {
      if (options.currency) {
        return new Intl.NumberFormat("en-ZA", {
          style: "currency",
          currency: "ZAR",
          maximumFractionDigits: 2,
        }).format(value);
      }
      return new Intl.NumberFormat("en-ZA").format(value);
    }
    return String(value);
  };

  const getReportSummary = (type, data) => {
    if (!data.length) return [];

    const firstRow = data[0];

    switch (type) {
      case "executive":
        return [
          {
            label: "Total Listings",
            value:
              findValue(firstRow, ["total_listings", "marketplace_listings", "listings_count", "total"]) ??
              data.length,
          },
          {
            label: "Active Listings",
            value: findValue(firstRow, ["active_listings", "active", "active_count"]),
          },
          {
            label: "Sold Listings",
            value: findValue(firstRow, ["sold_listings", "sold", "sold_count"]),
          },
          {
            label: "Avg Price",
            value: findValue(firstRow, ["avg_price", "average_price", "mean_price"]),
            currency: true,
          },
          {
            label: "Top Category",
            value: findValue(firstRow, ["top_category", "leading_category", "category_name", "category"]),
          },
        ];
      case "seller_performance":
        return [
          {
            label: "Top Seller",
            value: findValue(firstRow, ["top_seller", "seller_name", "seller", "username"]),
          },
          {
            label: "Listings",
            value: findValue(firstRow, ["listing_count", "total_listings", "listings"]),
          },
          {
            label: "Items Sold",
            value: findValue(firstRow, ["items_sold", "sold_count", "sales_count"]),
          },
          {
            label: "Revenue",
            value: findValue(firstRow, ["revenue", "total_revenue", "sales_value"]),
            currency: true,
          },
        ];
      case "pricing":
        return [
          {
            label: "Dominant Price Range",
            value: findValue(firstRow, ["price_range", "range_label", "band"]),
          },
          {
            label: "Listings In Range",
            value: findValue(firstRow, ["listing_count", "count", "total_listings"]),
          },
          {
            label: "Avg Price",
            value: findValue(firstRow, ["avg_price", "average_price"]),
            currency: true,
          },
          {
            label: "Median Price",
            value: findValue(firstRow, ["median_price", "mid_price"]),
            currency: true,
          },
        ];
      case "listing_health":
        return [
          {
            label: "Healthy Listings",
            value: findValue(firstRow, ["healthy_listings", "healthy_count", "healthy"]),
          },
          {
            label: "Flagged Listings",
            value: findValue(firstRow, ["flagged_listings", "flagged_count", "flagged"]),
          },
          {
            label: "Inactive Listings",
            value: findValue(firstRow, ["inactive_listings", "inactive_count", "inactive"]),
          },
          {
            label: "Expired Listings",
            value: findValue(firstRow, ["expired_listings", "expired_count", "expired"]),
          },
        ];
      case "trend": {
        const latestRow = data[data.length - 1];
        return [
          {
            label: "Latest Period",
            value: findValue(latestRow, ["period", "date", "day", "month", "week"]),
          },
          {
            label: "Listings",
            value: findValue(latestRow, ["listing_count", "total_listings", "count"]),
          },
          {
            label: "New Listings",
            value: findValue(latestRow, ["new_listings", "created_count", "created"]),
          },
          {
            label: "Sold Listings",
            value: findValue(latestRow, ["sold_listings", "sold_count", "sold"]),
          },
        ];
      }
      default:
        return [];
    }
  };

  const generateInsights = (type, data) => {
    if (!data.length) return [];

    const firstRow = data[0];

    switch (type) {
      case "executive": {
        const totalListings =
          findValue(firstRow, ["total_listings", "marketplace_listings", "listings_count", "total"]) ??
          data.length;
        const topCategory =
          findValue(firstRow, ["top_category", "leading_category", "category_name", "category"]) ?? "N/A";
        return [
          `Marketplace has ${formatValue(totalListings)} listings`,
          `Top category is ${formatValue(topCategory)}`,
        ];
      }
      case "seller_performance": {
        const topSellerListings = findValue(firstRow, ["listing_count", "total_listings", "listings"]) ?? "N/A";
        return [`Top seller has ${formatValue(topSellerListings)} listings`];
      }
      case "pricing": {
        const priceRange = findValue(firstRow, ["price_range", "range_label", "band"]) ?? "N/A";
        return [`Most listings fall in ${formatValue(priceRange)} price range`];
      }
      default:
        return [];
    }
  };

  const getSummaryLines = (type, data) =>
    getReportSummary(type, data)
      .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
      .map((item) => `${item.label}: ${formatValue(item.value, { currency: item.currency })}`);

  const csvEscape = (value) => {
    const stringValue = String(value ?? "");
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  const fetchReport = async () => {
    let query;
    switch (reportType) {
      case "executive":
        query = supabase.rpc("get_executive_overview", { start_date: dateFrom, end_date: dateTo });
        break;
      case "seller_performance":
        query = supabase.rpc("get_seller_performance", { start_date: dateFrom, end_date: dateTo });
        break;
      case "pricing":
        query = supabase.rpc("get_pricing_intelligence", { start_date: dateFrom, end_date: dateTo });
        break;
      case "listing_health":
        query = supabase.rpc("get_listing_health", { start_date: dateFrom, end_date: dateTo });
        break;
      case "trend":
        query = supabase.rpc("get_trend_report", { start_date: dateFrom, end_date: dateTo });
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

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  const handleGenerate = async () => {
    setLoading(true);
    setGenerated(false);
    await fetchReport();
    setLoading(false);
  };

  const downloadCSV = () => {
    if (!reportData.length) return;
    const columns = Object.keys(reportData[0]);
    const summaryLines = getSummaryLines(reportType, reportData);
    const headers = columns.map(csvEscape).join(",");
    const rows = reportData
      .map((row) => columns.map((column) => csvEscape(row[column])).join(","))
      .join("\n");
    const csvContent = [
      "=== SUMMARY ===",
      ...summaryLines,
      "",
      "=== DATA ===",
      headers,
      rows,
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!reportData.length) return;
    const doc = new jsPDF();
    const summaryLines = getSummaryLines(reportType, reportData);
    const insightLines = generateInsights(reportType, reportData);

    doc.setFontSize(18);
    doc.text("CAMPUSXCHANGE Marketplace Report", 14, 20);
    doc.setFontSize(12);
    doc.text(MARKETPLACE_REPORT_TYPES.find(r => r.value === reportType)?.label || "", 14, 28);
    doc.setFontSize(10);
    doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);
    doc.setFontSize(11);
    doc.text("Summary", 14, 50);

    doc.setFontSize(10);
    summaryLines.forEach((line, index) => {
      doc.text(line, 14, 56 + index * 6);
    });

    const columns = Object.keys(reportData[0]);
    const rows = reportData.map((row) => columns.map((col) => row[col]));
    const tableStartY = Math.max(75, 62 + summaryLines.length * 6);

    autoTable(doc, {
      startY: tableStartY,
      head: [columns],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: "center" },
      bodyStyles: { halign: "center" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: tableStartY },
    });

    if (insightLines.length) {
      let insightsY = (doc.lastAutoTable?.finalY || tableStartY) + 12;
      const pageHeight = doc.internal.pageSize.height;

      if (insightsY > pageHeight - 30) {
        doc.addPage();
        insightsY = 20;
      }

      doc.setFontSize(11);
      doc.text("Insights", 14, insightsY);
      doc.setFontSize(10);
      insightLines.forEach((line, index) => {
        doc.text(`- ${line}`, 14, insightsY + 8 + index * 6);
      });
    }

    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    doc.setFontSize(9);
    doc.text("CAMPUSXCHANGE Reporting System", 14, pageHeight - 10);
    doc.text("Page 1", pageWidth - 20, pageHeight - 10); // fixed x coordinate

    doc.save(`report-${reportType}.pdf`);
  };

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  const handleDownload = () => {
    if (format === "csv") downloadCSV();
    if (format === "pdf") downloadPDF();
  };

  const reportSummary = getReportSummary(reportType, reportData);
  const reportInsights = generateInsights(reportType, reportData);

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
              <span className="field-label">Export Format</span>
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

          {reportSummary.length > 0 && (
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Summary</legend>
              <ul className="report-fields" role="list">
                {reportSummary
                  .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
                  .map((item) => (
                    <li key={item.label} className="report-field">
                      <span className="field-label">{item.label}</span>
                      <strong>{formatValue(item.value, { currency: item.currency })}</strong>
                    </li>
                  ))}
              </ul>
            </fieldset>
          )}

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

          {reportInsights.length > 0 && (
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Insights</legend>
              <ul className="report-fields" role="list">
                {reportInsights.map((insight) => (
                  <li key={insight} className="report-field">
                    {insight}
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </section>
      )}
    </section>
  );
}

// ── Main AdminDashboard Component ───────────────────────────────
export default function AdminDashboard({
  onSignOut,
  onBackToMarketplace,
  listings = [],
  listingsLoading = false,
  listingsError = "",
  onModerateListing,
  adminProfile = null,
}) {
  const [activeTab, setActiveTab] = useState("facilities");

  const NAV_ITEMS = [
    { id: "facilities", icon: "🏛️", label: "Facilities" },
    { id: "reports", icon: "📊", label: "Analytics" },
    { id: "moderate", icon: "🛡️", label: "Moderate Listings" },
  ];

  const topbarTitle =
    activeTab === "facilities"
      ? "🏛️ Facilities Management"
      : activeTab === "reports"
        ? "📊 Analytics Dashboard"
        : "🛡️ Moderate Listings";

  const adminName =
    adminProfile?.display_name?.trim() ||
    adminProfile?.name?.trim() ||
    "Admin User";
  const adminEmail = adminProfile?.email || "admin@un.com";

  return (
    <section className="admin-dashboard-wrapper">
      {/* Sidebar navigation */}
      <nav className="sidebar" aria-label="Admin navigation">
        <header className="sidebar__brand">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="sidebar__logo" />
          <hgroup className="sidebar__brand-text">
            <h1 className="sidebar__app-name">CAMPUSXCHANGE</h1>
            <p className="sidebar__role">Admin Portal</p>
          </hgroup>
        </header>

        <ul className="sidebar__nav" role="list">
          {/*
          {onBackToMarketplace && (
            <li>
              <button
                className="sidebar__nav-btn"
                onClick={onBackToMarketplace}
              >
                <span className="sidebar__nav-icon" aria-hidden="true">←</span>
                <span>Marketplace</span>
              </button>
            </li>
          )}
          */}          
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
            <p className="admin-name">{adminName}</p>
            <p className="admin-email">{adminEmail}</p>
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
              {topbarTitle}
            </h2>
            <p className="topbar-date">
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </hgroup>
        </header>

        {activeTab === "facilities" && <FacilitiesManagementPanel />}
        {activeTab === "reports" && <ModernReportsDashboard />}
        {activeTab === "moderate" && (
          <AdminModerateListingsPanel
            listings={listings}
            loading={listingsLoading}
            error={listingsError}
            onModerateListing={onModerateListing}
          />
        )}
      </main>
    </section>
  );
}
