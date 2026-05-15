import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/BookingsUi.css";
import {
  DAYS,
  formatBookingDate,
  formatSlotLabel,
  formatTimestampDate,
  formatTimestampTime,
  generateTimeSlots,
  getDateDayName,
  mapHoursByDay,
  toDateInputValue,
} from "../utils/bookingScheduling";
import { canBookCollectionForStatus, TRANSACTION_STATUS_META } from "../utils/tradeWorkflow";

function getBookingErrorMessage(error) {
  const message = error?.message || "";
  if (/slot is no longer available/i.test(message)) {
    return "That slot has just filled up. Please choose another available time.";
  }
  if (/not ready for a drop-off booking/i.test(message)) {
    return "This transaction is not ready for a drop-off booking yet.";
  }
  if (/collection cannot be booked/i.test(message)) {
    return "Collection can only be booked after staff confirms the seller's drop-off.";
  }
  if (/only the seller can book/i.test(message) || /only the buyer can book/i.test(message)) {
    return "You do not have permission to book this slot.";
  }
  if (/future time/i.test(message)) {
    return "Please choose a future date and time.";
  }
  return message || "Unable to save the booking.";
}

function submitPayfastForm(action, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  Object.entries(fields || {}).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value ?? "");
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

function getFunctionErrorMessage(error) {
  const contextMessage = error?.context?.error_description || error?.context?.message || error?.context?.error;
  const message = contextMessage || error?.message || "";

  if (/failed to send a request to the edge function/i.test(message)) {
    return "Could not reach the PayFast checkout function. Check that create-payfast-checkout is deployed in Supabase and your local VITE_SUPABASE_URL points to that project.";
  }
  if (/non-2xx status code/i.test(message)) {
    return "The PayFast checkout function returned an error. Open Supabase Edge Function logs for create-payfast-checkout to see the exact cause.";
  }

  return message || "Unable to start PayFast sandbox checkout.";
}

function StepIndicator({ step }) {
  return (
    <section className="brm-steps" role="list" aria-label="Booking steps">
      {["Facility & Date", "Time & Confirm"].map((label, index) => {
        const itemStep = index + 1;
        const active = step >= itemStep;
        const current = step === itemStep;
        return (
          <article key={label} className="brm-step-group" role="listitem">
            {index > 0 && <span className={`brm-step-line ${active ? "brm-step-line--active" : ""}`} />}
            <section className={`brm-step ${active ? "brm-step--active" : ""} ${current ? "brm-step--current" : ""}`}>
              <span className="brm-step-num" aria-hidden="true">{active && step > itemStep ? "✓" : itemStep}</span>
              <span className="brm-step-label">{label}</span>
            </section>
          </article>
        );
      })}
    </section>
  );
}

function SuccessView({ bookingType, facilityName, selectedDate, selectedTime, onClose }) {
  return (
    <section className="brm-success">
      <span className="brm-success-icon" aria-hidden="true">✓</span>
      <h3 className="brm-success-title">Slot booked</h3>
      <p className="brm-success-body">
        Your {bookingType === "dropoff" ? "drop-off" : "collection"} slot is now linked to the transaction.
      </p>
      <ul className="brm-success-details" role="list">
        <li><span>Facility</span><strong>{facilityName}</strong></li>
        <li><span>Date</span><strong>{formatBookingDate(selectedDate)}</strong></li>
        <li><span>Time</span><strong>{formatSlotLabel(selectedTime)}</strong></li>
      </ul>
      <button className="btn-primary brm-success-close" onClick={onClose}>Done</button>
    </section>
  );
}

async function loadFacilitiesWithHours() {
  const [{ data: facilitiesData, error: facilitiesError }, { data: hoursData, error: hoursError }] = await Promise.all([
    supabase.from("facilities").select("id, name, capacity").order("name"),
    supabase.from("facility_hours").select("id, facility_id, day, open, start_time, end_time"),
  ]);

  if (facilitiesError) throw facilitiesError;
  if (hoursError) throw hoursError;

  const hoursByFacility = new Map();
  for (const row of hoursData || []) {
    const current = hoursByFacility.get(row.facility_id) || [];
    current.push(row);
    hoursByFacility.set(row.facility_id, current);
  }

  return (facilitiesData || []).map((facility) => ({
    ...facility,
    hours: hoursByFacility.get(facility.id) || [],
  }));
}

