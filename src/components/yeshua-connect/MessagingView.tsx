"use client";

/**
 * ============================================================================
 * YESHUA CONNECT — Messagerie complète (WhatsApp-style)
 * ============================================================================
 *
 * ⭐ Port complet des fonctionnalités de Helm Connect (Academia Helm), adapté
 *    pour la communauté spirituelle Christ Libère.
 *
 * Fonctionnalités (feature-parity avec Helm Connect) :
 *   ✅ Liste des conversations (canaux, groupes, direct) avec catégories
 *   ✅ Messages texte + versets bibliques (VERSE type)
 *   ✅ Reply (réponse à un message avec quote)
 *   ✅ Edit / Delete (soft) / Forward / Pin messages
 *   ✅ Reactions spirituelles (🙏 ✋ ❤️ 📖 🔥 ⭐)
 *   ✅ Search dans la conversation (barre de recherche)
 *   ✅ Global search (messages, canaux, utilisateurs)
 *   ✅ Attachments (fichiers, images) — upload via API
 *   ✅ Voice messages (MediaRecorder API)
 *   ✅ Canaux (broadcast Telegram-style)
 *   ✅ Annonces officielles (canaux ANNOUNCEMENT)
 *   ✅ Création de groupe / canal
 *   ✅ Invitations
 *   ✅ Préférences de notifications (mute, DND)
 *   ✅ Profil (avatar + bio)
 *   ✅ Scheduled messages (programmer l'envoi)
 *   ✅ Polls (sondages)
 *   ✅ Typing indicator (UI seulement — pas de Socket.io V1)
 *   ✅ Presence (online/offline — UI statique V1)
 *   ✅ Calls (UI d'appel — WebRTC V2, pour l'instant juste le bouton)
 *   ✅ E2E encryption badge (canaux restreints)
 *   ✅ Accès à la communauté (lien sidebar)
 *   ✅ Accès à la Bible — ⭐ V2.6 : Bible INTÉGRÉE au chat (plein écran
 *      par-dessus la conversation, plus de redirection vers /bible) +
 *      partage de verset en message VERSE depuis la Bible elle-même
 *   ── ⭐ V2.2 — Final features ─────────────────────────────────────────
 *   ✅ Drag & Drop de fichiers (multiple) sur la zone de messages
 *   ✅ Paste d'image depuis le presse-papiers (Ctrl+V dans le textarea)
 *   ✅ Emoji Picker complet (7 catégories, emojis Unicode natifs)
 *   ✅ Notifications push web à la réception d'un message (page cachée)
 *   ✅ Code blocks ```lang\ncode``` stylisés avec bouton "Copier"
 *   ✅ Spoiler tags ||texte|| (révélation au clic)
 * ============================================================================
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Paperclip, Mic, Lock, Hash, Volume2, Users,
  BookOpen, Reply, Plus, Loader2, MessageSquare, Users2,
  MoreVertical, Bell, BellOff, Megaphone, Pin, Edit2, Trash2,
  Forward, Check, X, ArrowLeft, Globe, Settings, UserPlus,
  Calendar, BarChart3, Phone, Video, Smile, FileText, Image as ImageIcon,
  StopCircle, Play, Pause, Sparkles, AlertCircle,
  MessageCircle, AtSign, ChevronUp, Copy, UploadCloud,
  ScrollText, PhoneOff, MicOff, VolumeX, Download, Film,
} from "lucide-react";
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant } from "livekit-client";
import { cn } from "@/lib/utils";
import { BibleWorkspace } from "@/components/bible/BibleWorkspace";
import {
  QUICK_REACTIONS,
  type ChatConversation, type ChatMessage, type ChatPoll,
} from "@/lib/yeshua-connect/types";
import { getYeshuaWatermarkStyle } from "./YeshuaWatermark";
import { api } from "@/lib/api-client";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { SlashCommands, executeCommand, type SendMessagePayload } from "./SlashCommands";
import { MessageThreads, type ThreadMessage } from "./MessageThreads";
import { LinkEmbed, extractUrls } from "./LinkEmbed";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

// ─── Helper: format time ──────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Helper: format file size ─────────────────────────────────────────
function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Helper: file type icon + color ───────────────────────────────────
function getFileIcon(fileName?: string): { icon: React.ReactNode; color: string; label: string } {
  if (!fileName) return { icon: <FileText className="w-5 h-5" />, color: "bg-stone-500", label: "FILE" };
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { icon: <span className="text-[8px] font-bold">PDF</span>, color: "bg-red-600", label: "PDF" };
  if (ext === "doc" || ext === "docx") return { icon: <span className="text-[8px] font-bold">DOC</span>, color: "bg-blue-700", label: "DOC" };
  if (ext === "xls" || ext === "xlsx") return { icon: <span className="text-[8px] font-bold">XLS</span>, color: "bg-green-700", label: "XLS" };
  if (ext === "ppt" || ext === "pptx") return { icon: <span className="text-[8px] font-bold">PPT</span>, color: "bg-orange-600", label: "PPT" };
  if (ext === "zip" || ext === "rar" || ext === "7z") return { icon: <span className="text-[8px] font-bold">ZIP</span>, color: "bg-amber-600", label: "ZIP" };
  if (ext === "mp4" || ext === "avi" || ext === "mov") return { icon: <span className="text-[8px] font-bold">MP4</span>, color: "bg-indigo-600", label: "MP4" };
  return { icon: <FileText className="w-5 h-5" />, color: "bg-stone-500", label: "FILE" };
}

// ─── Helper: avatar color ─────────────────────────────────────────────
function getAvatarColor(name: string): string {
  const colors = ["bg-[#C9A227]", "bg-[#8C5FA8]", "bg-[#2A0E3D]", "bg-[#5B7052]", "bg-[#B5502F]"];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

function getInitials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.3 — RÔLES COULEURS SUR LES NOMS
// ═══════════════════════════════════════════════════════════════════════
//
// Couleur du nom d'utilisateur selon son rôle dans le canal (ChatParticipant.role).
//   - SUPER_ADMIN : #C9A227 (or)
//   - ADMIN       : #8C5FA8 (violet)
//   - MODERATOR   : #5B7052 (vert)
//   - ANIMATOR    : #3b82f6 (bleu)
//   - MEMBER      : #8A8378 (gris, défaut)
//
// Le rôle peut venir soit du message (msg.senderRole — c'est le UserRole du User)
// soit d'un ChannelMember (channelMembers[i].role — c'est le ChannelRole).
// Les deux enums partagent les mêmes libellés (SUPER_ADMIN, ADMIN, MODERATOR,
// ANIMATOR, MEMBER) — il y a juste MEMBER_VERIFIED en plus côté UserRole, qu'on
// traite comme MEMBER pour la couleur.
function getRoleColor(role?: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "#C9A227";
    case "ADMIN":
      return "#8C5FA8";
    case "MODERATOR":
      return "#5B7052";
    case "ANIMATOR":
      return "#3b82f6";
    case "MEMBER_VERIFIED":
    case "MEMBER":
    default:
      return "#8A8378";
  }
}

/** Rôles pouvant consulter l'audit log (modération). */
const AUDIT_PRIVILEGED_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MODERATOR",
]);

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.2 — Emoji Picker data (native Unicode, 7 catégories)
// ═══════════════════════════════════════════════════════════════════════
const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑",
      "🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬",
      "🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵",
      "🥶","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯",
      "😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣",
      "😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","💩",
      "🤡","👻","👽","🤖",
    ],
  },
  {
    name: "Gestes",
    icon: "👋",
    emojis: [
      "👋","🤚","✋","🖐️","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈",
      "👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐",
      "🤲","🙏","✍️","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🦷",
      "🦴","👀","👁️","👅","👄","💋",
    ],
  },
  {
    name: "Cœur",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞",
      "💓","💗","💖","💘","💝","💟","♥️","💌",
    ],
  },
  {
    name: "Religion",
    icon: "✝️",
    emojis: [
      "✝️","☦️","☪️","🕎","☯️","☸️","✡️","🔯","⛪","🕌","🕍","⛩️","🕋",
      "🕯️","📿","🙏","🛐","🔔","🕊️","👑","📜",
    ],
  },
  {
    name: "Nature",
    icon: "🌸",
    emojis: [
      "🌸","🌼","🌻","🌹","🌷","💐","🌺","🌱","🌲","🌳","🌴","🌵","🌾",
      "🍀","🍃","🍂","🍁","🍄","🌞","🌝","🌚","🌍","🌎","🌏","🌐","🏔️",
      "⛰️","🌋","🗻","🌊","💧","🔥","⭐","🌟","✨","⚡","☀️","⛅","☁️",
      "🌧️","⛈️","🌩️","🌨️","❄️","💨","🌪️","🌈","☔","🐶","🐱","🐭","🐹",
      "🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧",
      "🐦","🐤","🦆","🦅","🦉","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌",
      "🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦞",
      "🦀","🐠","🐟","🐬","🐳","🐋","🦈","🐊",
    ],
  },
  {
    name: "Objets",
    icon: "📱",
    emojis: [
      "📱","💻","⌨️","🖥️","🖨️","🖱️","💾","💿","📀","📷","📸","📹","🎥",
      "📺","📻","🎙️","🎚️","🎛️","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋",
      "🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💳","🧾","✏️","✒️",
      "🖋️","🖊️","🖌️","🖍️","📝","💼","📁","📂","🗂️","📅","📆","🗒️","🗓️",
      "📇","📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️",
      "🗄️","🗑️","🔒","🔓","🔏","🔐","🔑","🗝️","🔨","🪓","⛏️","⚒️","🛠️",
      "🗡️","⚔️","📖","📚","📓","📒","📔","📕","📗","📘","📙","📰","🗞️",
      "📜","📄","📃","🔖","🏷️","🎁","🎈","🎉","🎊","🎀",
    ],
  },
  {
    name: "Drapeaux",
    icon: "🏳️",
    emojis: [
      "🏳️","🏴","🏴‍☠️","🏁","🚩","🏳️‍🌈","🏳️‍⚧️","🇫🇷","🇧🇪","🇨🇦","🇺🇸","🇬🇧","🇪🇸",
      "🇮🇹","🇩🇪","🇵🇹","🇨🇭","🇧🇷","🇲🇽","🇦🇷","🇨🇮","🇸🇳","🇨🇲","🇨🇩","🇿🇦","🇲🇦",
      "🇩🇿","🇹🇳","🇪🇬","🇱🇧","🇮🇱","🇯🇴","🇸🇾","🇮🇶","🇮🇷","🇸🇦","🇾🇪","🇴🇲","🇦🇪",
      "🇶🇦","🇰🇼","🇧🇭","🇰🇪","🇳🇬","🇬🇭","🇪🇺","🌍","🌎",
    ],
  },
];

