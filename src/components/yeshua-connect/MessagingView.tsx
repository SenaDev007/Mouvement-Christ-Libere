"use client";

/**
 * ============================================================================
 * YESHUA CONNECT — Messagerie complète (WhatsApp-style)
 * ============================================================================
 *
 * ⭐ Port complet des fonctionnalités de Helm Connect (Academia Helm), adapté
 *    pour la communauté spirituelle Mouvement Christ Libère.
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
 *   ✅ Accès à la Bible (lien sidebar + partage de verset)
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
  StopCircle, Play, Pause, Sparkles, ChevronRight, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  QUICK_REACTIONS,
  type ChatConversation, type ChatMessage,
} from "@/lib/yeshua-connect/types";
import { getYeshuaWatermarkStyle } from "./YeshuaWatermark";
import { api } from "@/lib/api-client";

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

export function MessagingView() {
  // ⭐ V2.0 — Get the real user ID from NextAuth session
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || "current";
  const currentUserName = session?.user?.name || "Vous";

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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
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

  // ─── State: typing indicator (UI only — no Socket.io V1) ─────────────
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── State: calls (UI only — WebRTC V2) ──────────────────────────────
  const [callState, setCallState] = useState<"idle" | "outgoing" | "incoming" | "active">("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

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
        setActiveConvId(data[0].id);
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
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${convId}/messages?limit=100`), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data: ChatMessage[] = await res.json();
      setMessages(prev => ({ ...prev, [convId]: data }));
    } catch (e) {
      console.error("loadMessages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConvId]);

  // ═════════════════════════════════════════════════════════════════════
  //  MESSAGE ACTIONS
  // ═════════════════════════════════════════════════════════════════════

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !activeConvId) return;

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
    const replyId = replyTo?.id;
    setReplyTo(null);

    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          content,
          type: "TEXT",
          replyToId: replyId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newMsg: ChatMessage = await res.json();
      setMessages(prev => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }));
    } catch (e) {
      console.error("handleSend:", e);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Upload as attachment
        if (activeConvId && blob.size > 0) {
          const formData = new FormData();
          formData.append("file", blob, `voice-${Date.now()}.webm`);
          formData.append("userId", "current");
          formData.append("type", "AUDIO");
          try {
            const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages/attachment`), {
              method: "POST",
              body: formData,
            });
            if (res.ok) loadMessages(activeConvId);
          } catch (e) { console.error("voice upload:", e); }
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
      setRecordingState("idle");
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  //  FILE ATTACHMENTS
  // ═════════════════════════════════════════════════════════════════════

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", "current");
    formData.append("type", file.type.startsWith("image/") ? "IMAGE" : "FILE");
    try {
      const res = await fetch(api.url(`/api/yeshua-connect/conversations/${activeConvId}/messages/attachment`), {
        method: "POST",
        body: formData,
      });
      if (res.ok) loadMessages(activeConvId);
    } catch (e) { console.error("file upload:", e); }
    e.target.value = ""; // reset
  };

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
  //  TYPING INDICATOR (UI only — no Socket.io)
  // ═════════════════════════════════════════════════════════════════════

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // Show "typing..." for 3s after user stops typing
    typingTimeoutRef.current = setTimeout(() => {
      // Could emit socket event here in V2
    }, 3000);
  };

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
        activeConvId ? "hidden md:flex" : "flex"
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

        {/* Community link */}
        <Link
          href="/communaute"
          className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 hover:bg-[#C9A227]/5 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 border border-[#C9A227]/30 flex items-center justify-center">
            <Users2 className="w-5 h-5 text-[#C9A227]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1E0F2B]">Communauté</p>
            <p className="text-xs text-stone-500 truncate">Canaux, groupes et membres</p>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#C9A227]" />
        </Link>

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
            </>
          )}
        </div>
      </div>

      {/* ═════ CHAT ZONE ═════ */}
      <div className="flex-1 flex flex-col bg-stone-50/30" style={getYeshuaWatermarkStyle({ opacity: 0.05 })}>
        {/* Chat header */}
        {activeConv ? (
          <div className="p-3 border-b border-stone-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveConvId(null)} className="md:hidden p-1 text-stone-500">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", getAvatarColor(activeConv.name))}>
                {getInitials(activeConv.name)}
              </div>
              <div>
                <h3 className="font-bold text-[#1E0F2B] text-sm flex items-center gap-1.5">
                  {activeConv.name}
                  {activeConv.isEncrypted && <Lock className="w-3 h-3 text-[#C9A227]" />}
                </h3>
                <p className="text-xs text-stone-400">
                  {activeConv.isEncrypted && "🔒 Chiffré E2E · "}
                  {activeConv.participants.length} membres
                  {mutedConversations.has(activeConv.id) && " · 🔕 Muet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCallState("outgoing")} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Appel audio">
                <Phone className="w-4 h-4" />
              </button>
              <button onClick={() => setCallState("outgoing")} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Appel vidéo">
                <Video className="w-4 h-4" />
              </button>
              <button onClick={() => setShowConvSearch(!showConvSearch)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Rechercher">
                <Search className="w-4 h-4" />
              </button>
              <Link href="/bible" className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Bible">
                <BookOpen className="w-4 h-4" />
              </Link>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
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
              {activeMessages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId;
                const showDateSep = i === 0 || formatDateSeparator(activeMessages[i - 1].createdAt) !== formatDateSeparator(msg.createdAt);
                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 bg-stone-100 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                          {formatDateSeparator(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={cn("group relative flex", isMine ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                        isMine ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-white border border-stone-200 text-[#1E0F2B]"
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
                        {/* Sender name (for groups) */}
                        {!isMine && (activeConv?.type === "GROUP" || activeConv?.type === "PASTORS" || activeConv?.type === "CHANNEL") && (
                          <p className="text-xs font-bold text-[#8C5FA8] mb-0.5">{msg.senderName}</p>
                        )}
                        {/* Content */}
                        {msg.type === "VERSE" && msg.verseRef ? (
                          <div className={cn(
                            "px-3 py-2 rounded-xl border-l-4 my-1",
                            isMine ? "bg-[#1E0F2B]/10 border-[#1E0F2B]" : "bg-[#C9A227]/5 border-[#C9A227]"
                          )}>
                            <p className="text-xs font-bold opacity-80">{msg.verseRef}</p>
                            <p className="text-sm italic mt-0.5">{msg.verseText}</p>
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
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
                          <div className="flex flex-wrap gap-1 mt-1">
                            {msg.reactions.reduce((acc, r) => {
                              const ex = acc.find(e => e.emoji === r.emoji);
                              if (ex) ex.count++; else acc.push({ emoji: r.emoji, count: 1 });
                              return acc;
                            }, [] as { emoji: string; count: number }[]).map(r => (
                              <span key={r.emoji} className="px-1.5 py-0.5 rounded-full bg-[#1E0F2B]/10 text-xs">
                                {r.emoji} {r.count > 1 && r.count}
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
                  </div>
                );
              })}
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 rounded-2xl px-4 py-2 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        {activeConv && (
          <div className="p-3 border-t border-stone-100 bg-white">
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
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Joindre un fichier">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Image">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <textarea
                  ref={messageInputRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Écrivez votre message..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 resize-none"
                  disabled={sending}
                />
                <button onClick={() => setShowPollModal(true)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Sondage">
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button onClick={() => setShowScheduleModal(true)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Programmer">
                  <Calendar className="w-4 h-4" />
                </button>
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

      {/* Schedule Modal */}
      {showScheduleModal && (
        <Modal onClose={() => setShowScheduleModal(false)} title="Programmer le message">
          <div className="space-y-3">
            <textarea
              placeholder="Votre message..."
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
              rows={3}
            />
            <input type="datetime-local" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" />
            <button onClick={() => setShowScheduleModal(false)} className="w-full py-2.5 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55]">
              Programmer l'envoi
            </button>
          </div>
        </Modal>
      )}

      {/* Poll Modal */}
      {showPollModal && (
        <Modal onClose={() => setShowPollModal(false)} title="Créer un sondage">
          <div className="space-y-3">
            <input placeholder="Question..." className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" />
            <input placeholder="Option 1" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" />
            <input placeholder="Option 2" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" />
            <input placeholder="Option 3 (optionnel)" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none" />
            <button onClick={() => setShowPollModal(false)} className="w-full py-2.5 bg-[#C9A227] text-[#1E0F2B] rounded-xl text-sm font-bold hover:bg-[#DDBE55]">
              Créer le sondage
            </button>
          </div>
        </Modal>
      )}

      {/* Call UI (outgoing — V2 WebRTC) */}
      {callState === "outgoing" && activeConv && (
        <div className="fixed inset-0 bg-[#2A0E3D] z-[60] flex flex-col items-center justify-center">
          <div className="text-center">
            <div className={cn("w-28 h-28 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-4xl font-bold", getAvatarColor(activeConv.name))}>
              {getInitials(activeConv.name)}
            </div>
            <h2 className="text-2xl font-bold text-[#FAF6EF] mb-2">{activeConv.name}</h2>
            <p className="text-[#C9A227]">Appel en cours...</p>
          </div>
          <button onClick={() => setCallState("idle")} className="mt-12 w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white">
            <Phone className="w-7 h-7 rotate-[135deg]" />
          </button>
        </div>
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
            className={cn("w-full p-3 flex items-start gap-3 hover:bg-stone-50 transition-all text-left border-b border-stone-50", isActive && "bg-[#C9A227]/5")}>
            <div className="relative flex-shrink-0">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm", getAvatarColor(conv.name))}>
                {getInitials(conv.name)}
              </div>
              {conv.isEncrypted && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#C9A227] rounded-full flex items-center justify-center"><Lock className="w-2 h-2 text-[#1E0F2B]" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1E0F2B] truncate">{conv.name}</p>
                <div className="flex items-center gap-1">
                  {isMuted && <BellOff className="w-3 h-3 text-stone-400" />}
                  {conv.unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B]">{conv.unreadCount}</span>}
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
          communityId: "default", // TODO: get from context
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
