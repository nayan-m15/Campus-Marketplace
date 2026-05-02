// Main structure for the app feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useRef, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/NavBar";
import Hero from "./components/Hero";
import CategoryBar from "./components/FilterBar.jsx";
import ListingsGrid from "./components/ListingsGrid";
import Footer from "./components/Footer";
import LoginPage from "./components/LoginPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import SignupPage from "./components/SignupPage";
import ProfilePage from "./components/ProfilePage";
import PublicProfilePage from "./components/PublicProfilePage";
import ProfileSetupPage from "./components/ProfileSetupPage";
import MessagesPage from "./components/MessagesPage";
import AdminDashboard from "./components/AdminDashboard.jsx";
import WishlistPage from "./components/WishlistPage";
import { fetchListings, CONDITIONS } from "./data/listings";
import "./styles/index.css";
import ListingForm from "./components/ListingForm";
import { supabase } from "./supabaseClient";
import TradeFacilityDashboard from "./components/TradeFacilityDashboard";
import YourListingsPage from "./components/YourListingsPage";
import { useWishlist } from "./context/useWishlist";
import SettingsPage from "./components/SettingsPage";
import { getAppBaseUrl } from "./utils/appUrl";
import { insertMessage } from "./utils/messageDelivery";
import { StudentBookingsPage } from "./components/BookingsUi";

const REQUIRED_PROFILE_FIELDS = ["name", "sex", "birthdate", "province", "institution"];

// Quick guard logic sits here for this decision point.
// The check keeps the rest of the flow cleaner to read.
function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => !!profile[f]);
}

// ── Unread message count hook ──────────────────────────────
function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function showBrowserNotification(title, options) {
  if (!canUseBrowserNotifications() || window.Notification.permission !== "granted") return false;
  new window.Notification(title, options);
  return true;
}

function warningToastStyle(top = 20) {
  return {
    position: "fixed",
    top,
    right: 20,
    width: "min(420px, calc(100vw - 32px))",
    textAlign: "left",
    background: "#fff7ed",
    color: "#7c2d12",
    padding: "16px 18px",
    borderRadius: 12,
    border: "1px solid #fdba74",
    zIndex: 10000,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
    fontFamily: "var(--font)",
  };
}

async function buildIncomingMessageNotice(message) {
  let senderName = "Someone";
  let listingTitle = null;

  const { data: sender } = await supabase
    .from("profiles")
    .select("display_name, name")
    .eq("id", message.sender_id)
    .single();

  if (sender?.display_name || sender?.name) {
    senderName = sender.display_name || sender.name;
  }

  if (message.listing_id) {
    const { data: listing } = await supabase
      .from("listings")
      .select("title")
      .eq("id", message.listing_id)
      .single();
    listingTitle = listing?.title || null;
  }

  return {
    title: listingTitle ? `${senderName} messaged about ${listingTitle}` : `New message from ${senderName}`,
    body: message.content || "Open Campus Marketplace to reply.",
  };
}

async function fetchNotificationPrefs(userId, fallback) {
  const { data } = await supabase
    .from("profiles")
    .select("notif_messages, notif_listing_activity")
    .eq("id", userId)
    .single();

  if (!data) return fallback;

  return {
    notif_messages: data.notif_messages !== false,
    notif_listing_activity: data.notif_listing_activity !== false,
  };
}

// Related state and side effects are grouped in this hook.
// That keeps the surrounding component easier to follow.
function useUnreadCount(user, onIncomingMessage) {
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationPrefsRef = useRef({
    notif_messages: true,
    notif_listing_activity: true,
  });

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .eq("is_deleted", false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("notif_messages, notif_listing_activity")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        notificationPrefsRef.current = {
          notif_messages: data.notif_messages !== false,
          notif_listing_activity: data.notif_listing_activity !== false,
        };
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("navbar-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        if (payload.new.receiver_id === user.id) {
          setUnreadCount((prev) => prev + 1);

          fetchNotificationPrefs(user.id, notificationPrefsRef.current)
            .then((prefs) => {
              notificationPrefsRef.current = prefs;
              const isListingMessage = Boolean(payload.new.listing_id);
              const shouldNotify = isListingMessage
                ? prefs.notif_listing_activity || prefs.notif_messages
                : prefs.notif_messages;

              if (!shouldNotify) return null;
              return buildIncomingMessageNotice(payload.new);
            })
            .then((notice) => {
              if (!notice) return;
              const shownInBrowser = showBrowserNotification(notice.title, {
                body: notice.body,
                tag: `message-${payload.new.id}`,
              });
              onIncomingMessage?.({ ...notice, browser: shownInBrowser });
            })
            .catch(() => {
              onIncomingMessage?.({
                title: "New message",
                body: payload.new.content || "Open Campus Marketplace to reply.",
                browser: false,
              });
            });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, onIncomingMessage]);

  return [unreadCount, setUnreadCount];
}

