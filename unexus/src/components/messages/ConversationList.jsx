import React, { useState } from 'react';
import "../../styles/ConversationList.css";

function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationList({ conversations, activeConversation, onSelect, loading }) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) =>
    c.partner?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="container">
      {/* Header */}
      <header className="header">
        <h2 className="heading">Messages</h2>
      </header>

      {/* Search */}
      <section className="searchWrap">
        <svg className="searchIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="searchInput"
          type="text"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {/* List */}
      <section className="list">
        {loading ? (
          <section className="emptyState">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </section>
        ) : filtered.length === 0 ? (
          <section className="emptyState">
            <figure>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </figure>
            <p className="emptyText">
              {search ? 'No results found' : 'No conversations yet'}
            </p>
          </section>
        ) : (
          filtered.map((conv) => {
            const isActive = activeConversation?.partnerId === conv.partnerId;
            return (
              <button
                key={conv.partnerId}
                onClick={() => onSelect(conv)}
                className={`row ${isActive ? 'rowActive' : ''}`}
              >
                {/* Avatar */}
                <figure className="avatar">
                  {getInitials(conv.partner?.name)}
                  <span className="onlineDot" />
                </figure>

                {/* Text */}
                <section className="rowText">
                  <header className="rowTop">
                    <strong className="name">
                      {conv.partner?.name || 'Unknown User'}
                    </strong>
                    <time className="time">
                      {formatTimestamp(conv.lastMessage?.created_at)}
                    </time>
                  </header>
                  <p className="preview">
                    {conv.lastMessage?.content?.slice(0, 55) || '…'}
                    {conv.lastMessage?.content?.length > 55 ? '…' : ''}
                  </p>
                </section>

                {/* Active indicator */}
                {isActive && <span className="activeBar" />}
              </button>
            );
          })
        )}
      </section>
    </aside>
  );
}

function SkeletonRow() {
  return (
    <article className="skeletonRow">
      <figure className="skeletonAvatar" />
      <section className="skeletonText">
        <span className="skeletonLine short" />
        <span className="skeletonLine long" />
      </section>
    </article>
  );
}