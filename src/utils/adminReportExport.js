import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const REPORT_BRAND = "CampusXchange";
const REPORT_SYSTEM = "Marketplace Reporting System";

const COLUMN_PRIORITY = [
  "period",
  "date",
  "created",
  "updated",
  "scheduled",
  "day",
  "week",
  "month",
  "year",
  "id",
  "transactionid",
  "listingid",
  "seller",
  "sellername",
  "buyer",
  "buyername",
  "user",
  "username",
  "category",
  "item",
  "title",
  "status",
  "count",
  "listings",
  "listingcount",
  "soldcount",
  "itemsold",
  "price",
  "avgprice",
  "averageprice",
  "medianprice",
  "revenue",
  "total",
];

/*This function normalizes the key.*/
function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/*This function formats the key for display.*/
function humanizeKey(key) {
  return String(key ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/*This function converts the title case.*/
function toTitleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/*This function returns whether a value is a finite number.*/
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/*This function returns whether a value is a numeric string.*/
function isNumericString(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value));
}

/*This function returns whether a value looks like a date.*/
function looksLikeDate(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes("T");
}

/*This function returns whether format as currency.*/
function shouldFormatAsCurrency(key, value) {
  if (!(isFiniteNumber(value) || isNumericString(value))) return false;
  return /(price|amount|revenue|total|value|cost)/i.test(String(key ?? ""));
}

/*This function returns whether format as date time.*/
function shouldFormatAsDateTime(key, value) {
  if (!looksLikeDate(value)) return false;
  return /(date|time|period|created|updated|scheduled|timestamp|day|month|week)/i.test(String(key ?? ""));
}

/*This function returns whether format as status.*/
function shouldFormatAsStatus(key) {
  return /(status|state)/i.test(String(key ?? ""));
}

/*This function returns whether format as boolean.*/
function shouldFormatAsBoolean(value) {
  return typeof value === "boolean";
}

/*This function formats the currency.*/
function formatCurrency(value) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/*This function formats the number.*/
function formatNumber(value) {
  return new Intl.NumberFormat("en-ZA").format(Number(value));
}

/*This function formats the date value.*/
function formatDateValue(value, key) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const hasTime = String(value).includes("T") || /(time|timestamp|created|updated|scheduled)/i.test(String(key ?? ""));
  return hasTime
    ? date.toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
}

/*This function formats the report value.*/
export function formatReportValue(value, key, options = {}) {
  if (value === null || value === undefined || value === "") return options.emptyLabel || "N/A";

  if (options.currency || shouldFormatAsCurrency(key, value)) {
    return formatCurrency(value);
  }

  if (shouldFormatAsBoolean(value)) {
    return value ? "Yes" : "No";
  }

  if (shouldFormatAsDateTime(key, value)) {
    return formatDateValue(value, key);
  }

  if (shouldFormatAsStatus(key)) {
    return toTitleCase(value);
  }

  if (isFiniteNumber(value)) {
    return formatNumber(value);
  }

  if (typeof value === "string") {
    return value.trim() || (options.emptyLabel || "N/A");
  }

  return String(value);
}

/*This function returns the ordered columns.*/
export function getOrderedColumns(rows = []) {
  const columns = Object.keys(rows[0] || {});

  return [...columns].sort((left, right) => {
    const leftKey = normalizeKey(left);
    const rightKey = normalizeKey(right);
    const leftPriority = COLUMN_PRIORITY.findIndex((candidate) => leftKey.includes(candidate));
    const rightPriority = COLUMN_PRIORITY.findIndex((candidate) => rightKey.includes(candidate));

    if (leftPriority !== rightPriority) {
      return (leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority)
        - (rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority);
    }

    return humanizeKey(left).localeCompare(humanizeKey(right));
  });
}

/*This function returns the export rows.*/
export function getExportRows(rows = [], columns = getOrderedColumns(rows)) {
  return rows.map((row) =>
    columns.map((column) => formatReportValue(row[column], column)),
  );
}

/*This function formats the column labels.*/
export function formatColumnLabels(columns = []) {
  return columns.map((column) => humanizeKey(column));
}

/*This function formats the export date time.*/
export function formatExportDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*This function formats the date range.*/
export function formatDateRange(from, to) {
  return `${formatDateValue(from, "date")} to ${formatDateValue(to, "date")}`;
}

