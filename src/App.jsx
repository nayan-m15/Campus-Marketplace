// Main structure for the app feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useRef, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider, useNotifications } from "./context/NotificationContext";
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
import { getValidPriceRange } from "./utils/priceRangeValidation";
import {
  MODERATION_REASON_MAX_LENGTH,
  getModerationReasonError,
  limitModerationReason,
  normalizeModerationReason,
} from "./utils/moderationReasonValidation";
import SettingsPage from "./components/SettingsPage";
import { getAppBaseUrl } from "./utils/appUrl";
import { insertMessage } from "./utils/messageDelivery";
import { StudentBookingsPage } from "./components/BookingsUi";
import RatingPromptModal from "./components/RatingPromptModal";

const NOTIFICATION_DEBUG = import.meta.env.DEV;
const REQUIRED_PROFILE_FIELDS = ["name", "sex", "birthdate", "province", "institution"];
const DEBUG_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === "true";
const POST_LOGIN_REDIRECT_KEY = "campusxchange:post-login-redirect";
const STATIC_HOST_REDIRECT_KEY = "campusxchange:static-host-redirect";
const PAGE_PATHS = {
  home: "/",
  login: "/login",
  signup: "/signup",
  profile: "/profile",
  publicProfile: "/profiles",
  messages: "/messages",
  admin: "/admin",
  yourlistings: "/your-listings",
  bookings: "/bookings",
  wishlist: "/wishlist",
  settings: "/settings",
};
const PROTECTED_PAGES = new Set([
  "profile",
  "messages",
  "admin",
  "yourlistings",
  "bookings",
  "wishlist",
  "settings",
]);
const priceSuggestionCache = new Map();

function normalizeBasePath(basePath = import.meta.env.BASE_URL || "/") {
  if (!basePath) return "/";
  const normalized = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function stripBasePath(pathname, basePath = normalizeBasePath()) {
  if (!pathname) return "/";
  const normalizedBase = normalizeBasePath(basePath);

  if (normalizedBase !== "/" && pathname.startsWith(normalizedBase)) {
    const stripped = pathname.slice(normalizedBase.length - 1);
    return stripped || "/";
  }

  return pathname || "/";
}

function buildAppPath(appPath, basePath = normalizeBasePath()) {
  const normalizedBase = normalizeBasePath(basePath);
  const normalizedPath = appPath === "/" ? "/" : appPath.replace(/\/+$/, "");

  if (normalizedBase === "/") {
    return normalizedPath;
  }

  const baseWithoutTrailingSlash = normalizedBase.replace(/\/$/, "");
  return normalizedPath === "/"
    ? `${baseWithoutTrailingSlash}/`
    : `${baseWithoutTrailingSlash}${normalizedPath}`;
}

function getPageForPath(pathname) {
  const appPath = stripBasePath(pathname);
  const matchedRoute = Object.entries(PAGE_PATHS).find(([, path]) => path === appPath);
  return matchedRoute?.[0] ?? "home";
}

function restoreStaticHostRedirect() {
  if (typeof window === "undefined") return null;

  try {
    const savedPath = window.sessionStorage.getItem(STATIC_HOST_REDIRECT_KEY);
    if (!savedPath) return null;

    window.sessionStorage.removeItem(STATIC_HOST_REDIRECT_KEY);

    const restoredUrl = new URL(savedPath, window.location.origin);
    const basePath = normalizeBasePath();

    if (
      restoredUrl.origin !== window.location.origin ||
      (basePath !== "/" && !restoredUrl.pathname.startsWith(basePath))
    ) {
      return null;
    }

    const nextUrl = `${restoredUrl.pathname}${restoredUrl.search}${restoredUrl.hash}`;
    window.history.replaceState({ ...(window.history.state || {}) }, "", nextUrl);
    return restoredUrl.pathname;
  } catch {
    return null;
  }
}

function getPageForAppPath(appPath) {
  const matchedRoute = Object.entries(PAGE_PATHS).find(([, path]) => path === appPath);
  return matchedRoute?.[0] ?? "home";
}

function getPathForPage(page) {
  return PAGE_PATHS[page] || PAGE_PATHS.home;
}

function isProtectedPage(page) {
  return PROTECTED_PAGES.has(page);
}

function persistPostLoginRedirect(path) {
  if (typeof window === "undefined" || !path || path === PAGE_PATHS.login) return;
  window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

function readPostLoginRedirect() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
}

function clearPostLoginRedirect() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}

// Quick guard logic sits here for this decision point.
// The check keeps the rest of the flow cleaner to read.
function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => !!profile[f]);
}

