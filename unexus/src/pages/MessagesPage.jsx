import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useMessages } from "../hooks/useMessages";
import ConversationList from "../components/messages/ConversationList";
import ChatWindow from "../components/messages/ChatWindow";
import "../styles/MessagesPage.css";

export default function MessagesPage({onBack}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Fetch logged-in user ─────────────────────────────
  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("id", user.id)
          .single();

        setCurrentUser(profile || { id: user.id, name: user.email });
      }
      setAuthLoading(false);
    }

    fetchUser();
  }, []);

  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    send,
  } = useMessages(currentUser);

  // ── Auto-open conversation ───────────────────────────
  useEffect(() => {
    if (!conversations.length) return;

    const state = window.history.state?.usr;

    if (state?.partnerId && !activeConversation) {
      const existing = conversations.find(
        (c) => c.partnerId === state.partnerId
      );

      if (existing) {
        setActiveConversation(existing);
      } else if (state.partnerId && state.partnerName) {
        setActiveConversation({
          partnerId: state.partnerId,
          partner: { id: state.partnerId, name: state.partnerName },
          lastMessage: null,
          unreadCount: 0,
        });
      }
    }
  }, [conversations, activeConversation, setActiveConversation]);

  // ── Loading state ────────────────────────────────────
  if (authLoading) {
    return (
      <main className="full-center">
        <figure className="spinner" aria-label="Loading" />
      </main>
    );
  }

  // ── Not logged in ───────────────────────────────────
  if (!currentUser) {
    return (
      <main className="full-center">
        <p className="muted-text">
          Please sign in to view your messages.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      {/* Top navigation */}
      <header className="top-bar">
        <nav>
          <button onClick={onBack} className="back-link">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Listings
          </button>
        </nav>

        {error && (
          <output className="error-badge">⚠ {error}</output>
        )}
      </header>

      {/* Two-panel layout */}
      <section className="panel">
        <aside>
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            onSelect={setActiveConversation}
            loading={loadingConversations}
          />
        </aside>

        <section aria-label="Chat window">
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            loading={loadingMessages}
            sending={sending}
            onSend={send}
            currentUser={currentUser}
          />
        </section>
      </section>
    </main>
  );
}