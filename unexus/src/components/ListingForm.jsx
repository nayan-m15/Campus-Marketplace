import { useState, useRef, useCallback } from "react";
import { CONDITION_COLORS } from "../data/listings";
import { supabase } from "../supabaseClient";
import "../styles/ListingForm.css";
 
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];
const MAX_IMAGES = 5;
 
// ── Horizontal Scroll Image Strip ───────────────────────────
function ImageScrollStrip({ images, onChange }) {
  const fileInputRef = useRef(null);
  const [draggingOver, setDraggingOver] = useState(false);
 
  const handleFiles = useCallback(
    (files) => {
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) return;
 
      const validFiles = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);
 
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange((prev) => [...prev, { file, preview: reader.result }]);
        };
        reader.readAsDataURL(file);
      });
    },
    [images.length, onChange]
  );
 
  const removeImage = (index) => {
    onChange((prev) => prev.filter((_, i) => i !== index));
  };
 
  return (
    <div>
      {/* Scroll strip */}
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 6,
          scrollbarWidth: "none",
        }}
      >
        {/* Existing image thumbnails */}
        {images.map((img, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 110,
              height: 110,
              borderRadius: 12,
              overflow: "hidden",
              border: i === 0 ? "2px solid #f4a120" : "1.5px solid #e8e8e8",
              background: "#f7f7f7",
            }}
          >
            <img
              src={img.preview}
              alt={`Upload ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
 
            {/* Cover badge on first image */}
            {i === 0 && (
              <span style={{
                position: "absolute",
                bottom: 5,
                left: 5,
                background: "#f4a120",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                Cover
              </span>
            )}
 
            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeImage(i)}
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
              ×
            </button>
          </div>
        ))}
 
        {/* Add slot — only show if under the limit */}
        {images.length < MAX_IMAGES && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            style={{
              flexShrink: 0,
              width: 110,
              height: 110,
              borderRadius: 12,
              border: `2px dashed ${draggingOver ? "#f4a120" : "#e0e0e0"}`,
              background: draggingOver ? "#fffaf3" : "#f9f9f9",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#f4a120";
              e.currentTarget.style.background = "#fffaf3";
            }}
            onMouseLeave={(e) => {
              if (!draggingOver) {
                e.currentTarget.style.borderColor = "#e0e0e0";
                e.currentTarget.style.background = "#f9f9f9";
              }
            }}
          >
            <span style={{ fontSize: 24 }}>📷</span>
            <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>
              {images.length === 0 ? "Add photo" : "Add more"}
            </span>
            <span style={{ fontSize: 10, color: "#ccc" }}>
              {images.length}/{MAX_IMAGES}
            </span>
          </div>
        )}
      </div>
 
      {images.length > 0 && (
        <p style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
          First photo is the cover · scroll to see all · tap × to remove
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
  const [images, setImages] = useState([]); // [{ file, preview }]
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
 
  const validate = () => {
    const next = {};
    if (images.length === 0) next.image = "Please add at least one photo.";
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
 
      // 2. Upload all images to Supabase Storage
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
 
      // 3. Insert listing row
      const { error: insertError } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          title: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          condition,
          image_url: imageUrls[0],   // first image → existing column
          image_urls: imageUrls,      // all images → new array column
        });
 
      if (insertError) throw new Error("Failed to save listing: " + insertError.message);
 
      onSuccess?.();
      onCancel?.();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };
 
  const isReady = images.length > 0 && name.trim() && price && Number(price) > 0 && condition;
 
  return (
    <main className="lf__wrapper">
      <article className="lf__card">
 
        {/* ── Header ── */}
        <header className="lf__header">
          <h2 className="lf__title">List an Item</h2>
          <p className="lf__subtitle">Fill in the details and publish your listing.</p>
        </header>
 
        {/* ── Image Strip ── */}
        <section className="lf__section">
          <label className="lf__label">Photos</label>
          <ImageScrollStrip images={images} onChange={setImages} />
          {errors.image && (
            <p className="lf__error" role="alert" style={{ marginTop: 8 }}>{errors.image}</p>
          )}
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
          />
          {errors.name && <p className="lf__error" role="alert">{errors.name}</p>}
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
            />
          </div>
          {errors.price && <p className="lf__error" role="alert">{errors.price}</p>}
        </section>
 
        {/* ── Condition ── */}
        <section className="lf__section">
          <label className="lf__label">Condition</label>
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