// ── Unread message count hook ──────────────────────────────
function parseListingPriceValue(price) {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  const numericText = String(price ?? "")
    .replace(/\s/g, "")
    .replace(/[^0-9.,]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const value = Number(numericText);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getPriceSuggestionErrorMessage(error) {
  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("failed to send a request to the edge function")) {
    return "The pricing service could not be reached right now.";
  }

  if (lowerMessage.includes("non-2xx") || lowerMessage.includes("non 2xx")) {
    return "We could not compare this listing with reliable shopping results.";
  }

  if (lowerMessage.includes("not enough") || lowerMessage.includes("no usable")) {
    return "We could not find reliable shopping matches for this listing.";
  }

  if (lowerMessage.includes("not found")) {
    return "Not enough comparable Google Shopping results found.";
  }

  if (lowerMessage.includes("inconclusive")) {
    return "We could not find reliable shopping matches for this listing.";
  }

  if (!message) {
    return "Price check is unavailable right now.";
  }

  return "Price check is unavailable right now.";
}

function getPriceFairness(listingPrice, suggestion, item) {
  const suggestedPrice = Number(suggestion?.suggestedPrice || 0);
  const rangeMin = Number(suggestion?.suggestedRange?.min || suggestedPrice * 0.9);
  const rangeMax = Number(suggestion?.suggestedRange?.max || suggestedPrice * 1.1);
  const confidenceLevel = suggestion?.confidence?.level || "Low";
  const listingType = String(item?.listing_type || "sale").toLowerCase();
  const isTradeListing =
    item?.status === "for_trade" ||
    ["trade", "trade_only", "sale_and_trade", "sale_trade", "sale+trade", "both"].includes(listingType);

  if (!listingPrice || !suggestedPrice) {
    return {
      label: "Price check",
      tone: "neutral",
      message: "No comparison available.",
    };
  }

  if (confidenceLevel === "Low" || suggestion?.confidence?.needsMoreDetail) {
    return {
      label: "Price check inconclusive",
      tone: "neutral",
      message: "We could not find reliable matches for this listing.",
      showRange: false,
    };
  }

  if (isTradeListing) {
    return {
      label: "Estimated trade value",
      tone: "neutral",
      message: "Use this as a rough value when comparing trade offers.",
      showRange: true,
    };
  }

  if (listingPrice < rangeMin * 0.8) {
    return {
      label: "Very good price",
      tone: "good",
      message: "This is below the suggested second-hand range.",
      showRange: true,
    };
  }

  if (listingPrice <= rangeMax) {
    return {
      label: "Good price",
      tone: "good",
      message: "This is within the suggested second-hand range.",
      showRange: true,
    };
  }

  if (listingPrice <= rangeMax * 1.25) {
    return {
      label: "Fair price",
      tone: "fair",
      message: "This is slightly above the suggested range.",
      showRange: true,
    };
  }

  return {
    label: "High price",
    tone: "high",
    message: "This is above the suggested second-hand range.",
    showRange: true,
  };
}

function ListingPriceCheck({ item }) {
  const [priceCheck, setPriceCheck] = useState(null);
  const [priceCheckLoading, setPriceCheckLoading] = useState(false);
  const [priceCheckError, setPriceCheckError] = useState("");

  const listingPrice = parseListingPriceValue(item?.price);
  const imageUrl = item?.image_url || item?.image_urls?.find(Boolean) || "";
  const cacheKey = item?.id
    ? JSON.stringify({
        id: String(item.id),
        title: String(item.title || "").trim().toLowerCase(),
        description: String(item.description || "").trim().toLowerCase(),
        category: String(item.category || "").trim().toLowerCase(),
        condition: String(item.condition || "").trim().toLowerCase(),
        listingPrice,
        imageUrl,
      })
    : "";
  const isFlagged = item?.status === "flagged";
  const hasEnoughDetail =
    Boolean(item?.title?.trim()) &&
    Boolean(item?.condition) &&
    Boolean(item?.category);
    String(item?.description || "").trim().length >= 8;

  useEffect(() => {
    if (!item?.id || !hasEnoughDetail || !listingPrice || isFlagged) {
      setPriceCheck(null);
      setPriceCheckError("");
      setPriceCheckLoading(false);
      return;
    }

    if (priceSuggestionCache.has(cacheKey)) {
      const cached = priceSuggestionCache.get(cacheKey);
      setPriceCheck(cached.data || null);
      setPriceCheckError(cached.error || "");
      setPriceCheckLoading(false);
      return;
    }

    let ignore = false;

    if (!supabase.functions?.invoke) {
      const cached = { data: null, error: "Price check is unavailable right now." };
      priceSuggestionCache.set(cacheKey, cached);
      setPriceCheck(cached.data);
      setPriceCheckError(cached.error);
      setPriceCheckLoading(false);
      return;
    }

    setPriceCheckLoading(true);
    setPriceCheckError("");

    supabase.functions.invoke("price-suggestion", {
      body: {
        listingId: item.id,
        query: item.title,
        description: item.description || "",
        category: item.category,
        condition: item.condition,
        listingPrice,
        imageUrl,
      },
    }).then(({ data, error }) => {
      if (ignore) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      priceSuggestionCache.set(cacheKey, { data, error: "" });
      setPriceCheck(data);
    }).catch((error) => {
      if (ignore) return;
      const errorMessage = getPriceSuggestionErrorMessage(error);
      priceSuggestionCache.set(cacheKey, { data: null, error: errorMessage });
      setPriceCheck(null);
      setPriceCheckError(errorMessage);
    }).finally(() => {
      if (!ignore) setPriceCheckLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [item?.id, item?.title, item?.description, item?.category, item?.condition, item?.status, imageUrl, cacheKey, hasEnoughDetail, isFlagged, listingPrice]);

  if (!listingPrice) return null;

  if (isFlagged) {
    return (
      <section className="item-modal-price-check item-modal-price-check--neutral">
        <strong>Price check paused</strong>
        <p>This listing has been flagged for review.</p>
      </section>
    );
  }

  if (!hasEnoughDetail) {
    return (
      <section className="item-modal-price-check item-modal-price-check--neutral">
        <strong>Price check unavailable</strong>
        <p>More listing detail is needed to compare this price.</p>
      </section>
    );
  }

  if (priceCheckLoading) {
    return (
      <section className="item-modal-price-check item-modal-price-check--neutral">
        <strong>Checking price...</strong>
        <p>Comparing similar South African Google Shopping results.</p>
      </section>
    );
  }

  if (priceCheckError) {
    return (
      <section className="item-modal-price-check item-modal-price-check--neutral">
        <strong>Price check unavailable</strong>
        <p>{priceCheckError}</p>
      </section>
    );
  }

  if (!priceCheck) return null;

  const fairness = getPriceFairness(listingPrice, priceCheck, item);
  const confidenceLevel = priceCheck.confidence?.level || "Low";
  const pricingBasisLabel = priceCheck.pricingBasis?.label || "Google Shopping SA prices";

  return (
    <section className={`item-modal-price-check item-modal-price-check--${fairness.tone}`}>
      <section className="item-modal-price-check__top">
        <strong>{fairness.label}</strong>
        <span>{confidenceLevel} confidence</span>
      </section>
      <p>{fairness.message}</p>
      {fairness.showRange && (
        <p>
          Based on {pricingBasisLabel}, adjusted for condition. Suggested range:{" "}
          {priceCheck.suggestedRange?.minFormatted} - {priceCheck.suggestedRange?.maxFormatted}.
        </p>
      )}
    </section>
  );
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

async function buildIncomingOfferNotice(offer) {
  let senderName = "Someone";

  const { data: sender } = await supabase
    .from("profiles")
    .select("display_name, name")
    .eq("id", offer.sender_id)
    .single();

  if (sender?.display_name || sender?.name) {
    senderName = sender.display_name || sender.name;
  }

  return {
    title: "Offer update",
    body: `${senderName} sent a new offer.`,
  };
}

// Related state and side effects are grouped in this hook.
// That keeps the surrounding component easier to follow.
function useUnreadCount(user, onIncomingMessage) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    // Count unread messages + unread offers together for the navbar badge
    Promise.all([
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false)
        .eq("is_deleted", false),
      supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false),
    ]).then(([{ count: msgCount }, { count: offerCount }]) => {
      if (NOTIFICATION_DEBUG) {
        console.log("[notifications] initial unread count fetched", {
          userId: user.id,
          messageCount: msgCount || 0,
          offerCount: offerCount || 0,
        });
      }
      setUnreadCount((msgCount || 0) + (offerCount || 0));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (NOTIFICATION_DEBUG) {
      console.log("[notifications] subscribing to realtime channel", { userId: user.id });
    }
    const channel = supabase
      .channel(`navbar-unread:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        if (NOTIFICATION_DEBUG) {
          console.log("[notifications] incoming message payload", payload);
        }
        if (payload.new.receiver_id === user.id) {
          setUnreadCount((prev) => prev + 1);
          const dedupeKey = `message-${payload.new.id}`;

          onIncomingMessage?.({
            title: "New message",
            body: payload.new.content || "Open Campus Marketplace to reply.",
            category: "message",
            type: "message",
            dedupeKey,
          });

          buildIncomingMessageNotice(payload.new)
            .then((notice) => {
              if (NOTIFICATION_DEBUG) {
                console.log("[notifications] enriched message notice", {
                  dedupeKey,
                  notice,
                });
              }
              onIncomingMessage?.({
                title: notice.title,
                body: notice.body,
                category: "message",
                type: "message",
                dedupeKey,
              });
            })
            .catch((error) => {
              if (NOTIFICATION_DEBUG) {
                console.warn("[notifications] failed to enrich message notice", {
                  dedupeKey,
                  error,
                });
              }
              onIncomingMessage?.({
                title: "New message",
                body: payload.new.content || "Open Campus Marketplace to reply.",
                category: "message",
                type: "message",
                dedupeKey,
              });
            });
        }
      })
      // Also increment badge for incoming offers
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, (payload) => {
        if (NOTIFICATION_DEBUG) {
          console.log("[notifications] incoming offer payload", payload);
        }
        if (payload.new.receiver_id === user.id) {
          setUnreadCount((prev) => prev + 1);
          const dedupeKey = `offer-${payload.new.id}`;

          onIncomingMessage?.({
            title: "Offer update",
            body: "You received a new offer.",
            category: "offer",
            type: "offer",
            dedupeKey,
          });

          buildIncomingOfferNotice(payload.new)
            .then((notice) => {
              if (NOTIFICATION_DEBUG) {
                console.log("[notifications] enriched offer notice", {
                  dedupeKey,
                  notice,
                });
              }
              onIncomingMessage?.({
                title: notice.title,
                body: notice.body,
                category: "offer",
                type: "offer",
                dedupeKey,
              });
            })
            .catch((error) => {
              if (NOTIFICATION_DEBUG) {
                console.warn("[notifications] failed to enrich offer notice", {
                  dedupeKey,
                  error,
                });
              }
              onIncomingMessage?.({
                title: "Offer update",
                body: "You received a new offer.",
                category: "offer",
                type: "offer",
                dedupeKey,
              });
            });
        }
      })
      .subscribe((status) => {
        if (NOTIFICATION_DEBUG) {
          console.log("[notifications] realtime channel status", {
            userId: user.id,
            status,
          });
        }
      });

    return () => {
      if (NOTIFICATION_DEBUG) {
        console.log("[notifications] cleaning up realtime channel", { userId: user.id });
      }
      supabase.removeChannel(channel);
    };
  }, [user, onIncomingMessage]);

  return [unreadCount, setUnreadCount];
}

// ── Item Details Modal ─────────────────────────────────────
function ListingDetailsModal({
  item,
  onClose,
  onMessageSeller,
  onSendOffer,
  user,
  isWishlisted,
  onToggleWishlist,
  resolveListingForMessaging,
}) {
  const { addNotification, notifySuccess, notifyError } = useNotifications();
  const [message, setMessage] = useState(`Hi, is the ${item?.title || "item"} still available?`);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const prevItemIdRef = useRef(null);
  useEffect(() => {
    if (item && item.id !== prevItemIdRef.current) {
      prevItemIdRef.current = item.id;
      setMessage(`Hi, is the ${item.title || "item"} still available?`);
      setCurrentImageIndex(0);
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
  const listingType = String(item.listing_type || "sale").toLowerCase();
  const isSaleAndTrade =
    item.status === "for_trade" ||
    ["sale_and_trade", "sale_trade", "sale+trade", "both"].includes(listingType);
  const tradeBadgeLabel = isSaleAndTrade
    ? "For Trade"
    : listingType === "trade" || listingType === "trade_only"
      ? "For Trade Only"
      : "";
  const tradeBadgeClassName =
    tradeBadgeLabel === "For Trade Only"
      ? "item-modal-trade-badge item-modal-trade-badge--only"
      : "item-modal-trade-badge";

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

  async function performSendMessage({ acknowledged = false } = {}) {
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
      notifySuccess("Message sent", "Your message was delivered and the conversation is opening.", {
        category: "message",
        dedupeKey: `message-sent-${item.id}-${Date.now()}`,
      });
      setTimeout(() => { onClose(); onMessageSeller(item, { acknowledged, suppressDraft: true }); }, 1000);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
      notifyError("Message failed", err.message || "Failed to send message.", {
        category: "error",
        dedupeKey: `message-error-${item.id}-${err.message || "send"}`,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSendMessage() {
    const latestItem = await resolveListingForMessaging?.(item) || item;
    if (latestItem?.status === "flagged") {
      addNotification({
        title: "Flagged listing warning",
        message: latestItem.flag_reason?.trim()
          ? `Continue with caution. ${latestItem.flag_reason.trim()}`
          : "This listing was flagged by an admin. Continue with caution.",
        category: "warning",
        type: "warning",
        dedupeKey: `modal-flagged-${latestItem.id}-message`,
        action: {
          onClick: () => performSendMessage({ acknowledged: true }),
        },
      });
      return;
    }

    performSendMessage();
  }

  return (
    <>
      <section className="item-modal-overlay" onClick={onClose}>
        <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close item details" type="button">x</button>

        <section className="item-modal-scroll">
          <section className="item-modal-scroll-inner">
            <section className="item-modal-layout">
              <section className="item-modal-right-column item-modal-right-column--full">
                <article className="item-modal-top-card">
                  <section className="item-modal-top-main">
                    <section className="item-modal-carousel">
                      <section className="item-modal-carousel__frame">
                        {images.length > 1 && (
                          <>
                            <button type="button" className="item-modal-carousel__nav item-modal-carousel__nav--prev" onClick={showPreviousImage} aria-label="Show previous image">{"<"}</button>
                            <button type="button" className="item-modal-carousel__nav item-modal-carousel__nav--next" onClick={showNextImage} aria-label="Show next image">{">"}</button>
                          </>
                        )}

                        {activeImage ? (
                          <img src={activeImage} alt={item.title || "Listing image"} className="item-modal-top-image" />
                        ) : (
                          <span className="item-modal-top-placeholder"><span>{item.emoji || "No Image"}</span></span>
                        )}
                      </section>

                      {images.length > 1 && (
                        <span className="item-modal-carousel__dots" aria-label="Image navigation">
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
                        </span>
                      )}
                    </section>

                    <section className="item-modal-top-bottom">
                      <section className="item-modal-top-text">
                        <h2 className="item-modal-title">{item.title || "Untitled listing"}</h2>

                        {item.status === "flagged" && (
                          <p className="item-modal-error" style={{ marginBottom: 0 }}>
                            This listing has been flagged by an admin. Please review it carefully before continuing.
                          </p>
                        )}

                        <section className="item-modal-summary">
                          <p className="item-modal-price">
                            {item.pricePrefix && <span className="item-modal-price-prefix">{item.pricePrefix} </span>}
                            {item.price || "Price not available"}
                          </p>
                          <span className="item-modal-condition">{item.condition || "Good"}</span>
                          {tradeBadgeLabel && (
                            <span className={tradeBadgeClassName}>{tradeBadgeLabel}</span>
                          )}
                        </section>

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
                      </section>

                      <article className="item-modal-description-card">
                        <h3>Description</h3>
                        <p>{item.description?.trim() || "No description provided."}</p>
                        <ListingPriceCheck item={item} />
                      </article>
                    </section>
                  </section>
                </article>

                <article className="item-modal-bottom-card">
                  <section className="item-modal-info">
                    <section className="item-modal-meta">
                      <p><strong>Seller:</strong> {item.seller || "Unknown seller"}</p>
                      <p><strong>Institution:</strong> {item.institution || "Institution not provided"}</p>
                      <p><strong>Joined since:</strong> {joinedLabel}</p>
                      {item.category && <p><strong>Category:</strong> {item.category}</p>}
                    </section>
                  </section>

                  <section className="item-modal-contact">
                    <h3>Message seller</h3>
                    {!user ? (
                      <p className="item-modal-error">Please <strong>log in</strong> to message this seller.</p>
                    ) : (
                      <>
                        <textarea className="item-modal-textarea" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                        {sendError && <p className="item-modal-error">{sendError}</p>}
                        {sendSuccess && <p className="item-modal-success">{sendSuccess}</p>}
                        <section className="item-modal-actions">
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
                          <button
                            type="button"
                            className="item-modal-send-btn item-modal-send-btn--offer"
                            onClick={async () => {
                              const latestItem = await resolveListingForMessaging?.(item) || item;
                              onClose();
                              onSendOffer?.(latestItem);
                            }}
                          >
                            {tradeBadgeLabel ? "Send Trade Offer" : "Send Offer"}
                          </button>
                        </section>
                      </>
                    )}
                  </section>
                </article>
              </section>
            </section>
          </section>
        </section>
        </article>
      </section>
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
  onUnflagListing,
  onRemoveListing,
}) {
  if (!item) return null;

  const moderationReasonLength = moderationReason.length;
  const isFlagged = item.status === "flagged";

  return (
    <section className="item-modal-overlay" onClick={onClose}>
      <article className="item-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close moderation panel" type="button">x</button>

        <section className="item-modal-scroll">
          <section className="item-modal-scroll-inner">
            <section className="item-modal-layout">
              <section className="item-modal-right-column item-modal-right-column--full">
                <article className="item-modal-top-card">
                  <section className="item-modal-top-text">
                    <h2 className="item-modal-title">Review moderation</h2>
                    <article className="item-modal-description-card">
                      {isFlagged ? (
                        <p>
                          Moderate listing safety for <strong>{item.title}</strong>. Use <strong>Update flag</strong> to revise the buyer warning, <strong>Unflag listing</strong> to remove the warning, or <strong>Remove listing</strong> to take it down entirely.
                        </p>
                      ) : (
                        <p>
                          Moderate listing safety for <strong>{item.title}</strong>. Use <strong>Flag listing</strong> to warn buyers that this listing needs caution, or <strong>Remove listing</strong> to take it down entirely.
                        </p>
                      )}
                    </article>
                  </section>
                </article>

                <article className="item-modal-bottom-card">
                  <section className="item-modal-info">
                    <section className="item-modal-meta">
                      <p><strong>Seller:</strong> {item.seller || "Unknown seller"}</p>
                      <p><strong>Institution:</strong> {item.institution || "Institution not provided"}</p>
                      <p><strong>Status:</strong> {item.status || "active"}</p>
                    </section>
                  </section>

                  <section className="item-modal-contact">
                    <h3>Moderation actions</h3>
                    <label className="profile-field" style={{ display: "block", marginBottom: 14 }}>
                      <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Flag reason</span>
                      <textarea
                        className="item-modal-textarea"
                        value={moderationReason}
                        onChange={(e) => onReasonChange(limitModerationReason(e.target.value))}
                        rows={4}
                        maxLength={MODERATION_REASON_MAX_LENGTH}
                        placeholder="Explain why this listing is being flagged."
                        aria-describedby="moderation-reason-help"
                        style={{ marginBottom: 0 }}
                      />
                      <span
                        id="moderation-reason-help"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          marginTop: 8,
                          color: "var(--gray-500)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span>{moderationReasonLength}/{MODERATION_REASON_MAX_LENGTH}</span>
                      </span>
                    </label>
                    {actionState.error && <p className="item-modal-error">{actionState.error}</p>}
                    {actionState.success && <p className="item-modal-success">{actionState.success}</p>}
                    <section className="item-modal-actions">
                      <button
                        type="button"
                        className="item-modal-send-btn"
                        onClick={() => onFlagListing(item)}
                        disabled={Boolean(actionState.loading)}
                      >
                        {actionState.loading === "flag" ? "Saving..." : isFlagged ? "Update flag" : "Flag listing"}
                      </button>
                      {isFlagged && (
                        <button
                          type="button"
                          className="item-modal-send-btn item-modal-send-btn--unflag"
                          onClick={() => onUnflagListing(item)}
                          disabled={Boolean(actionState.loading)}
                        >
                          {actionState.loading === "unflag" ? "Unflagging..." : "Unflag listing"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="item-modal-send-btn item-modal-send-btn--secondary"
                        onClick={() => onRemoveListing(item)}
                        disabled={Boolean(actionState.loading)}
                      >
                        {actionState.loading === "remove" ? "Removing..." : "Remove listing"}
                      </button>
                    </section>
                  </section>
                </article>
              </section>
            </section>
          </section>
        </section>
      </article>
    </section>
  );
}

// Component entry point for this part of the interface.
// Rendering and feature-specific behavior are coordinated here.
function AppInner() {
  const {
    user,
    loading,
    signOut: authSignOut,
    isPasswordRecovery,
    clearPasswordRecovery,
    lastAuthEvent,
  } = useAuth();
  const { addNotification, notifySuccess } = useNotifications();

  const [page, setPage] = useState(() => {
    if (typeof window === "undefined") return "home";
    return getPageForPath(restoreStaticHostRedirect() || window.location.pathname);
  });
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [activeCondition, setActiveCondition] = useState("All Conditions");
  const [priceSort, setPriceSort] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [moderationListing, setModerationListing] = useState(null);
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
  const [msgInitialDraft, setMsgInitialDraft] = useState(null);
  const [msgInitialAction, setMsgInitialAction] = useState(null);

  const [profileChecked, setProfileChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [showRatingModal, setShowRatingModal] = useState(false);

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
    if (!showForm || typeof document === "undefined") return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showForm]);

  const navigateToPage = useCallback((nextPage, options = {}) => {
    if (typeof window === "undefined") {
      setPage(nextPage);
      return;
    }

    const { replace = false, preserveSearch = false, preserveHash = false } = options;
    const nextPath = buildAppPath(getPathForPage(nextPage));
    const nextUrl = `${nextPath}${preserveSearch ? window.location.search : ""}${preserveHash ? window.location.hash : ""}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentPath !== nextUrl) {
      window.history[replace ? "replaceState" : "pushState"]({ page: nextPage }, "", nextUrl);
    } else if (replace) {
      window.history.replaceState({ page: nextPage }, "", nextUrl);
    }

    setPage((currentPage) => (currentPage === nextPage ? currentPage : nextPage));
  }, []);

  // ── Unread message count for navbar badge ─────────────────
  const handleIncomingMessage = useCallback((notice) => {
    if (NOTIFICATION_DEBUG) {
      console.log("[notifications] forwarding realtime notice to store", notice);
    }
    addNotification({
      title: notice.title,
      message: notice.body,
      category: notice.category || "message",
      type: notice.type || "info",
      dedupeKey: notice.dedupeKey,
      action: {
        onClick: () => {
          setMsgRecipientId(null);
          setMsgListingTitle(null);
          setMsgListingId(null);
          setMsgInitialDraft(null);
          setMsgInitialAction(null);
          navigateToPage("messages");
        },
      },
    });
  }, [addNotification, navigateToPage]);

  const [unreadCount, setUnreadCount] = useUnreadCount(user, handleIncomingMessage);
  const { wishlistItems, isWishlisted, toggleWishlist, loading: wishlistLoading } = useWishlist(user);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    async function hydrateNotifications() {
      if (NOTIFICATION_DEBUG) {
        console.log("[notifications] hydrating existing unread notifications", { userId: user.id });
      }

      try {
        const [{ data: unreadMessages, error: messagesError }, { data: unreadOffers, error: offersError }] = await Promise.all([
          supabase
            .from("messages")
            .select("id, content, created_at, sender_id, listing_id")
            .eq("receiver_id", user.id)
            .eq("is_read", false)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(25),
          supabase
            .from("offers")
            .select("id, created_at, sender_id")
            .eq("receiver_id", user.id)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(25),
        ]);

        if (messagesError) throw messagesError;
        if (offersError) throw offersError;
        if (cancelled) return;

        const hydratedMessages = await Promise.all(
          (unreadMessages || []).map(async (message) => {
            try {
              const notice = await buildIncomingMessageNotice(message);
              return {
                id: `message-${message.id}`,
                title: notice.title,
                message: notice.body,
                category: "message",
                type: "message",
                timestamp: message.created_at,
                unread: true,
                dedupeKey: `message-${message.id}`,
                action: {
                  onClick: () => {
                    setMsgRecipientId(null);
                    setMsgListingTitle(null);
                    setMsgListingId(null);
                    setMsgInitialDraft(null);
                    setMsgInitialAction(null);
                    navigateToPage("messages");
                  },
                },
              };
            } catch {
              return {
                id: `message-${message.id}`,
                title: "New message",
                message: message.content || "Open Campus Marketplace to reply.",
                category: "message",
                type: "message",
                timestamp: message.created_at,
                unread: true,
                dedupeKey: `message-${message.id}`,
                action: {
                  onClick: () => {
                    setMsgRecipientId(null);
                    setMsgListingTitle(null);
                    setMsgListingId(null);
                    setMsgInitialDraft(null);
                    setMsgInitialAction(null);
                    navigateToPage("messages");
                  },
                },
              };
            }
          }),
        );

        const hydratedOffers = await Promise.all(
          (unreadOffers || []).map(async (offer) => {
            try {
              const notice = await buildIncomingOfferNotice(offer);
              return {
                id: `offer-${offer.id}`,
                title: notice.title,
                message: notice.body,
                category: "offer",
                type: "offer",
                timestamp: offer.created_at,
                unread: true,
                dedupeKey: `offer-${offer.id}`,
                action: {
                  onClick: () => {
                    setMsgRecipientId(null);
                    setMsgListingTitle(null);
                    setMsgListingId(null);
                    setMsgInitialDraft(null);
                    setMsgInitialAction(null);
                    navigateToPage("messages");
                  },
                },
              };
            } catch {
              return {
                id: `offer-${offer.id}`,
                title: "Offer update",
                message: "You received a new offer.",
                category: "offer",
                type: "offer",
                timestamp: offer.created_at,
                unread: true,
                dedupeKey: `offer-${offer.id}`,
                action: {
                  onClick: () => {
                    setMsgRecipientId(null);
                    setMsgListingTitle(null);
                    setMsgListingId(null);
                    setMsgInitialDraft(null);
                    setMsgInitialAction(null);
                    navigateToPage("messages");
                  },
                },
              };
            }
          }),
        );

        if (cancelled) return;

        [...hydratedMessages, ...hydratedOffers]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .forEach((notification) => addNotification(notification));

        if (NOTIFICATION_DEBUG) {
          console.log("[notifications] hydration completed", {
            userId: user.id,
            messageNotifications: hydratedMessages.length,
            offerNotifications: hydratedOffers.length,
          });
        }
      } catch (error) {
        if (NOTIFICATION_DEBUG) {
          console.warn("[notifications] hydration failed", { userId: user.id, error });
        }
      }
    }

    hydrateNotifications();

    return () => {
      cancelled = true;
    };
  }, [addNotification, navigateToPage, user]);

  const redirectToLogin = useCallback((requestedPage = page) => {
    const requestedPath = getPathForPage(requestedPage);

    if (isProtectedPage(requestedPage)) {
      persistPostLoginRedirect(requestedPath);
    }

    if (DEBUG_AUTH) {
      console.debug("[AuthGuard] redirecting to login", {
        requestedPage,
        requestedPath,
      });
    }

    navigateToPage("login", { replace: true });
  }, [navigateToPage, page]);

  const handleSignOut = useCallback(async () => {
    clearPostLoginRedirect();
    navigateToPage("home", { replace: true });
    return authSignOut();
  }, [authSignOut, navigateToPage]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const normalizedPath = buildAppPath(getPathForPage(page));
    if (window.location.pathname !== normalizedPath) {
      const nextUrl = `${normalizedPath}${window.location.search}${window.location.hash}`;
      window.history.replaceState({ page }, "", nextUrl);
    } else if (window.history.state?.page !== page) {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.replaceState({ ...(window.history.state || {}), page }, "", currentUrl);
    }

    function handlePopState() {
      setPage(getPageForPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [page]);

  useEffect(() => {
    if (loading || (user && !profileChecked)) return;
    setListingsLoading(true);
    setListingsError(null);
    fetchListings(isAdmin ? null : user?.id)
      .then(setAllListings)
      .catch((err) => setListingsError(err.message))
      .finally(() => setListingsLoading(false));
  }, [user?.id, isAdmin, profileChecked, loading]);

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      setNeedsSetup(false);
      setAvatarUrl(null);
      setProfileName(null);
      setIsAdmin(false);
      setIsStaff(false);
      setCurrentProfile(null);
      return;
    }

    let isActive = true;

    setProfileChecked(false);
    setNeedsSetup(false);
    setIsAdmin(false);
    setIsStaff(false);
    setCurrentProfile(null);

    supabase
      .from("profiles")
      .select("id, name, display_name, avatar_url, role, sex, birthdate, province, institution, email")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!isActive) return;

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
      .catch(() => {
        if (!isActive) return;
        setAvatarUrl(null);
        setProfileName(null);
        setIsAdmin(false);
        setIsStaff(false);
        setNeedsSetup(true);
        setCurrentProfile(null);
        setProfileChecked(true);
      });

    return () => {
      isActive = false;
    };
  }, [user]);
  
  useEffect(() => {
    if (loading || (user && !profileChecked)) return;

    if (!user) {
      if (isProtectedPage(page)) {
        redirectToLogin(page);
      }
      return;
    }

    if (page === "admin" && !isAdmin) {
      navigateToPage("home", { replace: true });
      return;
    }

    if (DEBUG_AUTH) {
      console.debug("[AuthGuard] access granted", {
        page,
        userId: user.id,
        isAdmin,
        isStaff,
        needsSetup,
      });
    }
  }, [loading, user, profileChecked, page, isAdmin, isStaff, needsSetup, redirectToLogin, navigateToPage]);

  // ── Rating prompt ──────────────────────────────────────────────────────────
