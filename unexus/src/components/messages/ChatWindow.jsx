import React, { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import "../../styles/ChatWindow.css";

function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;

  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groups.push({ type: 'date', label: dateStr, id: `date-${dateStr}` });
    }
    groups.push({ type: 'message', ...msg });
  }
  return groups;
}

export default function ChatWindow({ conversation, messages, loading, sending, onSend, currentUser }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput('');
    textareaRef.current?.focus();
  }, [input, sending, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  if (!conversation) {
    return (
      <main className="emptyState">
        <figure className="emptyIconWrap">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </figure>
        <h3 className="emptyHeading">Your Messages</h3>
        <p className="emptySubtext">Select a conversation to start chatting</p>
      </main>
    );
  }

  const grouped = groupMessagesByDate(messages);

  return (
    <main className="container">
      {/* Header */}
      <header className="header">
        <figure className="headerAvatar">
          {getInitials(conversation.partner?.name)}
        </figure>
        <section className="headerInfo">
          <strong className="headerName">
            {conversation.partner?.name || 'Unknown User'}
          </strong>
          <small className="headerSub">Campus Marketplace</small>
        </section>
      </header>

      {/* Messages */}
      <section className="messagesArea">
        {loading ? (
          <section className="loadingWrap">
            <span className="spinner" />
          </section>
        ) : messages.length === 0 ? (
          <section className="noMessages">
            <p className="noMessagesText">No messages yet. Say hello! 👋</p>
          </section>
        ) : (
          <>
            {grouped.map((item) =>
              item.type === 'date' ? (
                <section key={item.id} className="dateDivider">
                  <time className="dateLabel">{item.label}</time>
                </section>
              ) : (
                <article key={item.id}>
                  <MessageBubble
                    content={item.content}
                    isOwn={item.sender_id === currentUser?.id}
                    createdAt={item.created_at}
                    isOptimistic={item.isOptimistic}
                  />
                </article>
              )
            )}
            <span ref={bottomRef} />
          </>
        )}
      </section>

      {/* Input */}
      <footer className="inputBar">
        <textarea
          ref={textareaRef}
          className="textarea"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="sendBtn"
          style={{
            opacity: input.trim() ? 1 : 0.4,
            cursor: input.trim() ? 'pointer' : 'default',
          }}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send message"
        >
          {sending ? (
            <span className="spinnerSmall" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </footer>

      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        textarea:focus { outline: none; }
        textarea::placeholder { color: #555; }
        textarea { resize: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 4px; }
      `}</style>
    </main>
  );
}