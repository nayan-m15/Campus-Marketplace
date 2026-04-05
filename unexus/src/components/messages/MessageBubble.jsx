import React from "react";
import "../../styles/MessageBubble.css"

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({
  content,
  isOwn,
  createdAt,
  isOptimistic,
}) {
  return (
    <section
      className={`message-wrapper ${
        isOwn ? "message-wrapper--own" : "message-wrapper--other"
      }`}
    >
      <article
        className={`message-bubble ${
          isOwn ? "message-bubble--own" : "message-bubble--other"
        } ${isOptimistic ? "message-bubble--sending" : ""}`}
      >
        <p className="message-content">{content}</p>

        <time
          className={`message-time ${
            isOwn ? "message-time--own" : "message-time--other"
          }`}
          dateTime={createdAt}
        >
          {formatTime(createdAt)}
          {isOptimistic && " · sending…"}
        </time>
      </article>
    </section>
  );
}