// Main structure for the listing form feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useRef, useCallback, useEffect } from "react";
import { CONDITION_COLORS } from "../data/listings";
import { supabase } from "../supabaseClient";
import "../styles/ListingForm.css";

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];
const MAX_IMAGES = 5;
const LISTING_TITLE_MAX = 90;
const LISTING_DESCRIPTION_MAX = 350;
const LISTING_PRICE_MAX_DIGITS = 8;
const LISTING_PRICE_MAX_VALUE = 99999999.99;
const LISTING_PRICE_MAX_CHARS = LISTING_PRICE_MAX_DIGITS + 3;
const LISTING_CATEGORIES = [
  { label: "Textbooks", emoji: "📚" },
  { label: "Electronics", emoji: "💻" },
  { label: "Furniture", emoji: "🛋️" },
  { label: "Clothing", emoji: "👕" },
  { label: "Sports", emoji: "⚽" },
  { label: "Instruments", emoji: "🎸" },
  { label: "Stationery", emoji: "✏️" },
  { label: "Other", emoji: "📦" },
];

function clampLength(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

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

function ImageScrollStrip({ images, onChange }) {
  const fileInputRef = useRef(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const handleFiles = useCallback((files) => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const validFiles = Array.from(files || [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange((prev) => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  }, [images.length, onChange]);

  function removeImage(index) {
    onChange((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 6,
          scrollbarWidth: "none",
        }}
      >
        {images.map((image, index) => (
          <div
            key={`${image.preview}-${index}`}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 78,
              height: 78,
              borderRadius: 10,
              overflow: "hidden",
              border: index === 0 ? "2px solid var(--amber)" : "1.5px solid var(--gray-200)",
              background: "var(--surface)",
            }}
          >
            <img
              src={image.preview}
              alt={`Upload ${index + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {index === 0 && (
              <span
                style={{
                  position: "absolute",
                  bottom: 5,
                  left: 5,
                  background: "var(--amber)",
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Cover
              </span>
            )}

            <button
              type="button"
              onClick={() => removeImage(index)}
              aria-label="Remove image"
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              x
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter") fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingOver(true);
            }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            style={{
              flexShrink: 0,
              width: 78,
              height: 78,
              borderRadius: 10,
              border: `2px dashed ${draggingOver ? "var(--amber)" : "var(--gray-200)"}`,
              background: draggingOver ? "var(--amber-pale)" : "var(--surface-soft)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "border-color 0.2s, background 0.2s",
            }}
          >
            <span style={{ fontSize: 24 }}>📷</span>
            <span style={{ fontSize: 10, color: "var(--gray-500)", fontWeight: 600 }}>
              {images.length === 0 ? "Add photo" : "Add more"}
            </span>
            <span style={{ fontSize: 9, color: "var(--gray-400)" }}>
              {images.length}/{MAX_IMAGES}
            </span>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 6 }}>
          First photo is the cover, scroll to see all, tap x to remove
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="lf__file-input"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

function ConditionSelector({ value, onChange }) {
  return (
    <div className="lf__condition-row" role="radiogroup" aria-label="Item condition">
      {CONDITIONS.map((condition) => {
        const color = CONDITION_COLORS[condition] || "#6b7280";
        const selected = value === condition;
        return (
          <button
            key={condition}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`lf__condition-badge ${selected ? "lf__condition-badge--selected" : ""}`}
            style={{
              "--badge-color": color,
              "--badge-bg": color + "22",
              "--badge-border": color + "55",
            }}
            onClick={() => onChange(selected ? "" : condition)}
          >
            {condition}
          </button>
        );
      })}
    </div>
  );
}

function getPriceSuggestionErrorMessage(error) {
  const message = error?.message || "";

  if (message.toLowerCase().includes("failed to send a request to the edge function")) {
    return "The price suggestion service is not connected right now. You can still enter your own price, and the Google Shopping suggestion will appear once the backend function is deployed.";
  }

  if (message.toLowerCase().includes("not found")) {
    return "We could not find enough comparable Google Shopping prices for this item. Try adding a brand, model number, edition, or product code.";
  }

  return message || "We could not compare Google Shopping prices for this item yet. You can still enter your own price.";
}

function PriceSuggestionPanel({ suggestion, loading, error, hasEnoughDetail }) {
  if (!hasEnoughDetail) {
    return (
      <div className="lf__suggestion-panel lf__suggestion-panel--muted">
        <strong>Suggested price will appear here</strong>
        <p>
          Add the item name, description, condition, and category first. More specific details
          like a model number or brand help make the estimate more accurate.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="lf__suggestion-panel">
        <strong>Checking Google Shopping prices...</strong>
        <p>We are comparing similar South African shopping results before you enter your price.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lf__suggestion-panel lf__suggestion-panel--warning">
        <strong>Price suggestion unavailable</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!suggestion) return null;

  const confidenceLevel = suggestion.confidence?.level || "Low";
  const confidenceClass = confidenceLevel.toLowerCase();
  const warnings = suggestion.confidence?.warnings || [];
  const reasons = suggestion.confidence?.reasons || [];

  return (
    <div className="lf__suggestion-panel">
      <div className="lf__suggestion-header">
        <span>
          Suggested price based on Google Shopping
        </span>
        <span className={`lf__confidence lf__confidence--${confidenceClass}`}>
          {confidenceLevel} confidence
        </span>
      </div>

      <div className="lf__suggestion-price">
        {suggestion.suggestedPriceFormatted}
      </div>

      <p>
        This uses current South African Google Shopping results as a retail baseline, then
        adjusts the price for the selected item condition. It is only a guide; you still choose
        the final asking price.
      </p>

      {suggestion.suggestedRange && (
        <p>
          Suggested range: {suggestion.suggestedRange.minFormatted} -{" "}
          {suggestion.suggestedRange.maxFormatted}. Retail baseline:{" "}
          {suggestion.retailPrice?.medianFormatted || "not available"} from{" "}
          {suggestion.retailPrice?.sampleSize || 0} comparable result
          {suggestion.retailPrice?.sampleSize === 1 ? "" : "s"}.
        </p>
      )}

      {(warnings.length > 0 || reasons.length > 0) && (
        <ul className="lf__suggestion-notes">
          {[...warnings, ...reasons].slice(0, 3).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingTypeSelector({ value, onChange }) {
  const options = [
    {
      value: "sale",
      label: "For Sale",
      color: "var(--green)",
      background: "#f0fdf4",
    },
    {
      value: "trade",
      label: "For Trade",
      color: "#3b82f6",
      background: "#eff6ff",
    },
    {
      value: "sale_and_trade",
      label: "For Sale & Trade",
      color: "#2563eb",
      background: "#eff6ff",
    },
  ];

  return (
    <div className="lf__listing-type-row" role="radiogroup" aria-label="Listing type">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className="lf__listing-type-btn"
            onClick={() => onChange(option.value)}
            style={{
              "--listing-type-color": option.color,
              "--listing-type-background": option.background,
              borderColor: selected ? option.color : "var(--gray-200)",
              borderWidth: selected ? 2 : 1.5,
              background: selected ? option.background : "#fff",
              color: selected ? option.color : "var(--gray-600)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ListingForm({ onCancel, onSuccess }) {
  const [images, setImages] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [listingType, setListingType] = useState("sale");
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [priceSuggestionLoading, setPriceSuggestionLoading] = useState(false);
  const [priceSuggestionError, setPriceSuggestionError] = useState("");

  const hasEnoughPriceSuggestionDetail =
    name.trim().length >= 2 &&
    condition &&
    category &&
    (description.trim().length >= 8 || name.trim().split(/\s+/).length >= 2);

  useEffect(() => {
    if (!hasEnoughPriceSuggestionDetail) {
      setPriceSuggestion(null);
      setPriceSuggestionError("");
      setPriceSuggestionLoading(false);
      return;
    }

    let ignore = false;

    setPriceSuggestionLoading(true);
    setPriceSuggestionError("");

    const timer = setTimeout(async () => {
      try {
        if (!supabase.functions?.invoke) {
          throw new Error("Price suggestions are not available in this environment.");
        }

        const { data, error } = await supabase.functions.invoke("price-suggestion", {
          body: {
            query: name,
            description,
            category,
            condition,
          },
        });

        if (ignore) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setPriceSuggestion(data);
      } catch (error) {
        if (ignore) return;
        setPriceSuggestion(null);
        setPriceSuggestionError(getPriceSuggestionErrorMessage(error));
      } finally {
        if (!ignore) setPriceSuggestionLoading(false);
      }
    }, 700);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [name, description, category, condition, hasEnoughPriceSuggestionDetail]);

  function validate() {
    const next = {};

    if (images.length === 0) next.image = "Please add at least one photo.";
    if (!name.trim()) next.name = "Item name is required.";

    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
      next.price = "Enter a valid price greater than zero.";
    } else if (Number(price) > LISTING_PRICE_MAX_VALUE) {
      next.price = "Price must be R 99 999 999.99 or less.";
    }

    if (!condition) next.condition = "Please select a condition.";
    if (!category) next.category = "Please select a category.";

    return next;
  }

  async function handleSubmit() {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in to post a listing.");
      }

      const imageUrls = [];
      for (const { file } of images) {
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, file, { upsert: false });

        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(filePath);

        imageUrls.push(urlData.publicUrl);
      }

      const { error: insertError } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          title: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          condition,
          category,
          image_url: imageUrls[0],
          image_urls: imageUrls,
          status: "active",
          listing_type: listingType,
        });

      if (insertError) {
        throw new Error("Failed to save listing: " + insertError.message);
      }

      onSuccess?.();
      onCancel?.();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isReady =
    images.length > 0 &&
    name.trim() &&
    price &&
    Number(price) > 0 &&
    Number(price) <= LISTING_PRICE_MAX_VALUE &&
    condition &&
    category;

  return (
    <main className="lf__wrapper">
      <article className="lf__card">
        <header className="lf__header">
          <h2 className="lf__title" id="listing-form-title">List an Item</h2>
          <p className="lf__subtitle">Fill in the details and publish your listing.</p>
        </header>

        <section className="lf__section">
          <label className="lf__label">Listing type</label>
          <ListingTypeSelector value={listingType} onChange={setListingType} />
        </section>

        <section className="lf__section">
          <label className="lf__label">Photos</label>
          <ImageScrollStrip images={images} onChange={setImages} />
          {errors.image && (
            <p className="lf__error" role="alert" style={{ marginTop: 8 }}>{errors.image}</p>
          )}
        </section>

        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-name">Item name</label>
          <input
            id="lf-name"
            type="text"
            className={`lf__input ${errors.name ? "lf__input--error" : ""}`}
            placeholder="e.g. Sony WH-1000XM5 Headphones"
            value={name}
            onChange={(e) => {
              setName(clampLength(e.target.value, LISTING_TITLE_MAX));
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            maxLength={LISTING_TITLE_MAX}
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="lf__error" role="alert">{errors.name}</p>}
        </section>

        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-description">
            Description{" "}
            <span style={{ fontWeight: 400, color: "var(--gray-400)", textTransform: "none", letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="lf-description"
            className="lf__input"
            placeholder="Describe the item - age, any wear, what's included, reason for selling..."
            value={description}
            onChange={(e) => setDescription(clampLength(e.target.value, LISTING_DESCRIPTION_MAX))}
            maxLength={LISTING_DESCRIPTION_MAX}
            rows={6}
            style={{
              minHeight: 160,
              height: "auto",
              padding: "12px 14px",
              resize: "vertical",
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--gray-500)" }}>
            {description.length}/{LISTING_DESCRIPTION_MAX} characters
          </p>
        </section>

        <section className="lf__section">
          <label className="lf__label">Condition</label>
          <ConditionSelector
            value={condition}
            onChange={(nextCondition) => {
              setCondition(nextCondition);
              setErrors((prev) => ({ ...prev, condition: undefined }));
            }}
          />
          {errors.condition && <p className="lf__error" role="alert">{errors.condition}</p>}
        </section>

        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-category">Category</label>
          <div style={{ position: "relative" }}>
            <select
              id="lf-category"
              className={`lf__input ${errors.category ? "lf__input--error" : ""}`}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setErrors((prev) => ({ ...prev, category: undefined }));
              }}
              style={{ appearance: "none", paddingRight: 36, cursor: "pointer" }}
              aria-invalid={Boolean(errors.category)}
            >
              <option value="" disabled>Select a category...</option>
              {LISTING_CATEGORIES.map(({ label, emoji }) => (
                <option key={label} value={label}>
                  {emoji} {label}
                </option>
              ))}
            </select>
            <span
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fontSize: 12,
                color: "var(--gray-400)",
              }}
            >
              ▾
            </span>
          </div>
          {errors.category && <p className="lf__error" role="alert">{errors.category}</p>}
        </section>

        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-price">Asking price</label>
          <PriceSuggestionPanel
            suggestion={priceSuggestion}
            loading={priceSuggestionLoading}
            error={priceSuggestionError}
            hasEnoughDetail={hasEnoughPriceSuggestionDetail}
          />
          <div className="lf__price-wrap">
            <span className="lf__currency" aria-hidden="true">R</span>
            <input
              id="lf-price"
              type="text"
              inputMode="decimal"
              className={`lf__input lf__input--price ${errors.price ? "lf__input--error" : ""}`}
              placeholder="0.00"
              value={price}
              onChange={(e) => {
                setPrice(clampPriceInput(e.target.value));
                setErrors((prev) => ({ ...prev, price: undefined }));
              }}
              maxLength={LISTING_PRICE_MAX_CHARS}
              aria-invalid={Boolean(errors.price)}
            />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--gray-500)" }}>
            Maximum 8 digits before the decimal and 2 cents digits.
          </p>
          {errors.price && <p className="lf__error" role="alert">{errors.price}</p>}
        </section>

        {submitError && (
          <section className="lf__section">
            <p className="lf__error" role="alert">Warning: {submitError}</p>
          </section>
        )}

        <footer className="lf__actions">
          {onCancel && (
            <button
              type="button"
              className="lf__btn lf__btn--ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className={`lf__btn lf__btn--primary ${(!isReady || submitting) ? "lf__btn--disabled" : ""}`}
            onClick={handleSubmit}
            disabled={!isReady || submitting}
            aria-disabled={!isReady || submitting}
          >
            {submitting ? "Publishing..." : "Publish listing"}
          </button>
        </footer>
      </article>
    </main>
  );
}
