/* v8 ignore file */
import { useMemo, useState } from "react";
import "../styles/AdminDashboard.css";
import { supabase } from "../supabaseClient";
import { useNotifications } from "../context/NotificationContext";
import AdminModerateListingsPanel from "./AdminModerateListingsPanel";
import FacilitiesManagementPanel from "./FacilitiesManagementPanel";
import StaffManagementPanel from "./StaffManagementPanel";
import {
  downloadCsvReport,
  downloadPdfReport,
  formatColumnLabels,
  formatReportValue,
  getOrderedColumns,
} from "../utils/adminReportExport";

const MARKETPLACE_REPORT_TYPES = [
  { value: "executive", label: "Executive Overview" },
  { value: "seller_performance", label: "Seller Performance" },
  { value: "pricing", label: "Pricing Intelligence" },
  { value: "listing_health", label: "Listing Health" },
  { value: "trend", label: "Listings Trend" },
];

const NAV_ITEMS = [
  { id: "facilities", label: "Facilities", subtitle: "Campus operations and booking settings" },
  { id: "reports", label: "Reports", subtitle: "Marketplace exports and intelligence" },
  { id: "staff", label: "Staff", subtitle: "Access, roles, and account lifecycle" },
  { id: "moderate", label: "Moderation", subtitle: "Listings review and marketplace safety" },
];

