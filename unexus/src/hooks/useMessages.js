import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getConversations, getMessages, sendMessage } from '../services/messageService';

/**
 * useMessages — manages conversation list, active chat, real-time updates.
 *
 * @param {object} currentUser  The logged-in user object ({ id, name, ... })
 */
export function useMessages(currentUser) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const channelRef = useRef(null);

  // ─── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConversations(true);
    try {
      const data = await getConversations(currentUser.id);
      setConversations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingConversations(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ─── Load messages + subscribe to real-time ──────────────────────────────
  useEffect(() => {
    if (!activeConversation || !currentUser) return;

    setLoadingMessages(true);

    // Fetch history
    getMessages(currentUser.id, activeConversation.partnerId)
      .then((data) => setMessages(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMessages(false));

    // Tear down previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to new inbound messages for this conversation
    const channel = supabase
      .channel(`chat:${currentUser.id}:${activeConversation.partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new;
          const isRelevant =
            (msg.sender_id === currentUser.id && msg.receiver_id === activeConversation.partnerId) ||
            (msg.sender_id === activeConversation.partnerId && msg.receiver_id === currentUser.id);

          if (isRelevant) {
            setMessages((prev) => {
              // Avoid duplicates (our own sent messages are added optimistically)
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // Refresh conversation list so last-message preview updates
            loadConversations();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeConversation, currentUser, loadConversations]);

  // ─── Send a message ───────────────────────────────────────────────────────
  const send = useCallback(
    async (content) => {
      if (!content.trim() || !activeConversation || !currentUser) return;

      setSending(true);
      // Optimistic update
      const optimistic = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser.id,
        receiver_id: activeConversation.partnerId,
        content,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const saved = await sendMessage(currentUser.id, activeConversation.partnerId, content);
        // Replace optimistic entry with real one
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
        loadConversations();
      } catch (err) {
        // Roll back optimistic update
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(err.message);
      } finally {
        setSending(false);
      }
    },
    [activeConversation, currentUser, loadConversations]
  );

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    send,
    refreshConversations: loadConversations,
  };
}
