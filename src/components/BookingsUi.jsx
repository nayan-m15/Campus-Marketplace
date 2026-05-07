import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import "../styles/BookingsUi.css";
import {
  buildBookingId,
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

function StepIndicator({ step }) {
  return (
    <div className="brm-steps" role="list" aria-label="Booking steps">
      {["Facility & Date", "Time & Confirm"].map((label, index) => {
        const itemStep = index + 1;
        const active = step >= itemStep;
        const current = step === itemStep;
        return (
          <div key={label} className="brm-step-group" role="listitem">
            {index > 0 && <div className={`brm-step-line ${active ? "brm-step-line--active" : ""}`} />}
            <div className={`brm-step ${active ? "brm-step--active" : ""} ${current ? "brm-step--current" : ""}`}>
              <span className="brm-step-num" aria-hidden="true">{active && step > itemStep ? "✓" : itemStep}</span>
              <span className="brm-step-label">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SuccessView({ bookingType, facilityName, selectedDate, selectedTime, onClose }) {
  return (
    <div className="brm-success">
      <div className="brm-success-icon" aria-hidden="true">✓</div>
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
    </div>
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
    const bookingId = buildBookingId(bookingType === "dropoff" ? "DO" : "CL");
    const bookingColumn = bookingType === "dropoff" ? "dropoff_id" : "collection_id";
    const bookingStatus = "pending_approval";
    try {
      const existingBookingId = bookingType === "dropoff" ? transaction.dropoff_id : transaction.collection_id;

      if (existingBookingId) {
        const { error: updateBookingError } = await supabase
          .from("bookings")
          .update({
            scheduled_time: scheduledTime,
            location: selectedFacility.name,
            type: bookingType,
            status: bookingStatus,
          })
          .eq("id", existingBookingId);

        if (updateBookingError) throw updateBookingError;

        const { error: updateTransactionError } = await supabase
          .from("transactions")
          .update({
            [bookingColumn]: existingBookingId,
          })
          .eq("id", transaction.id);

        if (updateTransactionError) throw updateTransactionError;
      } else {
        const { error: insertBookingError } = await supabase
          .from("bookings")
          .insert({
            id: bookingId,
            type: bookingType,
            scheduled_time: scheduledTime,
            location: selectedFacility.name,
            status: bookingStatus,
          });

        if (insertBookingError) throw insertBookingError;

        const { error: updateTransactionError } = await supabase
          .from("transactions")
          .update({
            [bookingColumn]: bookingId,
          })
          .eq("id", transaction.id);

        if (updateTransactionError) throw updateTransactionError;
      }

      onSuccess?.({
        scheduledTime,
        bookingType,
        bookingId: existingBookingId || bookingId,
        transactionId: transaction.id,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || "Unable to save the booking.");
    } finally {
      setSubmitting(false);
    }
  }

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
            <header className="brm-header">
              <span className="brm-header-icon" aria-hidden="true">
                {bookingType === "dropoff" ? "📥" : "📦"}
              </span>
              <div className="brm-header-text">
                <h2 className="brm-title">
                  Book {bookingType === "dropoff" ? "Drop-off" : "Collection"} Slot
                </h2>
                <p className="brm-subtitle">{transaction.item} · {transaction.id}</p>
              </div>
              <button className="brm-close-btn" onClick={onClose} aria-label="Close dialog">×</button>
            </header>

            <StepIndicator step={step} />

            {step === 1 && (
              <div className="brm-body">
                <div className="brm-field">
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
                </div>

                {selectedFacility && (
                  <div className="brm-field">
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
                  </div>
                )}

                {selectedFacility && (
                  <div className="brm-hours-preview">
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
                  </div>
                )}

                {error && <p className="brm-error" role="alert">{error}</p>}
              </div>
            )}

            {step === 2 && (
              <div className="brm-body">
                <div className="brm-summary-bar">
                  <span className="brm-summary-branch">{selectedFacility?.name}</span>
                  <span className="brm-summary-sep">·</span>
                  <span>{formatBookingDate(selectedDate)}</span>
                  <button className="brm-change-btn" onClick={() => setStep(1)}>Change</button>
                </div>

                <div className="brm-field">
                  <label className="brm-label">Available slots</label>
                  {loadingSlots ? (
                    <p className="brm-hint">Checking current bookings...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="brm-hint brm-hint--warn">No bookable slots for the selected day.</p>
                  ) : (
                    <div className="brm-slots" role="group" aria-label="Available time slots">
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
                    </div>
                  )}
                </div>

                {error && <p className="brm-error" role="alert">{error}</p>}
              </div>
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
      </div>
    </dialog>
  );
}

function TransactionBookingCard({ transaction, userId, onBook }) {
  const userIsSeller = transaction.seller_id === userId;
  const userIsBuyer = transaction.buyer_id === userId;
  const canBookDropoff = userIsSeller && !transaction.dropoff_booking && ["pending", "awaiting_dropoff"].includes(transaction.status);
  const collectionRequestReady =
    canBookCollectionForStatus(transaction.status) ||
    (transaction.status === "item_received" && Boolean(transaction.dropoff_booking));
  const canBookCollection = userIsBuyer && !transaction.collection_booking && collectionRequestReady;

  return (
    <article className="bookings-page-card">
      <header className="bookings-page-card__header">
        <div>
          <p className="bookings-page-card__eyebrow">Transaction</p>
          <h3>{transaction.item}</h3>
          <p className="bookings-page-card__id">{transaction.id}</p>
        </div>
        <span className={`bookings-page-status bookings-page-status--${transaction.status}`}>
          {TRANSACTION_STATUS_META[transaction.status] || transaction.status}
        </span>
      </header>

      <div className="bookings-page-card__grid">
        <div>
          <p className="bookings-page-card__label">Seller</p>
          <p>{transaction.seller_profile?.display_name || transaction.seller_profile?.name || transaction.seller_id}</p>
        </div>
        <div>
          <p className="bookings-page-card__label">Buyer</p>
          <p>{transaction.buyer_profile?.display_name || transaction.buyer_profile?.name || transaction.buyer_id}</p>
        </div>
        <div>
          <p className="bookings-page-card__label">Price</p>
          <p>R {Number(transaction.price || 0).toLocaleString("en-ZA")}</p>
        </div>
        <div>
          <p className="bookings-page-card__label">Created</p>
          <p>{formatTimestampDate(transaction.created_at)}</p>
        </div>
      </div>

      <div className="bookings-page-card__bookings">
        <section className="bookings-page-card__booking">
          <p className="bookings-page-card__label">Drop-off</p>
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
              Book drop-off
            </button>
          )}
        </section>

        <section className="bookings-page-card__booking">
          <p className="bookings-page-card__label">Collection</p>
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
              Book collection
            </button>
          )}
        </section>
      </div>
    </article>
  );
}

export function StudentBookingsPage({ user, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBooking, setActiveBooking] = useState(null);

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

  return (
    <section className="bookings-page">
      <header className="bookings-page__header">
        <div>
          <button className="btn-export bookings-page__back" onClick={onBack}>← Back</button>
          <p className="bookings-page__eyebrow">Trade Facility</p>
          <h1>My Bookings</h1>
          <p className="bookings-page__intro">
            Book your drop-off and collection slots once a transaction is ready. Sellers book drop-off first, then buyers book collection after the item is received.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="bookings-page__empty">Loading your transactions...</div>
      ) : error ? (
        <div className="bookings-page__empty bookings-page__empty--error">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="bookings-page__empty">No transactions are ready for booking yet.</div>
      ) : (
        <div className="bookings-page__list">
          {transactions.map((transaction) => (
            <TransactionBookingCard
              key={transaction.id}
              transaction={transaction}
              userId={user.id}
              onBook={(selectedTransaction, bookingType) => setActiveBooking({ transaction: selectedTransaction, bookingType })}
            />
          ))}
        </div>
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
