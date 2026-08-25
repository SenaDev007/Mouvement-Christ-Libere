/**
 * Helm Connect — Types & données pour Mouvement Christ Libère
 *
 * Reproduit le pattern d'Academia Helm Connect, contextualisé pour
 * la communauté spirituelle de Pam et du Pasteur Kongo.
 *
 * Pas de "read receipts" — remplacé par "Bénédiction" (✋) et "Amen" (🙏).
 */

export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "FILE" | "VERSE" | "ANNOUNCEMENT";
export type ConversationType = "DIRECT" | "GROUP" | "CHANNEL" | "PASTORS";
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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  participants: ChatParticipant[];
  isEncrypted: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
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
  reactions: MessageReaction[];
  createdAt: string;
  editedAt?: string;
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

// ============================================================
// DONNÉES MOCK
// ============================================================

export const MOCK_CONVERSATIONS: ChatConversation[] = [
  {
    id: "c1", type: "CHANNEL", name: "Annonces officielles", description: "Communications de Pam et du Pasteur Kongo",
    createdBy: "pam", createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    lastMessagePreview: "Le live de ce soir est confirmé à 20h.",
    lastMessageSenderId: "pam",
    participants: [], isEncrypted: false, unreadCount: 2,
  },
  {
    id: "c2", type: "GROUP", name: "Cercle des pasteurs affiliés", description: "Canal réservé aux pasteurs — chiffré E2E",
    createdBy: "kongo", createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    lastMessageAt: new Date(Date.now() - 7200000).toISOString(),
    lastMessagePreview: "Shalom pasteur, j'ai une question sur l'enseignement d'hier.",
    lastMessageSenderId: "pastor1",
    participants: [
      { userId: "kongo", role: "SUPER_ADMIN", joinedAt: new Date().toISOString(), muted: false, name: "Pasteur Kongo", roleLabel: "Pasteur", online: true },
      { userId: "pastor1", role: "MEMBER_VERIFIED", joinedAt: new Date().toISOString(), muted: false, name: "Pasteur Samuel", roleLabel: "Pasteur affilié", online: true },
      { userId: "pastor2", role: "MEMBER_VERIFIED", joinedAt: new Date().toISOString(), muted: false, name: "Pasteur David", roleLabel: "Pasteur affilié", online: false },
    ], isEncrypted: true, unreadCount: 1,
  },
  {
    id: "c3", type: "GROUP", name: "Nouveaux croyants Yeshoua", description: "Accueil et accompagnement des nouveaux venus",
    createdBy: "pam", createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    lastMessageAt: new Date(Date.now() - 1800000).toISOString(),
    lastMessagePreview: "Merci pour l'accueil ! J'ai hâte d'apprendre.",
    lastMessageSenderId: "user1",
    participants: [
      { userId: "pam", role: "SUPER_ADMIN", joinedAt: new Date().toISOString(), muted: false, name: "Pam", roleLabel: "Servante de l'Éternel", online: true },
      { userId: "user1", role: "MEMBER", joinedAt: new Date().toISOString(), muted: false, name: "Sarah", roleLabel: "Nouvelle croyante", online: true },
      { userId: "user2", role: "MEMBER", joinedAt: new Date().toISOString(), muted: false, name: "Joseph", roleLabel: "Nouveau croyant", online: false },
    ], isEncrypted: false, unreadCount: 0,
  },
  {
    id: "c4", type: "GROUP", name: "Intercession communautaire", description: "Demandes de prière et chaîne d'intercession",
    createdBy: "kongo", createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    lastMessageAt: new Date(Date.now() - 900000).toISOString(),
    lastMessagePreview: "Je prie pour ta guérison. Que Yeshoua te restaure.",
    lastMessageSenderId: "user3",
    participants: [
      { userId: "kongo", role: "SUPER_ADMIN", joinedAt: new Date().toISOString(), muted: false, name: "Pasteur Kongo", roleLabel: "Pasteur", online: true },
      { userId: "user3", role: "MEMBER_VERIFIED", joinedAt: new Date().toISOString(), muted: false, name: "Rébecca", roleLabel: "Disciple", online: true },
    ], isEncrypted: false, unreadCount: 5,
  },
  {
    id: "c5", type: "DIRECT", name: "Pam", description: "",
    createdBy: "me", createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    lastMessageAt: new Date(Date.now() - 300000).toISOString(),
    lastMessagePreview: "Shalom ! Que la paix du Seigneur soit avec toi.",
    lastMessageSenderId: "pam",
    participants: [
      { userId: "pam", role: "SUPER_ADMIN", joinedAt: new Date().toISOString(), muted: false, name: "Pam", roleLabel: "Servante de l'Éternel", online: true },
    ], isEncrypted: true, unreadCount: 1,
  },
];

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    { id: "m1", conversationId: "c1", senderId: "pam", senderName: "Pam", senderRole: "Servante de l'Éternel", type: "ANNOUNCEMENT", content: "Shalom à tous. Le Seigneur m'a donné une parole pour la communauté ce matin. Restez attentifs.", reactions: [{ emoji: "🙏", userId: "u1", userName: "Sarah" }], createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "m2", conversationId: "c1", senderId: "pam", senderName: "Pam", senderRole: "Servante de l'Éternel", type: "TEXT", content: "Le live de ce soir est confirmé à 20h. Préparez vos cœurs.", reactions: [{ emoji: "🙏", userId: "u2", userName: "Joseph" }, { emoji: "✋", userId: "u3", userName: "Rébecca" }], createdAt: new Date(Date.now() - 3600000).toISOString() },
  ],
  c2: [
    { id: "m3", conversationId: "c2", senderId: "kongo", senderName: "Pasteur Kongo", senderRole: "Pasteur", type: "TEXT", content: "Shalom pasteurs. J'aimerais votre avis sur l'enseignement d'Hénoch.", reactions: [], createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "m4", conversationId: "c2", senderId: "pastor1", senderName: "Pasteur Samuel", senderRole: "Pasteur affilié", type: "VERSE", content: "Genèse 5:24 est central ici.", verseRef: "Genèse 5:24", verseText: "Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit.", reactions: [{ emoji: "🙏", userId: "kongo", userName: "Pasteur Kongo" }], createdAt: new Date(Date.now() - 7000000).toISOString() },
    { id: "m5", conversationId: "c2", senderId: "pastor1", senderName: "Pasteur Samuel", senderRole: "Pasteur affilié", type: "TEXT", content: "Shalom pasteur, j'ai une question sur l'enseignement d'hier.", reactions: [], createdAt: new Date(Date.now() - 7200000).toISOString() },
  ],
  c3: [
    { id: "m6", conversationId: "c3", senderId: "pam", senderName: "Pam", senderRole: "Servante de l'Éternel", type: "TEXT", content: "Bienvenue Sarah ! Nous sommes heureux de t'accueillir dans la communauté.", reactions: [{ emoji: "🙏", userId: "user1", userName: "Sarah" }], createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "m7", conversationId: "c3", senderId: "user1", senderName: "Sarah", senderRole: "Nouvelle croyante", type: "TEXT", content: "Merci pour l'accueil ! J'ai hâte d'apprendre.", reactions: [{ emoji: "🙏", userId: "pam", userName: "Pam" }], createdAt: new Date(Date.now() - 1800000).toISOString() },
  ],
  c4: [
    { id: "m8", conversationId: "c4", senderId: "user3", senderName: "Rébecca", senderRole: "Disciple", type: "TEXT", content: "Ma mère est hospitalisée. Priez pour sa guérison s'il vous plaît.", reactions: [{ emoji: "🙏", userId: "kongo", userName: "Pasteur Kongo" }, { emoji: "🙏", userId: "user1", userName: "Sarah" }], createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: "m9", conversationId: "c4", senderId: "user3", senderName: "Rébecca", senderRole: "Disciple", type: "TEXT", content: "Je prie pour ta guérison. Que Yeshoua te restaure.", reactions: [], createdAt: new Date(Date.now() - 900000).toISOString() },
  ],
  c5: [
    { id: "m10", conversationId: "c5", senderId: "pam", senderName: "Pam", senderRole: "Servante de l'Éternel", type: "TEXT", content: "Shalom ! Que la paix du Seigneur soit avec toi.", reactions: [], createdAt: new Date(Date.now() - 300000).toISOString() },
  ],
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", authorName: "Pam", authorRole: "Servante de l'Éternel", title: "Live spécial ce soir", body: "Le Seigneur m'a donné une parole pour la communauté. Live à 20h sur le site. Préparez vos cœurs.", priority: "IMPORTANT", target: "ALL", requiresConfirmation: true, publishedAt: new Date(Date.now() - 3600000).toISOString(), confirmedByCurrentUser: false, confirmCount: 47, totalRecipients: 124 },
  { id: "a2", authorName: "Pasteur Kongo", authorRole: "Pasteur", title: "Réunion des pasteurs affiliés", body: "Réunion ce samedi à 15h. Sujets : calendrier liturgique, préparation Pessah.", priority: "NORMAL", target: "PASTORS", requiresConfirmation: true, publishedAt: new Date(Date.now() - 86400000).toISOString(), confirmedByCurrentUser: true, confirmCount: 12, totalRecipients: 18 },
  { id: "a3", authorName: "Pam", authorRole: "Servante de l'Éternel", title: "Alerte — Censure YouTube", body: "Notre chaîne YouTube a reçu un avertissement. Les lives sont temporairement restreints. Utilisez le site comme source principale.", priority: "URGENT", target: "ALL", requiresConfirmation: true, publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), confirmedByCurrentUser: true, confirmCount: 89, totalRecipients: 124 },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "cmp1", name: "Rappel live hebdomadaire", channel: "PUSH", target: "Tous les membres", status: "RUNNING", progress: 65, total: 124, sent: 81 },
  { id: "cmp2", name: "Newsletter mensuelle", channel: "EMAIL", target: "Membres vérifiés", status: "COMPLETED", progress: 100, total: 87, sent: 87 },
  { id: "cmp3", name: "Notification fête biblique", channel: "SITE", target: "Tous", status: "SCHEDULED", progress: 0, total: 124, sent: 0 },
];

