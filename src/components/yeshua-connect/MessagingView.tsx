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

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Paperclip, Mic, Lock, Hash, Volume2, Users,
  BookOpen, Reply, Plus, Loader2, MessageSquare, Users2,
  MoreVertical, Bell, BellOff, Megaphone, Pin, Edit2, Trash2,
  Forward, Check, X, ArrowLeft, Globe, Settings, UserPlus,
  Calendar, BarChart3, Phone, Video, Smile, FileText, Image as ImageIcon,
  StopCircle, Play, Pause, Sparkles, AlertCircle,
  MessageCircle, AtSign, ChevronUp, ChevronRight, Copy, UploadCloud,
  PhoneOff, MicOff, VolumeX, Download, Film, VideoOff, EyeOff,
  Radio, Camera, PanelLeftOpen, PanelLeftClose, Shield, Crown, LifeBuoy,
  Ban, MapPin, UserX, UserCheck,
} from "lucide-react";
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, RemoteAudioTrack } from "livekit-client";
import { cn } from "@/lib/utils";
import { BibleWorkspace } from "@/components/bible/BibleWorkspace";
import { CalendarWorkspace } from "./CalendarWorkspace";
import { ShofarNotifier } from "./ShofarNotifier";
import {
  QUICK_REACTIONS,
  type ChatConversation, type ChatMessage, type ChatPoll,
} from "@/lib/yeshua-connect/types";
import { getYeshuaWatermarkStyle } from "./YeshuaWatermark";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { api } from "@/lib/api-client";
import { flagFromCountryCode } from "@/lib/data/flags";
import { COUNTRIES } from "@/lib/data/countries";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useP2PCall } from "@/hooks/use-p2p-call";
import { emitSocket, onSocket, offSocket } from "@/lib/chat/socket-client";
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

/** ⭐ V3.19 — Promise avec délai maximal (Plan C) : une connexion LiveKit
 *  morte ne doit pas suspendre l'appel indéfiniment — au bout de 15 s on
 *  bascule en P2P si c'est un appel DIRECT. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** ⭐ V3.19 — Plan C : room Jitsi DÉTERMINISTE par conversation (repli des
 *  appels de GROUPE et des canaux vocaux quand LiveKit Cloud — Plan A — et
 *  l'auto-hébergé — Plan B — sont tous deux indisponibles). L'UUID de la
 *  conversation rend la room incachable pour qui n'en connaît pas l'ID. */
function jitsiRoomFor(kind: "call" | "voice", conversationId: string): string {
  const clean = conversationId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  return `christlibere-yeshua-${kind}-${clean}`;
}

/** ⭐ V3.19 — URL de réunion Jitsi publique (gratuite — sans compte ni clé
 *  d'API). displayName pré-rempli + pré-join désactivé pour rejoindre en un
 *  clic ; le navigateur demande lui-même micro/caméra à l'iframe. */
