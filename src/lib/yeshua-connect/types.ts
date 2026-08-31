/**
 * Yeshua Connect — Types pour Christ Libère
 *
 * ⭐ V2: Plus de données mock — tout vient de la base de données via les
 *    API routes /api/yeshua-connect/*.
 *
 * Contextualisé pour la communauté spirituelle de Pam et du Pasteur Kongo.
 * Pas de "read receipts" — remplacé par "Bénédiction" (✋) et "Amen" (🙏).
 */

export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "FILE" | "VERSE" | "ANNOUNCEMENT" | "GIF" | "POLL" | "SCHEDULED";
export type ConversationType = "DIRECT" | "GROUP" | "CHANNEL" | "PASTORS" | "VOICE";
export type AnnouncementPriority = "INFO" | "NORMAL" | "IMPORTANT" | "URGENT";
export type AnnouncementTarget = "ALL" | "PASTORS" | "DISCIPLES" | "NEW_BELIEVERS" | "INTERCESSION";
export type CallType = "AUDIO" | "VIDEO";

export interface ChatParticipant {
  userId: string;
  role: "SUPER_ADMIN" | "MODERATOR" | "ANIMATOR" | "MEMBER_VERIFIED" | "MEMBER";
  joinedAt: string;
  muted: boolean;
  name: string;
  avatarUrl?: string;
  roleLabel: string;
  online: boolean;
}

export interface ChatConversation {
  id: string;
  type: ConversationType;
  name: string;
  description?: string;
  avatarUrl?: string;
  /** ⭐ V2.7 — Mode vidéo des canaux vocaux (bascule admin façon WhatsApp,
   * propagée en temps réel via les métadonnées de la room LiveKit). */
  videoMode?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  participants: ChatParticipant[];
  isEncrypted: boolean;
  unreadCount: number;
  /** ⭐ V2.1 — Date du dernier message lu (ISO string).
   * Permet au client de calculer les unread en temps réel quand de
   * nouveaux messages arrivent via Socket.io. */
  lastReadAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  /** ⭐ V2.5 — Avatar de l'expéditeur (bulles de groupe) */
  senderAvatarUrl?: string;
  type: MessageType;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
  duration?: number;
  replyToId?: string;
  replyTo?: { senderName: string; content: string };
  verseRef?: string;
  verseText?: string;
  /** ⭐ V2.5 — Sondage attaché (messages type POLL) */
  poll?: ChatPoll;
  reactions: MessageReaction[];
  createdAt: string;
  editedAt?: string;
  /** ⭐ V2.8 — Message épinglé (persisté en base, hydraté au chargement) */
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
}

/** ⭐ V2.5 — Sondage (comme WhatsApp/Telegram) attaché à un message POLL. */
export interface ChatPoll {
  id: string;
  question: string;
  isMulti: boolean;
  expiresAt?: string;
  options: ChatPollOption[];
}

export interface ChatPollOption {
  id: string;
  label: string;
  order: number;
  votes: { userId: string }[];
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Announcement {
  id: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  target: AnnouncementTarget;
  requiresConfirmation: boolean;
  publishedAt: string;
  confirmedByCurrentUser: boolean;
  confirmCount: number;
  totalRecipients: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: "SITE" | "EMAIL" | "PUSH" | "WHATSAPP";
  target: string;
  status: "RUNNING" | "COMPLETED" | "SCHEDULED";
  progress: number;
  total: number;
  sent: number;
}

export interface ChannelStatus {
  id: string;
  name: string;
  type: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  rate: number;
}

export interface CallHistory {
  id: string;
  type: CallType;
  direction: "incoming" | "outgoing";
  contact: string;
  duration: number;
  status: "ANSWERED" | "MISSED" | "REJECTED";
  date: string;
}

export interface BibleQuickRef {
  reference: string;
  text: string;
  book: string;
}

// Quick reactions (spiritual — pas de read receipts)
export const QUICK_REACTIONS = ["🙏", "✋", "❤️", "📖", "🔥", "⭐"];