export function MessagingView() {
  // ⭐ V2.0 — Get the real user ID from NextAuth session
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || "current";
  const currentUserName = session?.user?.name || "Vous";

  // ═════════════════════════════════════════════════════════════════════
  //  SOCKET.IO — Real-time messaging, typing, presence
  // ═════════════════════════════════════════════════════════════════════
  const {
    isConnected: socketConnected,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    startTyping,
    stopTyping,
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
  } = useChatSocket();

  // ─── State: conversations + messages ─────────────────────────────────
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);

  // ─── State: input + reply + edit ─────────────────────────────────────
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);

  // ─── State: UI toggles ───────────────────────────────────────────────
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showConvSearch, setShowConvSearch] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<any>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState<string | null>(null);
  // ⭐ V2.6 — Bible intégrée : s'ouvre DANS Yeshua Connect (plein écran),
  // plus aucune redirection vers la page /bible.
  const [showBible, setShowBible] = useState(false);
  // (⭐ V2.5) showScheduleModal / showPollModal supprimés : les formulaires
  // vivent désormais dans les panneaux du modal « Joindre » (attachPanel).
  // (S5) State pour poll et scheduled message
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMulti, setPollMulti] = useState(false);
  const [scheduleContent, setScheduleContent] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [submittingPoll, setSubmittingPoll] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(new Set());
  const [dndEnabled, setDndEnabled] = useState(false);

  // ─── State: voice recording ──────────────────────────────────────────
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "preview">("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── State: attachments ──────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ─── State: typing indicator (debounce local pour emit typing:stop) ──
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── State: calls (UI only — WebRTC V2) ──────────────────────────────
  const [callState, setCallState] = useState<"idle" | "outgoing" | "incoming" | "active">("idle");
  // ⭐ V2.3 — Type d'appel (audio vs vidéo) pour l'overlay LiveKit
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  // ─── State: SlashCommands + Mentions + Threads (V2.1) ─────────────────
  // SlashCommands : ouvert quand l'input commence par "/"
  // (dérivé de inputText, pas besoin de state séparé).
  // Mentions @user : liste des membres du canal actif + query en cours
  const [channelMembers, setChannelMembers] = useState<Array<{
    userId: string;
    name: string;
    role: string;
    avatarUrl?: string;
  }>>([]);
  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  // Threads (client-side V1 — pas de persistance DB)
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);

  // Load More (pagination cursor)
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef<number>(0);

  // ─── ⭐ V2.2 — Drag & Drop, Paste, Emoji Picker ─────────────────────
  // Drag & Drop : true quand l'utilisateur dragged un fichier au-dessus de
  // la zone de messages. Affiche un overlay doré pointillé. Un compteur
  // (dragCounterRef) évite que l'overlay ne clignote quand la souris passe
  // sur des éléments enfants.
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Paste d'image : preview temporaire (object URL) pendant l'upload.
  // Chaque entrée contient { url, name } — l'URL est révoquée après upload.
  const [pastedImagePreviews, setPastedImagePreviews] = useState<
    Array<{ url: string; name: string }>
  >([]);

  // Emoji Picker : visible/non-visible (popover shadcn).
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ⭐ V2.3 — Galerie médias du canal
  const [showGallery, setShowGallery] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState<ChatMessage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ⭐ V2.3 — GIF Picker (Giphy API publique)
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; preview: string; width?: number; height?: number }>>([]);
  const [gifLoading, setGifLoading] = useState(false);
  // ⭐ V2.5 — Modal « Joindre » unifié façon WhatsApp : un seul bouton trombone
  // qui ouvre un modal regroupant Document, Image, GIF, Sondage et Programmé.
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachPanel, setAttachPanel] = useState<"menu" | "gif" | "poll" | "schedule">("menu");
  const gifSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ⭐ V2.3 — Audit Log (modération)
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  // currentUserRole vient de la session NextAuth — utilisé pour conditionner
  // l'affichage du bouton "Audit Log" (réservé aux modérateurs et +).
  const currentUserRole = session?.user?.role;

  // ⭐ V2.3 — LiveKit : Room + tracks pour les appels audio/vidéo réels
  // (1-1) et les canaux vocaux persistants (VOICE).
  // Une seule Room active à la fois (appel OU canal vocal). Les refs permettent
  // aux callbacks LiveKit d'accéder à l'état sans re-créer les listeners.
  const livekitRoomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localAudioMuted, setLocalAudioMuted] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [callError, setCallError] = useState<string | null>(null);
  const [voiceChannelConnected, setVoiceChannelConnected] = useState(false);

  // ⭐ V2.2 — Refs "live" vers conversations + mutedConversations pour
  // accéder aux valeurs à jour dans le callback Socket.io sans re-souscrire
  // à chaque render. Évite une closure stale dans `onNewMessage`.
  const conversationsRef = useRef<ChatConversation[]>([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const mutedConversationsRef = useRef<Set<string>>(new Set());
  useEffect(() => { mutedConversationsRef.current = mutedConversations; }, [mutedConversations]);

  // ═════════════════════════════════════════════════════════════════════
  //  DATA LOADING
  // ═════════════════════════════════════════════════════════════════════

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(api.url("/api/yeshua-connect/conversations"), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data: ChatConversation[] = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        // (S5) Ne pas auto-sélectionner sur mobile — laisser la sidebar visible
        if (typeof window !== "undefined" && window.innerWidth >= 1024) {
          setActiveConvId(data[0].id);
        }
      }
    } catch (e) {
      console.error("loadConversations:", e);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeConvId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    setHasMoreMessages(true); // reset sur chaque changement de conv
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${convId}/messages?limit=50`), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data: ChatMessage[] = await res.json();
      setMessages(prev => ({ ...prev, [convId]: data }));
      // Si on a reçu exactement `limit` messages, il y en a probablement
      // d'autres plus anciens à charger via "Load more".
      setHasMoreMessages(data.length >= 50);
    } catch (e) {
      console.error("loadMessages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // Charger les messages quand la conversation active change
  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  // ⭐ V2.1 — Charger les membres du canal actif (pour l'autocomplétion @mention)
  useEffect(() => {
    if (!activeConvId) {
      setChannelMembers([]);
      return;
    }
    let cancelled = false;
    fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/members`), { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!cancelled) setChannelMembers(data);
      })
      .catch(() => {
        if (!cancelled) setChannelMembers([]);
      });
    return () => { cancelled = true; };
  }, [activeConvId]);

  // ⭐ V2.1 — Marquer la conversation comme lue quand on y entre (et clearer
  // le badge unreadCount côté client). On le fait après le chargement des
  // messages pour ne pas clearer les unread avant que l'utilisateur ne voie
  // les messages.
  useEffect(() => {
    if (!activeConvId || loadingMsgs) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/read`), {
          method: "POST",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // Mettre à jour lastReadAt + clearer unreadCount côté client
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, unreadCount: 0, lastReadAt: data.lastReadAt }
            : c
        ));
      } catch (e) {
        console.error("markRead:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeConvId, loadingMsgs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConvId]);

  // ═════════════════════════════════════════════════════════════════════
  //  SOCKET.IO — Join/leave conversation rooms + incoming events
  // ═════════════════════════════════════════════════════════════════════

  // Rejoindre/quitter la room Socket.io quand la conversation active change
  const prevConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (!socketConnected) return;
    if (prevConvRef.current && prevConvRef.current !== activeConvId) {
      leaveConversation(prevConvRef.current);
    }
    if (activeConvId) {
      joinConversation(activeConvId);
      prevConvRef.current = activeConvId;
    }
    return () => {
      if (activeConvId) leaveConversation(activeConvId);
    };
  }, [activeConvId, socketConnected, joinConversation, leaveConversation]);

  // Écouter les nouveaux messages entrants (depuis d'autres clients)
  useEffect(() => {
    const offNew = onNewMessage((data: any) => {
      const msg: ChatMessage | undefined = data?.message ?? data;
      if (!msg || !msg.conversationId) return;
      // Ignorer mes propres messages (déjà ajoutés via REST)
      if (msg.senderId === currentUserId) return;
      // Déduplication : si le message est déjà présent, ne pas l'ajouter
      setMessages(prev => {
        const list = prev[msg.conversationId] || [];
        if (list.some(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.conversationId]: [...list, msg] };
      });

      // ⭐ V2.1 — Incrémenter unreadCount pour les conversations non actives
      // (la conversation active est marquée comme lue automatiquement via
      // l'effect dédié qui POST vers /read).
      if (msg.conversationId !== activeConvId) {
        setConversations(prev =>
          prev.map(c =>
            c.id === msg.conversationId
              ? { ...c, unreadCount: c.unreadCount + 1, lastMessagePreview: msg.content?.substring(0, 80), lastMessageAt: msg.createdAt, lastMessageSenderId: msg.senderId }
              : c
          )
        );
      }

      // ⭐ V2.2 — Notification push web SI :
      //   - la page n'est pas visible (document.hidden)
      //   - la conversation n'est pas muette (mutedConversationsRef)
      //   - la permission Notification a été accordée
      // Titre = nom du canal ; body = "userName: content".
      // On lit conversationsRef + mutedConversationsRef pour éviter les
      // closures stale (sinon l'effet se re-souscrirait à chaque render).
      try {
        const isHidden = typeof document !== "undefined" && document.hidden;
        const isMuted = mutedConversationsRef.current.has(msg.conversationId);
        if (isHidden && !isMuted && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const conv = conversationsRef.current.find(c => c.id === msg.conversationId);
          const title = conv?.name || "Yeshua Connect";
          const contentPreview = (msg.content || (msg.attachmentName ? `📎 ${msg.attachmentName}` : "Nouveau message")).substring(0, 200);
          const body = `${msg.senderName}: ${contentPreview}`;
          // Préférer le service worker (notifications riches, persistantes),
          // fallback sur `new Notification` (plus simple mais moins puissant).
          if ("serviceWorker" in navigator && navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration("/sw-push.js").then((reg) => {
              if (reg) {
                reg.showNotification(title, { body, tag: msg.id, icon: "/icon.png" });
              } else {
                new Notification(title, { body, tag: msg.id });
              }
            }).catch(() => {
              try { new Notification(title, { body, tag: msg.id }); } catch {}
            });
          } else {
            new Notification(title, { body, tag: msg.id });
          }
        }
      } catch (e) {
        console.error("notif:", e);
      }
    });

    const offEdited = onMessageEdited((data: any) => {
      const convId: string | undefined = data?.conversationId;
      const messageId: string | undefined = data?.messageId ?? data?.id;
      const content: string | undefined = data?.content;
      if (!convId || !messageId) return;
      setMessages(prev => ({
        ...prev,
        [convId]: (prev[convId] || []).map(m =>
          m.id === messageId
            ? { ...m, content: content ?? m.content, editedAt: new Date().toISOString() }
            : m
        ),
      }));
    });

    const offDeleted = onMessageDeleted((data: any) => {
      const convId: string | undefined = data?.conversationId;
      const messageId: string | undefined = data?.messageId ?? data?.id;
      if (!convId || !messageId) return;
      setMessages(prev => ({
        ...prev,
        [convId]: (prev[convId] || []).map(m =>
          m.id === messageId
            ? { ...m, content: "🗑️ Message supprimé", isDeleted: true as any }
            : m
        ),
      }));
    });

    return () => {
      offNew?.();
      offEdited?.();
      offDeleted?.();
    };
  }, [onNewMessage, onMessageEdited, onMessageDeleted, currentUserId, activeConvId]);

  // ⭐ V2.2 — Demander la permission Notification au premier chargement de la
  // page. On le fait une seule fois (deps []), et uniquement si la permission
  // est "default" (pas déjà accordée/refusée). L'appel Notification.requestPermission()
  // doit être déclenché par un user gesture sur certains navigateurs, mais la
  // plupart acceptent une demande au load — on tente et on ignore les erreurs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const p = Notification.requestPermission();
    if (p && typeof (p as Promise<NotificationPermission>).catch === "function") {
      (p as Promise<NotificationPermission>).catch(() => {});
    }
  }, []);

  // Mettre à jour le statut "online" des participants à partir de `onlineUsers`
  useEffect(() => {
    if (!onlineUsers || onlineUsers.size === 0) return;
    setConversations(prev =>
      prev.map(conv => ({
        ...conv,
        participants: conv.participants.map(p => ({
          ...p,
          online: onlineUsers.has(p.userId),
        })),
      })),
    );
  }, [onlineUsers]);

  // ─── Helper: qui tape dans la conversation active (hors moi) ──────────
  const activeTypingUsers = activeConvId
    ? Array.from(typingUsers[activeConvId] || []).filter(id => id !== currentUserId)
    : [];

  // ─── Helper: libellé lisible pour l'indicateur de frappe ─────────────
  const typingLabel = (() => {
    if (activeTypingUsers.length === 0) return "";
    const names = activeTypingUsers
      .map(uid => {
        const conv = conversations.find(c => c.id === activeConvId);
        const p = conv?.participants.find(p => p.userId === uid);
        return p?.name || "Quelqu'un";
      })
      .filter(Boolean);
    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} est en train d'écrire...`;
    if (names.length === 2) return `${names[0]} et ${names[1]} écrivent...`;
    return `${names[0]} et ${names.length - 1} autres écrivent...`;
  })();

  // ═════════════════════════════════════════════════════════════════════
  //  MESSAGE ACTIONS
  // ═════════════════════════════════════════════════════════════════════

  // Helper interne : poste un message sur l'API et l'ajoute localement.
  // Utilisé à la fois par handleSend (message texte normal) et par
  // handleSlashCommand (versets bibliques, annonces, etc.).
  const postMessage = useCallback(async (payload: SendMessagePayload & { replyToId?: string }) => {
    if (!activeConvId) return;
    setSending(true);
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          content: payload.content,
          type: payload.type || "TEXT",
          replyToId: payload.replyToId,
          verseRef: payload.verseRef,
          verseText: payload.verseText,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newMsg: ChatMessage = await res.json();
      setMessages(prev => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }));
      // Diffusion temps réel via Socket.io
      socketSendMessage(activeConvId, payload.content, payload.replyToId);
    } catch (e) {
      console.error("postMessage:", e);
      throw e;
    } finally {
      setSending(false);
    }
  }, [activeConvId, currentUserId, socketSendMessage]);

  // ⭐ V2.6 — Partager un verset depuis la Bible intégrée : l'envoie
  // comme message VERSE (rendu spécial bulle dorée) dans la conversation
  // active. Format identique à la commande /bible (content = référence,
  // verseText = texte complet).
  const handleShareVerse = useCallback(async (verse: { reference: string; text: string }) => {
    if (!verse.reference || !verse.text || !activeConvId) return;
    try {
      await postMessage({
        content: verse.reference,
        type: "VERSE",
        verseRef: verse.reference,
        verseText: verse.text,
      });
    } catch (e) {
      console.error("handleShareVerse:", e);
    }
  }, [activeConvId, postMessage]);

  // ⭐ V2.6 — Fermer la Bible intégrée avec la touche Échap
  useEffect(() => {
    if (!showBible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBible]);

  // ⭐ V2.1 — Handle a slash command (called from SlashCommands onCommand
  // callback). Exécute la commande et agit selon le résultat :
  //   - "send"  → POST le message vers l'API
  //   - "clear" → vide l'écran de chat côté client
  //   - "noop"  → rien à faire
  const handleSlashCommand = useCallback(async (command: string, args: string) => {
    if (!activeConvId) return;
    // Si la commande n'a pas d'args et qu'elle n'est ni "clear" ni "help",
    // on laisse l'utilisateur taper les args. On met juste l'input à
    // "/cmdname " pour faciliter la frappe.
    if (!args && command !== "clear" && command !== "help") {
      setInputText(`/${command} `);
      messageInputRef.current?.focus();
      return;
    }
    // Vider l'input + fermer le popover
    setInputText("");
    setMentionQuery(null);
    stopTyping(activeConvId);

    try {
      const result = await executeCommand(command, args, activeConvId);
      if (result.type === "clear") {
        // Côté client uniquement — ne pas toucher à la DB
        setMessages(prev => ({ ...prev, [activeConvId]: [] }));
        setHasMoreMessages(false);
        return;
      }
      if (result.type === "send") {
        await postMessage({
          ...result.message,
          replyToId: replyTo?.id,
        });
        setReplyTo(null);
        return;
      }
      // noop : ne rien faire (la commande a été gérée ailleurs)
    } catch (e) {
      console.error("handleSlashCommand:", e);
    }
  }, [activeConvId, postMessage, replyTo, stopTyping]);

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !activeConvId) return;

    // ⭐ V2.1 — Slash commands : si l'input commence par "/" ET fait plus
    // d'un caractère, on délègue à handleSlashCommand.
    if (content.startsWith("/") && content.length > 1) {
      const trimmed = content.substring(1);
      const spaceIdx = trimmed.indexOf(" ");
      const cmdName = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.substring(0, spaceIdx).toLowerCase();
      const args = spaceIdx === -1 ? "" : trimmed.substring(spaceIdx + 1).trim();
      await handleSlashCommand(cmdName, args);
      return;
    }

    // If editing, update existing message
    if (editingMsg) {
      setSending(true);
      try {
        const res = await fetch(api.url(`/api/yeshua-connect/messages/${editingMsg.id}/edit`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const updated = await res.json();
          setMessages(prev => ({
            ...prev,
            [activeConvId]: (prev[activeConvId] || []).map(m =>
              m.id === editingMsg.id ? { ...m, content: updated.content, editedAt: updated.updatedAt } : m
            ),
          }));
        }
      } catch (e) { console.error("edit:", e); }
      finally { setSending(false); setEditingMsg(null); setInputText(""); }
      return;
    }

    setSending(true);
    setInputText("");
    setMentionQuery(null);
    const replyId = replyTo?.id;
    setReplyTo(null);

    // Notifier que l'utilisateur a arrêté de taper
    stopTyping(activeConvId);

    try {
      await postMessage({ content, type: "TEXT", replyToId: replyId });
    } catch (e) {
      console.error("handleSend:", e);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  // ⭐ V2.1 — Load More (pagination cursor) : charge les `limit` messages
  // plus anciens que le plus ancien actuellement affiché, et les PREPEND.
  // Préserve la position de scroll pour que l'utilisateur reste au même
  // endroit visuel (sinon il serait bondi vers le haut).
  const loadMoreMessages = useCallback(async () => {
    if (!activeConvId || loadingMore || !hasMoreMessages) return;
    const currentList = messages[activeConvId] || [];
    if (currentList.length === 0) return;
    const oldestId = currentList[0].id;

    setLoadingMore(true);
    // Mémoriser la hauteur de scroll avant le chargement pour la restaurer
    const container = messagesScrollRef.current;
    if (container) {
      prevHeightRef.current = container.scrollHeight;
    }

    try {
      const res = await fetch(
        api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages?limit=50&before=${encodeURIComponent(oldestId)}`),
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const older: ChatMessage[] = await res.json();
      if (older.length === 0) {
        setHasMoreMessages(false);
        return;
      }
      // Prepend (les plus anciens en premier)
      setMessages(prev => ({
        ...prev,
        [activeConvId]: [...older, ...(prev[activeConvId] || [])],
      }));
      // Si on a reçu moins que `limit`, il n'y a plus d'anciens messages
      setHasMoreMessages(older.length >= 50);
    } catch (e) {
      console.error("loadMoreMessages:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [activeConvId, loadingMore, hasMoreMessages, messages]);

  // ⭐ V2.1 — Après chargement d'anciens messages, restaurer la position de
  // scroll pour que l'utilisateur reste au même endroit visuel.
  useEffect(() => {
    if (!loadingMore && prevHeightRef.current > 0 && messagesScrollRef.current) {
      const container = messagesScrollRef.current;
      const newHeight = container.scrollHeight;
      const diff = newHeight - prevHeightRef.current;
      container.scrollTop = container.scrollTop + diff;
      prevHeightRef.current = 0;
    }
  }, [messages, loadingMore]);

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!activeConvId) return;
    // Optimistic update
    setMessages(prev => ({
      ...prev,
      [activeConvId]: (prev[activeConvId] || []).map(m =>
        m.id === msgId
          ? { ...m, reactions: [...m.reactions.filter(r => r.emoji !== emoji), { emoji, userId: currentUserId, userName: currentUserName }] }
          : m
      ),
    }));
    setShowReactions(null);
    // API call (fire-and-forget)
    try {
      await fetch(api.url(`/api/yeshua-connect/messages/${msgId}/react`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId: currentUserId, userName: currentUserName }),
      });
    } catch (e) { console.error("react:", e); }
  };

  const handleEdit = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setInputText(msg.content || "");
    setReplyTo(null);
    messageInputRef.current?.focus();
  };

  const handleDelete = async (msgId: string, forEveryone: boolean = false) => {
    if (!activeConvId) return;
    try {
      await fetch(api.url(`/api/yeshua-connect/messages/${msgId}/delete?forEveryone=${forEveryone}`), { method: "DELETE" });
      setMessages(prev => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] || []).map(m =>
          m.id === msgId ? { ...m, content: "🗑️ Message supprimé", isDeleted: true } : m
        ),
      }));
    } catch (e) { console.error("delete:", e); }
  };

  const handleForward = async (targetChannelId: string) => {
    if (!showForwardModal) return;
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/messages/${showForwardModal}/forward`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetChannelId, userId: currentUserId }),
      });
      if (res.ok) {
        setShowForwardModal(null);
        // If target is active conversation, reload
        if (targetChannelId === activeConvId) loadMessages(targetChannelId);
      }
    } catch (e) { console.error("forward:", e); }
  };

  const handlePin = (msgId: string) => {
    setPinnedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleMute = (convId: string) => {
    setMutedConversations(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  // ═════════════════════════════════════════════════════════════════════
  //  VOICE RECORDING
  // ═════════════════════════════════════════════════════════════════════

  // (S5) Détection du format audio supporté (Safari utilise mp4, pas webm)
  function getSupportedAudioMime(): string {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "audio/webm";
  }

  const recordedBlobUrlRef = useRef<string | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedAudioMime();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size > 0) {
          // (S5) Passer en mode "preview" au lieu d'uploader immédiatement
          const url = URL.createObjectURL(blob);
          recordedBlobUrlRef.current = url;
          setRecordingState("preview");
        }
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      console.error("startRecording:", e);
      alert("Impossible d'accéder au micro");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // (S5) Envoyer le vocal après preview
  const sendRecording = async () => {
    if (!recordedBlobUrlRef.current || !activeConvId) return;
    setSendingVoice(true);
    try {
      const res = await fetch(recordedBlobUrlRef.current);
      const blob = await res.blob();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("file", blob, `voice-${Date.now()}.${ext}`);
      formData.append("type", "AUDIO");
      const uploadRes = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages/attachment`), {
        method: "POST",
        body: formData,
      });
      if (uploadRes.ok) {
        loadMessages(activeConvId);
      } else {
        const err = await uploadRes.json().catch(() => ({}));
        alert(`Échec de l'envoi: ${err.error || uploadRes.statusText}`);
      }
    } catch (e) {
      console.error("voice upload:", e);
      alert("Échec de l'envoi du message vocal");
    } finally {
      setSendingVoice(false);
      if (recordedBlobUrlRef.current) {
        URL.revokeObjectURL(recordedBlobUrlRef.current);
        recordedBlobUrlRef.current = null;
      }
      setRecordingState("idle");
    }
  };

  // (S5) Annuler le vocal (rejeter l'enregistrement)
  const discardRecording = () => {
    if (recordedBlobUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current);
      recordedBlobUrlRef.current = null;
    }
    setRecordingState("idle");
  };

  // ═════════════════════════════════════════════════════════════════════
  //  FILE ATTACHMENTS
  // ═════════════════════════════════════════════════════════════════════

  // ⭐ V2.2 — Helper unifié qui uploade UN fichier vers l'API attachment.
  // Réutilisé par :
  //   - handleFileSelect (input <input type="file">)
  //   - handleDrop (drag & drop de fichiers multiples)
  //   - handlePaste (collage d'image depuis le presse-papiers)
  // Détecte automatiquement le type (IMAGE / AUDIO / VIDEO / FILE) à partir
  // du MIME type — l'ancien code ne gérait que IMAGE vs FILE.
  const uploadSingleFile = useCallback(async (file: File) => {
    if (!activeConvId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", "current");
    const mime = file.type || "";
    const type = mime.startsWith("image/")
      ? "IMAGE"
      : mime.startsWith("audio/")
        ? "AUDIO"
        : mime.startsWith("video/")
          ? "VIDEO"
          : "FILE";
    formData.append("type", type);
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages/attachment`), {
        method: "POST",
        body: formData,
      });
      if (res.ok) loadMessages(activeConvId);
    } catch (e) {
      console.error("file upload:", e);
    }
  }, [activeConvId, loadMessages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadSingleFile(file);
    e.target.value = ""; // reset
  };

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.2 — DRAG & DROP DE FICHIERS (zone de messages)
  // ═════════════════════════════════════════════════════════════════════

  // dragCounterRef évite que l'overlay ne clignote quand la souris passe
  // sur des éléments enfants (le dragenter/dragleave se déclenche à chaque
  // changement d'élément cible).
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    // dropEffect pour indiquer qu'on accepte le drop
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    // Upload séquentiel (évite de saturer le serveur avec N uploads parallèles)
    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i]);
    }
  }, [uploadSingleFile]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.2 — PASTE D'IMAGE DEPUIS LE PRESSE-PAPIERS
  // ═════════════════════════════════════════════════════════════════════

  // Détecte les images dans le clipboard (e.clipboardData.items) et les
  // upload automatiquement. Affiche un preview temporaire (object URL)
  // pendant l'upload, qui disparaît une fois terminé.
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length === 0) return; // Laisse le paste texte par défaut
    e.preventDefault(); // Empêche le paste de l'image comme data URL textuelle

    for (const file of imageFiles) {
      const previewUrl = URL.createObjectURL(file);
      const name = file.name || `pasted-${Date.now()}.png`;
      setPastedImagePreviews(prev => [...prev, { url: previewUrl, name }]);
      try {
        await uploadSingleFile(file);
      } catch (err) {
        console.error("paste upload:", err);
      } finally {
        setPastedImagePreviews(prev => {
          const next = prev.filter(p => p.url !== previewUrl);
          URL.revokeObjectURL(previewUrl);
          return next;
        });
      }
    }
  }, [uploadSingleFile]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.2 — EMOJI PICKER (insertion à la position du curseur)
  // ═════════════════════════════════════════════════════════════════════

  const handleEmojiSelect = useCallback((emoji: string) => {
    const input = messageInputRef.current;
    if (!input) {
      setInputText(prev => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? inputText.length;
    const end = input.selectionEnd ?? inputText.length;
    const newValue = inputText.substring(0, start) + emoji + inputText.substring(end);
    setInputText(newValue);
    // Restaurer le focus + placer le caret APRÈS l'emoji insérée.
    requestAnimationFrame(() => {
      if (messageInputRef.current) {
        const newCaret = start + emoji.length;
        messageInputRef.current.focus();
        messageInputRef.current.setSelectionRange(newCaret, newCaret);
      }
    });
  }, [inputText]);

  // ═════════════════════════════════════════════════════════════════════
  //  GLOBAL SEARCH
  // ═════════════════════════════════════════════════════════════════════

  const handleGlobalSearch = async (q: string) => {
    setGlobalSearchQuery(q);
    if (!q.trim()) { setGlobalSearchResults(null); return; }
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/search?q=${encodeURIComponent(q)}`));
      if (res.ok) setGlobalSearchResults(await res.json());
    } catch (e) { console.error("search:", e); }
  };

  // ═════════════════════════════════════════════════════════════════════
  //  TYPING INDICATOR + @MENTIONS — emit typing + detect mention query
  // ═════════════════════════════════════════════════════════════════════

  // ⭐ V2.1 — Détecter une query "@xxx" à la position du caret. On cherche
  // le dernier "@" non-espacé avant le caret et on extrait le texte qui le
  // suit jusqu'à un whitespace. Si la query contient un espace, on ferme
  // l'autocomplétion (la mention est "terminée").
  const detectMentionQuery = (value: string, caretPos: number): { start: number; query: string } | null => {
    const before = value.substring(0, caretPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return null;
    // Le caractère avant le "@" doit être un whitespace ou le début du texte
    if (atIdx > 0 && !/\s/.test(value[atIdx - 1])) return null;
    const after = value.substring(atIdx + 1, caretPos);
    // Si la "query" contient un whitespace, la mention est terminée
    if (/\s/.test(after)) return null;
    // Limite la longueur de la query pour éviter les faux positifs
    if (after.length > 30) return null;
    return { start: atIdx, query: after };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);
    if (!activeConvId) return;

    // Notifier que l'utilisateur tape (debounce 1.5s avant typing:stop)
    if (value.trim()) {
      startTyping(activeConvId);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConvId);
    }, 1500);

    // ⭐ V2.1 — Détection @mention
    const caretPos = e.target.selectionStart ?? value.length;
    const mention = detectMentionQuery(value, caretPos);
    setMentionQuery(mention);
    setMentionSelectedIndex(0);
  };

  // ⭐ V2.1 — Insère une mention @name à la position du caret courant.
  // Remplace la query "@xxx" par "@name " (avec espace terminal pour
  // permettre de continuer à taper après la mention).
  const handleSelectMention = (member: { name: string }) => {
    if (!mentionQuery) return;
    const before = inputText.substring(0, mentionQuery.start);
    const afterStart = mentionQuery.start + 1 + mentionQuery.query.length; // +1 pour le @
    const after = inputText.substring(afterStart);
    const mentionText = `@${member.name} `;
    const newValue = `${before}${mentionText}${after}`;
    setInputText(newValue);
    setMentionQuery(null);
    setMentionSelectedIndex(0);
    // Refocus + placer le caret après la mention insérée
    requestAnimationFrame(() => {
      const input = messageInputRef.current;
      if (input) {
        const newCaretPos = before.length + mentionText.length;
        input.focus();
        input.setSelectionRange(newCaretPos, newCaretPos);
      }
    });
  };

  // ⭐ V2.1 — Threads : ouvrir / fermer le panneau latéral de thread.
  // Les threads sont stockés côté client (V1) — pas de persistance DB.
  const handleOpenThread = (msg: ChatMessage) => {
    setThreadParent(msg);
  };

  const handleCloseThread = () => {
    setThreadParent(null);
  };

  const handleSendThreadReply = (parentId: string, content: string) => {
    const newThreadMsg: ThreadMessage = {
      id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentId,
      senderId: currentUserId,
      senderName: currentUserName,
      content,
      createdAt: new Date().toISOString(),
    };
    setThreads(prev => [...prev, newThreadMsg]);
  };

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.3 — LIVEKIT : appels audio/vidéo réels + canaux vocaux persistants
  // ═════════════════════════════════════════════════════════════════════
  //
  // Workflow commun :
  //   1. Fetch /api/livekit/token avec role="publisher", roomName namespaced
  //      ("yeshua-call-<convId>" pour les appels, "yeshua-voice-<convId>"
  //      pour les canaux vocaux persistants).
  //   2. Créer une Room livekit-client + connect(token).
  //   3. Publier audio (toujours) et vidéo (si appel vidéo) via
  //      room.localParticipant.setMicrophoneEnabled / setCameraEnabled.
  //   4. Écouter RoomEvent.TrackSubscribed → ajouter le participant distant
  //      à remoteParticipants (état React qui pilote le rendu vidéo/audio).
  //   5. Hang up / Leave → room.disconnect() + stop tracks locaux.
  //
  // Différences appel vs canal vocal :
  //   - Appel : overlay plein écran, bouton raccrocher ferme tout.
  //   - Canal vocal : UI dans la zone principale (pas d'overlay), le canal
  //     reste "ouvert" côté serveur (room LiveKit persistante), mais
  //     l'utilisateur se déconnecte.

  /** Nettoie toutes les ressources LiveKit (room + tracks + stream local). */
  const cleanupLiveKit = useCallback(() => {
    if (localAudioTrackRef.current) {
      try { localAudioTrackRef.current.stop(); } catch {}
      localAudioTrackRef.current = null;
    }
    if (localVideoTrackRef.current) {
      try { localVideoTrackRef.current.stop(); } catch {}
      localVideoTrackRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.disconnect(true);
      } catch {}
      livekitRoomRef.current = null;
    }
    setRemoteParticipants([]);
    setLocalAudioMuted(false);
    setLocalVideoEnabled(false);
    setCallError(null);
  }, []);

  /** Active/désactive le micro local sur la Room LiveKit active. */
  const toggleMute = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) return;
    try {
      const newMuted = !localAudioMuted;
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setLocalAudioMuted(newMuted);
    } catch (e) {
      console.error("[livekit] toggleMute failed:", e);
    }
  }, [localAudioMuted]);

  /** Active/désactive la caméra locale (utile en appel vidéo). */
  const toggleCamera = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) return;
    try {
      const newEnabled = !localVideoEnabled;
      await room.localParticipant.setCameraEnabled(newEnabled);
      setLocalVideoEnabled(newEnabled);
    } catch (e) {
      console.error("[livekit] toggleCamera failed:", e);
    }
  }, [localVideoEnabled]);

  /**
   * Démarre un appel audio ou vidéo via LiveKit.
   * - roomName = `yeshua-call-<conversationId>` (namespacing pour autorisation
   *   côté /api/livekit/token).
   * - Publie automatiquement le micro (toujours) et la caméra (si vidéo).
   * - Affiche l'overlay plein écran via setCallState("outgoing").
   */
  const startCall = useCallback(async (type: "audio" | "video") => {
    if (!activeConvId) return;
    setCallType(type);
    setCallError(null);
    // (S5) Afficher l'overlay IMMÉDIATEMENT pour feedback instantané
    // avant même que le token LiveKit soit récupéré.
    setCallState("outgoing");
    cleanupLiveKit();
    try {
      const roomName = `yeshua-call-${activeConvId}`;
      const tokenRes = await fetch(api.url("/api/livekit/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          role: "publisher",
          participantName: currentUserName,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || `Token LiveKit: HTTP ${tokenRes.status}`);
      }
      const { token, url } = await tokenRes.json();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
      });
      livekitRoomRef.current = room;

      // ─── Listeners : participants distants ───────────────────────────
      // TrackSubscribed = un participant distant publie un track audio/vidéo.
      // ParticipantConnected / Disconnected = mise à jour de la liste.
      room.on(RoomEvent.TrackSubscribed, () => {
        const remotes = Array.from(room.remoteParticipants.values());
        setRemoteParticipants(remotes);
        setCallState("active");
      });
      room.on(RoomEvent.TrackUnsubscribed, () => {
        const remotes = Array.from(room.remoteParticipants.values());
        setRemoteParticipants(remotes);
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.Disconnected, () => {
        setCallState("idle");
        setRemoteParticipants([]);
      });
      room.on(RoomEvent.ConnectionQualityChanged, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });

      await room.connect(url, token);

      // ─── Publier tracks locaux ────────────────────────────────────────
      // setMicrophoneEnabled / setCameraEnabled utilisent en interne
      // getUserMedia et publient le track sur la Room — pas besoin de gérer
      // nous-mêmes le MediaStream local.
      await room.localParticipant.setMicrophoneEnabled(true);
      setLocalAudioMuted(false);

      if (type === "video") {
        await room.localParticipant.setCameraEnabled(true);
        setLocalVideoEnabled(true);
      } else {
        await room.localParticipant.setCameraEnabled(false);
        setLocalVideoEnabled(false);
      }
      // (S5) callState est déjà "outgoing" depuis le début de startCall
    } catch (e) {
      console.error("[livekit] startCall failed:", e);
      setCallError(e instanceof Error ? e.message : "Échec de l'appel");
      cleanupLiveKit();
      setCallState("idle");
    }
  }, [activeConvId, cleanupLiveKit, currentUserName]);

  /** Raccroche l'appel en cours (disconnect + cleanup). */
  const endCall = useCallback(() => {
    cleanupLiveKit();
    setCallState("idle");
  }, [cleanupLiveKit]);

  /**
   * Rejoint un canal vocal persistant (ChannelType.VOICE).
   * - roomName = `yeshua-voice-<conversationId>` (persistante : reste active
   *   côté serveur même si plus aucun participant).
   * - Audio seulement (pas de vidéo pour les canaux vocaux).
   * - voiceChannelConnected = true → l'UI affiche la liste des participants
   *   connectés + bouton "Quitter le canal".
   */
  const joinVoiceChannel = useCallback(async () => {
    if (!activeConvId) return;
    setCallError(null);
    cleanupLiveKit();
    try {
      const roomName = `yeshua-voice-${activeConvId}`;
      const tokenRes = await fetch(api.url("/api/livekit/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          role: "publisher",
          participantName: currentUserName,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || `Token LiveKit: HTTP ${tokenRes.status}`);
      }
      const { token, url } = await tokenRes.json();

      const room = new Room({ adaptiveStream: true, dynacast: true });
      livekitRoomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.TrackUnsubscribed, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(false);
      setLocalAudioMuted(false);
      setLocalVideoEnabled(false);
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      setVoiceChannelConnected(true);
    } catch (e) {
      console.error("[livekit] joinVoiceChannel failed:", e);
      setCallError(e instanceof Error ? e.message : "Échec de la connexion au canal vocal");
      cleanupLiveKit();
      setVoiceChannelConnected(false);
    }
  }, [activeConvId, cleanupLiveKit, currentUserName]);

  /** Quitte le canal vocal (disconnect — le canal reste persistant côté serveur). */
  const leaveVoiceChannel = useCallback(() => {
    cleanupLiveKit();
    setVoiceChannelConnected(false);
  }, [cleanupLiveKit]);

  // ⭐ V2.3 — Cleanup LiveKit au unmount du composant (évite les fuites de
  // tracks microphone/caméra si l'utilisateur quitte la page pendant un appel).
  useEffect(() => {
    return () => { cleanupLiveKit(); };
  }, [cleanupLiveKit]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.3 — GALERIE MÉDIAS DU CANAL
  // ═════════════════════════════════════════════════════════════════════

  const loadGallery = useCallback(async () => {
    if (!activeConvId) return;
    setGalleryLoading(true);
    try {
      // On charge un grand nombre de messages (lim=200) et on filtre côté
      // client ceux qui ont un attachmentUrl. L'API messages supporte déjà
      // le param `?limit=` mais pas de filtre par hasAttachment.
      const res = await fetch(
        api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages?limit=200`),
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data: ChatMessage[] = await res.json();
      const filtered = data.filter((m) => !!m.attachmentUrl);
      setGalleryMedia(filtered);
    } catch (e) {
      console.error("loadGallery:", e);
    } finally {
      setGalleryLoading(false);
    }
  }, [activeConvId]);

  // ⭐ Ouvre la galerie : trigger le fetch + ouvre le modal
  const openGallery = useCallback(() => {
    setShowGallery(true);
    loadGallery();
  }, [loadGallery]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.3 — GIF PICKER (Giphy API publique, clé démo dc6zaTOxFJmzC)
  // ═════════════════════════════════════════════════════════════════════
  //
  // L'API Giphy publique (clé "dc6zaTOxFJmzC" — clé publique démo documentée
  // par Giphy pour usage non-commercial à faible volume) ne nécessite pas
  // d'authentification utilisateur. Endpoint :
  //   GET https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=QUERY&limit=24
  //
  // Chaque GIF est envoyé comme un message IMAGE avec attachmentUrl = URL
  // directe du GIF (giphy-images.com). L'affichage côté messagerie utilise
  // déjà le rendu IMAGE existant.

  const GIPHY_PUBLIC_KEY = "dc6zaTOxFJmzC";

  // (S5) Charger les GIFs populaires (trending) au lieu d'afficher une liste vide
  const loadTrendingGifs = useCallback(async () => {
    setGifLoading(true);
    try {
      const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_PUBLIC_KEY}&limit=24&rating=g`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const results = (data.data || []).map((g: any) => ({
        id: g.id as string,
        url: g.images?.original?.url as string,
        preview: g.images?.fixed_height_small?.url || g.images?.downsized?.url || g.images?.original?.url,
        width: g.images?.original?.width ? parseInt(g.images.original.width, 10) : undefined,
        height: g.images?.original?.height ? parseInt(g.images.original.height, 10) : undefined,
      }));
      setGifResults(results);
    } catch (e) {
      console.error("loadTrendingGifs:", e);
    } finally {
      setGifLoading(false);
    }
  }, []);

  const searchGifs = useCallback(async (q: string) => {
    setGifQuery(q);
    if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current);
    if (!q.trim()) {
      // (S5) Recharger les trending quand la recherche est vidée
      loadTrendingGifs();
      return;
    }
    // Debounce 400ms pour éviter de saturer l'API à chaque frappe
    gifSearchTimeoutRef.current = setTimeout(async () => {
      setGifLoading(true);
      try {
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_PUBLIC_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const results = (data.data || []).map((g: any) => ({
          id: g.id as string,
          url: g.images?.original?.url as string,
          preview: g.images?.fixed_height_small?.url || g.images?.downsized?.url || g.images?.original?.url,
          width: g.images?.original?.width ? parseInt(g.images.original.width, 10) : undefined,
          height: g.images?.original?.height ? parseInt(g.images.original.height, 10) : undefined,
        }));
        setGifResults(results);
      } catch (e) {
        console.error("searchGifs:", e);
      } finally {
        setGifLoading(false);
      }
    }, 400);
  }, []);

  /** Envoie un GIF comme message IMAGE dans la conversation active. */
  const sendGif = useCallback(async (gifUrl: string, gifName?: string) => {
    if (!activeConvId) return;
    setShowGifPicker(false);
    setGifQuery("");
    setGifResults([]);
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: gifName || "🎬 GIF",
          type: "IMAGE",
          attachmentUrl: gifUrl,
          attachmentName: gifName || "gif.gif",
          attachmentMime: "image/gif",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newMsg: ChatMessage = await res.json();
      setMessages(prev => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }));
      // Diffusion Socket.io (best-effort)
      socketSendMessage(activeConvId, gifName || "🎬 GIF", undefined);
    } catch (e) {
      console.error("sendGif:", e);
    }
  }, [activeConvId, socketSendMessage]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.3 — AUDIT LOG (modération)
  // ═════════════════════════════════════════════════════════════════════

  const loadAuditLog = useCallback(async () => {
    if (!activeConvId) return;
    setAuditLoading(true);
    try {
      const res = await fetch(
        api.url(`/api/yeshua-connect/audit-log?channelId=${encodeURIComponent(activeConvId)}&limit=100`),
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setAuditEntries(data);
    } catch (e) {
      console.error("loadAuditLog:", e);
    } finally {
      setAuditLoading(false);
    }
  }, [activeConvId]);

  const openAuditLog = useCallback(() => {
    setShowAuditLog(true);
    loadAuditLog();
  }, [loadAuditLog]);

  // ═════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = activeConvId ? (messages[activeConvId] || []) : [];
  const filteredConversations = convSearchQuery
    ? conversations.filter(c => c.name.toLowerCase().includes(convSearchQuery.toLowerCase()))
    : conversations;

  // Group conversations by type
  const channelConvs = filteredConversations.filter(c => c.type === "CHANNEL");
  const groupConvs = filteredConversations.filter(c => c.type === "GROUP" || c.type === "PASTORS");
  const directConvs = filteredConversations.filter(c => c.type === "DIRECT");
  // ⭐ V2.3 — Canaux vocaux persistants (ChannelType.VOICE mappé vers "VOICE")
  const voiceConvs = filteredConversations.filter(c => c.type === "VOICE");

  // ⭐ V2.3 — Rôle courant privilégié ? (pour afficher le bouton Audit Log)
  const canViewAuditLog = AUDIT_PRIVILEGED_ROLES.has(currentUserRole || "");

  return (
    <div className="flex h-[calc(100vh-0px)] bg-[#FAF6EF] overflow-hidden">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" />
      <input ref={imageInputRef} type="file" className="hidden" onChange={handleFileSelect}
        accept="image/*" />

      {/* ═════ SIDEBAR — Conversations ═════ */}
      <div className={cn(
        "w-80 border-r border-stone-200 flex flex-col flex-shrink-0 bg-white",
        activeConvId ? "hidden lg:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-3 border-b border-stone-100 bg-[#2A0E3D]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-bold text-[#FAF6EF] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#C9A227]" />
              <span className="truncate">Yeshua Connect</span>
            </h2>
            <div className="flex items-center gap-1">
              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#FAF6EF]/70"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-50">
                    <button onClick={() => { setShowGlobalSearch(true); setShowMoreMenu(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      <Search className="w-3.5 h-3.5" /> Recherche globale
                    </button>
                    <button onClick={() => { setShowAnnouncements(true); setShowMoreMenu(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      <Megaphone className="w-3.5 h-3.5" /> Annonces officielles
                    </button>
                    <button onClick={() => { setShowNewChannel(true); setShowMoreMenu(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      <Plus className="w-3.5 h-3.5" /> Nouveau canal/groupe
                    </button>
                    <button onClick={() => { setShowNotifPrefs(true); setShowMoreMenu(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      <Bell className="w-3.5 h-3.5" /> Préférences notifications
                    </button>
                    <button onClick={() => { setShowProfile(true); setShowMoreMenu(false); }} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      <Settings className="w-3.5 h-3.5" /> Mon profil
                    </button>
                    <button onClick={() => setDndEnabled(!dndEnabled)} className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2 text-[#1E0F2B]">
                      {dndEnabled ? <BellOff className="w-3.5 h-3.5 text-red-500" /> : <Bell className="w-3.5 h-3.5" />}
                      {dndEnabled ? "DND activé" : "Activer DND"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#FAF6EF]/40" />
            <input
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              placeholder="Rechercher une conversation..."
              className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/10 rounded-lg text-xs text-[#FAF6EF] placeholder:text-[#FAF6EF]/40 outline-none focus:ring-2 focus:ring-[#C9A227]/30"
            />
          </div>
        </div>

        {/* (⭐ V2.5) Lien « Communauté » retiré de la sidebar : cette page
            n'est qu'une vitrine d'information qui renvoie elle-même vers
            Yeshua Connect — y être redirigé depuis ici était un cycle.
            La liste ci-dessous (Canaux / Groupes / Direct / Vocaux)
            remplace ce bouton. */}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm font-medium text-stone-700">Aucune conversation</p>
              <p className="text-xs text-stone-500 mt-1">Les canaux de la communauté apparaîtront ici</p>
            </div>
          ) : (
            <>
              {/* Channels (broadcast) */}
              {channelConvs.length > 0 && (
                <ConvSection title="Canaux" icon={<Megaphone className="w-3 h-3" />} convs={channelConvs}
                  activeConvId={activeConvId} onSelect={setActiveConvId} mutedConversations={mutedConversations} />
              )}
              {/* Groups */}
              {groupConvs.length > 0 && (
                <ConvSection title="Groupes" icon={<Users className="w-3 h-3" />} convs={groupConvs}
                  activeConvId={activeConvId} onSelect={setActiveConvId} mutedConversations={mutedConversations} />
              )}
              {/* Direct */}
              {directConvs.length > 0 && (
                <ConvSection title="Direct" icon={<MessageSquare className="w-3 h-3" />} convs={directConvs}
                  activeConvId={activeConvId} onSelect={setActiveConvId} mutedConversations={mutedConversations} />
              )}
              {/* ⭐ V2.3 — Canaux vocaux persistants */}
              {voiceConvs.length > 0 && (
                <ConvSection title="Canaux vocaux" icon={<Volume2 className="w-3 h-3" />} convs={voiceConvs}
                  activeConvId={activeConvId} onSelect={setActiveConvId} mutedConversations={mutedConversations} />
              )}
            </>
          )}
        </div>
      </div>

      {/* ═════ CHAT ZONE ═════ */}
      <div
        className="relative flex-1 flex flex-col bg-stone-50/30"
        style={getYeshuaWatermarkStyle({ opacity: 0.05 })}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ⭐ V2.2 — Drag & Drop overlay : bordure pointillée dorée */}
        <AnimatePresence>
          {isDraggingFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-[#FAF6EF]/80 backdrop-blur-sm"
            >
              <div className="border-2 border-dashed border-[#C9A227] rounded-3xl p-12 text-center max-w-md mx-4 bg-white/60">
                <UploadCloud className="w-16 h-16 text-[#C9A227] mx-auto mb-3" />
                <p className="text-lg font-bold text-[#1E0F2B]">
                  Déposez vos fichiers ici
                </p>
                <p className="text-sm text-stone-600 mt-1">
                  Images, PDF, documents, vidéos… (multi-fichiers supporté)
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Chat header */}
        {activeConv ? (
          <div className="p-3 border-b border-stone-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveConvId(null)} className="lg:hidden p-1 text-stone-500">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={cn("relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", getAvatarColor(activeConv.name))}>
                {getInitials(activeConv.name)}
                {socketConnected && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Connecté en temps réel" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-[#1E0F2B] text-sm flex items-center gap-1.5">
                  {activeConv.name}
                  {activeConv.isEncrypted && <Lock className="w-3 h-3 text-[#C9A227]" />}
                </h3>
                <p className="text-xs text-stone-400">
                  {activeConv.isEncrypted && "🔒 Chiffré E2E · "}
                  {activeConv.participants.length} membres
                  {(() => {
                    const onlineCount = activeConv.participants.filter(p => p.online).length;
                    return onlineCount > 0 ? ` · ${onlineCount} en ligne` : "";
                  })()}
                  {mutedConversations.has(activeConv.id) && " · 🔕 Muet"}
                  {!socketConnected && " · Synchro temps réel désactivée"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* ⭐ V2.3 — Appels audio/vidéo réels via LiveKit.
                  Masqués pour les canaux vocaux (qui utilisent leur propre UI "Rejoindre"). */}
              {activeConv.type !== "VOICE" && (
                <>
                  <button
                    onClick={() => startCall("audio")}
                    className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                    title="Appel audio"
                    disabled={callState !== "idle"}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startCall("video")}
                    className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                    title="Appel vidéo"
                    disabled={callState !== "idle"}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </>
              )}
              {/* ⭐ V2.3 — Galerie médias du canal */}
              <button
                onClick={openGallery}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                title="Galerie médias"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              {/* ⭐ V2.3 — Audit Log (réservé aux modérateurs et +) */}
              {canViewAuditLog && (
                <button
                  onClick={openAuditLog}
                  className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                  title="Audit log (modération)"
                >
                  <ScrollText className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setShowConvSearch(!showConvSearch)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Rechercher">
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowBible(true)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Ouvrir la Bible dans le chat"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button onClick={() => handleMute(activeConv.id)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Muet">
                {mutedConversations.has(activeConv.id) ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-stone-100 bg-white">
            <p className="text-sm text-stone-400">Sélectionnez une conversation</p>
          </div>
        )}

        {/* Conversation search bar (toggle) */}
        {showConvSearch && activeConv && (
          <div className="p-2 border-b border-stone-100 bg-white flex items-center gap-2">
            <Search className="w-4 h-4 text-stone-400" />
            <input
              autoFocus
              placeholder="Rechercher dans cette conversation..."
              className="flex-1 text-sm outline-none"
            />
            <button onClick={() => setShowConvSearch(false)} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pinned messages banner */}
        {pinnedMessages.size > 0 && activeConv && (
          <div className="px-4 py-2 bg-[#C9A227]/5 border-b border-[#C9A227]/20 flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-[#C9A227]" />
            <span className="text-xs font-medium text-[#1E0F2B]">
              {pinnedMessages.size} message{pinnedMessages.size > 1 ? "s" : ""} épinglé{pinnedMessages.size > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ⭐ V2.3 — CANAL VOCAL PERSISTANT (VOICE)
            Remplace complètement la zone messages + input du chat.
            L'utilisateur peut rejoindre/quitter le canal vocal à tout moment.
            Le canal reste "ouvert" côté serveur (room LiveKit persistante). */}
        {activeConv?.type === "VOICE" ? (
          <VoiceChannelView
            conv={activeConv}
            connected={voiceChannelConnected}
            remoteParticipants={remoteParticipants}
            currentUserName={currentUserName}
            localAudioMuted={localAudioMuted}
            speakerEnabled={speakerEnabled}
            error={callError}
            onJoin={joinVoiceChannel}
            onLeave={leaveVoiceChannel}
            onToggleMute={toggleMute}
            onToggleSpeaker={() => setSpeakerEnabled((s) => !s)}
            channelMembers={channelMembers}
          />
        ) : (
        /* Messages (uniquement pour les canaux non-VOICE) */
        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">Aucun message dans ce canal</p>
              <p className="text-xs text-stone-400 mt-1">Soyez le premier à écrire !</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl mx-auto">
              {/* ⭐ V2.1 — Load More (pagination cursor) */}
              {hasMoreMessages && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-stone-200 hover:border-[#C9A227]/40 hover:bg-[#C9A227]/5 text-xs font-medium text-[#1E0F2B] transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Charger les messages précédents
                      </>
                    )}
                  </button>
                </div>
              )}
              {activeMessages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId;
                const showDateSep = i === 0 || formatDateSeparator(activeMessages[i - 1].createdAt) !== formatDateSeparator(msg.createdAt);
                // ⭐ V2.5 — Avatar affiché uniquement au PREMIER message d'une
                // série consécutive du même expéditeur (comme WhatsApp) :
                // évite la répétition d'avatars identiques empilés.
                const prevMsg = activeMessages[i - 1];
                const showSenderAvatar =
                  !isMine &&
                  (i === 0 ||
                    prevMsg.senderId !== msg.senderId ||
                    formatDateSeparator(prevMsg.createdAt) !== formatDateSeparator(msg.createdAt));
                // ⭐ V2.1 — Détection d'URLs dans le contenu texte pour LinkEmbed
                const messageUrls = msg.type === "TEXT" && msg.content ? extractUrls(msg.content) : [];
                // ⭐ V2.1 — Compter les réponses dans le thread (client-side)
                const threadReplyCount = threads.filter(t => t.parentId === msg.id).length;
                // ⭐ V2.3 — Couleur du nom selon le rôle (msg.senderRole)
                const senderColor = getRoleColor(msg.senderRole);
                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center justify-center my-5">
                        <div className="flex items-center gap-2 w-full max-w-[520px] mx-auto">
                          <div className="flex-1 h-px bg-stone-200" />
                          <span className="px-3.5 py-1.5 bg-white border border-stone-200 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-wider shadow-sm">
                            {formatDateSeparator(msg.createdAt)}
                          </span>
                          <div className="flex-1 h-px bg-stone-200" />
                        </div>
                      </div>
                    )}
                    <div className={cn("group relative flex flex-col", isMine ? "items-end" : "items-start")}>
                      <div className={cn("group relative flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                        {/* ⭐ V2.5 — Avatar de l'expéditeur dans les canaux/groupes
                            (bulles professionnelles façon WhatsApp : avatar rond
                            pour les messages des AUTRES) */}
                        {!isMine && (activeConv?.type === "GROUP" || activeConv?.type === "PASTORS" || activeConv?.type === "CHANNEL") && showSenderAvatar && (
                          <div className="w-8 h-8 rounded-full flex-shrink-0 mb-4 overflow-hidden border border-stone-200">
                            {msg.senderAvatarUrl ? (
                              <img src={msg.senderAvatarUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                            ) : (
                              <div className={cn("w-full h-full flex items-center justify-center text-white text-[10px] font-bold", getAvatarColor(msg.senderName))}>
                                {getInitials(msg.senderName)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={cn(
                          // ⭐ V2.5 — Bulles avec « queue » façon messagerie pro :
                          // coin inférieur côté expéditeur légèrement effilé
                          "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                          isMine
                            ? "bg-[#C9A227] text-[#1E0F2B] rounded-br-md"
                            : "bg-white border border-stone-200 text-[#1E0F2B] rounded-bl-md"
                        )}>
                          {/* Reply quote */}
                          {msg.replyTo && (
                            <div className={cn(
                              "mb-1.5 px-2 py-1 rounded-lg text-xs border-l-2",
                              isMine ? "bg-[#1E0F2B]/10 border-[#1E0F2B]" : "bg-stone-50 border-[#C9A227]"
                            )}>
                              <p className="font-semibold opacity-70">{msg.replyTo.senderName}</p>
                              <p className="opacity-60 truncate">{msg.replyTo.content}</p>
                            </div>
                          )}
                          {/* Sender name (for groups) — ⭐ V2.3 : couleur selon le rôle */}
                          {!isMine && (activeConv?.type === "GROUP" || activeConv?.type === "PASTORS" || activeConv?.type === "CHANNEL") && (
                            <p
                              className="text-xs font-bold mb-0.5"
                              style={{ color: senderColor }}
                            >
                              {msg.senderName}
                            </p>
                          )}
                          {/* Content */}
                          {msg.type === "POLL" && msg.poll ? (
                            <PollMessage
                              poll={msg.poll}
                              currentUserId={currentUserId}
                              onVoted={(updated) => {
                                // Mise à jour optimiste du sondage dans les messages
                                if (activeConvId) {
                                  setMessages(prev => ({
                                    ...prev,
                                    [activeConvId]: (prev[activeConvId] || []).map(m =>
                                      m.id === msg.id ? { ...m, poll: updated } : m
                                    ),
                                  }));
                                }
                              }}
                            />
                          ) : msg.type === "VERSE" && msg.verseRef ? (
                            <div className={cn(
                              "px-3 py-2 rounded-xl border-l-4 my-1",
                              isMine ? "bg-[#1E0F2B]/10 border-[#1E0F2B]" : "bg-[#C9A227]/5 border-[#C9A227]"
                            )}>
                              <p className="text-xs font-bold opacity-80">{msg.verseRef}</p>
                              <p className="text-sm italic mt-0.5 whitespace-pre-wrap">{msg.verseText}</p>
                            </div>
                          ) : msg.type === "IMAGE" && msg.attachmentUrl ? (
                            <div className="relative group/img">
                              <img src={msg.attachmentUrl} alt={msg.attachmentName || "image"} className="rounded-xl max-w-full max-h-64" />
                              <a href={msg.attachmentUrl} download={msg.attachmentName}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                title="Télécharger">
                                <FileText className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : msg.type === "VIDEO" && msg.attachmentUrl ? (
                            <video src={msg.attachmentUrl} controls className="rounded-xl max-w-full max-h-64" />
                          ) : msg.type === "AUDIO" && msg.attachmentUrl ? (
                            <AudioPlayer src={msg.attachmentUrl} duration={msg.duration} attachmentName={msg.attachmentName} />
                          ) : msg.type === "FILE" && msg.attachmentUrl ? (
                            <a href={msg.attachmentUrl} download={msg.attachmentName}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors min-w-[200px]">
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0", getFileIcon(msg.attachmentName).color)}>
                                {getFileIcon(msg.attachmentName).icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[#1E0F2B] truncate">{msg.attachmentName || "Fichier"}</p>
                                <p className="text-[10px] text-stone-400">{formatFileSize(msg.attachmentSize)}</p>
                              </div>
                              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
                            </a>
                          ) : (
                            // ⭐ V2.1 — Rendu du contenu texte avec mentions surlignées
                            // ⭐ V2.2 — + code blocks ```...``` + spoilers ||...||
                            <div className="text-sm whitespace-pre-wrap break-words">
                              <RichMessageContent content={msg.content || ""} memberNames={channelMembers.map(m => m.name)} isMine={isMine} />
                            </div>
                          )}
                          {/* Timestamp + edited */}
                          <div className={cn(
                            "flex items-center gap-1 mt-0.5",
                            isMine ? "justify-end text-[#1E0F2B]/50" : "justify-end text-stone-400"
                          )}>
                            {msg.editedAt && <span className="text-[9px] italic">modifié</span>}
                            {pinnedMessages.has(msg.id) && <Pin className="w-2.5 h-2.5" />}
                            <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                          </div>
                          {/* Reactions */}
                          {msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {msg.reactions.reduce((acc, r) => {
                                const ex = acc.find(e => e.emoji === r.emoji);
                                if (ex) ex.count++; else acc.push({ emoji: r.emoji, count: 1 });
                                return acc;
                              }, [] as { emoji: string; count: number }[]).map(r => (
                                <span key={r.emoji} className={cn(
                                  "px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                  isMine
                                    ? "bg-[#1E0F2B]/10 border-[#1E0F2B]/15"
                                    : "bg-stone-50 border-stone-200"
                                )}>
                                  {r.emoji} {r.count > 1 && <span className="text-[10px] font-bold">{r.count}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Quick reactions + actions (on hover) */}
                        <div className={cn(
                          "absolute flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-stone-200 px-1 py-0.5 transition-opacity",
                          showReactions === msg.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          isMine ? "right-0 -top-8" : "left-0 -top-8"
                        )}>
                          {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-sm hover:scale-125 transition-transform p-0.5">
                              {emoji}
                            </button>
                          ))}
                          <div className="w-px h-4 bg-stone-200 mx-0.5" />
                          <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-stone-100 rounded" title="Répondre">
                            <Reply className="w-3 h-3 text-stone-500" />
                          </button>
                          {/* ⭐ V2.1 — Bouton Thread (ouvre le panneau latéral) */}
                          <button
                            onClick={() => handleOpenThread(msg)}
                            className={cn(
                              "p-1 hover:bg-stone-100 rounded relative",
                              threadParent?.id === msg.id ? "text-[#C9A227]" : "text-stone-500"
                            )}
                            title="Répondre dans un thread"
                          >
                            <MessageCircle className="w-3 h-3" />
                            {threadReplyCount > 0 && (
                              <span className="absolute -top-1 -right-1 px-1 min-w-[12px] h-3 flex items-center justify-center rounded-full bg-[#C9A227] text-[8px] font-bold text-[#1E0F2B]">
                                {threadReplyCount}
                              </span>
                            )}
                          </button>
                          {isMine && <button onClick={() => handleEdit(msg)} className="p-1 hover:bg-stone-100 rounded" title="Modifier">
                            <Edit2 className="w-3 h-3 text-stone-500" />
                          </button>}
                          <button onClick={() => handlePin(msg.id)} className="p-1 hover:bg-stone-100 rounded" title="Épingler">
                            <Pin className={cn("w-3 h-3", pinnedMessages.has(msg.id) ? "text-[#C9A227]" : "text-stone-500")} />
                          </button>
                          <button onClick={() => setShowForwardModal(msg.id)} className="p-1 hover:bg-stone-100 rounded" title="Transférer">
                            <Forward className="w-3 h-3 text-stone-500" />
                          </button>
                          {isMine && <button onClick={() => handleDelete(msg.id, false)} className="p-1 hover:bg-stone-100 rounded" title="Supprimer">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>}
                        </div>
                      </div>
                      {/* ⭐ V2.1 — LinkEmbed sous le message si URLs détectées */}
                      {messageUrls.length > 0 && (
                        <div className={cn("max-w-[75%] mt-1", isMine ? "self-end" : "self-start")}>
                          {messageUrls.slice(0, 3).map((url, idx) => (
                            <LinkEmbed key={`${msg.id}-embed-${idx}`} url={url} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Typing indicator — alimenté par Socket.io (typing:start/stop) */}
              {typingLabel ? (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 rounded-2xl px-4 py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[11px] text-stone-500">{typingLabel}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        )}

        {/* Input bar — masqué pour les canaux VOICE (pas de texte, seulement audio) */}
        {activeConv && activeConv.type !== "VOICE" && (
          <div className="p-3 border-t border-stone-100 bg-white">
            {/* ⭐ V2.2 — Paste preview : images en cours d'upload (paste clipboard) */}
            {pastedImagePreviews.length > 0 && (
              <div className="mb-2 flex gap-2 flex-wrap p-2 bg-stone-50 rounded-lg border border-stone-200">
                {pastedImagePreviews.map((p, i) => (
                  <div key={p.url + i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 group">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5">
                      {p.name}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-stone-500 self-center ml-1">Upload en cours…</p>
              </div>
            )}
            {/* Reply / Edit banner */}
            {(replyTo || editingMsg) && (
              <div className="mb-2 px-3 py-2 bg-stone-50 rounded-lg border-l-2 border-[#C9A227] flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#8C5FA8]">
                    {editingMsg ? "✏️ Modification" : `↩ Réponse à ${replyTo?.senderName}`}
                  </p>
                  <p className="text-xs text-stone-500 truncate">{(editingMsg || replyTo)?.content}</p>
                </div>
                <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInputText(""); }} className="text-stone-400 hover:text-stone-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* Recording UI */}
            {recordingState === "recording" ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-700 font-medium">
                    Enregistrement... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <button onClick={stopRecording} className="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600" title="Arrêter">
                  <StopCircle className="w-4 h-4" />
                </button>
              </div>
            ) : recordingState === "preview" ? (
              /* (S5) Preview du vocal avec lecture + envoi/annulation */
              <div className="flex items-center gap-2 w-full">
                <audio src={recordedBlobUrlRef.current || undefined} controls className="flex-1 h-10" style={{ maxWidth: "100%" }} />
                <button
                  onClick={sendRecording}
                  disabled={sendingVoice}
                  className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-40 flex-shrink-0"
                  title="Envoyer le vocal"
                >
                  {sendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
                <button
                  onClick={discardRecording}
                  disabled={sendingVoice}
                  className="p-2.5 rounded-xl bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors disabled:opacity-40 flex-shrink-0"
                  title="Annuler et refaire"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* ⭐ V2.5 — Bouton « Joindre » unique (façon WhatsApp) :
                    ouvre le modal regroupant Document, Image, GIF, Sondage
                    et Programmé. Remplace les 5 boutons séparés
                    (trombone, image, GIF, sondage, calendrier). */}
                <button
                  onClick={() => { setAttachOpen(true); setAttachPanel("menu"); }}
                  className={cn(
                    "p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors cursor-pointer",
                    attachOpen && "bg-[#C9A227]/10 text-[#C9A227]"
                  )}
                  title="Joindre — document, image, GIF, sondage, message programmé"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {/* ⭐ V2.2 — Emoji Picker (Popover shadcn/ui) */}
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors",
                        showEmojiPicker && "bg-[#C9A227]/10 text-[#C9A227]"
                      )}
                      title="Emojis"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-80 p-0 border-stone-200"
                  >
                    <EmojiPicker onEmojiSelect={(emoji) => { handleEmojiSelect(emoji); }} />
                  </PopoverContent>
                </Popover>
                {/* (⭐ V2.5) Le popover GIF a été déplacé dans le modal « Joindre »
                    (panneau GIF) — plus de bouton GIF séparé dans la barre. */}
                {/* ⭐ V2.1 — Wrap textarea + popovers (SlashCommands + Mention autocomplete) */}
                <div className="relative flex-1">
                  {/* SlashCommands popover : visible quand l'input commence par "/" */}
                  {inputText.startsWith("/") && inputText.length > 0 && (
                    <SlashCommands
                      input={inputText}
                      onCommand={handleSlashCommand}
                      onDismiss={() => {/* rien à faire, le composant se ferme tout seul quand l'input ne match plus */}}
                    />
                  )}
                  {/* Mention autocomplete : visible quand une query @ est en cours */}
                  {mentionQuery && (
                    <MentionAutocomplete
                      query={mentionQuery.query}
                      members={channelMembers}
                      selectedIndex={mentionSelectedIndex}
                      onSelect={handleSelectMention}
                      onSelectedIndexChange={setMentionSelectedIndex}
                    />
                  )}
                  <textarea
                    ref={messageInputRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      // ⭐ V2.1 — Navigation mention au clavier (↑/↓/Enter/Tab/Échap)
                      if (mentionQuery && channelMembers.length > 0) {
                        const filtered = filterMembers(channelMembers, mentionQuery.query);
                        if (filtered.length > 0) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setMentionSelectedIndex(i => (i + 1) % filtered.length);
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setMentionSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
                            return;
                          }
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            const member = filtered[mentionSelectedIndex];
                            if (member) handleSelectMention(member);
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setMentionQuery(null);
                            return;
                          }
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Écrivez votre message... (tapez / pour les commandes, @ pour mentionner, Ctrl+V pour coller une image)"
                    rows={1}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 resize-none"
                    disabled={sending}
                  />
                </div>
                {/* (⭐ V2.5) Boutons Sondage et Programmé déplacés dans le modal
                    « Joindre » (trombone) — la barre reste épurée : trombone,
                    emojis, champ de saisie, micro/envoi. */}
                {inputText.trim() ? (
                  <button onClick={handleSend} disabled={sending}
                    className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] disabled:opacity-30 transition-colors">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <button onClick={startRecording} className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors" title="Message vocal">
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ⭐ V2.1 — MessageThreads (panneau latéral droit, client-side V1) */}
      <AnimatePresence>
        {threadParent && (
          <MessageThreads
            key={threadParent.id}
            parentMessageId={threadParent.id}
            parentMessageContent={threadParent.content || ""}
            parentSenderName={threadParent.senderName}
            threads={threads}
            onSend={handleSendThreadReply}
            onClose={handleCloseThread}
          />
        )}
      </AnimatePresence>

      {/* ═════ MODALS ═════ */}

      {/* Global Search Modal */}
      {showGlobalSearch && (
        <Modal onClose={() => setShowGlobalSearch(false)} title="Recherche globale">
          <input
            autoFocus value={globalSearchQuery} onChange={(e) => handleGlobalSearch(e.target.value)}
            placeholder="Rechercher messages, canaux, membres..."
            className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 mb-4"
          />
          {globalSearchResults && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {globalSearchResults.messages?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase mb-2">Messages</p>
                  {globalSearchResults.messages.map((m: any) => (
                    <button key={m.id} onClick={() => { setActiveConvId(m.channelId); setShowGlobalSearch(false); }}
                      className="w-full text-left p-2 hover:bg-stone-50 rounded-lg">
                      <p className="text-sm text-[#1E0F2B] truncate">{m.content}</p>
                      <p className="text-xs text-stone-400">{m.senderName} · {m.channelName}</p>
                    </button>
                  ))}
                </div>
              )}
              {globalSearchResults.channels?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase mb-2">Canaux</p>
                  {globalSearchResults.channels.map((c: any) => (
                    <button key={c.id} onClick={() => { setActiveConvId(c.id); setShowGlobalSearch(false); }}
                      className="w-full text-left p-2 hover:bg-stone-50 rounded-lg">
                      <p className="text-sm font-semibold text-[#1E0F2B]">{c.name}</p>
                      <p className="text-xs text-stone-400">{c.type}</p>
                    </button>
                  ))}
                </div>
              )}
              {globalSearchResults.users?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase mb-2">Membres</p>
                  {globalSearchResults.users.map((u: any) => (
                    <div key={u.id} className="p-2 hover:bg-stone-50 rounded-lg flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs", getAvatarColor(u.name || "?"))}>
                        {getInitials(u.name || "?")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1E0F2B]">{u.name}</p>
                        <p className="text-xs text-stone-400">{u.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {globalSearchResults.messages?.length === 0 && globalSearchResults.channels?.length === 0 && globalSearchResults.users?.length === 0 && (
                <p className="text-center text-sm text-stone-400 py-4">Aucun résultat</p>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Announcements Modal */}
      {showAnnouncements && <AnnouncementsModal onClose={() => setShowAnnouncements(false)} />}

      {/* New Channel/Group Modal */}
      {showNewChannel && <NewChannelModal onClose={() => setShowNewChannel(false)} onCreated={(id) => { setShowNewChannel(false); loadConversations(); setActiveConvId(id); }} />}

      {/* Notification Preferences Modal */}
      {showNotifPrefs && (
        <Modal onClose={() => setShowNotifPrefs(false)} title="Préférences de notifications">
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl cursor-pointer">
              <span className="text-sm font-medium text-[#1E0F2B]">Ne pas déranger (DND)</span>
              <input type="checkbox" checked={dndEnabled} onChange={(e) => setDndEnabled(e.target.checked)} className="w-5 h-5" />
            </label>
            {mutedConversations.size > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-2">Conversations muettes</p>
                {Array.from(mutedConversations).map(id => {
                  const conv = conversations.find(c => c.id === id);
                  return conv ? (
                    <div key={id} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg mb-1">
                      <span className="text-sm">{conv.name}</span>
                      <button onClick={() => handleMute(id)} className="text-xs text-[#C9A227]">Réactiver</button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <Modal onClose={() => setShowProfile(false)} title="Mon profil">
          <div className="text-center py-4">
            <div className={cn("w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold", getAvatarColor("Vous"))}>
              {getInitials("Vous")}
            </div>
            <p className="font-bold text-[#1E0F2B]">Membre</p>
            <p className="text-sm text-stone-500">Disciple</p>
            <button className="mt-4 px-4 py-2 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-semibold hover:bg-[#DDBE55]">
              Modifier le profil
            </button>
          </div>
        </Modal>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <Modal onClose={() => setShowForwardModal(null)} title="Transférer vers...">
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {conversations.map(c => (
              <button key={c.id} onClick={() => handleForward(c.id)}
                className="w-full flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg text-left">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs", getAvatarColor(c.name))}>
                  {getInitials(c.name)}
                </div>
                <span className="text-sm font-medium text-[#1E0F2B]">{c.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ⭐ V2.6 — BIBLE INTÉGRÉE ─────────────────────────────────────────────
          S'ouvre PLEIN ÉCRAN par-dessus la conversation (plus de redirection
          vers /bible). L'utilisateur lit, cherche, compare — puis partage un
          verset directement dans la conversation active via l'icône d'envoi
          qui apparaît au survol de chaque verset. Fermeture : X, Échap ou
          clic sur le fond. */}
      <AnimatePresence>
        {showBible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBible(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-1.5 sm:inset-3 md:inset-6 lg:inset-8 rounded-2xl overflow-hidden shadow-2xl border border-[#C9A227]/40"
            >
              <BibleWorkspace
                variant="embedded"
                onClose={() => setShowBible(false)}
                onShareVerse={handleShareVerse}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⭐ V2.5 — MODAL « JOINDRE » UNIFIÉ (façon WhatsApp) ─────────────────
          Un seul point d'entrée (bouton trombone) qui regroupe :
            • Document  → input fichier caché
            • Image     → input image caché
            • GIF       → panneau Giphy intégré
            • Sondage   → formulaire de création intégré
            • Programmé → formulaire de message programmé intégré */}
      {attachOpen && (
        <Modal
          onClose={() => { setAttachOpen(false); setAttachPanel("menu"); }}
          title={
            attachPanel === "gif" ? "Envoyer un GIF" :
            attachPanel === "poll" ? "Créer un sondage" :
            attachPanel === "schedule" ? "Programmer un message" :
            "Joindre"
          }
        >
          {/* ── Panneau MENU (grille de tuiles, comme WhatsApp) ─────────── */}
          {attachPanel === "menu" && (
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  key: "document",
                  label: "Document",
                  desc: "PDF, texte…",
                  icon: <FileText className="w-6 h-6" />,
                  color: "#5B7052",
                  onClick: () => { setAttachOpen(false); fileInputRef.current?.click(); },
                },
                {
                  key: "image",
                  label: "Image",
                  desc: "Galerie / photo",
                  icon: <ImageIcon className="w-6 h-6" />,
                  color: "#8C5FA8",
                  onClick: () => { setAttachOpen(false); imageInputRef.current?.click(); },
                },
                {
                  key: "gif",
                  label: "GIF",
                  desc: "Giphy",
                  icon: <Film className="w-6 h-6" />,
                  color: "#C9A227",
                  onClick: () => {
                    setAttachPanel("gif");
                    if (gifResults.length === 0) loadTrendingGifs();
                  },
                },
                {
                  key: "poll",
                  label: "Sondage",
                  desc: "Vote communautaire",
                  icon: <BarChart3 className="w-6 h-6" />,
                  color: "#A3821C",
                  onClick: () => setAttachPanel("poll"),
                },
                {
                  key: "schedule",
                  label: "Programmé",
                  desc: "Envoi différé",
                  icon: <Calendar className="w-6 h-6" />,
                  color: "#5B21B6",
                  onClick: () => setAttachPanel("schedule"),
                },
                {
                  key: "verse",
                  label: "Verset",
                  desc: "Partager la Bible",
                  icon: <BookOpen className="w-6 h-6" />,
                  color: "#2A0E3D",
                  onClick: () => {
                    // ⭐ V2.6 — Ouvre la Bible INTÉGRÉE : l'utilisateur
                    // choisit son verset puis clique sur l'icône d'envoi
                    // du verset pour le partager dans la conversation.
                    setAttachOpen(false);
                    setAttachPanel("menu");
                    setShowBible(true);
                  },
                },
              ].map((tile) => (
                <button
                  key={tile.key}
                  onClick={tile.onClick}
                  className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-stone-200 hover:border-[#C9A227]/50 hover:bg-[#C9A227]/5 transition-all cursor-pointer group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ background: `${tile.color}12`, color: tile.color }}
                  >
                    {tile.icon}
                  </div>
                  <span className="text-xs font-bold text-[#1E0F2B]">{tile.label}</span>
                  <span className="text-[10px] text-stone-400">{tile.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Panneau GIF (recherche Giphy intégrée) ───────────────────── */}
          {attachPanel === "gif" && (
            <div className="-mx-6 -mt-2">
              <div className="px-1 pb-2">
                <button
                  onClick={() => setAttachPanel("menu")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#C9A227] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour
                </button>
              </div>
              <GifPicker
                query={gifQuery}
                results={gifResults}
                loading={gifLoading}
                onSearch={searchGifs}
                onSelect={(url, name) => {
                  sendGif(url, name);
                  setAttachOpen(false);
                  setAttachPanel("menu");
                }}
              />
            </div>
          )}

          {/* ── Panneau SONDAGE (comme WhatsApp/Telegram) ─────────────────── */}
          {attachPanel === "poll" && (
            <div className="space-y-3">
              <button
                onClick={() => setAttachPanel("menu")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#C9A227] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour
              </button>
              <div className="px-3 py-2 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/20 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                <p className="text-[11px] text-[#1E0F2B]/70">
                  Le sondage apparaîtra comme un message votable — cliquez une option pour voter.
                </p>
              </div>
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Posez votre question..."
                maxLength={200}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-[10px] font-bold text-stone-500 flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                    placeholder={`Option ${i + 1}`}
                    maxLength={100}
                    className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors flex-shrink-0 cursor-pointer"
                      title="Retirer cette option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="text-xs text-[#C9A227] font-bold hover:underline cursor-pointer"
                >
                  + Ajouter une option
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input type="checkbox" checked={pollMulti} onChange={(e) => setPollMulti(e.target.checked)} className="w-4 h-4 accent-[#C9A227] cursor-pointer" />
                Autoriser plusieurs réponses
              </label>
              <button
                onClick={async () => {
                  if (!activeConvId || !pollQuestion.trim()) return;
                  const validOptions = pollOptions.filter(o => o.trim());
                  if (validOptions.length < 2) { alert("Au moins 2 options requises"); return; }
                  setSubmittingPoll(true);
                  try {
                    const res = await fetch(api.url("/api/yeshua-connect/polls"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ channelId: activeConvId, question: pollQuestion, options: validOptions, isMulti: pollMulti }),
                    });
                    if (res.ok) {
                      setAttachOpen(false);
                      setAttachPanel("menu");
                      setPollQuestion("");
                      setPollOptions(["", ""]);
                      setPollMulti(false);
                      if (activeConvId) loadMessages(activeConvId);
                    } else {
                      const err = await res.json().catch(() => ({}));
                      alert(err.error || "Échec de la création du sondage");
                    }
                  } catch (e) {
                    alert("Erreur réseau");
                  } finally {
                    setSubmittingPoll(false);
                  }
                }}
                disabled={!pollQuestion.trim() || submittingPoll}
                className="w-full py-2.5 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55] disabled:opacity-40 transition-colors cursor-pointer"
              >
                {submittingPoll ? "Création..." : "Créer le sondage"}
              </button>
            </div>
          )}

          {/* ── Panneau PROGRAMMÉ (message différé) ────────────────────── */}
          {attachPanel === "schedule" && (
            <div className="space-y-3">
              <button
                onClick={() => setAttachPanel("menu")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#C9A227] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour
              </button>
              <div className="px-3 py-2 rounded-xl bg-[#5B21B6]/5 border border-[#5B21B6]/20 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5B21B6] flex-shrink-0" />
                <p className="text-[11px] text-[#1E0F2B]/70">
                  Le message sera envoyé automatiquement à la date choisie.
                </p>
              </div>
              <textarea
                value={scheduleContent}
                onChange={(e) => setScheduleContent(e.target.value)}
                placeholder="Votre message..."
                rows={3}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
              />
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
              />
              <button
                onClick={async () => {
                  if (!activeConvId || !scheduleContent.trim() || !scheduleAt) return;
                  setSubmittingSchedule(true);
                  try {
                    const res = await fetch(api.url("/api/yeshua-connect/scheduled-messages"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ channelId: activeConvId, content: scheduleContent, scheduledAt: scheduleAt }),
                    });
                    if (res.ok) {
                      setAttachOpen(false);
                      setAttachPanel("menu");
                      setScheduleContent("");
                      setScheduleAt("");
                    } else {
                      const err = await res.json().catch(() => ({}));
                      alert(err.error || "Échec de la programmation");
                    }
                  } catch (e) {
                    alert("Erreur réseau");
                  } finally {
                    setSubmittingSchedule(false);
                  }
                }}
                disabled={!scheduleContent.trim() || !scheduleAt || submittingSchedule}
                className="w-full py-2.5 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55] disabled:opacity-40 transition-colors cursor-pointer"
              >
                {submittingSchedule ? "Programmation..." : "Programmer l'envoi"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ⭐ V2.3 — Galerie médias du canal */}
      {showGallery && activeConv && (
        <Modal onClose={() => setShowGallery(false)} title={`Galerie · ${activeConv.name}`}>
          {galleryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : galleryMedia.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-8">
              Aucun média dans ce canal pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {galleryMedia.map((m) => {
                // Catégoriser le média
                const isImage = m.type === "IMAGE" || (m.attachmentMime?.startsWith("image/") ?? false);
                const isVideo = m.type === "VIDEO" || (m.attachmentMime?.startsWith("video/") ?? false);
                const isAudio = m.type === "AUDIO" || (m.attachmentMime?.startsWith("audio/") ?? false);
                return (
                  <div
                    key={m.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group bg-stone-50"
                  >
                    {isImage && m.attachmentUrl ? (
                      <button
                        onClick={() => setLightboxUrl(m.attachmentUrl!)}
                        className="block w-full h-full"
                        title={m.attachmentName || "Image"}
                      >
                        <img
                          src={m.attachmentUrl}
                          alt={m.attachmentName || "image"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </button>
                    ) : isVideo && m.attachmentUrl ? (
                      <a
                        href={m.attachmentUrl}
                        download={m.attachmentName}
                        className="flex flex-col items-center justify-center w-full h-full text-stone-500 hover:bg-stone-100"
                        title={`Vidéo: ${m.attachmentName}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-[#1E0F2B] flex items-center justify-center text-white mb-1">
                          <Play className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] truncate px-1 w-full text-center">{m.attachmentName || "Vidéo"}</span>
                      </a>
                    ) : isAudio && m.attachmentUrl ? (
                      <a
                        href={m.attachmentUrl}
                        download={m.attachmentName}
                        className="flex flex-col items-center justify-center w-full h-full text-stone-500 hover:bg-stone-100"
                        title={`Audio: ${m.attachmentName}`}
                      >
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white mb-1", "bg-[#C9A227]")}>
                          <Mic className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] truncate px-1 w-full text-center">{m.attachmentName || "Audio"}</span>
                      </a>
                    ) : (
                      <a
                        href={m.attachmentUrl || "#"}
                        download={m.attachmentName}
                        className="flex flex-col items-center justify-center w-full h-full text-stone-500 hover:bg-stone-100"
                        title={`Fichier: ${m.attachmentName}`}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white mb-1", getFileIcon(m.attachmentName).color)}>
                          {getFileIcon(m.attachmentName).icon}
                        </div>
                        <span className="text-[9px] truncate px-1 w-full text-center">{m.attachmentName || "Fichier"}</span>
                        <Download className="w-3 h-3 text-stone-400 mt-1" />
                      </a>
                    )}
                    {/* Sender info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[8px] text-white truncate font-medium" style={{ color: getRoleColor(m.senderRole) }}>
                        <span className="bg-black/40 rounded px-0.5">{m.senderName}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* ⭐ V2.3 — Lightbox plein écran pour images de la galerie */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setLightboxUrl(null)}
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Aperçu"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxUrl}
            download
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
            Télécharger
          </a>
        </div>
      )}

      {/* ⭐ V2.3 — Audit Log Modal (modération) */}
      {showAuditLog && activeConv && (
        <Modal onClose={() => setShowAuditLog(false)} title={`Audit log · ${activeConv.name}`}>
          {auditLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : auditEntries.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-8">
              Aucune entrée d'audit pour ce canal.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditEntries.map((e: any) => (
                <div key={e.id} className="p-2.5 bg-stone-50 rounded-lg border-l-2 border-[#C9A227]/40">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-bold"
                      style={{ color: getRoleColor(e.user?.role) }}
                    >
                      {e.user?.name || "Utilisateur"}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(e.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#1E0F2B]">
                    {formatAuditAction(e.action)}
                  </p>
                  {e.metadata && (
                    <pre className="text-[10px] text-stone-500 mt-1 whitespace-pre-wrap break-words font-mono bg-white/60 rounded p-1.5 max-h-24 overflow-y-auto">
                      {formatAuditMetadata(e.metadata)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ⭐ V2.3 — APPELS AUDIO/VIDÉO RÉELS VIA LIVEKIT
          Overlay plein écran affiché quand callState !== "idle".
          - Pendant "outgoing" : en attente de l'autre participant.
          - Pendant "active" : participant distant connecté.
          - Vidéo locale (PIP) + vidéo distante (grand écran) si appel vidéo.
          - Boutons : mute micro, toggle caméra (si vidéo), speaker, raccrocher. */}
      {callState !== "idle" && activeConv && (
        <CallOverlay
          callState={callState}
          callType={callType}
          convName={activeConv.name}
          currentUserName={currentUserName}
          remoteParticipants={remoteParticipants}
          localAudioMuted={localAudioMuted}
          localVideoEnabled={localVideoEnabled}
          speakerEnabled={speakerEnabled}
          error={callError}
          room={livekitRoomRef.current}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleSpeaker={() => setSpeakerEnabled((s) => !s)}
          onHangup={endCall}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function ConvSection({ title, icon, convs, activeConvId, onSelect, mutedConversations }: {
  title: string; icon: React.ReactNode; convs: ChatConversation[];
  activeConvId: string | null; onSelect: (id: string) => void; mutedConversations: Set<string>;
}) {
  return (
    <>
      <div className="px-3 py-1.5 bg-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
        {icon} {title}
      </div>
      {convs.map(conv => {
        const isActive = conv.id === activeConvId;
        const isMuted = mutedConversations.has(conv.id);
        return (
          <button key={conv.id} onClick={() => onSelect(conv.id)}
            // ⭐ V2.5 — cursor-pointer : curseur « main » au survol des
            // canaux / groupes (cercles de pasteurs, nouveaux croyants…)
            className={cn("w-full p-3 flex items-start gap-3 hover:bg-stone-50 transition-all text-left border-b border-stone-50 cursor-pointer group", isActive && "bg-[#C9A227]/5")}>
            <div className="relative flex-shrink-0">
              {conv.avatarUrl ? (
                // ⭐ V2.5 — Photo du canal (uploadée depuis le back-office)
                <img src={conv.avatarUrl} alt={conv.name}
                  className="w-10 h-10 rounded-xl object-cover border border-stone-200" />
              ) : (
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", getAvatarColor(conv.name))}>
                  {getInitials(conv.name)}
                </div>
              )}
              {conv.isEncrypted && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#C9A227] rounded-full flex items-center justify-center"><Lock className="w-2 h-2 text-[#1E0F2B]" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1E0F2B] truncate">{conv.name}</p>
                <div className="flex items-center gap-1">
                  {isMuted && <BellOff className="w-3 h-3 text-stone-400" />}
                  {/* ⭐ V2.1 — Badge unread rouge (au lieu de gold) — unreadCount vient
                      de l'API (calculé depuis ChannelMember.lastReadAt) et est
                      incrémenté en temps réel via Socket.io. */}
                  {conv.unreadCount > 0 && (
                    <span className="px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">{conv.lastMessagePreview || conv.description || ""}</p>
              <div className="flex items-center gap-1 mt-1">
                {conv.type === "CHANNEL" && <Hash className="w-3 h-3 text-stone-400" />}
                {conv.type === "GROUP" && <Users className="w-3 h-3 text-stone-400" />}
                {conv.type === "PASTORS" && <Users className="w-3 h-3 text-[#5B21B6]" />}
                {conv.isEncrypted && <span className="text-[10px] text-[#C9A227] font-semibold">E2E</span>}
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#1E0F2B]">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-4 h-4 text-stone-500" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.5 — POLL MESSAGE (rendu votable façon WhatsApp/Telegram)
// ═══════════════════════════════════════════════════════════════════════

function PollMessage({
  poll,
  currentUserId,
  onVoted,
}: {
  poll: ChatPoll;
  currentUserId: string;
  onVoted: (messagePoll: ChatPoll) => void;
}) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const myVotes = new Set(
    poll.options.flatMap((o) => o.votes.filter((v) => v.userId === currentUserId).map(() => o.id))
  );

  const handleVote = async (optionId: string) => {
    if (voting) return;
    setVoting(true);
    setError("");
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/polls/${poll.id}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec du vote");
      }
      const data = await res.json();
      if (data.poll) {
        // Reformater le poll mis à jour au même format que les messages
        onVoted({
          id: data.poll.id,
          question: data.poll.question,
          isMulti: data.poll.isMulti,
          expiresAt: data.poll.expiresAt ?? undefined,
          options: (data.poll.options || [])
            .slice()
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((o: { id: string; label: string; order: number; votes: { userId: string }[] }) => ({
              id: o.id,
              label: o.label,
              order: o.order,
              votes: (o.votes || []).map((v: { userId: string }) => ({ userId: v.userId })),
            })),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="w-full min-w-[240px] max-w-[320px]">
      {/* En-tête du sondage */}
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Sondage {poll.isMulti ? "· choix multiple" : ""}
        </span>
      </div>
      <p className="text-sm font-bold text-[#1E0F2B] mb-3">{poll.question}</p>

      {/* Options avec barres de progression */}
      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const votes = o.votes.length;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const myVote = myVotes.has(o.id);
          return (
            <button
              key={o.id}
              onClick={() => handleVote(o.id)}
              disabled={voting}
              className={cn(
                "relative w-full text-left px-3 py-2 rounded-lg border transition-all overflow-hidden group cursor-pointer disabled:opacity-60",
                myVote
                  ? "border-[#C9A227]/60 bg-[#C9A227]/5"
                  : "border-stone-200 hover:border-[#C9A227]/40 bg-white"
              )}
              title={myVote ? "Votre vote (cliquez pour changer)" : "Voter pour cette option"}
            >
              {/* Barre de fond proportionnelle au résultat */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-500",
                  myVote ? "bg-[#C9A227]/15" : "bg-stone-100"
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#1E0F2B] truncate flex items-center gap-1.5">
                  {myVote && <Check className="w-3 h-3 text-[#C9A227] flex-shrink-0" />}
                  {o.label}
                </span>
                <span className="text-[10px] font-bold text-stone-500 flex-shrink-0">
                  {votes > 0 && `${pct}% · ${votes}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Résultat global */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-stone-400">
          {totalVotes === 0
            ? "Aucun vote — cliquez une option"
            : `${totalVotes} vote${totalVotes > 1 ? "s" : ""}`}
        </span>
        <span className="text-[10px] text-stone-400 italic">
          {poll.isMulti ? "Plusieurs réponses possibles" : "Une seule réponse"}
        </span>
      </div>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function AudioPlayer({ src, duration, attachmentName }: { src: string; duration?: number; attachmentName?: string }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setAudioDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioDuration;
  };

  const formatSec = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 min-w-[220px]">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
      />
      <button onClick={togglePlay} className="p-2 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] flex-shrink-0">
        {playing ? <Pause className="w-4 h-4 text-[#1E0F2B]" /> : <Play className="w-4 h-4 text-[#1E0F2B]" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 bg-[#1E0F2B]/10 rounded-full cursor-pointer" onClick={handleSeek}>
          <div className="h-full bg-[#C9A227] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-stone-500">
          <span>{formatSec(currentTime)}</span>
          <span>{formatSec(audioDuration)}</span>
        </div>
      </div>
      <a href={src} download={attachmentName || "audio.webm"} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400" title="Télécharger">
        <FileText className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function AnnouncementsModal({ onClose }: { onClose: () => void }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(api.url("/api/yeshua-connect/announcements")).then(r => r.json()).then(d => { setAnnouncements(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return (
    <Modal onClose={onClose} title="Annonces officielles">
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> :
       announcements.length === 0 ? <p className="text-center text-sm text-stone-400 py-8">Aucune annonce</p> :
       <div className="space-y-3 max-h-96 overflow-y-auto">
         {announcements.map(a => (
           <div key={a.id} className="p-3 bg-stone-50 rounded-xl border-l-2 border-[#C9A227]">
             <p className="font-bold text-[#1E0F2B] text-sm">{a.title}</p>
             <p className="text-xs text-stone-600 mt-1">{a.body}</p>
             <p className="text-[10px] text-stone-400 mt-1">{a.authorName} · {formatDateSeparator(a.publishedAt)}</p>
           </div>
         ))}
       </div>}
    </Modal>
  );
}

function NewChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || "current";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"CHANNEL" | "GROUP">("GROUP");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [creating, setCreating] = useState(false);

  // ─── Récupère la première communauté disponible pour communityId ────
  // Au lieu d'envoyer "default" (qui crasait le POST côté API), on charge
  // les communautés via /api/communities et on prend la plus ancienne.
  // On conserve un fallback "default" si l'API échoue (dev sans seed).
  const [communityId, setCommunityId] = useState<string>("default");
  const [communityName, setCommunityName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(api.url("/api/communities"), { cache: "no-store" });
        if (!res.ok) return;
        const list: Array<{ id: string; name: string }> = await res.json();
        if (cancelled) return;
        if (list.length > 0) {
          setCommunityId(list[0].id);
          setCommunityName(list[0].name);
        }
      } catch (e) {
        console.warn("[NewChannelModal] /api/communities failed, fallback to 'default'", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(api.url("/api/yeshua-connect/channels"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description,
          type: type === "CHANNEL" ? "ANNOUNCEMENT" : "TEXT",
          communityId, // ← première communauté réelle (plus "default" hardcodé)
          isEncrypted,
          createdBy: currentUserId,
        }),
      });
      if (res.ok) {
        const ch = await res.json();
        onCreated(ch.id);
      }
    } catch (e) { console.error("create:", e); }
    finally { setCreating(false); }
  };
  return (
    <Modal onClose={onClose} title="Nouveau canal / groupe">
      <div className="space-y-3">
        {/* Indicateur de la communauté cible (communityId résolu) */}
        <div className="px-3 py-2 bg-[#C9A227]/5 border border-[#C9A227]/20 rounded-xl flex items-center gap-2">
          <Users2 className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
          <span className="text-xs text-[#1E0F2B]">
            Communauté : <span className="font-semibold">{communityName || communityId === "default" ? (communityName || "Par défaut") : communityId}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setType("GROUP")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold", type === "GROUP" ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-stone-100 text-stone-600")}>Groupe</button>
          <button onClick={() => setType("CHANNEL")} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold", type === "CHANNEL" ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-stone-100 text-stone-600")}>Canal</button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom..." className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" rows={2} />
        <label className="flex items-center gap-2 p-2 bg-stone-50 rounded-xl cursor-pointer">
          <input type="checkbox" checked={isEncrypted} onChange={e => setIsEncrypted(e.target.checked)} className="w-5 h-5" />
          <span className="text-sm">🔒 Chiffré E2E (canal restreint)</span>
        </label>
        <button onClick={handleCreate} disabled={!name.trim() || creating} className="w-full py-2.5 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55] disabled:opacity-30">
          {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Créer"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.1 — Helper components : MentionAutocomplete + MessageContentWithMentions
// ═══════════════════════════════════════════════════════════════════════

interface ChannelMemberLight {
  userId: string;
  name: string;
  role?: string;
  avatarUrl?: string;
}

/** Filtre les membres par query (insensible à la casse, sur le nom). */
function filterMembers(members: ChannelMemberLight[], query: string): ChannelMemberLight[] {
  const q = query.toLowerCase().trim();
  if (!q) return members.slice(0, 8);
  return members
    .filter(m => m.name?.toLowerCase().includes(q))
    .slice(0, 8);
}

/**
 * MentionAutocomplete — dropdown qui apparaît au-dessus du textarea quand
 * l'utilisateur tape "@query". Affiche jusqu'à 8 membres, navigables au
 * clavier (la navigation est gérée par le parent via onKeyDown du textarea).
 */
function MentionAutocomplete({
  query,
  members,
  selectedIndex,
  onSelect,
  onSelectedIndexChange,
}: {
  query: string;
  members: ChannelMemberLight[];
  selectedIndex: number;
  onSelect: (member: ChannelMemberLight) => void;
  onSelectedIndexChange: (idx: number) => void;
}) {
  const filtered = filterMembers(members, query);
  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-xl border border-[#8A8378]/20 overflow-hidden z-50">
      <div className="px-4 py-2 bg-[#FAF6EF] border-b border-[#8A8378]/10 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8A8378] flex items-center gap-1">
          <AtSign className="w-3 h-3" /> Mentions
        </p>
        <p className="text-[10px] text-[#8A8378]/60">↑↓ · Entrée</p>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {filtered.map((m, i) => (
          <button
            key={m.userId}
            onClick={() => onSelect(m)}
            onMouseEnter={() => onSelectedIndexChange(i)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
              i === selectedIndex ? "bg-[#C9A227]/10" : "hover:bg-[#FAF6EF]"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
              getAvatarColor(m.name || "?")
            )}>
              {getInitials(m.name || "?")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E0F2B] truncate">{m.name}</p>
              {m.role && (
                <p className="text-[10px] text-[#8A8378]">{m.role}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * MessageContentWithMentions — rendu du contenu texte d'un message avec
 * les mentions @name surlignées en jaune/or.
 *
 * Gère les noms multi-mots (ex: "@Pasteur Kongo") en scannant le contenu
 * à la recherche d'un "@" suivi d'un nom de membre connu (le plus long
 * match gagne, pour éviter qu'@"Pasteur" masque "@Pasteur Kongo").
 *
 * Préserve les whitespace (y compris les newlines, gérées par whitespace-pre-wrap
 * sur le <p> parent).
 */
function MessageContentWithMentions({
  content,
  memberNames,
  isMine,
}: {
  content: string;
  memberNames: string[];
  isMine: boolean;
}) {
  // Si pas de membres ou pas de "@" dans le contenu, rendu direct
  if (memberNames.length === 0 || !content.includes("@")) {
    return <>{content}</>;
  }

  // Construire la liste triée par longueur décroissante pour matcher le nom
  // le plus long en priorité (ex: "Pasteur Kongo" avant "Pasteur").
  const sortedNames = Array.from(new Set(memberNames.filter(Boolean)))
    .sort((a, b) => b.length - a.length);
  if (sortedNames.length === 0) return <>{content}</>;

  // Construire un regex qui matche @ suivi d'un des noms connus.
  // Les noms sont échappés pour éviter les injections regex.
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alternation = sortedNames.map(escapeRegex).join("|");
  const regex = new RegExp(`@(${alternation})`, "g");

  // Split en segments : texte normal + mentions
  const segments: Array<{ type: "text" | "mention"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.substring(lastIndex, match.index) });
    }
    // Vérifier que le caractère avant le @ est un whitespace ou début de chaîne
    // (sinon c'est une mention "collée" à un mot, pas une vraie mention)
    const before = match.index > 0 ? content[match.index - 1] : "";
    if (before && !/\s/.test(before)) {
      // Pas une vraie mention — on l'ajoute comme texte
      segments.push({ type: "text", value: match[0] });
    } else {
      // Vérifier que le caractère après le nom est un whitespace, fin de chaîne,
      // ou un ponctuation (pour éviter de matcher "Pasteur" dans "PasteurKongo")
      const afterIdx = match.index + match[0].length;
      const after = afterIdx < content.length ? content[afterIdx] : "";
      if (after && !/[\s.,;:!?"'()]/.test(after)) {
        // Pas une vraie fin de mot — texte normal
        segments.push({ type: "text", value: match[0] });
      } else {
        segments.push({ type: "mention", value: match[0] });
      }
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.substring(lastIndex) });
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mention" ? (
          <span
            key={i}
            className={cn(
              "font-semibold rounded px-0.5",
              isMine ? "bg-[#1E0F2B]/20 text-[#1E0F2B]" : "bg-[#C9A227]/25 text-[#8B6914]"
            )}
          >
            {seg.value}
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.2 — RichMessageContent : code blocks + spoilers + mentions
// ═══════════════════════════════════════════════════════════════════════
//
// Pipeline de parsing du contenu d'un message texte :
//   1. Split par blocs de code ```lang\ncode```  → <CodeBlock>
//   2. Pour chaque segment non-code :
//      a. Split par spoilers ||texte||             → <SpoilerText>
//      b. Pour chaque segment normal :
//         - Rendu avec mentions @name surlignées (existant)
//
// Les blocs de code ne sont JAMAIS interprétés (pas de mentions, pas de
// spoilers à l'intérieur) — c'est le comportement attendu.
//
// Les spoilers ne sont parsés que sur les segments hors-code.
// À l'intérieur d'un spoiler, on applique quand-même le rendu des mentions
// (pour que @"Pasteur" reste surligné même dans un spoiler).

/**
 * CodeBlock — bloc de code stylisé (fond sombre #1E0F2B, police monospace,
 * bouton "Copier" qui utilise navigator.clipboard). Le langage (optionnel)
 * est affiché en label en haut à gauche mais aucun syntax highlighting réel
 * n'est fait (conforme au cahier des charges).
 */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("copy code:", e);
    }
  };

  return (
    <div className="my-1.5 rounded-lg overflow-hidden border border-stone-700 bg-[#1E0F2B] text-left">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2A0E3D]/60 border-b border-stone-700">
        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-stone-300 hover:text-white transition-colors font-medium"
          title="Copier le code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> Copié
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copier
            </>
          )}
        </button>
      </div>
      <pre className="px-3 py-2 overflow-x-auto text-xs text-stone-100 font-mono whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * SpoilerText — texte masqué par un overlay noir qui se révèle au clic.
 * Le contenu peut contenir des mentions (rendues via MessageContentWithMentions).
 * Hidden state : bg noir, texte transparent (sélectionnable mais invisible).
 * Revealed state : bg gris clair, texte normal.
 */
function SpoilerText({
  text,
  memberNames,
  isMine,
}: {
  text: string;
  memberNames: string[];
  isMine: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((r) => !r);
      }}
      className={cn(
        "inline rounded px-1 mx-0.5 transition-colors cursor-pointer select-none align-baseline",
        revealed
          ? "bg-stone-300/60 text-inherit"
          : "bg-[#1E0F2B] hover:bg-[#1E0F2B]/80"
      )}
      title={revealed ? "Cliquer pour masquer" : "Cliquer pour révéler le spoiler"}
      aria-pressed={revealed}
    >
      <span className={cn(revealed ? "opacity-100" : "opacity-0")}>
        <MessageContentWithMentions
          content={text}
          memberNames={memberNames}
          isMine={isMine}
        />
      </span>
      {!revealed && <span className="sr-only">(spoiler masqué — cliquer pour révéler)</span>}
    </button>
  );
}

/**
 * TextWithSpoilers — parse un segment hors-code à la recherche de spoilers
 * `||texte||` et rend chaque partie (spoiler / texte normal) en conséquence.
 * Le texte normal passe par MessageContentWithMentions pour le rendu des
 * mentions @name.
 */
function TextWithSpoilers({
  text,
  memberNames,
  isMine,
}: {
  text: string;
  memberNames: string[];
  isMine: boolean;
}) {
  if (!text) return null;

  // Regex non-gourmande : matche `||` ... `||` avec au moins 1 char au milieu.
  // On utilise [\s\S]+? pour supporter les newlines dans le spoiler.
  const spoilerRegex = /\|\|([\s\S]+?)\|\|/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = spoilerRegex.exec(text)) !== null) {
    // Texte normal avant le spoiler
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      parts.push(
        <MessageContentWithMentions
          key={`n-${key++}`}
          content={before}
          memberNames={memberNames}
          isMine={isMine}
        />
      );
    }
    // Le spoiler
    parts.push(
      <SpoilerText
        key={`s-${key++}`}
        text={match[1]}
        memberNames={memberNames}
        isMine={isMine}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  // Texte restant après le dernier spoiler
  if (lastIndex < text.length) {
    parts.push(
      <MessageContentWithMentions
        key={`n-${key++}`}
        content={text.substring(lastIndex)}
        memberNames={memberNames}
        isMine={isMine}
      />
    );
  }

  return <>{parts}</>;
}

/**
 * RichMessageContent — rendu enrichi du contenu texte d'un message :
 *   - Blocs de code ```lang\ncode```  → <CodeBlock>
 *   - Spoilers ||texte||             → <SpoilerText>
 *   - Mentions @name                 → surlignées (via MessageContentWithMentions)
 *
 * Étapes :
 *   1. Split par blocs de code (regex globale sur ```...```)
 *   2. Pour chaque segment non-code → <TextWithSpoilers>
 *   3. Pour chaque bloc de code → <CodeBlock>
 *
 * Note : `whitespace-pre-wrap` est appliqué par le parent <div> dans MessagingView
 * (le wrapper `<div className="text-sm whitespace-pre-wrap break-words">`).
 */
function RichMessageContent({
  content,
  memberNames,
  isMine,
}: {
  content: string;
  memberNames: string[];
  isMine: boolean;
}) {
  if (!content) return null;

  // Si pas de ``` dans le contenu, on court-circuite (parse juste les spoilers)
  if (!content.includes("```")) {
    return <TextWithSpoilers text={content} memberNames={memberNames} isMine={isMine} />;
  }

  // Regex : ```optionnel-lang\n?contenu```
  // - group 1 : langage optionnel (ex: "js", "python", "")
  // - group 2 : contenu du bloc (jusqu'au prochain ```)
  // On utilise [\s\S]*? pour supporter les newlines dans le code.
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Texte avant le bloc de code
    if (match.index > lastIndex) {
      const before = content.substring(lastIndex, match.index);
      parts.push(
        <TextWithSpoilers
          key={`t-${key++}`}
          text={before}
          memberNames={memberNames}
          isMine={isMine}
        />
      );
    }
    // Le bloc de code lui-même
    const lang = match[1] || undefined;
    const code = match[2].replace(/\n$/, ""); // enlever trailing newline
    parts.push(<CodeBlock key={`c-${key++}`} code={code} lang={lang} />);
    lastIndex = match.index + match[0].length;
  }
  // Texte restant après le dernier bloc de code
  if (lastIndex < content.length) {
    parts.push(
      <TextWithSpoilers
        key={`t-${key++}`}
        text={content.substring(lastIndex)}
        memberNames={memberNames}
        isMine={isMine}
      />
    );
  }

  return <>{parts}</>;
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.2 — EmojiPicker : popover avec catégories + grille d'emojis
// ═══════════════════════════════════════════════════════════════════════
//
// 7 catégories : Smileys, Gestes, Cœur, Religion, Nature, Objets, Drapeaux.
// Chaque catégorie a un emoji-icône (cliquable pour switcher de catégorie)
// + une grille scrollable d'emojis natifs Unicode.
// Au clic sur un emoji → onEmojiSelect(emoji) (le parent gère l'insertion
// à la position du curseur dans le textarea).

function EmojiPicker({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const active = EMOJI_CATEGORIES[activeCategory];

  return (
    <div className="flex flex-col">
      {/* Barre de catégories (icônes) */}
      <div className="flex border-b border-stone-200 bg-white">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCategory(i)}
            className={cn(
              "flex-1 py-2 text-lg transition-colors",
              i === activeCategory
                ? "bg-[#C9A227]/10 border-b-2 border-[#C9A227]"
                : "hover:bg-stone-100"
            )}
            title={cat.name}
            aria-label={cat.name}
            aria-pressed={i === activeCategory}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      {/* Nom de la catégorie active */}
      <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          {active.name} · <span className="text-stone-400 font-normal normal-case tracking-normal">{active.emojis.length} emojis</span>
        </p>
      </div>
      {/* Grille d'emojis (scrollable) */}
      <div
        className="grid grid-cols-8 gap-0.5 p-2 max-h-64 overflow-y-auto"
        role="grid"
        aria-label={`Emojis ${active.name}`}
      >
        {active.emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => onEmojiSelect(emoji)}
            className="aspect-square flex items-center justify-center text-xl hover:bg-[#C9A227]/15 hover:scale-110 rounded transition-all"
            title={emoji}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        ))}
      </div>
      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100">
        <p className="text-[10px] text-stone-400 text-center">
          Cliquez sur un emoji pour l'insérer à la position du curseur
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.3 — GIF PICKER (Giphy API publique, grille 3 colonnes)
// ═══════════════════════════════════════════════════════════════════════

function GifPicker({
  query,
  results,
  loading,
  onSearch,
  onSelect,
}: {
  query: string;
  results: Array<{ id: string; url: string; preview: string; width?: number; height?: number }>;
  loading: boolean;
  onSearch: (q: string) => void;
  onSelect: (url: string, name?: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 bg-[#FAF6EF] border-b border-stone-200 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher un GIF..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400 flex-shrink-0" />}
      </div>
      <div className="p-2 max-h-72 overflow-y-auto">
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Film className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs text-stone-500">
              {query ? "Aucun GIF trouvé" : "Tapez une recherche pour afficher des GIFs"}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Propulsé par Giphy</p>
          </div>
        )}
        {results.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g.url, `gif-${g.id}.gif`)}
                className="relative aspect-square rounded-md overflow-hidden bg-stone-100 hover:ring-2 hover:ring-[#C9A227] transition-all"
                title="Envoyer ce GIF"
              >
                <img
                  src={g.preview}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.3 — AUDIT LOG helpers (formatage lisible des actions + metadata)
// ═══════════════════════════════════════════════════════════════════════

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    MESSAGE_DELETE: "🗑️ Message supprimé",
    MESSAGE_EDIT: "✏️ Message édité",
    MESSAGE_PIN: "📌 Message épinglé",
    MESSAGE_UNPIN: "📌 Message désépinglé",
    CHANNEL_CREATE: "➕ Canal créé",
    USER_JOIN: "👋 Utilisateur a rejoint",
    USER_LEAVE: "👋 Utilisateur a quitté",
  };
  return map[action] || action;
}

function formatAuditMetadata(metadata: any): string {
  if (!metadata) return "";
  try {
    const lines: string[] = [];
    if (metadata.oldContentPreview !== undefined) {
      lines.push(`Ancien: ${metadata.oldContentPreview || "(vide)"}`);
    }
    if (metadata.newContentPreview !== undefined) {
      lines.push(`Nouveau: ${metadata.newContentPreview || "(vide)"}`);
    }
    if (metadata.originalContentPreview !== undefined) {
      lines.push(`Contenu original: ${metadata.originalContentPreview || "(vide)"}`);
    }
    if (metadata.moderatorAction) {
      lines.push(`Action modérateur: oui`);
    }
    if (metadata.forEveryone !== undefined) {
      lines.push(`Pour tous: ${metadata.forEveryone ? "oui" : "non"}`);
    }
    if (metadata.name) {
      lines.push(`Nom: ${metadata.name}`);
    }
    if (metadata.type) {
      lines.push(`Type: ${metadata.type}`);
    }
    if (metadata.isPinned !== undefined) {
      lines.push(`Épinglé: ${metadata.isPinned ? "oui" : "non"}`);
    }
    return lines.join("\n") || JSON.stringify(metadata, null, 2);
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.3 — VOICE CHANNEL VIEW (canal vocal persistant)
// ═══════════════════════════════════════════════════════════════════════

function VoiceChannelView({
  conv,
  connected,
  remoteParticipants,
  currentUserName,
  localAudioMuted,
  speakerEnabled,
  error,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleSpeaker,
  channelMembers,
}: {
  conv: ChatConversation;
  connected: boolean;
  remoteParticipants: RemoteParticipant[];
  currentUserName: string;
  localAudioMuted: boolean;
  speakerEnabled: boolean;
  error: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  channelMembers: Array<{ userId: string; name: string; role?: string; avatarUrl?: string }>;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#2A0E3D]/5 to-[#FAF6EF]/30">
      <div className="max-w-md w-full text-center">
        {/* Icône principale */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#2A0E3D] flex items-center justify-center text-white">
          <Volume2 className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-[#1E0F2B] mb-1">{conv.name}</h3>
        <p className="text-xs text-stone-500 mb-6">
          Canal vocal persistant · {conv.participants.length} membres au total
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!connected ? (
          /* État déconnecté : bouton "Rejoindre" */
          <button
            onClick={onJoin}
            className="w-full py-3 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55] flex items-center justify-center gap-2 transition-colors"
          >
            <Volume2 className="w-5 h-5" />
            🔊 Rejoindre le canal vocal
          </button>
        ) : (
          /* État connecté : infos + contrôles */
          <div className="space-y-4">
            {/* Participants connectés */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
                Participants connectés ({remoteParticipants.length + 1})
              </p>
              <div className="space-y-2">
                {/* Moi-même (toujours connecté) */}
                <div className="flex items-center gap-2 p-2 bg-[#C9A227]/5 rounded-lg">
                  <div className="relative">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold", getAvatarColor(currentUserName))}>
                      {getInitials(currentUserName)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#1E0F2B]">
                      {currentUserName} <span className="text-[10px] text-stone-400">(vous)</span>
                    </p>
                    <p className="text-[10px] text-stone-500">
                      {localAudioMuted ? "🔇 Micro coupé" : "🎤 Micro actif"}
                    </p>
                  </div>
                </div>
                {/* Participants distants */}
                {remoteParticipants.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-2">
                    En attente d'autres participants...
                  </p>
                ) : (
                  remoteParticipants.map((p) => (
                    <div key={p.identity} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-[#5B7052]">
                          {getInitials(p.name || p.identity || "?")}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-[#1E0F2B]">{p.name || p.identity}</p>
                        <p className="text-[10px] text-stone-500">
                          {p.isMicrophoneEnabled ? "🎤 Micro actif" : "🔇 Micro coupé"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Contrôles */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onToggleMute}
                className={cn(
                  "p-3 rounded-full transition-colors",
                  localAudioMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
                )}
                title={localAudioMuted ? "Activer le micro" : "Couper le micro"}
              >
                {localAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={onToggleSpeaker}
                className={cn(
                  "p-3 rounded-full transition-colors",
                  speakerEnabled ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]" : "bg-stone-300 text-stone-600 hover:bg-stone-400"
                )}
                title={speakerEnabled ? "Couper le haut-parleur" : "Activer le haut-parleur"}
              >
                {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={onLeave}
                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Quitter le canal vocal"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-stone-400">
              Le canal reste ouvert même si vous le quittez.
            </p>
          </div>
        )}

        {/* Membres du canal (info) */}
        {channelMembers.length > 0 && (
          <div className="mt-6 pt-4 border-t border-stone-200">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
              Membres du canal
            </p>
            <div className="flex flex-wrap gap-1 justify-center">
              {channelMembers.slice(0, 10).map((m) => (
                <span
                  key={m.userId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-[10px] font-medium"
                  style={{ color: getRoleColor(m.role) }}
                >
                  {m.name}
                </span>
              ))}
              {channelMembers.length > 10 && (
                <span className="text-[10px] text-stone-400 self-center">
                  +{channelMembers.length - 10}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V2.3 — CALL OVERLAY (appel audio/vidéo réel via LiveKit)
// ═══════════════════════════════════════════════════════════════════════
//
// Affiché en plein écran (z-60) pendant un appel LiveKit.
// - Vidéo locale en PIP (picture-in-picture) en haut à droite.
// - Vidéo distante en grand écran (si appel vidéo).
// - Si appel audio uniquement : avatar centré + animation pulse.
// - Boutons : mute micro, toggle caméra (si vidéo), speaker, raccrocher.

function CallOverlay({
  callState,
  callType,
  convName,
  currentUserName,
  remoteParticipants,
  localAudioMuted,
  localVideoEnabled,
  speakerEnabled,
  error,
  room,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onHangup,
}: {
  callState: "outgoing" | "incoming" | "active";
  callType: "audio" | "video";
  convName: string;
  currentUserName: string;
  remoteParticipants: RemoteParticipant[];
  localAudioMuted: boolean;
  localVideoEnabled: boolean;
  speakerEnabled: boolean;
  error: string | null;
  room: Room | null;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onHangup: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const [callDuration, setCallDuration] = useState(0);

  // (S5) Sonnerie professionnelle pendant l'appel sortant
  // Joue en boucle tant que callState === "outgoing", s'arrête dès que
  // callState devient "active" (le correspondant a décroché).
  useEffect(() => {
    const el = ringtoneRef.current;
    if (!el) return;
    if (callState === "outgoing") {
      el.loop = true;
      el.volume = 0.5;
      el.play().catch(() => {}); // ignore autoplay-blocked
    } else {
      el.pause();
      el.currentTime = 0;
    }
    return () => { el.pause(); el.currentTime = 0; };
  }, [callState]);

  // ⭐ Compteur de durée d'appel (démarre quand callState === "active")
  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // ⭐ Attacher le track vidéo local au <video> PIP
  useEffect(() => {
    const el = localVideoRef.current;
    if (!room || !el) return;
    const localTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (localTrack?.track) {
      localTrack.track.attach(el);
    }
    return () => {
      if (localTrack?.track) {
        try { localTrack.track.detach(el); } catch {}
      }
    };
  }, [room, localVideoEnabled]);

  // ⭐ Attacher le track vidéo distant au <video> principal
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!room || !el) return;
    const remote = remoteParticipants[0];
    if (!remote) return;
    const videoPub = remote.getTrackPublication(Track.Source.Camera);
    if (videoPub?.track) {
      videoPub.track.attach(el);
    }
    return () => {
      if (videoPub?.track) {
        try { videoPub.track.detach(el); } catch {}
      }
    };
  }, [room, remoteParticipants]);

  // ⭐ Attacher le track audio distant au <audio> (rendu audio)
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!room || !el) return;
    const remote = remoteParticipants[0];
    if (!remote) return;
    const audioPub = remote.getTrackPublication(Track.Source.Microphone);
    if (audioPub?.track) {
      audioPub.track.attach(el);
    }
    return () => {
      if (audioPub?.track) {
        try { audioPub.track.detach(el); } catch {}
      }
    };
  }, [room, remoteParticipants]);

  const formatDuration = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const remoteParticipant = remoteParticipants[0];
  const isVideoCall = callType === "video";

  return (
    <div className="fixed inset-0 bg-[#2A0E3D] z-[60] flex flex-col items-center justify-between p-3 sm:p-6">
      {/* Audio element caché pour le rendu audio distant */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      {/* (S5) Sonnerie professionnelle d'appel sortant */}
      <audio ref={ringtoneRef} src="/sounds/ringback.wav" preload="auto" className="hidden" />

      {/* Erreur éventuelle */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Zone centrale : vidéo distante OU avatar */}
      <div className="flex-1 flex items-center justify-center w-full">
        {isVideoCall && remoteParticipant ? (
          /* Appel vidéo actif : vidéo distante plein écran */
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-2xl object-contain"
          />
        ) : (
          /* Appel audio OU en attente : avatar centré */
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className={cn("w-32 h-32 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-5xl font-bold", getAvatarColor(convName))}
            >
              {getInitials(convName)}
            </motion.div>
            <h2 className="text-2xl font-bold text-[#FAF6EF] mb-2">{convName}</h2>
            <p className="text-[#C9A227] flex items-center justify-center gap-2">
              {callState === "active" ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Appel en cours · {formatDuration(callDuration)}
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Appel en cours...
                </>
              )}
            </p>
            {callState === "outgoing" && (
              <p className="text-xs text-[#FAF6EF]/50 mt-2">
                En attente que l'autre participant rejoigne l'appel...
              </p>
            )}
          </div>
        )}
      </div>

      {/* PIP vidéo locale (si appel vidéo ET caméra activée) */}
      {isVideoCall && localVideoEnabled && (
        <div className="absolute top-4 right-4 w-32 h-24 sm:w-48 sm:h-32 rounded-xl overflow-hidden border-2 border-[#C9A227] bg-black shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white">
            Vous
          </div>
        </div>
      )}

      {/* Boutons de contrôle */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-3.5 sm:p-4 rounded-full transition-colors",
            localAudioMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/10 text-white hover:bg-white/20"
          )}
          title={localAudioMuted ? "Activer le micro" : "Couper le micro"}
        >
          {localAudioMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {isVideoCall && (
          <button
            onClick={onToggleCamera}
            className={cn(
              "p-3.5 sm:p-4 rounded-full transition-colors",
              localVideoEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500 text-white hover:bg-red-600"
            )}
            title={localVideoEnabled ? "Couper la caméra" : "Activer la caméra"}
          >
            <Video className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        <button
          onClick={onToggleSpeaker}
          className={cn(
            "p-3.5 sm:p-4 rounded-full transition-colors",
            speakerEnabled ? "bg-white/10 text-white hover:bg-white/20" : "bg-stone-600 text-white hover:bg-stone-700"
          )}
          title={speakerEnabled ? "Couper le haut-parleur" : "Activer le haut-parleur"}
        >
          {speakerEnabled ? <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        <button
          onClick={onHangup}
          className="p-3.5 sm:p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
          title="Raccrocher"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
}