function jitsiUrlFor(room: string, displayName?: string): string {
  const hash = displayName
    ? `#config.prejoinConfig.enabled=false&userInfo.displayName=${encodeURIComponent(displayName)}`
    : "#config.prejoinConfig.enabled=false";
  return `https://meet.jit.si/${room}${hash}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V3.1 — COULEURS PROFESSIONNELLES PAR UTILISATEUR (bulles de chat)
// ═══════════════════════════════════════════════════════════════════════
//
// Demande explicite : « Il faut varier les couleurs de façon PROFESSION-
// NELLE en fonction de chaque utilisateur — il faut qu'il y ait des
// variantes de couleurs ENTRE les autres utilisateurs. »
//
//   - MES messages       : violet maison #8C5FA8 ( reconnaissance instantanée )
//   - messages des AUTRES : une couleur STABLE par utilisateur (hash djb2 de
//     son ID) prise dans une palette harmonisée avec la charte (or #C9A227,
//     violet #8C5FA8, encre #2A0E3D) — comme Slack/Discord : on reconnaît
//     qui parle d'un coup d'œil, et la couleur ne change JAMAIS entre les
//     écrans (hash sur l'ID, pas sur le nom ni la position).
//
// `light: true` → texte clair (#FAF6EF) sur bulle foncée → styles internes
// « purple » (citations, réactions…). `light: false` → texte encre → « gold ».
interface BubbleStyle { bg: string; text: string; light: boolean }
const BUBBLE_MINE: BubbleStyle = { bg: "#8C5FA8", text: "#FAF6EF", light: true };
const BUBBLE_PALETTE: BubbleStyle[] = [
  { bg: "#C9A227", text: "#1E0F2B", light: false }, // Or (maison)
  { bg: "#2E6E9E", text: "#FAF6EF", light: true },  // Bleu océan
  { bg: "#0F766E", text: "#FAF6EF", light: true },  // Sarcelle
  { bg: "#B5502F", text: "#FAF6EF", light: true },  // Terracotta
  { bg: "#9C4A74", text: "#FAF6EF", light: true },  // Prune
  { bg: "#5B7052", text: "#FAF6EF", light: true },  // Sauge
  { bg: "#3E5C76", text: "#FAF6EF", light: true },  // Bleu acier
  { bg: "#8C6D1F", text: "#FAF6EF", light: true },  // Bronze
];
/** Hash djb2 — stable et bien réparti même sur des IDs courts. */
function hashUserId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return h;
}
/** Couleur de bulle d'un AUTRE utilisateur (stable pour tous les écrans). */
function senderBubbleStyle(senderId: string): BubbleStyle {
  return BUBBLE_PALETTE[hashUserId(senderId) % BUBBLE_PALETTE.length];
}

// ─── Helper: V3.1 — direct intra-canal (métadonnées room LiveKit) ────
// { videoMode, direct, directBy, directByAvatar, directAt, updatedAt }
function parseRoomMetadataDirect(metadata: string | undefined): { direct: boolean; by?: string; byAvatar?: string } | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (typeof parsed?.direct !== "boolean") return null;
    return {
      direct: parsed.direct,
      by: typeof parsed.directBy === "string" ? parsed.directBy : undefined,
      byAvatar: typeof parsed.directByAvatar === "string" && parsed.directByAvatar ? parsed.directByAvatar : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Helper: V3.1 — durée d'appel lisible (« 3 min 12 s ») ────────────
function formatCallDurationFr(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** ⭐ V3.1 — Infos d'un appel entrant qui sonne (polling /calls/signal). */
interface IncomingCallInfo {
  callId: string;
  conversationId: string;
  convName: string;
  convAvatarUrl?: string;
  convType: string;
  callType: "audio" | "video";
  initiatorId: string;
  initiatorName: string;
  initiatorAvatarUrl?: string;
}

// ─── Helper: V2.7 — métadonnées de room LiveKit ───────────────────────
// Les canaux vocaux embarquent leur mode dans room.metadata (JSON poussé
// par /api/yeshua-connect/conversations/[id]/voice-mode) :
//   { "videoMode": true, "updatedAt": 1754…, "updatedBy": "channel-admin" }
function parseRoomMetadataVideoMode(metadata: string | undefined): boolean | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed?.videoMode === "boolean" ? parsed.videoMode : undefined;
  } catch {
    return undefined;
  }
}

// ─── Helper: V2.7 — photo d'un participant LiveKit ────────────────────
// Priorité : métadonnées du token (JSON { avatarUrl }) → fallback liste des
// membres du canal chargée côté client → undefined (initiales).
function participantAvatarUrl(
  p: RemoteParticipant,
  channelMembers: Array<{ userId: string; avatarUrl?: string }>,
): string | undefined {
  try {
    if (p.metadata) {
      const meta = JSON.parse(p.metadata);
      if (typeof meta?.avatarUrl === "string" && meta.avatarUrl) return meta.avatarUrl;
    }
  } catch { /* metadata non-JSON → fallback */ }
  return channelMembers.find(m => m.userId === p.identity)?.avatarUrl;
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
  // ⭐ V2.7 — Photo de profil de l'utilisateur courant (affichée dans les
  // canaux vocaux / grille vidéo). La session NextAuth ne transporte pas
  // l'avatar → on le charge une fois via /api/user/profile.
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>(undefined);
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
  // ⭐ V2.6.1 — Code HTTP en échec du chargement des conversations
  // (500 = serveur/DB, 401 = session expirée). Permet d'afficher une
  // vraie bannière d'erreur au lieu du mensonge « Aucune conversation ».
  const [convError, setConvError] = useState<number | null>(null);
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
  // ⭐ V3.4 — PANNEAU DES MEMBRES façon Telegram/WhatsApp : depuis l'en-tête
  // du chat (« N membres · N en ligne » cliquable + bouton Users2), chaque
  // membre peut voir QUI est dans le canal/groupe, qui l'administre, qui est
  // en ligne — et ouvrir une conversation PRIVÉE ou appeler un membre.
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  // ⭐ V3.4 — DM en cours de création (boutons du panneau des membres :
  // évite le double-clic qui créerait deux conversations privées).
  const [dmBusy, setDmBusy] = useState(false);
  // ⭐ V3.5 — PROFIL COMPLET d'un membre au clic (façon Telegram) : bio,
  // pays/ville, canaux communs + actions (message privé, appel, blocage).
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  // ⭐ V3.5 — Blocage en cours (POST/DELETE /blocks) : évite le double-clic.
  const [blockBusy, setBlockBusy] = useState(false);
  // ⭐ V3.0 — SIDEBAR MOBILE REPLIABLE (façon Telegram/Discord) :
  // sur mobile (<lg), la barre latérale se replie en RAIL D'ICÔNES
  // (avatars des conversations, 68px) pour laisser toute la place à
  // l'interface de chat. Le bouton « déplier » l'étend en overlay
  // complet (noms + aperçus + recherche) ; sélectionner une conversation
  // la replie automatiquement. Sur desktop (lg+) : sidebar fixe w-80
  // comme avant, le rail est masqué.
  const [mobileSidebarExpanded, setMobileSidebarExpanded] = useState(false);
  // ⭐ V3.0 — Auto-sélection mobile : dès que les conversations arrivent,
  // on ouvre la première pour que le chat soit VISIBLE immédiatement
  // (sinon : écran vide « Sélectionnez une conversation » sous le rail).
  const autoSelectedConvRef = useRef(false);
  // ⭐ V2.6 — Bible intégrée : s'ouvre DANS Yeshua Connect (plein écran),
  // plus aucune redirection vers la page /bible.
  const [showBible, setShowBible] = useState(false);
  // ⭐ V3.6 — Calendrier biblique intégré : s'ouvre DANS Yeshua Connect
  // (plein écran, même pattern que la Bible) — fêtes de l'Éternel,
  // shofar au coucher du soleil, rappels 7 j / 3 j / 24 h.
  const [showCalendar, setShowCalendar] = useState(false);
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

  // ─── ⭐ V2.8 — Suppression / épinglage / pièces jointes / toasts ──────
  // Menu de suppression façon WhatsApp : « Supprimer pour moi » vs
  // « Supprimer pour tous » (popover au clic sur la corbeille).
  const [deleteMenuFor, setDeleteMenuFor] = useState<string | null>(null);
  // ⭐ V2.8 — Menu « ⋮ » par message (Modifier / Épingler / Transférer /
  // Supprimer) + affichage de la barre d'actions au tap (mobile).
  const [showMsgMenu, setShowMsgMenu] = useState<string | null>(null);
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null);
  // Liste déroulante des messages épinglés (bannière du haut).
  const [pinnedListOpen, setPinnedListOpen] = useState(false);
  // Messages masqués « pour moi » (persistés en localStorage, par user).
  const [hiddenForMe, setHiddenForMe] = useState<Set<string>>(new Set());
  const hiddenForMeRef = useRef<Set<string>>(new Set());
  useEffect(() => { hiddenForMeRef.current = hiddenForMe; }, [hiddenForMe]);
  // Pièces jointes EN ATTENTE (aperçu avant envoi, façon WhatsApp) :
  // le collage (Ctrl+V) et la sélection via « Joindre » ne partent PLUS
  // directement — l'utilisateur voit un aperçu + peut annuler / ajouter
  // une légende avant d'envoyer.
  const [pendingFiles, setPendingFiles] = useState<Array<{
    id: string; file: File; previewUrl?: string; kind: "image" | "doc";
  }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  // Toast de retour (partage de verset Bible, erreurs d'envoi…).
  const [toastMsg, setToastMsg] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  /** Affiche un toast temporaire (disparaît après 2,8 s). */
  const showToast = useCallback((text: string, kind: "success" | "error" = "success") => {
    setToastMsg({ text, kind });
    if ((toastTimerRef as any).current) clearTimeout((toastTimerRef as any).current);
    (toastTimerRef as any).current = setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // ─── State: calls (LiveKit + signalisation V3.1) ─────────────────────
  const [callState, setCallState] = useState<"idle" | "outgoing" | "incoming" | "active">("idle");
  // ⭐ V2.3 — Type d'appel (audio vs vidéo) pour l'overlay LiveKit
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  // ⭐ V3.1 — SIGNALISATION DES APPELS (corrige « ça sonne mais l'appel ne
  // vient pas chez les autres ») :
  //   incomingCall      → l'appel qui sonne POUR MOI (polling 3 s) ;
  //   activeCallSignalId→ le signal de l'appel que J'AI lancé ou accepté ;
  //   callEndStatus     → issue distante (declined/missed/ended/cancelled)
  //                       affichée 2 s avant la fermeture de l'overlay.
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [activeCallSignalId, setActiveCallSignalId] = useState<string | null>(null);
  const [callEndStatus, setCallEndStatus] = useState<"declined" | "missed" | "ended" | "cancelled" | null>(null);
  // ⭐ V3.1 — Nom + photo de la conversation appelée (l'overlay affiche la
  // VRAIE photo du canal — avant : toujours des initiales).
  const [callConvInfo, setCallConvInfo] = useState<{ name: string; avatarUrl?: string } | null>(null);
  // ⭐ V3.19 — Plan C : repli JITSI (visio publique gratuite) des appels de
  // GROUPE/canal quand LiveKit est indisponible — room déterministe : chaque
  // participant y arrive via SON propre repli (l'appelant au démarrage,
  // le destinataire au décrochage). Null = pas de repli actif.
  const [callJitsiRoom, setCallJitsiRoom] = useState<string | null>(null);
  // ⭐ V3.19 — Plan C : repli JITSI du canal vocal actif (false = LiveKit).
  const [voiceJitsiActive, setVoiceJitsiActive] = useState(false);
  // Refs miroirs (les callbacks LiveKit/polling lisent les valeurs fraîches
  // sans re-créer les listeners).
  const activeCallSignalIdRef = useRef<string | null>(null);
  useEffect(() => { activeCallSignalIdRef.current = activeCallSignalId; }, [activeCallSignalId]);
  const callStateRef = useRef<"idle" | "outgoing" | "incoming" | "active">("idle");
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  const endedByMeRef = useRef(false);
  const callEndingRef = useRef(false);
  const teardownCallRef = useRef<() => void>(() => {});
  // Appels de groupe refusés par MOI (ne plus me faire sonner).
  const declinedCallIdsRef = useRef<Set<string>>(new Set());

  // ─── State: SlashCommands + Mentions + Threads (V2.1) ─────────────────
  // SlashCommands : ouvert quand l'input commence par "/"
  // (dérivé de inputText, pas besoin de state séparé).
  // Mentions @user : liste des membres du canal actif + query en cours
  const [channelMembers, setChannelMembers] = useState<Array<{
    userId: string;
    name: string;
    role: string;
    /** ⭐ V3.13 — Rôle GLOBAL du compte : l'API members le renvoie déjà,
      * il sert à l'icône distinctive et à la couleur des chips. */
    userRole?: string;
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

  // Paste d'image : remplacé en V2.8 par le composer « pendingFiles » —
  // les images collées passent par un aperçu AVANT envoi (plus d'upload
  // automatique). Voir addPendingFiles / sendPendingFiles.

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
  // ⭐ V3.19 — miroir des participants distants (le sauvetage P2P asymétrique
  // lit la valeur fraîche dans son intervalle sans recréer l'effet à chaque
  // arrivée/départ de participant).
  const remoteParticipantsRef = useRef<RemoteParticipant[]>([]);
  useEffect(() => { remoteParticipantsRef.current = remoteParticipants; }, [remoteParticipants]);
  const [voiceChannelConnected, setVoiceChannelConnected] = useState(false);
  // ⭐ V2.7 — BASCULE AUDIO ↔ VIDÉO DES CANAUX VOCAUX (façon WhatsApp) :
  // mode décidé par l'ADMINISTRATEUR, propagé à TOUS les participants en
  // temps réel via les métadonnées de la room LiveKit (RoomMetadataChanged).
  const [voiceVideoMode, setVoiceVideoMode] = useState(false);
  const [voiceModeSwitching, setVoiceModeSwitching] = useState(false);

  // ⭐ V2.7 — Chargement de la photo de profil de l'utilisateur courant
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    fetch(api.url("/api/user/profile"), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data?.avatarUrl) setCurrentUserAvatar(data.avatarUrl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // ⭐ V3.0 — (a) Photo de profil rafraîchie quand le profil change
  // n'importe où dans l'app (modal Yeshua Connect, page /profil) :
  // la navbar ET la sidebar du chat restent synchronisées.
  useEffect(() => {
    const onProfileUpdated = () => {
      fetch(api.url("/api/user/profile"), { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data?.avatarUrl) setCurrentUserAvatar(data.avatarUrl);
          else if (data && data.avatarUrl === null) setCurrentUserAvatar(undefined);
        })
        .catch(() => {});
    };
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => window.removeEventListener("profile-updated", onProfileUpdated);
  }, []);

  // ⭐ V3.0 — (b) Sélection auto de la 1ère conversation sur mobile si les
  // conversations sont arrivées APRÈS le premier load (rare) — le premier
  // auto-select se fait dans loadConversations (cf. ci-dessus).
  useEffect(() => {
    if (autoSelectedConvRef.current) return;
    if (loadingConvs || conversations.length === 0) return;
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setActiveConvId(prev => prev ?? conversations[0].id);
      autoSelectedConvRef.current = true;
    }
  }, [loadingConvs, conversations]);

  // ⭐ V3.0 — (c) Sélection d'une conversation : sur mobile, on replie
  // l'overlay de la sidebar pour revenir au chat.
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConvId(id);
    setMobileSidebarExpanded(false);
  }, []);

  // ⭐ V2.8 — Messages « supprimés pour moi » : rechargés depuis le
  // localStorage au montage (persistés entre les sessions / rechargements).
  useEffect(() => {
    if (!currentUserId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`yc-hidden-${currentUserId}`);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        if (Array.isArray(ids) && ids.length > 0) {
          const set = new Set(ids);
          setHiddenForMe(set);
          hiddenForMeRef.current = set;
        }
      }
    } catch { /* localStorage corrompu — ignorer */ }
  }, [currentUserId]);

  // ⭐ V2.8 — Quand la fenêtre reprend le focus : rafraîchir la photo de
  // profil courante + les conversations. Corrige « la photo change dans la
  // sidebar mais pas dans Yeshua Connect » après un changement de photo
  // depuis /profil sans recharger la page.
  const loadConversationsRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const onFocus = () => {
      if (!session?.user?.id) return;
      fetch(api.url("/api/user/profile"), { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data?.avatarUrl) setCurrentUserAvatar(data.avatarUrl);
          else if (data && data.avatarUrl === null) setCurrentUserAvatar(undefined);
        })
        .catch(() => {});
      loadConversationsRef.current?.();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session?.user?.id]);

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
      if (!res.ok) {
        // ⭐ V2.6.1 — Mémoriser le code d'erreur pour la bannière sidebar
        setConvError(res.status);
        throw new Error(`HTTP ${res.status}`);
      }
      setConvError(null);
      const data: ChatConversation[] = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        // ⭐ V3.0 — Auto-sélection sur TOUS les écrans (mobile inclus) :
        // sur mobile la sidebar est un rail d'icônes — sans sélection, le
        // chat resterait vide derrière. Avant, le mobile était exclu pour
        // laisser la sidebar plein écran (design V2.9, obsolète).
        setActiveConvId(data[0].id);
      }
    } catch (e) {
      console.error("loadConversations:", e);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeConvId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  // ⭐ V2.8 — Réf « live » vers loadConversations (utilisé par le refresh
  // au focus fenêtre, cf. effet ci-dessus).
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    setHasMoreMessages(true); // reset sur chaque changement de conv
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${convId}/messages?limit=50`), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data: ChatMessage[] = await res.json();
      // ⭐ V2.8 — Hydrater les messages épinglés (persistés en base) : la
      // bannière « épinglé » survit désormais au rechargement de la page.
      setPinnedMessages(new Set(data.filter(m => m.isPinned).map(m => m.id)));
      // ⭐ V2.8 — Filtrer les messages « supprimés pour moi » (localStorage).
      const visible = data.filter(m => !hiddenForMeRef.current.has(m.id));
      setMessages(prev => ({ ...prev, [convId]: visible }));
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

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.9 — TEMPS RÉEL SANS SOCKET.IO : POLLING DE SECOURS
  //  Contexte : le client Socket.io vise le backend Express (Railway) qui
  //  n'est PAS déployé → en production la connexion échoue en boucle
  //  (« Synchro temps réel désactivée ») et SEUL l'expéditeur voyait ses
  //  messages (maj optimiste). Les autres membres ne voyaient RIEN tant
  //  qu'ils ne rechargeaient pas la page.
  //  Solution : quand le socket n'est pas connecté, on interroge le serveur
  //  directement — messages de la conversation active toutes les 3 s,
  //  conversations + présence toutes les 10 s. Dès qu'un backend temps réel
  //  sera déployé (NEXT_PUBLIC_API_URL), le socket reprend la priorité et
  //  le polling s'éteint tout seul.
  // ═════════════════════════════════════════════════════════════════════
  const [pollingHealthy, setPollingHealthy] = useState(true);
  const pollSigRef = useRef<string>("");

  // 1) Messages de la conversation active — fusion intelligente :
  //    upsert par id (réactions/épinglage/éditions rafraîchis), messages
  //    disparus de la fenêtre récente = supprimés → retirés.
  const pollActiveMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${convId}/messages?limit=25`), { cache: "no-store" });
      if (!res.ok) { setPollingHealthy(false); return; }
      const data: ChatMessage[] = await res.json();
      setPollingHealthy(true);
      // Signature courte : si rien n'a changé, on ne déclenche PAS de
      // re-render (le scroll ne saute pas toutes les 3 s).
      const sig = data.map(m => `${m.id}:${m.isPinned ? 1 : 0}:${m.reactions?.length || 0}:${m.editedAt ? 1 : 0}:${m.content?.length || 0}`).join("|");
      if (sig === pollSigRef.current) return;
      pollSigRef.current = sig;

      const visible = data.filter(m => !hiddenForMeRef.current.has(m.id));
      const pinnedIds = new Set(data.filter(m => m.isPinned).map(m => m.id));

      setMessages(prev => {
        const old = prev[convId] || [];
        if (old.length === 0) {
          return { ...prev, [convId]: visible };
        }
        const freshIds = new Set(visible.map(m => m.id));
        const oldestFreshAt = visible.length > 0
          ? new Date(visible[0].createdAt).getTime()
          : Number.POSITIVE_INFINITY;
        // On garde : (a) les anciens messages antérieurs à la fenêtre pollée
        // (chargés via pagination), (b) on remplace/joint les versions
        // fraîches. Un message absent de la fenêtre alors qu'il devrait y
        // être (plus récent que le plus ancien pollé) = supprimé → retiré.
        const kept = old.filter(m => {
          if (freshIds.has(m.id)) return false; // remplacé par la version fraîche
          return new Date(m.createdAt).getTime() < oldestFreshAt;
        });
        const merged = [...kept, ...visible];
        return { ...prev, [convId]: merged };
      });

      // Rafraîchir les épinglés (bannière) sans écraser les épingles locales
      // en cours d'interaction — on fusionne avec l'état existant.
      setPinnedMessages(prev => {
        const next = new Set(prev);
        for (const id of pinnedIds) next.add(id);
        for (const id of Array.from(prev)) {
          const stillThere = data.find(m => m.id === id);
          if (stillThere && !stillThere.isPinned) next.delete(id);
        }
        return next;
      });
    } catch {
      setPollingHealthy(false);
    }
  }, []);

  useEffect(() => {
    pollSigRef.current = ""; // reset par conversation
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId) return;
    if (socketConnected) return; // le socket s'en occupe (backend déployé)
    const interval = setInterval(() => {
      pollActiveMessages(activeConvId);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvId, socketConnected, pollActiveMessages]);

  // 2) Conversations + présence toutes les 10 s : unread, aperçus,
  //    « N en ligne », photos, membres — le GET met aussi à jour
  //    User.lastSeenAt côté serveur (heartbeat de présence).
  useEffect(() => {
    if (socketConnected) return;
    const interval = setInterval(() => {
      loadConversationsRef.current?.();
    }, 10000);
    return () => clearInterval(interval);
  }, [socketConnected]);

  // 3) Membres du canal actif toutes les 12 s (compteur de membres vivant,
  //    photos, rôles — « 3 membres mais 1 seul affiché » réparé).
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => {
      fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/members`), { cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (Array.isArray(data)) setChannelMembers(data); })
        .catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [activeConvId]);

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

  // ⭐ V2.9 — Auto-scroll INTELLIGENT : on ne saute en bas que si
  // l'utilisateur y était déjà (ou au changement de conversation). Avant,
  // chaque mise à jour de state — y compris le polling de secours toutes
  // les 3 s — ramenait de force en bas de la conversation : impossible de
  // lire l'historique pendant que d'autres écrivent.
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    if (activeConvId) isNearBottomRef.current = true; // nouveau canal → coller en bas
  }, [activeConvId]);
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConvId]);
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

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
      // ⭐ V2.8 — Suppression IMMÉDIATE de la liste locale (l'ancien
      // comportement « marquait » le message, ce qui laissait les sondages
      // et les images affichés — seul un rechargement les faisait
      // disparaître). Le message part désormais dès la suppression.
      setMessages(prev => ({
        ...prev,
        [convId]: (prev[convId] || []).filter(m => m.id !== messageId),
      }));
      setPinnedMessages(prev => {
        if (!prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    });

    // ⭐ V2.8 — Épinglage / désépinglage diffusé en temps réel (un autre
    // membre épingle → la bannière s'actualise chez tout le monde).
    const onPinnedHandler = (data: any) => {
      const convId: string | undefined = data?.conversationId;
      const messageId: string | undefined = data?.messageId ?? data?.id;
      if (!convId || !messageId) return;
      const isPinned: boolean = !!data?.isPinned;
      setPinnedMessages(prev => {
        const next = new Set(prev);
        if (isPinned) next.add(messageId); else next.delete(messageId);
        return next;
      });
      setMessages(prev => ({
        ...prev,
        [convId]: (prev[convId] || []).map(m =>
          m.id === messageId ? { ...m, isPinned } : m
        ),
      }));
    };
    onSocket("message:pinned", onPinnedHandler);

    return () => {
      offNew?.();
      offEdited?.();
      offDeleted?.();
      offSocket("message:pinned", onPinnedHandler);
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
  // ⭐ V2.8 — Retour visuel explicite : avant, l'envoi échouait EN SILENCE
  // (aucune conversation active sur mobile) ou passait inaperçu (la Bible
  // couvre tout l'écran). Désormais un toast confirme l'envoi — ou invite
  // à sélectionner une conversation d'abord.
  const handleShareVerse = useCallback(async (verse: { reference: string; text: string }) => {
    if (!verse.reference || !verse.text) return;
    if (!activeConvId) {
      showToast("Ouvrez d'abord une conversation pour partager un verset", "error");
      return;
    }
    try {
      await postMessage({
        content: verse.reference,
        type: "VERSE",
        verseRef: verse.reference,
        verseText: verse.text,
      });
      showToast(`Verset ${verse.reference} partagé dans la conversation`);
    } catch (e) {
      console.error("handleShareVerse:", e);
      showToast("Impossible de partager le verset", "error");
    }
  }, [activeConvId, postMessage, showToast]);

  // ⭐ V2.6 — Fermer la Bible intégrée avec la touche Échap
  useEffect(() => {
    if (!showBible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBible]);

  // ⭐ V3.6 — Fermer le calendrier intégré avec la touche Échap
  useEffect(() => {
    if (!showCalendar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCalendar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCalendar]);

  // ⭐ V3.6 — Partager une annonce du calendrier biblique (Shabbat ou
  // solennité) dans la conversation active : même pattern que le partage
  // de verset depuis la Bible intégrée (toast de confirmation / erreur).
  const handleShareAnnonce = useCallback(async (texte: string) => {
    if (!texte) return;
    if (!activeConvId) {
      showToast("Ouvrez d'abord une conversation pour partager l'annonce", "error");
      return;
    }
    try {
      await postMessage({ content: texte, type: "TEXT" });
      showToast("Annonce partagée dans la conversation");
    } catch (e) {
      console.error("handleShareAnnonce:", e);
      showToast("Impossible de partager l'annonce", "error");
    }
  }, [activeConvId, postMessage, showToast]);

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

    // ⭐ V2.8 — Pièces jointes en attente : le bouton Envoyer envoie les
    // fichiers + le texte du champ comme légende (comportement WhatsApp).
    if (pendingFiles.length > 0 && !editingMsg) {
      if (!activeConvId) return;
      setSending(true);
      try {
        await sendPendingFiles(content);
      } finally {
        setSending(false);
      }
      return;
    }

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
    setShowActionsFor(null);
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

  // ⭐ V2.8 — Suppression façon WhatsApp : deux options dans un popover
  // (au clic sur la corbeille) — « Supprimer pour moi » (masquage local
  // persisté) et « Supprimer pour tous » (soft-delete en base + broadcast
  // temps réel). Dans les deux cas le message disparaît IMMÉDIATEMENT,
  // y compris les sondages et les images (l'ancien code « marquait » le
  // message sans changer le rendu des pièces jointes).
  const handleDelete = async (msgId: string, forEveryone: boolean) => {
    if (!activeConvId) return;
    setDeleteMenuFor(null);
    if (forEveryone) {
      try {
        const res = await fetch(api.url(`/api/yeshua-connect/messages/${msgId}/delete?forEveryone=true`), { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(err?.error || "Impossible de supprimer ce message", "error");
          return;
        }
        setMessages(prev => ({
          ...prev,
          [activeConvId]: (prev[activeConvId] || []).filter(m => m.id !== msgId),
        }));
        setPinnedMessages(prev => {
          if (!prev.has(msgId)) return prev;
          const next = new Set(prev);
          next.delete(msgId);
          return next;
        });
        // Diffuser la suppression aux autres membres de la conversation
        emitSocket("message:deleted", { conversationId: activeConvId, messageId: msgId });
      } catch (e) {
        console.error("delete:", e);
        showToast("Erreur de suppression", "error");
      }
    } else {
      // « Supprimer pour moi » : masquage local uniquement (persisté en
      // localStorage par utilisateur — survit aux rechargements).
      const next = new Set(hiddenForMe);
      next.add(msgId);
      setHiddenForMe(next);
      hiddenForMeRef.current = next;
      try {
        const key = `yc-hidden-${currentUserId}`;
        const existing: string[] = JSON.parse(window.localStorage.getItem(key) || "[]");
        window.localStorage.setItem(key, JSON.stringify(Array.from(new Set([...existing, msgId]))));
      } catch { /* localStorage indisponible — on continue */ }
      setMessages(prev => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] || []).filter(m => m.id !== msgId),
      }));
    }
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

  // ⭐ V2.8 — Épinglage PERSISTÉ : appel de l'API /pin (toggle en base,
  // isPinned + pinnedAt + pinnedBy) + broadcast temps réel aux autres
  // membres. La bannière survit désormais au rechargement de la page.
  const handlePin = async (msgId: string) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/messages/${msgId}/pin`), { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || "Impossible d'épingler ce message", "error");
        return;
      }
      const data = await res.json();
      const isPinned: boolean = !!data.isPinned;
      setPinnedMessages(prev => {
        const next = new Set(prev);
        if (isPinned) next.add(msgId); else next.delete(msgId);
        return next;
      });
      setMessages(prev => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] || []).map(m =>
          m.id === msgId ? { ...m, isPinned } : m
        ),
      }));
      emitSocket("message:pinned", { conversationId: activeConvId, messageId: msgId, isPinned });
    } catch (e) {
      console.error("pin:", e);
      showToast("Erreur d'épinglage", "error");
    }
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
  // ⭐ V2.8 — Désormais appelé UNIQUEMENT au moment où l'utilisateur
  // confirme l'envoi (bouton Envoyer du composer) : plus d'upload
  // automatique au collage / à la sélection — l'utilisateur voit un aperçu
  // et peut annuler avant l'envoi (comportement WhatsApp).
  const uploadSingleFile = useCallback(async (file: File) => {
    if (!activeConvId) return false;
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
      if (res.ok) {
        loadMessages(activeConvId);
        return true;
      }
      const err = await res.json().catch(() => ({}));
      showToast(err?.error || `Échec de l'envoi de ${file.name || "la pièce jointe"}`, "error");
      return false;
    } catch (e) {
      console.error("file upload:", e);
      showToast("Échec de l'envoi de la pièce jointe", "error");
      return false;
    }
  }, [activeConvId, loadMessages, showToast]);

  // ⭐ V2.8 — Ajouter des fichiers à la file d'attente (aperçu avant envoi).
  // Utilisé par : sélection « Joindre » (document/image), drag & drop, et
  // collage d'image (Ctrl+V). Aucun upload ne part d'ici — l'envoi se fait
  // via sendPendingFiles() au clic sur le bouton Envoyer.
  const addPendingFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPendingFiles(prev => [
      ...prev,
      ...files.map(file => {
        const mime = file.type || "";
        const isImage = mime.startsWith("image/");
        return {
          id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind: (isImage ? "image" : "doc") as "image" | "doc",
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
      }),
    ]);
  }, []);

  // ⭐ V2.8 — Retirer un fichier de la file d'attente (bouton × sur l'aperçu).
  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const item = prev.find(p => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  // ⭐ V2.8 — Envoyer les fichiers en attente (upload séquentiel) + une
  // éventuelle légende (le texte du champ de saisie) envoyée AVANT les
  // fichiers, comme la légende d'une image WhatsApp.
  const sendPendingFiles = useCallback(async (caption?: string) => {
    if (!activeConvId || pendingFiles.length === 0) return true;
    setUploadingFiles(true);
    try {
      // 1. Légende (message texte) — envoyée d'abord si non vide
      const trimmedCaption = caption?.trim();
      if (trimmedCaption) {
        try {
          await postMessage({ content: trimmedCaption, type: "TEXT" });
        } catch (e) {
          console.error("caption send:", e);
        }
      }
      // 2. Fichiers, un par un (uploads séquentiels)
      let allOk = true;
      for (const pf of pendingFiles) {
        const ok = await uploadSingleFile(pf.file);
        if (!ok) allOk = false;
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
      if (allOk) {
        setPendingFiles([]);
        if (trimmedCaption) setInputText("");
      }
      return allOk;
    } finally {
      setUploadingFiles(false);
    }
  }, [activeConvId, pendingFiles, postMessage, uploadSingleFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // ⭐ V2.8 — Plus d'envoi immédiat : les fichiers passent par le composer
    // d'aperçu (l'utilisateur ajoute une légende, annule ou envoie).
    addPendingFiles(files);
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    // ⭐ V2.8 — Les fichiers déposés passent par le composer d'aperçu
    // (plus d'upload direct) : l'utilisateur peut annuler ou ajouter une
    // légende avant l'envoi.
    addPendingFiles(Array.from(files));
  }, [addPendingFiles]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.2 — PASTE D'IMAGE DEPUIS LE PRESSE-PAPIERS
  // ═════════════════════════════════════════════════════════════════════

  // ⭐ V2.8 — PASTE : PLUS D'ENVOI AUTOMATIQUE.
  // Avant : coller une image (Ctrl+V) l'uploadait immédiatement dans la
  // conversation — l'utilisateur n'avait aucun contrôle (« ça envoie
  // directement, ça n'attend pas qu'on puisse envoyer »). Désormais :
  //   - collage d'IMAGE → ajout à la file d'attente (aperçu au-dessus du
  //     champ de saisie, avec boutons Envoyer / Annuler / retirer chaque
  //     image) — comportement WhatsApp ;
  //   - collage de TEXTE → comportement par défaut du navigateur (le texte
  //     est inséré dans le champ, l'envoi reste un geste explicite : bouton
  //     Envoyer ou Entrée).
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
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
    addPendingFiles(imageFiles);
  }, [addPendingFiles]);

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

  // ⭐ V2.8 — AUTO-GRANDISSEMENT du champ de saisie : la hauteur suit le
  // contenu (de 1 ligne jusqu'à ~6 lignes / 160 px), puis scroll interne.
  // Corrige « quand le texte devient long, on n'arrive pas à voir tout ce
  // qui a été écrit précédemment ».
  useEffect(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [inputText]);

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

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V2.9 — CANAL VOCAL : SON + PARTICIPANTS + AUTO-REJOIN
  //  Problèmes corrigés :
  //   • « On n'entend pas le son des uns des autres » → AUCUN élément
  //     <audio> n'était attaché aux tracks micro distants (l'appel 1-1
  //     marchait car CallOverlay attache le sien). On crée maintenant un
  //     <audio autoPlay> caché par participant distant + room.startAudio()
  //     (politique autoplay des navigateurs).
  //   • « Le nombre de membres ne se met pas à jour » → objets
  //     RemoteParticipant MUTABLES : sans événement TrackMuted/
  //     ActiveSpeakersChanged, React ne re-rendait jamais → états figés.
  //   • « Un refresh me déconnecte » → persistance du canal rejoint dans
  //     localStorage + AUTO-REJOIN au chargement.
  // ═════════════════════════════════════════════════════════════════════
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());
  const [voiceReconnecting, setVoiceReconnecting] = useState(false);
  // ⭐ V3.1 — DIRECT INTRA-CANAL (remplace l'indicateur « module Live » des
  // canaux vocaux) : « ce direct, c'est un direct AU SEIN DU CANAL et non
  // un direct live dans le module live » — clarification explicite de
  // l'utilisateur. Deux sources de vérité complémentaires :
  //   - voiceDirectInfo : les métadonnées de la room LiveKit (instantané
  //     pour les participants connectés — RoomMetadataChanged) ;
  //   - channelDirects  : polling GET /api/yeshua-connect/direct (10 s —
  //     badges de la sidebar + panneau des NON-connectés).
  const [voiceDirectInfo, setVoiceDirectInfo] = useState<{ active: boolean; by?: string; byAvatar?: string } | null>(null);
  const [channelDirects, setChannelDirects] = useState<Record<string, { by: string; byAvatar?: string }>>({});
  const [directSwitching, setDirectSwitching] = useState(false);
  const voiceChannelConnectedRef = useRef(false);
  useEffect(() => { voiceChannelConnectedRef.current = voiceChannelConnected; }, [voiceChannelConnected]);
  const joinVoiceChannelRef = useRef<(() => Promise<void>) | null>(null);

  /** Crée (ou récupère) l'élément <audio> caché d'un participant distant. */
  const ensureRemoteAudioEl = useCallback((identity: string): HTMLAudioElement | null => {
    if (typeof document === "undefined") return null;
    let el = remoteAudioElsRef.current.get(identity);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      // Safari/iOS exige des attributs pour l'autoplay de médias distants.
      try { el.setAttribute("playsinline", "true"); } catch {}
      const container = remoteAudioContainerRef.current;
      if (!container) return null; // pas encore rendu — réessayé au prochain event
      container.appendChild(el);
      remoteAudioElsRef.current.set(identity, el);
    }
    return el;
  }, []);

  /** Attache le track micro distant à son <audio> (et débloque le son). */
  const attachRemoteAudio = useCallback((identity: string, track: RemoteAudioTrack) => {
    const el = ensureRemoteAudioEl(identity);
    if (!el) return;
    try { track.attach(el); } catch {}
    // Si le navigateur a bloqué l'autoplay → flag UI « Activer le son ».
    if (el.paused) {
      el.play().then(() => setAudioPlaybackBlocked(false)).catch(() => setAudioPlaybackBlocked(true));
    }
  }, [ensureRemoteAudioEl]);

  /** Retire les <audio> d'un participant parti. */
  const removeRemoteAudio = useCallback((identity: string) => {
    const el = remoteAudioElsRef.current.get(identity);
    if (el) {
      try { el.pause(); el.remove(); } catch {}
      remoteAudioElsRef.current.delete(identity);
    }
  }, []);

  /** ⭐ V2.9 — Bouton « Activer le son » (autoplay bloqué) : geste utilisateur. */
  const unlockAudioPlayback = useCallback(async () => {
    const room = livekitRoomRef.current;
    try {
      if (room) await room.startAudio();
      for (const el of remoteAudioElsRef.current.values()) {
        el.muted = speakerEnabled;
        await el.play().catch(() => {});
      }
      setAudioPlaybackBlocked(false);
    } catch {}
  }, [speakerEnabled]);

  /** ⭐ V3.19 — Plan C : appels DIRECT 1-1 en P2P de secours quand LiveKit
   *  (Cloud ou auto-hébergé) est indisponible — signalisation via la table
   *  WebRTCSignal, média direct entre navigateurs. */
  const p2p = useP2PCall();

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
    // ⭐ V2.9 — Retirer TOUS les <audio> distants (sinon le son d'anciens
    // participants continue en fond après la déconnexion !).
    for (const [identity] of Array.from(remoteAudioElsRef.current.entries())) {
      removeRemoteAudio(identity);
    }
    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.disconnect(true);
      } catch {}
      livekitRoomRef.current = null;
    }
    setRemoteParticipants([]);
    setActiveSpeakerIds(new Set());
    setAudioPlaybackBlocked(false);
    setLocalAudioMuted(false);
    setLocalVideoEnabled(false);
    setCallError(null);
  }, [removeRemoteAudio]);

  /** Active/désactive le micro local sur la Room LiveKit active. */
  const toggleMute = useCallback(async () => {
    // ⭐ V3.19 — Mode P2P : couper/rallumer le track audio local directement
    if (p2p.active) {
      const newMuted = !localAudioMuted;
      p2p.setMicEnabled(!newMuted);
      setLocalAudioMuted(newMuted);
      return;
    }
    const room = livekitRoomRef.current;
    if (!room) return;
    try {
      const newMuted = !localAudioMuted;
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setLocalAudioMuted(newMuted);
    } catch (e) {
      console.error("[livekit] toggleMute failed:", e);
    }
  }, [localAudioMuted, p2p.active, p2p.setMicEnabled]);

  /** ⭐ V2.9 — Haut-parleur VRAIMENT fonctionnel : avant, le bouton ne
   *  changeait qu'un booléen décoratif (aucun effet sur le son). On coupe
   *  désormais physiquement les <audio> distants. */
  const toggleSpeaker = useCallback(() => {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    for (const el of remoteAudioElsRef.current.values()) {
      el.muted = !next;
    }
  }, [speakerEnabled]);

  /** Active/désactive la caméra locale (utile en appel vidéo). */
  const toggleCamera = useCallback(async () => {
    // ⭐ V3.19 — Mode P2P : couper/rallumer le track vidéo local directement
    if (p2p.active) {
      const newEnabled = !localVideoEnabled;
      p2p.setCameraEnabled(newEnabled);
      setLocalVideoEnabled(newEnabled);
      return;
    }
    const room = livekitRoomRef.current;
    if (!room) return;
    try {
      const newEnabled = !localVideoEnabled;
      await room.localParticipant.setCameraEnabled(newEnabled);
      setLocalVideoEnabled(newEnabled);
    } catch (e) {
      console.error("[livekit] toggleCamera failed:", e);
    }
  }, [localVideoEnabled, p2p.active, p2p.setCameraEnabled]);

  /**
   * ⭐ V3.1 — Rejoint la room LiveKit d'un appel `yeshua-call-<convId>`.
   * Factored depuis startCall : le MÊME code sert à l'APPELANT (start) et au
   * DESTINATAIRE (accept) — publie micro (toujours) + caméra (si vidéo).
   */
  const joinCallRoom = useCallback(async (conversationId: string, type: "audio" | "video") => {
    const roomName = `yeshua-call-${conversationId}`;
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
      // Déconnexion réseau/serveur → retour à l'état repos SEULEMENT si on
      // n'est pas en train d'afficher une issue (refusé/manqué/terminé).
      if (!callEndingRef.current) {
        setCallState("idle");
        setRemoteParticipants([]);
      }
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
  }, [currentUserName]);

  /**
   * ⭐ V3.1 — Démarre un appel audio ou vidéo.
   * 1. POST /api/yeshua-connect/calls/signal { action: "start" } → crée le
   *    signal « ringing » — c'est CE signal (polling 3 s) qui fait SONNER
   *    l'appel chez TOUS les membres de la conversation (avant : rien ne
   *    prévenait les destinataires, l'appel « ne venait » jamais).
   * 2. Rejoint la room LiveKit + publie micro/caméra.
   * 3. Overlay plein écran « outgoing » avec sonnerie (ringback).
   */
  const startCall = useCallback(async (type: "audio" | "video", targetConversationId?: string, fallbackInfo?: { name: string; avatarUrl?: string }) => {
    // ⭐ V3.4 — `targetConversationId` explicite : permet d'appeler un
    // MEMBRE en direct depuis le panneau des membres (la conversation
    // privée vient d'être créée/sélectionnée — activeConvId n'est pas
    // encore mis à jour dans les closures). Par défaut : conversation
    // active (comportement inchangé).
    const convId = targetConversationId || activeConvId;
    if (!convId) return;
    const conv = conversations.find(c => c.id === convId);
    // ⭐ V3.4 — Pour un appel vers un MEMBRE, l'overlay affiche le nom de
    // l'interlocuteur (fallbackInfo = fiche du membre du panneau, quand
    // la conversation n'est pas encore dans le state `conversations`).
    const interlocutor = conv?.type === "DIRECT"
      ? conv.participants.find(p => p.userId !== currentUserId)
      : undefined;
    setCallType(type);
    setCallError(null);
    setCallEndStatus(null);
    endedByMeRef.current = false;
    callEndingRef.current = false;
    setCallConvInfo({
      name: fallbackInfo?.name || interlocutor?.name || conv?.name || "Conversation",
      avatarUrl: fallbackInfo?.avatarUrl || interlocutor?.avatarUrl || conv?.avatarUrl,
    });
    // (S5) Afficher l'overlay IMMÉDIATEMENT pour feedback instantané
    // avant même que le token LiveKit soit récupéré.
    setCallState("outgoing");
    cleanupLiveKit();
    try {
      const signalRes = await fetch(api.url("/api/yeshua-connect/calls/signal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", conversationId: convId, type }),
      });
      if (!signalRes.ok) {
        const err = await signalRes.json().catch(() => ({}));
        throw new Error(err.error || `Signal d'appel: HTTP ${signalRes.status}`);
      }
      const { callId } = await signalRes.json();
      setActiveCallSignalId(callId ?? null);

      // ⭐ V3.19 — Plan C : LiveKit d'abord (Plan A/B) MAIS borné à 15 s —
      // une connexion morte ne doit pas suspendre l'appel. En échec sur un
      // appel DIRECT 1-1, on bascule en P2P (média direct entre navigateurs,
      // signalisation via /calls/webrtc) : l'overlay reste « outgoing », la
      // sonnerie/journal côté serveur sont inchangés.
      const estDirect = conv?.type === "DIRECT";
      try {
        await withTimeout(
          joinCallRoom(convId, type),
          15000,
          "Connexion multimédia indisponible (15 s)"
        );
      } catch (lkErr) {
        if (estDirect && callId) {
          console.warn("[call] LiveKit indisponible — repli P2P (Plan C) :", lkErr);
          cleanupLiveKit();
          p2p.stop();
          await p2p.startCaller(callId, type);
          setLocalVideoEnabled(type === "video");
          setLocalAudioMuted(false);
        } else if (callId) {
          // ⭐ V3.19 — Plan C : appel de GROUPE/canal → repli JITSI (visio
          // publique gratuite, sans compte ni clé — iframe meet.jit.si) ;
          // les destinataires qui décrochent rejoignent la MÊME room
          // déterministe quand leur LiveKit échoue à son tour.
          console.warn("[call] LiveKit indisponible — repli Jitsi (Plan C) :", lkErr);
          cleanupLiveKit();
          setCallError(null);
          setCallJitsiRoom(jitsiRoomFor("call", convId));
        } else {
          throw lkErr;
        }
      }
      // (S5) callState est déjà "outgoing" depuis le début de startCall
    } catch (e) {
      console.error("[livekit] startCall failed:", e);
      setCallError(e instanceof Error ? e.message : "Échec de l'appel");
      cleanupLiveKit();
      setCallState("idle");
      setActiveCallSignalId(null);
    }
  }, [activeConvId, conversations, cleanupLiveKit, joinCallRoom, currentUserId, p2p.startCaller, p2p.stop]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V3.4 — MESSAGERIE PRIVÉE ENTRE MEMBRES (façon Telegram/WhatsApp)
  // ═════════════════════════════════════════════════════════════════════
  // Depuis le panneau des membres d'un canal/groupe, tout membre peut
  // ouvrir une conversation PRIVÉE avec un autre membre — la communauté
  // grandit : on se découvre dans le canal, on approfondit en privé.
  // Le busy-state évite les double-clics (deux créations de DM).

  /** Ouvre (crée si besoin) la conversation privée avec un membre. */
  const openDirectMessage = useCallback(async (targetUserId: string, targetName?: string): Promise<string | null> => {
    if (targetUserId === currentUserId) return null;
    setDmBusy(true);
    try {
      const res = await fetch(api.url("/api/yeshua-connect/conversations/dm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, originChannelId: activeConvId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Impossible d'ouvrir la conversation privée", "error");
        return null;
      }
      const { conversationId, created } = await res.json();
      // Rafraîchir la liste (le DM apparaît dans la section « Direct »)
      await loadConversationsRef.current?.();
      // Basculer dessus (ferme la sidebar mobile + le panneau des membres)
      setActiveConvId(conversationId);
      setMobileSidebarExpanded(false);
      setShowMembersPanel(false);
      showToast(created ? `Conversation privée ouverte avec ${targetName || "le membre"}` : `Conversation avec ${targetName || "le membre"} ouverte`);
      return conversationId;
    } catch (e) {
      console.error("[dm] openDirectMessage:", e);
      showToast("Impossible d'ouvrir la conversation privée", "error");
      return null;
    } finally {
      setDmBusy(false);
    }
  }, [currentUserId, activeConvId, showToast]);

  /**
   * ⭐ V3.4 — Appelle un MEMBRE en privé (audio ou vidéo) depuis le
   * panneau des membres : ouvre la conversation privée (create-or-get)
   * puis déclenche l'appel SUR CETTE conversation — le destinataire
   * reçoit la sonnerie (polling signal V3.1) et peut décrocher.
   */
  const callMemberDirect = useCallback(async (targetUserId: string, type: "audio" | "video", targetName?: string, targetAvatarUrl?: string) => {
    if (callState !== "idle") {
      showToast("Un appel est déjà en cours", "error");
      return;
    }
    const conversationId = await openDirectMessage(targetUserId, targetName);
    if (!conversationId) return;
    await startCall(type, conversationId, targetName ? { name: targetName, avatarUrl: targetAvatarUrl } : undefined);
  }, [callState, openDirectMessage, startCall, showToast]);

  /**
   * ⭐ V3.5 — Bloque / débloque un membre (sécurité des conversations
   * PRIVÉES). Côté serveur, un blocage empêche les DM et les appels entre
   * les deux membres, dans les DEUX sens — les canaux communs restent
   * ouverts (on bloque la personne, pas la communauté).
   */
  const toggleBlockMember = useCallback(async (targetUserId: string, targetName: string | undefined, block: boolean) => {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      const res = block
        ? await fetch(api.url("/api/yeshua-connect/blocks"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId }),
          })
        : await fetch(api.url(`/api/yeshua-connect/blocks?targetUserId=${encodeURIComponent(targetUserId)}`), {
            method: "DELETE",
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Action impossible", "error");
        return;
      }
      // Rafraîchir les conversations → les drapeaux blockedByMe/hasBlockedMe
      // des participants se mettent à jour dans le panneau des membres.
      await loadConversationsRef.current?.();
      showToast(
        block
          ? `${targetName || "Membre"} bloqué — il ne peut plus vous écrire en privé`
          : `${targetName || "Membre"} débloqué — vous pouvez à nouveau échanger en privé`,
      );
    } catch (e) {
      console.error("[blocks] toggleBlockMember:", e);
      showToast("Action impossible", "error");
    } finally {
      setBlockBusy(false);
    }
  }, [blockBusy, showToast]);

  /** ⭐ V3.1 — Fermeture LOCALE de l'overlay d'appel (sans signal). */
  const teardownCall = useCallback(() => {
    cleanupLiveKit();
    p2p.stop(); // ⭐ V3.19 — Plan C : coupe aussi l'éventuel appel P2P
    setCallJitsiRoom(null); // ⭐ V3.19 — Plan C : referme l'éventuel repli Jitsi
    setCallState("idle");
    setIncomingCall(null);
    setActiveCallSignalId(null);
    setCallEndStatus(null);
    setCallConvInfo(null);
    endedByMeRef.current = false;
    callEndingRef.current = false;
  }, [cleanupLiveKit, p2p.stop]);
  useEffect(() => { teardownCallRef.current = teardownCall; }, [teardownCall]);

  /**
   * ⭐ V3.1 — Raccroche (bouton rouge) : informe le serveur (journal d'appel
   * « terminé/annulé » + durée + propagation à l'autre partie via son
   * polling) PUIS ferme l'overlay.
   */
  const hangupCall = useCallback(() => {
    const id = activeCallSignalIdRef.current;
    if (id && !endedByMeRef.current) {
      endedByMeRef.current = true;
      fetch(api.url("/api/yeshua-connect/calls/signal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", callId: id }),
      }).catch(() => { /* best-effort : le sweep serveur rattrape */ });
    }
    teardownCall();
  }, [teardownCall]);

  /**
   * ⭐ V3.1 — DECROCHE l'appel entrant : POST accept (arrête la sonnerie
   * pour tout le monde, acceptedAt = début de la durée) + rejoint la room
   * LiveKit. La conversation est sélectionnée pour que le journal d'appel
   * (« Appel terminé · X min ») s'affiche sous nos yeux à la fin.
   */
  const acceptIncomingCall = useCallback(async () => {
    const info = incomingCall;
    if (!info) return;
    setIncomingCall(null);
    setCallType(info.callType);
    setCallError(null);
    setCallEndStatus(null);
    endedByMeRef.current = false;
    callEndingRef.current = false;
    setCallConvInfo({ name: info.convName, avatarUrl: info.convAvatarUrl });
    setActiveConvId(info.conversationId);
    setCallState("active"); // durée = depuis le décrochage (acceptedAt)
    cleanupLiveKit();
    p2p.stop(); // ⭐ V3.19 — Plan C : repart d'un état P2P propre au décrochage
    try {
      await fetch(api.url("/api/yeshua-connect/calls/signal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", callId: info.callId }),
      }).catch(() => {});
      setActiveCallSignalId(info.callId);

      // ⭐ V3.19 — Plan C : l'appelant a-t-il DÉJÀ basculé en P2P (son
      // LiveKit a échoué pendant que la sonnerie sonnait chez nous) ? Son
      // offre est alors en base → on décroche DIRECTEMENT en P2P, sans
      // même tenter LiveKit.
      if (await p2p.hasRemoteOffer(info.callId)) {
        const p2pOk = await p2p.acceptCallee(info.callId, info.callType);
        if (p2pOk) {
          setLocalVideoEnabled(info.callType === "video");
          setLocalAudioMuted(false);
          return;
        }
      }

      // Plan A/B : LiveKit, borné à 15 s (une connexion morte ne doit pas
      // suspendre le décrochage non plus).
      await withTimeout(
        joinCallRoom(info.conversationId, info.callType),
        15000,
        "Connexion multimédia indisponible (15 s)"
      );
    } catch (e) {
      console.error("[call] acceptIncomingCall failed:", e);
      // ⭐ V3.19 — Plan C : LiveKit indisponible au décrochage —
      //  · appel DIRECT : on attend l'offre P2P de l'appelant (il a basculé
      //    de son côté au bout de ses 15 s) puis on décroche en P2P ;
      //  · appel de groupe/canal : repli JITSI (room déterministe —
      //    l'appelant dont le LiveKit a échoué y a déjà basculé).
      const conv = conversations.find(c => c.id === info.conversationId);
      // Conversation inconnue du state (rare) → on tente le P2P (cas 1-1).
      const estDirect = conv ? conv.type === "DIRECT" : true;
      if (estDirect && await p2p.waitForRemoteOffer(info.callId, 16000)) {
        const p2pOk = await p2p.acceptCallee(info.callId, info.callType);
        if (p2pOk) {
          setLocalVideoEnabled(info.callType === "video");
          setLocalAudioMuted(false);
          return;
        }
      }
      if (!estDirect) {
        cleanupLiveKit();
        setCallError(null);
        setCallJitsiRoom(jitsiRoomFor("call", info.conversationId));
        return;
      }
      setCallError(e instanceof Error ? e.message : "Impossible de rejoindre l'appel");
      cleanupLiveKit();
      setCallState("idle");
      setActiveCallSignalId(null);
    }
  }, [incomingCall, cleanupLiveKit, joinCallRoom, conversations, p2p.hasRemoteOffer, p2p.acceptCallee, p2p.waitForRemoteOffer]);

  /**
   * ⭐ V3.1 — REFUSE l'appel entrant : en DIRECT, termine l'appel (l'appelant
   * voit « Appel refusé ») ; en canal/groupe, l'appel continue de sonner
   * pour les autres membres (comme WhatsApp) — on l'ignore juste localement.
   */
  const declineIncomingCall = useCallback(() => {
    const info = incomingCall;
    if (!info) return;
    declinedCallIdsRef.current.add(info.callId);
    setIncomingCall(null);
    fetch(api.url("/api/yeshua-connect/calls/signal"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", callId: info.callId }),
    }).catch(() => {});
  }, [incomingCall]);

  // ⭐ V3.1 — POLLING DE STATUT (2 s) : reflète à distance refusé / manqué /
  // terminé pendant un appel (l'autre a raccroché) et fait passer l'overlay
  // « outgoing » → « active » dès que le signal est accepté (même si les
  // tracks LiveKit mettent une seconde à arriver).
  useEffect(() => {
    if (!session?.user?.id || !activeCallSignalId) return;
    if (callState !== "outgoing" && callState !== "active") return;
    const callId = activeCallSignalId;
    const iv = setInterval(async () => {
      if (callEndingRef.current) return;
      try {
        const res = await fetch(api.url(`/api/yeshua-connect/calls/signal?callId=${callId}`), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.status;
        if (status === "accepted" && callStateRef.current === "outgoing") {
          setCallState("active");
          return;
        }
        if (status === "declined" || status === "missed" || status === "cancelled" || status === "ended") {
          callEndingRef.current = true;
          setCallEndStatus(status);
          // Le journal d'appel a déjà été écrit par l'autre partie — on
          // affiche l'issue 2 s puis on ferme l'overlay localement.
          setTimeout(() => { teardownCallRef.current(); }, 2000);
        }
      } catch { /* réseau — nouvelle tentative dans 2 s */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [session?.user?.id, activeCallSignalId, callState]);

  // ⭐ V3.19 — Plan C : SAUVETAGE ASYMÉTRIQUE — si le LiveKit de L'APPELANT
  // est tombé (il a basculé en P2P et posté son offre) mais que NOTRE
  // propre connexion LiveKit a RÉUSSI, on est seul dans une room vide :
  // tant qu'aucun track distant n'arrive et qu'une offre P2P existe, on
  // bascule nous aussi en P2P (contrôle toutes les 5 s, appel DIRECT
  // uniquement — un appel de groupe basculerait en Jitsi).
  useEffect(() => {
    if (!activeCallSignalId) return;
    if (callState !== "active") return;
    if (p2p.active) return;
    if (remoteParticipants.length > 0) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv && conv.type !== "DIRECT") return;
    const callId = activeCallSignalId;
    let annule = false;
    const iv = setInterval(async () => {
      if (annule || p2p.active) return;
      if (remoteParticipantsRef.current.length > 0) return; // l'autre est arrivé sur LiveKit
      try {
        if (await p2p.hasRemoteOffer(callId)) {
          annule = true;
          cleanupLiveKit();
          const ok = await p2p.acceptCallee(callId, callType);
          if (ok) {
            setLocalVideoEnabled(callType === "video");
            setLocalAudioMuted(false);
          }
        }
      } catch { /* réseau — nouvelle tentative au tick suivant */ }
    }, 5000);
    return () => { annule = true; clearInterval(iv); };
  }, [activeCallSignalId, callState, activeConvId, conversations]);

  // ⭐ V3.19 — Plan C : le repli Jitsi du canal vocal est propre à chaque
  // canal — on le referme en changeant de conversation.
  useEffect(() => { setVoiceJitsiActive(false); }, [activeConvId]);
  const startVoiceJitsi = useCallback(() => {
    setVoiceJitsiActive(true);
    setCallError(null);
  }, []);
  const stopVoiceJitsi = useCallback(() => setVoiceJitsiActive(false), []);

  /**
   * ⭐ V2.7 — Applique les métadonnées de room reçues (RoomMetadataChanged) :
   * bascule le mode audio/vidéo du canal vocal POUR TOUT LE MONDE.
   * Quand l'admin active le mode vidéo → chaque participant connecté active
   * sa caméra ; quand il repasse en audio → chaque caméra se coupe.
   * Exactement le comportement WhatsApp demandé : le switch est collectif.
   * ⭐ V3.1 — Les métadonnées portent AUSSI le DIRECT INTRA-CANAL
   * { direct, directBy, directByAvatar } : chaque participant connecté voit
   * instantanément le bandeau vert clignotant (photo du diffuseur) quand
   * l'admin lance « Lancer un direct » DANS le canal (plus aucune
   * redirection vers le module Live).
   */
  const applyVoiceMetadata = useCallback((metadata: string | undefined) => {
    const videoMode = parseRoomMetadataVideoMode(metadata);
    if (videoMode !== undefined) {
      setVoiceVideoMode(videoMode);
      const room = livekitRoomRef.current;
      if (room) {
        (async () => {
          try {
            await room.localParticipant.setCameraEnabled(videoMode);
            setLocalVideoEnabled(videoMode);
          } catch {
            // Caméra indisponible (mode vidéo demandé) → on reste en audio
            if (videoMode) setLocalVideoEnabled(false);
          }
        })();
      }
    }
    // ⭐ V3.1 — Direct intra-canal (temp réel pour les connectés).
    const direct = parseRoomMetadataDirect(metadata);
    if (direct) {
      setVoiceDirectInfo({ active: direct.direct, by: direct.by, byAvatar: direct.byAvatar });
    }
  }, []);

  /**
   * Rejoint un canal vocal persistant (ChannelType.VOICE).
   * - roomName = `yeshua-voice-<conversationId>` (persistante : reste active
   *   côté serveur même si plus aucun participant).
   * - ⭐ V2.7 : le mode du canal (audio OU vidéo, décidé par l'admin) est
   *   servi par /api/livekit/token (`videoMode` lu en base) puis suivi en
   *   temps réel via RoomMetadataChanged — si l'admin bascule pendant qu'on
   *   est connecté, notre caméra s'active/se coupe automatiquement.
   * - voiceChannelConnected = true → l'UI affiche les participants connectés
   *   (avec leurs PHOTOS) + la grille vidéo en mode vidéo + bouton « Quitter ».
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
          avatarUrl: currentUserAvatar,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || `Token LiveKit: HTTP ${tokenRes.status}`);
      }
      const { token, url, videoMode: initialVideoMode } = await tokenRes.json();

      const room = new Room({ adaptiveStream: true, dynacast: true });
      livekitRoomRef.current = room;

      // ─── ⭐ V2.9 — SON : attachement des tracks micro distants ───────
      // La cause racine du « on ne s'entend pas » : aucun <audio> n'était
      // jamais attaché. On attache sur TrackSubscribed (audio) + on re-scanne
      // les publications déjà présentes (participants connectés AVANT nous).
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && track instanceof RemoteAudioTrack) {
          attachRemoteAudio(participant.identity, track);
        }
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) removeRemoteAudio(participant.identity);
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeRemoteAudio(participant.identity);
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      // ─── ⭐ V2.9 — Événements d'ÉTAT : les objets RemoteParticipant sont
      // mutables → sans ces événements, « Micro coupé », photos et compteurs
      // restaient FIGÉS (React ne re-rendait jamais). Chaque event déclenche
      // un setRemoteParticipants avec un NOUVEAU tableau → re-render avec
      // les valeurs fraîches (p.isMicrophoneEnabled etc.).
      room.on(RoomEvent.TrackMuted, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.TrackUnmuted, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakerIds(new Set(speakers.map((s) => s.identity)));
      });
      room.on(RoomEvent.Reconnecting, () => setVoiceReconnecting(true));
      room.on(RoomEvent.Reconnected, () => {
        setVoiceReconnecting(false);
        // Re-scanne les publications (les tracks peuvent avoir été re-créées).
        for (const p of room.remoteParticipants.values()) {
          const pub = p.getTrackPublication(Track.Source.Microphone);
          if (pub?.track instanceof RemoteAudioTrack && pub.isSubscribed) {
            attachRemoteAudio(p.identity, pub.track);
          }
        }
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });
      room.on(RoomEvent.Disconnected, () => {
        // Déconnexion réseau / serveur → l'UI repasse en mode « Rejoindre »
        // (l'utilisateur reste sur le canal, il peut re-cliquer).
        setRemoteParticipants([]);
        setVoiceChannelConnected(false);
        // ⭐ V3.1 — le direct intra-canal survit à notre déconnexion (room
        // persistante) : on ne réinitialise PAS voiceDirectInfo ici, le
        // polling /direct (10 s) garde le bandeau à jour.
      });
      // Autoplay bloqué par le navigateur → bouton « Activer le son ».
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioPlaybackBlocked(!room.canPlaybackAudio);
      });
      // ⭐ V2.7 — L'admin a basculé le mode du canal : TOUT LE MONDE voit le
      // changement instantanément (métadonnées room poussées par le serveur).
      room.on(RoomEvent.RoomMetadataChanged, (metadata) => {
        applyVoiceMetadata(metadata);
      });

      await room.connect(url, token);

      // ⭐ V2.9 — Débloque la lecture audio distante (politique autoplay) :
      // sans startAudio(), Chrome/Safari peuvent refuser de jouer les <audio>.
      try {
        await room.startAudio();
        setAudioPlaybackBlocked(!room.canPlaybackAudio);
      } catch { /* Safari ancien — le bouton « Activer le son » prend le relais */ }

      await room.localParticipant.setMicrophoneEnabled(true);

      // ⭐ V2.9 — Participants DÉJÀ connectés avant nous : leurs tracks
      // existent déjà (aucun TrackSubscribed ne sera émis pour eux).
      for (const p of room.remoteParticipants.values()) {
        const pub = p.getTrackPublication(Track.Source.Microphone);
        if (pub?.track instanceof RemoteAudioTrack && pub.isSubscribed) {
          attachRemoteAudio(p.identity, pub.track);
        }
      }

      // ⭐ V2.7 — Mode initial : la caméra ne s'allume QUE si l'admin a activé
      // le mode vidéo pour ce canal (mode WhatsApp). En mode audio : audio seul.
      const effectiveVideoMode =
        initialVideoMode === true || parseRoomMetadataVideoMode(room.metadata) || false;
      setVoiceVideoMode(effectiveVideoMode);
      if (effectiveVideoMode) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          setLocalVideoEnabled(true);
        } catch {
          // Pas de caméra disponible → on reste en audio (le micro marche)
          setLocalVideoEnabled(false);
        }
      } else {
        await room.localParticipant.setCameraEnabled(false);
        setLocalVideoEnabled(false);
      }

      setLocalAudioMuted(false);
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      setVoiceChannelConnected(true);
      setVoiceReconnecting(false);
      // ⭐ V3.1 — DIRECT INTRA-CANAL : lit l'état initial depuis les
      // métadonnées de la room (un direct peut être lancé AVANT notre join).
      const initialDirect = parseRoomMetadataDirect(room.metadata);
      setVoiceDirectInfo(initialDirect ? { active: initialDirect.direct, by: initialDirect.by, byAvatar: initialDirect.byAvatar } : null);
      // ⭐ V2.9 — AUTO-REJOIN : mémorise le canal rejoint → un refresh de la
      // page relance la connexion automatiquement (l'utilisateur ne « quitte »
      // le direct QUE s'il clique « Quitter » — like Telegram/WhatsApp).
      if (currentUserId) {
        try { localStorage.setItem(`yc-voice-${currentUserId}`, activeConvId); } catch {}
      }
    } catch (e) {
      console.error("[livekit] joinVoiceChannel failed:", e);
      setCallError(e instanceof Error ? e.message : "Échec de la connexion au canal vocal");
      cleanupLiveKit();
      setVoiceChannelConnected(false);
      // Auto-rejoin raté (token/micro refusé) → ne pas retenter en boucle.
      if (currentUserId) {
        try { localStorage.removeItem(`yc-voice-${currentUserId}`); } catch {}
      }
    }
  }, [activeConvId, cleanupLiveKit, currentUserName, currentUserAvatar, applyVoiceMetadata, attachRemoteAudio, removeRemoteAudio, currentUserId]);

  /**
   * ⭐ V2.7 — Bascule le mode du canal vocal (RÉSERVÉ AUX ADMINISTRATEURS).
   * POST /voice-mode → persiste Channel.videoMode + pousse les métadonnées
   * de la room LiveKit → tous les participants connectés reçoivent
   * RoomMetadataChanged et basculent en même temps (caméras incluses).
   */
  const switchVoiceMode = useCallback(async (mode: "audio" | "video") => {
    if (!activeConvId || voiceModeSwitching) return;
    setVoiceModeSwitching(true);
    setCallError(null);
    try {
      const res = await fetch(
        api.url(`/api/yeshua-connect/conversations/${activeConvId}/voice-mode`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Bascule impossible (HTTP ${res.status})`);
      }
      // Retour immédiat (feedback admin) — la propagation temps réel vers
      // notre propre room passe aussi par RoomMetadataChanged ; si le push
      // LiveKit a échoué (livekitPushed: false), on applique localement.
      if (!data.livekitPushed) {
        setVoiceVideoMode(data.videoMode === true);
        const room = livekitRoomRef.current;
        if (room) {
          try {
            await room.localParticipant.setCameraEnabled(data.videoMode === true);
            setLocalVideoEnabled(data.videoMode === true);
          } catch { /* pas de caméra → audio */ }
        }
      }
    } catch (e) {
      console.error("[voice-mode] switch failed:", e);
      setCallError(e instanceof Error ? e.message : "Échec de la bascule de mode");
    } finally {
      setVoiceModeSwitching(false);
    }
  }, [activeConvId, voiceModeSwitching]);

  // ═════════════════════════════════════════════════════════════════════
  //  ⭐ V3.1 — DIRECT INTRA-CANAL (admin) : « Lancer un direct » depuis le
  //  canal vocal lance une diffusion DANS le canal (métadonnées de la room
  //  LiveKit) — PLUS AUCUNE redirection vers /admin/lives (module Live).
  //  - start : bandeau vert clignotant + photo du diffuseur pour tous les
  //    connectés (RoomMetadataChanged), badge DIRECT sidebar (polling),
  //    puis on REJOINT automatiquement le canal pour diffuser.
  //  - stop  : la diffusion s'arrête pour tout le monde (restent connectés).
  // ═════════════════════════════════════════════════════════════════════
  const startChannelDirect = useCallback(async () => {
    if (!activeConvId || directSwitching) return;
    setDirectSwitching(true);
    setCallError(null);
    try {
      const res = await fetch(api.url("/api/yeshua-connect/direct"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, action: "start" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Feedback immédiat (le RoomMetadataChanged officialise ensuite).
      setVoiceDirectInfo({ active: true, by: currentUserName, byAvatar: currentUserAvatar });
      setChannelDirects(prev => ({ ...prev, [activeConvId]: { by: currentUserName, byAvatar: currentUserAvatar } }));
      showToast("Direct lancé dans le canal — vous diffusez", "success");
      // On n'était pas connecté ? On rejoint le canal pour diffuser.
      if (!voiceChannelConnectedRef.current && joinVoiceChannelRef.current) {
        await joinVoiceChannelRef.current();
      }
    } catch (e) {
      console.error("[direct] start failed:", e);
      setCallError(e instanceof Error ? e.message : "Impossible de lancer le direct");
      showToast("Impossible de lancer le direct", "error");
    } finally {
      setDirectSwitching(false);
    }
  }, [activeConvId, directSwitching, currentUserName, currentUserAvatar]);

  const stopChannelDirect = useCallback(async () => {
    if (!activeConvId || directSwitching) return;
    setDirectSwitching(true);
    try {
      const res = await fetch(api.url("/api/yeshua-connect/direct"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, action: "stop" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setVoiceDirectInfo(null);
      setChannelDirects(prev => {
        const next = { ...prev };
        delete next[activeConvId];
        return next;
      });
      showToast("Direct arrêté", "success");
    } catch (e) {
      console.error("[direct] stop failed:", e);
      showToast("Impossible d'arrêter le direct", "error");
    } finally {
      setDirectSwitching(false);
    }
  }, [activeConvId, directSwitching]);

  /** Quitte le canal vocal (disconnect — le canal reste persistant côté serveur). */
  const leaveVoiceChannel = useCallback(() => {
    // ⭐ V2.9 — Quitter EXPLICITEMENT (bouton « Quitter ») efface l'auto-rejoin :
    // un refresh ne relancera PAS la connexion — comportement Telegram/WhatsApp.
    if (currentUserId) {
      try { localStorage.removeItem(`yc-voice-${currentUserId}`); } catch {}
    }
    cleanupLiveKit();
    setVoiceChannelConnected(false);
    // ⭐ V2.7 — Réinitialisation du mode local (rechargé au prochain join)
    setVoiceVideoMode(false);
    // ⭐ V3.1 — l'état local du direct est relâché (le polling /direct
    // rafraîchit le bandeau si le direct continue sans nous).
    setVoiceDirectInfo(null);
  }, [cleanupLiveKit, currentUserId]);

  // ⭐ V2.9 — AUTO-REJOIN après un refresh : si l'utilisateur était dans le
  // canal vocal (localStorage) et qu'il n'a PAS cliqué « Quitter », on
  // reconnecte automatiquement dès que la conversation est chargée.
  // (L'EFFET lui-même est placé après la déclaration d'activeConv, cf. plus bas.)
  const voiceRejoinTriedRef = useRef(false);
  useEffect(() => { joinVoiceChannelRef.current = joinVoiceChannel; }, [joinVoiceChannel]);

  // ⭐ V3.1 — DIRECTS INTRA-CANAL EN COURS : polling GET /api/yeshua-connect/
  // direct (10 s) → { channelId → { by, byAvatar } }. Alimente :
  //   - la pastille DIRECT verte de la sidebar (ligne du canal vocal) ;
  //   - le bandeau « Rejoindre le direct » du panneau pour les NON-connectés.
  // Les participants CONNECTÉS, eux, reçoivent le changement INSTANTANÉMENT
  // via RoomMetadataChanged (voiceDirectInfo) — cf. applyVoiceMetadata.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch(api.url("/api/yeshua-connect/direct"), { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (cancelled || !data?.directs) return;
          const map: Record<string, { by: string; byAvatar?: string }> = {};
          for (const d of data.directs as Array<{ channelId: string; by: string; byAvatar?: string }>) {
            map[d.channelId] = { by: d.by, byAvatar: d.byAvatar };
          }
          setChannelDirects(map);
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ⭐ V3.1 — APPELS ENTRANTS : polling 3 s (le temps réel sans Socket.io
  // repose déjà sur du polling — V2.9). Corrige « ça sonne chez l'appelant
  // mais l'appel ne vient PAS au niveau de l'utilisateur, ni PC ni mobile ».
  // On ne sonne que si l'on est LIBRE (pas d'appel en cours de mon côté).
  useEffect(() => {
    if (!session?.user?.id) return;
    if (callState !== "idle" || incomingCall) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(api.url("/api/yeshua-connect/calls/signal?incoming=1"), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: IncomingCallInfo[] = Array.isArray(data?.incoming) ? data.incoming : [];
        const first = list.find(c => !declinedCallIdsRef.current.has(c.callId));
        if (first) {
          setIncomingCall(first);
          // Notification navigateur si la page est en arrière-plan
          // (téléphone dans la poche : l'appel « vient » quand même).
          try {
            if (typeof document !== "undefined" && document.hidden &&
                typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`${first.initiatorName} vous appelle`, {
                body: `${first.callType === "video" ? "Appel vidéo" : "Appel audio"} · ${first.convName}`,
                tag: `yc-call-${first.callId}`,
              });
            }
          } catch { /* notification best-effort */ }
        }
      } catch { /* réseau — prochaine tentative dans 3 s */ }
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session?.user?.id, callState, incomingCall]);

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
  //  ⭐ V3.2 — AUDIT LOG : interface RETIRÉE de Yeshua Connect (demande
  //  explicite). Le journal reste enregistré côté serveur via l'API
  //  /api/yeshua-connect/audit-log (disponible pour le back-office).
  // ═════════════════════════════════════════════════════════════════════


  // ═════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════

  const activeConv = conversations.find(c => c.id === activeConvId);

  // ⭐ V2.9 — AUTO-REJOIN (effet placé ICI car il dépend d'activeConv) :
  // localStorage yc-voice-<userId> mémorise le canal rejoint ; un refresh de
  // page reconnexionne automatiquement — on ne « quitte » le direct qu'en
  // cliquant « Quitter » (comportement Telegram/WhatsApp demandé).
  useEffect(() => {
    if (voiceRejoinTriedRef.current || voiceChannelConnected) return;
    if (!currentUserId || !activeConvId) return;
    if (activeConv?.type !== "VOICE") return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(`yc-voice-${currentUserId}`); } catch {}
    if (!stored || stored !== activeConvId) return;
    voiceRejoinTriedRef.current = true; // une seule tentative par chargement
    joinVoiceChannelRef.current?.();
  }, [currentUserId, activeConvId, activeConv?.type, voiceChannelConnected]);

  // ⭐ V2.9 — Convergence du mode audio/vidéo par POLLING (10 s) : si le push
  // LiveKit (RoomMetadataChanged) a échoué côté serveur, les clients
  // connectés convergent quand même vers Channel.videoMode en base.
  // Corrige « lorsqu'on veut switcher vers audio, ça ne marche pas ».
  useEffect(() => {
    if (!activeConvId || activeConv?.type !== "VOICE" || !voiceChannelConnected) return;
    const interval = setInterval(() => {
      fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/voice-mode`), { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data && typeof data.videoMode === "boolean") {
            applyVoiceMetadata(JSON.stringify({ videoMode: data.videoMode }));
          }
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [activeConvId, activeConv?.type, voiceChannelConnected, applyVoiceMetadata]);

  // ⭐ V2.7 — Mode du canal vocal (audio/vidéo, décidé par l'admin) : chargé
  // dès la SÉLECTION du canal pour afficher l'icône/le libellé du mode et
  // l'état du bandeau. (Placé APRÈS la déclaration d'activeConv — dépendance
  // de l'effet.)
  useEffect(() => {
    if (!activeConvId || activeConv?.type !== "VOICE" || voiceChannelConnected) return;
    let cancelled = false;
    fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/voice-mode`), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.videoMode === "boolean") {
          setVoiceVideoMode(data.videoMode);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeConvId, activeConv?.type, voiceChannelConnected]);
  const activeMessages = activeConvId ? (messages[activeConvId] || []) : [];
  const filteredConversations = convSearchQuery
    ? conversations.filter(c => {
        const q = convSearchQuery.toLowerCase();
        // ⭐ V3.4 — Pour les conversations PRIVÉES, on cherche aussi le
        // nom de MON interlocuteur (le nom stocké est celui du créateur).
        const interlocutor = c.type === "DIRECT"
          ? c.participants.find(p => p.userId !== currentUserId)
          : undefined;
        return (
          c.name.toLowerCase().includes(q) ||
          (interlocutor?.name || "").toLowerCase().includes(q)
        );
      })
    : conversations;

  // ⭐ V2.8 — Avatar + nom affichés dans le HEADER du chat (façon WhatsApp) :
  //   - conversation DIRECT  → photo + prénom de l'INTERLOCUTEUR (et plus
  //     des initiales figées) → un changement de photo de profil se voit
  //     immédiatement dans le header ;
  //   - canal / groupe       → photo du canal (avatarUrl) si elle existe,
  //     sinon initiales.
  const headerInterlocutor = activeConv?.type === "DIRECT"
    ? activeConv.participants.find(p => p.userId !== currentUserId) ?? activeConv.participants[0]
    : undefined;
  const headerAvatarUrl = headerInterlocutor?.avatarUrl || (activeConv && activeConv.type !== "DIRECT" ? activeConv.avatarUrl : undefined);
  const headerDisplayName = headerInterlocutor?.name || activeConv?.name;

  // ⭐ V2.8 — Messages épinglés de la conversation active (objets complets,
  // pour l'aperçu dans la bannière). Triés : le plus récemment épinglé en
  // premier (pinnedAt desc).
  const pinnedPreviewMessages = useMemo(
    () => activeMessages
      .filter(m => pinnedMessages.has(m.id) || m.isPinned)
      .sort((a, b) => (b.pinnedAt || b.createdAt).localeCompare(a.pinnedAt || a.createdAt)),
    [activeMessages, pinnedMessages],
  );

  // ⭐ V2.8 — Est-ce que le rôle courant permet de supprimer n'importe quel
  // message (modération) ? Sinon, uniquement les messages de l'auteur.
  const canDeleteAny = AUDIT_PRIVILEGED_ROLES.has(currentUserRole || "");

  // ⭐ V2.8 — Résumé lisible d'un message (pour l'aperçu des épinglés) :
  // texte, verset, son, image, sondage…
  const summarizeMessage = (m: ChatMessage): string => {
    if (m.type === "VERSE" && m.verseRef) return `${m.verseRef} — ${(m.verseText || "").substring(0, 90)}`;
    if (m.type === "POLL" && m.poll) return `📊 ${m.poll.question}`;
    if (m.type === "IMAGE") return "📷 Photo";
    if (m.type === "VIDEO") return "🎬 Vidéo";
    if (m.type === "AUDIO") return "🎤 Message vocal";
    if (m.type === "FILE") return `📎 ${m.attachmentName || "Fichier"}`;
    return (m.content || "").substring(0, 90);
  };

  // Group conversations by type
  const channelConvs = filteredConversations.filter(c => c.type === "CHANNEL");
  const groupConvs = filteredConversations.filter(c => c.type === "GROUP" || c.type === "PASTORS");
  const directConvs = filteredConversations.filter(c => c.type === "DIRECT");
  // ⭐ V2.3 — Canaux vocaux persistants (ChannelType.VOICE mappé vers "VOICE")
  const voiceConvs = filteredConversations.filter(c => c.type === "VOICE");

  // ⭐ V3.1 — Badge « section Canaux vocaux » : direct INTRA-CANAL en cours
  // (n'importe quel canal vocal). Remplace l'ancien badge du module Live.
  const voiceLiveBadge = (() => {
    const entry = Object.entries(channelDirects).find(([channelId]) => voiceConvs.some(v => v.id === channelId));
    if (!entry) return null;
    return { title: `Direct en cours · ${entry[1].by}`, portraitUrl: entry[1].byAvatar ?? null };
  })();

  // ⭐ V3.1 — Direct intra-canal ACTIF pour la conversation vocale ouverte :
  // priorité aux métadonnées de room (instantané, participants connectés),
  // repli sur le polling /direct (10 s).
  const activeChannelDirect = (() => {
    if (voiceDirectInfo?.active) {
      return { by: voiceDirectInfo.by || "Membre", byAvatar: voiceDirectInfo.byAvatar, isMe: voiceDirectInfo.by === currentUserName };
    }
    const polled = activeConv?.type === "VOICE" ? channelDirects[activeConv.id] : undefined;
    if (polled) return { by: polled.by, byAvatar: polled.byAvatar, isMe: polled.by === currentUserName };
    return null;
  })();


  return (
    // ⭐ V2.9 — HAUTEUR MOBILE RÉPARÉE : la layout du site réserve 4rem (64px,
    // mobile) / 5rem (80px, desktop) pour la navbar fixe. Avant, 100vh pur →
    // le composer passait SOUS l'écran sur mobile (« zone de texte figée,
    // trop restreinte »). dvh = viewport dynamique (barres d'adresse iOS).
    // ⭐ V3.0 — `relative` : ancre l'overlay mobile de la sidebar dépliée.
    <div className="relative flex h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)] bg-[#FAF6EF] overflow-hidden">
      {/* ⭐ V2.9 — Conteneur INVISIBLE des <audio> distants du canal vocal.
          Les éléments sont créés imperativement (attachRemoteAudio) — c'est
          CE qui manquait : sans eux, on ne s'entendait pas. */}
      <div ref={remoteAudioContainerRef} aria-hidden className="absolute w-0 h-0 overflow-hidden pointer-events-none" />
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" />
      <input ref={imageInputRef} type="file" className="hidden" onChange={handleFileSelect}
        accept="image/*" />

      {/* ═════ ⭐ V3.0 — RAIL MOBILE (icônes seules, <lg) ════════════════
          La barre latérale se REPLIE en rail d'icônes pour que l'interface
          de chat reste visible à côté (demande utilisateur : « ça doit se
          replier pour qu'on voie uniquement les icônes et on peut déplier
          et voir le texte »). Chaque avatar = une conversation ; badge
          non-lus + pastille DIRECT verte pour les canaux vocaux en live.
          Masqué sur desktop (lg+) où la sidebar complète reste fixe. */}
      <div className="lg:hidden w-[68px] flex-shrink-0 border-r border-stone-200 bg-white flex flex-col select-none">
        {/* Déplier → sidebar complète (noms + aperçus + recherche) */}
        <button
          onClick={() => setMobileSidebarExpanded(true)}
          className="w-full h-12 flex items-center justify-center text-[#1E0F2B]/70 hover:bg-[#FAF6EF] active:bg-[#C9A227]/15 transition-colors"
          title="Déplier la liste des conversations"
          aria-label="Déplier la liste des conversations"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        {/* Mon profil (photo) — ouvre l'éditeur de profil */}
        <button
          onClick={() => setShowProfile(true)}
          className="relative mx-auto w-11 h-11 rounded-full overflow-hidden border border-[#C9A227]/50 hover:border-[#C9A227] transition-colors flex-shrink-0 mb-1"
          title="Mon profil — modifier ma photo et mes informations"
          aria-label="Mon profil"
        >
          {currentUserAvatar ? (
            <img src={currentUserAvatar} alt={currentUserName} className="w-full h-full object-cover" />
          ) : (
            <span className={cn("w-full h-full flex items-center justify-center text-white text-xs font-bold", getAvatarColor(currentUserName))}>
              {getInitials(currentUserName)}
            </span>
          )}
        </button>
        <div className="mx-auto w-8 border-t border-stone-200 mb-1" />
        {/* Avatars des conversations (scroll vertical) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 flex flex-col items-center gap-1.5">
          {(loadingConvs || conversations.length === 0) && (
            <div className="w-11 h-11 rounded-full bg-[#FAF6EF] animate-pulse flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#C9A227] animate-spin" />
            </div>
          )}
          {[...channelConvs, ...groupConvs, ...directConvs, ...voiceConvs].map(conv => {
            const isActive = conv.id === activeConvId;
            // ⭐ V3.1 — pastille DIRECT = direct INTRA-CANAL (métadonnées
            // de la room du canal), PLUS le module Live.
            const voiceLive = conv.type === "VOICE" && !!channelDirects[conv.id];
            // ⭐ V3.4 — Conversation PRIVÉE : l'avatar du rail est celui de
            // MON interlocuteur (+ point vert de présence, comme Telegram).
            const interlocutor = conv.type === "DIRECT"
              ? conv.participants.find(p => p.userId !== currentUserId) ?? conv.participants[0]
              : undefined;
            const railName = interlocutor?.name || conv.name;
            const railAvatar = interlocutor?.avatarUrl || conv.avatarUrl;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  "relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                  isActive
                    ? "ring-2 ring-[#C9A227] ring-offset-2 ring-offset-white"
                    : "hover:opacity-80 active:scale-95"
                )}
                title={railName}
                aria-label={railName}
              >
                {railAvatar ? (
                  <img src={railAvatar} alt={railName} className="w-11 h-11 rounded-full object-cover border border-[#C9A227]/25" />
                ) : (
                  <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[13px] shadow-sm", getAvatarColor(railName))}>
                    {getInitials(railName)}
                  </div>
                )}
                {/* ⭐ V3.4 — Présence de l'interlocuteur (privé) */}
                {interlocutor?.online && !voiceLive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" title="En ligne" />
                )}
                {/* Badge non-lus */}
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] border-2 border-white shadow-sm">
                    {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                  </span>
                )}
                {/* ⭐ V3.0 — Pastille DIRECT verte clignotante (canal vocal en live) */}
                {voiceLive && (
                  <span className="absolute -bottom-0.5 -right-0.5 relative flex w-3.5 h-3.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </span>
                )}
                {conv.isEncrypted && !voiceLive && !interlocutor?.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-[#C9A227]/40">
                    <Lock className="w-2.5 h-2.5 text-[#C9A227]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ⭐ V3.0 — Backdrop : ferme la sidebar mobile dépliée au clic dehors */}
      {mobileSidebarExpanded && (
        <div
          className="lg:hidden absolute inset-0 z-30 bg-[#1A0826]/40 backdrop-blur-[2px]"
          onClick={() => setMobileSidebarExpanded(false)}
          aria-hidden
        />
      )}

      {/* ═════ SIDEBAR — Conversations ═════ */}
      {/* ⭐ V3.0 — Desktop (lg+) : sidebar fixe w-80 comme avant. Mobile :
          REPLIÉE par défaut (le rail d'icônes la remplace) ; DÉPLIÉE →
          overlay par-dessus le chat (z-40, depuis le bord droit du rail).
          ⚠️ Toutes les classes de l'état déplié sont préfixées max-lg: —
          sinon `hidden` (base) battrait `flex` et l'overlay casserait le
          layout desktop. */}
      <div className={cn(
        "border-r border-stone-200 bg-white flex-col flex-shrink-0",
        "hidden lg:flex lg:w-80",
        mobileSidebarExpanded &&
          "max-lg:flex max-lg:absolute max-lg:inset-y-0 max-lg:left-[68px] max-lg:right-0 max-lg:z-40 max-lg:max-w-[340px] max-lg:shadow-2xl max-lg:shadow-[#1A0826]/30"
      )}>
        {/* Header */}
        <div className="p-3 border-b border-stone-100 bg-[#2A0E3D]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* ⭐ V3.0 — Replier (mobile uniquement, quand dépliée) */}
              <button
                onClick={() => setMobileSidebarExpanded(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-[#FAF6EF]/70 transition-colors flex-shrink-0"
                title="Replier — revenir aux icônes"
                aria-label="Replier la barre latérale"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold text-[#FAF6EF] flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                <span className="truncate">Yeshua Connect</span>
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {/* ⭐ V2.9 — MA PHOTO cliquable dans le header de la sidebar :
                  ouvre directement l'éditeur de profil (photo, nom, tel…).
                  Avant, aucun accès visible aux paramètres du compte. */}
              <button
                onClick={() => setShowProfile(true)}
                className="relative w-8 h-8 rounded-full overflow-hidden border border-[#C9A227]/50 hover:border-[#C9A227] transition-colors flex-shrink-0"
                title="Mon profil — modifier ma photo et mes informations"
              >
                {currentUserAvatar ? (
                  <img src={currentUserAvatar} alt={currentUserName} className="w-full h-full object-cover" />
                ) : (
                  <span className={cn("w-full h-full flex items-center justify-center text-white text-[10px] font-bold", getAvatarColor(currentUserName))}>
                    {getInitials(currentUserName)}
                  </span>
                )}
                <span className="absolute inset-0 bg-[#C9A227]/0 hover:bg-[#C9A227]/20 transition-colors flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5 text-white opacity-0 hover:opacity-100 drop-shadow" />
                </span>
              </button>
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
          ) : convError !== null && conversations.length === 0 ? (
            /* ⭐ V2.6.1 — État d'erreur explicite : le serveur a répondu
               4xx/5xx. Distinct de l'état « vide » (base sans canaux). */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertCircle className="w-10 h-10 text-[#C9A227] mb-2" />
              <p className="text-sm font-semibold text-[#1E0F2B]">
                Impossible de charger les conversations
              </p>
              <p className="text-xs text-[#8A8378] mt-1">
                {convError === 401
                  ? "Session expirée — rechargez la page pour vous reconnecter."
                  : `Erreur serveur (${convError}). Réessayez dans un instant.`}
              </p>
              <button
                onClick={() => { setConvError(null); setLoadingConvs(true); loadConversations(); }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-xs font-medium hover:bg-[#3A1E4D] transition-colors"
              >
                <Loader2 className="w-3 h-3" /> Réessayer
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-12 h-12 text-[#C9A227]/40 mb-3" />
              <p className="text-sm font-semibold text-[#1E0F2B]">Aucune conversation</p>
              <p className="text-xs text-[#8A8378] mt-1">Les canaux de la communauté apparaîtront ici</p>
            </div>
          ) : (
            <>
              {/* Channels (broadcast) */}
              {channelConvs.length > 0 && (
                <ConvSection title="Canaux" icon={<Megaphone className="w-3 h-3" />} convs={channelConvs}
                  activeConvId={activeConvId} onSelect={handleSelectConversation} mutedConversations={mutedConversations}
                  currentUserId={currentUserId} />
              )}
              {/* Groups */}
              {groupConvs.length > 0 && (
                <ConvSection title="Groupes" icon={<Users className="w-3 h-3" />} convs={groupConvs}
                  activeConvId={activeConvId} onSelect={handleSelectConversation} mutedConversations={mutedConversations}
                  currentUserId={currentUserId} />
              )}
              {/* Direct */}
              {directConvs.length > 0 && (
                <ConvSection title="Direct" icon={<MessageSquare className="w-3 h-3" />} convs={directConvs}
                  activeConvId={activeConvId} onSelect={handleSelectConversation} mutedConversations={mutedConversations}
                  currentUserId={currentUserId} />
              )}
              {/* ⭐ V2.3 — Canaux vocaux persistants */}
              {voiceConvs.length > 0 && (
                <ConvSection title="Canaux vocaux" icon={<Volume2 className="w-3 h-3" />} convs={voiceConvs}
                  activeConvId={activeConvId} onSelect={handleSelectConversation} mutedConversations={mutedConversations}
                  currentUserId={currentUserId}
                  liveBadge={voiceLiveBadge} />
              )}
            </>
          )}
        </div>
      </div>

      {/* ═════ CHAT ZONE ═════ */}
      <div
        className="relative flex-1 flex flex-col bg-stone-50/30"
        style={getYeshuaWatermarkStyle({ opacity: 0.1 })}
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
          <div className="p-3 border-b border-[#C9A227]/15 bg-white/95 backdrop-blur-sm flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {/* ⭐ V3.0 — Retour mobile : DÉPLIE la sidebar (liste complète)
                  au lieu de vider le chat. Le rail d'icônes reste visible,
                  l'utilisateur retrouve la liste des conversations et son
                  contenu au même endroit quand il replie. */}
              <button
                onClick={() => setMobileSidebarExpanded(true)}
                className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-stone-100 text-[#8A8378]"
                aria-label="Voir toutes les conversations"
                title="Voir toutes les conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {/* ⭐ V2.8 — Vraie photo dans le header : interlocuteur (DIRECT)
                  ou photo du canal (GROUP/CHANNEL) — plus d'initiales figées.
                  Un changement de photo de profil se répercute ici dès que
                  les conversations sont rafraîchies (au focus de la fenêtre). */}
              <div className="relative w-10 h-10 rounded-full flex-shrink-0">
                {headerAvatarUrl ? (
                  <img src={headerAvatarUrl} alt={headerDisplayName || activeConv.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#C9A227]/30" />
                ) : (
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm", getAvatarColor(activeConv.name))}>
                    {getInitials(headerDisplayName || activeConv.name)}
                  </div>
                )}
                {(socketConnected || pollingHealthy) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Temps réel actif" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#1E0F2B] text-sm flex items-center gap-1.5 truncate">
                  {headerDisplayName || activeConv.name}
                  {activeConv.isEncrypted && <Lock className="w-3 h-3 text-[#C9A227] flex-shrink-0" />}
                </h3>
                {/* ⭐ V2.6.2 — Ligne d'info thématée (icônes lucide au lieu des
                    emojis, ton chaud #8A8378 au lieu du gris stone).
                    ⭐ V3.4 — La ligne « N membres · N en ligne » est CLIQUABLE :
                    elle ouvre le panneau des membres du canal (façon Telegram /
                    WhatsApp — on tape sur l'en-tête pour voir qui est là). */}
                <button
                  onClick={() => setShowMembersPanel(true)}
                  className="text-xs text-[#8A8378] hover:text-[#1E0F2B] flex items-center gap-1 flex-wrap text-left group/members"
                  title="Voir les membres du canal"
                  aria-label="Voir les membres du canal"
                >
                  {activeConv.isEncrypted && <><Lock className="w-3 h-3 text-[#C9A227]" /> Chiffré E2E ·</>}
                  <Users2 className="w-3 h-3 text-[#C9A227]/70" />
                  <span className="group-hover/members:underline decoration-[#C9A227]/50 underline-offset-2">
                    {activeConv.participants.length} membres
                  </span>
                  {(() => {
                    const onlineCount = activeConv.participants.filter(p => p.online).length;
                    return onlineCount > 0 ? (
                      <span className="group-hover/members:underline decoration-[#C9A227]/50 underline-offset-2">
                        · {onlineCount} en ligne
                      </span>
                    ) : null;
                  })()}
                  {mutedConversations.has(activeConv.id) && <> · <BellOff className="w-3 h-3 text-[#8A8378] inline" /> Muet</>}
                  {/* ⭐ V2.9 — Indicateur de synchro honnête : le temps réel
                      fonctionne (socket OU polling de secours) → badge vert.
                      En cas d'échec réseau → « Reconnexion… » en ambre. */}
                  {(socketConnected || pollingHealthy) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Temps réel actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                      <Loader2 className="w-3 h-3 animate-spin" />Reconnexion…
                    </span>
                  )}
                </button>
              </div>
            </div>
            {/* ⭐ V2.9 — Header RESPONSIVE mobile : la rangée d'actions passe
                à la ligne si besoin et les boutons secondaires (galerie,
                audit, recherche, muet) sont masqués sur très petits écrans —
                « les éléments en haut ne sont pas responsives » corrigé. */}
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {/* ⭐ V3.4 — PANNEAU DES MEMBRES (façon Telegram/WhatsApp) :
                  visible sur TOUS les écrans (mobile inclus — c'est la
                  porte d'entrée vers les messages privés entre membres). */}
              <button
                onClick={() => setShowMembersPanel(true)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors relative"
                title="Membres du canal — voir, écrire en privé, appeler"
                aria-label="Membres du canal"
              >
                <Users2 className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold bg-[#C9A227] text-[#1E0F2B] border border-white">
                  {activeConv.participants.length > 99 ? "99+" : activeConv.participants.length}
                </span>
              </button>
              {/* ⭐ V2.3 — Appels audio/vidéo réels via LiveKit.
                  Masqués pour les canaux vocaux (diffusion par direct). */}
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
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hidden sm:block"
                title="Galerie médias"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              {/* ⭐ V3.2 — Bouton « Audit log (modération) » RETIRÉ de la barre
                  du chat (demande explicite : « quelle est l'importance de
                  modération ? mieux vaut l'enlever »). Le journal continue
                  d'être ENREGISTRÉ côté serveur (API audit-log) — seules les
                  entrées UI sont supprimées. */}
              <button onClick={() => setShowConvSearch(!showConvSearch)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hidden sm:block" title="Rechercher">
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowBible(true)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Ouvrir la Bible dans le chat"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              {/* ⭐ V3.6 — Calendrier biblique intégré : fêtes de l'Éternel,
                  shofar au coucher du soleil, rappels 7 j / 3 j / 24 h. */}
              <button
                onClick={() => setShowCalendar(true)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Calendrier biblique — fêtes, shofar & rappels"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button onClick={() => handleMute(activeConv.id)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hidden sm:block" title="Muet">
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

        {/* ⭐ V2.8 — BANNIÈRE DES MESSAGES ÉPINGLÉS (persistés en base) :
            aperçu du dernier message épinglé (expéditeur + extrait),
            compteur si plusieurs, liste déroulante pour tous les voir,
            désépinglage direct. Clic sur un aperçu → scroll vers le message. */}
        {pinnedPreviewMessages.length > 0 && activeConv && activeConv.type !== "VOICE" && (
          <div className="relative bg-[#2A0E3D]/[0.04] border-b border-[#C9A227]/25">
            <button
              onClick={() => setPinnedListOpen(o => !o)}
              className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-[#C9A227]/5 transition-colors"
              title="Voir les messages épinglés"
            >
              <span className="w-7 h-7 rounded-lg bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                <Pin className="w-3.5 h-3.5 text-[#A3821C]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-[#A3821C] leading-tight">
                  {pinnedPreviewMessages.length > 1
                    ? `${pinnedPreviewMessages.length} messages épinglés`
                    : "Message épinglé"}
                </span>
                {/* Aperçu du message le plus récemment épinglé */}
                <span className="block text-xs text-[#1E0F2B]/80 truncate leading-snug">
                  <span className="font-semibold">{pinnedPreviewMessages[0].senderName}</span>
                  {" · "}
                  <span className="opacity-80">{summarizeMessage(pinnedPreviewMessages[0])}</span>
                </span>
              </span>
              <ChevronRight className={cn("w-4 h-4 text-[#8A8378] flex-shrink-0 transition-transform", pinnedListOpen && "rotate-90")} />
            </button>
            {/* Liste déroulante de tous les messages épinglés */}
            {pinnedListOpen && (
              <div className="absolute left-0 right-0 top-full z-30 bg-white border border-[#C9A227]/25 border-t-0 rounded-b-xl shadow-xl max-h-72 overflow-y-auto">
                {pinnedPreviewMessages.map(pm => (
                  <div key={pm.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-[#FAF6EF] border-b border-[#8A8378]/10 last:border-b-0">
                    <Pin className="w-3 h-3 text-[#A3821C] mt-1 flex-shrink-0" />
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setPinnedListOpen(false);
                        const el = document.getElementById(`msg-${pm.id}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      title="Aller au message"
                    >
                      <p className="text-[11px] font-bold text-[#8C5FA8]">
                        {pm.senderName}
                        <span className="font-normal text-[#8A8378] ml-1.5">{formatTime(pm.createdAt)}</span>
                      </p>
                      <p className="text-xs text-[#1E0F2B]/85 line-clamp-2 leading-snug mt-0.5">{summarizeMessage(pm)}</p>
                    </button>
                    <button
                      onClick={() => handlePin(pm.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#8A8378] hover:text-red-600 flex-shrink-0 transition-colors"
                      title="Désépingler"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ⭐ V2.3 — CANAL VOCAL PERSISTANT (VOICE)
            Remplace complètement la zone messages + input du chat.
            L'utilisateur peut rejoindre/quitter le canal vocal à tout moment.
            Le canal reste "ouvert" côté serveur (room LiveKit persistante).
            ⭐ V2.7 — mode audio/vidéo basculable par l'ADMIN (façon WhatsApp,
            propagation temps réel) + photos réelles des participants.
            ⭐ V3.1 — DIRECT INTRA-CANAL (pas le module Live) : bandeau vert
            + bouton « Lancer/Arrêter le direct » dans le canal lui-même. */}
        {activeConv?.type === "VOICE" ? (
          <VoiceChannelView
            conv={activeConv}
            connected={voiceChannelConnected}
            remoteParticipants={remoteParticipants}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            currentUserRole={currentUserRole}
            localAudioMuted={localAudioMuted}
            localVideoEnabled={localVideoEnabled}
            speakerEnabled={speakerEnabled}
            error={callError}
            videoMode={voiceVideoMode}
            modeSwitching={voiceModeSwitching}
            onJoin={joinVoiceChannel}
            jitsiActive={voiceJitsiActive}
            onStartJitsi={startVoiceJitsi}
            onStopJitsi={stopVoiceJitsi}
            onLeave={leaveVoiceChannel}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={toggleSpeaker}
            onSwitchMode={switchVoiceMode}
            room={livekitRoomRef.current}
            channelMembers={channelMembers}
            channelDirect={activeChannelDirect}
            directSwitching={directSwitching}
            onStartDirect={startChannelDirect}
            onStopDirect={stopChannelDirect}
            activeSpeakerIds={activeSpeakerIds}
            audioPlaybackBlocked={audioPlaybackBlocked}
            onUnlockAudio={unlockAudioPlayback}
            voiceReconnecting={voiceReconnecting}
          />
          ) : (
        /* Messages (uniquement pour les canaux non-VOICE) */
        <div ref={messagesScrollRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-4 py-4">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-[#C9A227]/40 mb-3" />
              <p className="text-sm font-semibold text-[#1E0F2B]">Aucun message dans ce canal</p>
              <p className="text-xs text-[#8A8378] mt-1">Soyez le premier à écrire !</p>
            </div>
          ) : (
            /* ⭐ V2.8 — Colonne de messages PLEINE LARGEUR : la contrainte
               « max-w-4xl mx-auto » laissait une grande bande vide à droite
               sur grands écrans. Les bulles s'auto-limitent (max 82% / 640px)
               et s'alignent aux bords, comme WhatsApp Web. */
            <div className="space-y-1 w-full">
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
                // ⭐ V3.1 — COULEURS PROFESSIONNELLES PAR UTILISATEUR :
                //   - MES messages        → violet maison #8C5FA8 (identité) ;
                //   - les AUTRES membres  → une couleur STABLE par utilisateur
                //     (hash djb2 de son ID dans une palette harmonisée — or,
                //     bleu océan, sarcelle, terracotta, prune, sauge, acier,
                //     bronze). Fini le violet/or binaire : chacun garde SA
                //     couleur sur tous les écrans (demande explicite : « il
                //     faut des variantes de couleurs entre les autres
                //     utilisateurs, de façon professionnelle »).
                // (Badge ★ admin : affiché via msg.senderRole directement.)
                const bubble: BubbleStyle = isMine ? BUBBLE_MINE : senderBubbleStyle(msg.senderId);
                // Styles internes (citations, réactions, horodatage…) :
                // bulle foncée → texte clair (« purple ») ; or → texte encre
                // (« gold ») — exactement les deux traitements existants.
                const usePurpleBubble = bubble.light;
                // ⭐ V2.1 — Détection d'URLs dans le contenu texte pour LinkEmbed
                const messageUrls = msg.type === "TEXT" && msg.content ? extractUrls(msg.content) : [];
                // ⭐ V2.1 — Compter les réponses dans le thread (client-side)
                const threadReplyCount = threads.filter(t => t.parentId === msg.id).length;

                // ⭐ V3.1 — JOURNAL D'APPEL : « Appel manqué » / « Appel
                // terminé · 3 min 12 s » façon WhatsApp — pastille centrée.
                if (msg.type === "CALL_LOG") {
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className="scroll-mt-24">
                      {showDateSep && (
                        <div className="flex items-center justify-center my-5">
                          <div className="flex items-center gap-2 w-full max-w-[520px] mx-auto">
                            <div className="flex-1 h-px bg-[#C9A227]/25" />
                            <span className="px-3.5 py-1.5 bg-white border border-[#C9A227]/30 rounded-full text-[10px] font-bold text-[#8A8378] uppercase tracking-wider shadow-sm">
                              {formatDateSeparator(msg.createdAt)}
                            </span>
                            <div className="flex-1 h-px bg-[#C9A227]/25" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-center py-2 my-1">
                        <CallLogMessage msg={msg} />
                      </div>
                    </div>
                  );
                }

                // ⭐ V3.13 — JOURNAL DE MEMBRE : « Baruch haba ! X a rejoint
                // la communauté » — petite pastille dorée centrée (même
                // famille visuelle que les journaux d'appel), suivie d'une
                // invitation automatique à souhaiter shalom et bienvenue.
                if (msg.type === "MEMBER_LOG") {
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className="scroll-mt-24">
                      {showDateSep && (
                        <div className="flex items-center justify-center my-5">
                          <div className="flex items-center gap-2 w-full max-w-[520px] mx-auto">
                            <div className="flex-1 h-px bg-[#C9A227]/25" />
                            <span className="px-3.5 py-1.5 bg-white border border-[#C9A227]/30 rounded-full text-[10px] font-bold text-[#8A8378] uppercase tracking-wider shadow-sm">
                              {formatDateSeparator(msg.createdAt)}
                            </span>
                            <div className="flex-1 h-px bg-[#C9A227]/25" />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col items-center justify-center py-2 my-1">
                        <MemberLogMessage msg={msg} />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className="scroll-mt-24">
                    {showDateSep && (
                      <div className="flex items-center justify-center my-5">
                        <div className="flex items-center gap-2 w-full max-w-[520px] mx-auto">
                          <div className="flex-1 h-px bg-[#C9A227]/25" />
                          <span className="px-3.5 py-1.5 bg-white border border-[#C9A227]/30 rounded-full text-[10px] font-bold text-[#8A8378] uppercase tracking-wider shadow-sm">
                            {formatDateSeparator(msg.createdAt)}
                          </span>
                          <div className="flex-1 h-px bg-[#C9A227]/25" />
                        </div>
                      </div>
                    )}
                    {/* ⭐ V2.8 — Rangée du message, RESTRUCTURÉE :
                        [avatar de l'expéditeur — sur CHAQUE message] [bulle]
                        pour les autres ; [bulle] à droite pour moi. La bulle
                        s'adapte à son contenu (w-fit, max 82% / 640px) — fini
                        l'espace vide à droite et les empilements désalignés. */}
                    <div className={cn("group relative flex items-end gap-2.5 w-full py-0.5", isMine ? "justify-end" : "justify-start")}>
                      {/* ⭐ V2.8 — Avatar + nom de l'expéditeur sur CHAQUE
                          message des autres (photo réelle si disponible),
                          dans TOUS les types de conversation — y compris
                          DIRECT — façon Facebook / WhatsApp / Telegram. */}
                      {!isMine && (
                        <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden border border-[#C9A227]/25 shadow-sm">
                          {msg.senderAvatarUrl ? (
                            <img src={msg.senderAvatarUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                          ) : (
                            // ⭐ V3.1 — initiales dans la couleur de bulle de
                            // l'expéditeur (cohérence pro avatar ↔ bulle).
                            <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: bubble.bg }}>
                              {getInitials(msg.senderName)}
                            </div>
                          )}
                        </div>
                      )}
                      <div className={cn("relative flex flex-col min-w-0 max-w-[min(82%,640px)]", isMine ? "items-end" : "items-start")}>
                        {/* Nom de l'expéditeur — au-dessus de la bulle, chaque message.
                            ⭐ V3.1 : couleur = la couleur « signature » de
                            l'expéditeur (comme Slack/Discord). */}
                        {!isMine && (
                          <p className="text-[11px] font-bold mb-0.5 ml-1 leading-tight" style={{ color: bubble.bg }}>
                            {msg.senderName}
                            {(msg.senderRole === "ADMIN" || msg.senderRole === "SUPER_ADMIN") && (
                              <span className="ml-1 text-[#A3821C]">★</span>
                            )}
                          </p>
                        )}
                        <div
                          onClick={() => setShowActionsFor(prev => prev === msg.id ? null : msg.id)}
                          style={{ backgroundColor: bubble.bg, color: bubble.text }}
                          className={cn(
                            // ⭐ V3.1 — Bulle à la couleur de l'expéditeur
                            // (violet = moi ; palette stable pour les autres),
                            // queue effilée côté expéditeur, texte adapté.
                            // Clic sur la bulle = afficher/masquer les actions (mobile).
                            "w-fit rounded-2xl px-3.5 py-2 shadow-sm cursor-pointer",
                            isMine ? "rounded-br-md" : "rounded-bl-md"
                          )}>
                          {/* Reply quote — ⭐ V2.8 : couleurs adaptées à la bulle */}
                          {msg.replyTo && (
                            <div className={cn(
                              "mb-1.5 px-2 py-1 rounded-lg text-xs border-l-2 max-w-full",
                              usePurpleBubble
                                ? "bg-[#FAF6EF]/15 border-[#FAF6EF] text-[#FAF6EF]"
                                : "bg-[#1E0F2B]/10 border-[#1E0F2B] text-[#1E0F2B]"
                            )}>
                              <p className="font-semibold opacity-90">{msg.replyTo.senderName}</p>
                              <p className="opacity-75 truncate">{msg.replyTo.content}</p>
                            </div>
                          )}
                          {/* Sender name : affiché au-dessus de la bulle depuis V2.8 */}
                          {/* Content */}
                          {msg.type === "POLL" && msg.poll ? (
                            <PollMessage
                              poll={msg.poll}
                              currentUserId={currentUserId}
                              variant={usePurpleBubble ? "purple" : "gold"}
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
                              "px-3 py-2 rounded-xl border-l-4 my-1 max-w-full",
                              usePurpleBubble
                                ? "bg-[#FAF6EF]/12 border-[#FAF6EF]"
                                : "bg-[#1E0F2B]/10 border-[#1E0F2B]"
                            )}>
                              <p className="text-xs font-bold opacity-90">{msg.verseRef}</p>
                              <p className="text-sm italic mt-0.5 whitespace-pre-wrap break-words">{msg.verseText}</p>
                            </div>
                          ) : msg.type === "IMAGE" && msg.attachmentUrl ? (
                            <div className="relative group/img">
                              <img src={msg.attachmentUrl} alt={msg.attachmentName || "image"} className="rounded-xl max-w-full max-h-64" />
                              <a href={msg.attachmentUrl} download={msg.attachmentName}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                title="Télécharger">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : msg.type === "VIDEO" && msg.attachmentUrl ? (
                            <video src={msg.attachmentUrl} controls className="rounded-xl max-w-full max-h-64" />
                          ) : msg.type === "AUDIO" && msg.attachmentUrl ? (
                            <AudioPlayer src={msg.attachmentUrl} duration={msg.duration} attachmentName={msg.attachmentName} variant={usePurpleBubble ? "purple" : "gold"} />
                          ) : msg.type === "FILE" && msg.attachmentUrl ? (
                            <a href={msg.attachmentUrl} download={msg.attachmentName}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-w-[200px]",
                                usePurpleBubble
                                  ? "bg-[#2A0E3D]/40 hover:bg-[#2A0E3D]/60"
                                  : "bg-[#1E0F2B]/10 hover:bg-[#1E0F2B]/20"
                              )}>
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0", getFileIcon(msg.attachmentName).color)}>
                                {getFileIcon(msg.attachmentName).icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-semibold truncate", usePurpleBubble ? "text-[#FAF6EF]" : "text-[#1E0F2B]")}>{msg.attachmentName || "Fichier"}</p>
                                <p className={cn("text-[10px]", usePurpleBubble ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/70")}>{formatFileSize(msg.attachmentSize)}</p>
                              </div>
                              <Download className={cn("w-4 h-4 flex-shrink-0", usePurpleBubble ? "text-[#FAF6EF]" : "text-[#1E0F2B]")} />
                            </a>
                          ) : (
                            // ⭐ V2.1 — Rendu du contenu texte avec mentions surlignées
                            // ⭐ V2.2 — + code blocks ```...``` + spoilers ||...||
                            <div className="text-sm whitespace-pre-wrap break-words">
                              <RichMessageContent content={msg.content || ""} memberNames={channelMembers.map(m => m.name)} isMine={isMine} variant={usePurpleBubble ? "purple" : "gold"} />
                            </div>
                          )}
                          {/* Timestamp + edited — ⭐ V2.8 : lisibles sur or ET violet */}
                          <div className={cn(
                            "flex items-center gap-1 mt-0.5 justify-end",
                            usePurpleBubble ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/60"
                          )}>
                            {msg.editedAt && <span className="text-[9px] italic">modifié</span>}
                            {pinnedMessages.has(msg.id) && <Pin className="w-2.5 h-2.5" />}
                            <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                          </div>
                          {/* Reactions — ⭐ V2.8 : pastilles lisibles sur or/violet */}
                          {msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {msg.reactions.reduce((acc, r) => {
                                const ex = acc.find(e => e.emoji === r.emoji);
                                if (ex) ex.count++; else acc.push({ emoji: r.emoji, count: 1 });
                                return acc;
                              }, [] as { emoji: string; count: number }[]).map(r => (
                                <span key={r.emoji} className={cn(
                                  "px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                  usePurpleBubble
                                    ? "bg-[#FAF6EF]/15 border-[#FAF6EF]/25 text-[#FAF6EF]"
                                    : "bg-[#1E0F2B]/10 border-[#1E0F2B]/20 text-[#1E0F2B]"
                                )}>
                                  {r.emoji} {r.count > 1 && <span className="text-[10px] font-bold">{r.count}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* ⭐ V2.8 — BARRE D'ACTIONS FLOTTANTE façon WhatsApp :
                            réactions rapides + Répondre + Thread + menu « ⋮ »
                            (Modifier / Épingler / Transférer / Supprimer).
                            Visible au survol (desktop) ou au tap sur la bulle
                            (mobile), ancrée au-dessus de la bulle. */}
                        <div className={cn(
                          "absolute -top-2 z-20 -translate-y-full flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-[#C9A227]/30 pl-1.5 pr-1 py-0.5 transition-opacity duration-150",
                          (showActionsFor === msg.id || showMsgMenu === msg.id || deleteMenuFor === msg.id)
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100",
                          isMine ? "right-0" : "left-0"
                        )}>
                          {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }} className="text-sm hover:scale-125 transition-transform p-0.5" title={`Réagir ${emoji}`}>
                              {emoji}
                            </button>
                          ))}
                          <div className="w-px h-4 bg-[#8A8378]/20 mx-0.5" />
                          <button onClick={(e) => { e.stopPropagation(); setReplyTo(msg); }} className="p-1 hover:bg-[#C9A227]/10 rounded-full" title="Répondre">
                            <Reply className="w-3.5 h-3.5 text-[#2A0E3D]" />
                          </button>
                          {/* ⭐ V2.1 — Bouton Thread (ouvre le panneau latéral) */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenThread(msg); }}
                            className={cn(
                              "relative p-1 hover:bg-[#C9A227]/10 rounded-full",
                              threadParent?.id === msg.id ? "text-[#C9A227]" : "text-[#2A0E3D]"
                            )}
                            title="Répondre dans un thread"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {threadReplyCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[12px] h-3 flex items-center justify-center rounded-full bg-[#C9A227] text-[8px] font-bold text-[#1E0F2B]">
                                {threadReplyCount}
                              </span>
                            )}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setShowMsgMenu(prev => prev === msg.id ? null : msg.id); }} className="p-1 hover:bg-[#C9A227]/10 rounded-full" title="Plus d'actions">
                            <MoreVertical className="w-3.5 h-3.5 text-[#2A0E3D]" />
                          </button>
                        </div>

                        {/* ⭐ V2.8 — MENU « ⋮ » : actions secondaires du message */}
                        {showMsgMenu === msg.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setShowMsgMenu(null)} />
                            <div className={cn(
                              "absolute z-30 top-2 w-52 bg-white rounded-xl shadow-2xl border border-[#C9A227]/25 py-1.5 overflow-hidden",
                              isMine ? "right-0" : "left-0"
                            )}>
                              <button onClick={() => { handleEdit(msg); setShowMsgMenu(null); setShowActionsFor(null); }}
                                className="w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2.5 text-[#1E0F2B] hover:bg-[#FAF6EF] transition-colors">
                                <Edit2 className="w-3.5 h-3.5 text-[#8C5FA8]" /> Modifier
                              </button>
                              <button onClick={() => { handlePin(msg.id); setShowMsgMenu(null); setShowActionsFor(null); }}
                                className="w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2.5 text-[#1E0F2B] hover:bg-[#FAF6EF] transition-colors">
                                <Pin className={cn("w-3.5 h-3.5", pinnedMessages.has(msg.id) ? "text-[#C9A227]" : "text-[#8C5FA8]")} />
                                {pinnedMessages.has(msg.id) ? "Désépingler" : "Épingler"}
                              </button>
                              <button onClick={() => { setShowForwardModal(msg.id); setShowMsgMenu(null); setShowActionsFor(null); }}
                                className="w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2.5 text-[#1E0F2B] hover:bg-[#FAF6EF] transition-colors">
                                <Forward className="w-3.5 h-3.5 text-[#8C5FA8]" /> Transférer
                              </button>
                              {(isMine || canDeleteAny) && (
                                <button onClick={() => { setDeleteMenuFor(msg.id); setShowMsgMenu(null); }}
                                  className="w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2.5 text-red-600 hover:bg-red-50 border-t border-[#8A8378]/10 mt-1 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Supprimer…
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        {/* ⭐ V2.8 — POPOVER DE SUPPRESSION « pour moi / pour
                            tous » (façon WhatsApp) — remplace la suppression
                            directe. « Pour tous » = soft-delete en base +
                            broadcast ; « Pour moi » = masquage local persisté. */}
                        {deleteMenuFor === msg.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setDeleteMenuFor(null)} />
                            <div className={cn(
                              "absolute z-40 top-2 w-60 bg-white rounded-xl shadow-2xl border border-red-200 overflow-hidden",
                              isMine ? "right-0" : "left-0"
                            )}>
                              <p className="px-4 pt-3 pb-1.5 text-xs font-bold text-[#1E0F2B]">Supprimer ce message ?</p>
                              <button onClick={() => handleDelete(msg.id, false)}
                                className="w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2.5 text-[#1E0F2B] hover:bg-[#FAF6EF] transition-colors">
                                <EyeOff className="w-3.5 h-3.5 text-[#8A8378]" /> Supprimer pour moi
                              </button>
                              {(isMine || canDeleteAny) && (
                                <button onClick={() => handleDelete(msg.id, true)}
                                  className="w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2.5 text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Supprimer pour tous
                                </button>
                              )}
                              <button onClick={() => setDeleteMenuFor(null)}
                                className="w-full px-4 py-2 text-left text-xs text-[#8A8378] hover:bg-[#FAF6EF] border-t border-[#8A8378]/10 transition-colors">
                                Annuler
                              </button>
                            </div>
                          </>
                        )}

                        {/* ⭐ V2.8 — LinkEmbed sous la bulle, aligné sur la
                            colonne de la bulle (plus de décalage). */}
                        {messageUrls.length > 0 && (
                          <div className={cn("w-full mt-1", isMine ? "self-end" : "self-start")}>
                            {messageUrls.slice(0, 3).map((url, idx) => (
                              <LinkEmbed key={`${msg.id}-embed-${idx}`} url={url} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Typing indicator — alimenté par Socket.io (typing:start/stop) */}
              {typingLabel ? (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#C9A227]/25 rounded-2xl rounded-bl-md px-4 py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[11px] text-[#1E0F2B]/80">{typingLabel}</span>
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
        {/* ⭐ V3.0 — Padding mobile resserré (p-2) pour offrir plus de hauteur
            utile à la zone de saisie ; desktop inchangé (p-3). */}
        {activeConv && activeConv.type !== "VOICE" && (
          <div className="p-2 md:p-3 border-t border-[#C9A227]/15 bg-white">
            {/* ⭐ V2.8 — COMPOSER DE PIÈCES JOINTES (façon WhatsApp) :
                aperçu des fichiers EN ATTENTE (collage Ctrl+V, « Joindre »,
                drag & drop) avec suppression individuelle + envoi explicite.
                Plus d'envoi automatique au collage — l'utilisateur garde le
                contrôle (légende possible via le champ de saisie). */}
            {pendingFiles.length > 0 && (
              <div className="mb-2 p-2.5 bg-[#FAF6EF] rounded-xl border border-[#C9A227]/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#A3821C] uppercase tracking-wide">
                    {pendingFiles.length} pièce{pendingFiles.length > 1 ? "s" : ""} jointe{pendingFiles.length > 1 ? "s" : ""} prête{pendingFiles.length > 1 ? "s" : ""}
                  </p>
                  <button
                    onClick={() => { pendingFiles.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); }); setPendingFiles([]); }}
                    disabled={uploadingFiles}
                    className="text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                  >
                    Tout annuler
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pendingFiles.map(pf => (
                    <div key={pf.id} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-[#C9A227]/40 bg-white shadow-sm">
                      {pf.kind === "image" && pf.previewUrl ? (
                        <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2">
                          {getFileIcon(pf.file.name).icon}
                          <p className="text-[9px] text-[#1E0F2B] truncate w-full text-center font-semibold">{pf.file.name}</p>
                          <p className="text-[8px] text-[#8A8378]">{formatFileSize(pf.file.size)}</p>
                        </div>
                      )}
                      <button
                        onClick={() => removePendingFile(pf.id)}
                        disabled={uploadingFiles}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#2A0E3D] text-[#FAF6EF] flex items-center justify-center shadow-md hover:bg-red-600 transition-colors disabled:opacity-40"
                        title="Retirer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {uploadingFiles && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-[#8C5FA8] font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi en cours…
                  </div>
                )}
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
              <div className="flex items-center gap-1.5 md:gap-2">
                {/* ⭐ V2.5 — Bouton « Joindre » unique (façon WhatsApp) :
                    ouvre le modal regroupant Document, Image, GIF, Sondage
                    et Programmé. Remplace les 5 boutons séparés
                    (trombone, image, GIF, sondage, calendrier). */}
                {/* ⭐ V3.0 — Cible tactile 40×40 sur mobile (accessibilité
                    Android/iOS) ; 36×36 sur desktop comme avant. */}
                <button
                  onClick={() => { setAttachOpen(true); setAttachPanel("menu"); }}
                  className={cn(
                    "h-10 w-10 md:h-9 md:w-9 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 transition-colors cursor-pointer flex-shrink-0",
                    attachOpen && "bg-[#C9A227]/10 text-[#C9A227]"
                  )}
                  title="Joindre — document, image, GIF, sondage, message programmé"
                  aria-label="Joindre un fichier"
                >
                  <Paperclip className="w-4.5 h-4.5 md:w-4 md:h-4" />
                </button>
                {/* ⭐ V2.2 — Emoji Picker (Popover shadcn/ui) */}
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "h-10 w-10 md:h-9 md:w-9 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 transition-colors flex-shrink-0",
                        showEmojiPicker && "bg-[#C9A227]/10 text-[#C9A227]"
                      )}
                      title="Emojis"
                      aria-label="Choisir un emoji"
                    >
                      <Smile className="w-4.5 h-4.5 md:w-4 md:h-4" />
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
                    placeholder="Écrivez votre message…"
                    rows={1}
                    // ⭐ V3.0 — ZONE DE TEXTE MOBILE AGRANDIE (demande
                    // utilisateur : « la zone de texte est trop petite ») :
                    //   • min-h-[46px] → hauteur de base généreuse au doigt
                    //   • text-base (16px) sur mobile → iOS Safari ne zoome
                    //     PAS à la focus (toute police < 16px déclenche le zoom)
                    //   • py-3 → rembourrage vertical confortable
                    //   • Desktop : py-2.5 / text-sm / hauteur auto (inchangé)
                    className="w-full px-4 py-3 md:py-2.5 min-h-[46px] md:min-h-[40px] bg-stone-50 border border-stone-200 rounded-xl text-base md:text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 resize-none"
                    title="Tapez / pour les commandes, @ pour mentionner, Ctrl+V pour coller une image"
                    disabled={sending}
                  />
                </div>
                {/* (⭐ V2.5) Boutons Sondage et Programmé déplacés dans le modal
                    « Joindre » (trombone) — la barre reste épurée : trombone,
                    emojis, champ de saisie, micro/envoi. */}
                {(inputText.trim() || pendingFiles.length > 0) ? (
                  <button onClick={handleSend} disabled={sending || uploadingFiles}
                    className="h-10 w-10 md:h-9 md:w-9 p-0 flex items-center justify-center rounded-xl bg-[#8C5FA8] text-[#FAF6EF] hover:bg-[#7B4FA0] disabled:opacity-30 transition-colors flex-shrink-0"
                    title={pendingFiles.length > 0 ? "Envoyer les pièces jointes (+ légende)" : "Envoyer"}
                    aria-label="Envoyer">
                    {(sending || uploadingFiles) ? <Loader2 className="w-4.5 h-4.5 md:w-4 md:h-4 animate-spin" /> : <Send className="w-4.5 h-4.5 md:w-4 md:h-4" />}
                  </button>
                ) : (
                  <button onClick={startRecording} className="h-10 w-10 md:h-9 md:w-9 p-0 flex items-center justify-center rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors flex-shrink-0" title="Message vocal" aria-label="Enregistrer un message vocal">
                    <Mic className="w-4.5 h-4.5 md:w-4 md:h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ⭐ V2.8 — TOAST DE RETOUR (partage de verset, erreurs d'envoi) :
          confirme visuellement les actions silencieuses. */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 max-w-[90vw]",
              toastMsg.kind === "success"
                ? "bg-[#2A0E3D] border-[#C9A227]/50 text-[#FAF6EF]"
                : "bg-red-600 border-red-400/50 text-white"
            )}
            role="status"
          >
            {toastMsg.kind === "success"
              ? <Check className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="text-sm font-medium">{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                        <p className="text-sm font-semibold text-[#1E0F2B] flex items-center gap-1.5">
                          {u.name}
                          {/* ⭐ V3.13 — Icône distinctive des super admins. */}
                          {u.role === "SUPER_ADMIN" && (
                            <Crown className="w-3 h-3 text-[#C9A227]" aria-label="Administrateur principal" />
                          )}
                        </p>
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

      {/* ⭐ V3.4 — PANNEAU DES MEMBRES DU CANAL (façon Telegram/WhatsApp) :
          liste complète, recherche, administrateurs identifiés, présence,
          et pour chaque membre : écrire en privé / appeler (audio/vidéo).
          ⭐ V3.5 : + invitations depuis le panneau (onglet « Inviter »),
          + PROFIL COMPLET au clic (bio, pays/ville) et + blocage. */}
      {showMembersPanel && activeConv && (
        <MembersPanel
          conversation={activeConv}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          dmBusy={dmBusy}
          blockBusy={blockBusy}
          onOpenDirectMessage={(userId, name) => { openDirectMessage(userId, name); }}
          onCallMember={(userId, type, name, avatarUrl) => { callMemberDirect(userId, type, name, avatarUrl); }}
          onOpenProfile={(userId) => setProfileMemberId(userId)}
          onToggleBlock={(userId, name, block) => { toggleBlockMember(userId, name, block); }}
          onInvited={() => { loadConversationsRef.current?.(); }}
          onClose={() => setShowMembersPanel(false)}
        />
      )}

      {/* ⭐ V3.5 — PROFIL COMPLET D'UN MEMBRE (au clic dans le panneau) :
          photo, badges, présence, bio, pays/ville, canaux communs et
          actions : message privé / appel / bloquer-débloquer. */}
      {profileMemberId && activeConv && (
        <MemberProfileModal
          userId={profileMemberId}
          currentUserId={currentUserId}
          originConversationId={activeConv.id}
          dmBusy={dmBusy}
          blockBusy={blockBusy}
          onOpenDirectMessage={(userId, name) => { openDirectMessage(userId, name); }}
          onCallMember={(userId, type, name, avatarUrl) => { callMemberDirect(userId, type, name, avatarUrl); }}
          onToggleBlock={(userId, name, block) => { toggleBlockMember(userId, name, block); }}
          onClose={() => setProfileMemberId(null)}
        />
      )}

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

      {/* ⭐ V2.9 — Profile Modal RÉEL : avant, ce modal était une coquille
          vide (« Membre / Disciple » + un bouton « Modifier le profil » qui
          ne faisait RIEN). L'utilisateur peut maintenant modifier sa photo,
          son nom, son téléphone, son pays, sa ville et sa bio directement
          depuis Yeshua Connect (PUT /api/user/profile). */}
      {showProfile && (
        <ProfileSettingsModal
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setShowProfile(false)}
          onSaved={(avatarUrl) => {
            setCurrentUserAvatar(avatarUrl);
            // Rafraîchir les conversations : les autres membres verront la
            // nouvelle photo via le polling/refresh.
            loadConversationsRef.current?.();
          }}
        />
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

      {/* ⭐ V3.6 — CALENDRIER BIBLIQUE INTÉGRÉ ────────────────────────────
          Même pattern que la Bible (V2.6) : plein écran par-dessus la
          conversation. L'utilisateur consulte les fêtes de l'Éternel,
          les noms hébreux des jours, écoute le shofar, règle les
          notifications 7 j / 3 j / 24 h — et peut annoncer la prochaine
          solennité dans la conversation active. Fermeture : X, Échap ou
          clic sur le fond. */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCalendar(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-1.5 sm:inset-3 md:inset-6 lg:inset-8 rounded-2xl overflow-hidden shadow-2xl border border-[#C9A227]/40"
            >
              <CalendarWorkspace
                onClose={() => setShowCalendar(false)}
                onShareAnnonce={handleShareAnnonce}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⭐ V3.6 — SHOFAR NOTIFIER (invisible, sauf bannières) ───────────
          Surveille en arrière-plan les entrées de Shabbat et des fêtes
          (coucher du soleil réel à Jérusalem) : sonnerie de shofar,
          bannière et notification système ; rappels 7 j / 3 j / 24 h
          pour les grandes solennités. */}
      <ShofarNotifier onOpenCalendar={() => setShowCalendar(true)} />

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

      {/* ⭐ V3.2 — Modal Audit log RETIRÉ (avec le bouton de la barre du chat). */}

      {/* ⭐ V2.3 — APPELS AUDIO/VIDÉO RÉELS VIA LIVEKIT
          Overlay plein écran affiché quand callState !== "idle".
          - Pendant "outgoing" : en attente de l'autre participant.
          - Pendant "active" : participant distant connecté.
          - Vidéo locale (PIP) + vidéo distante (grand écran) si appel vidéo.
          - Boutons : mute micro, toggle caméra (si vidéo), speaker, raccrocher.
          ⭐ V3.1 — photo de la conversation (VRAIE photo du canal, plus
          d'initiales) + issue distante (refusé / manqué / terminé). */}
      {callState !== "idle" && (callConvInfo || activeConv) && (
        <CallOverlay
          callState={callState}
          callType={callType}
          convName={callConvInfo?.name || activeConv?.name || "Conversation"}
          convAvatarUrl={callConvInfo?.avatarUrl || activeConv?.avatarUrl}
          endStatus={callEndStatus}
          currentUserName={currentUserName}
          remoteParticipants={remoteParticipants}
          localAudioMuted={localAudioMuted}
          localVideoEnabled={localVideoEnabled}
          speakerEnabled={speakerEnabled}
          error={callError}
          room={livekitRoomRef.current}
          p2pRemoteStream={p2p.remoteStream}
          p2pLocalStream={p2p.localStream}
          p2pConnectionState={p2p.connectionState}
          jitsiRoom={callJitsiRoom}
          jitsiUserName={currentUserName}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleSpeaker={toggleSpeaker}
          onHangup={hangupCall}
        />
      )}

      {/* ⭐ V3.1 — APPEL ENTRANT (signalisation /calls/signal) : plein écran
          au-dessus de tout, photo du canal + nom de l'appelant, SONNERIE
          (WebAudio) + vibration (mobile) + Accepter / Refuser. */}
      {incomingCall && callState === "idle" && (
        <IncomingCallOverlay
          info={incomingCall}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * ⭐ V2.6.2 — Heure du dernier message façon WhatsApp/Telegram :
 * aujourd'hui → HH:MM · hier → « Hier » · < 7 jours → jour abrégé · sinon → jj/mm/aa
 */
function formatConvTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = Math.floor(d.getTime() / 86400000);
  const today = Math.floor(startOfToday / 86400000);
  if (day === today) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (day === today - 1) return "Hier";
  if (today - day < 7) {
    return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ConvSection({ title, icon, convs, activeConvId, onSelect, mutedConversations, liveBadge, currentUserId }: {
  title: string; icon: React.ReactNode; convs: ChatConversation[];
  activeConvId: string | null; onSelect: (id: string) => void; mutedConversations: Set<string>;
  /** ⭐ V3.4 — Pour les conversations DIRECT : afficher le nom + la photo
   * de MON interlocuteur (pas le nom technique stocké du canal). */
  currentUserId: string;
  /** ⭐ V2.9 — Badge « EN DIRECT » vert clignotant (canaux vocaux). */
  liveBadge?: { title: string; portraitUrl?: string | null } | null;
}) {
  return (
    <>
      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-[#8A8378] uppercase tracking-wider sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center gap-1.5">
        {icon} {title}
        {/* ⭐ V2.9 — Indicateur DIRECT EN COURS sur la section des canaux
            vocaux : pastille verte qui clignote + photo du diffuseur. */}
        {liveBadge && (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[9px] font-black uppercase tracking-wide">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            <Radio className="w-2.5 h-2.5" />Direct
          </span>
        )}
      </div>
      {convs.map(conv => {
        const isActive = conv.id === activeConvId;
        const isMuted = mutedConversations.has(conv.id);
        // ⭐ V3.4 — Conversation PRIVÉE : chacun voit SON interlocuteur
        // (nom, photo, présence) — exactement comme Telegram/WhatsApp.
        const interlocutor = conv.type === "DIRECT"
          ? conv.participants.find(p => p.userId !== currentUserId) ?? conv.participants[0]
          : undefined;
        const displayName = interlocutor?.name || conv.name;
        const displayAvatar = interlocutor?.avatarUrl || conv.avatarUrl;
        return (
          <button key={conv.id} onClick={() => onSelect(conv.id)}
            // ⭐ V2.6.2 — Rangée façon WhatsApp/Telegram : deux lignes
            // (nom + heure en haut, aperçu + badges en bas), avatar rond
            // centré verticalement, couleurs chaudes de la charte (fini le
            // gris stone qui ne mariait pas avec le thème).
            className={cn(
              "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer group border-l-[3px]",
              isActive
                ? "bg-[#FAF6EF] border-[#C9A227]"
                : "border-transparent hover:bg-[#FAF6EF]/70"
            )}>
            <div className="relative flex-shrink-0">
              {displayAvatar ? (
                // ⭐ V2.5 — Photo du canal (uploadée depuis le back-office) ;
                // ⭐ V3.4 — ou photo de l'INTERLOCUTEUR pour les privés.
                <img src={displayAvatar} alt={displayName}
                  className="w-11 h-11 rounded-full object-cover border border-[#C9A227]/25" />
              ) : (
                <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm", getAvatarColor(displayName))}>
                  {getInitials(displayName)}
                </div>
              )}
              {/* ⭐ V3.4 — Présence de l'interlocuteur (privé, façon
                  Telegram : point vert quand il est en ligne). */}
              {interlocutor?.online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" title="En ligne" />
              )}
              {conv.isEncrypted && !interlocutor?.online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-[#C9A227]/40">
                  <Lock className="w-2.5 h-2.5 text-[#C9A227]" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Ligne 1 : nom + heure du dernier message (façon WhatsApp) */}
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[15px] font-semibold text-[#1E0F2B] truncate leading-tight">{displayName}</p>
                <span className={cn(
                  "text-[11px] leading-none flex-shrink-0 font-medium",
                  conv.unreadCount > 0 ? "text-[#C9A227] font-bold" : "text-[#8A8378]"
                )}>
                  {formatConvTime(conv.lastMessageAt)}
                </span>
              </div>
              {/* Ligne 2 : aperçu + badges alignés en bas */}
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-[13px] text-[#8A8378] truncate leading-snug flex items-center gap-1 min-w-0">
                  {conv.type === "CHANNEL" && <Hash className="w-3 h-3 text-[#C9A227]/70 flex-shrink-0" />}
                  {conv.type === "GROUP" && <Users className="w-3 h-3 text-[#C9A227]/70 flex-shrink-0" />}
                  {conv.type === "PASTORS" && <Users className="w-3 h-3 text-[#5B21B6] flex-shrink-0" />}
                  {conv.type === "DIRECT" && <MessageCircle className="w-3 h-3 text-[#8C5FA8]/70 flex-shrink-0" />}
                  <span className="truncate">{conv.lastMessagePreview || conv.description || "Aucun message"}</span>
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {conv.isEncrypted && <span className="text-[9px] text-[#C9A227] font-bold bg-[#C9A227]/10 rounded px-1 py-px">E2E</span>}
                  {isMuted && <BellOff className="w-3.5 h-3.5 text-[#8A8378]" />}
                  {/* ⭐ V2.1 — Badge unread (calculé depuis lastReadAt, incrémenté
                      en temps réel via Socket.io) */}
                  {conv.unreadCount > 0 && (
                    <span className="px-1.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] shadow-sm">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
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
  variant = "gold",
}: {
  poll: ChatPoll;
  currentUserId: string;
  onVoted: (messagePoll: ChatPoll) => void;
  /** ⭐ V2.8 — Couleur de la bulle hôte : "purple" (moi/admin) ou "gold". */
  variant?: "purple" | "gold";
}) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const purple = variant === "purple";

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
      {/* En-tête du sondage — ⭐ V2.8 : couleurs adaptées à la bulle */}
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className={cn("w-3.5 h-3.5 flex-shrink-0", purple ? "text-[#FAF6EF]" : "text-[#1E0F2B]")} />
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", purple ? "text-[#FAF6EF]/80" : "text-[#1E0F2B]/70")}>
          Sondage {poll.isMulti ? "· choix multiple" : ""}
        </span>
      </div>
      <p className={cn("text-sm font-bold mb-3", purple ? "text-[#FAF6EF]" : "text-[#1E0F2B]")}>{poll.question}</p>

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
                purple
                  ? myVote
                    ? "border-[#FAF6EF]/60 bg-[#FAF6EF]/10"
                    : "border-[#FAF6EF]/25 hover:border-[#FAF6EF]/50 bg-[#FAF6EF]/[0.04]"
                  : myVote
                    ? "border-[#1E0F2B]/50 bg-[#1E0F2B]/[0.06]"
                    : "border-[#1E0F2B]/25 hover:border-[#1E0F2B]/50 bg-[#1E0F2B]/[0.04]"
              )}
              title={myVote ? "Votre vote (cliquez pour changer)" : "Voter pour cette option"}
            >
              {/* Barre de fond proportionnelle au résultat */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-500",
                  purple ? "bg-[#FAF6EF]/20" : "bg-[#1E0F2B]/15"
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className={cn("text-sm font-medium truncate flex items-center gap-1.5", purple ? "text-[#FAF6EF]" : "text-[#1E0F2B]")}>
                  {myVote && <Check className={cn("w-3 h-3 flex-shrink-0", purple ? "text-[#FAF6EF]" : "text-[#1E0F2B]")} />}
                  {o.label}
                </span>
                <span className={cn("text-[10px] font-bold flex-shrink-0", purple ? "text-[#FAF6EF]/80" : "text-[#1E0F2B]/70")}>
                  {votes > 0 && `${pct}% · ${votes}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Résultat global */}
      <div className="flex items-center justify-between mt-2.5">
        <span className={cn("text-[10px]", purple ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/60")}>
          {totalVotes === 0
            ? "Aucun vote — cliquez une option"
            : `${totalVotes} vote${totalVotes > 1 ? "s" : ""}`}
        </span>
        <span className={cn("text-[10px] italic", purple ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]/60")}>
          {poll.isMulti ? "Plusieurs réponses possibles" : "Une seule réponse"}
        </span>
      </div>
      {error && <p className="text-[10px] text-red-300 mt-1">{error}</p>}
    </div>
  );
}

function AudioPlayer({ src, duration, attachmentName, variant = "gold" }: { src: string; duration?: number; attachmentName?: string; variant?: "purple" | "gold" }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const purple = variant === "purple";

  // ⭐ V2.6.2 — Waveform déterministe façon WhatsApp/Telegram : hauteurs
  // pseudo-aléatoires mais STABLES (seed = longueur du src), colorées en
  // or jusqu'à la position de lecture, en ivoire chaud au-delà.
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) % 997;
    const heights: number[] = [];
    for (let i = 0; i < 28; i++) {
      seed = (seed * 137 + 61) % 997;
      heights.push(0.3 + (seed / 997) * 0.7);
    }
    return heights;
  }, [src]);

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
  const playedBars = Math.round((progress / 100) * bars.length);

  return (
    // ⭐ V2.6.2 — Bulle audio professionnelle façon messageries pro :
    // bouton lecture rond + waveform cliquable + durée + VRAIE icône
    // de téléchargement (Download, remplace l'icône « document » FileText).
    // ⭐ V2.8 — Couleurs adaptées à la bulle hôte (or ou violet).
    <div className="flex items-center gap-3 py-1.5 pl-1 pr-1.5 min-w-[260px]">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
      />
      <button onClick={togglePlay}
        aria-label={playing ? "Mettre en pause" : "Lire le message vocal"}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors shadow-sm",
          purple ? "bg-[#2A0E3D] hover:bg-[#3A1E4D]" : "bg-[#1E0F2B] hover:bg-[#2A0E3D]"
        )}>
        {playing ? <Pause className="w-4 h-4 text-[#C9A227]" fill="currentColor" /> : <Play className="w-4 h-4 text-[#C9A227] fill-current" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onClick={handleSeek}
          title="Cliquer pour avancer dans l'audio"
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-colors",
                i < playedBars
                  ? "bg-[#C9A227]"
                  : purple ? "bg-[#FAF6EF]/40" : "bg-[#1E0F2B]/25"
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <div className={cn("flex items-center justify-between text-[11px] tabular-nums px-0.5", purple ? "text-[#FAF6EF]/80" : "text-[#1E0F2B]/70")}>
          <span>{formatSec(currentTime)}</span>
          {attachmentName && (
            <span className="truncate max-w-[120px] text-[10px] opacity-70">{attachmentName}</span>
          )}
          <span>{formatSec(audioDuration)}</span>
        </div>
      </div>
      <a href={src} download={attachmentName || "audio.webm"}
        aria-label="Télécharger l'audio"
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
          purple ? "hover:bg-[#FAF6EF]/20 text-[#FAF6EF]" : "hover:bg-[#1E0F2B]/10 text-[#1E0F2B]"
        )}
        title="Télécharger">
        <Download className="w-4 h-4" />
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
//  ⭐ V3.4 — PANNEAU DES MEMBRES DU CANAL (façon Telegram / WhatsApp)
// ═══════════════════════════════════════════════════════════════════════
// « Dans Telegram, dans WhatsApp, on arrive à voir les membres d'un groupe,
//  d'un canal. Et aussi voir qui sont les administrateurs. Avec la
//  possibilité de pouvoir envoyer des messages en privé à ce membre ou bien
//  faire des vocales » — implémentation intégrale :
//   • liste COMPLETE des membres (recherche par nom) ;
//   • sections Administrateurs / Membres (comme Telegram) ;
//   • badges de rôle (rôle DANS le canal + rôle global pasteur/animateur) ;
//   • présence réelle (point vert, User.lastSeenAt < 90 s) ;
//   • « Membre depuis … » (date d'adhésion) ;
//   • actions par membre : ÉCRIRE EN PRIVÉ / APPELER (audio / vidéo) ;
//   • explication communautaire : le privé fait GRANDIR la communauté.
// ────────────────────────────────────────────────────────────────────────

/** Rôles de canal qui apparaissent dans la section « Administrateurs ». */
const MEMBERS_PANEL_ADMIN_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MODERATOR", "ANIMATOR",
]);

/** ⭐ V3.13 — Vrai si le membre est un admin DE FAÇON EFFECTIVE : rôle
 * DANS le canal OU rôle GLOBAL du compte. C'est ce qui place PAM et le
 * Pasteur Kongo (super admins du site, simples « MEMBER » de canal) dans
 * la section « Admin » de TOUS les canaux — « eux ne doivent pas être mis
 * dans la catégorie des membres comme ça » — demande explicite. */
function estAdminEffectif(p: { role?: unknown; userRole?: unknown }): boolean {
  return (
    MEMBERS_PANEL_ADMIN_ROLES.has(String(p.role ?? "")) ||
    MEMBERS_PANEL_ADMIN_ROLES.has(String(p.userRole ?? ""))
  );
}

/** ⭐ V3.13 — Rôle effectif d'un membre (canal OU global), pour la couleur
 * et le libellé du badge : le rôle global prime visuellement pour les
 * admins principaux. */
function roleEffectif(p: { role?: unknown; userRole?: unknown }): string {
  const global = String(p.userRole ?? "");
  if (MEMBERS_PANEL_ADMIN_ROLES.has(global)) return global;
  return String(p.role ?? "MEMBER");
}

/** Libellé FR d'un rôle DANS le canal (ChannelRole). */
function channelRoleLabelFr(role?: string): string {
  switch (role) {
    case "SUPER_ADMIN": return "Fondateur du canal";
    case "ADMIN": return "Administrateur";
    case "MODERATOR": return "Modérateur";
    case "ANIMATOR": return "Animateur";
    default: return "Membre";
  }
}

/** Libellé FR d'un rôle GLOBAL (UserRole) — badge « Pasteur », etc. */
function globalRoleLabelFr(role?: string): string | null {
  switch (role) {
    case "SUPER_ADMIN": return "Pasteur";
    case "ADMIN": return "Délégué";
    case "MODERATOR": return "Modération";
    case "ANIMATOR": return "Animateur";
    case "MEMBER_VERIFIED": return "Membre authentifié";
    default: return null;
  }
}

/** « Membre depuis … » en français court. */
function formatJoinedAtFr(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function MembersPanel({
  conversation, currentUserId, currentUserRole, dmBusy, blockBusy,
  onOpenDirectMessage, onCallMember, onOpenProfile, onToggleBlock, onInvited, onClose,
}: {
  conversation: ChatConversation;
  currentUserId: string;
  /** ⭐ V3.7 — Rôle GLOBAL de l'utilisateur connecté : dans les canaux
   * restreints (cercle des pasteurs), seuls les administrateurs principaux
   * (SUPER_ADMIN/ADMIN — PAM, Pasteur Kongo) peuvent inviter. */
  currentUserRole?: string;
  dmBusy: boolean;
  blockBusy: boolean;
  onOpenDirectMessage: (userId: string, name: string) => void;
  onCallMember: (userId: string, type: "audio" | "video", name?: string, avatarUrl?: string) => void;
  /** ⭐ V3.5 — Ouvre le profil complet du membre (bio, pays/ville…). */
  onOpenProfile: (userId: string) => void;
  /** ⭐ V3.5 — Bloque (true) / débloque (false) un membre. */
  onToggleBlock: (userId: string, name: string | undefined, block: boolean) => void;
  /** ⭐ V3.5 — Un membre a été invité → rafraîchir les conversations. */
  onInvited: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  // ⭐ V3.5 — Onglet actif du panneau : « Membres » (liste) ou « Inviter »
  // (membres de la communauté pas encore dans le canal — façon Telegram).
  const [tab, setTab] = useState<"members" | "invite">("members");
  // ⭐ V3.5 — Invitations : recherche + résultats + états d'invitation.
  const [inviteQuery, setInviteQuery] = useState("");
  const [invitable, setInvitable] = useState<Array<{
    userId: string; name: string; avatarUrl?: string; role?: string; isOnline: boolean;
  }>>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  // ⭐ V3.7 — Message d'erreur renvoyé par l'API d'invitation (ex. cercle
  // restreint), affiché en clair dans l'onglet « Inviter ».
  const [inviteError, setInviteError] = useState<string | null>(null);

  const participants = conversation.participants || [];
  const onlineCount = participants.filter(p => p.online).length;

  // Recherche insensible à la casse sur le nom.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? participants.filter(p => (p.name || "").toLowerCase().includes(q))
    : participants;

  // Ordre : administrateurs en premier, puis les membres ; dans chaque
  // section, les EN LIGNE remontent avant les hors-ligne, puis ordre alpha.
  const bySection = (list: typeof participants) =>
    [...list].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "", "fr");
    });

  // ⭐ V3.13 — Admin EFFECTIF = rôle de canal OU rôle GLOBAL : les super
  // admins du site (PAM, Pasteur Kongo) figurent dans la section « Admin »
  // de TOUS les canaux, même membres simples du canal.
  const admins = bySection(filtered.filter(p => estAdminEffectif(p)));
  const regulars = bySection(filtered.filter(p => !estAdminEffectif(p)));

  // Invitations possibles dans les canaux/groupes — PAS dans un privé à 2.
  const isDirect = conversation.type === "DIRECT" && participants.length <= 2;

  // ⭐ V3.7 — CERCLE RESTREINT (cercle des pasteurs) : seuls les
  // administrateurs principaux (super admins — PAM, Pasteur Kongo — et
  // admins) peuvent ajouter QUI ILS VEULENT ; les autres membres ne voient
  // même pas l'onglet « Inviter » (le serveur valide de son côté).
  const isCercle =
    conversation.isRestricted === true || conversation.type === "PASTORS";
  const cercleGuardian =
    currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";
  const inviteAllowed = !isDirect && (!isCercle || cercleGuardian);

  // Sécurité : si l'utilisateur n'a pas le droit d'inviter ici, on force
  // le retour sur l'onglet « Membres » (l'onglet est de toute façon masqué).
  useEffect(() => {
    if (!inviteAllowed && tab === "invite") setTab("members");
  }, [inviteAllowed, tab]);

  // ⭐ V3.5 — Chargement des membres INVITABLE (communauté du canal, pas
  // encore membres) avec debounce de recherche de 250 ms, uniquement quand
  // l'onglet « Inviter » est actif.
  useEffect(() => {
    if (tab !== "invite") return;
    let cancelled = false;
    setInviteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = api.url(
          `/api/yeshua-connect/conversations/${conversation.id}/invitable` +
          (inviteQuery.trim() ? `?q=${encodeURIComponent(inviteQuery.trim())}` : ""),
        );
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setInvitable([]);
          return;
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setInvitable(data);
      } catch {
        if (!cancelled) setInvitable([]);
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, conversation.id, inviteQuery]);

  /** ⭐ V3.5 — Invite UN membre dans le canal (bouton de l'onglet). */
  const inviteMember = async (userId: string, name: string) => {
    if (inviteBusyId) return;
    setInviteBusyId(userId);
    setInviteError(null);
    try {
      const res = await fetch(
        api.url(`/api/yeshua-connect/conversations/${conversation.id}/invite`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: [userId] }),
        },
      );
      if (!res.ok) {
        // ⭐ V3.7 — L'erreur du serveur s'affiche en clair (cercle restreint,
        // membre introuvable…) au lieu d'échouer en silence.
        let msg = "Invitation impossible — réessayez";
        try {
          const err = await res.json();
          if (err?.error) msg = String(err.error);
        } catch { /* réponse non-JSON */ }
        setInviteError(msg);
        return;
      }
      setInvitedIds((prev) => new Set(prev).add(userId));
      onInvited(); // rafraîchit le compteur « N membres » de l'en-tête
      void name; // nom disponible pour un toast futur côté parent
    } catch {
      setInviteError("Connexion impossible — réessayez");
    } finally {
      setInviteBusyId(null);
    }
  };

  /** Une rangée de membre (avatar, badges, présence) — cliquable vers le
   *  PROFIL COMPLET (bio, pays/ville, actions privées), comme Telegram. */
  const renderRow = (p: (typeof participants)[number]) => {
    const isMe = p.userId === currentUserId;
    // ⭐ V3.13 — Rôle EFFECTIF : canal OU global (les super admins du site
    // apparaissent comme admins dans TOUS les canaux) + super admin du
    // site → icône distinctive (couronne or).
    const estSuperAdminGlobal = String(p.userRole ?? "") === "SUPER_ADMIN";
    const effRole = roleEffectif(p);
    const globalLabel = globalRoleLabelFr(p.userRole || p.roleLabel || undefined);
    const chanLabel = channelRoleLabelFr(effRole);
    const roleColor = getRoleColor(effRole);
    return (
      <div key={p.userId} className="border-b border-stone-100/80 last:border-b-0">
        <button
          onClick={() => onOpenProfile(p.userId)}
          className={cn(
            "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-[#FAF6EF]/70",
            isMe && "bg-[#C9A227]/[0.06]"
          )}
          title={`Profil de ${p.name || "Membre"}`}
        >
          <div className="relative flex-shrink-0">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name}
                className="w-10 h-10 rounded-full object-cover border border-[#C9A227]/30" />
            ) : (
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm", getAvatarColor(p.name || "?"))}>
                {getInitials(p.name || "?")}
              </div>
            )}
            {/* ⭐ V3.13 — Icône DISTINCTIVE des super admins du site
                (PAM, Pasteur Kongo) : couronne or en badge sur l'avatar. */}
            {estSuperAdminGlobal && (
              <span
                className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-[#C9A227] border-2 border-white flex items-center justify-center shadow-sm"
                title="Administrateur principal du Mouvement"
              >
                <Crown className="w-2.5 h-2.5 text-white" />
              </span>
            )}
            {/* Présence réelle (lastSeenAt < 90 s) */}
            {p.online ? (
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white",
                estSuperAdminGlobal && "-right-1.5"
              )} title="En ligne" />
            ) : (
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-stone-300 rounded-full border-2 border-white",
                estSuperAdminGlobal && "-right-1.5"
              )} title="Hors ligne" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1E0F2B] truncate flex items-center gap-1.5">
              <span className="truncate">{p.name || "Membre"}</span>
              {isMe && (
                <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-[#C9A227]/15 text-[#8C5FA8]">
                  Vous
                </span>
              )}
              {/* ⭐ V3.13 — Badge « Admin principal » : super admin du site. */}
              {estSuperAdminGlobal && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-[#C9A227]/20 text-[#8C5FA8]" title="Administrateur principal du Mouvement">
                  <Crown className="w-2.5 h-2.5 text-[#C9A227]" /> Admin
                </span>
              )}
              {/* ⭐ V3.5 — Badge « Bloqué » : je l'ai bloqué (badge discret,
                  déblocage depuis sa fiche profil). */}
              {p.blockedByMe && !isMe && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-red-100 text-red-700">
                  <Ban className="w-2.5 h-2.5" /> Bloqué
                </span>
              )}
            </p>
            <p className="text-xs text-[#8A8378] truncate flex items-center gap-1.5 mt-0.5">
              {/* Badge du rôle EFFECTIF (canal ou global) */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-px rounded-full font-semibold"
                style={{ backgroundColor: `${roleColor}18`, color: roleColor }}
              >
                {estAdminEffectif(p)
                  ? <Shield className="w-2.5 h-2.5" /> : null}
                {chanLabel}
              </span>
              {/* Badge du rôle GLOBAL (Pasteur…) si distinct et notable */}
              {globalLabel && !estAdminEffectif(p) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[#8C5FA8]/10 text-[#8C5FA8] font-semibold">
                  <Sparkles className="w-2.5 h-2.5" />{globalLabel}
                </span>
              )}
              {/* Statut de présence lisible */}
              <span className={cn("truncate", p.online && "text-emerald-600 font-medium")}>
                · {p.online ? "en ligne" : "hors ligne"}
              </span>
            </p>
          </div>
          {/* ⭐ V3.5 — Chevron : le clic ouvre le PROFIL COMPLET (bio,
              pays/ville, actions privées, blocage) — comme Telegram. */}
          <ChevronRight className="w-4 h-4 text-[#8A8378]/70 flex-shrink-0" />
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-[#1A0826]/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── En-tête du panneau : identité du canal + stats ─────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-[#C9A227]/15 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                {conversation.avatarUrl ? (
                  <img src={conversation.avatarUrl} alt={conversation.name}
                    className="w-11 h-11 rounded-full object-cover border border-[#C9A227]/30" />
                ) : (
                  <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm", getAvatarColor(conversation.name))}>
                    {getInitials(conversation.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#1E0F2B] text-base truncate">{conversation.name}</h3>
                <p className="text-xs text-[#8A8378] flex items-center gap-1.5">
                  <Users2 className="w-3 h-3 text-[#C9A227]/70" />
                  {participants.length} membres
                  {onlineCount > 0 && (
                    <span className="text-emerald-600 font-medium">· {onlineCount} en ligne</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* ⭐ V3.5 — Inviter des membres DEPUIS le panneau (façon
                  Telegram) : ouvre l'onglet d'invitation. Masqué dans un
                  privé (un privé s'ouvre par « Message privé ») et — ⭐ V3.7 —
                  dans les canaux RESTREINTS pour les non-administrateurs
                  principaux (cercle des pasteurs : eux seuls ajoutent). */}
              {inviteAllowed && (
                <button
                  onClick={() => setTab(tab === "invite" ? "members" : "invite")}
                  className={cn(
                    "p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors",
                    tab === "invite"
                      ? "bg-[#C9A227]/15 text-[#8C5FA8]"
                      : "hover:bg-[#C9A227]/10 text-[#8C5FA8]"
                  )}
                  title={
                    isCercle
                      ? "Ajouter qui vous voulez dans ce cercle restreint (toute la plateforme)"
                      : "Inviter des membres de la communauté dans ce canal"
                  }
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Inviter</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8A8378]"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ⭐ V3.5 — Onglets Membres / Inviter (invitations visibles
              uniquement hors privé). ⭐ V3.7 — Dans un canal RESTREINT
              (cercle des pasteurs), seuls les administrateurs principaux
              voient l'onglet « Inviter » ; les autres membres lisent la
              note « cercle restreint ». */}
          {inviteAllowed && (
            <div className="mt-3 flex gap-1 p-1 bg-stone-100/70 rounded-xl">
              <button
                onClick={() => setTab("members")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  tab === "members" ? "bg-white shadow-sm text-[#1E0F2B]" : "text-[#8A8378] hover:text-[#1E0F2B]"
                )}
              >
                Membres ({participants.length})
              </button>
              <button
                onClick={() => setTab("invite")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                  tab === "invite" ? "bg-white shadow-sm text-[#1E0F2B]" : "text-[#8A8378] hover:text-[#1E0F2B]"
                )}
              >
                <UserPlus className="w-3.5 h-3.5" /> Inviter
              </button>
            </div>
          )}

          {/* ⭐ V3.7 — Cercle restreint : note explicative pour les membres
              NON habilités (l'invitation est réservée aux administrateurs
              principaux — PAM, Pasteur Kongo, admins). */}
          {isDirect === false && isCercle && !cercleGuardian && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#2A0E3D]/[0.04] border border-[#2A0E3D]/10">
              <Lock className="w-3.5 h-3.5 text-[#8C5FA8] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#8A8378] leading-snug">
                <b className="text-[#1E0F2B]">Cercle restreint</b> — seuls les
                administrateurs principaux peuvent ajouter des membres dans ce
                canal.
              </p>
            </div>
          )}

          {/* Recherche (comme Telegram : filtre la liste par nom) —
              champ propre à chaque onglet. */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={tab === "invite" ? inviteQuery : query}
              onChange={e => (tab === "invite" ? setInviteQuery(e.target.value) : setQuery(e.target.value))}
              placeholder={
                tab === "invite"
                  ? isCercle
                    ? "Rechercher un membre (toute la plateforme)…"
                    : "Rechercher à inviter (communauté)…"
                  : "Rechercher un membre…"
              }
              className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 focus:border-[#C9A227]/40"
            />
            {(tab === "invite" ? inviteQuery : query) && (
              <button
                onClick={() => (tab === "invite" ? setInviteQuery("") : setQuery(""))}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
                aria-label="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ─── Onglet INVITER : membres de la communauté pas encore là ── */}
        {tab === "invite" && (
          <div className="flex-1 overflow-y-auto">
            {/* ⭐ V3.7 — Bandeau de contexte du cercle restreint : les
                administrateurs principaux ajoutent qui ils veulent. */}
            {isCercle && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/25 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#8A8378] leading-snug">
                  <b className="text-[#1E0F2B]">Cercle restreint</b> — en tant
                  qu’administrateur principal, vous ajoutez <b className="text-[#1E0F2B]">qui
                  vous voulez</b> : tout membre de la plateforme peut rejoindre ce
                  cercle.
                </p>
              </div>
            )}
            {inviteError && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                <Ban className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-700 leading-snug">{inviteError}</p>
              </div>
            )}
            {inviteLoading && invitable.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
                <p className="text-xs text-[#8A8378]">Recherche des membres invitable…</p>
              </div>
            )}
            {!inviteLoading && invitable.length === 0 && (
              <div className="py-10 px-4 text-center">
                <UserCheck className="w-8 h-8 text-[#C9A227]/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1E0F2B]">
                  {inviteQuery.trim() ? "Aucun membre trouvé" : "Tous les membres sont déjà ici"}
                </p>
                <p className="text-xs text-[#8A8378] mt-1">
                  {inviteQuery.trim()
                    ? "Essayez un autre nom"
                    : isCercle
                      ? "Toute la plateforme est déjà dans ce cercle 🙌"
                      : "La communauté entière est déjà dans ce canal 🙌"}
                </p>
              </div>
            )}
            {invitable.map((u) => {
              const invited = invitedIds.has(u.userId);
              const busy = inviteBusyId === u.userId;
              return (
                <div
                  key={u.userId}
                  className="px-3 py-2.5 flex items-center gap-3 border-b border-stone-100/80 last:border-b-0 hover:bg-[#FAF6EF]/60 transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#C9A227]/30" />
                    ) : (
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm", getAvatarColor(u.name || "?"))}>
                        {getInitials(u.name || "?")}
                      </div>
                    )}
                    {u.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" title="En ligne" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E0F2B] truncate">{u.name || "Membre"}</p>
                    <p className="text-xs text-[#8A8378] truncate">
                      {globalRoleLabelFr(u.role) ||
                        (isCercle ? "Membre de la plateforme" : "Membre de la communauté")}
                      {u.isOnline && <span className="text-emerald-600 font-medium"> · en ligne</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => inviteMember(u.userId, u.name)}
                    disabled={invited || !!inviteBusyId}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95",
                      invited
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] disabled:opacity-40"
                    )}
                    title={invited ? "Invité ✓" : `Inviter ${u.name || "ce membre"} dans le canal`}
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : invited ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    {invited ? "Invité" : "Inviter"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Onglet MEMBRES : Administrateurs puis Membres ────────── */}
        {tab === "members" && (
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="py-10 px-4 text-center">
                <Search className="w-8 h-8 text-[#C9A227]/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1E0F2B]">Aucun membre trouvé</p>
                <p className="text-xs text-[#8A8378] mt-1">Essayez un autre nom</p>
              </div>
            )}
            {admins.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-[#8A8378] uppercase tracking-wider sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-[#C9A227]" /> Administrateurs
                  <span className="ml-auto font-semibold normal-case">{admins.length}</span>
                </div>
                {admins.map(renderRow)}
              </>
            )}
            {regulars.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-[#8A8378] uppercase tracking-wider sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-[#C9A227]/70" /> Membres
                  <span className="ml-auto font-semibold normal-case">{regulars.length}</span>
                </div>
                {regulars.map(renderRow)}
              </>
            )}
          </div>
        )}

        {/* ─── Pied : vocation communautaire ──────────────────────────── */}
        <div className="px-4 py-3 border-t border-[#C9A227]/15 bg-[#FAF6EF]">
          {tab === "invite" ? (
            isCercle ? (
              <p className="text-[11px] text-[#8A8378] flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-0.5" />
                <span>
                  Cercle restreint : vous ajoutez <b className="text-[#1E0F2B]">qui vous
                  voulez</b>, sur toute la plateforme — « Prenez garde à
                  tout le troupeau » (Actes 20:28) : le cercle garde son
                  <b className="text-[#1E0F2B]"> caractère restreint</b>.
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-[#8A8378] flex items-start gap-2">
                <UserPlus className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-0.5" />
                <span>
                  Invitez les membres de la communauté dans ce canal — « Allez, faites de
                  toutes les nations des disciples » (Matthieu 28:19) : chaque invitation
                  fait <b className="text-[#1E0F2B]">grandir la communauté</b>.
                </span>
              </p>
            )
          ) : (
            <p className="text-[11px] text-[#8A8378] flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <span>
                Touchez un membre pour découvrir son <b className="text-[#1E0F2B]">profil</b>, lui
                <b className="text-[#1E0F2B]"> écrire en privé</b> ou
                l'<b className="text-[#1E0F2B]">appeler</b> — « qu'ils soient unis » (Jean 17:23) :
                les liens personnels font grandir la communauté.
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V3.5 — PROFIL COMPLET D'UN MEMBRE (au clic dans le panneau)
// ═══════════════════════════════════════════════════════════════════════
// « ou profil complet au clic (bio, pays/ville) » — la fiche façon
// Telegram : identité + badges + présence, bio, localisation (drapeau),
// « membre depuis », canaux communs, et les actions :
//   • Message privé / Appel vocal / Appel vidéo ;
//   • Bloquer / Débloquer (sécurité des privés — le blocage coupe les DM
//     et les appels dans les DEUX sens, les canaux communs restent ouverts).
// ────────────────────────────────────────────────────────────────────────

/** Résultat de GET /api/yeshua-connect/members/:userId/profile. */
interface MemberProfileData {
  userId: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  country?: string;
  city?: string;
  role?: string;
  isOnline: boolean;
  memberSince: string;
  sharedChannels: Array<{ id: string; name: string; avatarUrl?: string; type: string }>;
  blockedByMe: boolean;
  hasBlockedMe: boolean;
}

/** Drapeau du pays d'un membre : User.country est un texte libre (« Bénin »,
 *  « France »…) ou parfois un code ISO (« BJ ») — on résout les deux. */
function memberCountryFlag(country?: string): string {
  if (!country) return "";
  const c = country.trim();
  if (/^[a-zA-Z]{2}$/.test(c)) return flagFromCountryCode(c.toUpperCase());
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hit = COUNTRIES.find((co) => norm(co.name) === norm(c));
  return hit ? flagFromCountryCode(hit.code) : "";
}

function MemberProfileModal({
  userId, currentUserId, dmBusy, blockBusy,
  onOpenDirectMessage, onCallMember, onToggleBlock, onClose,
}: {
  userId: string;
  currentUserId: string;
  originConversationId: string;
  dmBusy: boolean;
  blockBusy: boolean;
  onOpenDirectMessage: (userId: string, name: string) => void;
  onCallMember: (userId: string, type: "audio" | "video", name?: string, avatarUrl?: string) => void;
  onToggleBlock: (userId: string, name: string | undefined, block: boolean) => void;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement du profil (annulable si le modal se referme).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    fetch(api.url(`/api/yeshua-connect/members/${userId}/profile`))
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error || "Profil indisponible");
        }
        return res.json() as Promise<MemberProfileData>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Profil indisponible");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isMe = profile?.userId === currentUserId;
  const globalLabel = profile ? globalRoleLabelFr(profile.role) : null;
  const flag = profile ? memberCountryFlag(profile.country) : "";
  const location = profile
    ? [profile.country, profile.city].filter(Boolean).join(", ")
    : "";

  return (
    <div
      className="fixed inset-0 bg-[#1A0826]/60 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── En-tête : grande photo, nom, badges, présence ─────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-[#C9A227]/15 bg-[#FAF6EF] relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/70 text-[#8A8378]"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
              <p className="text-xs text-[#8A8378]">Chargement du profil…</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1E0F2B]">Profil indisponible</p>
              <p className="text-xs text-[#8A8378] mt-1">{error}</p>
            </div>
          ) : profile ? (
            <div className="flex items-center gap-4 pr-8">
              <div className="relative flex-shrink-0">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#C9A227]/40" />
                ) : (
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm", getAvatarColor(profile.name || "?"))}>
                    {getInitials(profile.name || "?")}
                  </div>
                )}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] border-[#FAF6EF]",
                    profile.isOnline ? "bg-emerald-500" : "bg-stone-300"
                  )}
                  title={profile.isOnline ? "En ligne" : "Hors ligne"}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#1E0F2B] text-lg leading-tight truncate flex items-center gap-2">
                  <span className="truncate">{profile.name}</span>
                  {isMe && (
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-[#C9A227]/15 text-[#8C5FA8]">
                      Vous
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {/* ⭐ V3.13 — Badge DISTINCTIF des administrateurs principaux
                      (super admins du site — PAM, Pasteur Kongo) : couronne
                      or + « Admin principal », avant tout autre badge. */}
                  {profile.role === "SUPER_ADMIN" && (
                    <span className="inline-flex items-center gap-1 px-2 py-px rounded-full bg-[#C9A227]/15 text-[#8C5FA8] text-[10px] font-bold border border-[#C9A227]/40" title="Administrateur principal du Mouvement">
                      <Crown className="w-3 h-3 text-[#C9A227]" /> Admin principal
                    </span>
                  )}
                  {globalLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-px rounded-full bg-[#8C5FA8]/10 text-[#8C5FA8] text-[10px] font-semibold">
                      <Sparkles className="w-2.5 h-2.5" />{globalLabel}
                    </span>
                  )}
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium",
                    profile.isOnline ? "text-emerald-600" : "text-[#8A8378]"
                  )}>
                    · {profile.isOnline ? "en ligne" : "hors ligne"}
                  </span>
                </div>
                <p className="text-[11px] text-[#8A8378] mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Membre depuis {formatJoinedAtFr(profile.memberSince)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ─── Corps scrollable : localisation, bio, canaux communs ──── */}
        {profile && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Localisation (pays + ville, avec drapeau) */}
            {location && (
              <div className="bg-white border border-[#C9A227]/20 rounded-xl px-3 py-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                <span className="text-sm text-[#1E0F2B] flex items-center gap-1.5 min-w-0">
                  {flag && <span className="text-base leading-none" aria-hidden>{flag}</span>}
                  <span className="truncate">{location}</span>
                </span>
              </div>
            )}

            {/* Bio (renseignée par le membre dans ses paramètres) */}
            {profile.bio ? (
              <div className="bg-white border border-[#C9A227]/20 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-[#8A8378] uppercase tracking-wider mb-1">Bio</p>
                <p className="text-sm text-[#1E0F2B] whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
              </div>
            ) : (
              <div className="bg-white/70 border border-[#C9A227]/10 rounded-xl px-3 py-2">
                <p className="text-xs text-[#8A8378]">
                  {isMe
                    ? "Ajoutez votre bio et votre localisation depuis le bouton profil de la barre latérale."
                    : "Ce membre n'a pas encore partagé sa bio."}
                </p>
              </div>
            )}

            {/* Canaux communs (« vous êtes tous les deux dans… ») */}
            {profile.sharedChannels.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#8A8378] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Users2 className="w-3 h-3 text-[#C9A227]/70" />
                  {isMe ? "Vos canaux" : "Canaux en commun"} ({profile.sharedChannels.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.sharedChannels.slice(0, 6).map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-[#FAF6EF] border border-[#C9A227]/20 text-[11px] font-semibold text-[#1E0F2B] max-w-[10rem]"
                    >
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <Hash className="w-3 h-3 text-[#C9A227] flex-shrink-0" />
                      )}
                      <span className="truncate">{c.name}</span>
                    </span>
                  ))}
                  {profile.sharedChannels.length > 6 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-stone-100 text-[11px] font-semibold text-[#8A8378]">
                      +{profile.sharedChannels.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ─── Bannière de blocage (si J'AI bloqué ce membre) ────── */}
            {profile.blockedByMe && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-700">Membre bloqué</p>
                  <p className="text-[11px] text-red-600/90 mt-0.5">
                    {profile.name} ne peut plus vous écrire en privé ni vous appeler.
                    Les canaux communs restent ouverts.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Actions (pied) ─────────────────────────────────────────── */}
        {profile && !isMe && (
          <div className="px-4 py-3 border-t border-[#C9A227]/15 bg-[#FAF6EF] space-y-2">
            {profile.blockedByMe ? (
              /* Bloqué par moi → un seul geste : débloquer. */
              <button
                onClick={() => onToggleBlock(profile.userId, profile.name, false)}
                disabled={blockBusy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {blockBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Débloquer ce membre
              </button>
            ) : profile.hasBlockedMe ? (
              /* Il m'a bloqué → contact privé indisponible, SANS révéler
                 explicitement le blocage (discrétion, comme Telegram). */
              <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/70 border border-stone-200 text-[#8A8378] text-xs font-semibold">
                <UserX className="w-4 h-4" />
                Ce membre ne peut pas être contacté en privé actuellement
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => onOpenDirectMessage(profile.userId, profile.name)}
                    disabled={dmBusy}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl bg-[#8C5FA8] text-[#FAF6EF] text-[11px] font-semibold hover:bg-[#7A4E96] active:scale-95 transition-all disabled:opacity-40"
                    title={`Ouvrir une conversation privée avec ${profile.name}`}
                  >
                    {dmBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    Message privé
                  </button>
                  <button
                    onClick={() => onCallMember(profile.userId, "audio", profile.name, profile.avatarUrl)}
                    disabled={dmBusy}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40"
                    title={`Appel audio privé avec ${profile.name}`}
                  >
                    <Phone className="w-4 h-4" />
                    Appel vocal
                  </button>
                  <button
                    onClick={() => onCallMember(profile.userId, "video", profile.name, profile.avatarUrl)}
                    disabled={dmBusy}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-[11px] font-semibold hover:bg-[#3A1E4D] active:scale-95 transition-all disabled:opacity-40"
                    title={`Appel vidéo privé avec ${profile.name}`}
                  >
                    <Video className="w-4 h-4" />
                    Appel vidéo
                  </button>
                </div>
                {/* ⭐ V3.5 — Blocage : coupe les privés (messages + appels),
                    les canaux communs restent ouverts. */}
                <button
                  onClick={() => onToggleBlock(profile.userId, profile.name, true)}
                  disabled={blockBusy}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-40"
                  title={`Bloquer ${profile.name} : il ne pourra plus vous écrire en privé ni vous appeler`}
                >
                  {blockBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  Bloquer ce membre
                </button>
              </>
            )}
            <p className="text-[10px] text-[#8A8378]/80 text-center">
              Le blocage coupe uniquement les échanges privés — les canaux de la
              communauté restent ouverts.
            </p>
          </div>
        )}

        {/* Fiche « soi-même » : rappel du chemin de modification. */}
        {profile && isMe && (
          <div className="px-4 py-3 border-t border-[#C9A227]/15 bg-[#FAF6EF]">
            <p className="text-[11px] text-[#8A8378] flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <span>
                C'est vous 😉 Photo, bio, pays et ville se modifient via le bouton
                profil de la barre latérale.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
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
  variant,
}: {
  content: string;
  memberNames: string[];
  isMine: boolean;
  /** ⭐ V2.8 — "purple" (moi/admin) ou "gold" (autres) : mentions lisibles */
  variant?: "purple" | "gold";
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
              variant === "purple"
                ? "bg-[#FAF6EF]/25 text-[#FAF6EF]"
                : "bg-[#1E0F2B]/15 text-[#1E0F2B]"
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
  variant,
}: {
  text: string;
  memberNames: string[];
  isMine: boolean;
  variant?: "purple" | "gold";
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
          ? "bg-[#8A8378]/25 text-inherit"
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
          variant={variant}
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
  variant,
}: {
  text: string;
  memberNames: string[];
  isMine: boolean;
  variant?: "purple" | "gold";
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
          variant={variant}
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
        variant={variant}
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
        variant={variant}
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
  variant,
}: {
  content: string;
  memberNames: string[];
  isMine: boolean;
  variant?: "purple" | "gold";
}) {
  if (!content) return null;

  // Si pas de ``` dans le contenu, on court-circuite (parse juste les spoilers)
  if (!content.includes("```")) {
    return <TextWithSpoilers text={content} memberNames={memberNames} isMine={isMine} variant={variant} />;
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
          variant={variant}
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
        variant={variant}
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
//  ⭐ V2.7 — VOICE CHANNEL VIEW (canal vocal persistant, mode audio/vidéo)
// ═══════════════════════════════════════════════════════════════════════
//
// Bascule « façon WhatsApp » (décidée par l'ADMINISTRATEUR) :
//   - mode AUDIO  : liste des participants avec leurs PHOTOS réelles.
//   - mode VIDÉO  : grille de tuiles vidéo (caméras de tous les participants
//     actives) — tuile = vidéo + nom + statut micro + photo si caméra coupée.
//   - Le switch est visible par TOUT LE MONDE en même temps (métadonnées
//     de la room LiveKit propagées en temps réel par /voice-mode).
//
// Photos : métadonnées du token LiveKit (JSON { avatarUrl }) en priorité,
// fallback sur la liste des membres du canal (User.avatarUrl en base).
// Pam et Pasteur Kongo ont leurs VRAIES photos (synchronisées depuis
// Servant.portraitUrl).

/** Rôles autorisés à basculer le mode du canal vocal. */
const VOICE_MODE_ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ANIMATOR",
]);

/** Avatar rond avec photo réelle ou initiales colorées + point de présence. */
function VoiceAvatar({
  name,
  avatarUrl,
  size = 40,
  speaking = false,
  muted = false,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
  speaking?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex-shrink-0 rounded-full transition-shadow",
        speaking && "ring-2 ring-[#C9A227] ring-offset-1 ring-offset-white",
      )}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
        />
      ) : (
        <div
          className={cn(
            "w-full h-full rounded-full flex items-center justify-center text-white font-bold",
            getAvatarColor(name),
            speaking && "ring-2 ring-[#C9A227]",
          )}
          style={{ fontSize: size / 2.8 }}
        >
          {getInitials(name)}
        </div>
      )}
      {/* ⭐ V2.9 — Point de présence dynamique : vert = micro actif et
          connecté ; neutre = micro coupé (l'état se met à jour en direct
          grâce aux événements TrackMuted/TrackUnmuted). */}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white",
          speaking ? "w-3.5 h-3.5 bg-[#C9A227]" : muted ? "w-2.5 h-2.5 bg-[#8A8378]" : "w-2.5 h-2.5 bg-green-500",
        )}
      />
    </div>
  );
}

/**
 * Tuile vidéo d'un participant distant — attache le track caméra publié
 * au <video> (re-attache à chaque changement de publication/état).
 */
function ParticipantVideoTile({
  participant,
  avatarUrl,
}: {
  participant: RemoteParticipant;
  avatarUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const name = participant.name || participant.identity || "?";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub?.track && pub.isSubscribed) {
      pub.track.attach(el);
      setHasVideo(true);
    } else {
      setHasVideo(false);
    }
    return () => {
      const currentPub = participant.getTrackPublication(Track.Source.Camera);
      if (currentPub?.track) {
        try { currentPub.track.detach(el); } catch {}
      }
    };
  }, [participant, participant.isCameraEnabled]);

  return (
    <div className="relative bg-[#2A0E3D] rounded-2xl overflow-hidden aspect-video flex items-center justify-center group">
      {/* Vidéo (si caméra active) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn("w-full h-full object-cover", !hasVideo && "hidden")}
        style={{ transform: "scaleX(-1)" }}
      />
      {/* Photo / initiales si caméra coupée */}
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2 py-4">
          <VoiceAvatar
            name={name}
            avatarUrl={avatarUrl}
            size={64}
            muted={!participant.isMicrophoneEnabled}
          />
          <span className="text-[10px] text-[#FAF6EF]/60">Caméra inactive</span>
        </div>
      )}
      {/* Badge nom + micro */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm">
        <span className="text-[11px] font-semibold text-white truncate">{name}</span>
        {participant.isMicrophoneEnabled ? (
          <Mic className="w-3 h-3 text-[#C9A227] flex-shrink-0" />
        ) : (
          <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

function VoiceChannelView({
  conv,
  connected,
  remoteParticipants,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserRole,
  localAudioMuted,
  localVideoEnabled,
  speakerEnabled,
  error,
  videoMode,
  modeSwitching,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onSwitchMode,
  room,
  channelMembers,
  channelDirect,
  directSwitching,
  onStartDirect,
  onStopDirect,
  activeSpeakerIds,
  audioPlaybackBlocked,
  onUnlockAudio,
  voiceReconnecting,
  jitsiActive,
  onStartJitsi,
  onStopJitsi,
}: {
  conv: ChatConversation;
  connected: boolean;
  remoteParticipants: RemoteParticipant[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  currentUserRole?: string;
  localAudioMuted: boolean;
  localVideoEnabled: boolean;
  speakerEnabled: boolean;
  error: string | null;
  videoMode: boolean;
  modeSwitching: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onSwitchMode: (mode: "audio" | "video") => void;
  room: Room | null;
  channelMembers: Array<{ userId: string; name: string; role?: string; userRole?: string; avatarUrl?: string }>;
  /** ⭐ V3.1 — Direct INTRA-CANAL en cours (null si aucun). */
  channelDirect?: { by: string; byAvatar?: string; isMe: boolean } | null;
  directSwitching?: boolean;
  onStartDirect?: () => void;
  onStopDirect?: () => void;
  activeSpeakerIds?: Set<string>;
  audioPlaybackBlocked?: boolean;
  onUnlockAudio?: () => void;
  voiceReconnecting?: boolean;
  /** ⭐ V3.19 — Plan C : repli Jitsi du canal vocal (LiveKit indisponible). */
  jitsiActive?: boolean;
  onStartJitsi?: () => void;
  onStopJitsi?: () => void;
}) {
  // L'admin du site OU l'admin du canal peut basculer le mode audio ↔ vidéo.
  const myChannelRole = channelMembers.find(m => m.userId === currentUserId)?.role;
  const canSwitchMode =
    VOICE_MODE_ADMIN_ROLES.has(currentUserRole || "") ||
    VOICE_MODE_ADMIN_ROLES.has(myChannelRole || "");

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#2A0E3D]/5 to-[#FAF6EF]/30">
      {/* ─── Bandeau mode + bascule admin ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#C9A227]/20 bg-white/70 backdrop-blur-sm flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {videoMode ? (
            <Video className="w-4 h-4 text-[#8C5FA8] flex-shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#1E0F2B] truncate">{conv.name}</h3>
            <p className="text-[10px] text-[#8A8378]">
              {videoMode ? "Mode vidéo · " : "Mode audio · "}
              {conv.participants.length} membres
            </p>
          </div>
        </div>

        {/* Bascule réservée aux administrateurs (mode WhatsApp) */}
        {canSwitchMode ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#FAF6EF] border border-[#8A8378]/25 rounded-full p-0.5">
              <button
                onClick={() => onSwitchMode("audio")}
                disabled={modeSwitching || !videoMode}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all",
                  !videoMode
                    ? "bg-[#1E0F2B] text-[#FAF6EF] shadow"
                    : "text-[#8A8378] hover:text-[#1E0F2B]",
                )}
                title="Tout le monde passera en audio"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Audio
              </button>
              <button
                onClick={() => onSwitchMode("video")}
                disabled={modeSwitching || videoMode}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all",
                  videoMode
                    ? "bg-[#8C5FA8] text-white shadow"
                    : "text-[#8A8378] hover:text-[#1E0F2B]",
                )}
                title="Tout le monde passera en vidéo"
              >
                <Video className="w-3.5 h-3.5" />
                Vidéo
              </button>
            </div>
            {modeSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A227]" />}
          </div>
        ) : (
          /* Indicateur du mode courant pour les non-admins */
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EF] border border-[#8A8378]/25 text-[11px] font-bold text-[#8A8378]">
            {videoMode ? <Video className="w-3.5 h-3.5 text-[#8C5FA8]" /> : <Volume2 className="w-3.5 h-3.5 text-[#C9A227]" />}
            {videoMode ? "Canal en vidéo" : "Canal en audio"}
          </span>
        )}
      </div>

      {/* ─── ⭐ V3.1 — DIRECT INTRA-CANAL EN COURS : bandeau vert clignotant
          + photo du diffuseur (demande explicite V2.9 : « le bouton soit en
          vert avec l'icône diffusion qui clignote, avec la photo de celui
          qui a lancé le direct ») — MAIS le direct vit DANS le canal
          (demande V3.1 : « c'est un direct au sein du canal et non un
          direct live dans le module live ») : aucun lien /live/..., on
          REJOINT le canal pour écouter/diffuser. */}
      {channelDirect && (
        <div className="mx-4 mt-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-600/95 to-emerald-500/95 text-white shadow-lg">
          <span className="relative flex-shrink-0">
            {channelDirect.byAvatar ? (
              <img
                src={channelDirect.byAvatar}
                alt={channelDirect.by}
                className="w-11 h-11 rounded-full object-cover border-2 border-white/90"
              />
            ) : (
              <span className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center">
                <Users2 className="w-5 h-5" />
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
              <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-black tracking-wider uppercase">
                <Radio className="w-3 h-3 animate-pulse" />Direct du canal
              </span>
            </span>
            <span className="block text-sm font-bold truncate mt-0.5">
              {channelDirect.isMe ? "Vous êtes en direct" : `Diffusion de ${channelDirect.by}`}
            </span>
            <span className="block text-[11px] text-white/80 truncate">
              {channelDirect.isMe
                ? "Votre audio/vidéo est diffusé aux membres du canal"
                : connected ? "Vous écoutez la diffusion du canal" : "Rejoignez le canal pour écouter"}
            </span>
          </span>
          {/* Actions : Rejoindre (si pas connecté) / Arrêter (admin) */}
          <span className="flex items-center gap-2 flex-shrink-0">
            {!connected && (
              <button
                onClick={onJoin}
                className="px-3.5 py-2 rounded-lg bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
              >
                Rejoindre
              </button>
            )}
            {canSwitchMode && onStopDirect && (
              <button
                onClick={onStopDirect}
                disabled={directSwitching}
                className="px-3.5 py-2 rounded-lg bg-black/25 border border-white/40 text-white text-xs font-bold hover:bg-black/35 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                title="Arrêter la diffusion du canal"
              >
                {directSwitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                Arrêter
              </button>
            )}
          </span>
        </div>
      )}

      {/* ─── ⭐ V2.9 — Son bloqué par le navigateur (autoplay) : bouton de
          déblocage explicite, comme Google Meet. */}
      {connected && audioPlaybackBlocked && (
        <button
          onClick={onUnlockAudio}
          className="mx-4 mt-3 flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <VolumeX className="w-5 h-5 flex-shrink-0" />
          <span className="text-left flex-1">
            Le son est coupé par votre navigateur
            <span className="block text-[10px] font-medium text-amber-700">Cliquez ici pour entendre les autres participants</span>
          </span>
          <Volume2 className="w-4 h-4 flex-shrink-0" />
        </button>
      )}

      {/* ─── ⭐ V2.9 — Reconnexion réseau en cours (transparence). */}
      {connected && voiceReconnecting && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/30 text-xs text-[#1E0F2B] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A227] flex-shrink-0" />
          Reconnexion au canal en cours…
        </div>
      )}

      {/* ─── Erreur éventuelle ─────────────────────────────────────── */}
      {error && !jitsiActive && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          {onStartJitsi && (
            <button
              onClick={onStartJitsi}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E0F2B] text-[#FAF6EF] text-[11px] font-bold hover:bg-[#2A0E3D] transition-colors shadow-sm"
              title="Rejoindre le canal en visio de secours gratuite (Jitsi)"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-[#C9A227]" />
              Mode secours
            </button>
          )}
        </div>
      )}

      {/* ─── ⭐ V3.19 — Plan C : REPLI JITSI ACTIF (LiveKit Cloud et
          auto-hébergé indisponibles) : visio publique gratuite en iframe —
          room DÉTERMINISTE du canal, tous les membres qui prennent le mode
          secours s'y retrouvent. Quitter le secours revient au canal
          normal (rejoignable à nouveau si LiveKit revient). ──────────── */}
      {jitsiActive && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mx-4 mt-3 mb-1 flex items-center gap-2 p-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-xs font-bold shadow">
            <LifeBuoy className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              Canal vocal en mode secours (Jitsi) · {conv.name}
            </span>
            {onStopJitsi && (
              <button
                onClick={onStopJitsi}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/25 text-[#FAF6EF] text-[11px] font-bold hover:bg-white/20 transition-colors"
                title="Quitter le mode secours et revenir au canal normal"
              >
                <X className="w-3.5 h-3.5" />
                Quitter le secours
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 px-4 pb-4">
            <iframe
              src={jitsiUrlFor(jitsiRoomFor("voice", conv.id), currentUserName)}
              title="Canal vocal de secours Jitsi"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full rounded-2xl border border-[#C9A227]/30 bg-black"
            />
          </div>
        </div>
      )}

      {/* ─── Corps : en attente d'un direct OU participants ──────────── */}
      {jitsiActive ? null : !connected ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full">
            {conv.avatarUrl ? (
              <img
                src={conv.avatarUrl}
                alt={conv.name}
                className="w-20 h-20 mx-auto mb-4 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#2A0E3D] flex items-center justify-center text-white">
                {videoMode ? <Video className="w-10 h-10" /> : <Volume2 className="w-10 h-10" />}
              </div>
            )}
            <h3 className="text-lg font-bold text-[#1E0F2B] mb-1">{conv.name}</h3>
            <p className="text-xs text-[#8A8378] mb-6">
              Canal {videoMode ? "vidéo" : "vocal"} persistant · {conv.participants.length} membres au total
            </p>
            {/* ⭐ V3.2 — « Rejoindre le canal » SUPPRIMÉ (demande explicite) :
                les appels vocaux/vidéo couvrent les conversations entre
                membres, et le direct intra-canal couvre la diffusion. Les
                membres rejoignent via le bandeau vert « Rejoindre » quand
                un direct est en cours. */}
            {/* ⭐ V3.1 — « Lancer un direct » DANS LE CANAL (plus aucune
                redirection vers /admin/lives — le module Live est une autre
                chose) : l'admin démarre une diffusion intra-canal et
                rejoint automatiquement le canal pour diffuser. */}
            {canSwitchMode && onStartDirect ? (
              <button
                onClick={onStartDirect}
                disabled={directSwitching}
                className="w-full py-3 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55] flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-60"
              >
                {directSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                Lancer un direct dans le canal
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAF6EF] border border-[#C9A227]/25 flex flex-col items-center gap-2">
                <Radio className="w-5 h-5 text-[#8A8378]/60" />
                <p className="text-xs font-semibold text-[#1E0F2B]">Aucun direct en cours</p>
                <p className="text-[11px] text-[#8A8378] leading-relaxed">
                  Vous pourrez écouter la diffusion du canal ici dès qu&apos;un direct sera lancé.
                  Pour parler à un membre en privé, utilisez les appels (bouton téléphone du chat).
                </p>
              </div>
            )}
          </div>
        </div>
      ) : videoMode ? (
        /* ═══ MODE VIDÉO : grille de tuiles + controls ═══ */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto w-full">
              {/* Moi-même : tuile locale (miroir + label « Vous ») */}
              <div className="relative bg-[#2A0E3D] rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
                <LocalVideoTile room={room} enabled={localVideoEnabled} avatarUrl={currentUserAvatar} name={currentUserName} />
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-white truncate">
                    {currentUserName} <span className="text-[#C9A227]">(vous)</span>
                  </span>
                  {localAudioMuted ? (
                    <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />
                  ) : (
                    <Mic className="w-3 h-3 text-[#C9A227] flex-shrink-0" />
                  )}
                </div>
              </div>
              {/* Participants distants */}
              {remoteParticipants.map((p) => (
                <ParticipantVideoTile
                  key={p.identity}
                  participant={p}
                  avatarUrl={participantAvatarUrl(p, channelMembers)}
                />
              ))}
              {remoteParticipants.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[#8A8378]/25 rounded-2xl">
                  <Users2 className="w-8 h-8 text-[#C9A227]/50 mb-2" />
                  <p className="text-xs font-semibold text-[#1E0F2B]">Seul dans le canal</p>
                  <p className="text-[11px] text-[#8A8378] mt-0.5">
                    Les autres membres verront votre vidéo en rejoignant.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contrôles vidéo */}
          <div className="flex items-center justify-center gap-3 py-3 border-t border-[#C9A227]/20 bg-white/70 backdrop-blur-sm">
            <button
              onClick={onToggleMute}
              className={cn(
                "p-3 rounded-full transition-colors shadow-sm",
                localAudioMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
              )}
              title={localAudioMuted ? "Activer le micro" : "Couper le micro"}
            >
              {localAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={onToggleCamera}
              className={cn(
                "p-3 rounded-full transition-colors shadow-sm",
                localVideoEnabled ? "bg-[#8C5FA8] text-white hover:bg-[#7A4E96]" : "bg-red-500 text-white hover:bg-red-600"
              )}
              title={localVideoEnabled ? "Couper ma caméra" : "Activer ma caméra"}
            >
              {localVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={onToggleSpeaker}
              className={cn(
                "p-3 rounded-full transition-colors shadow-sm",
                speakerEnabled ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]" : "bg-[#8A8378] text-white hover:bg-[#757064]"
              )}
              title={speakerEnabled ? "Couper le haut-parleur" : "Activer le haut-parleur"}
            >
              {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={onLeave}
              className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
              title="Quitter le canal"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* ═══ MODE AUDIO : participants avec PHOTOS + contrôles ═══ */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-white rounded-2xl border border-[#8A8378]/15 shadow-sm p-4">
              <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider mb-3">
                Participants connectés ({remoteParticipants.length + 1})
              </p>
              <div className="space-y-2">
                {/* Moi-même (toujours connecté) */}
                <div className="flex items-center gap-3 p-2 bg-[#C9A227]/5 rounded-xl">
                  <VoiceAvatar
                    name={currentUserName}
                    avatarUrl={currentUserAvatar}
                    size={44}
                    muted={localAudioMuted}
                    speaking={activeSpeakerIds?.has(room?.localParticipant.identity || "")}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-[#1E0F2B] truncate">
                      {currentUserName} <span className="text-[10px] text-[#8A8378]">(vous)</span>
                    </p>
                    <p className="text-[10px] text-[#8A8378]">
                      {localAudioMuted ? "Micro coupé" : "Micro actif"}
                    </p>
                  </div>
                  {localAudioMuted && <MicOff className="w-4 h-4 text-red-500 flex-shrink-0" />}
                </div>
                {/* Participants distants — avec leurs VRAIES photos */}
                {remoteParticipants.length === 0 ? (
                  <p className="text-xs text-[#8A8378] text-center py-2">
                    En attente d&apos;autres participants...
                  </p>
                ) : (
                  remoteParticipants.map((p) => (
                    <div key={p.identity} className="flex items-center gap-3 p-2 bg-[#FAF6EF] rounded-xl">
                      <VoiceAvatar
                        name={p.name || p.identity || "?"}
                        avatarUrl={participantAvatarUrl(p, channelMembers)}
                        size={44}
                        muted={!p.isMicrophoneEnabled}
                        speaking={activeSpeakerIds?.has(p.identity)}
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: getRoleColor(channelMembers.find(m => m.userId === p.identity)?.role) }}
                        >
                          {p.name || p.identity}
                        </p>
                        <p className="text-[10px] text-[#8A8378]">
                          {p.isMicrophoneEnabled ? "Micro actif" : "Micro coupé"}
                        </p>
                      </div>
                      {!p.isMicrophoneEnabled && <MicOff className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Contrôles audio */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={onToggleMute}
                className={cn(
                  "p-3 rounded-full transition-colors shadow-sm",
                  localAudioMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]"
                )}
                title={localAudioMuted ? "Activer le micro" : "Couper le micro"}
              >
                {localAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={onToggleSpeaker}
                className={cn(
                  "p-3 rounded-full transition-colors shadow-sm",
                  speakerEnabled ? "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55]" : "bg-[#8A8378] text-white hover:bg-[#757064]"
                )}
                title={speakerEnabled ? "Couper le haut-parleur" : "Activer le haut-parleur"}
              >
                {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={onLeave}
                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                title="Quitter le canal vocal"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-[#8A8378] text-center mt-2">
              Le canal reste ouvert même si vous le quittez.
            </p>
          </div>
        </div>
      )}

      {/* ─── Membres du canal (info, les deux modes) ──────────────────── */}
      {channelMembers.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#8A8378]/15 bg-white/50">
          <div className="max-w-md mx-auto flex flex-wrap gap-1.5 justify-center">
            {channelMembers.slice(0, 10).map((m) => {
              // ⭐ V3.13 — Rôle effectif (canal OU global) : les super
              // admins du site portent la couronne or dans les canaux
              // vocaux aussi — « c'est pareil dans tous les canaux ».
              const superAdmin = String(m.userRole ?? "") === "SUPER_ADMIN";
              const roleColor = getRoleColor(roleEffectif(m));
              return (
                <span
                  key={m.userId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF6EF] border border-[#8A8378]/15 text-[10px] font-medium"
                  style={{ color: roleColor }}
                >
                  {superAdmin && (
                    <Crown className="w-3 h-3 text-[#C9A227]" aria-label="Administrateur principal" />
                  )}
                  {m.avatarUrl && (
                    <img src={m.avatarUrl} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                  )}
                  {m.name}
                </span>
              );
            })}
            {channelMembers.length > 10 && (
              <span className="text-[10px] text-[#8A8378] self-center">
                +{channelMembers.length - 10}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Tuile vidéo locale (miroir) — photo si la caméra est coupée. */
function LocalVideoTile({
  room,
  enabled,
  avatarUrl,
  name,
}: {
  room: Room | null;
  enabled: boolean;
  avatarUrl?: string;
  name: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!room || !el || !enabled) return;
    const localTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (localTrack?.track) {
      localTrack.track.attach(el);
    }
    return () => {
      if (localTrack?.track) {
        try { localTrack.track.detach(el); } catch {}
      }
    };
  }, [room, enabled]);

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <VoiceAvatar name={name} avatarUrl={avatarUrl} size={64} />
        <span className="text-[10px] text-[#FAF6EF]/60">Caméra coupée</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
      style={{ transform: "scaleX(-1)" }}
    />
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
  convAvatarUrl,
  endStatus,
  currentUserName,
  remoteParticipants,
  localAudioMuted,
  localVideoEnabled,
  speakerEnabled,
  error,
  room,
  p2pRemoteStream,
  p2pLocalStream,
  p2pConnectionState,
  jitsiRoom,
  jitsiUserName,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onHangup,
}: {
  callState: "outgoing" | "incoming" | "active";
  callType: "audio" | "video";
  convName: string;
  /** ⭐ V3.1 — photo de la conversation appelée (photo du canal, pas d'initiales). */
  convAvatarUrl?: string;
  /** ⭐ V3.1 — issue distante : declined/missed/cancelled/ended (affichée 2 s). */
  endStatus?: "declined" | "missed" | "ended" | "cancelled" | null;
  currentUserName: string;
  remoteParticipants: RemoteParticipant[];
  localAudioMuted: boolean;
  localVideoEnabled: boolean;
  speakerEnabled: boolean;
  error: string | null;
  room: Room | null;
  /** ⭐ V3.19 — Plan C : flux WebRTC P2P (repli des appels DIRECT 1-1). */
  p2pRemoteStream?: MediaStream | null;
  p2pLocalStream?: MediaStream | null;
  p2pConnectionState?: RTCPeerConnectionState;
  /** ⭐ V3.19 — Plan C : room Jitsi de repli (appels de groupe/canal). */
  jitsiRoom?: string | null;
  jitsiUserName?: string;
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
  // callState devient "active" (le correspondant a décroché) OU qu'une
  // issue arrive (refusé / manqué — ⭐ V3.1).
  // ⭐ V3.19 — Plan C : pas de sonnerie en repli Jitsi (la visio prend le
  // relais, la musique se changerait en cacophonie avec le "join" Jitsi).
  useEffect(() => {
    const el = ringtoneRef.current;
    if (!el) return;
    if (callState === "outgoing" && !endStatus && !jitsiRoom) {
      el.loop = true;
      el.volume = 0.5;
      el.play().catch(() => {}); // ignore autoplay-blocked
    } else {
      el.pause();
      el.currentTime = 0;
    }
    return () => { el.pause(); el.currentTime = 0; };
  }, [callState, endStatus, jitsiRoom]);

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

  // ⭐ V3.19 — Plan C : mode P2P — les flux WebRTC (aucune Room LiveKit)
  // sont attachés en srcObject ; l'audio distant passe par le <audio>
  // caché (un MediaStream branché sur <audio> n'en joue que les pistes
  // audio, la vidéo part sur le <video> principal).
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !p2pRemoteStream) return;
    el.srcObject = p2pRemoteStream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [p2pRemoteStream]);

  // ⭐ V3.19 — Plan C : vidéo distante P2P (srcObject direct).
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !p2pRemoteStream) return;
    el.srcObject = p2pRemoteStream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [p2pRemoteStream]);

  // ⭐ V3.19 — Plan C : vidéo locale P2P (PIP miroir).
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !p2pLocalStream) return;
    el.srcObject = p2pLocalStream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [p2pLocalStream]);

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
        {jitsiRoom ? (
          /* ⭐ V3.19 — Plan C : repli JITSI (appels de groupe quand LiveKit
             Cloud — Plan A — et l'auto-hébergé — Plan B — sont tous deux
             indisponibles) : visio publique gratuite intégrée en iframe,
             room DÉTERMINISTE pour que chaque participant y converge de
             son propre repli. */
          <div className="w-full h-full flex flex-col min-h-0">
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 text-[11px] font-bold text-[#C9A227] text-center">
              <LifeBuoy className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                Mode secours Jitsi · micro et caméra se règlent dans la fenêtre ci-dessous
              </span>
            </div>
            <iframe
              src={jitsiUrlFor(jitsiRoom, jitsiUserName)}
              title="Visio de secours Jitsi"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="flex-1 w-full min-h-0 rounded-2xl border border-[#C9A227]/30 bg-black"
            />
          </div>
        ) : isVideoCall && (remoteParticipant || p2pRemoteStream) ? (
          /* Appel vidéo actif : vidéo distante plein écran */
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-2xl object-contain"
          />
        ) : (
          /* Appel audio OU en attente : avatar centré — ⭐ V3.1 : la VRAIE
             photo de la conversation (photo du canal) remplace les
             initiales (fix : « au lieu de la photo de profil du canal, ce
             sont les initiales qui sont affichées »). */
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className={cn("w-32 h-32 rounded-full mx-auto mb-5 overflow-hidden flex items-center justify-center text-white text-5xl font-bold", !convAvatarUrl && getAvatarColor(convName))}
            >
              {convAvatarUrl ? (
                <img src={convAvatarUrl} alt={convName} className="w-full h-full object-cover" />
              ) : (
                getInitials(convName)
              )}
            </motion.div>
            <h2 className="text-2xl font-bold text-[#FAF6EF] mb-2">{convName}</h2>
            {/* ⭐ V3.1 — Issue distante (refusé / manqué / terminé /
                annulé) : affichée en grand AVANT la fermeture de l'overlay. */}
            {endStatus ? (
              <p className={cn(
                "flex items-center justify-center gap-2 text-lg font-bold",
                endStatus === "ended" ? "text-green-400" : "text-red-400"
              )}>
                {endStatus === "declined" && (<><PhoneOff className="w-5 h-5" />Appel refusé</>)}
                {endStatus === "missed" && (<><PhoneOff className="w-5 h-5" />Pas de réponse</>)}
                {endStatus === "cancelled" && (<><PhoneOff className="w-5 h-5" />Appel annulé</>)}
                {endStatus === "ended" && (<><Check className="w-5 h-5" />Appel terminé · {formatDuration(callDuration)}</>)}
              </p>
            ) : (
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
            )}
            {callState === "outgoing" && !endStatus && (
              <p className="text-xs text-[#FAF6EF]/50 mt-2">
                En attente que l'autre participant rejoigne l'appel...
              </p>
            )}
            {p2pLocalStream && !p2pRemoteStream && !endStatus && p2pConnectionState && p2pConnectionState !== "failed" && p2pConnectionState !== "connected" && (
              <p className="text-xs text-[#C9A227]/70 mt-2">
                Établissement de la connexion directe (P2P)…
              </p>
            )}
            {p2pRemoteStream && !endStatus && (
              <p className="mt-2 text-[10px] text-[#C9A227]/80 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full" />
                Appel direct P2P — connexion navigateur à navigateur (sans serveur multimédia)
              </p>
            )}
          </div>
        )}
      </div>

      {/* PIP vidéo locale (si appel vidéo ET caméra activée) */}
      {isVideoCall && localVideoEnabled && !jitsiRoom && (room || p2pLocalStream) && (
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

      {/* Boutons de contrôle — masqués en mode Jitsi (les commandes
          micro/caméra vivent dans la fenêtre Jitsi elle-même). */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {!jitsiRoom && (
        <>
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
        </>
        )}

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

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V3.1 — INCOMING CALL OVERLAY (appel entrant qui sonne)
// ═══════════════════════════════════════════════════════════════════════
//
// Plein écran (z-70, AU-DESSUS de l'overlay d'appel) quand un membre me
// appelle. Corrige LE bug central : « ça sonne chez l'appelant mais
// l'appel ne vient pas au niveau de l'utilisateur, ni PC ni smartphone ».
//  - PHOTO de la conversation (photo du canal « annonce officielle »…),
//    sinon photo de l'appelant, sinon initiales colorées ;
//  - SONNERIE synthétisée en WebAudio (bi-bip façon téléphone, boucle 2 s)
//    + VIBRATION sur mobile — si l'autoplay est bloqué, un appui n'importe
//    où sur l'écran relance le son ;
//  - Boutons Accepter (vert) / Refuser (rouge) façon WhatsApp.
function IncomingCallOverlay({
  info,
  onAccept,
  onDecline,
}: {
  info: IncomingCallInfo;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [accepting, setAccepting] = useState(false);

  // ─── Sonnerie WebAudio (bi-bip toutes les 2 s) + vibration mobile ────
  useEffect(() => {
    let cancelled = false;
    let pattern: ReturnType<typeof setInterval> | null = null;
    let vib: ReturnType<typeof setInterval> | null = null;

    const AC: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (AC) {
      try {
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const playBurst = () => {
          if (cancelled) return;
          try {
            const t0 = ctx.currentTime;
            [0, 0.45].forEach((offset) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.value = offset === 0 ? 880 : 660;
              gain.gain.setValueAtTime(0.001, t0 + offset);
              gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.03);
              gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.38);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t0 + offset);
              osc.stop(t0 + offset + 0.4);
            });
          } catch { /* contexte fermé */ }
        };
        ctx.resume().then(() => { if (!cancelled) playBurst(); }).catch(() => { /* autoplay bloqué → tap pour activer */ });
        pattern = setInterval(playBurst, 2000);
      } catch { /* WebAudio indisponible → sonnerie visuelle */ }
    }
    // Vibration mobile (400 ms toutes les 2 s) — Android/Chrome.
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(400);
        vib = setInterval(() => { try { navigator.vibrate?.(400); } catch {} }, 2000);
      }
    } catch { /* vibration non supportée */ }

    return () => {
      cancelled = true;
      if (pattern) clearInterval(pattern);
      if (vib) clearInterval(vib);
      try { navigator.vibrate?.(0); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
    };
  }, []);

  // Un appui n'importe où relance l'AudioContext (autoplay bloqué).
  const resumeRingtone = () => {
    try { audioCtxRef.current?.resume().catch(() => {}); } catch {}
  };

  const photo = info.convAvatarUrl || info.initiatorAvatarUrl;
  const isVideo = info.callType === "video";

  return (
    <div
      onPointerDown={resumeRingtone}
      className="fixed inset-0 z-[70] bg-[#2A0E3D]/97 backdrop-blur-sm flex flex-col items-center justify-between p-6 sm:p-10"
    >
      {/* ─── Appelant ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full text-center">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className={cn("w-28 h-28 sm:w-36 sm:h-36 rounded-full mx-auto mb-6 overflow-hidden flex items-center justify-center text-white text-4xl font-bold shadow-2xl", !photo && getAvatarColor(info.convName))}
        >
          {photo ? (
            <img src={photo} alt={info.convName} className="w-full h-full object-cover" />
          ) : (
            getInitials(info.convName)
          )}
        </motion.div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#C9A227] mb-1.5 flex items-center gap-1.5">
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          {isVideo ? "Appel vidéo entrant" : "Appel audio entrant"}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#FAF6EF]">{info.convName}</h2>
        {info.convName !== info.initiatorName && (
          <p className="text-sm text-[#FAF6EF]/70 mt-1.5">
            {info.initiatorName} vous appelle
            {info.convType === "DIRECT" ? "" : " depuis ce canal"}
          </p>
        )}
        {/* Barre « sonnerie » animée (retour visuel même sans son). */}
        <div className="flex items-end gap-1.5 h-6 mt-6" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              animate={{ scaleY: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              className="w-1.5 h-full origin-bottom rounded-full bg-[#C9A227]"
            />
          ))}
        </div>
      </div>

      {/* ─── Boutons Accepter / Refuser ───────────────────────────────── */}
      <div className="flex items-center justify-center gap-10 sm:gap-16 pb-4">
        <div className="flex flex-col items-center gap-2">
          <motion.button
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            onClick={onDecline}
            disabled={accepting}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 text-white shadow-xl flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
            title="Refuser"
          >
            <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
          </motion.button>
          <span className="text-xs font-semibold text-[#FAF6EF]/70">Refuser</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <motion.button
            animate={{ boxShadow: ["0 0 0 0 rgba(16,185,129,0.5)", "0 0 0 16px rgba(16,185,129,0)", "0 0 0 0 rgba(16,185,129,0)"] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            onClick={() => { setAccepting(true); onAccept(); }}
            disabled={accepting}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 text-white shadow-xl flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-60"
            title="Accepter"
          >
            {accepting ? <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" /> : (isVideo ? <Video className="w-7 h-7 sm:w-8 sm:h-8" /> : <Phone className="w-7 h-7 sm:w-8 sm:h-8" />)}
          </motion.button>
          <span className="text-xs font-semibold text-[#FAF6EF]/70">Accepter</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V3.1 — CALL LOG MESSAGE (journal d'appel dans le chat)
// ═══════════════════════════════════════════════════════════════════════
//
// Demande explicite : « lorsqu'il y a un appel vidéo ou appel simple
// manqué, il faut que ça s'affiche dans le chat qu'il y a eu appel manqué
// ou un appel qui est passé et qui a duré tel nombre de minutes ».
// Pastille centrée façon WhatsApp :
//   - 🔴 Appel manqué      (personne n'a décroché en 45 s)
//   - 🟠 Appel refusé      (en conversation directe)
//   - ⚪ Appel annulé      (l'appelant a raccroché avant)
//   - 🟢 Appel terminé · 3 min 12 s (durée réelle)
// Données structurées dans msg.verseRef (JSON écrit côté serveur) avec
// repli sur le texte lisible msg.content.
function CallLogMessage({ msg }: { msg: ChatMessage }) {
  let meta: { callType?: string; status?: string; durationSec?: number; byName?: string } = {};
  try {
    meta = msg.verseRef ? JSON.parse(msg.verseRef) : {};
  } catch { /* meta illisible → repli content */ }
  const status = meta.status || "ended";
  const isVideo = meta.callType === "video";
  const CallIcon = isVideo ? Video : Phone;
  const by = meta.byName || msg.senderName;

  const config = (() => {
    switch (status) {
      case "missed": return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: PhoneOff, label: "Appel manqué" };
      case "declined": return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: PhoneOff, label: "Appel refusé" };
      case "cancelled": return { bg: "bg-stone-100", border: "border-stone-200", text: "text-stone-600", icon: PhoneOff, label: "Appel annulé" };
      default: return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: CallIcon, label: `Appel terminé${typeof meta.durationSec === "number" ? ` · ${formatCallDurationFr(meta.durationSec)}` : ""}` };
    }
  })();
  const Icon = config.icon;

  return (
    <div className={cn(
      "inline-flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-sm max-w-full",
      config.bg, config.border, config.text
    )} title={msg.content}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs font-bold truncate">
        {config.label}
        <span className="font-medium opacity-70"> · {by}</span>
      </span>
      <span className="text-[10px] opacity-60 flex-shrink-0">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ⭐ V3.13 — MEMBER LOG MESSAGE (journal d'arrivée d'un nouveau membre)
// ═══════════════════════════════════════════════════════════════════════
//
// Demande explicite : « lorsqu'un nouveau membre s'inscrit, il faut que ça
// s'affiche EN PETIT, comme on affiche les appels en absence — exactement
// comme Telegram et WhatsApp — pour que la communauté sache qu'un nouveau
// membre est arrivé. Le système demande ensuite aux autres membres de lui
// souhaiter shalom, bienvenue, avec une expression hébraïque
// translittérée (Baruch haba — bienvenue ; Shalom aleikhem — que la paix
// soit sur vous). »
//   • pastille dorée centrée, compacte (même famille que les appels) ;
//   • petite ligne d'invitation automatique « Souhaitez-lui shalom et
//     bienvenue » ;
//   • données structurées dans msg.verseRef (JSON écrit côté serveur à
//     l'inscription) avec repli sur le texte lisible msg.content.
function MemberLogMessage({ msg }: { msg: ChatMessage }) {
  let meta: { name?: string; kind?: string; country?: string } = {};
  try {
    meta = msg.verseRef ? JSON.parse(msg.verseRef) : {};
  } catch { /* meta illisible → repli content */ }
  const nom = meta.name || msg.senderName;

  return (
    <div className="flex flex-col items-center gap-1.5 max-w-full">
      {/* Pastille d'arrivée — compacte, or, façon WhatsApp */}
      <div
        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#8C5FA8] shadow-sm max-w-full"
        title={msg.content}
      >
        <UserPlus className="w-4 h-4 flex-shrink-0 text-[#C9A227]" />
        <span className="text-xs font-bold truncate">
          Baruch haba !
          <span className="font-medium opacity-80"> {nom} a rejoint la communauté</span>
        </span>
        <span className="text-[10px] opacity-60 flex-shrink-0">{formatTime(msg.createdAt)}</span>
      </div>
      {/* Message automatique du système : invitation à souhaiter la
          bienvenue — expression hébraïque translittérée. */}
      <p className="text-[10px] italic text-[#8A8378] text-center px-3">
        Souhaitez shalom et bienvenue à {nom}, chers frères et sœurs —{" "}
        <span className="not-italic font-semibold text-[#C9A227]">Shalom aleikhem !</span>
      </p>
    </div>
  );
}