const checkPendingRatings = useCallback(async () => {
  if (!user) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, item, listing_id, seller_id, buyer_id, buyer_rating_pending, seller_rating_pending")
    .eq("status", "completed")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

  if (!transactions?.length) {
    setPendingRatings([]);
    setShowRatingModal(false);
    return;
  }

  const dismissedKey = `dismissed_ratings_${user.id}`;
  const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || "[]"));

  const pending = transactions.filter((txn) =>
    !dismissed.has(txn.id) && (
      (txn.buyer_id === user.id && txn.buyer_rating_pending) ||
      (txn.seller_id === user.id && txn.seller_rating_pending)
    )
  );

  if (!pending.length) {
    setPendingRatings([]);
    setShowRatingModal(false);
    return;
  }

  const otherUserIds = pending.map((txn) =>
    txn.buyer_id === user.id ? txn.seller_id : txn.buyer_id
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, name")
    .in("id", [...new Set(otherUserIds)]);

  const profileMap = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p.display_name || p.name || "Unknown"])
  );

  const mapped = pending.map((txn) => {
    const isBuyer = txn.buyer_id === user.id;
    const otherUserId = isBuyer ? txn.seller_id : txn.buyer_id;
    return {
      ...txn,
      otherUserId,
      otherUserName: profileMap[otherUserId] || "Unknown",
      role: isBuyer ? "buyer" : "seller",
    };
  });

  setPendingRatings(mapped);
  setShowRatingModal(true);
}, [user]);

