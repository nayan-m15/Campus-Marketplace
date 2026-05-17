import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildCsvContent,
  downloadCsvReport,
  downloadPdfReport,
  formatColumnLabels,
  formatReportValue,
  getOrderedColumns,
} from "./adminReportExport";

const mocks = vi.hoisted(() => ({
  autoTable: vi.fn((doc) => {
    doc.lastAutoTable = { finalY: 245 };
  }),
  doc: {
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    },
    lastAutoTable: { finalY: 70 },
    setFillColor: vi.fn(),
    roundedRect: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    splitTextToSize: vi.fn((value) => [String(value)]),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 2),
    setPage: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("jspdf", () => ({
  default: vi.fn(function MockJsPdf() {
    return mocks.doc;
  }),
}));

vi.mock("jspdf-autotable", () => ({
  default: (...args) => mocks.autoTable(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminReportExport", () => {
  test("orders columns into a more readable export sequence without dropping fields", () => {
    const rows = [
      {
        revenue: 1250,
        seller_name: "Amina",
        created_at: "2026-05-08T09:30:00.000Z",
        listing_count: 4,
        status: "awaiting_collection",
      },
    ];

    expect(getOrderedColumns(rows)).toEqual([
      "created_at",
      "seller_name",
      "status",
      "listing_count",
      "revenue",
    ]);
  });

  test("formats headers and values for human-readable exports", () => {
    expect(formatColumnLabels(["seller_name", "created_at", "listing_count"])).toEqual([
      "Seller Name",
      "Created At",
      "Listing Count",
    ]);
    expect(formatReportValue("awaiting_collection", "status")).toBe("Awaiting Collection");
    expect(formatReportValue(true, "is_active")).toBe("Yes");
    expect(formatReportValue(1500, "revenue")).toContain("R");
    expect(formatReportValue("2026-05-08T09:30:00.000Z", "created_at")).toContain("2026");
  });

  test("builds csv content with report metadata, summary, and complete data rows", () => {
    const csv = buildCsvContent({
      reportTitle: "Seller Performance",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      generatedAt: new Date("2026-05-09T10:00:00.000Z"),
      summaryLines: ["Top Seller: Amina", "Revenue: R 1 250.00"],
      rows: [
        {
          seller_name: "Amina",
          listing_count: 4,
          revenue: 1250,
          created_at: "2026-05-08T09:30:00.000Z",
        },
      ],
    });

    expect(csv).toContain("CampusXchange Seller Performance");
    expect(csv).toContain("Summary");
    expect(csv).toContain("Seller Name,Listing Count,Revenue");
    expect(csv).toContain("Amina");
    expect(csv).toContain("R");
  });

  test("downloads csv content through a temporary link", () => {
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") {
        element.click = click;
      }
      return element;
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:report"),
      revokeObjectURL: vi.fn(),
    });

    downloadCsvReport({
      fileName: "seller-report.csv",
      reportTitle: "Seller Performance",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      rows: [{ seller_name: "Amina", revenue: 1250 }],
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");

    vi.unstubAllGlobals();
  });

  test("downloads a styled pdf report with summaries, table data, insights, and footer pages", () => {
    downloadPdfReport({
      fileName: "seller-report.pdf",
      reportTitle: "Seller Performance",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      generatedAt: new Date("2026-05-09T10:00:00.000Z"),
      summaryLines: [
        "Top Seller: Amina",
        "Revenue: R 1 250.00",
        "Completed Sales: 8",
        "Average Price: R 156.25",
      ],
      insightLines: [
        "Textbooks performed strongly during the reporting period.",
        "Facility throughput stayed within expected operating capacity.",
      ],
      rows: [
        {
          created_at: "2026-05-08T09:30:00.000Z",
          seller_name: "Amina",
          status: "awaiting_collection",
          listing_count: 4,
          revenue: 1250,
        },
      ],
    });

    expect(mocks.autoTable).toHaveBeenCalledWith(
      mocks.doc,
      expect.objectContaining({
        head: [["Created At", "Seller Name", "Status", "Listing Count", "Revenue"]],
        body: [expect.arrayContaining(["Amina", "Awaiting Collection"])],
      }),
    );
    expect(mocks.doc.setPage).toHaveBeenCalledWith(1);
    expect(mocks.doc.setPage).toHaveBeenCalledWith(2);
    expect(mocks.doc.save).toHaveBeenCalledWith("seller-report.pdf");
  });

  test("skips empty pdf reports", () => {
    downloadPdfReport({
      fileName: "empty.pdf",
      reportTitle: "Empty",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      rows: [],
    });

    expect(mocks.autoTable).not.toHaveBeenCalled();
    expect(mocks.doc.save).not.toHaveBeenCalled();
  });
});
