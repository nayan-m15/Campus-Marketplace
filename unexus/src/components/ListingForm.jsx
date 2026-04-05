import { useState, useRef, useCallback } from "react";
import { CONDITION_COLORS } from "../data/listings";
import "../styles/ListingForm.css";

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

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

export default function ListingForm({ onSubmit, onCancel }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitted(true);
    onSubmit?.({
      imageFile,
      imagePreview,
      title: name.trim(),
      price: `R ${Number(price).toFixed(2)}`,
      condition,
    });
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
          <label className="lf__label" htmlFor="lf-name">
            Item name
          </label>
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

        {/* ── Price ── */}
        <section className="lf__section">
          <label className="lf__label" htmlFor="lf-price">
            Asking price
          </label>
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
          <label className="lf__label" id="lf-condition-label">
            Condition
          </label>
          <ConditionSelector value={condition} onChange={(c) => {
            setCondition(c);
            setErrors((er) => ({ ...er, condition: undefined }));
          }} />
          {errors.condition && <p className="lf__error" role="alert">{errors.condition}</p>}
        </section>

        {/* ── Actions ── */}
        <footer className="lf__actions">
          {onCancel && (
            <button type="button" className="lf__btn lf__btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className={`lf__btn lf__btn--primary ${!isReady ? "lf__btn--disabled" : ""}`}
            onClick={handleSubmit}
            disabled={submitted}
            aria-disabled={!isReady}
          >
            {submitted ? "Publishing…" : "Publish listing"}
          </button>
        </footer>
      </article>
    </main>
  );
}