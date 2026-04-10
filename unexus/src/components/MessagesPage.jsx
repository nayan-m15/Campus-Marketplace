import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
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

// ── Main Component ─────────────────────────────────────────
export default function MessagesPage({ initialRecipientId = null, initialListingTitle = null, onBack, onViewProfile }) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);

  const [activeId, setActiveId] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const realtimeRef = useRef(null);

  // ── Load conversations ────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConvsLoading(true);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, created_at, sender_id, receiver_id, content")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs) { setConvsLoading(false); return; }

    const peerMap = new Map();
    for (const m of msgs) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!peerMap.has(peerId)) peerMap.set(peerId, m);
    }

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
    openChat(initialRecipientId);
    if (initialListingTitle) {
      setDraft(`Hi! I'm interested in your listing: "${initialListingTitle}". Is it still available?`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecipientId, user]);

  // ── Open a chat ───────────────────────────────────────────
  const openChat = useCallback(async (peerId) => {
    if (!peerId) return;
    setActiveId(peerId);
    setMessages([]);
    setMsgsLoading(true);

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

    setConversations((prev) => {
      const exists = prev.find((c) => c.peerId === peerId);
      if (exists) return prev;
      return [{ peerId, profile: profile || { id: peerId }, lastMsg: null }, ...prev];
    });
  }, [user]);

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
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
          return curActive;
        });

        setConversations((prev) => {
          const existing = prev.find((c) => c.peerId === peerId);
          if (existing) return prev.map((c) => c.peerId === peerId ? { ...c, lastMsg: msg } : c);
          return [{ peerId, profile: null, lastMsg: msg }, ...prev];
        });
      })
      .subscribe();

    realtimeRef.current = channel;
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

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeId,
      content: text,
      created_at: new Date().toISOString(),
    });

    if (error) { console.error(error.message); setDraft(text); }
    setSending(false);
    textareaRef.current?.focus();
    await loadConversations();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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

          {filteredConvs.map((conv) => (
            <li key={conv.peerId}>
              <button
                className={`msg-conv-item ${activeId === conv.peerId ? "msg-conv-item--active" : ""}`}
                onClick={() => openChat(conv.peerId)}
              >
                <Avatar url={conv.profile?.avatar_url} name={peerName(conv.profile)} size={46} />
                <div className="msg-conv-item__body">
                  <div className="msg-conv-item__top">
                    <span className="msg-conv-item__name">{peerName(conv.profile)}</span>
                    {conv.lastMsg && (
                      <span className="msg-conv-item__time">{timeLabel(conv.lastMsg.created_at)}</span>
                    )}
                  </div>
                  {conv.lastMsg && (
                    <span className="msg-conv-item__preview">
                      {conv.lastMsg.sender_id === user.id ? "You: " : ""}
                      {conv.lastMsg.content}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
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

              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="msg-date-divider"><span>{dateLabel(date)}</span></div>
                  {msgs.map((msg) => {
                    const mine = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`msg-bubble-wrap ${mine ? "msg-bubble-wrap--mine" : "msg-bubble-wrap--theirs"}`}>
                        {!mine && <Avatar url={activePeer?.avatar_url} name={peerName(activePeer)} size={28} />}
                        <div className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}>
                          <p>{msg.content}</p>
                          <span className="msg-bubble__time">
                            {new Date(msg.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
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
