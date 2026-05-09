import { describe, expect, test } from "vitest";
import {
  buildCsvContent,
  formatColumnLabels,
  formatReportValue,
  getOrderedColumns,
} from "./adminReportExport";

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
});