async function fetchSlotUsage(location, selectedDate, excludeBookingId = null) {
  const start = `${selectedDate}T00:00:00`;
  const end = `${selectedDate}T23:59:59`;
  const { data, error } = await supabase
    .from("bookings")
    .select("id, scheduled_time, status")
    .eq("location", location)
    .gte("scheduled_time", start)
    .lte("scheduled_time", end);

  if (error) throw error;

  return (data || []).reduce((acc, booking) => {
    if (excludeBookingId && booking.id === excludeBookingId) return acc;
    if (["cancelled"].includes(booking.status)) return acc;
    const slot = booking.scheduled_time?.slice(11, 16);
    if (!slot) return acc;
    acc[slot] = (acc[slot] || 0) + 1;
    return acc;
  }, {});
}

function BookingRequestModal({ transaction, bookingType, onClose, onSuccess }) {
  const dialogRef = useRef(null);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slotUsage, setSlotUsage] = useState({});
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingFacilities(true);
    loadFacilitiesWithHours()
      .then((data) => {
        if (!active) return;
        setFacilities(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load facility details.");
      })
      .finally(() => {
        if (active) setLoadingFacilities(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedFacility = useMemo(
    () => facilities.find((facility) => String(facility.id) === String(facilityId)) || null,
    [facilities, facilityId],
  );

  const hoursByDay = useMemo(
    () => mapHoursByDay(selectedFacility?.hours || []),
    [selectedFacility],
  );

  const closedDayIndices = useMemo(() => {
    return DAYS
      .map((day, index) => ({ index, hours: hoursByDay.get(day) }))
      .filter(({ hours }) => !hours?.open)
      .map(({ index }) => index)
      .join(",");
  }, [hoursByDay]);

  useEffect(() => {
    if (!selectedFacility || !selectedDate) {
      setSlotUsage({});
      return;
    }

    let active = true;
    setLoadingSlots(true);
    const existingBookingId = bookingType === "dropoff" ? transaction.dropoff_id : transaction.collection_id;
    fetchSlotUsage(selectedFacility.name, selectedDate, existingBookingId)
      .then((usage) => {
        if (!active) return;
        setSlotUsage(usage);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load availability.");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [selectedFacility, selectedDate]);

  useEffect(() => {
    setSelectedTime("");
  }, [selectedDate, facilityId]);

  const today = toDateInputValue();
  const now = new Date();
  const dayHours = selectedDate ? hoursByDay.get(getDateDayName(selectedDate)) : null;

  const availableSlots = useMemo(() => {
    if (!dayHours?.open) return [];
    const slots = generateTimeSlots(dayHours.start_time, dayHours.end_time);
    if (!selectedDate) return slots;

    const isToday = selectedDate === today;
    if (!isToday) return slots;
    return slots.filter((slot) => {
      const [hours, minutes] = slot.split(":").map(Number);
      const slotTime = new Date(now);
      slotTime.setHours(hours, minutes, 0, 0);
      return slotTime > now;
    });
  }, [dayHours, selectedDate, today]);

  const isDateOpen = Boolean(dayHours?.open) && availableSlots.length > 0;

  const canProceedToStep2 = Boolean(selectedFacility && selectedDate && isDateOpen);

  async function handleSubmit() {
    if (!selectedFacility || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    setError("");

    const scheduledTime = `${selectedDate}T${selectedTime}:00`;
    try {
      const { data, error: bookingError } = await supabase.rpc("book_transaction_slot", {
        p_transaction_id: transaction.id,
        p_booking_type: bookingType,
        p_facility_id: String(selectedFacility.id),
        p_scheduled_time: scheduledTime,
      });

      if (bookingError) throw bookingError;

      const bookingResult = Array.isArray(data) ? data[0] : data;
      if (!bookingResult?.booking_id) {
        throw new Error("Booking confirmation did not return a valid booking reference.");
      }

      onSuccess?.({
        scheduledTime: bookingResult.scheduled_time || scheduledTime,
        bookingType,
        bookingId: bookingResult.booking_id,
        transactionId: transaction.id,
      });
      setDone(true);
    } catch (err) {
      setError(getBookingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="brm-dialog" onClose={onClose}>
      <section className="brm-inner">
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
            <header className="brm-header">
              <span className="brm-header-icon" aria-hidden="true">
                {bookingType === "dropoff" ? "📥" : "📦"}
              </span>
              <header className="brm-header-text">
                <h2 className="brm-title">
                  Book {bookingType === "dropoff" ? "Drop-off" : "Collection"} Slot
                </h2>
                <p className="brm-subtitle">{transaction.item} · {transaction.id}</p>
              </header>
              <button className="brm-close-btn" onClick={onClose} aria-label="Close dialog">×</button>
            </header>

            <StepIndicator step={step} />

            {step === 1 && (
              <section className="brm-body">
                <section className="brm-field">
                  <label className="brm-label" htmlFor="booking-facility">Facility</label>
                  <select
                    id="booking-facility"
                    className="brm-select"
                    value={facilityId}
                    onChange={(event) => setFacilityId(event.target.value)}
                    disabled={loadingFacilities}
                  >
                    <option value="">Select a facility...</option>
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name} ({facility.capacity} per slot)
                      </option>
                    ))}
                  </select>
                  {loadingFacilities && <p className="brm-hint">Loading facilities...</p>}
                </section>

                {selectedFacility && (
                  <section className="brm-field">
                    <label className="brm-label" htmlFor="booking-date">Date</label>
                <input
                  id="booking-date"
                  type="date"
                  className="brm-input"
                  min={today}
                  value={selectedDate}
                  onChange={(event) => {
                    const date = event.target.value;
                    const dayIndex = new Date(`${date}T00:00:00`).getDay();
                    const closedIndices = DAYS
                      .map((day, i) => ({ i, hours: hoursByDay.get(day) }))
                      .filter(({ hours }) => !hours?.open)
                      .map(({ i }) => i);
                    if (closedIndices.includes(dayIndex)) return; // silently block closed days
                    setSelectedDate(date);
                  }}
                />
                {selectedDate && dayHours?.open && availableSlots.length === 0 && (
                  <p className="brm-hint brm-hint--warn">
                    No more slots available today — all slots have passed.
                  </p>
                )}
                  </section>
                )}

                {selectedFacility && (
                  <section className="brm-hours-preview">
                    <p className="brm-hours-title">Facility hours</p>
                    <ul className="brm-hours-list" role="list">
                      {DAYS.map((day) => {
                        const hours = hoursByDay.get(day);
                        return (
                          <li key={day} className={`brm-hours-row ${!hours?.open ? "brm-hours-row--closed" : ""}`}>
                            <span>{day}</span>
                            <span>
                              {hours?.open ? `${hours.start_time?.slice(0, 5)} - ${hours.end_time?.slice(0, 5)}` : "Closed"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {error && <p className="brm-error" role="alert">{error}</p>}
              </section>
            )}

            {step === 2 && (
              <section className="brm-body">
                <section className="brm-summary-bar">
                  <span className="brm-summary-branch">{selectedFacility?.name}</span>
                  <span className="brm-summary-sep">·</span>
                  <span>{formatBookingDate(selectedDate)}</span>
                  <button className="brm-change-btn" onClick={() => setStep(1)}>Change</button>
                </section>

                <section className="brm-field">
                  <label className="brm-label">Available slots</label>
                  {loadingSlots ? (
                    <p className="brm-hint">Checking current bookings...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="brm-hint brm-hint--warn">No bookable slots for the selected day.</p>
                  ) : (
                    <section className="brm-slots" role="group" aria-label="Available time slots">
                      {availableSlots.filter((slot) => (slotUsage[slot] || 0) < (selectedFacility?.capacity || 1)).map((slot) => {
                        const capacity = selectedFacility?.capacity || 1;
                        const usage = slotUsage[slot] || 0;
                        return (
                          <button
                            key={slot}
                            className={`brm-slot ${selectedTime === slot ? "brm-slot--selected" : ""}`}
                            onClick={() => setSelectedTime(slot)}
                            aria-pressed={selectedTime === slot}
                          >
                            <span className="brm-slot-time">{slot}</span>
                            <span className="brm-slot-range">{formatSlotLabel(slot)}</span>
                            <span className="brm-slot-capacity">{capacity - usage} left</span>
                          </button>
                        );
                      })}
                    </section>
                  )}
                </section>

                {error && <p className="brm-error" role="alert">{error}</p>}
              </section>
            )}

            <footer className="brm-footer">
              {step === 1 ? (
                <>
                  <button className="btn-export" onClick={onClose}>Cancel</button>
                  <button className="btn-primary" onClick={() => setStep(2)} disabled={!canProceedToStep2}>
                    Next →
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-export" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn-primary" onClick={handleSubmit} disabled={!selectedTime || submitting}>
                    {submitting ? "Saving..." : "Confirm Slot"}
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </section>
    </dialog>
  );
}

function TransactionBookingCard({ transaction, userId, onBook, onPay, payingId }) {
  const userIsSeller = transaction.seller_id === userId;
  const userIsBuyer = transaction.buyer_id === userId;
  const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);
  const sellerItem = transaction.requested_item || transaction.item;
  const buyerItem = transaction.offered_item || "Offered item";
  const hasRecordedPaymentStatus = transaction.payment_status !== null && transaction.payment_status !== undefined;
  const statusImpliesPaid = ["awaiting_dropoff", "item_received", "awaiting_collection", "item_released", "completed"].includes(
    transaction.status
  );
  const paymentStatus = hasRecordedPaymentStatus
    ? transaction.payment_status
    : statusImpliesPaid
      ? "paid"
      : "unpaid";
  const isClosed = ["cancelled", "completed", "item_released"].includes(transaction.status);
  const needsPayment = !isItemTrade && !isClosed && paymentStatus !== "paid";
  const canPay = userIsBuyer && needsPayment;
  const canBookDropoff = userIsSeller && !transaction.dropoff_booking && ["pending", "awaiting_dropoff"].includes(transaction.status);
  const collectionRequestReady =
    canBookCollectionForStatus(transaction.status) ||
    (transaction.status === "item_received" && Boolean(transaction.dropoff_booking));
  const canBookCollection = userIsBuyer && !transaction.collection_booking && collectionRequestReady;
  const showAwaitingDropoffNote =
    !isItemTrade && transaction.status === "awaiting_dropoff" && !transaction.dropoff_booking && paymentStatus === "paid";

  return (
    <article className="bookings-page-card">
      <header className="bookings-page-card__header">
        <section>
          <p className="bookings-page-card__eyebrow">Transaction</p>
          <h3>{transaction.item}</h3>
          {isItemTrade && (
            <p className="bookings-page-card__id">
              {sellerItem} for {buyerItem}
            </p>
          )}
          <p className="bookings-page-card__id">{transaction.id}</p>
        </section>
        <span className={`bookings-page-status bookings-page-status--${transaction.status}`}>
          {TRANSACTION_STATUS_META[transaction.status] || transaction.status}
        </span>
      </header>

      <article className="bookings-page-card__grid">
        <section>
          <p className="bookings-page-card__label">Seller</p>
          <p>{transaction.seller_profile?.display_name || transaction.seller_profile?.name || transaction.seller_id}</p>
        </section>
        <section>
          <p className="bookings-page-card__label">Buyer</p>
          <p>{transaction.buyer_profile?.display_name || transaction.buyer_profile?.name || transaction.buyer_id}</p>
        </section>
        <section>
          <p className="bookings-page-card__label">{isItemTrade ? "Trade" : "Price"}</p>
          <p>{isItemTrade ? "Item for item" : `R ${Number(transaction.price || 0).toLocaleString("en-ZA")}`}</p>
        </section>
        {!isItemTrade && (
          <section>
            <p className="bookings-page-card__label">Payment</p>
            <p>{paymentStatus === "paid" ? "Paid with PayFast sandbox" : "PayFast sandbox pending"}</p>
          </section>
        )}
        <section>
          <p className="bookings-page-card__label">Created</p>
          <p>{formatTimestampDate(transaction.created_at)}</p>
        </section>
      </article>

      {needsPayment && (
        <article className="bookings-page-card__payment">
          <section>
            <p className="bookings-page-card__label">Sandbox payment required</p>
            <p>
              PayFast sandbox uses test money only. The seller can book drop-off after the sandbox payment is confirmed.
            </p>
          </section>
          {canPay ? (
            <button
              className="btn-primary bookings-page-card__action"
              onClick={() => onPay(transaction)}
              disabled={payingId === transaction.id}
              type="button"
            >
              {payingId === transaction.id ? "Opening PayFast..." : "Pay with PayFast Sandbox"}
            </button>
          ) : (
            <p className="bookings-page-card__payment-note">
              Waiting for the buyer to complete PayFast sandbox payment.
            </p>
          )}
        </article>
      )}

      {showAwaitingDropoffNote && (
        <article className="bookings-page-card__payment bookings-page-card__payment--ready">
          <section>
            <p className="bookings-page-card__label">Payment confirmed</p>
            <p>
              {userIsSeller
                ? "Payment is confirmed. Use the drop-off section below to book a slot."
                : "Waiting for the seller to book the drop-off slot."}
            </p>
          </section>
        </article>
      )}

      <article className="bookings-page-card__bookings">
        <section className="bookings-page-card__booking">
          <p className="bookings-page-card__label">{isItemTrade ? "Seller item drop-off" : "Drop-off"}</p>
          {transaction.dropoff_booking ? (
            <p>
              {transaction.dropoff_booking.location} · {formatTimestampDate(transaction.dropoff_booking.scheduled_time)} at{" "}
              {formatTimestampTime(transaction.dropoff_booking.scheduled_time)}
            </p>
          ) : (
            <p>Not booked yet</p>
          )}
          {canBookDropoff && (
            <button className="btn-primary bookings-page-card__action" onClick={() => onBook(transaction, "dropoff")}>
              {isItemTrade ? "Book item drop-off" : "Book drop-off"}
            </button>
          )}
        </section>

        <section className="bookings-page-card__booking">
          <p className="bookings-page-card__label">{isItemTrade ? "Buyer item handover" : "Collection"}</p>
          {transaction.collection_booking ? (
            <p>
              {transaction.collection_booking.location} · {formatTimestampDate(transaction.collection_booking.scheduled_time)} at{" "}
              {formatTimestampTime(transaction.collection_booking.scheduled_time)}
            </p>
          ) : (
            <p>Not booked yet</p>
          )}
          {canBookCollection && (
            <button className="btn-primary bookings-page-card__action" onClick={() => onBook(transaction, "collection")}>
              {isItemTrade ? "Book swap handover" : "Book collection"}
            </button>
          )}
        </section>
      </article>
    </article>
  );
}

export function StudentBookingsPage({ user, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [activeBooking, setActiveBooking] = useState(null);
  const [payingId, setPayingId] = useState("");

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;

      const rows = transactionsData || [];
      const bookingIds = rows.flatMap((transaction) => [transaction.dropoff_id, transaction.collection_id]).filter(Boolean);
      const profileIds = [...new Set(rows.flatMap((transaction) => [transaction.seller_id, transaction.buyer_id]).filter(Boolean))];

      const [{ data: bookingsData }, { data: profilesData }] = await Promise.all([
        bookingIds.length
          ? supabase.from("bookings").select("*").in("id", bookingIds)
          : Promise.resolve({ data: [] }),
        profileIds.length
          ? supabase.from("profiles").select("id, name, display_name, email").in("id", profileIds)
          : Promise.resolve({ data: [] }),
      ]);

      const bookingsById = Object.fromEntries((bookingsData || []).map((booking) => [booking.id, booking]));
      const profilesById = Object.fromEntries((profilesData || []).map((profile) => [profile.id, profile]));

      setTransactions(rows.map((transaction) => ({
        ...transaction,
        dropoff_booking: transaction.dropoff_id ? bookingsById[transaction.dropoff_id] || null : null,
        collection_booking: transaction.collection_id ? bookingsById[transaction.collection_id] || null : null,
        seller_profile: profilesById[transaction.seller_id] || null,
        buyer_profile: profilesById[transaction.buyer_id] || null,
      })));
    } catch (err) {
      setError(err.message || "Failed to load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const transactionId = params.get("transaction_id");

    if (!payment) return;

    async function handlePaymentReturn() {
      if (payment === "cancelled") {
        setPaymentNotice("PayFast sandbox payment was cancelled. You can try again when ready.");
        return;
      }

      if (payment !== "success" || !transactionId) return;

      setPaymentNotice("Confirming PayFast sandbox payment...");
      try {
        const { error: functionError } = await supabase.functions.invoke("confirm-payfast-sandbox-return", {
          body: { transactionId },
        });

        if (functionError) throw functionError;

        setPaymentNotice("PayFast sandbox payment confirmed. The seller can now book drop-off.");
        await loadTransactions();
      } catch (err) {
        setPaymentNotice(getFunctionErrorMessage(err));
      }
    }

    void handlePaymentReturn();

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [loadTransactions, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`student-bookings-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (payload) => {
        const next = payload.new || payload.old;
        if (!next) return;
        if (next.seller_id === user.id || next.buyer_id === user.id) {
          loadTransactions();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        loadTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTransactions, user?.id]);

  async function handlePay(transaction) {
    if (!transaction?.id) return;
    setPayingId(transaction.id);
    setError("");

    try {
      if (!supabase.functions?.invoke) {
        throw new Error("Supabase Edge Functions are not available in this environment.");
      }

      const { data, error: functionError } = await supabase.functions.invoke("create-payfast-checkout", {
        body: { transactionId: transaction.id },
      });

      if (functionError) throw functionError;
      if (!data?.action || !data?.fields) {
        throw new Error("PayFast checkout did not return a payment form.");
      }

      submitPayfastForm(data.action, data.fields);
    } catch (err) {
      setError(getFunctionErrorMessage(err));
      setPayingId("");
    }
  }

  return (
    <section className="bookings-page">
      <header className="bookings-page__header">
        <section>
          <button className="btn-export bookings-page__back" onClick={onBack}>← Back</button>
          <p className="bookings-page__eyebrow">Trade Facility</p>
          <h1>My Bookings</h1>
          <p className="bookings-page__intro">
            Book facility slots once a transaction is ready. For item trades, the listed-item owner books the first drop-off, then the other student books the final swap handover after staff receives it.
          </p>
        </section>
      </header>

      {loading ? (
        <article className="bookings-page__empty">Loading your transactions...</article>
      ) : paymentNotice ? (
        <article className="bookings-page__notice">{paymentNotice}</article>
      ) : error ? (
        <article className="bookings-page__empty bookings-page__empty--error">{error}</article>
      ) : transactions.length === 0 ? (
        <article className="bookings-page__empty">No transactions are ready for booking yet.</article>
      ) : (
        <article className="bookings-page__list">
          {transactions.map((transaction) => (
            <TransactionBookingCard
              key={transaction.id}
              transaction={transaction}
              userId={user.id}
              onBook={(selectedTransaction, bookingType) => setActiveBooking({ transaction: selectedTransaction, bookingType })}
              onPay={handlePay}
              payingId={payingId}
            />
          ))}
        </article>
      )}

      {activeBooking && (
        <BookingRequestModal
          transaction={activeBooking.transaction}
          bookingType={activeBooking.bookingType}
          onClose={() => setActiveBooking(null)}
          onSuccess={() => {
            setActiveBooking(null);
            loadTransactions();
          }}
        />
      )}
    </section>
  );
}

export default BookingRequestModal;
