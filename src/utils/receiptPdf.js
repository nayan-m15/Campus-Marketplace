import jsPDF from "jspdf";

/*This function formats the currency.*/
function formatCurrency(amount) {
  return `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/*This function formats the date time.*/
function formatDateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*This function detects the image format from a data URL.*/
function detectImageFormat(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

/*This function converts a blob to a data URL.*/
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the item image."));
    reader.readAsDataURL(blob);
  });
}

/*This function converts an image URL to a data URL.*/
async function imageUrlToDataUrl(imageUrl) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Image request failed with ${response.status}.`);
    }

    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    // Keep the receipt usable even when the image cannot be embedded.
    return null;
  }
}

/*This function draws the section title.*/
function drawSectionTitle(doc, label, x, y, width) {
  doc.setFillColor(240, 247, 244);
  doc.roundedRect(x, y - 6, width, 10, 3, 3, "F");
  doc.setTextColor(21, 56, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(label, x + 4, y);
}

/*This function draws the wrapped value.*/
function drawWrappedValue(doc, label, value, x, y, width) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(label, x, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  const wrapped = doc.splitTextToSize(value || "Not recorded", width);
  doc.text(wrapped, x + 34, y);
  return y + (wrapped.length * 5);
}

/*This function generates the receipt PDF for a transaction.*/
export async function generateTransactionReceiptPdf(transaction) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  const imageDataUrl = await imageUrlToDataUrl(transaction.itemImageUrl);

  const quantity = Number(transaction.quantity || 1);
  const unitPrice = Number(transaction.price || 0);
  const totalAmount = Number(transaction.totalAmount ?? unitPrice);
  const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);

  doc.setFillColor(21, 91, 68);
  doc.roundedRect(margin, margin, contentWidth, 26, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CampusXchange", margin + 8, margin + 10);
  doc.setFontSize(14);
  doc.text("Transaction Receipt", margin + 8, margin + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, pageWidth - margin - 54, margin + 18);

  doc.setDrawColor(222, 226, 230);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 46, contentWidth, pageHeight - 64, 6, 6, "FD");

  let cursorY = 58;

  drawSectionTitle(doc, "Transaction Summary", margin + 6, cursorY, contentWidth - 12);
  cursorY += 10;
  cursorY = drawWrappedValue(doc, "Transaction ID", transaction.id || "Not recorded", margin + 10, cursorY, 110);
  cursorY = drawWrappedValue(doc, "Date & Time", formatDateTime(transaction.createdAt), margin + 10, cursorY + 2, 110);
  cursorY = drawWrappedValue(doc, "Status", transaction.status || "Not recorded", margin + 10, cursorY + 2, 110);
  cursorY = drawWrappedValue(doc, "Payment", isItemTrade ? "Item trade" : transaction.paymentMethod || "Not recorded", margin + 10, cursorY + 2, 110);

  cursorY += 8;
  drawSectionTitle(doc, "People", margin + 6, cursorY, contentWidth - 12);
  cursorY += 10;
  cursorY = drawWrappedValue(
    doc,
    "Buyer",
    `${transaction.buyer?.name || "Unknown"} (${transaction.buyer?.studentId || "No contact available"})`,
    margin + 10,
    cursorY,
    110,
  );
  cursorY = drawWrappedValue(
    doc,
    "Seller",
    `${transaction.seller?.name || "Unknown"} (${transaction.seller?.studentId || "No contact available"})`,
    margin + 10,
    cursorY + 2,
    110,
  );

  cursorY += 8;
  drawSectionTitle(doc, "Item Details", margin + 6, cursorY, contentWidth - 12);
  cursorY += 10;

  const detailStartY = cursorY;
  const textWidth = imageDataUrl ? 105 : contentWidth - 24;
  cursorY = drawWrappedValue(doc, "Item", transaction.item || "Not recorded", margin + 10, cursorY, textWidth);
  if (isItemTrade) {
    cursorY = drawWrappedValue(
      doc,
      "Swap",
      `${transaction.requested_item || "Listed item"} for ${transaction.offered_item || "offered item"}`,
      margin + 10,
      cursorY + 2,
      textWidth,
    );
  }
  cursorY = drawWrappedValue(doc, "Description", transaction.itemDescription || "Not recorded", margin + 10, cursorY + 2, textWidth);
  cursorY = drawWrappedValue(doc, isItemTrade ? "Value" : "Price", isItemTrade ? "Item for item" : formatCurrency(unitPrice), margin + 10, cursorY + 2, textWidth);
  if (!isItemTrade) {
    cursorY = drawWrappedValue(doc, "Quantity", String(quantity), margin + 10, cursorY + 2, textWidth);
    cursorY = drawWrappedValue(doc, "Total", formatCurrency(totalAmount), margin + 10, cursorY + 2, textWidth);
  }

  if (imageDataUrl) {
    const imageBoxWidth = 56;
    const imageBoxHeight = 56;
    const imageX = pageWidth - margin - imageBoxWidth - 10;
    const imageY = detailStartY - 2;

    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(imageX, imageY, imageBoxWidth, imageBoxHeight, 4, 4);
    doc.addImage(
      imageDataUrl,
      detectImageFormat(imageDataUrl),
      imageX + 2,
      imageY + 2,
      imageBoxWidth - 4,
      imageBoxHeight - 4,
      undefined,
      "MEDIUM",
    );
  } else {
    doc.setDrawColor(209, 213, 219);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(pageWidth - margin - 66, detailStartY - 2, 56, 30, 4, 4, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Image unavailable", pageWidth - margin - 57, detailStartY + 14);
  }

  doc.setDrawColor(229, 231, 235);
  doc.line(margin + 10, pageHeight - 40, pageWidth - margin - 10, pageHeight - 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text("Thank you for using CampusXchange.", margin + 10, pageHeight - 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "This receipt confirms the transaction record currently stored in the platform ledger.",
    margin + 10,
    pageHeight - 23,
  );

  doc.save(`trade-facility-receipt-${transaction.id || "transaction"}.pdf`);
}