// Run on login
useEffect(() => {
  if (!user || !profileChecked) return;
  checkPendingRatings();
}, [user, profileChecked, checkPendingRatings]);

// Run in realtime when a transaction is updated
useEffect(() => {
  if (!user) return;
  const channel = supabase
    .channel("rating-prompts")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "transactions" },
      (payload) => {
        const txn = payload.new;
        const involved = txn.buyer_id === user.id || txn.seller_id === user.id;
        const shouldPrompt =
          (txn.buyer_id === user.id && txn.buyer_rating_pending) ||
          (txn.seller_id === user.id && txn.seller_rating_pending);
        if (involved && shouldPrompt) checkPendingRatings();
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [user, checkPendingRatings]);
  // Small prep work happens in this helper before the UI uses the result.
  // It keeps lookup, formatting, or data shaping out of the render path.
  function numericPrice(item) {
    if (!item?.price) return 0;
    const n = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  const filteredListings = (() => {
    const validPriceRange =
      priceSort === "custom" ? getValidPriceRange(priceRange) : { min: "", max: "" };

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
        validPriceRange.min === "" ||
        numericPrice(item) >= Number(validPriceRange.min);

      const maxOk =
        priceSort !== "custom" ||
        validPriceRange.max === "" ||
        numericPrice(item) <= Number(validPriceRange.max);

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
    if (target === "home" || target === "signup" || target === "login") {
      clearPostLoginRedirect();
    }
    navigateToPage(target === "home" ? "home" : target);
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleListingSuccess() {
    setShowForm(false);
    notifySuccess("Listing published", "Your listing is now live in the marketplace.", {
      category: "listing",
      dedupeKey: `listing-published-${Date.now()}`,
    });
    fetchListings(user?.id)
      .then(setAllListings)
      .catch((err) => setListingsError(err.message));
  }

  function continueFlaggedListingFlow(item) {
    if (!item) return;

    if (item.__pendingAction === "offer") {
      const listingType = String(item?.listing_type || "sale").toLowerCase();
      const isTradeListing =
        item?.status === "for_trade" ||
        ["trade", "trade_only", "sale_and_trade", "sale_trade", "sale+trade", "both"].includes(listingType);

      openMessagesForListing(item, {
        acknowledged: true,
        initialDraft: isTradeListing
          ? `Hello, I'd like to send an item trade offer for "${item.title}".`
          : `Hello, I'd like to send an offer for "${item.title}".`,
        initialAction: "offer",
      });
      return;
    }

    openMessagesForListing(item, { acknowledged: true });
  }

  function notifyFlaggedListingWarning(item, pendingAction) {
    addNotification({
      title: "Flagged listing warning",
      message: item.flag_reason?.trim()
        ? `Continue with caution. ${item.flag_reason.trim()}`
        : "This listing was flagged by an admin. Continue with caution.",
      category: "warning",
      type: "warning",
      dedupeKey: `flagged-${item.id}-${pendingAction}`,
      action: {
        onClick: () => continueFlaggedListingFlow({ ...item, __pendingAction: pendingAction }),
      },
    });
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function openMessagesForListing(
    item,
    { acknowledged = false, initialDraft = null, initialAction = null, suppressDraft = false } = {},
  ) {
    if (acknowledged && item?.id) {
      setAcknowledgedFlaggedListingId(item.id);
    } else {
      setAcknowledgedFlaggedListingId(null);
    }

    if (!user) {
      redirectToLogin("messages");
      return;
    }
    setMsgRecipientId(item.user_id || null);
    setMsgListingTitle(item.title);
    setMsgListingId(item.id || null);
    setMsgInitialDraft(suppressDraft ? "" : initialDraft);
    setMsgInitialAction(initialAction);
    navigateToPage("messages");
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

  async function handleMessageSeller(item, { acknowledged = false, suppressDraft = false } = {}) {
    const latestItem = await resolveListingForMessaging(item);
    if (latestItem?.status === "flagged" && !acknowledged) {
      notifyFlaggedListingWarning(latestItem, "message");
      return;
    }
    openMessagesForListing(latestItem, { acknowledged, suppressDraft });
  }

  async function handleSendOffer(item) {
    if (!user) {
      redirectToLogin("messages");
      return;
    }

    const latestItem = await resolveListingForMessaging(item);
    if (latestItem?.status === "flagged") {
      notifyFlaggedListingWarning(latestItem, "offer");
      return;
    }

    const listingType = String(latestItem?.listing_type || "sale").toLowerCase();
    const isTradeListing =
      latestItem?.status === "for_trade" ||
      ["trade", "trade_only", "sale_and_trade", "sale_trade", "sale+trade", "both"].includes(listingType);

    openMessagesForListing(latestItem, {
      initialDraft: isTradeListing
        ? `Hello, I'd like to send an item trade offer for "${latestItem.title}".`
        : `Hello, I'd like to send an offer for "${latestItem.title}".`,
      initialAction: "offer",
    });
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleSellerClick(sellerId) {
    if (user && sellerId === user.id) {
      navigateToPage("profile");
      return;
    }
    setPrevPage("home");
    setPublicProfileId(sellerId);
    navigateToPage("publicProfile");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleSetupComplete() {
    setNeedsSetup(false);
    navigateToPage(isAdmin ? "admin" : "home", { replace: true });
  }

  // Supporting logic for the go home flow is kept here.
  // Breaking it out makes the file easier to scan and maintain.
  function goHome() {
    navigateToPage("home");
    setSearchQuery("");
  }

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  function handleAccountDeleted() {
    navigateToPage("home", { replace: true });
    setSearchQuery("");
    setSelectedListing(null);
    setShowForm(false);
    setMsgRecipientId(null);
    setMsgListingTitle(null);
    setMsgListingId(null);
    setMsgInitialDraft(null);
    setMsgInitialAction(null);
    setPublicProfileId(null);
    setPrevPage("home");
    window.location.assign(getAppBaseUrl());
  }

  function dismissRating(txnId, wasSubmitted = false) {
    // not when they skip — skipped ones should still appear on the public profile.
    if (txnId && user?.id) {
      const key = `dismissed_ratings_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      if (!existing.includes(txnId)) {
        localStorage.setItem(key, JSON.stringify([...existing, txnId]));
      }
    }
    // Remove only the completed/skipped transaction, not all of them
    setPendingRatings((prev) => {
      const remaining = txnId ? prev.filter((r) => r.id !== txnId) : prev;
      if (remaining.length === 0) setShowRatingModal(false);
      return remaining;
    });
  }

  function handlePasswordResetComplete() {
    clearPasswordRecovery();
    navigateToPage("home", { replace: true });
  }

  function handleOpenModeration(item) {
    setModerationListing(item);
    setModerationReason(limitModerationReason(item.flag_reason || ""));
    setModerationState({ loading: "", success: "", error: "" });
  }

  async function refreshListings() {
    const listings = await fetchListings(isAdmin ? null : user?.id);
    setAllListings(listings);
  }

  async function handleFlagListing(item) {
    const reason = normalizeModerationReason(moderationReason);
    const reasonError = getModerationReasonError(reason);
    if (reasonError) {
      setModerationState({
        loading: "",
        success: "",
        error: reasonError,
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
      setModerationListing((current) =>
        current?.id === item.id
          ? { ...current, status: "flagged", flag_reason: reason }
          : current
      );
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

  async function handleUnflagListing(item) {
    setModerationState({ loading: "unflag", success: "", error: "" });

    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "active", flag_reason: "" })
        .eq("id", item.id);

      if (error) throw error;

      await refreshListings();
      setModerationReason("");
      setModerationListing((current) =>
        current?.id === item.id
          ? { ...current, status: "active", flag_reason: "" }
          : current
      );
      setModerationState({
        loading: "",
        success: "Listing unflagged. Buyers will no longer see a warning on it.",
        error: "",
      });
    } catch (err) {
      setModerationState({
        loading: "",
        success: "",
        error: err.message || "Could not unflag this listing.",
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
    if (loading || !user || !profileChecked || (page !== "login" && page !== "signup")) return;

    const pendingPath = readPostLoginRedirect();
    const pendingPage = pendingPath ? getPageForAppPath(pendingPath) : null;

    if (DEBUG_AUTH) {
      console.debug("[AuthGuard] resolving post-login destination", {
        pendingPath,
        pendingPage,
        isAdmin,
        needsSetup,
        lastAuthEvent,
      });
    }

    clearPostLoginRedirect();

    if (pendingPage === "admin" && isAdmin) {
      navigateToPage("admin", { replace: true });
      return;
    }

    if (pendingPage && pendingPage !== "login" && pendingPage !== "signup" && pendingPage !== "home") {
      navigateToPage(pendingPage, { replace: true });
      return;
    }

    navigateToPage(isAdmin ? "admin" : "home", { replace: true });
  }, [loading, user, profileChecked, isAdmin, needsSetup, page, lastAuthEvent, navigateToPage]);

  if (loading || (user && !profileChecked)) {
    return (
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--gray-600)" }}>
        Loading…
      </section>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordPage onComplete={handlePasswordResetComplete} />;
  }

  if (page === "login") return <LoginPage onNavigate={handleAuthNavigate} />;
  if (page === "signup") return <SignupPage onNavigate={handleAuthNavigate} />;

  if (user && needsSetup) return <ProfileSetupPage onComplete={handleSetupComplete} />;
  if (user && isStaff) return <TradeFacilityDashboard onSignOut={handleSignOut} staffProfile={currentProfile} />;
  if (user && isAdmin && page === "admin") {
    return (
      <>
        <AdminDashboard
          onSignOut={handleSignOut}
          onOpenSettings={() => navigateToPage("settings")}
          onBackToMarketplace={goHome}
          listings={allListings}
          listingsLoading={listingsLoading}
          listingsError={listingsError}
          onModerateListing={handleOpenModeration}
          adminProfile={currentProfile}
        />
        <ModerationModal
          item={moderationListing}
          actionState={moderationState}
          moderationReason={moderationReason}
          onReasonChange={(value) => setModerationReason(limitModerationReason(value))}
          onClose={() => setModerationListing(null)}
          onFlagListing={handleFlagListing}
          onUnflagListing={handleUnflagListing}
          onRemoveListing={handleRemoveListing}
        />
      </>
    );
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
    onLogin: () => {
      clearPostLoginRedirect();
      navigateToPage("login");
    },
    onSignup: () => {
      clearPostLoginRedirect();
      navigateToPage("signup");
    },
    onShowListingForm: () => { goHome(); setShowForm(true); },
    onProfile: () => navigateToPage("profile"),
    onMessages: () => {
      setMsgRecipientId(null);
      setMsgListingTitle(null);
      setMsgListingId(null);
      setMsgInitialDraft(null);
      setMsgInitialAction(null);
      navigateToPage("messages");
    },
    onSignOut: handleSignOut,
    onHome: goHome,
    onYourListings: () => navigateToPage("yourlistings"),
    onBookings: () => navigateToPage("bookings"),
    onWishlist: () => navigateToPage("wishlist"),
    wishlistCount: wishlistItems.length,
    onSettings: () => navigateToPage("settings"),
    unreadCount,
    isAdmin,
    onAdminDashboard: () => navigateToPage("admin"),
  };

  if (page === "profile") {
    return (
      <>
        {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
        <ProfilePage onBack={goHome} onAvatarChange={setAvatarUrl} onNameChange={setProfileName} />
      </>
    );
  }

  if (page === "publicProfile" && publicProfileId) {
    return (
      <>
          {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
        <PublicProfilePage
          userId={publicProfileId}
          onBack={() => navigateToPage(prevPage)}
          onMessageSeller={
            user
              ? () => {
                  setMsgRecipientId(publicProfileId);
                  setMsgListingTitle(null);
                  setMsgListingId(null);
                  setMsgInitialDraft(null);
                  setMsgInitialAction(null);
                  navigateToPage("messages");
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
        {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
        <MessagesPage
          initialRecipientId={msgRecipientId}
          initialListingTitle={msgListingTitle}
          initialListingId={msgListingId}
          initialDraft={msgInitialDraft}
          initialAction={msgInitialAction}
          initialAcknowledgedFlaggedListingId={acknowledgedFlaggedListingId}
          onBack={() => {
            setMsgRecipientId(null);
            setMsgListingTitle(null);
            setMsgListingId(null);
            setMsgInitialDraft(null);
            setMsgInitialAction(null);
            setAcknowledgedFlaggedListingId(null);
            goHome();
          }}
          onViewProfile={(sellerId) => {
            setPrevPage("messages");
            setPublicProfileId(sellerId);
            navigateToPage("publicProfile");
          }}
          onUnreadChange={setUnreadCount}
          onGoToBookings={() => navigateToPage("bookings")}
        />
      </>
    );
  }

  if (page === "yourlistings") {
    return (
      <>
        {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
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
        {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
        <StudentBookingsPage user={user} onBack={goHome} />
      </>
    );
  }

  // ── Wishlist page ──────────────────────────────────────────
  if (page === "wishlist") {
    return (
      <>
        {showRatingModal && pendingRatings.length > 0 && (
          <RatingPromptModal
            pendingRatings={pendingRatings}
            currentUserId={user.id}
            onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
          />
        )}
        <header><Navbar {...navbarProps} /></header>
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
          onSendOffer={handleSendOffer}
          user={user}
          isWishlisted={isWishlisted}
          onToggleWishlist={user ? toggleWishlist : null}
          resolveListingForMessaging={resolveListingForMessaging}
          />
        <ModerationModal
          item={moderationListing}
          actionState={moderationState}
          moderationReason={moderationReason}
          onReasonChange={(value) => setModerationReason(limitModerationReason(value))}
          onClose={() => setModerationListing(null)}
          onFlagListing={handleFlagListing}
          onUnflagListing={handleUnflagListing}
          onRemoveListing={handleRemoveListing}
        />
      </>
    );
  }
  if (page === "settings") {
  return (
    <>
      {showRatingModal && pendingRatings.length > 0 && (
        <RatingPromptModal
          pendingRatings={pendingRatings}
          currentUserId={user.id}
          onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
        />
      )}
      <header><Navbar {...navbarProps} /></header>
      <SettingsPage onBack={goHome} onSignOut={handleSignOut} onAccountDeleted={handleAccountDeleted} />
    </>
  );
}

  return (
    <>
      {showRatingModal && pendingRatings.length > 0 && (
        <RatingPromptModal
          pendingRatings={pendingRatings}
          currentUserId={user.id}
          onDone={(txnId, wasSubmitted) => dismissRating(txnId, wasSubmitted)}
        />
      )}
      <header>
        <Navbar {...navbarProps} />

        {showForm && (
          <aside
            className="listing-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-form-title"
            onClick={() => setShowForm(false)}
          >
            <article className="listing-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close modal" type="button">×</button>
              <ListingForm onCancel={() => setShowForm(false)} onSuccess={handleListingSuccess} />
            </article>
          </aside>
        )}

        <ListingDetailsModal
          item={selectedListing}
          onClose={() => setSelectedListing(null)}
          onMessageSeller={handleMessageSeller}
          onSendOffer={handleSendOffer}
          user={user}
          isWishlisted={isWishlisted}
          onToggleWishlist={user ? toggleWishlist : null}
          resolveListingForMessaging={resolveListingForMessaging}
        />
        <ModerationModal
          item={moderationListing}
          actionState={moderationState}
          moderationReason={moderationReason}
          onReasonChange={(value) => setModerationReason(limitModerationReason(value))}
          onClose={() => setModerationListing(null)}
          onFlagListing={handleFlagListing}
          onUnflagListing={handleUnflagListing}
          onRemoveListing={handleRemoveListing}
        />
      </header>

      <main>
        <section>
          <Hero
            onListingClick={setSelectedListing}
            onBrowseClick={handleScrollToListings}
            onSignupClick={() => navigateToPage("signup")}
            onLoginClick={() => navigateToPage("login")}
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

          <section className="marketplace-shell__results" ref={listingsSectionRef}>
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
          </section>
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
      <NotificationProvider>
        <AppInner />
      </NotificationProvider>
    </AuthProvider>
  );
}