/*This function escapes a value for CSV output.*/
function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/*This function builds the CSV content for a report export.*/
export function buildCsvContent({
  reportTitle,
  dateFrom,
  dateTo,
  generatedAt = new Date(),
  summaryLines = [],
  rows = [],
}) {
  const columns = getOrderedColumns(rows);
  const labels = formatColumnLabels(columns);
  const exportRows = getExportRows(rows, columns);

  return [
    `${REPORT_BRAND} ${reportTitle}`,
    `Date Range,${csvEscape(formatDateRange(dateFrom, dateTo))}`,
    `Generated At,${csvEscape(formatExportDateTime(generatedAt))}`,
    ...(summaryLines.length ? ["", "Summary"] : []),
    ...summaryLines.map((line) => csvEscape(line)),
    "",
    "Data",
    labels.map(csvEscape).join(","),
    ...exportRows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

/*This function downloads the csv report.*/
export function downloadCsvReport({
  fileName,
  reportTitle,
  dateFrom,
  dateTo,
  generatedAt = new Date(),
  summaryLines = [],
  rows = [],
}) {
  const csvContent = buildCsvContent({
    reportTitle,
    dateFrom,
    dateTo,
    generatedAt,
    summaryLines,
    rows,
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/*This function draws the header.*/
function drawHeader(doc, reportTitle, dateFrom, dateTo, generatedAt) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(21, 91, 68);
  doc.roundedRect(14, 12, pageWidth - 28, 28, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(REPORT_BRAND, 22, 23);
  doc.setFontSize(14);
  doc.text(reportTitle, 22, 31);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Date Range: ${formatDateRange(dateFrom, dateTo)}`, 22, 37);
  doc.text(`Generated: ${formatExportDateTime(generatedAt)}`, pageWidth - 72, 37);
}

/*This function draws the footer.*/
function drawFooter(doc) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(229, 231, 235);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(REPORT_SYSTEM, 14, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 32, pageHeight - 8);
  }
}

/*This function draws the section band.*/
function drawSectionBand(doc, label, y) {
  doc.setFillColor(240, 247, 244);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 10, 3, 3, "F");
  doc.setTextColor(21, 56, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(label, 18, y + 6.5);
}

/*This function draws the summary grid.*/
function drawSummaryGrid(doc, summaryLines, startY) {
  if (!summaryLines.length) return startY;

  drawSectionBand(doc, "Summary", startY);
  let y = startY + 16;
  const cardWidth = 56;
  const gap = 6;
  const maxColumns = 3;

  summaryLines.forEach((line, index) => {
    const column = index % maxColumns;
    if (index > 0 && column === 0) {
      y += 21;
    }

    const x = 14 + (column * (cardWidth + gap));
    const [label, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim() || "N/A";

    doc.setDrawColor(222, 226, 230);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardWidth, 17, 3, 3, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(label.trim(), x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    const wrappedValue = doc.splitTextToSize(value, cardWidth - 6);
    doc.text(wrappedValue, x + 3, y + 11);
  });

  return y + 24;
}

/*This function draws the insights.*/
function drawInsights(doc, insightLines, startY) {
  if (!insightLines.length) return startY;

  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;

  if (y > pageHeight - 45) {
    doc.addPage();
    y = 18;
  }

  drawSectionBand(doc, "Insights", y);
  y += 16;

  insightLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - 36);
    const neededHeight = Math.max(12, wrapped.length * 5 + 6);

    if (y + neededHeight > pageHeight - 24) {
      doc.addPage();
      y = 18;
      drawSectionBand(doc, "Insights", y);
      y += 16;
    }

    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, y - 4, doc.internal.pageSize.getWidth() - 28, neededHeight, 3, 3, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    doc.text(wrapped, 20, y + 2);
    y += neededHeight + 5;
  });

  return y;
}

/*This function downloads the pdf report.*/
export function downloadPdfReport({
  fileName,
  reportTitle,
  dateFrom,
  dateTo,
  generatedAt = new Date(),
  summaryLines = [],
  insightLines = [],
  rows = [],
}) {
  if (!rows.length) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const columns = getOrderedColumns(rows);
  const labels = formatColumnLabels(columns);
  const exportRows = getExportRows(rows, columns);

  drawHeader(doc, reportTitle, dateFrom, dateTo, generatedAt);
  let cursorY = 48;

  if (summaryLines.length) {
    cursorY = drawSummaryGrid(doc, summaryLines, cursorY);
  }

  drawSectionBand(doc, "Detailed Data", cursorY);
  cursorY += 14;

  autoTable(doc, {
    startY: cursorY,
    head: [labels],
    body: exportRows,
    margin: { left: 14, right: 14, bottom: 20 },
    theme: "grid",
    tableWidth: "auto",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [55, 65, 81],
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [21, 91, 68],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        drawHeader(doc, reportTitle, dateFrom, dateTo, generatedAt);
        drawSectionBand(doc, "Detailed Data", 48);
      }
    },
  });

  const afterTableY = (doc.lastAutoTable?.finalY || cursorY) + 10;
  drawInsights(doc, insightLines, afterTableY);
  drawFooter(doc);
  doc.save(fileName);
}