// ── Item Details Modal ─────────────────────────────────────
function ListingDetailsModal({
  item,
  onClose,
  onMessageSeller,
  user,
  isWishlisted,
  onToggleWishlist,
  resolveListingForMessaging,
}) {
  const [message, setMessage] = useState(`Hi, is the ${item?.title || "item"} still available?`);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [flaggedWarningItem, setFlaggedWarningItem] = useState(null);

  useEffect(() => {
    if (item) {
      setMessage(`Hi, is the ${item.title || "item"} still available?`);
      setCurrentImageIndex(0);
      setFlaggedWarningItem(null);
    }
  }, [item?.id]);

  useEffect(() => {
    // User-driven changes pass through this handler first.
    // State updates and follow-up UI actions are triggered here.
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    if (item) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      setSendError("");
      setSendSuccess("");
    };
  }, [item, onClose]);

  if (!item) return null;

  const images =
    Array.isArray(item.image_urls) && item.image_urls.length > 0
      ? item.image_urls
      : item.image_url
        ? [item.image_url]
        : [];

  const activeImage = images[currentImageIndex] || images[0] || null;
  const wishlisted = isWishlisted?.(item.id) ?? false;
  const joinedLabel =
    item.joined_label || (item.joined_year ? String(item.joined_year) : "Not provided");

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function showPreviousImage() {
    if (images.length <= 1) return;
    setCurrentImageIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  }

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function showNextImage() {
    if (images.length <= 1) return;
    setCurrentImageIndex((index) => (index === images.length - 1 ? 0 : index + 1));
  }

  async function performSendMessage() {
    if (!message.trim()) { setSendError("Please enter a message."); setSendSuccess(""); return; }
    if (!user) { setSendError("You must be logged in to send a message."); setSendSuccess(""); return; }
    if (!item.user_id) { setSendError("Seller information is missing."); setSendSuccess(""); return; }
    if (user.id === item.user_id) { setSendError("You cannot message yourself about your own listing."); setSendSuccess(""); return; }

    setSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      const { error } = await insertMessage({
        sender_id: user.id,
        receiver_id: item.user_id,
        content: message.trim(),
        listing_id: item.id,
      });
      if (error) throw new Error(error.message);
      setMessage("");
      setSendSuccess("Message sent! Opening conversation...");
      setTimeout(() => { onClose(); onMessageSeller(item); }, 1000);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendMessage() {
    const latestItem = await resolveListingForMessaging?.(item) || item;
    if (latestItem?.status === "flagged") {
      setFlaggedWarningItem(latestItem);
      return;
    }

    performSendMessage();
  }

  return (
    <>
      <div className="item-modal-overlay" onClick={onClose}>
        <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close item details" type="button">x</button>

        <div className="item-modal-scroll">
          <div className="item-modal-scroll-inner">
            <section className="item-modal-layout">
              <div className="item-modal-right-column item-modal-right-column--full">
                <div className="item-modal-top-card">
                  <div className="item-modal-top-main">
                    <div className="item-modal-carousel">
                      <div className="item-modal-carousel__frame">
                        {images.length > 1 && (
                          <>
                            <button type="button" className="item-modal-carousel__nav item-modal-carousel__nav--prev" onClick={showPreviousImage} aria-label="Show previous image">{"<"}</button>
                            <button type="button" className="item-modal-carousel__nav item-modal-carousel__nav--next" onClick={showNextImage} aria-label="Show next image">{">"}</button>
                          </>
                        )}

                        {activeImage ? (
                          <img src={activeImage} alt={item.title || "Listing image"} className="item-modal-top-image" />
                        ) : (
                          <div className="item-modal-top-placeholder"><span>{item.emoji || "No Image"}</span></div>
                        )}
                      </div>

                      {images.length > 1 && (
                        <div className="item-modal-carousel__dots" aria-label="Image navigation">
                          {images.map((image, index) => (
                            <button
                              key={`${image}-${index}`}
                              type="button"
                              className={`item-modal-carousel__dot${index === currentImageIndex ? " item-modal-carousel__dot--active" : ""}`}
                              onClick={() => setCurrentImageIndex(index)}
                              aria-label={`Show image ${index + 1}`}
                              aria-pressed={index === currentImageIndex}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="item-modal-top-bottom">
                      <div className="item-modal-top-text">
                        <h2 className="item-modal-title">{item.title || "Untitled listing"}</h2>

                        {item.status === "flagged" && (
                          <p className="item-modal-error" style={{ marginBottom: 0 }}>
                            This listing has been flagged by an admin. Please review it carefully before continuing.
                          </p>
                        )}

                        <div className="item-modal-summary">
                          <p className="item-modal-price">
                            {item.pricePrefix && <span className="item-modal-price-prefix">{item.pricePrefix} </span>}
                            {item.price || "Price not available"}
                          </p>
                          <span className="item-modal-condition">{item.condition || "Good"}</span>
                        </div>

                        {user && onToggleWishlist && (
                          <button
                            type="button"
                            className={`item-modal-wishlist-btn${wishlisted ? " item-modal-wishlist-btn--active" : ""}`}
                            onClick={() => onToggleWishlist(item.id)}
                            aria-pressed={wishlisted}
                            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                          >
                            {wishlisted ? "Saved" : "Save to Wishlist"}
                          </button>
                        )}
                      </div>

                      <div className="item-modal-description-card">
                        <h3>Description</h3>
                        <p>{item.description?.trim() || "No description provided."}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="item-modal-bottom-card">
                  <div className="item-modal-info">
                    <div className="item-modal-meta">
                      <p><strong>Seller:</strong> {item.seller || "Unknown seller"}</p>
                      <p><strong>Institution:</strong> {item.institution || "Institution not provided"}</p>
                      <p><strong>Joined since:</strong> {joinedLabel}</p>
                      {item.category && <p><strong>Category:</strong> {item.category}</p>}
                      <p><strong>Distance:</strong> {item.distance || "0 km"}</p>
                    </div>
                  </div>

                  <div className="item-modal-contact">
                    <h3>Message seller</h3>
                    {!user ? (
                      <p className="item-modal-error">Please <strong>log in</strong> to message this seller.</p>
                    ) : (
                      <>
                        <textarea className="item-modal-textarea" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                        {sendError && <p className="item-modal-error">{sendError}</p>}
                        {sendSuccess && <p className="item-modal-success">{sendSuccess}</p>}
                        <div className="item-modal-actions">
                          <button type="button" className="item-modal-send-btn" onClick={handleSendMessage} disabled={sending}>
                            {sending ? "Sending..." : "Send message"}
                          </button>
                          <button
                            type="button"
                            className="item-modal-send-btn item-modal-send-btn--secondary"
                            onClick={async () => {
                              const latestItem = await resolveListingForMessaging?.(item) || item;
                              onClose();
                              onMessageSeller(latestItem);
                            }}
                          >
                            Open chat
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        </article>
      </div>
      {flaggedWarningItem && (
        <aside
          role="alertdialog"
          aria-labelledby="listing-flagged-warning-title"
          aria-live="assertive"
          style={warningToastStyle(24)}
        >
          <button
            onClick={() => setFlaggedWarningItem(null)}
            aria-label="Close flagged warning"
            type="button"
            style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >
            x
          </button>
          <h2 id="listing-flagged-warning-title" style={{ margin: "0 28px 8px 0", fontSize: 20 }}>
            Flagged listing warning
          </h2>
          <p style={{ margin: "0 0 8px" }}>This listing has been flagged by an admin.</p>
          <p style={{ margin: "0 0 16px" }}>
            <strong>Reason:</strong> {flaggedWarningItem.flag_reason?.trim() || "No reason was provided."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              className="item-modal-send-btn item-modal-send-btn--secondary"
              onClick={() => setFlaggedWarningItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="item-modal-send-btn"
              onClick={() => {
                setFlaggedWarningItem(null);
                performSendMessage();
              }}
            >
              Continue
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

function ModerationModal({
  item,
  actionState,
  moderationReason,
  onReasonChange,
  onClose,
  onFlagListing,
  onRemoveListing,
}) {
  if (!item) return null;

  return (
    <div className="item-modal-overlay" onClick={onClose}>
      <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close moderation panel" type="button">x</button>

        <div className="item-modal-scroll">
          <div className="item-modal-scroll-inner">
            <section className="item-modal-layout">
              <div className="item-modal-right-column item-modal-right-column--full">
                <div className="item-modal-top-card">
                  <div className="item-modal-top-text">
                    <h2 className="item-modal-title">Review moderation</h2>
                    <div className="item-modal-description-card">
                      <p>
                        Moderate listing safety for <strong>{item.title}</strong>. Use <strong>Flag listing</strong> to warn buyers that this listing needs caution, or <strong>Remove listing</strong> to take it down entirely.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="item-modal-bottom-card">
                  <div className="item-modal-info">
                    <div className="item-modal-meta">
                      <p><strong>Seller:</strong> {item.seller || "Unknown seller"}</p>
                      <p><strong>Institution:</strong> {item.institution || "Institution not provided"}</p>
                      <p><strong>Status:</strong> {item.status || "active"}</p>
                    </div>
                  </div>

                  <div className="item-modal-contact">
                    <h3>Moderation actions</h3>
                    <label className="profile-field" style={{ display: "block", marginBottom: 14 }}>
                      <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Flag reason</span>
                      <textarea
                        className="item-modal-textarea"
                        value={moderationReason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        rows={4}
                        placeholder="Explain why this listing is being flagged."
                        style={{ marginBottom: 0 }}
                      />
                    </label>
                    {actionState.error && <p className="item-modal-error">{actionState.error}</p>}
                    {actionState.success && <p className="item-modal-success">{actionState.success}</p>}
                    <div className="item-modal-actions">
                      <button
                        type="button"
                        className="item-modal-send-btn"
                        onClick={() => onFlagListing(item)}
                        disabled={Boolean(actionState.loading)}
                      >
                        {actionState.loading === "flag" ? "Flagging..." : "Flag listing"}
                      </button>
                      <button
                        type="button"
                        className="item-modal-send-btn item-modal-send-btn--secondary"
                        onClick={() => onRemoveListing(item)}
                        disabled={Boolean(actionState.loading)}
                      >
                        {actionState.loading === "remove" ? "Removing..." : "Remove listing"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </article>
    </div>
  );
}

function FlaggedListingWarningToast({ item, onClose, onContinue }) {
  if (!item) return null;

  return (
    <aside
      role="alertdialog"
      aria-labelledby="flagged-listing-warning-title"
      aria-live="assertive"
      style={warningToastStyle()}
    >
      <button
        onClick={onClose}
        aria-label="Close flagged listing warning"
        type="button"
        style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
      >
        x
      </button>
      <h2 id="flagged-listing-warning-title" style={{ margin: "0 28px 8px 0", fontSize: 20 }}>
        Flagged listing warning
      </h2>
      <p style={{ margin: "0 0 8px" }}>This listing has been flagged by an admin.</p>
      <p style={{ margin: "0 0 16px" }}>
        <strong>Reason:</strong> {item.flag_reason?.trim() || "No reason was provided."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="item-modal-send-btn item-modal-send-btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="item-modal-send-btn" onClick={onContinue}>
          Continue
        </button>
      </div>
    </aside>
  );
}
// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
function AppInner() {
  const { user, loading, signOut, isPasswordRecovery, clearPasswordRecovery } = useAuth();

  const [page, setPage] = useState("home");
  const skipHistoryPushRef = useRef(false);
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [activeCondition, setActiveCondition] = useState("All Conditions");
  const [priceSort, setPriceSort] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [moderationListing, setModerationListing] = useState(null);
  const [flaggedListingPrompt, setFlaggedListingPrompt] = useState(null);
  const [acknowledgedFlaggedListingId, setAcknowledgedFlaggedListingId] = useState(null);
  const [moderationState, setModerationState] = useState({
    loading: "",
    success: "",
    error: "",
  });
  const [moderationReason, setModerationReason] = useState("");

  const [allListings, setAllListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState(null);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [msgRecipientId, setMsgRecipientId] = useState(null);
  const [msgListingTitle, setMsgListingTitle] = useState(null);
  const [msgListingId, setMsgListingId] = useState(null);
  const [messageNotice, setMessageNotice] = useState(null);

  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);

  // ── Unread message count for navbar badge ─────────────────
  const handleIncomingMessage = useCallback((notice) => {
    setMessageNotice(notice);
    setTimeout(() => setMessageNotice(null), 5000);
  }, []);

  const [unreadCount, setUnreadCount] = useUnreadCount(user, handleIncomingMessage);
  const { wishlistItems, isWishlisted, toggleWishlist, loading: wishlistLoading } = useWishlist(user);

  // ── Refs for the filter bar and listings section so CTA/search can scroll cleanly ──
  const filterBarRef = useRef(null);
  const listingsSectionRef = useRef(null);

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleScrollToListings() {
    if (!filterBarRef.current || !listingsSectionRef.current) return;

    const navbarOffset = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--navbar-height"),
    ) || 64;
    const filterBarHeight = filterBarRef.current.getBoundingClientRect().height;
    const isDesktopSidebar =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches;
    const listingsTop =
      listingsSectionRef.current.getBoundingClientRect().top +
      window.scrollY -
      navbarOffset -
      (isDesktopSidebar ? 20 : filterBarHeight);

    window.scrollTo({
      top: Math.max(listingsTop, 0),
      behavior: "smooth",
    });
  }

  // ── Public profile state ───────────────────────────────────
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [prevPage, setPrevPage] = useState("home");

  useEffect(() => {
    const currentState = window.history.state || {};
    if (currentState.page !== "home") {
      window.history.replaceState({ ...currentState, page: "home" }, "");
    }

    // User-driven changes pass through this handler first.
    // State updates and follow-up UI actions are triggered here.
    function handlePopState(event) {
      skipHistoryPushRef.current = true;
      setPage(event.state?.page || "home");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const currentState = window.history.state || {};

    if (skipHistoryPushRef.current) {
      skipHistoryPushRef.current = false;
      return;
    }

    if (currentState.page === page) return;
    window.history.pushState({ ...currentState, page }, "");
  }, [page]);

  useEffect(() => {
    if (loading) return;
    fetchListings(user?.id)
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, [user?.id, loading]);

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      setNeedsSetup(false);
      setAvatarUrl(null);
      setIsAdmin(false);
      setIsStaff(false);
      setCurrentProfile(null);
      return;
    }

    supabase
      .from("profiles")
      .select("id, name, display_name, avatar_url, role, sex, birthdate, province, institution, email")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url || null);
          setProfileName(data.display_name || data.name || null);
          setIsAdmin(data.role === "admin");
          setIsStaff(data.role === "staff");
          setNeedsSetup(!isProfileComplete(data));
          setCurrentProfile(data);
        } else {
          setNeedsSetup(true);
          setCurrentProfile(null);
        }
        setProfileChecked(true);
      })
      .catch(() => setProfileChecked(true));
  }, [user]);

  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function numericPrice(item) {
    if (!item?.price) return 0;
    const n = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  const filteredListings = (() => {
    let result = allListings.filter((item) => {
      if (item.status === "sold") return false;
      const searchMatch = searchQuery.trim()
        ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const categoryMatch =
        searchQuery.trim() || activeCategory === "All Items"
          ? true
          : item.category === activeCategory;

      const conditionMatch =
        activeCondition === "All Conditions" || item.condition === activeCondition;

      const minOk =
        priceSort !== "custom" ||
        priceRange.min === "" ||
        numericPrice(item) >= Number(priceRange.min);

      const maxOk =
        priceSort !== "custom" ||
        priceRange.max === "" ||
        numericPrice(item) <= Number(priceRange.max);

      return searchMatch && categoryMatch && conditionMatch && minOk && maxOk;
    });

    if (priceSort === "price_asc")      result = [...result].sort((a, b) => numericPrice(a) - numericPrice(b));
    if (priceSort === "price_desc")     result = [...result].sort((a, b) => numericPrice(b) - numericPrice(a));
    if (priceSort === "condition_asc")  result = [...result].sort((a, b) => CONDITIONS.indexOf(b.condition) - CONDITIONS.indexOf(a.condition));
    if (priceSort === "condition_desc") result = [...result].sort((a, b) => CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition));
    if (priceSort === "newest")         result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return result;
  })();

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSearchQuery("");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleClearFilters() {
    setActiveCondition("All Conditions");
    setPriceRange({ min: "", max: "" });
    setPriceSort("");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleAuthNavigate(target) {
    setPage(target === "home" ? "home" : target);
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleListingSuccess() {
    setShowForm(false);
    setSuccessMessage("🎉 Your listing has been published!");
    setTimeout(() => setSuccessMessage(null), 4000);
    fetchListings(user?.id)
      .then(setAllListings)
      .catch((err) => setListingsError(err.message));
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function openMessagesForListing(item, { acknowledged = false } = {}) {
    if (acknowledged && item?.id) {
      setAcknowledgedFlaggedListingId(item.id);
    } else {
      setAcknowledgedFlaggedListingId(null);
    }

    if (!user) {
      setPage("login");
      return;
    }
    setMsgRecipientId(item.user_id || null);
    setMsgListingTitle(item.title);
    setMsgListingId(item.id || null);
    setPage("messages");
  }

  async function resolveListingForMessaging(item) {
    if (!item?.id) return item;

    try {
      const { data: latestListing, error } = await supabase
        .from("listings")
        .select("id, title, user_id, status, flag_reason")
        .eq("id", item.id)
        .maybeSingle();

      if (error || !latestListing) return item;

      return {
        ...item,
        ...latestListing,
        flag_reason: latestListing.flag_reason ?? item.flag_reason ?? "",
        status: latestListing.status ?? item.status ?? "active",
      };
    } catch {
      return item;
    }
  }

  async function handleMessageSeller(item) {
    const latestItem = await resolveListingForMessaging(item);
    if (latestItem?.status === "flagged") {
      setFlaggedListingPrompt(latestItem);
      return;
    }

    openMessagesForListing(latestItem);
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleSellerClick(sellerId) {
    if (user && sellerId === user.id) {
      setPage("profile");
      return;
    }
    setPrevPage("home");
    setPublicProfileId(sellerId);
    setPage("publicProfile");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleSetupComplete() {
    setNeedsSetup(false);
    setPage("home");
  }

  // Supporting logic for the go home flow is kept here.
  // Breaking it out makes the file easier to scan and maintain.
  function goHome() {
    setPage("home");
    setSearchQuery("");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleAccountDeleted() {
    setPage("home");
    setSearchQuery("");
    setSelectedListing(null);
    setShowForm(false);
    setMsgRecipientId(null);
    setMsgListingTitle(null);
    setMsgListingId(null);
    setPublicProfileId(null);
    setPrevPage("home");
    window.location.assign(getAppBaseUrl());
  }

  function handlePasswordResetComplete() {
    clearPasswordRecovery();
    setPage("home");
    window.history.replaceState(
      { ...(window.history.state || {}), page: "home" },
      "",
      window.location.pathname
    );
  }

  function handleOpenModeration(item) {
    setModerationListing(item);
    setModerationReason(item.flag_reason || "");
    setModerationState({ loading: "", success: "", error: "" });
  }

  async function refreshListings() {
    const listings = await fetchListings(user?.id);
    setAllListings(listings);
  }

  async function handleFlagListing(item) {
    const reason = moderationReason.trim();
    if (!reason) {
      setModerationState({
        loading: "",
        success: "",
        error: "Please enter a reason before flagging this listing.",
      });
      return;
    }

    setModerationState({ loading: "flag", success: "", error: "" });

    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "flagged", flag_reason: reason })
        .eq("id", item.id);

      if (error) throw error;

      await refreshListings();
      setModerationState({
        loading: "",
        success: "Listing flagged. Buyers will now see a warning on it.",
        error: "",
      });
    } catch (err) {
      setModerationState({
        loading: "",
        success: "",
        error: err.message || "Could not flag this listing.",
      });
    }
  }

  async function handleRemoveListing(item) {
    setModerationState({ loading: "remove", success: "", error: "" });

    try {
      const relatedTables = ["messages", "offers", "ratings", "wishlists"];

      for (const table of relatedTables) {
        const { error: relatedError } = await supabase
          .from(table)
          .delete()
          .eq("listing_id", item.id);

        if (relatedError) throw relatedError;
      }

      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      await refreshListings();
      setModerationState({
        loading: "",
        success: "Listing removed.",
        error: "",
      });
      setModerationListing(null);
    } catch (err) {
      setModerationState({
        loading: "",
        success: "",
        error: err.message || "Could not remove this listing.",
      });
    }
  }

  useEffect(() => {
    if (loading || !user || (page !== "login" && page !== "signup")) return;

    skipHistoryPushRef.current = true;
    setPage("home");
    window.history.replaceState({ ...(window.history.state || {}), page: "home" }, "");
  }, [loading, user, page]);

  if (loading || (user && !profileChecked)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
        Loading…
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordPage onComplete={handlePasswordResetComplete} />;
  }

  if (page === "login") return <LoginPage onNavigate={handleAuthNavigate} />;
  if (page === "signup") return <SignupPage onNavigate={handleAuthNavigate} />;

  if (user && needsSetup) return <ProfileSetupPage onComplete={handleSetupComplete} />;
  if (user && needsSetup) return <ProfileSetupPage onComplete={handleSetupComplete} />;
  if (user && isStaff) return <TradeFacilityDashboard onSignOut={signOut} staffProfile={currentProfile} />;
  if (user && isAdmin && page === "admin") {
    return <AdminDashboard onSignOut={signOut} onBackToMarketplace={goHome} />;
  }


  const navbarProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    onSearchFocus: handleScrollToListings,
    user,
    avatarUrl,
    profile: {
      display_name: profileName,
    },
    onLogin: () => setPage("login"),
    onSignup: () => setPage("signup"),
    onShowListingForm: () => { goHome(); setShowForm(true); },
    onProfile: () => setPage("profile"),
    onMessages: () => {
      setMsgRecipientId(null);
      setMsgListingTitle(null);
      setMsgListingId(null);
      setPage("messages");
    },
    onSignOut: signOut,
    onHome: goHome,
    onYourListings: () => setPage("yourlistings"),
    onBookings: () => setPage("bookings"),
    onWishlist: () => setPage("wishlist"),
    wishlistCount: wishlistItems.length,
    onSettings: () => setPage("settings"),
    unreadCount,
    isAdmin,
    onAdminDashboard: () => setPage("admin"),
  };

  const messageNoticeToast = messageNotice && (
    <button
      type="button"
      onClick={() => {
        setMessageNotice(null);
        setMsgRecipientId(null);
        setMsgListingTitle(null);
        setMsgListingId(null);
        setPage("messages");
      }}
      style={{ position: "fixed", top: 20, right: 20, maxWidth: 320, textAlign: "left", background: "var(--gray-900)", color: "#fff", padding: "12px 16px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", cursor: "pointer", fontFamily: "var(--font)" }}
      aria-label="Open new message notification"
    >
      <span style={{ display: "block", marginBottom: 4 }}>{messageNotice.title}</span>
      <span style={{ display: "block", fontWeight: 400, opacity: 0.88 }}>{messageNotice.body}</span>
    </button>
  );

  if (page === "profile") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <ProfilePage onBack={goHome} onAvatarChange={setAvatarUrl} onNameChange={setProfileName} />
      </>
    );
  }

  if (page === "publicProfile" && publicProfileId) {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <PublicProfilePage
          userId={publicProfileId}
          onBack={() => setPage(prevPage)}
          onMessageSeller={
            user
              ? () => {
                  setMsgRecipientId(publicProfileId);
                  setMsgListingTitle(null);
                  setMsgListingId(null);
                  setPage("messages");
                }
              : null
          }
        />
      </>
    );
  }

  if (page === "messages") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          initialListingId={msgListingId}
          initialAcknowledgedFlaggedListingId={acknowledgedFlaggedListingId}
          onBack={() => {
            setMsgRecipientId(null);
            setMsgListingTitle(null);
            setMsgListingId(null);
            setAcknowledgedFlaggedListingId(null);
            goHome();
          }}
          onViewProfile={(sellerId) => {
            setPrevPage("messages");
            setPublicProfileId(sellerId);
            setPage("publicProfile");
          }}
          onUnreadChange={setUnreadCount}
        />
      </>
    );
  }

  if (page === "yourlistings") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <YourListingsPage
          onBack={goHome}
          onListingChanged={() =>
            fetchListings(user?.id)
              .then(setAllListings)
              .catch((err) => setListingsError(err.message))
          }
        />
      </>
    );
  }

  if (page === "bookings") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <StudentBookingsPage user={user} onBack={goHome} />
      </>
    );
  }

  // ── Wishlist page ──────────────────────────────────────────
  if (page === "wishlist") {
    return (
      <>
        <header><Navbar {...navbarProps} /></header>
        {messageNoticeToast}
        <WishlistPage
          wishlistItems={wishlistItems}
          loading={wishlistLoading}
          onListingClick={(item) => {
            setSelectedListing(item);
          }}
          onToggleWishlist={toggleWishlist}
        />
        <ListingDetailsModal
          item={selectedListing}
          onClose={() => setSelectedListing(null)}
          onMessageSeller={handleMessageSeller}
          user={user}
          isWishlisted={isWishlisted}
          onToggleWishlist={user ? toggleWishlist : null}
          resolveListingForMessaging={resolveListingForMessaging}
          />
        <ModerationModal
          item={moderationListing}
          actionState={moderationState}
          moderationReason={moderationReason}
          onReasonChange={setModerationReason}
          onClose={() => setModerationListing(null)}
          onFlagListing={handleFlagListing}
          onRemoveListing={handleRemoveListing}
        />
        <FlaggedListingWarningToast
          item={flaggedListingPrompt}
          onClose={() => setFlaggedListingPrompt(null)}
          onContinue={() => {
            const item = flaggedListingPrompt;
            setFlaggedListingPrompt(null);
            if (item) openMessagesForListing(item, { acknowledged: true });
          }}
        />
      </>
    );
  }
  if (page === "settings") {
  return (
    <>
      <header><Navbar {...navbarProps} /></header>
      {messageNoticeToast}
      <SettingsPage onBack={goHome} onSignOut={signOut} onAccountDeleted={handleAccountDeleted} />
    </>
  );
}

  return (
    <>
      <header>
        <Navbar {...navbarProps} />

        {successMessage && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "var(--gray-900)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
            {successMessage}
          </div>
        )}

        {messageNoticeToast}

        {showForm && (
          <dialog className="modal-overlay" open onClick={() => setShowForm(false)}>
            <article className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close modal" type="button">×</button>
              <ListingForm onCancel={() => setShowForm(false)} onSuccess={handleListingSuccess} />
            </article>
          </dialog>
        )}

        <ListingDetailsModal
          item={selectedListing}
          onClose={() => setSelectedListing(null)}
          onMessageSeller={handleMessageSeller}
          user={user}
          isWishlisted={isWishlisted}
          onToggleWishlist={user ? toggleWishlist : null}
          resolveListingForMessaging={resolveListingForMessaging}
        />
        <ModerationModal
          item={moderationListing}
          actionState={moderationState}
          moderationReason={moderationReason}
          onReasonChange={setModerationReason}
          onClose={() => setModerationListing(null)}
          onFlagListing={handleFlagListing}
          onRemoveListing={handleRemoveListing}
        />
        <FlaggedListingWarningToast
          item={flaggedListingPrompt}
          onClose={() => setFlaggedListingPrompt(null)}
          onContinue={() => {
            const item = flaggedListingPrompt;
            setFlaggedListingPrompt(null);
            if (item) openMessagesForListing(item, { acknowledged: true });
          }}
        />
      </header>

      <main>
        <section>
          <Hero
            onListingClick={setSelectedListing}
            onBrowseClick={handleScrollToListings}
            onSignupClick={() => setPage("signup")}
            onLoginClick={() => setPage("login")}
            user={user}
          />
        </section>

        <section className="marketplace-shell">
          <aside
            role="navigation"
            className="marketplace-shell__filters"
            aria-label="Categories"
            ref={filterBarRef}
          >
            <CategoryBar
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              activeCondition={activeCondition}
              onConditionChange={setActiveCondition}
              priceSort={priceSort}
              onPriceSortChange={setPriceSort}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
              showSorting={false}
              mobileSorting
            />
          </aside>

          <div className="marketplace-shell__results" ref={listingsSectionRef}>
            {listingsError ? (
              <p style={{ padding: "24px 40px", color: "crimson" }}>{listingsError}</p>
            ) : listingsLoading ? (
              <p style={{ padding: "24px 40px", color: "var(--gray-600)" }}>Loading listings…</p>
            ) : (
              <ListingsGrid
                listings={filteredListings}
                searchQuery={searchQuery}
                activeCategory={activeCategory}
                priceSort={priceSort}
                onPriceSortChange={setPriceSort}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                onListingClick={setSelectedListing}
                onMessageSeller={handleMessageSeller}
                onSellerClick={handleSellerClick}
                isAdmin={isAdmin}
                onModerateListing={isAdmin ? handleOpenModeration : null}
                isWishlisted={isWishlisted}
                onToggleWishlist={user ? toggleWishlist : null}
                user={user}
              />
            )}
          </div>
        </section>
      </main>

      <footer><Footer /></footer>
    </>
  );
}

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
