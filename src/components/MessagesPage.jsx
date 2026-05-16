// Main structure for the messages page feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { insertMessage } from "../utils/messageDelivery";
import { buildTradeTransactionId } from "../utils/tradeWorkflow";
import "../styles/Messages.css";

function flaggedWarningToastStyle() {
  return {
    position: "fixed",
    top: 20,
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

const SELLER_QUICK_REPLIES = [
  "Yes. Are you interested?",
  "In talks. I'll let you know.",
  "Sorry, it's not available.",
];

const OFFER_PRICE_MAX_DIGITS = 8;
const OFFER_PRICE_MAX_CHARS = OFFER_PRICE_MAX_DIGITS + 3;
const TRADE_CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];
const TRADE_OFFER_IMAGE_ACCEPT = "image/*";

function isItemTradeOffer(offer) {
  return offer?.offer_type === "item_trade" || offer?.offer_type === "trade_offer";
}

function getOfferedItemTitle(offer, fallback = "offered item") {
  return offer?.offered_listing?.title || offer?.offered_item_title || fallback;
}

function getOfferedItemDescription(offer) {
  return offer?.offered_listing?.description || offer?.offered_item_description || offer?.description || "";
}

function getOfferedItemCondition(offer) {
  return offer?.offered_listing?.condition || offer?.offered_item_condition || "";
}

function getOfferedItemImageUrl(offer) {
  return offer?.offered_listing?.image_url || offer?.offered_item_image_url || offer?.image_url || "";
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function buildConversationKey(peerId, listingId = null) {
  return `${peerId}::${listingId || "general"}`;
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function buildOfferPreview(offer, currentUserId) {
  if (!offer) return "";
  const isTrade = isItemTradeOffer(offer);
  const sentByMe = offer.sender_id === currentUserId;

  if (isTrade) {
    if (offer.status === "accepted") return "🔄 Trade offer accepted";
    if (offer.status === "declined") return "🔄 Trade offer declined";
    if (offer.status === "cancelled") return "🔄 Trade offer cancelled";
    return sentByMe ? "🔄 You sent a trade offer" : "🔄 Trade offer received";
  }

  const amount = `R${Number(offer.amount).toLocaleString("en-ZA")}`;
  if (offer.status === "accepted") return `Offer accepted: ${amount}`;
  if (offer.status === "declined") return `Offer declined: ${amount}`;
  if (offer.status === "cancelled") return `Offer cancelled: ${amount}`;
  return sentByMe ? `You offered ${amount}` : `Offer received: ${amount}`;
}

// ── Helpers ────────────────────────────────────────────────
function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 24 * 60 * 60 * 1000)
    return d.toLocaleDateString("en-ZA", { weekday: "short" });
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// Supporting logic for the avatar flow is kept here.
// Breaking it out makes the file easier to scan and maintain.
function Avatar({ url, name, size = 40 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return url ? (
    <img src={url} alt={name} className="msg-avatar" style={{ width: size, height: size }} />
  ) : (
    <span
      className="msg-avatar msg-avatar--placeholder"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

// ── Read Ticks ─────────────────────────────────────────────
// status: "sending" | "sent" | "read"
function ReadTicks({ status }) {
  if (status === "sending") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4, opacity: 0.5, flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  const isRead = status === "read";
  const color = isRead ? "#53d769" : "currentColor";

  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      style={{ marginLeft: 4, flexShrink: 0 }}
    >
      <path
        d="M4.3 8.7 L5.5 11 L10.5 2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isRead ? 0.9 : 1}
      />
      <path
        d="M9.8 8.7 L11 11 L16 2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function MessagesPage({
  initialRecipientId = null,
  initialListingTitle = null,
  initialListingId = null,
  initialDraft = null,
  initialAction = null,
  initialAcknowledgedFlaggedListingId = null,
  onBack,
  onViewProfile,
  onUnreadChange,
  onGoToBookings,
}) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);

  // unreadByConversation: { [conversationKey]: number }
  const [unreadByPeer, setUnreadByPeer] = useState({});

  const [activeId, setActiveId] = useState(null);
  const [activeConversationKey, setActiveConversationKey] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [activeListingId, setActiveListingId] = useState(initialListingId);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [flaggedWarningOpen, setFlaggedWarningOpen] = useState(false);
  const [pendingFlaggedMessage, setPendingFlaggedMessage] = useState("");
  const [acknowledgedFlaggedListingIds, setAcknowledgedFlaggedListingIds] = useState(() =>
    initialAcknowledgedFlaggedListingId ? new Set([String(initialAcknowledgedFlaggedListingId)]) : new Set()
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingConversation, setDeletingConversation] = useState(false);

  // Buyer info banner: shown to the lister when a buyer messages about a listing
  const [iAmTheLister, setIAmTheLister] = useState(false);
  const [conversationListing, setConversationListing] = useState(null);

  // Offer state
  const [offers, setOffers] = useState([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [acceptedOfferBanner, setAcceptedOfferBanner] = useState(null);
  const [offerSending, setOfferSending] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [offerActionError, setOfferActionError] = useState("");
  const [sendDraftBeforeOffer, setSendDraftBeforeOffer] = useState(false);
  const [offerMode, setOfferMode] = useState("cash"); // "cash" | "trade"
  const [tradeImage, setTradeImage] = useState(null);
  const [tradeImagePreview, setTradeImagePreview] = useState(null);
  const [tradeTitle, setTradeTitle] = useState("");
  const [tradeDescription, setTradeDescription] = useState("");
  const [tradeCondition, setTradeCondition] = useState("");
  const [tradeOfferMode, setTradeOfferMode] = useState("listing");
  const [myTradeListings, setMyTradeListings] = useState([]);
  const [selectedTradeListingId, setSelectedTradeListingId] = useState("");
  const [tradeListingsLoading, setTradeListingsLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const realtimeRef = useRef(null);
  const initialDraftAppliedRef = useRef(false);

  function clampOfferAmount(value) {
    const cleaned = String(value ?? "").replace(",", ".").replace(/[^0-9.]/g, "");
    const dotIndex = cleaned.indexOf(".");
    const whole = (dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex))
      .replace(/\./g, "")
      .slice(0, OFFER_PRICE_MAX_DIGITS);

    if (dotIndex === -1) return whole;

    const cents = cleaned
      .slice(dotIndex + 1)
      .replace(/\./g, "")
      .slice(0, 2);

    return `${whole}.${cents}`.slice(0, OFFER_PRICE_MAX_CHARS);
  }

  function resetTradeOfferDetails() {
    setTradeImage(null);
    setTradeImagePreview(null);
    setTradeTitle("");
    setTradeDescription("");
    setTradeCondition("");
    setSelectedTradeListingId("");
    setTradeOfferMode("listing");
  }

  const loadMyTradeListings = useCallback(async () => {
    if (!user) return;
    setTradeListingsLoading(true);
    const { data } = await supabase
      .from("listings")
      .select("id, title, description, price, condition, category, image_url, user_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const rows = (data || []).filter((listing) => String(listing.id) !== String(conversationListing?.id));
    setMyTradeListings(rows);
    setSelectedTradeListingId((prev) => {
      if (!prev && rows.length > 0) return String(rows[0].id);
      return prev;
    });
    setTradeListingsLoading(false);
  }, [user, conversationListing?.id]);

  // ── Notify parent of total unread count ──────────────────
  useEffect(() => {
    const total = Object.values(unreadByPeer).reduce((sum, n) => sum + n, 0);
    onUnreadChange?.(total);
  }, [unreadByPeer, onUnreadChange]);

  // ── Load conversations + unread counts ───────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConvsLoading(true);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, created_at, sender_id, receiver_id, content, is_read, listing_id")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const { data: offerRows } = await supabase
      .from("offers")
      .select("id, created_at, sender_id, receiver_id, amount, status, listing_id, requested_listing_id, offered_listing_id, offered_item_title, offered_item_description, offered_item_condition, offered_item_image_url, is_read, offer_type, image_url, description")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs && !offerRows) { setConvsLoading(false); return; }

    const threadMap = new Map();
    const unreadMap = {};

    for (const m of msgs || []) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const conversationKey = buildConversationKey(peerId, m.listing_id);

      if (!threadMap.has(conversationKey)) {
        threadMap.set(conversationKey, { peerId, listingId: m.listing_id || null, lastMsg: m });
      }

      if (m.receiver_id === user.id && !m.is_read) {
        unreadMap[conversationKey] = (unreadMap[conversationKey] || 0) + 1;
      }
    }

    for (const offer of offerRows || []) {
      const peerId = offer.sender_id === user.id ? offer.receiver_id : offer.sender_id;
      const conversationKey = buildConversationKey(peerId, offer.listing_id);

      if (offer.receiver_id === user.id && !offer.is_read) {
        unreadMap[conversationKey] = (unreadMap[conversationKey] || 0) + 1;
      }

      const offerPreviewMsg = {
        id: `offer-preview-${offer.id}`,
        created_at: offer.created_at,
        sender_id: offer.sender_id,
        receiver_id: offer.receiver_id,
        content: buildOfferPreview(offer, user.id),
        is_read: offer.is_read,
        listing_id: offer.listing_id || null,
      };

      if (!threadMap.has(conversationKey)) {
        threadMap.set(conversationKey, {
          peerId,
          listingId: offer.listing_id || null,
          lastMsg: offerPreviewMsg,
        });
      } else {
        const existing = threadMap.get(conversationKey);
        if (new Date(offer.created_at) > new Date(existing.lastMsg.created_at)) {
          threadMap.set(conversationKey, { ...existing, lastMsg: offerPreviewMsg });
        }
      }
    }

    setUnreadByPeer(unreadMap);

    const peerIds = [...new Set([...threadMap.values()].map((t) => t.peerId).filter(Boolean))];
    const listingIds = [...new Set([...threadMap.values()].map((t) => t.listingId).filter(Boolean))];
    let profiles = [];
    if (peerIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, display_name, avatar_url")
        .in("id", peerIds);
      profiles = data || [];
    }
    let listings = [];
    if (listingIds.length > 0) {
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, user_id, listing_type")
        .in("id", listingIds);
      listings = data || [];
    }

    const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const listingById = Object.fromEntries(listings.map((l) => [l.id, l]));

    const convList = [...threadMap.entries()].map(([conversationKey, thread]) => ({
      key: conversationKey,
      peerId: thread.peerId,
      listingId: thread.listingId,
      profile: profileById[thread.peerId] || null,
      listing: thread.listingId ? listingById[thread.listingId] || null : null,
      lastMsg: thread.lastMsg,
    }));

    convList.sort((a, b) => {
      const aTime = a.lastMsg ? new Date(a.lastMsg.created_at) : 0;
      const bTime = b.lastMsg ? new Date(b.lastMsg.created_at) : 0;
      return bTime - aTime;
    });

    setConversations(convList);
    setConvsLoading(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!showOfferModal || offerMode !== "trade") return;
    loadMyTradeListings();
  }, [showOfferModal, offerMode, loadMyTradeListings]);

  // ── Auto-open chat from listing ───────────────────────────
  useEffect(() => {
    if (!initialRecipientId || !user) return;
    async function openInitialChat() {
      setActiveListingId(initialListingId || null);
      await openChat(initialRecipientId, initialListingId || null);
      if (initialDraft !== null && initialDraft !== undefined) {
        setDraft(initialDraft);
      } else if (initialListingTitle) {
        setDraft(`Hi! I'm interested in your listing: "${initialListingTitle}". Is it still available?`);
      }
      if (initialAction === "offer") {
        setOfferError("");
        setTradeError("");
        setOfferAmount("");
        setOfferMode("cash");
        resetTradeOfferDetails();
        setSendDraftBeforeOffer(true);
        setShowOfferModal(true);
      }
    }
    openInitialChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecipientId, initialListingId, user]);

  // ── Mark messages AND offers as read ─────────────────────
  const markAsRead = useCallback(async (peerId, listingId = null) => {
    if (!peerId || !user) return;

    let query = supabase
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", peerId)
      .eq("is_read", false);
    query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null);
    await query;

    if (listingId) {
      await supabase
        .from("offers")
        .update({ is_read: true })
        .eq("receiver_id", user.id)
        .eq("sender_id", peerId)
        .eq("listing_id", listingId)
        .eq("is_read", false);
    }

    setUnreadByPeer((prev) => {
      const next = { ...prev };
      delete next[buildConversationKey(peerId, listingId)];
      return next;
    });
  }, [user]);

  // ── Open a chat ───────────────────────────────────────────
  const openChat = useCallback(async (peerId, listingId = null) => {
    if (!peerId) return;
    const conversationKey = buildConversationKey(peerId, listingId);
    setActiveId(peerId);
    setActiveConversationKey(conversationKey);
    setActiveListingId(listingId);
    setMessages([]);
    setMsgsLoading(true);
    setIAmTheLister(false);
    setConversationListing(null);
    setOffers([]);
    setShowOfferModal(false);
    setOfferAmount("");
    setOfferError("");
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleteError("");
    setSendDraftBeforeOffer(false);
    setAcceptedOfferBanner(null);
    setDraft("");
    setOfferMode("cash");
    resetTradeOfferDetails();
    setTradeError("");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, display_name, avatar_url, institution")
      .eq("id", peerId)
      .single();
    setActivePeer(profile || { id: peerId });

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, created_at, sender_id, receiver_id, content, is_read, listing_id")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    const threadMessages = (msgs || []).filter((message) =>
      listingId ? String(message.listing_id) === String(listingId) : !message.listing_id
    );

    setMessages(threadMessages);
    let threadOffers = [];
    if (listingId) {
      const { data: existingOffers } = await supabase
        .from("offers")
        .select("*")
        .eq("listing_id", String(listingId))
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      threadOffers = existingOffers || [];
    }

    // ── Buyer info banner ────────────────────────────────────
    const msgWithListing = [...threadMessages].reverse().find((m) => m.listing_id) ||
      (listingId ? { listing_id: listingId, sender_id: peerId } : null);

    if (msgWithListing) {
      setActiveListingId(msgWithListing.listing_id || null);

      const { data: listing } = await supabase
        .from("listings")
        .select("id, title, price, user_id, status, flag_reason, listing_type")
        .eq("id", String(msgWithListing.listing_id))
        .maybeSingle();

      const iOwnThisListing = listing ? listing.user_id === user.id : msgWithListing.sender_id === peerId;
      setIAmTheLister(iOwnThisListing);
      setConversationListing(listing || {
        id: msgWithListing.listing_id,
        title: initialListingTitle || null,
        price: null,
        user_id: iOwnThisListing ? user.id : peerId,
        status: "active",
        flag_reason: "",
      });
    }
    setOffers(threadOffers);
    setMsgsLoading(false);

    await markAsRead(peerId, listingId);

    setConversations((prev) => {
      const exists = prev.find((c) => c.key === conversationKey);
      if (exists) return prev;
      return [{
        key: conversationKey,
        peerId,
        listingId,
        profile: profile || { id: peerId },
        listing: listingId ? { id: listingId, title: initialListingTitle || null } : null,
        lastMsg: null,
      }, ...prev];
    });
  }, [user, markAsRead, initialListingTitle]);

  // ── Realtime: messages ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        const isForMe = msg.receiver_id === user.id || msg.sender_id === user.id;
        if (!isForMe) return;

        const peerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const conversationKey = buildConversationKey(peerId, msg.listing_id);

        setActiveConversationKey((curActiveConversationKey) => {
          if (curActiveConversationKey === conversationKey) {
            setMessages((prev) => {
              if (msg.sender_id === user.id) {
                const hasOptimistic = prev.find((m) => m.id === null && m.content === msg.content && m.sender_id === msg.sender_id);
                if (hasOptimistic) {
                  return prev.map((m) =>
                    m.id === null && m.content === msg.content && m.sender_id === msg.sender_id ? msg : m
                  );
                }
              }
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.receiver_id === user.id) {
              markAsRead(peerId, msg.listing_id || null);
            }
          } else {
            if (msg.receiver_id === user.id) {
              setUnreadByPeer((prev) => ({
                ...prev,
                [conversationKey]: (prev[conversationKey] || 0) + 1,
              }));
            }
          }
          return curActiveConversationKey;
        });

        setConversations((prev) => {
          const existing = prev.find((c) => c.key === conversationKey);
          if (existing) return prev.map((c) => c.key === conversationKey ? { ...c, lastMsg: msg } : c);
          return [{
            key: conversationKey,
            peerId,
            listingId: msg.listing_id || null,
            profile: null,
            listing: null,
            lastMsg: msg,
          }, ...prev];
        });
        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new;
        if (updated.sender_id === user.id || updated.receiver_id === user.id) {
          setMessages((prev) =>
            prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read } : m)
          );
        }
        loadConversations();
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [user, markAsRead, loadConversations]);

  // ── Realtime: offers ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("offers-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, async (payload) => {
        const { data: offer } = await supabase
          .from("offers")
          .select("*")
          .eq("id", payload.new.id)
          .single();

        if (!offer) return;
        if (offer.sender_id !== user.id && offer.receiver_id !== user.id) return;

        const peerId = offer.sender_id === user.id ? offer.receiver_id : offer.sender_id;
        const conversationKey = buildConversationKey(peerId, offer.listing_id || null);

        setActiveConversationKey((curActiveConversationKey) => {
          if (curActiveConversationKey === conversationKey) {
            setOffers((prev) => {
              if (prev.some((o) => o.id === offer.id)) return prev;
              return [
                ...prev.map((o) =>
                  o.sender_id === offer.sender_id &&
                  o.receiver_id === offer.receiver_id &&
                  o.status === "pending" &&
                  o.id !== offer.id
                    ? { ...o, status: "declined" }
                    : o
                ),
                offer,
              ];
            });
            if (offer.receiver_id === user.id) {
              supabase
                .from("offers")
                .update({ is_read: true })
                .eq("id", offer.id)
                .then(() => loadConversations());
            }
          } else {
            if (offer.receiver_id === user.id) {
              setUnreadByPeer((prev) => ({
                ...prev,
                [conversationKey]: (prev[conversationKey] || 0) + 1,
              }));
            }
          }
          return curActiveConversationKey;
        });

        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "offers" }, (payload) => {
        const offer = payload.new;
        if (offer.sender_id !== user.id && offer.receiver_id !== user.id) return;
        setOffers((prev) => prev.map((o) => o.id === offer.id ? offer : o));
        loadConversations();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, loadConversations]);

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, offers, activeId]);

  // ── Auto-resize textarea ──────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [draft]);

  // ── Send ──────────────────────────────────────────────────
  const sendMessageNow = async (messageText = draft, { listingId = activeListingId } = {}) => {
    const text = messageText.trim();
    if (!text || !activeId || sending) return;
    const messageListingId = listingId || null;

    setSending(true);
    if (messageText === draft) setDraft("");

    const optimistic = {
      id: null,
      sender_id: user.id,
      receiver_id: activeId,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      listing_id: messageListingId,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await insertMessage({
      sender_id: user.id,
      receiver_id: activeId,
      content: text,
      created_at: optimistic.created_at,
      listing_id: messageListingId,
    });

    if (error) {
      console.error(error.message);
      if (messageText === draft) setDraft(text);
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    }
    setSending(false);
    setPendingFlaggedMessage("");
    textareaRef.current?.focus();
    await loadConversations();
  };

  const clearActiveConversation = () => {
    setActiveId(null);
    setActiveConversationKey(null);
    setActivePeer(null);
    setActiveListingId(null);
    setConversationListing(null);
    setMessages([]);
    setOffers([]);
    setDraft("");
    setShowOfferModal(false);
    setAcceptedOfferBanner(null);
    setOfferMode("cash");
    resetTradeOfferDetails();
    setTradeError("");
  };

  const requestDeleteConversation = (conversation) => {
    setDeleteTarget(conversation);
    setDeleteError("");
    setDeleteConfirmOpen(true);
  };

  const deleteConversation = async () => {
    const target = deleteTarget || (
      activeId
        ? { key: activeConversationKey, peerId: activeId, listingId: activeListingId || null }
        : null
    );

    if (!target?.peerId || !user || deletingConversation) return;

    const peerId = target.peerId;
    const listingId = target.listingId || null;
    const conversationKey = target.key || buildConversationKey(peerId, listingId);
    const participantsFilter = `and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`;

    setDeletingConversation(true);
    setDeleteError("");

    let messagesQuery = supabase.from("messages").delete().or(participantsFilter);
    messagesQuery = listingId ? messagesQuery.eq("listing_id", listingId) : messagesQuery.is("listing_id", null);

    let offersQuery = supabase.from("offers").delete().or(participantsFilter);
    offersQuery = listingId ? offersQuery.eq("listing_id", listingId) : offersQuery.is("listing_id", null);

    const [messagesResult, offersResult] = await Promise.all([messagesQuery, offersQuery]);
    const error = messagesResult.error || offersResult.error;

    if (error) {
      setDeleteError(error.message || "Could not delete this chat.");
      setDeletingConversation(false);
      return;
    }

    setConversations((prev) => prev.filter((c) => c.key !== conversationKey));
    setUnreadByPeer((prev) => {
      const next = { ...prev };
      delete next[conversationKey];
      return next;
    });
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeletingConversation(false);
    if (activeConversationKey === conversationKey) {
      clearActiveConversation();
    }
  };

  const resolveConversationListingForSend = async () => {
    if (!conversationListing?.id) return conversationListing;

    try {
      const { data: latestListing, error } = await supabase
        .from("listings")
        .select("id, title, price, user_id, status, flag_reason, listing_type")
        .eq("id", String(conversationListing.id))
        .maybeSingle();

      if (error || !latestListing) return conversationListing;

      const mergedListing = {
        ...conversationListing,
        ...latestListing,
        flag_reason: latestListing.flag_reason ?? conversationListing.flag_reason ?? "",
        status: latestListing.status ?? conversationListing.status ?? "active",
      };

      setConversationListing(mergedListing);
      return mergedListing;
    } catch {
      return conversationListing;
    }
  };

  const sendMessage = async (messageText = draft, options = {}) => {
    const text = messageText.trim();
    if (!text || !activeId || sending) return;

    const latestListing = await resolveConversationListingForSend();

    if (
      latestListing?.status === "flagged" &&
      !flaggedWarningOpen &&
      !acknowledgedFlaggedListingIds.has(String(latestListing.id))
    ) {
      setPendingFlaggedMessage(text);
      setFlaggedWarningOpen(true);
      return;
    }

    await sendMessageNow(text, options);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Send Offer ────────────────────────────────────────────
  const sendOffer = async () => {
    // ── Cash offer ──────────────────────────────────────────
    if (offerMode === "cash") {
      const amount = parseFloat(offerAmount.replace(/[^0-9.]/g, ""));
      if (!amount || amount <= 0) { setOfferError("Please enter a valid amount."); return; }
      if (!conversationListing?.id || !activeId) return;
      setOfferSending(true);
      setOfferError("");

      const offerListingId = conversationListing.id || activeListingId;

      if (sendDraftBeforeOffer && draft.trim()) {
        await sendMessage(draft, { listingId: offerListingId });
        setSendDraftBeforeOffer(false);
      }

      await supabase
        .from("offers")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("listing_id", offerListingId)
        .eq("sender_id", user.id)
        .eq("receiver_id", activeId)
        .eq("status", "pending")
        .eq("offer_type", "cash");

      const { data: newOffer, error } = await supabase
        .from("offers")
        .insert({
          listing_id: offerListingId,
          requested_listing_id: String(offerListingId),
          sender_id: user.id,
          receiver_id: activeId,
          amount,
          status: "pending",
          offer_type: "cash",
        })
        .select()
        .single();

      if (error) { setOfferError("Failed to send offer."); setOfferSending(false); return; }

      setOffers((prev) => [
        ...prev.map((o) =>
          o.sender_id === user.id && o.receiver_id === activeId && o.status === "pending" && !isItemTradeOffer(o)
            ? { ...o, status: "declined" }
            : o
        ),
        newOffer,
      ]);
      setShowOfferModal(false);
      setOfferAmount("");
      setOfferSending(false);
      return;
    }

    // ── Trade offer ─────────────────────────────────────────
    if (!conversationListing?.id || !activeId) return;
    const useCustomTradeItem = tradeOfferMode === "custom" || myTradeListings.length === 0;
    const selectedTradeListing = myTradeListings.find((listing) => String(listing.id) === String(selectedTradeListingId));
    if (!useCustomTradeItem && !selectedTradeListing) {
      setTradeError("Please choose one of your listings to offer.");
      return;
    }
    if (useCustomTradeItem && !tradeTitle.trim()) { setTradeError("Please add a title for your offered item."); return; }
    if (useCustomTradeItem && !tradeCondition) { setTradeError("Please choose the condition of your offered item."); return; }
    if (useCustomTradeItem && !tradeDescription.trim()) { setTradeError("Please add a description."); return; }
    if (useCustomTradeItem && !tradeImage) { setTradeError("Please upload an image for your trade offer."); return; }
    setOfferSending(true);
    setTradeError("");

    const offerListingId = conversationListing.id || activeListingId;

    if (sendDraftBeforeOffer && draft.trim()) {
      await sendMessage(draft, { listingId: offerListingId });
      setSendDraftBeforeOffer(false);
    }

    await supabase
      .from("offers")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("listing_id", offerListingId)
      .eq("sender_id", user.id)
      .eq("receiver_id", activeId)
      .eq("offer_type", "item_trade")
      .eq("status", "pending");

    let imageUrl = null;
    if (useCustomTradeItem && tradeImage) {
      const ext = tradeImage.name.split(".").pop();
      const path = `${user.id}/trade-offers/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(path, tradeImage, { upsert: true });
      if (uploadError) {
        setTradeError("Failed to upload the trade item photo.");
        setOfferSending(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
      imageUrl = urlData?.publicUrl || null;
    }

    const offeredItemTitle = useCustomTradeItem ? tradeTitle.trim() : selectedTradeListing.title;
    const offeredItemDescription = useCustomTradeItem ? tradeDescription.trim() : selectedTradeListing.description || "";
    const offeredItemCondition = useCustomTradeItem ? tradeCondition : selectedTradeListing.condition || "";
    const offeredItemImageUrl = useCustomTradeItem ? imageUrl : selectedTradeListing.image_url || null;

    const { data: newTradeOffer, error } = await supabase
      .from("offers")
      .insert({
        listing_id: offerListingId,
        requested_listing_id: String(offerListingId),
        offered_listing_id: useCustomTradeItem ? null : String(selectedTradeListing.id),
        sender_id: user.id,
        receiver_id: activeId,
        amount: null,
        status: "pending",
        offer_type: "item_trade",
        image_url: offeredItemImageUrl,
        description: offeredItemDescription,
        offered_item_title: offeredItemTitle,
        offered_item_description: offeredItemDescription,
        offered_item_condition: offeredItemCondition,
        offered_item_image_url: offeredItemImageUrl,
      })
      .select()
      .single();

    if (error) {
      console.error(error.message);
      setTradeError("Failed to send trade offer.");
      setOfferSending(false);
      return;
    }

    setOffers((prev) => [
      ...prev.map((o) =>
        isItemTradeOffer(o) && o.sender_id === user.id && o.status === "pending"
          ? { ...o, status: "cancelled" }
          : o
      ),
      {
        ...newTradeOffer,
        offered_listing: useCustomTradeItem ? null : selectedTradeListing,
      },
    ]);

    setShowOfferModal(false);
    resetTradeOfferDetails();
    setOfferSending(false);
  };

  // ── Cancel Offer ──────────────────────────────────────────
  const cancelOffer = async (offerId) => {
    const { data: updatedOffer, error } = await supabase
      .from("offers")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("id", offerId)
      .select()
      .single();

    if (error) { console.error(error.message); return; }
    setOffers((prev) => prev.map((o) => o.id === offerId ? updatedOffer : o));
  };

  // ── Respond to Offer ──────────────────────────────────────
  const finalizeItemTradeOffer = async (updatedOffer) => {
    const requestedListingId = updatedOffer.requested_listing_id || updatedOffer.listing_id || conversationListing?.id;
    const offeredListingId = updatedOffer.offered_listing_id || null;
    if (!requestedListingId) return;

    const { data: requestedListing } = await supabase
      .from("listings")
      .select("id, title, description, user_id, image_url, condition")
      .eq("id", String(requestedListingId))
      .single();

    let offeredListing = null;
    if (offeredListingId) {
      const { data } = await supabase
        .from("listings")
        .select("id, title, description, user_id, image_url, condition")
        .eq("id", String(offeredListingId))
        .single();
      offeredListing = data || null;
    }

    const requestedTitle = requestedListing?.title || conversationListing?.title || "Listed item";
    const offeredTitle = offeredListing?.title || updatedOffer.offered_item_title || "Offered item";
    const sellerId = requestedListing?.user_id || conversationListing?.user_id || activeId;
    const buyerId = updatedOffer.sender_id === sellerId ? updatedOffer.receiver_id : updatedOffer.sender_id;
    const transactionItem = `${requestedTitle} for ${offeredTitle}`;

    const { data: existingTransactions } = await supabase
      .from("transactions")
      .select("id, status, dropoff_id")
      .eq("seller_id", sellerId)
      .eq("buyer_id", buyerId)
      .eq("item", transactionItem)
      .order("created_at", { ascending: false });

    const activeTransaction = (existingTransactions || []).find(
      (t) => !["item_released", "completed", "cancelled"].includes(t.status)
    );

    const transactionId = activeTransaction?.id || buildTradeTransactionId();
    const updatePayload = {
      item: transactionItem,
      requested_item: requestedTitle,
      offered_item: offeredTitle,
      seller_id: sellerId,
      buyer_id: buyerId,
      price: 0,
      listing_id: String(requestedListingId),
      requested_listing_id: String(requestedListingId),
      offered_listing_id: offeredListingId ? String(offeredListingId) : null,
      transaction_type: "item_trade",
      offered_item_description: offeredListing?.description || updatedOffer.offered_item_description || updatedOffer.description || "",
      offered_item_condition: offeredListing?.condition || updatedOffer.offered_item_condition || "",
      offered_item_image_url: offeredListing?.image_url || updatedOffer.offered_item_image_url || updatedOffer.image_url || null,
    };

    const transactionRequest = activeTransaction
      ? supabase.from("transactions").update(updatePayload).eq("id", activeTransaction.id)
      : supabase.from("transactions").insert({ ...updatePayload, id: transactionId, status: "awaiting_dropoff" });

    const listingUpdate = {
      sold_price: null,
      status: "sold",
      traded_at: new Date().toISOString(),
      traded_transaction_id: transactionId,
    };
    const requests = [
      transactionRequest,
      supabase.from("listings").update(listingUpdate).eq("id", String(requestedListingId)),
    ];

    if (offeredListingId) {
      requests.push(supabase.from("listings").update(listingUpdate).eq("id", String(offeredListingId)));
    }

    requests.push(
      supabase
        .from("offers")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("listing_id", String(requestedListingId))
        .eq("offer_type", "item_trade")
        .eq("status", "pending")
    );

    await Promise.allSettled(requests);
  };

  const respondToOffer = async (offerId, accept) => {
    setOfferActionError("");

    const existingOffer = offers.find((offer) => offer.id === offerId);
    if (accept && existingOffer && !isItemTradeOffer(existingOffer)) {
      const { data, error } = await supabase.rpc("accept_cash_offer_for_payment", {
        p_offer_id: String(offerId),
      });

      if (error) {
        console.error(error.message);
        setOfferActionError(error.message || "Could not prepare the PayFast payment transaction.");
        return;
      }

      const accepted = Array.isArray(data) ? data[0] : data;
      setOffers((prev) =>
        prev.map((offer) =>
          offer.id === offerId
            ? { ...offer, status: "accepted", responded_at: new Date().toISOString() }
            : offer.listing_id === existingOffer.listing_id && offer.status === "pending"
              ? { ...offer, status: "declined", responded_at: new Date().toISOString() }
              : offer
        )
      );

      if (iAmTheLister) {
        setAcceptedOfferBanner({
          amount: accepted?.amount ?? existingOffer.amount,
          listingTitle: accepted?.listing_title || conversationListing?.title || "Marketplace item",
        });
      }
      return;
    }

    const newStatus = accept ? "accepted" : "declined";
    const { data: updatedOffer, error } = await supabase
      .from("offers")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", offerId)
      .select()
      .single();

    if (error) {
      console.error(error.message);
      setOfferActionError(error.message || "Could not update this offer.");
      return;
    }
    setOffers((prev) => prev.map((o) => o.id === offerId ? updatedOffer : o));

    // Trade offers accepted — no transaction/listing update needed (no cash)
    if (accept && updatedOffer && isItemTradeOffer(updatedOffer)) {
      await finalizeItemTradeOffer(updatedOffer);
      return;
    }

    if (accept && updatedOffer && !isItemTradeOffer(updatedOffer)) {
      const { data: listing } = await supabase
        .from("listings")
        .select("id, title, user_id")
        .eq("id", updatedOffer.listing_id)
        .single();

      const listingTitle = listing?.title || conversationListing?.title || "Marketplace item";
      const sellerId = listing?.user_id || conversationListing?.user_id || activeId;
      const buyerId = updatedOffer.sender_id === sellerId ? updatedOffer.receiver_id : updatedOffer.sender_id;

      const { data: existingTransactions } = await supabase
        .from("transactions")
        .select("id, status, dropoff_id")
        .eq("seller_id", sellerId)
        .eq("buyer_id", buyerId)
        .eq("item", listingTitle)
        .order("created_at", { ascending: false });

      const activeTransaction = (existingTransactions || []).find(
        (t) => !["item_released", "completed", "cancelled"].includes(t.status)
      );

      const updatePayload = {
        item: listingTitle,
        seller_id: sellerId,
        buyer_id: buyerId,
        price: updatedOffer.amount,
        listing_id: updatedOffer.listing_id,
        transaction_type: "cash_sale",
        payment_status: "unpaid",
        payment_provider: "payfast",
        payment_method: "payfast_sandbox",
        status: "awaiting_payment",
      };

      const insertPayload = {
        ...updatePayload,
        id: buildTradeTransactionId(),
      };

      const transactionRequest = activeTransaction
        ? supabase.from("transactions").update(updatePayload).eq("id", activeTransaction.id)
        : supabase.from("transactions").insert(insertPayload);

      const offerCleanupRequest = supabase
        .from("offers")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("listing_id", updatedOffer.listing_id)
        .eq("status", "pending");

      await Promise.allSettled([transactionRequest, offerCleanupRequest]);

      if (iAmTheLister) {
        setAcceptedOfferBanner({ amount: updatedOffer.amount, listingTitle });
      }
    }
  };

  const peerName = (profile) => profile?.display_name || profile?.name || "Unknown User";

  const filteredConvs = conversations.filter((c) => {
    if (!search.trim()) return true;
    const label = `${peerName(c.profile)} ${c.listing?.title || ""}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

  const latestTextMessage = [...messages].reverse().find((message) => message.content?.trim());
  const showSellerQuickReplies = Boolean(
    iAmTheLister &&
    activeId &&
    latestTextMessage &&
    latestTextMessage.sender_id === activeId
  );
  const listingOwnerLabel = iAmTheLister ? "Your listing" : `${peerName(activePeer)}'s listing`;
  const profileActionLabel = iAmTheLister ? "View buyer" : "View seller";
  const hasAcceptedOffer = offers.some((o) => o.status === "accepted");

  const dateLabel = (dateStr) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  };

  if (!user) return null;

  return (
    <section className="msg-page">

      {/* ── Sidebar ── */}
      <aside className={`msg-sidebar ${activeId ? "msg-sidebar--hidden-mobile" : ""}`}>
        <header className="msg-sidebar__header">
          <button className="msg-back-btn" onClick={onBack}>← Back</button>
          <h2 className="msg-sidebar__title">Messages</h2>
        </header>

        <section className="msg-search-wrap">
          <svg className="msg-search-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="msg-search"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        <ul className="msg-conv-list">
          {convsLoading && (
            <li className="msg-conv-empty"><span className="msg-spinner" /></li>
          )}

          {!convsLoading && filteredConvs.length === 0 && (
            <li className="msg-conv-empty">
              <p className="msg-conv-empty__icon">💬</p>
              <p className="msg-conv-empty__text">No conversations yet</p>
              <p className="msg-conv-empty__sub">Message a seller from their listing</p>
            </li>
          )}

          {filteredConvs.map((conv) => {
            const unread = unreadByPeer[conv.key] || 0;
            const isActive = activeConversationKey === conv.key;
            const threadTitle = conv.listing?.title
              ? `${peerName(conv.profile)} - ${conv.listing.title}`
              : peerName(conv.profile);
            return (
              <li key={conv.key} className="msg-conv-row">
                <button
                  className={`msg-conv-item ${isActive ? "msg-conv-item--active" : ""} ${unread > 0 && !isActive ? "msg-conv-item--unread" : ""}`}
                  onClick={() => openChat(conv.peerId, conv.listingId)}
                  type="button"
                >
                  <Avatar url={conv.profile?.avatar_url} name={peerName(conv.profile)} size={46} />
                  <section className="msg-conv-item__body">
                    <section className="msg-conv-item__top">
                      <span className={`msg-conv-item__name ${unread > 0 && !isActive ? "msg-conv-item__name--unread" : ""}`}>
                        {threadTitle}
                      </span>
                      {conv.lastMsg && (
                        <span className="msg-conv-item__time">{timeLabel(conv.lastMsg.created_at)}</span>
                      )}
                    </section>
                    <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      {conv.lastMsg && (
                        <span className={`msg-conv-item__preview ${unread > 0 && !isActive ? "msg-conv-item__preview--unread" : ""}`}>
                          {conv.lastMsg.sender_id === user.id ? "You: " : ""}
                          {conv.lastMsg.content}
                        </span>
                      )}
                      {unread > 0 && !isActive && (
                        <span style={{
                          background: "#25d366",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1,
                          borderRadius: "50%",
                          minWidth: 20,
                          height: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px",
                          flexShrink: 0,
                        }}>
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </section>
                  </section>
                </button>
                <button
                  className="msg-conv-delete"
                  onClick={(event) => { event.stopPropagation(); requestDeleteConversation(conv); }}
                  type="button"
                  aria-label="Delete chat"
                  title="Delete chat"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Chat Pane ── */}
      <section className={`msg-chat ${!activeId ? "msg-chat--empty-state" : ""}`}>
        {!activeId ? (
          <section className="msg-chat__empty">
            <span className="msg-chat__empty-icon">💬</span>
            <h3>Your Messages</h3>
            <p>Select a conversation or tap <strong>Message Seller</strong> on any listing.</p>
          </section>
        ) : (
          <>
            <header className="msg-chat__header">
              <button
                className="msg-chat__back-mobile"
                onClick={() => { setActiveId(null); setActiveConversationKey(null); setActiveListingId(null); }}
              >←</button>
              {activePeer && (
                <>
                  <Avatar url={activePeer.avatar_url} name={peerName(activePeer)} size={38} />
                  <header className="msg-chat__header-info">
                    <button
                      className="msg-chat__header-name msg-chat__header-name--link"
                      onClick={() => onViewProfile?.(activePeer.id)}
                      type="button"
                    >
                      {conversationListing?.title
                        ? `${peerName(activePeer)} - ${conversationListing.title}`
                        : peerName(activePeer)}
                    </button>
                    {activePeer.institution && (
                      <span className="msg-chat__header-sub">{activePeer.institution}</span>
                    )}
                  </header>
                </>
              )}
            </header>

            {/* ── Buyer Info Banner ── */}
            {conversationListing && activePeer && (
              <section className="msg-buyer-banner">
                <article className="msg-buyer-banner__listing-row">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  <span>
                    {conversationListing?.title
                      ? <>{listingOwnerLabel} · <strong>{conversationListing.title}</strong>{conversationListing.price != null ? <> · <em>R{Number(conversationListing.price).toLocaleString("en-ZA")}</em></> : null}</>
                      : "Marketplace listing"}
                  </span>
                </article>
                <article className="msg-buyer-banner__card">
                  <Avatar url={activePeer.avatar_url} name={peerName(activePeer)} size={38} />
                  <article className="msg-buyer-banner__card-info">
                    <span className="msg-buyer-banner__card-name">{peerName(activePeer)}</span>
                    {activePeer.institution && (
                      <span className="msg-buyer-banner__card-sub">{activePeer.institution}</span>
                    )}
                  </article>
                  <section style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="msg-buyer-banner__btn msg-buyer-banner__btn--offer"
                      onClick={() => {
                        if (!hasAcceptedOffer) {
                          const lt = conversationListing?.listing_type || "sale";
                          setOfferMode(lt === "trade" ? "trade" : "cash");
                          setOfferError("");
                          setTradeError("");
                          setOfferAmount("");
                          resetTradeOfferDetails();
                          setShowOfferModal(true);
                        }
                      }}
                      disabled={hasAcceptedOffer}
                      title={hasAcceptedOffer ? "An offer has already been accepted" : undefined}
                      type="button"
                    >
                      Send Offer
                    </button>
                    <button
                      className="msg-buyer-banner__btn"
                      onClick={() => onViewProfile?.(activePeer.id)}
                      type="button"
                    >
                      {profileActionLabel}
                    </button>
                  </section>
                </article>
              </section>
            )}

            {/* ── Send Offer Modal ── */}
            {showOfferModal && conversationListing && (() => {
              const lt = conversationListing.listing_type || "sale";
              const isSaleAndTrade = lt === "sale_and_trade";
              const isTradeOnly = lt === "trade";
              const isCashMode = offerMode === "cash";
              const useCustomTradeItem = tradeOfferMode === "custom" || myTradeListings.length === 0;
              const customTradeReady = Boolean(
                tradeTitle.trim() &&
                tradeDescription.trim() &&
                tradeCondition &&
                tradeImage
              );
              const listingTradeReady = Boolean(selectedTradeListingId) && !tradeListingsLoading;
              const canSendTradeOffer = isCashMode ? true : (useCustomTradeItem ? customTradeReady : listingTradeReady);

              return (
                <section className="msg-offer-modal-overlay" onClick={() => setShowOfferModal(false)}>
                  <section className="msg-offer-modal" onClick={(e) => e.stopPropagation()}>
                    <h3 className="msg-offer-modal__title">Send an Offer</h3>

                    {/* Mode toggle — only for sale_and_trade listings */}
                    {isSaleAndTrade && (
                      <section style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button
                          type="button"
                          onClick={() => { setOfferMode("cash"); setOfferError(""); setTradeError(""); }}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                            background: isCashMode ? "var(--primary, #6c47ff)" : "var(--surface-2, #f0f0f0)",
                            color: isCashMode ? "#fff" : "inherit",
                            fontWeight: 600, fontSize: 14,
                          }}
                        >
                          💵 Cash offer
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOfferMode("trade"); setOfferError(""); setTradeError(""); }}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                            background: !isCashMode ? "var(--primary, #6c47ff)" : "var(--surface-2, #f0f0f0)",
                            color: !isCashMode ? "#fff" : "inherit",
                            fontWeight: 600, fontSize: 14,
                          }}
                        >
                          🔄 Trade offer
                        </button>
                      </section>
                    )}

                    {/* Cash offer fields */}
                    {isCashMode && !isTradeOnly && (
                      <>
                        <p className="msg-offer-modal__sub">
                          Listing price: <strong>R{Number(conversationListing.price).toLocaleString("en-ZA")}</strong>
                        </p>
                        <section className="msg-offer-modal__input-wrap">
                          <span className="msg-offer-modal__currency">R</span>
                          <input
                            className="msg-offer-modal__input"
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            maxLength={OFFER_PRICE_MAX_CHARS}
                            value={offerAmount}
                            onChange={(e) => { setOfferAmount(clampOfferAmount(e.target.value)); setOfferError(""); }}
                            autoFocus
                          />
                        </section>
                        {offerError && <p className="msg-offer-modal__error">{offerError}</p>}
                      </>
                    )}

                    {/* Trade offer fields */}
                    {(!isCashMode || isTradeOnly) && (
                      <>
                        <p className="msg-offer-modal__sub">Choose what you're offering in exchange:</p>
                        <section className="msg-trade-mode-toggle" aria-label="Trade offer type">
                          <button
                            className={`msg-trade-mode-toggle__btn ${!useCustomTradeItem ? "msg-trade-mode-toggle__btn--active" : ""}`}
                            onClick={() => { setTradeOfferMode("listing"); setTradeError(""); loadMyTradeListings(); }}
                            disabled={tradeListingsLoading}
                            type="button"
                          >
                            My listing
                          </button>
                          <button
                            className={`msg-trade-mode-toggle__btn ${useCustomTradeItem ? "msg-trade-mode-toggle__btn--active" : ""}`}
                            onClick={() => { setTradeOfferMode("custom"); setTradeError(""); }}
                            type="button"
                          >
                            Another item
                          </button>
                        </section>
                        {!useCustomTradeItem && (
                          <section className="msg-trade-listing-picker">
                            {tradeListingsLoading && <p className="msg-trade-listing-picker__empty">Loading your listings...</p>}
                            {!tradeListingsLoading && myTradeListings.length === 0 && (
                              <p className="msg-trade-listing-picker__empty">You do not have an active listing to offer. Add another item instead.</p>
                            )}
                            {!tradeListingsLoading && myTradeListings.map((listing) => (
                              <button
                                key={listing.id}
                                className={`msg-trade-listing-option ${String(selectedTradeListingId) === String(listing.id) ? "msg-trade-listing-option--selected" : ""}`}
                                onClick={() => { setSelectedTradeListingId(String(listing.id)); setTradeError(""); }}
                                type="button"
                              >
                                {listing.image_url ? (
                                  <img src={listing.image_url} alt="" className="msg-trade-listing-option__image" />
                                ) : (
                                  <span className="msg-trade-listing-option__image msg-trade-listing-option__image--empty" />
                                )}
                                <span className="msg-trade-listing-option__body">
                                  <strong>{listing.title}</strong>
                                  <small>{listing.condition || "Condition not set"}</small>
                                </span>
                              </button>
                            ))}
                          </section>
                        )}
                        {useCustomTradeItem && (
                          <section className="msg-custom-trade-form">
                            <input
                              className="msg-custom-trade-form__input"
                              placeholder="Item title"
                              value={tradeTitle}
                              onChange={(e) => { setTradeTitle(e.target.value); setTradeError(""); }}
                              autoFocus={isTradeOnly}
                            />
                            <select
                              className="msg-custom-trade-form__input"
                              value={tradeCondition}
                              onChange={(e) => { setTradeCondition(e.target.value); setTradeError(""); }}
                            >
                              <option value="" disabled>Condition</option>
                              {TRADE_CONDITIONS.map((condition) => (
                                <option key={condition} value={condition}>{condition}</option>
                              ))}
                            </select>
                            <textarea
                              className="msg-custom-trade-form__textarea"
                              placeholder="Describe the item - age, any wear, what's included, reason for trade..."
                              value={tradeDescription}
                              onChange={(e) => { setTradeDescription(e.target.value); setTradeError(""); }}
                              rows={3}
                        />
                            <label className="msg-custom-trade-form__upload">
                          <span style={{ fontSize: 13, color: "var(--text-muted, #888)", display: "block", marginBottom: 6 }}>
                            📷 Attach a photo
                          </span>
                          <input
                            type="file"
                            accept={TRADE_OFFER_IMAGE_ACCEPT}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setTradeImage(file);
                              const reader = new FileReader();
                              reader.onload = (ev) => setTradeImagePreview(ev.target.result);
                              reader.readAsDataURL(file);
                              setTradeError("");
                            }}
                          />
                          {tradeImagePreview ? (
                            <figure style={{ position: "relative", display: "inline-block", margin: 0 }}>
                              <img
                                src={tradeImagePreview}
                                alt="Trade item preview"
                                style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8, display: "block" }}
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setTradeImage(null); setTradeImagePreview(null); }}
                                style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 14, lineHeight: "24px", textAlign: "center" }}
                              >
                                ×
                              </button>
                            </figure>
                          ) : (
                            <output style={{ display: "block", border: "2px dashed var(--border, #e0e0e0)", borderRadius: 8, padding: "18px 0", textAlign: "center", color: "var(--text-muted, #888)", fontSize: 13 }}>
                              Click to upload image
                            </output>
                          )}
                        </label>
                          </section>
                        )}
                        {tradeError && <p className="msg-offer-modal__error">{tradeError}</p>}
                      </>
                    )}

                    <section className="msg-offer-modal__actions" style={{ marginTop: 16 }}>
                      <button className="msg-offer-modal__cancel" onClick={() => setShowOfferModal(false)} type="button">Cancel</button>
                      <button className="msg-offer-modal__send" onClick={sendOffer} disabled={offerSending || !canSendTradeOffer} type="button">
                        {offerSending ? "Sending…" : "Send Offer"}
                      </button>
                    </section>
                  </section>
                </section>
              );
            })()}

            {/* ── Flagged Listing Warning ── */}
            {flaggedWarningOpen && conversationListing?.status === "flagged" && (
              <aside
                role="alertdialog"
                aria-labelledby="messages-flagged-warning-title"
                aria-live="assertive"
                style={flaggedWarningToastStyle()}
              >
                <button
                  onClick={() => { setFlaggedWarningOpen(false); setPendingFlaggedMessage(""); }}
                  aria-label="Close flagged listing warning"
                  type="button"
                  style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                >
                  x
                </button>
                <h3 id="messages-flagged-warning-title" style={{ margin: "0 28px 8px 0" }}>
                  Flagged listing warning
                </h3>
                <p style={{ margin: "0 0 8px" }}>This listing has been flagged by an admin.</p>
                <p style={{ margin: "0 0 16px" }}>
                  <strong>Reason:</strong> {conversationListing.flag_reason?.trim() || "No reason was provided."}
                </p>
                <section style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    className="msg-offer-modal__cancel"
                    onClick={() => { setFlaggedWarningOpen(false); setPendingFlaggedMessage(""); }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="msg-offer-modal__send"
                    onClick={() => {
                      const text = pendingFlaggedMessage;
                      setFlaggedWarningOpen(false);
                      setPendingFlaggedMessage("");
                      setAcknowledgedFlaggedListingIds((prev) => {
                        const next = new Set(prev);
                        if (conversationListing?.id != null) next.add(String(conversationListing.id));
                        return next;
                      });
                      sendMessageNow(text);
                    }}
                    type="button"
                  >
                    Continue
                  </button>
                </section>
              </aside>
            )}

            <section className="msg-chat__body">
              {offerActionError && (
                <article className="msg-offer-action-error" role="alert">
                  {offerActionError}
                </article>
              )}
              {msgsLoading && (
                <section className="msg-chat__loading"><span className="msg-spinner" /></section>
              )}

              {!msgsLoading && messages.length === 0 && (
                <section className="msg-chat__no-msgs">
                  <span>👋</span>
                  <p>Say hello! This is the start of your conversation.</p>
                </section>
              )}

              {(() => {
                const timeline = [
                  ...messages.map((m) => ({ ...m, _type: "message" })),
                  ...offers.map((o) => ({ ...o, _type: "offer" })),
                ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                const groups = {};
                for (const item of timeline) {
                  const date = new Date(item.created_at).toDateString();
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(item);
                }

                return Object.entries(groups).map(([date, items]) => (
                  <section key={date}>
                    <span className="msg-date-divider"><span>{dateLabel(date)}</span></span>
                    {items.map((item) => {
                      if (item._type === "offer") {
                        const iMadeOffer = item.sender_id === user.id;
                        const isPending = item.status === "pending";
                        const isAccepted = item.status === "accepted";
                        const isDeclined = item.status === "declined";
                        const isCancelled = item.status === "cancelled";
                        const isTrade = isItemTradeOffer(item);
                        const offeredItemTitle = getOfferedItemTitle(item);
                        const offeredItemDescription = getOfferedItemDescription(item);
                        const offeredItemCondition = getOfferedItemCondition(item);
                        const offeredItemImageUrl = getOfferedItemImageUrl(item);
                        const offerTickStatus = item.is_read ? "read" : "sent";

                        return (
                          <article key={`offer-${item.id}`} className={`msg-offer-card-wrap ${iMadeOffer ? "msg-offer-card-wrap--mine" : "msg-offer-card-wrap--theirs"}`}>
                            {!iMadeOffer && <Avatar url={activePeer?.avatar_url} name={peerName(activePeer)} size={28} />}
                            <article
                              className={`msg-offer-card ${iMadeOffer ? "msg-offer-card--mine" : "msg-offer-card--theirs"} ${isAccepted ? "msg-offer-card--accepted" : isDeclined ? "msg-offer-card--declined" : ""}`}
                              style={isTrade ? { padding: 0, overflow: "hidden", maxWidth: 300 } : {}}
                            >
                              {isTrade ? (
                                <>
                                  <header style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                                    <span style={{ fontSize: 14 }}>🔄</span>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>Trade offer</span>
                                    {isAccepted && <span style={{ marginLeft: "auto", fontSize: 11, color: "#53d769", fontWeight: 700 }}>✓ Accepted</span>}
                                    {isDeclined && <span style={{ marginLeft: "auto", fontSize: 11, color: "#ff6b6b", fontWeight: 700 }}>✕ Declined</span>}
                                    {isCancelled && <span style={{ marginLeft: "auto", fontSize: 11, color: "#ff6b6b", fontWeight: 700 }}>✕ Cancelled</span>}
                                  </header>

                                  <section style={{ padding: "10px 12px 8px" }}>
                                    <strong style={{ display: "block", fontSize: 14, color: "#fff", lineHeight: 1.3 }}>
                                      {offeredItemTitle}
                                    </strong>
                                    {offeredItemCondition && (
                                      <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.62)" }}>
                                        Condition: {offeredItemCondition}
                                      </span>
                                    )}
                                  </section>

                                  {offeredItemImageUrl && (
                                    <img
                                      src={offeredItemImageUrl}
                                      alt="Trade offer item"
                                      style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 240 }}
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  )}

                                  {offeredItemDescription && (
                                    <p style={{ margin: 0, padding: "10px 12px", fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#fff" }}>
                                      {offeredItemDescription}
                                    </p>
                                  )}

                                  <section style={{ padding: "8px 12px 10px" }}>
                                    {isPending && !iMadeOffer && (
                                      <section style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                        <button
                                          onClick={() => respondToOffer(item.id, false)}
                                          type="button"
                                          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.15)", color: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                                        >
                                          Decline
                                        </button>
                                        <button
                                          onClick={() => respondToOffer(item.id, true)}
                                          type="button"
                                          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "#53d769", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                                        >
                                          Accept
                                        </button>
                                      </section>
                                    )}
                                    {isPending && iMadeOffer && (
                                      <section className="msg-offer-card__actions">
                                        <p className="msg-offer-card__status msg-offer-card__status--pending" style={{ margin: 0 }}>Waiting for response…</p>
                                        <button className="msg-offer-card__cancel-offer" onClick={() => cancelOffer(item.id)} type="button">Cancel Offer</button>
                                      </section>
                                    )}
                                    {isAccepted && (
                                      <section className="msg-offer-card__accepted-block">
                                        <p className="msg-offer-card__status msg-offer-card__status--accepted" style={{ margin: 0 }}>✓ Trade offer accepted</p>
                                        <p className="msg-offer-card__accepted-note">The seller can book a drop-off slot in My Bookings. Collection opens after staff confirms the drop-off.</p>
                                        <button className="msg-offer-card__bookings-btn" onClick={() => onGoToBookings?.()} type="button">Go to My Bookings →</button>
                                      </section>
                                    )}
                                    <span style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end", marginTop: 6, fontSize: 11, opacity: 0.6 }}>
                                      {new Date(item.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                                      {iMadeOffer && <ReadTicks status={offerTickStatus} />}
                                    </span>
                                  </section>
                                </>
                              ) : (
                                <>
                                  <header className="msg-offer-card__header">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                    </svg>
                                    <span className="msg-offer-card__label">
                                      {iMadeOffer ? `You offered ${peerName(activePeer)}` : `${peerName(activePeer)} offered you`}
                                    </span>
                                  </header>
                                  <p className="msg-offer-card__note">
                                    This offer uses PayFast sandbox checkout after it is accepted. No real money is transferred.
                                  </p>
                                  <p className="msg-offer-card__amount">
                                    R{Number(item.amount).toLocaleString("en-ZA")}
                                  </p>
                                  {isPending && !iMadeOffer && (
                                    <section className="msg-offer-card__actions">
                                      <button className="msg-offer-card__decline" onClick={() => respondToOffer(item.id, false)} type="button">Decline</button>
                                      <button className="msg-offer-card__accept" onClick={() => respondToOffer(item.id, true)} type="button">Accept</button>
                                    </section>
                                  )}
                                  {isPending && iMadeOffer && (
                                    <section className="msg-offer-card__actions">
                                      <p className="msg-offer-card__status msg-offer-card__status--pending" style={{ margin: 0 }}>Waiting for response…</p>
                                      <button className="msg-offer-card__cancel-offer" onClick={() => cancelOffer(item.id)} type="button">Cancel Offer</button>
                                    </section>
                                  )}
                                  {isAccepted && (
                                    <section className="msg-offer-card__accepted-block">
                                      <p className="msg-offer-card__status msg-offer-card__status--accepted" style={{ margin: 0 }}>✓ Offer accepted</p>
                                      <p className="msg-offer-card__accepted-note">The buyer must pay with PayFast sandbox in My Bookings before facility drop-off can be booked.</p>
                                      <button className="msg-offer-card__bookings-btn" onClick={() => onGoToBookings?.()} type="button">Go to My Bookings →</button>
                                    </section>
                                  )}
                                  {isDeclined && <p className="msg-offer-card__status msg-offer-card__status--declined">✕ Offer declined</p>}
                                  {isCancelled && <p className="msg-offer-card__status msg-offer-card__status--declined">✕ Offer cancelled</p>}
                                  {iMadeOffer && (
                                    <section style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                                      <ReadTicks status={offerTickStatus} />
                                    </section>
                                  )}
                                </>
                              )}
                            </article>
                          </article>
                        );
                      }

                      // Regular message bubble
                      const mine = item.sender_id === user.id;
                      const tickStatus = !item.id ? "sending" : item.is_read ? "read" : "sent";
                      const isCollectionReadyMsg =
                        !mine &&
                        typeof item.content === "string" &&
                        item.content.includes("You can now book your collection slot in My Bookings.");
                      const isMeetupProposedMsg =
                        !mine &&
                        typeof item.content === "string" &&
                        item.content.includes("Go to My Bookings to accept or decline.");
                      return (
                        <section key={item.id ?? `opt-${item.created_at}`} className={`msg-bubble-wrap ${mine ? "msg-bubble-wrap--mine" : "msg-bubble-wrap--theirs"}`}>
                          {!mine && <Avatar url={activePeer?.avatar_url} name={peerName(activePeer)} size={28} />}
                          <section className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}>
                            <p>{item.content}</p>
                            {(isCollectionReadyMsg || isMeetupProposedMsg) && (
                              <button
                                className="msg-offer-card__bookings-btn"
                                onClick={() => onGoToBookings?.()}
                                type="button"
                                style={{ marginTop: 8, width: "100%" }}
                              >
                                Go to My Bookings →
                              </button>
                            )}
                          <span className="msg-bubble__time" style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                            {new Date(item.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                            {mine && <ReadTicks status={tickStatus} />}
                          </span>
                        </section>
                      </section>
                    );
                    })}
                  </section>
                ));
              })()}
              <span ref={bottomRef} />
            </section>

            {/* ── Accepted Offer Confirmation Banner ── */}
            {acceptedOfferBanner && (
              <article className="msg-offer-card-wrap msg-offer-card-wrap--theirs msg-accepted-banner-wrap">
                <article className="msg-offer-card msg-offer-card--theirs msg-offer-card--accepted msg-accepted-banner">
                  <header className="msg-offer-card__header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="msg-offer-card__label" style={{ color: "var(--green)" }}>Offer Accepted!</span>
                  </header>
                  <p className="msg-offer-card__amount">
                    R{Number(acceptedOfferBanner.amount).toLocaleString("en-ZA")}
                  </p>
                  <p className="msg-offer-card__note" style={{ color: "rgba(255,255,255,0.6)" }}>
                    You accepted the offer for <strong style={{ color: "#fff" }}>{acceptedOfferBanner.listingTitle}</strong>. The buyer can now pay with PayFast sandbox from My Bookings.
                  </p>
                  <section className="msg-offer-card__actions">
                    <button
                      className="msg-offer-card__accept msg-accepted-banner__bookings-btn"
                      onClick={() => onGoToBookings?.()}
                      type="button"
                    >
                      Go to My Bookings →
                    </button>
                    <button
                      className="msg-offer-card__decline"
                      onClick={() => setAcceptedOfferBanner(null)}
                      type="button"
                      style={{ flex: "0 0 auto", padding: "9px 14px" }}
                    >
                      Dismiss
                    </button>
                  </section>
                </article>
              </article>
            )}

            <footer className="msg-composer">
              {showSellerQuickReplies && (
                <section className="msg-composer__quick-replies" aria-label="Seller quick replies">
                  {SELLER_QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply}
                      className="msg-composer__quick-reply"
                      onClick={() => sendMessage(reply)}
                      disabled={sending}
                      type="button"
                    >
                      {reply}
                    </button>
                  ))}
                </section>
              )}
              <section className="msg-composer__row">
                <textarea
                  ref={textareaRef}
                  className="msg-composer__input"
                  placeholder="Type a message… (Enter to send)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sending}
                />
                <button
                  className={`msg-composer__send ${draft.trim() ? "msg-composer__send--active" : ""}`}
                  onClick={() => sendMessage()}
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </section>
            </footer>
          </>
        )}
      </section>
      {/* ── Delete Confirm Modal ── */}
            {deleteConfirmOpen && (
              <section className="msg-offer-modal-overlay" onClick={() => !deletingConversation && setDeleteConfirmOpen(false)}>
                <section className="msg-delete-modal" onClick={(e) => e.stopPropagation()}>
                  <span className="msg-delete-modal__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                  </span>
                  <h3 className="msg-offer-modal__title">Delete this chat?</h3>
                  <p className="msg-delete-modal__copy">
                    This will permanently remove the messages and offers in this conversation.
                  </p>
                  {deleteError && <p className="msg-offer-modal__error">{deleteError}</p>}
                  <section className="msg-offer-modal__actions">
                    <button
                      className="msg-offer-modal__cancel"
                      onClick={() => setDeleteConfirmOpen(false)}
                      disabled={deletingConversation}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="msg-delete-modal__confirm"
                      onClick={deleteConversation}
                      disabled={deletingConversation}
                      type="button"
                    >
                      {deletingConversation ? "Deleting..." : "Delete chat"}
                    </button>
                  </section>
                </section>
              </section>
            )}
    </section>
  );
}
