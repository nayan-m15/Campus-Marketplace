// Export utilities for CSV and PDF
// Handles data formatting and file generation

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to CSV
 */
export function exportToCSV(data, filename = 'export.csv', summary = []) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const csvEscape = (value) => {
    const stringValue = String(value ?? '');
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const columns = Object.keys(data[0]);
  const headers = columns.map(csvEscape).join(',');
  const rows = data
    .map((row) => columns.map((column) => csvEscape(row[column])).join(','))
    .join('\n');

  let csvContent = '';
  
  if (summary.length > 0) {
    csvContent += '=== SUMMARY ===\n';
    summary.forEach((line) => {
      csvContent += `${line}\n`;
    });
    csvContent += '\n';
  }

  csvContent += '=== DATA ===\n';
  csvContent += headers;
  csvContent += '\n';
  csvContent += rows;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to PDF
 */
export function exportToPDF(
  data,
  filename = 'export.pdf',
  title = 'Report',
  subtitle = '',
  summary = [],
  insights = []
) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(41, 128, 185);
  doc.text('CAMPUSXCHANGE', 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 28);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 34);
  }

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  })}`, 14, 40);

  let currentY = 50;

  // Summary
  if (summary.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 14, currentY);
    currentY += 8;

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    summary.forEach((line) => {
      doc.text(line, 18, currentY);
      currentY += 6;
    });
    currentY += 4;
  }

  // Table
  const columns = Object.keys(data[0]);
  const rows = data.map((row) => columns.map((col) => row[col]));

  autoTable(doc, {
    startY: currentY,
    head: [columns],
    body: rows,
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      overflow: 'linebreak',
    },
    headStyles: { 
      fillColor: [41, 128, 185], 
      textColor: 255, 
      halign: 'center',
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: currentY, left: 14, right: 14 },
    tableWidth: 'auto',
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // Insights
  if (insights.length > 0 && currentY < pageHeight - 40) {
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Insights', 14, currentY);
    currentY += 8;

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    insights.forEach((insight) => {
      const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - 28);
      lines.forEach((line) => {
        if (currentY < pageHeight - 20) {
          doc.text(line, 18, currentY);
          currentY += 5;
        }
      });
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('CAMPUSXCHANGE Analytics Platform', 14, pageHeight - 10);
  doc.text(`Page 1`, pageWidth - 20, pageHeight - 10);

  doc.save(filename);
}

/**
 * Format value for export
 */
export function formatExportValue(value, format = 'text') {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('en-ZA').format(value);
    case 'date':
      return new Date(value).toLocaleDateString('en-ZA');
    case 'datetime':
      return new Date(value).toLocaleString('en-ZA');
    default:
      return String(value);
  }
}
