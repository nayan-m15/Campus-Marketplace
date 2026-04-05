import { useState, useRef, useCallback } from "react";
import { CONDITION_COLORS } from "../data/listings";
import { supabase } from "../supabaseClient";
import "../styles/ListingForm.css";

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

// ── Image Upload Zone ────────────────────────────────────────
function ImageUploadZone({ preview, onChange }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => onChange(file, reader.result);
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <figure
      className={`lf__image-zone ${preview ? "lf__image-zone--filled" : ""} ${dragging ? "lf__image-zone--drag" : ""}`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload item photo"
      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
    >
      {preview ? (
        <>
          <img src={preview} alt="Item preview" className="lf__image-preview" />
          <figcaption className="lf__image-overlay">
            <span className="lf__image-overlay-icon" aria-hidden="true">📷</span>
            <span className="lf__image-overlay-label">Change photo</span>
          </figcaption>
        </>
      ) : (
        <figcaption className="lf__upload-prompt">
          <span className="lf__upload-icon" aria-hidden="true">📷</span>
          <span className="lf__upload-label">Add photo</span>
          <span className="lf__upload-hint">Click or drag &amp; drop · Camera supported on mobile</span>
        </figcaption>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="lf__file-input"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
    </figure>
  );
}

// ── Condition Selector ───────────────────────────────────────
function ConditionSelector({ value, onChange }) {
  return (
    <div className="lf__condition-row" role="radiogroup" aria-label="Item condition">
      {CONDITIONS.map((cond) => {
        const color = CONDITION_COLORS[cond] || "#6b7280";
        const selected = value === cond;
        return (
          <button
            key={cond}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`lf__condition-badge ${selected ? "lf__condition-badge--selected" : ""}`}
            style={{
              "--badge-color": color,
              "--badge-bg": color + "22",
              "--badge-border": color + "55",
            }}
            onClick={() => onChange(selected ? "" : cond)}
          >
            {cond}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────
export default function ListingForm({ onCancel, onSuccess }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleImageChange = (file, preview) => {
    setImageFile(file);
    setImagePreview(preview);
    setErrors((e) => ({ ...e, image: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!imagePreview) next.image = "Please add a photo of the item.";
    if (!name.trim()) next.name = "Item name is required.";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      next.price = "Enter a valid price greater than zero.";
    if (!condition) next.condition = "Please select a condition.";
    return next;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in to post a listing.");

      // 2. Upload image to Supabase Storage
      let imageUrl = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, imageFile, { upsert: false });

        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // 3. Insert the listing row — matches your exact schema
      const { error: insertError } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          title: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          condition,
          image_url: imageUrl,
        });

      if (insertError) throw new Error("Failed to save listing: " + insertError.message);

      // 4. Done — notify parent
      onSuccess?.();
      onCancel?.();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = imagePreview && name.trim() && price && Number(price) > 0 && condition;

  return (
    <main className="lf__wrapper">
      <article className="lf__card">

        {/* ── Header ── */}
        <header className="lf__header">
          <h2 className="lf__title">List an Item</h2>
          <p className="lf__subtitle">Fill in the details and publish your listing.</p>
        </header>

        {/* ── Image Upload ── */}
        <section className="lf__section">
          <ImageUploadZone preview={imagePreview} onChange={handleImageChange} />
          {errors.image && <p className="lf__error" role="alert">{errors.image}</p>}
        </section>

        {/* ── Item Name ── */}
        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-name">Item name</label>
          <input
            id="lf-name"
            type="text"
            className={`lf__input ${errors.name ? "lf__input--error" : ""}`}
            placeholder="e.g. Sony WH-1000XM5 Headphones"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((er) => ({ ...er, name: undefined }));
            }}
            maxLength={120}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "lf-name-error" : undefined}
          />
          {errors.name && <p id="lf-name-error" className="lf__error" role="alert">{errors.name}</p>}
        </section>

        {/* ── Description ── */}
        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-description">
            Description{" "}
            <span style={{ fontWeight: 400, color: "#bbb", textTransform: "none", letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="lf-description"
            className="lf__input"
            placeholder="Describe the item — age, any wear, what's included, reason for selling…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            rows={3}
            style={{
              height: "auto",
              padding: "10px 14px",
              resize: "vertical",
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />
        </section>

        {/* ── Price ── */}
        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-price">Asking price</label>
          <div className="lf__price-wrap">
            <span className="lf__currency" aria-hidden="true">R</span>
            <input
              id="lf-price"
              type="number"
              className={`lf__input lf__input--price ${errors.price ? "lf__input--error" : ""}`}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setErrors((er) => ({ ...er, price: undefined }));
              }}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? "lf-price-error" : undefined}
            />
          </div>
          {errors.price && <p id="lf-price-error" className="lf__error" role="alert">{errors.price}</p>}
        </section>

        {/* ── Condition ── */}
        <section className="lf__section">
          <label className="lf__label" id="lf-condition-label">Condition</label>
          <ConditionSelector value={condition} onChange={(c) => {
            setCondition(c);
            setErrors((er) => ({ ...er, condition: undefined }));
          }} />
          {errors.condition && <p className="lf__error" role="alert">{errors.condition}</p>}
        </section>

        {/* ── Submit Error ── */}
        {submitError && (
          <section className="lf__section">
            <p className="lf__error" role="alert">⚠️ {submitError}</p>
          </section>
        )}

        {/* ── Actions ── */}
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
            {submitting ? "Publishing…" : "Publish listing"}
          </button>
        </footer>

      </article>
    </main>
  );
}