export const MOCK_CHANNELS: ChannelStatus[] = [
  { id: "ch1", name: "Site web", type: "PORTAIL", status: "ONLINE", rate: 100 },
  { id: "ch2", name: "Notifications Push", type: "PUSH", status: "ONLINE", rate: 99.5 },
  { id: "ch3", name: "Email", type: "EMAIL", status: "ONLINE", rate: 99.9 },
  { id: "ch4", name: "WhatsApp", type: "WHATSAPP", status: "DEGRADED", rate: 85.2 },
];

export const MOCK_CALLS: CallHistory[] = [
  { id: "call1", type: "AUDIO", direction: "outgoing", contact: "Pam", duration: 1245, status: "ANSWERED", date: new Date(Date.now() - 7200000).toISOString() },
  { id: "call2", type: "VIDEO", direction: "incoming", contact: "Pasteur Kongo", duration: 0, status: "MISSED", date: new Date(Date.now() - 18000000).toISOString() },
  { id: "call3", type: "AUDIO", direction: "incoming", contact: "Pasteur Samuel", duration: 678, status: "ANSWERED", date: new Date(Date.now() - 86400000).toISOString() },
];

export const MOCK_BIBLE_REFS: BibleQuickRef[] = [
  { reference: "Genèse 5:24", text: "Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit.", book: "Genèse" },
  { reference: "Ésaïe 11:12", text: "Il rassemblera les dispersés d'Israël des quatre extrémités de la terre.", book: "Ésaïe" },
  { reference: "1 Thessaloniciens 4:16", text: "Le Seigneur descendra du ciel au son de la trompette de Dieu.", book: "1 Thessaloniciens" },
  { reference: "Matthieu 18:19", text: "Si deux d'entre vous s'accordent sur la terre, cela leur sera accordé.", book: "Matthieu" },
  { reference: "Hébreux 11:5", text: "C'est par la foi qu'Hénoch fut enlevé pour qu'il ne vît point la mort.", book: "Hébreux" },
];

export const QUICK_REACTIONS = ["🙏", "✋", "❤️", "📖", "🔥", "⭐"];

export const PRIORITY_STYLES: Record<AnnouncementPriority, { bg: string; text: string; label: string }> = {
  INFO: { bg: "bg-stone/15", text: "text-stone", label: "INFO" },
  NORMAL: { bg: "bg-blue-50", text: "text-blue-700", label: "ANNONCE" },
  IMPORTANT: { bg: "bg-amber-50", text: "text-amber-700", label: "IMPORTANT" },
  URGENT: { bg: "bg-rose-50", text: "text-rose-700", label: "URGENT" },
};

export const TARGET_LABELS: Record<AnnouncementTarget, string> = {
  ALL: "Toute la communauté",
  PASTORS: "Pasteurs affiliés",
  DISCIPLES: "Disciples",
  NEW_BELIEVERS: "Nouveaux croyants",
  INTERCESSION: "Chaîne d'intercession",
};
