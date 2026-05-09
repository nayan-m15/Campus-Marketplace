// Main structure for the your listings page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, CONDITION_COLORS } from "../data/listings";

const LISTING_TITLE_MAX = 90;
const LISTING_DESCRIPTION_MAX = 350;
const LISTING_PRICE_MAX_DIGITS = 8;
const LISTING_PRICE_MAX_VALUE = 99999999.99;
// Keep the edit modal aligned with the create-listing photo limit.
const MAX_IMAGES = 5;
// The edit modal should offer real listing categories, excluding the filter-only
// "All Items" option used by the browsing UI.
const EDITABLE_CATEGORIES = CATEGORIES.filter((category) => category.label !== "All Items");
const editPriceSuggestionCache = new Map();

// A focused piece of component behavior is handled here.
// Keeping it separate makes the main flow less crowded.
function clampPriceInput(value) {
  const cleaned = String(value ?? "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  const whole = (dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex))
    .replace(/\./g, "")
    .slice(0, LISTING_PRICE_MAX_DIGITS);

  if (dotIndex === -1) {
    return whole;
  }

  const cents = cleaned
    .slice(dotIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${whole}.${cents}`;
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function formatZAR(value) {
  const num = Number(String(value).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "R 0";
  const hasCents = Math.round(num * 100) % 100 !== 0;
  return `R ${num.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).replace(/,/g, " ")}`;
}

// A focused piece of component behavior is handled here.
// Keeping it separate makes the main flow less crowded.
function clampLength(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

// Builds the editable photo list from both the legacy cover column and the
// multi-image column, keeping the current cover as the first thumbnail.
function getListingImages(item) {
  const imageUrls = Array.isArray(item?.image_urls)
    ? item.image_urls.filter(Boolean)
    : [];
  const coverUrl = item?.image_url || imageUrls[0] || "";
  const orderedUrls = coverUrl
    ? [coverUrl, ...imageUrls.filter((url) => url !== coverUrl)]
    : imageUrls;

  return orderedUrls.slice(0, MAX_IMAGES).map((url, index) => ({
    id: `existing-${index}-${url}`,
    preview: url,
    url,
    file: null,
  }));
}

// Cards and edit state both treat image_url as the preferred cover fallback.
function getListingCover(item) {
  return item?.image_url || (Array.isArray(item?.image_urls) ? item.image_urls.find(Boolean) : "");
}

// Reorders thumbnails without mutating React state in place.
function moveArrayItem(items, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// Storage paths cannot safely use arbitrary file names, so user-provided
// pieces are reduced to short URL/path-friendly segments before upload.
function safeStorageSegment(value) {
  return String(value ?? "image")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function formatEditPrice(value) {
  const price = clampPriceInput(value);

  if (!price || price === ".") {
    return "";
  }

  return `R ${Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/,/g, " ")}`;
}

function getPriceSuggestionErrorMessage(error) {
  const message = error?.message || "";

  if (message.toLowerCase().includes("failed to send a request to the edge function")) {
    return "Price suggestion is unavailable right now.";
  }

  if (message.toLowerCase().includes("not found")) {
    return "Not enough comparable Google Shopping results found.";
  }

  return message || "Price suggestion is unavailable right now.";
}

function EditPriceSuggestion({ suggestion, loading, error, hasEnoughDetail }) {
  if (!hasEnoughDetail) {
    return (
      <div style={{ border: "1px solid var(--gray-200)", borderRadius: 10, padding: 12, background: "var(--surface-soft)", color: "var(--gray-600)" }}>
        <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Suggested price will appear here</strong>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>Add enough title, description, condition, and category detail first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ border: "1px solid var(--gray-200)", borderRadius: 10, padding: 12, background: "var(--surface-soft)", color: "var(--gray-600)" }}>
        <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Checking price...</strong>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>Comparing South African Google Shopping results.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ border: "1px solid rgba(229, 157, 58, 0.55)", borderRadius: 10, padding: 12, background: "rgba(229, 157, 58, 0.12)", color: "var(--gray-600)" }}>
        <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Price suggestion unavailable</strong>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{error}</p>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <div style={{ border: "1px solid rgba(31, 107, 82, 0.22)", borderRadius: 10, padding: 12, background: "rgba(227, 239, 230, 0.7)", color: "var(--gray-600)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 13, color: "var(--gray-900)" }}>Suggested price</strong>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--green)", textTransform: "uppercase" }}>
          {suggestion.confidence?.level || "Low"} confidence
        </span>
      </div>
      <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "var(--green-dark)" }}>
        {suggestion.suggestedPriceFormatted}
      </p>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
        Based on Google Shopping SA, adjusted for condition.
      </p>
    </div>
  );
}

function getEditPriceSuggestionCacheKey(item) {
  if (!item?.id) return "";

  return JSON.stringify({
    id: String(item.id),
    title: String(item.title || "").trim().toLowerCase(),
    description: String(item.description || "").trim().toLowerCase(),
    category: String(item.category || "").trim().toLowerCase(),
    condition: String(item.condition || "").trim().toLowerCase(),
  });
}

// Photo editor used inside the listing edit modal. Existing URLs and newly
// selected files share one ordered thumbnail strip so the first item is cover.
function EditImageStrip({ images, onChange }) {
  const [draggingOver, setDraggingOver] = useState(false);

  // Reads selected or dropped files into previews, while preserving the File
  // object for upload when the user saves the listing.
  function handleFiles(files) {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    Array.from(files || [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining)
      .forEach((file, fileIndex) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange((prev) => [
            ...prev,
            {
              // Stable file-derived IDs keep React keys and storage names usable.
              id: `new-${safeStorageSegment(file.name)}-${file.lastModified}-${file.size}-${images.length + fileIndex}`,
              preview: reader.result,
              url: null,
              file,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
        {images.map((image, index) => (
          // Each thumbnail can be removed; non-cover thumbnails can move left
          // until they become the cover image.
          <div
            key={image.id}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 86,
              height: 86,
              borderRadius: 10,
              overflow: "hidden",
              border: index === 0 ? "2px solid var(--green)" : "1.5px solid var(--gray-200)",
              background: "var(--surface-soft)",
            }}
          >
            <img src={image.preview} alt={`Listing photo ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {index === 0 && (
              <span style={{ position: "absolute", left: 5, bottom: 5, background: "var(--green)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                Cover
              </span>
            )}
            <div style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 4 }}>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => onChange((prev) => moveArrayItem(prev, index, index - 1))}
                  aria-label={`Move photo ${index + 1} left`}
                  style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.58)", color: "#fff", cursor: "pointer", padding: 0 }}
                >
                  &lt;
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remove photo ${index + 1}`}
                style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.58)", color: "#fff", cursor: "pointer", padding: 0 }}
              >
                x
              </button>
            </div>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          // The add slot doubles as a drag-and-drop target and a native picker.
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingOver(true);
            }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingOver(false);
              handleFiles(event.dataTransfer.files);
            }}
            style={{
              flexShrink: 0,
              width: 86,
              height: 86,
              borderRadius: 10,
              border: `2px dashed ${draggingOver ? "var(--green)" : "var(--gray-200)"}`,
              background: draggingOver ? "var(--mint)" : "var(--surface-soft)",
              color: "var(--gray-600)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              padding: 8,
            }}
          >
            Add photo
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
              style={{ display: "none" }}
              aria-label="Add listing photos"
            />
          </label>
        )}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--gray-500)" }}>
        First photo is the cover. Add up to {MAX_IMAGES}, remove old photos, or move a photo left to make it the cover.
      </p>
    </div>
  );
}
// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function YourListingsPage({ onBack, onListingChanged }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [flagReasonItem, setFlagReasonItem] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [editPriceSuggestion, setEditPriceSuggestion] = useState(null);
  const [editPriceSuggestionLoading, setEditPriceSuggestionLoading] = useState(false);
  const [editPriceSuggestionError, setEditPriceSuggestionError] = useState("");

  const editHasEnoughPriceSuggestionDetail =
    Boolean(editingItem?.title?.trim()) &&
    Boolean(editingItem?.condition) &&
    Boolean(editingItem?.category) &&
    (
      (editingItem?.description || "").trim().length >= 8 ||
      editingItem.title.trim().split(/\s+/).length >= 2
    );
  const editPriceSuggestionCacheKey = getEditPriceSuggestionCacheKey(editingItem);

  useEffect(() => {
    if (!editingItem || !editHasEnoughPriceSuggestionDetail) {
      setEditPriceSuggestion(null);
      setEditPriceSuggestionError("");
      setEditPriceSuggestionLoading(false);
      return;
    }

    if (editPriceSuggestionCache.has(editPriceSuggestionCacheKey)) {
      setEditPriceSuggestion(editPriceSuggestionCache.get(editPriceSuggestionCacheKey));
      setEditPriceSuggestionError("");
      setEditPriceSuggestionLoading(false);
      return;
    }

    let ignore = false;

    if (!supabase.functions?.invoke) {
      setEditPriceSuggestion(null);
      setEditPriceSuggestionError("Price suggestion is unavailable right now.");
      setEditPriceSuggestionLoading(false);
      return;
    }

    setEditPriceSuggestionLoading(true);
    setEditPriceSuggestionError("");

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("price-suggestion", {
          body: {
            listingId: editingItem.id,
            query: editingItem.title,
            description: editingItem.description || "",
            category: editingItem.category,
            condition: editingItem.condition,
          },
        });

        if (ignore) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        editPriceSuggestionCache.set(editPriceSuggestionCacheKey, data);
        setEditPriceSuggestion(data);
      } catch (error) {
        if (ignore) return;
        setEditPriceSuggestion(null);
        setEditPriceSuggestionError(getPriceSuggestionErrorMessage(error));
      } finally {
        if (!ignore) setEditPriceSuggestionLoading(false);
      }
    }, 700);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [
    editingItem?.title,
    editingItem?.description,
    editingItem?.category,
    editingItem?.condition,
    editingItem?.id,
    editPriceSuggestionCacheKey,
    editHasEnoughPriceSuggestionDetail,
  ]);

  // Memoized so the effect can fetch the owner's listings without tripping the
  // hook dependency rule when the signed-in user changes.
  const fetchUserListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setListings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // Defer the fetch one microtask to satisfy the repo's strict React lint
    // rule against synchronous state updates during effect execution.
    void Promise.resolve().then(fetchUserListings);
  }, [fetchUserListings]);

  async function handleDelete(id) {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setListings((prev) => prev.filter((l) => l.id !== id));
    setDeleteConfirm(null);
    showSuccess("Listing deleted.");
    onListingChanged?.();
  }

  async function handleMarkSold(id, currentStatus) {
    const newStatus = currentStatus === "sold" ? "active" : "sold";
    const { error } = await supabase
      .from("listings")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { setError(error.message); return; }
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    showSuccess(newStatus === "sold" ? "Marked as sold!" : "Relisted!");
    onListingChanged?.();
  }

  async function handleMarkTrade(item) {
    const isListedForTrade =
      item.listing_type === "trade" ||
      item.listing_type === "sale_and_trade" ||
      item.status === "for_trade";
    const updatePayload = isListedForTrade
      ? { listing_type: "sale", status: "active" }
      : { listing_type: "trade", status: "active" };
    const { error } = await supabase
      .from("listings")
      .update(updatePayload)
      .eq("id", item.id);
    if (error) { setError(error.message); return; }
    setListings((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, ...updatePayload } : l))
    );
    showSuccess(updatePayload.listing_type === "trade" ? "Listed for trade!" : "Relisted as sale!");
    onListingChanged?.();
  }

  async function handleEditSave(e) {
    e?.preventDefault?.();
    const { id, title, price, condition, description, category } = editingItem;
    const normalizedPrice = clampPriceInput(price);
    const numericPrice = Number(normalizedPrice);

    if (!normalizedPrice || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setError("Please enter a valid price greater than zero.");
      return;
    }

    if (numericPrice > LISTING_PRICE_MAX_VALUE) {
      setError("Price must be R 99 999 999.99 or less.");
      return;
    }

    const savedImageUrls = [];

    // Keep existing URLs as-is and upload only the new File objects selected in
    // the edit modal, preserving the user's thumbnail order.
    for (const [imageIndex, image] of (editingItem.editImages || []).entries()) {
      if (image.url) {
        savedImageUrls.push(image.url);
        continue;
      }

      if (!image.file) continue;

      const ext = image.file.name.split(".").pop() || "jpg";
      // The file path is deterministic from the prepared image ID and order.
      const filePath = `${user.id}/${safeStorageSegment(image.id)}-${imageIndex}.${safeStorageSegment(ext)}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(filePath, image.file, { upsert: false });

      if (uploadError) {
        setError("Image upload failed: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) savedImageUrls.push(urlData.publicUrl);
    }

    // Save both image_url for legacy cover consumers and image_urls for the
    // carousel/multi-photo views.
    const updatePayload = {
      title,
      price: numericPrice,
      condition,
      description,
      category,
      image_url: savedImageUrls[0] || null,
      image_urls: savedImageUrls,
    };

    const { error } = await supabase
      .from("listings")
      .update(updatePayload)
      .eq("id", id);
    if (error) { setError(error.message); return; }

    if (supabase.functions?.invoke) {
      void supabase.functions.invoke("price-suggestion", {
        body: {
          listingId: id,
          query: title,
          description: description || "",
          category,
          condition,
        },
      }).then(({ data, error }) => {
        if (error || data?.error) throw error || new Error(data.error);
        editPriceSuggestionCache.set(
          getEditPriceSuggestionCacheKey({ id, title, description, category, condition }),
          data
        );
      }).catch((cacheError) => {
        console.error("Failed to refresh listing price suggestion cache:", cacheError.message);
      });
    }

    setListings((prev) =>
      prev.map((l) => (
        l.id === id
          ? {
              ...l,
              ...editingItem,
              price: numericPrice,
              description: clampLength(description, LISTING_DESCRIPTION_MAX),
              image_url: savedImageUrls[0] || "",
              image_urls: savedImageUrls,
            }
          : l
      ))
    );
    setEditingItem(null);
    setIsEditingPrice(false);
    showSuccess("Listing updated!");
    onListingChanged?.();
  }

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-muted)", padding: "32px 40px", fontFamily: "var(--font)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "1px solid var(--gray-200)", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontSize: 14, color: "var(--gray-800)", fontFamily: "var(--font)" }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>Your Listings</h1>
        {listings.length > 0 && (
          <span style={{ background: "var(--mint)", color: "var(--green)", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 600 }}>
            {listings.length} listing{listings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "var(--gray-900)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "crimson", marginBottom: 16 }}>{error}</p>
      )}

      {/* Loading */}
      {loading && <p style={{ color: "var(--gray-600)" }}>Loading your listings…</p>}

      {/* Empty state */}
      {!loading && listings.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--gray-600)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No listings yet</p>
          <p style={{ fontSize: 14 }}>Click "+ List Item" in the navbar to create your first listing.</p>
        </div>
      )}

      {/* Listings grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
        {listings.map((item) => {
          const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";
          const isSold = item.status === "sold";
          const isTradeOnly = item.listing_type === "trade";
          const isFlagged = item.status === "flagged";
          // Prefer the saved cover, but still render listings that only have the
          // multi-image array populated.
          const coverImage = getListingCover(item);

          return (
            <article key={item.id} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: isFlagged ? "1.5px solid #ef4444" : "1px solid var(--gray-200)", opacity: isSold ? 0.7 : 1, position: "relative" }}>

              {/* Status badge */}
              {(item.status === "sold" || item.status === "for_trade" || item.listing_type === "trade" || item.listing_type === "sale_and_trade") && (
                <div style={{
                  position: "absolute", top: 12, left: 12, zIndex: 1,
                  background: item.status === "sold" ? "#111" : isTradeOnly ? "#1e40af" : "#2563eb",
                  color: "#fff", borderRadius: 8, padding: "4px 10px",
                  fontSize: 12, fontWeight: 700
              }}>
                {item.status === "sold" ? "SOLD" : isTradeOnly ? "FOR TRADE ONLY" : "FOR TRADE"}
              </div>
            )}

            {/* Flagged badge */}
            {isFlagged && (
              <div style={{
                position: "absolute", top: 12, right: 12, zIndex: 1,
                background: "#ef4444", color: "#fff", borderRadius: 8,
                padding: "4px 10px", fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                FLAGGED
              </div>
            )}

              {/* Image */}
              <div style={{ height: 160, background: "var(--surface-soft)", overflow: "hidden" }}>
                {coverImage ? (
                  <img src={coverImage} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                    {item.emoji || "📦"}
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-900)", margin: 0, flex: 1 }}>{item.title}</h3>
                  <span style={{ background: conditionColor + "22", color: conditionColor, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>
                    {item.condition}
                  </span>
                </div>

                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--gray-900)", margin: "0 0 4px" }}>{formatZAR(item.price)}</p>
                <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "0 0 8px" }}>{item.category}</p>

                {/* Flag reason banner */}
                {isFlagged && (
                  <button
                    onClick={() => setFlagReasonItem(item)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, width: "100%",
                      marginBottom: 12, padding: "8px 10px", borderRadius: 8,
                      background: "#fef2f2", border: "1px solid #fecaca",
                      cursor: "pointer", textAlign: "left", fontFamily: "var(--font)",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>🚩</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", flex: 1 }}>
                      This listing was flagged by staff
                    </span>
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>See reason →</span>
                  </button>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="your-listings-btn"
                    onClick={() => {
                      if (isSold) return;
                      setError(null);
                      setEditingItem({
                        ...item,
                        title: clampLength(item.title, LISTING_TITLE_MAX),
                        description: clampLength(item.description, LISTING_DESCRIPTION_MAX),
                        price: clampPriceInput(item.price),
                        editImages: getListingImages(item),
                      });
                      setIsEditingPrice(false);
                    }}
                    disabled={isSold}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: isSold ? "not-allowed" : "pointer", fontFamily: "var(--font)", color: isSold ? "var(--gray-400)" : "var(--gray-800)", opacity: isSold ? 0.45 : 1 }}
                >
                  Edit
                  </button>
                  <button
                    className="your-listings-btn"
                    onClick={() => handleMarkSold(item.id, item.status)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: item.status === "sold" ? "#f0fdf4" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: item.status === "sold" ? "var(--green)" : "var(--gray-800)" }}
                  >
                    {item.status === "sold" ? "Relist" : " Mark Sold"}
                  </button>
                  <button
                    className="your-listings-btn"
                    onClick={() => { if (!isSold) handleMarkTrade(item); }}
                    disabled={isSold}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: (item.listing_type === "trade" || item.listing_type === "sale_and_trade" || item.status === "for_trade") ? "#eff6ff" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: (item.listing_type === "trade" || item.listing_type === "sale_and_trade" || item.status === "for_trade") ? "#2563eb" : "var(--gray-800)" }}
                  >
                    {(item.listing_type === "trade" || item.listing_type === "sale_and_trade" || item.status === "for_trade") ? "Unlist Trade" : "For Trade"}
                  </button>
                  <button
                    className="your-listings-btn"
                    onClick={() => setDeleteConfirm(item.id)}
                    style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid #fee2e2", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: "#ef4444" }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Delete this listing?</h3>
            <p style={{ color: "var(--gray-600)", fontSize: 14, marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: 9, border: "1px solid var(--gray-200)", background: "var(--surface)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: "var(--danger)", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag reason modal */}
      {flagReasonItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}
          onClick={() => setFlagReasonItem(null)}
        >
          <div
            style={{ background: "var(--surface)", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚩</div>
            <h3 style={{ fontWeight: 800, marginBottom: 8, color: "var(--gray-900)" }}>Listing Flagged</h3>
            <p style={{ color: "var(--gray-600)", fontSize: 13, marginBottom: 8 }}>
              A staff member has flagged <strong>"{flagReasonItem.title}"</strong> for the following reason:
            </p>
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
              padding: "12px 16px", marginBottom: 24, textAlign: "left",
            }}>
              <p style={{ margin: 0, fontSize: 14, color: "#b91c1c", fontWeight: 600, lineHeight: 1.5 }}>
                {flagReasonItem.flag_reason || "No reason provided."}
              </p>
            </div>
            <p style={{ color: "var(--gray-500)", fontSize: 12, marginBottom: 20 }}>
              Please edit or remove this listing to address the issue. Flagged listings are hidden from other users.
            </p>
            <button
              onClick={() => setFlagReasonItem(null)}
              style={{ padding: "10px 28px", borderRadius: 9, border: "1px solid var(--gray-200)", background: "var(--surface)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}
          onClick={() => { setEditingItem(null); setIsEditingPrice(false); }}
        >
          <div
          style={{ background: "var(--surface)", borderRadius: 16, padding: 32, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsEditingPrice(false); }}
                style={{
                  position: "absolute",
                  top: -16,
                  right: -16,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--gray-100)",
                  color: "var(--gray-600)",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
                aria-label="Close"
                >
                  ✕
                </button>
            </div>
            <h3 style={{ fontWeight: 800, marginBottom: 24, fontSize: 18 }}>Edit Listing</h3>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                <span>Photos</span>
                {/* The image strip owns photo-only edits; the parent keeps the
                    full listing draft so Save Changes can persist everything. */}
                <EditImageStrip
                  images={editingItem.editImages || []}
                  onChange={(updater) => {
                    setError(null);
                    setEditingItem((current) => ({
                      ...current,
                      editImages: typeof updater === "function"
                        ? updater(current.editImages || [])
                        : updater,
                    }));
                  }}
                />
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Title
                <input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: clampLength(e.target.value, LISTING_TITLE_MAX) })}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                  maxLength={LISTING_TITLE_MAX}
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Description
                <textarea
                  value={editingItem.description || ""}
                  onChange={(e) => {
                    setError(null);
                    setEditingItem({
                      ...editingItem,
                      description: clampLength(e.target.value, LISTING_DESCRIPTION_MAX),
                    });
                  }}
                  rows={6}
                  style={{
                    minHeight: 160,
                    padding: "12px 14px",
                    borderRadius: 9,
                    border: "1.5px solid var(--gray-200)",
                    fontSize: 14,
                    fontFamily: "var(--font)",
                    outline: "none",
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                  maxLength={LISTING_DESCRIPTION_MAX}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gray-500)" }}>
                  {(editingItem.description || "").length}/{LISTING_DESCRIPTION_MAX} characters
                </span>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Condition
                <select
                  value={editingItem.condition}
                  onChange={(e) => setEditingItem({ ...editingItem, condition: e.target.value })}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                >
                  {["Like New", "Good", "Fair", "Poor"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Category
                <select
                  value={editingItem.category || "Other"}
                  onChange={(e) => {
                    // Keep the draft category in local state until Save Changes
                    // persists it with the rest of the listing edit payload.
                    setError(null);
                    setEditingItem({ ...editingItem, category: e.target.value });
                  }}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                >
                  {EDITABLE_CATEGORIES.map((category) => (
                    <option key={category.label} value={category.label}>{category.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Price
                <EditPriceSuggestion
                  suggestion={editPriceSuggestion}
                  loading={editPriceSuggestionLoading}
                  error={editPriceSuggestionError}
                  hasEnoughDetail={editHasEnoughPriceSuggestionDetail}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9\\s,\\.R]*"
                  placeholder="R0.00"
                  value={isEditingPrice ? editingItem.price : formatEditPrice(editingItem.price)}
                  onChange={(e) => {
                    setError(null);
                    setEditingItem({ ...editingItem, price: clampPriceInput(e.target.value) });
                  }}
                  onFocus={() => setIsEditingPrice(true)}
                  onBlur={() => setIsEditingPrice(false)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: "1.5px solid var(--gray-200)",
                    fontSize: 14,
                    fontFamily: "var(--font)",
                    outline: "none",
                  }}
                  required
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gray-500)" }}>
                  Currency format. Maximum 8 digits before the decimal and 2 cents digits, up to R 99 999 999.99.
                </span>
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsEditingPrice(false);
                  }}
                  style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--gray-200)", background: "var(--surface)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "var(--green)", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
