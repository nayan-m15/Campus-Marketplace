import { supabase } from '../supabaseClient';

/**
 * Fetch all unique conversations for the current user.
 * Returns an array of { partnerId, partner: { id, name }, lastMessage, unreadCount }
 */
export async function getConversations(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `id, content, created_at, sender_id, receiver_id,
       sender:users!sender_id(id, name),
       receiver:users!receiver_id(id, name)`
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Deduplicate into one entry per conversation partner
  const seen = new Map();

  for (const msg of data) {
    const isOutgoing = msg.sender_id === userId;
    const partnerId = isOutgoing ? msg.receiver_id : msg.sender_id;
    const partner = isOutgoing ? msg.receiver : msg.sender;

    if (!seen.has(partnerId)) {
      seen.set(partnerId, {
        partnerId,
        partner,
        lastMessage: msg,
        unreadCount: 0,
      });
    }
  }

  return Array.from(seen.values());
}

/** Fetch all messages between two users, sorted oldest → newest. */
export async function getMessages(userId, partnerId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
      `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/** Insert a new message and return the created row. */
export async function sendMessage(senderId, receiverId, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();

  if (error) throw error;
  return data;
}