function DashboardIcon({ name, className = "" }) {
  const paths = {
    facilities: (
      <path
        d="M4 20h16M6 20V7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5V20M9 20v-4h6v4M9 10h.01M15 10h.01M9 13h.01M15 13h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    ),
    reports: (
      <>
        <path d="M5 19.25h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M7.75 15.5V11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M12 15.5V7.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M16.25 15.5V9.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </>
    ),
    staff: (
      <>
        <path
          d="M9 11a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 9 11ZM15.5 12.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M4.75 18.5a4.75 4.75 0 0 1 8.5-2.9M14.25 18.5a3.75 3.75 0 0 1 4-3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </>
    ),
    moderate: (
      <>
        <path
          d="M12 4.75 18 7v4.4c0 3.47-2.38 6.6-6 7.85-3.62-1.25-6-4.38-6-7.85V7l6-2.25Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="m9.75 12 1.5 1.5L14.75 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </>
    ),
    notifications: (
      <>
        <path d="M8.5 19.25a3.5 3.5 0 0 0 7 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path
          d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 3 .75 4.5 1.5 5.5h-14c.75-1 1.5-2.5 1.5-5.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </>
    ),
    calendar: (
      <>
        <path
          d="M6.75 5.5h10.5A1.75 1.75 0 0 1 19 7.25v10A1.75 1.75 0 0 1 17.25 19H6.75A1.75 1.75 0 0 1 5 17.25v-10A1.75 1.75 0 0 1 6.75 5.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path d="M8 4v3M16 4v3M5 9h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </>
    ),
    logout: (
      <>
        <path d="M10 6.75H7.75A1.75 1.75 0 0 0 6 8.5v7a1.75 1.75 0 0 0 1.75 1.75H10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M13 8.75 17 12l-4 3.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M17 12h-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7.5h16M4 12h16M4 16.5h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </>
    ),
    close: (
      <>
        <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </>
    ),
    pulse: (
      <path d="M4 12h3.5l2-4 3 8 2-4H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    ),
  };

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function formatAdminDate(date = new Date(), options = {}) {
  return new Intl.DateTimeFormat("en-ZA", options).format(date);
}

function getAdminInitials(name) {
  const parts = String(name || "Admin User")
    .trim()
    .split(/\s+/)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "AU";
}

function buildCalendarMatrix(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `blank-${index}`, label: "", isCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day);
    cells.push({
      key: current.toISOString(),
      label: String(day),
      isToday: current.toDateString() === new Date().toDateString(),
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const index = cells.length;
    cells.push({ key: `tail-${index}`, label: "", isCurrentMonth: false });
  }

  return cells;
}

function ReportsPanel() {
  const { notifyError, notifySuccess } = useNotifications();
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

    const entryMap = Object.entries(row).reduce((accumulator, [key, value]) => {
      accumulator[normalizeKey(key)] = value;
      return accumulator;
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
      notifyError("Report generation failed", "The report could not be generated. Check the console for details.", {
        category: "system",
        dedupeKey: `report-error-${reportType}-${dateFrom}-${dateTo}`,
      });
      return;
    }

    setReportData(data || []);
    setGenerated(true);
    notifySuccess("Report ready", "Your admin report has been generated.", {
      category: "system",
      dedupeKey: `report-ready-${reportType}-${dateFrom}-${dateTo}`,
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGenerated(false);
    await fetchReport();
    setLoading(false);
  };

  const downloadCSV = () => {
    if (!reportData.length) return;

    const summaryLines = getSummaryLines(reportType, reportData);
    const reportTitle = MARKETPLACE_REPORT_TYPES.find((report) => report.value === reportType)?.label || "Marketplace Report";

    downloadCsvReport({
      fileName: `report-${reportType}.csv`,
      reportTitle,
      dateFrom,
      dateTo,
      generatedAt: new Date(),
      summaryLines,
      rows: reportData,
    });
  };

  const downloadPDF = () => {
    if (!reportData.length) return;

    const summaryLines = getSummaryLines(reportType, reportData);
    const insightLines = generateInsights(reportType, reportData);
    const reportTitle = MARKETPLACE_REPORT_TYPES.find((report) => report.value === reportType)?.label || "Marketplace Report";

    downloadPdfReport({
      fileName: `report-${reportType}.pdf`,
      reportTitle,
      dateFrom,
      dateTo,
      generatedAt: new Date(),
      summaryLines,
      insightLines,
      rows: reportData,
    });
  };

  const handleDownload = () => {
    if (format === "csv") downloadCSV();
    if (format === "pdf") downloadPDF();
  };

  const reportSummary = getReportSummary(reportType, reportData);
  const reportInsights = generateInsights(reportType, reportData);
  const orderedPreviewColumns = getOrderedColumns(reportData);
  const previewColumnLabels = formatColumnLabels(orderedPreviewColumns);

  return (
    <section className="panel" aria-labelledby="reports-heading">
      <header className="panel__header">
        <hgroup>
          <p className="panel__eyebrow">Marketplace intelligence</p>
          <h2 id="reports-heading" className="panel__title">Generate Reports</h2>
          <p className="panel__subtitle">Export marketplace analytics based on listings data.</p>
        </hgroup>
      </header>

      <form
        className="report-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleGenerate();
        }}
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
                onChange={(event) => setReportType(event.target.value)}
                className="field-select"
              >
                {MARKETPLACE_REPORT_TYPES.map((report) => (
                  <option key={report.value} value={report.value}>{report.label}</option>
                ))}
              </select>
            </li>
            <li className="report-field">
              <label htmlFor="date-from" className="field-label">From</label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="field-input"
              />
            </li>
            <li className="report-field">
              <label htmlFor="date-to" className="field-label">To</label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="field-input"
              />
            </li>
            <li className="report-field">
              <span className="field-label">Export Format</span>
              <ul className="format-options" role="list">
                {["table", "csv", "pdf"].map((formatOption) => (
                  <li key={formatOption}>
                    <label className={`format-chip ${format === formatOption ? "format-chip--active" : ""}`}>
                      <input
                        type="radio"
                        name="format"
                        value={formatOption}
                        checked={format === formatOption}
                        onChange={() => setFormat(formatOption)}
                        className="sr-only"
                      />
                      {formatOption.toUpperCase()}
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
              <><span className="spinner" aria-hidden="true" /> Generating...</>
            ) : (
              "Generate Report"
            )}
          </button>
          {generated && (
            <button type="button" className="btn-export" onClick={handleDownload}>
              Download {format.toUpperCase()}
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
              {MARKETPLACE_REPORT_TYPES.find((report) => report.value === reportType)?.label}
              <span className="report-preview__badge">
                {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
              </span>
            </h3>
            <p className="report-preview__meta">
              Generated {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </header>

          {reportSummary.length > 0 && (
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Summary</legend>
              <ul className="report-fields report-fields--summary" role="list">
                {reportSummary
                  .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
                  .map((item) => (
                    <li key={item.label} className="report-field report-summary-card">
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
                  {previewColumnLabels.map((label) => (
                    <th key={label} scope="col">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, index) => (
                  <tr key={index}>
                    {orderedPreviewColumns.map((column) => (
                      <td key={`${index}-${column}`}>{formatReportValue(row[column], column)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>

          {reportInsights.length > 0 && (
            <fieldset className="report-fieldset">
              <legend className="fieldset-legend">Insights</legend>
              <ul className="report-insights" role="list">
                {reportInsights.map((insight) => (
                  <li key={insight} className="report-insight-pill">{insight}</li>
                ))}
              </ul>
            </fieldset>
          )}
        </section>
      )}
    </section>
  );
}

export default function AdminDashboard({
  onSignOut,
  onOpenSettings,
  listings = [],
  listingsLoading = false,
  listingsError = "",
  onModerateListing,
  adminProfile = null,
}) {
  const { notifyError, notifySuccess } = useNotifications();
  const [activeTab, setActiveTab] = useState("facilities");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const adminName =
    adminProfile?.display_name?.trim() ||
    adminProfile?.name?.trim() ||
    "Admin User";
  const adminEmail = adminProfile?.email || "admin@un.com";
  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  const dashboardMetrics = useMemo(() => {
    const flaggedCount = listings.filter((item) => item.status === "flagged").length;
    const tradeCount = listings.filter((item) =>
      item.listing_type === "trade" ||
      item.listing_type === "sale_and_trade" ||
      item.status === "for_trade"
    ).length;
    const activeListings = listings.filter((item) => item.status !== "flagged" && item.status !== "sold").length;

    return [
      {
        id: "inventory",
        label: "Marketplace listings",
        value: new Intl.NumberFormat("en-ZA").format(listings.length),
        delta: `${flaggedCount} flagged`,
        tone: flaggedCount > 0 ? "warn" : "neutral",
      },
      {
        id: "active",
        label: "Active listings",
        value: new Intl.NumberFormat("en-ZA").format(activeListings),
        delta: listingsLoading ? "Refreshing data" : "Ready for review",
        tone: "positive",
      },
      {
        id: "trade",
        label: "Trade-enabled",
        value: new Intl.NumberFormat("en-ZA").format(tradeCount),
        delta: "Exchange workflows enabled",
        tone: "info",
      },
    ];
  }, [activeNavItem.label, activeNavItem.subtitle, listings, listingsLoading]);

  const moderationAlerts = useMemo(() => {
    const flaggedCount = listings.filter((item) => item.status === "flagged").length;
    const newestListing = [...listings]
      .filter((item) => item.created_at)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0];

    return [
      {
        title: flaggedCount > 0 ? `${flaggedCount} flagged listing${flaggedCount === 1 ? "" : "s"}` : "No flagged listings",
        detail: flaggedCount > 0 ? "Moderation queue needs review" : "Marketplace risk queue is currently clear",
        tone: flaggedCount > 0 ? "warn" : "positive",
      },
      {
        title: newestListing ? newestListing.title || "Newest listing received" : "No recent listings",
        detail: newestListing ? `Added ${formatAdminDate(new Date(newestListing.created_at), { day: "numeric", month: "short" })}` : "New listings will appear here",
        tone: "info",
      },
    ];
  }, [listings]);

  const operationalNotes = useMemo(
    () => [
      {
        title: "Facilities",
        detail: "Keep room capacity and opening hours aligned with booking demand.",
      },
      {
        title: "Reports",
        detail: "Export executive summaries for marketplace performance reviews.",
      },
      {
        title: "Staff",
        detail: "Audit access regularly and disable inactive operational accounts.",
      },
    ],
    []
  );

  const calendarCells = useMemo(() => buildCalendarMatrix(new Date()), []);
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const handleUserCardActivate = (event) => {
    if (!onOpenSettings) return;

    const interactiveTarget = event.target.closest(
      'button, a, input, select, textarea, [role="button"], [role="link"]'
    );

    if (interactiveTarget && interactiveTarget !== event.currentTarget) {
      return;
    }

    onOpenSettings();
  };

  return (
    <section className="admin-shell">
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open admin navigation"
      >
        <DashboardIcon name="menu" className="admin-mobile-toggle__icon" />
      </button>

      <span
        className={`admin-shell__backdrop ${mobileNavOpen ? "admin-shell__backdrop--visible" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <nav className={`admin-sidebar ${mobileNavOpen ? "admin-sidebar--open" : ""}`} aria-label="Admin navigation">
        <header className="admin-sidebar__header">
          <section className="admin-brand">
           
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="CAMPUSXCHANGE Logo" className="sidebar__logo" />
            <hgroup className="admin-brand__text">
              <p className="admin-brand__eyebrow">CampusXchange</p>
              <h1 className="admin-brand__title">Admin Portal</h1>
            </hgroup>
          </section>
          <button
            type="button"
            className="admin-sidebar__close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close admin navigation"
          >
            <DashboardIcon name="close" className="admin-sidebar__close-icon" />
          </button>
        </header>

        <section className="admin-sidebar__section">
          <p className="admin-sidebar__section-title">Workspace</p>
          <ul className="admin-sidebar__nav" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  className={`admin-sidebar__nav-btn ${activeTab === item.id ? "admin-sidebar__nav-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  aria-current={activeTab === item.id ? "page" : undefined}
                >
                  <span className="admin-sidebar__nav-icon">
                    <DashboardIcon name={item.id} className="admin-sidebar__icon" />
                  </span>
                  <span className="admin-sidebar__nav-copy">
                    <span className="admin-sidebar__nav-label">{item.label}</span>
                    <span className="admin-sidebar__nav-subtitle">{item.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-sidebar__section admin-sidebar__section--compact">
          <p className="admin-sidebar__section-title">Signals</p>
          <ul className="admin-sidebar__signals" role="list">
            {moderationAlerts.map((alert) => (
              <li key={alert.title} className={`admin-signal admin-signal--${alert.tone}`}>
                <span className="admin-signal__title">{alert.title}</span>
                <span className="admin-signal__detail">{alert.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="admin-sidebar__footer">
          <article
            className="admin-user-card"
            role="link"
            tabIndex={onOpenSettings ? 0 : undefined}
            aria-label="Open settings"
            onClick={handleUserCardActivate}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleUserCardActivate(event);
              }
            }}
          >
            <span className="admin-user-card__avatar" aria-hidden="true">
              {getAdminInitials(adminName)}
            </span>
            <article className="admin-user-card__meta">
              <p className="admin-user-card__name">{adminName}</p>
              <p className="admin-user-card__email">{adminEmail}</p>
            </article>
          </article>
          {onSignOut && (
            <button
              className="admin-signout-btn"
              onClick={onSignOut}
              aria-label="Sign out"
              type="button"
            >
              <DashboardIcon name="logout" className="admin-signout-btn__icon" />
              <span>Sign out</span>
            </button>
          )}
        </footer>
      </nav>

      <main className="admin-main">
        <header className="admin-hero">
          <section className="admin-hero__copy">
            <p className="admin-hero__eyebrow">Admin workspace</p>
            <h2 className="admin-hero__title">{activeNavItem.label}</h2>
            <p className="admin-hero__subtitle">{activeNavItem.subtitle}</p>
          </section>
          <section className="admin-hero__meta">
            <span className="admin-hero__badge">CampusXChange operations</span>
            <p className="admin-hero__date">
              {formatAdminDate(new Date(), {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </section>
        </header>

        <section className="admin-kpi-grid" aria-label="Admin overview metrics">
          {dashboardMetrics.map((metric, index) => (
            <article
              key={metric.label}
              className={`admin-kpi-card admin-kpi-card--${metric.id} ${index === 0 ? "admin-kpi-card--featured" : ""}`}
            >
              <span className="admin-kpi-card__label">{metric.label}</span>
              <strong className="admin-kpi-card__value">{metric.value}</strong>
              <span className={`admin-kpi-card__trend admin-kpi-card__trend--${metric.tone}`}>{metric.delta}</span>
            </article>
          ))}
        </section>

        <section className="admin-main__content">
          {activeTab === "facilities" && <FacilitiesManagementPanel />}
          {activeTab === "reports" && <ReportsPanel />}
          {activeTab === "staff" && <StaffManagementPanel />}
          {activeTab === "moderate" && (
            <AdminModerateListingsPanel
              listings={listings}
              loading={listingsLoading}
              error={listingsError}
              onModerateListing={onModerateListing}
            />
          )}
        </section>
      </main>

      <aside className="admin-utility" aria-label="Admin utilities">
        <section className="utility-card utility-card--calendar">
          <header className="utility-card__header">
            <article className="utility-card__title-group">
              <DashboardIcon name="calendar" className="utility-card__icon" />
              <section>
                <h3 className="utility-card__title">Calendar</h3>
                <p className="utility-card__subtitle">
                  {formatAdminDate(new Date(), { month: "long", year: "numeric" })}
                </p>
              </section>
            </article>
          </header>
          <section className="utility-calendar">
            {weekdayLabels.map((day) => (
              <span key={day} className="utility-calendar__weekday">{day}</span>
            ))}
            {calendarCells.map((cell) => (
              <span
                key={cell.key}
                className={`utility-calendar__day ${cell.isCurrentMonth ? "" : "utility-calendar__day--muted"} ${cell.isToday ? "utility-calendar__day--today" : ""}`}
              >
                {cell.label}
              </span>
            ))}
          </section>
        </section>

        <section className="utility-card">
          <header className="utility-card__header">
            <article className="utility-card__title-group">
              <DashboardIcon name="notifications" className="utility-card__icon" />
              <section>
                <h3 className="utility-card__title">Quick insights</h3>
                <p className="utility-card__subtitle">Operational watchpoints</p>
              </section>
            </article>
          </header>
          <ul className="utility-list" role="list">
            {moderationAlerts.map((alert) => (
              <li key={alert.title} className="utility-list__item">
                <span className={`utility-list__dot utility-list__dot--${alert.tone}`} />
                <section>
                  <p className="utility-list__title">{alert.title}</p>
                  <p className="utility-list__meta">{alert.detail}</p>
                </section>
              </li>
            ))}
          </ul>
        </section>

        <section className="utility-card">
          <header className="utility-card__header">
            <article className="utility-card__title-group">
              <DashboardIcon name="pulse" className="utility-card__icon" />
              <section>
                <h3 className="utility-card__title">Weekly focus</h3>
                <p className="utility-card__subtitle">Suggested admin cadence</p>
              </section>
            </article>
          </header>
          <ul className="utility-list utility-list--stacked" role="list">
            {operationalNotes.map((note) => (
              <li key={note.title} className="utility-list__stacked-item">
                <p className="utility-list__title">{note.title}</p>
                <p className="utility-list__meta">{note.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </section>
  );
}
