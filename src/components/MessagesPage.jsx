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

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function buildConversationKey(peerId, listingId = null) {
  return `${peerId}::${listingId || "general"}`;
}

// Small prep work happens in this helper before the UI uses the result.
// It keeps lookup, formatting, or data shaping out of the render path.
function buildOfferPreview(offer, currentUserId) {
  if (!offer) return "";
  const amount = `R${Number(offer.amount).toLocaleString("en-ZA")}`;
  if (offer.status === "accepted") return `Offer accepted: ${amount}`;
  if (offer.status === "declined") return `Offer declined: ${amount}`;
  if (offer.status === "cancelled") return `Offer cancelled: ${amount}`;
  const sentByMe = offer.sender_id === currentUserId;
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
    <div
      className="msg-avatar msg-avatar--placeholder"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
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
  onUnreadChange,   // ← callback(count) so parent can update navbar badge
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

  // Buyer info banner: shown to the lister when a buyer messages about a listing
  const [iAmTheLister, setIAmTheLister] = useState(false);
  const [conversationListing, setConversationListing] = useState(null);

  // Offer state
  const [offers, setOffers] = useState([]); // offers for this conversation
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerSending, setOfferSending] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [sendDraftBeforeOffer, setSendDraftBeforeOffer] = useState(false);

  const bottomRef = useRef(null);

  function clampOfferAmount(value) {
    const cleaned = String(value ?? "").replace(",", ".").replace(/[^0-9.]/g, "");
    const dotIndex = cleaned.indexOf(".");
    const whole = (dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex))
      .replace(/\./g, "")
      .slice(0, OFFER_PRICE_MAX_DIGITS);

    if (dotIndex === -1) {
      return whole;
    }

    const cents = cleaned
      .slice(dotIndex + 1)
      .replace(/\./g, "")
      .slice(0, 2);

    return `${whole}.${cents}`.slice(0, OFFER_PRICE_MAX_CHARS);
  }
  const textareaRef = useRef(null);
  const realtimeRef = useRef(null);

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
      .select("id, created_at, sender_id, receiver_id, amount, status, listing_id, is_read")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs && !offerRows) { setConvsLoading(false); return; }

    // Build per-thread last message map
    const threadMap = new Map();
    const unreadMap = {};

    for (const m of msgs || []) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const conversationKey = buildConversationKey(peerId, m.listing_id);

      if (!threadMap.has(conversationKey)) {
        threadMap.set(conversationKey, { peerId, listingId: m.listing_id || null, lastMsg: m });
      }

      // Count unread messages sent TO me (not from me) that aren't read
      if (m.receiver_id === user.id && !m.is_read) {
        unreadMap[conversationKey] = (unreadMap[conversationKey] || 0) + 1;
      }
    }

    for (const offer of offerRows || []) {
      const peerId = offer.sender_id === user.id ? offer.receiver_id : offer.sender_id;
      const conversationKey = buildConversationKey(peerId, offer.listing_id);

      // FIX 1: Count unread offers received by me using the new is_read column
      if (offer.receiver_id === user.id && !offer.is_read) {
        unreadMap[conversationKey] = (unreadMap[conversationKey] || 0) + 1;
      }

      // FIX 2: Build offer preview and let it win if it's newer than existing lastMsg
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

    const peerIds = [...new Set([...threadMap.values()].map((thread) => thread.peerId).filter(Boolean))];
    const listingIds = [...new Set([...threadMap.values()].map((thread) => thread.listingId).filter(Boolean))];
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
        .select("id, title, price, user_id")
        .in("id", listingIds);
      listings = data || [];
    }

    const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const listingById = Object.fromEntries(listings.map((listing) => [listing.id, listing]));

    const convList = [...threadMap.entries()].map(([conversationKey, thread]) => ({
      key: conversationKey,
      peerId: thread.peerId,
      listingId: thread.listingId,
      profile: profileById[thread.peerId] || null,
      listing: thread.listingId ? listingById[thread.listingId] || null : null,
      lastMsg: thread.lastMsg,
    }));

    // Sort by most recent lastMsg
    convList.sort((a, b) => {
      const aTime = a.lastMsg ? new Date(a.lastMsg.created_at) : 0;
      const bTime = b.lastMsg ? new Date(b.lastMsg.created_at) : 0;
      return bTime - aTime;
    });

    setConversations(convList);
    setConvsLoading(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Auto-open chat from listing ───────────────────────────
  useEffect(() => {
    if (!initialRecipientId || !user) return;
    async function openInitialChat() {
      setActiveListingId(initialListingId || null);
      await openChat(initialRecipientId, initialListingId || null);
      if (initialDraft) {
        setDraft(initialDraft);
      } else if (initialListingTitle) {
        setDraft(`Hi! I'm interested in your listing: "${initialListingTitle}". Is it still available?`);
      }
      if (initialAction === "offer") {
        setOfferError("");
        setOfferAmount("");
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

    // Mark messages as read
    let query = supabase
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", peerId)
      .eq("is_read", false);
    query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null);
    await query;

    // FIX: Also mark offers as read when chat is opened
    if (listingId) {
      await supabase
        .from("offers")
        .update({ is_read: true })
        .eq("receiver_id", user.id)
        .eq("sender_id", peerId)
        .eq("listing_id", listingId)
        .eq("is_read", false);
    }

    // Clear local unread count for this thread (covers both messages + offers)
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
    setSendDraftBeforeOffer(false);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, display_name, avatar_url, institution")
      .eq("id", peerId)
      .single();
    setActivePeer(profile || { id: peerId });

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
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
        .select("id, title, price, user_id, status, flag_reason")
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

    // Mark messages + offers as read now that we've opened the chat
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
            // Auto-mark as read if conversation is open
            if (msg.receiver_id === user.id) {
              markAsRead(peerId, msg.listing_id || null);
            }
          } else {
            // Increment unread count if this peer's chat isn't open
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
      // Listen for is_read updates so sender's ticks turn green in real-time
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new;
        if (updated.sender_id !== user.id) return;
        setMessages((prev) =>
          prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read } : m)
        );
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, (payload) => {
        const offer = payload.new;
        if (offer.sender_id !== user.id && offer.receiver_id !== user.id) return;

        const peerId = offer.sender_id === user.id ? offer.receiver_id : offer.sender_id;
        const conversationKey = buildConversationKey(peerId, offer.listing_id || null);

        setActiveConversationKey((curActiveConversationKey) => {
          if (curActiveConversationKey === conversationKey) {
            // Chat is open — offer is visible, mark it read immediately
            setOffers((prev) => {
              if (prev.find((o) => o.id === offer.id)) return prev;
              return [
                ...prev.map((o) =>
                  o.sender_id === offer.sender_id && o.receiver_id === offer.receiver_id && o.status === "pending" && o.id !== offer.id
                    ? { ...o, status: "declined" }
                    : o
                ),
                offer,
              ];
            });
            // Auto-mark offer as read since the chat is open
            if (offer.receiver_id === user.id) {
              supabase
                .from("offers")
                .update({ is_read: true })
                .eq("id", offer.id)
                .then(() => loadConversations());
            }
          } else {
            // FIX 3: Chat is not open — increment unread badge for incoming offers
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
        // Update local offer state immediately — ticks turn green in real-time
        setOffers((prev) => prev.map((o) => o.id === offer.id ? offer : o));
        loadConversations();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, loadConversations]);

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, offers]);

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

    // Optimistically add message (no id yet → shows clock tick)
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
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    }
    setSending(false);
    setPendingFlaggedMessage("");
    textareaRef.current?.focus();
    await loadConversations();
  };

  const resolveConversationListingForSend = async () => {
    if (!conversationListing?.id) return conversationListing;

    try {
      const { data: latestListing, error } = await supabase
        .from("listings")
        .select("id, title, price, user_id, status, flag_reason")
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

  // User-driven changes pass through this handler first.
  // State updates and follow-up UI actions are triggered here.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Send Offer ────────────────────────────────────────────
  const sendOffer = async () => {
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

    // Cancel any existing pending offer for this listing+conversation (replace it)
    await supabase
      .from("offers")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("listing_id", offerListingId)
      .eq("sender_id", user.id)
      .eq("receiver_id", activeId)
      .eq("status", "pending");

    const { data: newOffer, error } = await supabase
      .from("offers")
      .insert({
        listing_id: offerListingId,
        sender_id: user.id,
        receiver_id: activeId,
        amount,
        status: "pending",
        // is_read defaults to false in DB — receiver hasn't seen it yet
      })
      .select()
      .single();

    if (error) { setOfferError("Failed to send offer."); setOfferSending(false); return; }

    setOffers((prev) => [
      ...prev.map((o) =>
        o.sender_id === user.id && o.receiver_id === activeId && o.status === "pending"
          ? { ...o, status: "declined" }
          : o
      ),
      newOffer,
    ]);
    setShowOfferModal(false);
    setOfferAmount("");
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
  const respondToOffer = async (offerId, accept) => {
    const newStatus = accept ? "accepted" : "declined";
    const { data: updatedOffer, error } = await supabase
      .from("offers")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", offerId)
      .select()
      .single();

    if (error) { console.error(error.message); return; }

    setOffers((prev) => prev.map((o) => o.id === offerId ? updatedOffer : o));

    if (accept && updatedOffer) {
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

      // On UPDATE — only change the fields that the offer renegotiation owns.
      // Never touch `status`; the trade workflow manages it separately.
      const updatePayload = {
        item:      listingTitle,
        seller_id: sellerId,
        buyer_id:  buyerId,
        price:     updatedOffer.amount,
      };

      // On INSERT — new transaction always starts at the beginning of the lifecycle.
      const insertPayload = {
        ...updatePayload,
        id:     buildTradeTransactionId(),
        status: "awaiting_dropoff",
      };

    const transactionRequest = activeTransaction
      ? supabase.from("transactions").update(updatePayload).eq("id", activeTransaction.id)
      : supabase.from("transactions").insert(insertPayload);

      const listingRequest = supabase
        .from("listings")
        .update({ sold_price: updatedOffer.amount, status: "sold" })
        .eq("id", updatedOffer.listing_id);

      const offerCleanupRequest = supabase
        .from("offers")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("listing_id", updatedOffer.listing_id)
        .eq("status", "pending");

      const otherUserId = updatedOffer.sender_id === user.id ? updatedOffer.receiver_id : updatedOffer.sender_id;
      //const systemNote = `${listingTitle} now has an accepted offer for R${Number(updatedOffer.amount).toLocaleString("en-ZA")}. The seller can book a drop-off slot from My Bookings.`;
      const systemNote = `The offer for ${listingTitle} with amount of R${Number(updatedOffer.amount).toLocaleString("en-ZA")} has been accepted. Please book a drop-off/collection slot from My Bookings.`;
      const messageRequest = otherUserId
        ? insertMessage({
            sender_id: user.id,
            receiver_id: otherUserId,
            content: systemNote,
            listing_id: updatedOffer.listing_id,
          })
        : Promise.resolve();

      await Promise.allSettled([
        transactionRequest,
        listingRequest,
        offerCleanupRequest,
        messageRequest,
      ]);
    }
  };

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
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

  // A focused piece of component behavior is handled here.
  // Keeping it separate makes the main flow less crowded.
  const dateLabel = (dateStr) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  };

  if (!user) return null;

  return (
    <div className="msg-page">

      {/* ── Sidebar ── */}
      <aside className={`msg-sidebar ${activeId ? "msg-sidebar--hidden-mobile" : ""}`}>
        <header className="msg-sidebar__header">
          <button className="msg-back-btn" onClick={onBack}>← Back</button>
          <h2 className="msg-sidebar__title">Messages</h2>
        </header>

        <div className="msg-search-wrap">
          <svg className="msg-search-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="msg-search"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
            const threadTitle = conv.listing?.title ? `${peerName(conv.profile)} - ${conv.listing.title}` : peerName(conv.profile);
            return (
              <li key={conv.key}>
                <button
                  className={`msg-conv-item ${isActive ? "msg-conv-item--active" : ""} ${unread > 0 && !isActive ? "msg-conv-item--unread" : ""}`}
                  onClick={() => openChat(conv.peerId, conv.listingId)}
                >
                  <Avatar url={conv.profile?.avatar_url} name={peerName(conv.profile)} size={46} />
                  <div className="msg-conv-item__body">
                    <div className="msg-conv-item__top">
                      <span className={`msg-conv-item__name ${unread > 0 && !isActive ? "msg-conv-item__name--unread" : ""}`}>
                        {threadTitle}
                      </span>
                      {conv.lastMsg && (
                        <span className="msg-conv-item__time">{timeLabel(conv.lastMsg.created_at)}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      {conv.lastMsg && (
                        <span className={`msg-conv-item__preview ${unread > 0 && !isActive ? "msg-conv-item__preview--unread" : ""}`}>
                          {conv.lastMsg.sender_id === user.id ? "You: " : ""}
                          {conv.lastMsg.content}
                        </span>
                      )}

                      {/* unread badge */}
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
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Chat Pane ── */}
      <section className={`msg-chat ${!activeId ? "msg-chat--empty-state" : ""}`}>
        {!activeId ? (
          <div className="msg-chat__empty">
            <div className="msg-chat__empty-icon">💬</div>
            <h3>Your Messages</h3>
            <p>Select a conversation or tap <strong>Message Seller</strong> on any listing.</p>
          </div>
        ) : (
          <>
            <header className="msg-chat__header">
              <button className="msg-chat__back-mobile" onClick={() => { setActiveId(null); setActiveConversationKey(null); setActiveListingId(null); }}>←</button>
              {activePeer && (
                <>
                  <Avatar url={activePeer.avatar_url} name={peerName(activePeer)} size={38} />
                  <div className="msg-chat__header-info">
                    <button className="msg-chat__header-name msg-chat__header-name--link" onClick={() => onViewProfile?.(activePeer.id)} type="button">
                      {conversationListing?.title ? `${peerName(activePeer)} - ${conversationListing.title}` : peerName(activePeer)}
                    </button>
                    {activePeer.institution && (
                      <span className="msg-chat__header-sub">{activePeer.institution}</span>
                    )}
                  </div>
                </>
              )}
            </header>

            {/* ── Buyer Info Banner (shown to lister only) ── */}
            {conversationListing && activePeer && (
              <div className="msg-buyer-banner">
                <div className="msg-buyer-banner__listing-row">
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
                </div>
                <div className="msg-buyer-banner__card">
                  <Avatar url={activePeer.avatar_url} name={peerName(activePeer)} size={38} />
                  <div className="msg-buyer-banner__card-info">
                    <span className="msg-buyer-banner__card-name">{peerName(activePeer)}</span>
                    {activePeer.institution && (
                      <span className="msg-buyer-banner__card-sub">{activePeer.institution}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="msg-buyer-banner__btn msg-buyer-banner__btn--offer"
                      onClick={() => { setShowOfferModal(true); setOfferError(""); setOfferAmount(""); }}
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
                  </div>
                </div>
              </div>
            )}

            {/* ── Send Offer Modal ── */}
            {showOfferModal && conversationListing && (
              <div className="msg-offer-modal-overlay" onClick={() => setShowOfferModal(false)}>
                <div className="msg-offer-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="msg-offer-modal__title">Send an Offer</h3>
                  <p className="msg-offer-modal__sub">
                    Listing price: <strong>R{Number(conversationListing.price).toLocaleString("en-ZA")}</strong>
                  </p>
                  <div className="msg-offer-modal__input-wrap">
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
                  </div>
                  {offerError && <p className="msg-offer-modal__error">{offerError}</p>}
                  <div className="msg-offer-modal__actions">
                    <button className="msg-offer-modal__cancel" onClick={() => setShowOfferModal(false)} type="button">Cancel</button>
                    <button className="msg-offer-modal__send" onClick={sendOffer} disabled={offerSending} type="button">
                      {offerSending ? "Sending…" : "Send Offer"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {flaggedWarningOpen && conversationListing?.status === "flagged" && (
              <aside
                role="alertdialog"
                aria-labelledby="messages-flagged-warning-title"
                aria-live="assertive"
                style={flaggedWarningToastStyle()}
              >
                <button
                  onClick={() => {
                    setFlaggedWarningOpen(false);
                    setPendingFlaggedMessage("");
                  }}
                  aria-label="Close flagged listing warning"
                  type="button"
                  style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                >
                  x
                </button>
                <h3 id="messages-flagged-warning-title" style={{ margin: "0 28px 8px 0" }}>
                  Flagged listing warning
                </h3>
                <p style={{ margin: "0 0 8px" }}>
                  This listing has been flagged by an admin.
                </p>
                <p style={{ margin: "0 0 16px" }}>
                  <strong>Reason:</strong> {conversationListing.flag_reason?.trim() || "No reason was provided."}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    className="msg-offer-modal__cancel"
                    onClick={() => {
                      setFlaggedWarningOpen(false);
                      setPendingFlaggedMessage("");
                    }}
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
                        if (conversationListing?.id != null) {
                          next.add(String(conversationListing.id));
                        }
                        return next;
                      });
                      sendMessageNow(text);
                    }}
                    type="button"
                  >
                    Continue
                  </button>
                </div>
              </aside>
            )}

            <div className="msg-chat__body">
              {msgsLoading && (
                <div className="msg-chat__loading"><span className="msg-spinner" /></div>
              )}

              {!msgsLoading && messages.length === 0 && (
                <div className="msg-chat__no-msgs">
                  <span>👋</span>
                  <p>Say hello! This is the start of your conversation.</p>
                </div>
              )}

              {(() => {
                // Merge messages and offers into one sorted timeline
                const timeline = [
                  ...messages.map((m) => ({ ...m, _type: "message" })),
                  ...offers.map((o) => ({ ...o, _type: "offer" })),
                ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                // Group by date
                const groups = {};
                for (const item of timeline) {
                  const date = new Date(item.created_at).toDateString();
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(item);
                }

                return Object.entries(groups).map(([date, items]) => (
                  <div key={date}>
                    <div className="msg-date-divider"><span>{dateLabel(date)}</span></div>
                    {items.map((item) => {
                      if (item._type === "offer") {
                        const iMadeOffer = item.sender_id === user.id;
                        const isPending = item.status === "pending";
                        const isAccepted = item.status === "accepted";
                        const isDeclined = item.status === "declined";
                        // Tick status for offers I sent: read if receiver has opened the chat
                        const offerTickStatus = item.is_read ? "read" : "sent";
                        return (
                          <div key={`offer-${item.id}`} className={`msg-offer-card-wrap ${iMadeOffer ? "msg-offer-card-wrap--mine" : "msg-offer-card-wrap--theirs"}`}>
                            {!iMadeOffer && <Avatar url={activePeer?.avatar_url} name={peerName(activePeer)} size={28} />}
                            <div className={`msg-offer-card ${iMadeOffer ? "msg-offer-card--mine" : "msg-offer-card--theirs"} ${isAccepted ? "msg-offer-card--accepted" : isDeclined ? "msg-offer-card--declined" : item.status === "cancelled" ? "msg-offer-card--declined" : ""}`}>
                              <div className="msg-offer-card__header">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                </svg>
                                <span className="msg-offer-card__label">
                                  {iMadeOffer ? `You offered ${peerName(activePeer)}` : `${peerName(activePeer)} offered you`}
                                </span>
                              </div>
                              <p className="msg-offer-card__note">
                                This offer only records the agreed price. Payment and collection are arranged later in chat.
                              </p>
                              <div className="msg-offer-card__amount">
                                R{Number(item.amount).toLocaleString("en-ZA")}
                              </div>
                              {isPending && !iMadeOffer && (
                                <div className="msg-offer-card__actions">
                                  <button className="msg-offer-card__decline" onClick={() => respondToOffer(item.id, false)} type="button">Decline</button>
                                  <button className="msg-offer-card__accept" onClick={() => respondToOffer(item.id, true)} type="button">Accept</button>
                                </div>
                              )}
                              {isPending && iMadeOffer && (
                                <div className="msg-offer-card__actions">
                                  <p className="msg-offer-card__status msg-offer-card__status--pending" style={{ margin: 0 }}>Waiting for response…</p>
                                  <button className="msg-offer-card__cancel-offer" onClick={() => cancelOffer(item.id)} type="button">Cancel Offer</button>
                                </div>
                              )}
                              {isAccepted && (
                                <p className="msg-offer-card__status msg-offer-card__status--accepted">✓ Offer accepted</p>
                              )}
                              {isDeclined && (
                                <p className="msg-offer-card__status msg-offer-card__status--declined">✕ Offer declined</p>
                              )}
                              {item.status === "cancelled" && (
                                <p className="msg-offer-card__status msg-offer-card__status--declined">✕ Offer cancelled</p>
                              )}

                              {/* Read ticks — only shown on offers I sent */}
                              {iMadeOffer && (
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                                  <ReadTicks status={offerTickStatus} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Regular message bubble
                      const mine = item.sender_id === user.id;
                      const tickStatus = !item.id ? "sending" : item.is_read ? "read" : "sent";
                      return (
                        <div key={item.id} className={`msg-bubble-wrap ${mine ? "msg-bubble-wrap--mine" : "msg-bubble-wrap--theirs"}`}>
                          {!mine && <Avatar url={activePeer?.avatar_url} name={peerName(activePeer)} size={28} />}
                          <div className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}>
                            <p>{item.content}</p>
                            <span className="msg-bubble__time" style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                              {new Date(item.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                              {mine && <ReadTicks status={tickStatus} />}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
              <div ref={bottomRef} />
            </div>

            <footer className="msg-composer">
              {showSellerQuickReplies && (
                <div className="msg-composer__quick-replies" aria-label="Seller quick replies">
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
                </div>
              )}
              <div className="msg-composer__row">
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
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
