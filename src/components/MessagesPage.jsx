import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { insertMessage } from "../utils/messageDelivery";
import "../styles/Messages.css";

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
  const opacity = isRead ? 1 : 0.5;

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
  onBack,
  onViewProfile,
  onUnreadChange,   // ← NEW: callback(count) so parent can update navbar badge
}) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);

  // unreadByPeer: { [peerId]: number }
  const [unreadByPeer, setUnreadByPeer] = useState({});

  const [activeId, setActiveId] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [activeListingId, setActiveListingId] = useState(initialListingId);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Buyer info banner: shown to the lister when a buyer messages about a listing
  const [iAmTheLister, setIAmTheLister] = useState(false);
  const [conversationListing, setConversationListing] = useState(null);

  // Offer state
  const [offers, setOffers] = useState([]); // offers for this conversation
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerSending, setOfferSending] = useState(false);
  const [offerError, setOfferError] = useState("");

  const bottomRef = useRef(null);
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
      .select("id, created_at, sender_id, receiver_id, content, is_read")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs) { setConvsLoading(false); return; }

    // Build per-peer last message map
    const peerMap = new Map();
    const unreadMap = {};

    for (const m of msgs) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!peerMap.has(peerId)) peerMap.set(peerId, m);

      // Count unread messages sent TO me (not from me) that aren't read
      if (m.receiver_id === user.id && !m.is_read) {
        unreadMap[peerId] = (unreadMap[peerId] || 0) + 1;
      }
    }

    setUnreadByPeer(unreadMap);

    const peerIds = [...peerMap.keys()].filter(Boolean);
    let profiles = [];
    if (peerIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, display_name, avatar_url")
        .in("id", peerIds);
      profiles = data || [];
    }

    const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

    const convList = [...peerMap.entries()].map(([peerId, lastMsg]) => ({
      peerId,
      profile: profileById[peerId] || null,
      lastMsg,
    }));

    setConversations(convList);
    setConvsLoading(false);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Auto-open chat from listing ───────────────────────────
  useEffect(() => {
    if (!initialRecipientId || !user) return;
    setActiveListingId(initialListingId || null);
    openChat(initialRecipientId);
    if (initialListingTitle) {
      setDraft(`Hi! I'm interested in your listing: "${initialListingTitle}". Is it still available?`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecipientId, initialListingId, user]);

  // ── Mark messages as read ────────────────────────────────
  const markAsRead = useCallback(async (peerId) => {
    if (!peerId || !user) return;
    // Update DB: mark all messages from this peer to me as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", peerId)
      .eq("is_read", false);

    // Clear local unread count for this peer
    setUnreadByPeer((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, [user]);

  // ── Open a chat ───────────────────────────────────────────
  const openChat = useCallback(async (peerId) => {
    if (!peerId) return;
    if (peerId !== initialRecipientId) setActiveListingId(null);
    setActiveId(peerId);
    setMessages([]);
    setMsgsLoading(true);
    setIAmTheLister(false);
    setConversationListing(null);
    setOffers([]);
    setShowOfferModal(false);
    setOfferAmount("");
    setOfferError("");

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

    setMessages(msgs || []);
    setMsgsLoading(false);

    // ── Buyer info banner ────────────────────────────────────
    // Use the most recent message that has a listing_id (latest inquired listing)
    const msgWithListing = [...(msgs || [])].reverse().find((m) => m.listing_id);

    if (msgWithListing) {
      // The lister is whoever OWNS the listing (not the one who sent the first message).
      // The buyer sends the first message about a listing, so:
      //   - if the peer sent the message → peer is the buyer → I am the lister
      //   - if I sent the message → I am the buyer → peer is the lister
      const buyerIsThePeer = msgWithListing.sender_id === peerId;
      setIAmTheLister(buyerIsThePeer);

      const { data: listing } = await supabase
        .from("listings")
        .select("id, title, price")
        .eq("id", String(msgWithListing.listing_id))
        .maybeSingle();

      if (buyerIsThePeer) {
        // I am the lister — store listing so I can send offers
        setConversationListing(listing || { id: msgWithListing.listing_id, title: null, price: null });
      }

      // Both sides fetch offers for this listing + conversation
      const { data: existingOffers } = await supabase
        .from("offers")
        .select("*")
        .eq("listing_id", String(msgWithListing.listing_id))
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setOffers(existingOffers || []);
    } else {
      // Fallback: fetch offers by participants (no listing_id in any message)
      const { data: fallbackOffers } = await supabase
        .from("offers")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setOffers(fallbackOffers || []);
    }

    // Mark as read now that we've opened the chat
    await markAsRead(peerId);

    setConversations((prev) => {
      const exists = prev.find((c) => c.peerId === peerId);
      if (exists) return prev;
      return [{ peerId, profile: profile || { id: peerId }, lastMsg: null }, ...prev];
    });
  }, [user, markAsRead, initialRecipientId]);

  // ── Realtime ──────────────────────────────────────────────
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

        setActiveId((curActive) => {
          if (curActive === peerId) {
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
              markAsRead(peerId);
            }
          } else {
            // Increment unread count if this peer's chat isn't open
            if (msg.receiver_id === user.id) {
              setUnreadByPeer((prev) => ({
                ...prev,
                [peerId]: (prev[peerId] || 0) + 1,
              }));
            }
          }
          return curActive;
        });

        setConversations((prev) => {
          const existing = prev.find((c) => c.peerId === peerId);
          if (existing) return prev.map((c) => c.peerId === peerId ? { ...c, lastMsg: msg } : c);
          return [{ peerId, profile: null, lastMsg: msg }, ...prev];
        });
      })
      // ── Listen for is_read updates so sender's ticks turn green in real-time ──
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new;
        // Only care if the updated message was sent by me and is now read
        if (updated.sender_id !== user.id) return;
        setMessages((prev) =>
          prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read } : m)
        );
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [user, markAsRead]);

  // ── Realtime: offers ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("offers-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, (payload) => {
        const offer = payload.new;
        if (offer.sender_id !== user.id && offer.receiver_id !== user.id) return;
        setActiveId((curActive) => {
          const peerId = offer.sender_id === user.id ? offer.receiver_id : offer.sender_id;
          if (curActive === peerId) {
            setOffers((prev) => {
              if (prev.find((o) => o.id === offer.id)) return prev;
              // If this new offer replaces a pending one from the same sender, mark old ones declined
              return [
                ...prev.map((o) =>
                  o.sender_id === offer.sender_id && o.receiver_id === offer.receiver_id && o.status === "pending" && o.id !== offer.id
                    ? { ...o, status: "declined" }
                    : o
                ),
                offer,
              ];
            });
          }
          return curActive;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "offers" }, (payload) => {
        const offer = payload.new;
        if (offer.sender_id !== user.id && offer.receiver_id !== user.id) return;
        setOffers((prev) => prev.map((o) => o.id === offer.id ? offer : o));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  // ── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ──────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [draft]);

  // ── Send ──────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setDraft("");

    // Optimistically add message (no id yet → shows clock tick)
    const optimistic = {
      id: null,
      sender_id: user.id,
      receiver_id: activeId,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      listing_id: activeListingId,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await insertMessage({
      sender_id: user.id,
      receiver_id: activeId,
      content: text,
      created_at: optimistic.created_at,
      listing_id: activeListingId,
    });

    if (error) {
      console.error(error.message);
      setDraft(text);
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    }
    setSending(false);
    textareaRef.current?.focus();
    await loadConversations();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Send Offer (lister → buyer) ───────────────────────────
  const sendOffer = async () => {
    const amount = parseFloat(offerAmount.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) { setOfferError("Please enter a valid amount."); return; }
    if (!conversationListing?.id || !activeId) return;
    setOfferSending(true);
    setOfferError("");

    // Cancel any existing pending offer for this listing+conversation (replace it)
    await supabase
      .from("offers")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("listing_id", conversationListing.id)
      .eq("sender_id", user.id)
      .eq("receiver_id", activeId)
      .eq("status", "pending");

    const { data: newOffer, error } = await supabase
      .from("offers")
      .insert({
        listing_id: conversationListing.id,
        sender_id: user.id,
        receiver_id: activeId,
        amount,
        status: "pending",
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

  // ── Cancel Offer (lister) ────────────────────────────────
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

  // ── Respond to Offer (buyer) ──────────────────────────────
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
      // Update listing: set sold_price to accepted amount
      await supabase
        .from("listings")
        .update({ sold_price: updatedOffer.amount })
        .eq("id", updatedOffer.listing_id);
    }
  };

  const peerName = (profile) => profile?.display_name || profile?.name || "Unknown User";

  const filteredConvs = conversations.filter((c) => {
    if (!search.trim()) return true;
    return peerName(c.profile).toLowerCase().includes(search.toLowerCase());
  });

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

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
            const unread = unreadByPeer[conv.peerId] || 0;
            const isActive = activeId === conv.peerId;
            return (
              <li key={conv.peerId}>
                <button
                  className={`msg-conv-item ${isActive ? "msg-conv-item--active" : ""} ${unread > 0 && !isActive ? "msg-conv-item--unread" : ""}`}
                  onClick={() => openChat(conv.peerId)}
                >
                  <Avatar url={conv.profile?.avatar_url} name={peerName(conv.profile)} size={46} />
                  <div className="msg-conv-item__body">
                    <div className="msg-conv-item__top">
                      <span className={`msg-conv-item__name ${unread > 0 && !isActive ? "msg-conv-item__name--unread" : ""}`}>
                        {peerName(conv.profile)}
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

                      {/* ── WhatsApp-style unread badge ── */}
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
              <button className="msg-chat__back-mobile" onClick={() => setActiveId(null)}>←</button>
              {activePeer && (
                <>
                  <Avatar url={activePeer.avatar_url} name={peerName(activePeer)} size={38} />
                  <div className="msg-chat__header-info">
                    <button className="msg-chat__header-name msg-chat__header-name--link" onClick={() => onViewProfile?.(activePeer.id)} type="button">{peerName(activePeer)}</button>
                    {activePeer.institution && (
                      <span className="msg-chat__header-sub">{activePeer.institution}</span>
                    )}
                  </div>
                </>
              )}
            </header>

            {/* ── Buyer Info Banner (shown to lister only) ── */}
            {iAmTheLister && activePeer && (
              <div className="msg-buyer-banner">
                <div className="msg-buyer-banner__listing-row">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  <span>
                    {conversationListing?.title
                      ? <>Your listing · <strong>{conversationListing.title}</strong>{conversationListing.price != null ? <> · <em>R{Number(conversationListing.price).toLocaleString("en-ZA")}</em></> : null}</>
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
                      View buyer
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
                      type="number"
                      min="1"
                      placeholder="0"
                      value={offerAmount}
                      onChange={(e) => { setOfferAmount(e.target.value); setOfferError(""); }}
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
                        const iMadeoffer = item.sender_id === user.id;
                        const isPending = item.status === "pending";
                        const isAccepted = item.status === "accepted";
                        const isDeclined = item.status === "declined";
                        return (
                          <div key={`offer-${item.id}`} className="msg-offer-card-wrap">
                            <div className={`msg-offer-card ${isAccepted ? "msg-offer-card--accepted" : isDeclined ? "msg-offer-card--declined" : item.status === "cancelled" ? "msg-offer-card--declined" : ""}`}>
                              <div className="msg-offer-card__header">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                </svg>
                                <span className="msg-offer-card__label">
                                  {iMadeoffer ? `You offered ${peerName(activePeer)}` : `${peerName(activePeer)} offered you`}
                                </span>
                              </div>
                              <div className="msg-offer-card__amount">
                                R{Number(item.amount).toLocaleString("en-ZA")}
                              </div>
                              {isPending && !iMadeoffer && (
                                <div className="msg-offer-card__actions">
                                  <button className="msg-offer-card__decline" onClick={() => respondToOffer(item.id, false)} type="button">Decline</button>
                                  <button className="msg-offer-card__accept" onClick={() => respondToOffer(item.id, true)} type="button">Accept</button>
                                </div>
                              )}
                              {isPending && iMadeoffer && (
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
                onClick={sendMessage}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
