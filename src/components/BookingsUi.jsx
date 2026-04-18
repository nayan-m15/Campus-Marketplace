import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient"; 
import "../styles/BookingsUi.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function generateTimeSlots(startTime, endTime) {
  const slots = [];
  const [startH] = startTime.split(":").map(Number);
  const [endH] = endTime.split(":").map(Number);
  for (let h = startH; h < endH; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

function formatSlotLabel(slot) {
  const [h] = slot.split(":").map(Number);
  const next = String(h + 1).padStart(2, "0");
  const fmt = (n) => {
    const suffix = n >= 12 ? "pm" : "am";
    const display = n % 12 === 0 ? 12 : n % 12;
    return `${display}${suffix}`;
  };
  return `${fmt(h)} – ${fmt(h + 1)}`;
}

// ── STEP INDICATOR ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="brm-steps" role="list" aria-label="Booking steps">
      {["Branch & Date", "Time & Notes"].map((label, i) => {
        const num = i + 1;
        const active = step >= num;
        const current = step === num;
        return (
          <div key={num} className="brm-step-group" role="listitem">
            {i > 0 && <div className={`brm-step-line ${active ? "brm-step-line--active" : ""}`} />}
            <div className={`brm-step ${active ? "brm-step--active" : ""} ${current ? "brm-step--current" : ""}`}>
              <span className="brm-step-num" aria-hidden="true">{active && step > num ? "✓" : num}</span>
              <span className="brm-step-label">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SUCCESS VIEW ───────────────────────────────────────────────────────────────

function SuccessView({ bookingType, facilityName, selectedDate, selectedTime, onClose }) {
  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const [h] = selectedTime.split(":").map(Number);
  const timeLabel = formatSlotLabel(selectedTime);

  return (
    <div className="brm-success">
      <div className="brm-success-icon" aria-hidden="true">✓</div>
      <h3 className="brm-success-title">Slot Requested</h3>
      <p className="brm-success-body">
        Your {bookingType === "dropoff" ? "drop-off" : "collection"} request has been sent to staff.
        You'll receive an email once it's confirmed.
      </p>
      <ul className="brm-success-details" role="list">
        <li><span>Branch</span><strong>{facilityName}</strong></li>
        <li><span>Date</span><strong>{dateLabel}</strong></li>
        <li><span>Time</span><strong>{timeLabel}</strong></li>
      </ul>
      <button className="btn-primary brm-success-close" onClick={onClose}>Done</button>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

/**
 * BookingRequestModal
 *
 * Props:
 *   transaction  — { id: string, item: string } — the transaction this booking is for
 *   bookingType  — "dropoff" | "collection"
 *   userId       — string (UUID from Supabase Auth, i.e. supabase.auth.getUser().data.user.id)
 *   onClose      — () => void
 *   onSuccess    — ({ bookingId, scheduledTime }) => void  (optional)
 */
export default function BookingRequestModal({ transaction, bookingType, userId, onClose, onSuccess }) {
  const dialogRef = useRef(null);

  const [step, setStep]                 = useState(1);
  const [done, setDone]                 = useState(false);

  const [facilities, setFacilities]     = useState([]);
  const [facilityId, setFacilityId]     = useState("");
  const [facilityHours, setFacilityHours] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [takenSlots, setTakenSlots]     = useState([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  // ── Open dialog ──
  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  // ── Fetch facilities ──
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("facilities")
        .select("id, name")
        .order("name");
      if (data) setFacilities(data);
    }
    load();
  }, []);

  // ── Fetch facility hours when branch changes ──
  useEffect(() => {
    if (!facilityId) { setFacilityHours([]); return; }
    async function load() {
      const { data } = await supabase
        .from("facility_hours")
        .select("*")
        .eq("facility_id", facilityId);
      if (data) setFacilityHours(data);
    }
    load();
    setSelectedDate("");
    setSelectedTime("");
    setAvailableSlots([]);
    setTakenSlots([]);
  }, [facilityId]);

  // ── Compute available + taken slots when date changes ──
  useEffect(() => {
    if (!facilityId || !selectedDate || !facilityHours.length) return;

    const dayName = DAYS[new Date(selectedDate + "T00:00:00").getDay()];
    const dayHours = facilityHours.find((h) => h.day === dayName);

    if (!dayHours?.open) {
      setAvailableSlots([]);
      setTakenSlots([]);
      return;
    }

    const slots = generateTimeSlots(dayHours.start_time, dayHours.end_time);
    setAvailableSlots(slots);

    async function fetchTaken() {
      setFetchingSlots(true);
      const { data } = await supabase
        .from("bookings")
        .select("scheduled_time")
        .eq("facility_id", facilityId)
        .neq("status", "cancelled")
        .gte("scheduled_time", `${selectedDate}T00:00:00`)
        .lte("scheduled_time", `${selectedDate}T23:59:59`);

      if (data) {
        // Extract "HH:MM" from each timestamp
        setTakenSlots(data.map((b) => b.scheduled_time.slice(11, 16)));
      }
      setFetchingSlots(false);
    }
    fetchTaken();
    setSelectedTime("");
  }, [facilityId, selectedDate, facilityHours]);

  // ── Helpers ──
  const today = new Date().toISOString().split("T")[0];

  function isDateOpen(dateStr) {
    if (!dateStr || !facilityHours.length) return false;
    const dayName = DAYS[new Date(dateStr + "T00:00:00").getDay()];
    const h = facilityHours.find((d) => d.day === dayName);
    return h?.open === true;
  }

  const selectedFacility = facilities.find((f) => String(f.id) === String(facilityId));
  const canProceedToStep2 = facilityId && selectedDate && isDateOpen(selectedDate);

  // ── Submit booking ──
  async function handleSubmit() {
    if (!facilityId || !selectedDate || !selectedTime) return;
    setLoading(true);
    setError("");

    try {
      const scheduledTime = `${selectedDate}T${selectedTime}:00`;
      const bookingId = `BK-${Date.now().toString(36).toUpperCase()}`;

      const { error: insertError } = await supabase.from("bookings").insert({
        id: bookingId,
        type: bookingType,
        scheduled_time: scheduledTime,
        location: selectedFacility?.name ?? "",
        facility_id: Number(facilityId),
        transaction_id: transaction.id,
        user_id: userId,
        notes: notes.trim() || null,
        status: "pending",
      });

      if (insertError) throw insertError;

      onSuccess?.({ bookingId, scheduledTime });
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──
  return (
    <dialog ref={dialogRef} className="brm-dialog" onClose={onClose}>
      <div className="brm-inner">

        {done ? (
          <SuccessView
            bookingType={bookingType}
            facilityName={selectedFacility?.name}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Header */}
            <header className="brm-header">
              <span className="brm-header-icon" aria-hidden="true">
                {bookingType === "dropoff" ? "📥" : "📤"}
              </span>
              <div className="brm-header-text">
                <h2 className="brm-title">
                  Request {bookingType === "dropoff" ? "Drop-off" : "Collection"} Slot
                </h2>
                <p className="brm-subtitle">{transaction.item} · {transaction.id}</p>
              </div>
              <button className="brm-close-btn" onClick={onClose} aria-label="Close dialog">✕</button>
            </header>

            <StepIndicator step={step} />

            {/* ── Step 1: Branch + Date ── */}
            {step === 1 && (
              <div className="brm-body">
                <div className="brm-field">
                  <label className="brm-label" htmlFor="brm-facility">Branch</label>
                  <select
                    id="brm-facility"
                    className="brm-select"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                  >
                    <option value="">Select a branch…</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {facilityId && (
                  <div className="brm-field">
                    <label className="brm-label" htmlFor="brm-date">Date</label>
                    <input
                      id="brm-date"
                      type="date"
                      className="brm-input"
                      value={selectedDate}
                      min={today}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    {selectedDate && !isDateOpen(selectedDate) && (
                      <p className="brm-hint brm-hint--warn">
                        This branch is closed on that day — please choose another date.
                      </p>
                    )}
                    {selectedDate && isDateOpen(selectedDate) && (
                      <p className="brm-hint brm-hint--ok">Branch is open on this day ✓</p>
                    )}
                  </div>
                )}

                {facilityId && !facilityHours.length && (
                  <p className="brm-hint">Loading branch hours…</p>
                )}

                {facilityId && facilityHours.length > 0 && (
                  <div className="brm-hours-preview">
                    <p className="brm-hours-title">Branch hours</p>
                    <ul className="brm-hours-list" role="list">
                      {DAYS.map((day) => {
                        const h = facilityHours.find((d) => d.day === day);
                        if (!h) return null;
                        return (
                          <li key={day} className={`brm-hours-row ${!h.open ? "brm-hours-row--closed" : ""}`}>
                            <span>{day}</span>
                            <span>{h.open ? `${h.start_time?.slice(0, 5)} – ${h.end_time?.slice(0, 5)}` : "Closed"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Time + Notes ── */}
            {step === 2 && (
              <div className="brm-body">
                <div className="brm-summary-bar">
                  <span className="brm-summary-branch">{selectedFacility?.name}</span>
                  <span className="brm-summary-sep">·</span>
                  <span>
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-ZA", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                  <button className="brm-change-btn" onClick={() => setStep(1)}>Change</button>
                </div>

                <div className="brm-field">
                  <label className="brm-label">Available slots</label>
                  {fetchingSlots ? (
                    <p className="brm-hint">Checking availability…</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="brm-hint brm-hint--warn">No slots available for this date.</p>
                  ) : (
                    <div className="brm-slots" role="group" aria-label="Available time slots">
                      {availableSlots.map((slot) => {
                        const taken = takenSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            className={`brm-slot
                              ${selectedTime === slot ? "brm-slot--selected" : ""}
                              ${taken ? "brm-slot--taken" : ""}
                            `}
                            onClick={() => !taken && setSelectedTime(slot)}
                            disabled={taken}
                            aria-pressed={selectedTime === slot}
                            aria-label={taken ? `${formatSlotLabel(slot)} — already booked` : formatSlotLabel(slot)}
                          >
                            <span className="brm-slot-time">{slot}</span>
                            <span className="brm-slot-range">{formatSlotLabel(slot)}</span>
                            {taken && <span className="brm-slot-taken-badge" aria-hidden="true">Taken</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="brm-field">
                  <label className="brm-label" htmlFor="brm-notes">
                    Notes <span className="brm-optional">(optional)</span>
                  </label>
                  <textarea
                    id="brm-notes"
                    className="brm-textarea"
                    placeholder={
                      bookingType === "dropoff"
                        ? "e.g. Original box included, fragile item, special handling needed…"
                        : "e.g. Will bring student ID, need receipt for records…"
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {error && (
                  <p className="brm-error" role="alert">{error}</p>
                )}
              </div>
            )}

            {/* Footer */}
            <footer className="brm-footer">
              {step === 1 ? (
                <>
                  <button className="btn-export" onClick={onClose}>Cancel</button>
                  <button
                    className="btn-primary"
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                  >
                    Next →
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-export" onClick={() => { setStep(1); setError(""); }}>
                    ← Back
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={!selectedTime || loading}
                  >
                    {loading ? "Requesting…" : "Request Slot"}
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
