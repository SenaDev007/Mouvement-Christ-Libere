"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Paperclip, Mic, Lock, Hash, Volume2, Users,
  ChevronRight, BookOpen, Reply, Sparkles, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_CONVERSATIONS, MOCK_MESSAGES, QUICK_REACTIONS,
  type ChatConversation, type ChatMessage,
} from "@/lib/helm-connect/types";

export function MessagingView() {
  const [conversations] = useState(MOCK_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState(MOCK_CONVERSATIONS[0].id);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "preview">("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showBiblePicker, setShowBiblePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = messages[activeConvId] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, activeConvId]);

  const handleSend = () => {
    if (!inputText.trim() || !activeConv) return;
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      conversationId: activeConvId,
      senderId: "me",
      senderName: "Vous",
      senderRole: "Disciple",
      type: "TEXT",
      content: inputText,
      reactions: [],
      createdAt: new Date().toISOString(),
      replyToId: replyTo?.id,
      replyTo: replyTo ? { senderName: replyTo.senderName, content: replyTo.content || "" } : undefined,
    };
    setMessages(prev => ({ ...prev, [activeConvId]: [...(prev[activeConvId] || []), newMsg] }));
    setInputText("");
    setReplyTo(null);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages(prev => ({
      ...prev,
      [activeConvId]: (prev[activeConvId] || []).map(m =>
        m.id === msgId
          ? { ...m, reactions: [...m.reactions, { emoji, userId: "me", userName: "Vous" }] }
          : m
      ),
    }));
    setShowReactions(null);
  };

  const handleBibleShare = (reference: string, text: string) => {
    if (!activeConv) return;
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      conversationId: activeConvId,
      senderId: "me",
      senderName: "Vous",
      senderRole: "Disciple",
      type: "VERSE",
      content: reference,
      verseRef: reference,
      verseText: text,
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => ({ ...prev, [activeConvId]: [...(prev[activeConvId] || []), newMsg] }));
    setShowBiblePicker(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex h-[calc(100vh-200px)]">
      {/* Sidebar — conversations */}
      <div className="w-80 border-r border-stone-100 flex flex-col flex-shrink-0 hidden md:flex">
        <div className="p-4 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#C9A227]/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 hover:bg-stone-50 transition-all text-left border-b border-stone-50",
                  isActive && "bg-[#C9A227]/5"
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                    conv.type === "CHANNEL" ? "bg-[#C9A227]" :
                    conv.type === "GROUP" ? "bg-[#8C5FA8]" :
                    "bg-[#2A0E3D]"
                  )}>
                    {conv.name.charAt(0)}
                  </div>
                  {conv.isEncrypted && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#C9A227] rounded-full flex items-center justify-center">
                      <Lock className="w-2 h-2 text-[#1E0F2B]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1E0F2B] truncate">{conv.name}</p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">{conv.lastMessagePreview}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {conv.type === "CHANNEL" && <Hash className="w-3 h-3 text-stone-400" />}
                    {conv.type === "GROUP" && <Users className="w-3 h-3 text-stone-400" />}
                    {conv.isEncrypted && <span className="text-[10px] text-[#C9A227] font-semibold">E2E</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone de chat */}
      <div className="flex-1 flex flex-col bg-stone-50/30">
        {/* Header */}
        {activeConv && (
          <div className="p-4 border-b border-stone-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                activeConv.type === "CHANNEL" ? "bg-[#C9A227]" :
                activeConv.type === "GROUP" ? "bg-[#8C5FA8]" :
                "bg-[#2A0E3D]"
              )}>
                {activeConv.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-[#1E0F2B] text-sm">{activeConv.name}</h3>
                <p className="text-xs text-stone-400">
                  {activeConv.isEncrypted && "🔒 Chiffré E2E · "}
                  {activeConv.participants.length} membres
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Appel audio">
                <Volume2 className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500" title="Bible">
                <BookOpen className="w-4 h-4" onClick={() => setShowBiblePicker(!showBiblePicker)} />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onReact={(emoji) => handleReaction(msg.id, emoji)}
              onReply={() => setReplyTo(msg)}
              showReactions={showReactions === msg.id}
              onShowReactions={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply preview */}
        {replyTo && (
          <div className="px-4 py-2 bg-[#C9A227]/5 border-t border-[#C9A227]/20 flex items-center gap-2">
            <Reply className="w-3 h-3 text-[#C9A227]" />
            <span className="text-xs text-stone-600">
              Réponse à <strong>{replyTo.senderName}</strong>: {replyTo.content?.substring(0, 50)}
            </span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-xs text-stone-400 hover:text-stone-600">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-stone-100 bg-white">
          {showBiblePicker && (
            <BibleQuickPicker onSelect={handleBibleShare} />
          )}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-500">
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowBiblePicker(!showBiblePicker)}
              className={cn("p-2 rounded-lg transition-colors", showBiblePicker ? "bg-[#C9A227]/15 text-[#C9A227]" : "hover:bg-stone-100 text-stone-500")}
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Écrire un message..."
              className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
            />
            {inputText.trim() ? (
              <button
                onClick={handleSend}
                className="p-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button className="p-2.5 rounded-xl bg-[#8C5FA8] text-white hover:bg-[#A878C4] transition-colors">
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message, onReact, onReply, showReactions, onShowReactions,
}: {
  message: ChatMessage;
  onReact: (emoji: string) => void;
  onReply: () => void;
  showReactions: boolean;
  onShowReactions: () => void;
}) {
  const isMe = message.senderId === "me";

  return (
    <div className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}>
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-[#2A0E3D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {message.senderName.charAt(0)}
        </div>
      )}
      <div className={cn("max-w-[70%]", isMe && "items-end")}>
        {/* Reply quote */}
        {message.replyTo && (
          <div className={cn(
            "px-3 py-1.5 rounded-lg mb-1 text-xs border-l-2",
            isMe ? "bg-[#C9A227]/5 border-[#C9A227]" : "bg-stone-100 border-stone-300"
          )}>
            <span className="font-semibold text-stone-600">{message.replyTo.senderName}: </span>
            <span className="text-stone-500">{message.replyTo.content.substring(0, 60)}</span>
          </div>
        )}

        <div
          onDoubleClick={onReply}
          className={cn(
            "relative group px-4 py-2.5 rounded-2xl text-sm",
            isMe
              ? "bg-[#C9A227] text-[#1E0F2B] rounded-br-sm"
              : "bg-white border border-stone-200 text-[#1E0F2B] rounded-bl-sm"
          )}
        >
          {!isMe && (
            <p className="text-xs font-bold text-[#8C5FA8] mb-0.5">{message.senderName}</p>
          )}

          {message.type === "VERSE" ? (
            <div className="space-y-1">
              <p className="font-serif italic">« {message.verseText} »</p>
              <p className={cn("text-xs font-semibold", isMe ? "text-[#1E0F2B]/70" : "text-[#C9A227]")}>
                {message.verseRef}
              </p>
            </div>
          ) : message.type === "AUDIO" ? (
            <div className="flex items-center gap-2 py-1">
              <button className="w-8 h-8 rounded-full bg-current/20 flex items-center justify-center">
                <Volume2 className="w-4 h-4" />
              </button>
              <div className="flex-1 h-1.5 bg-current/20 rounded-full">
                <div className="h-full w-1/3 bg-current rounded-full" />
              </div>
              <span className="text-xs">{Math.floor(message.duration || 0)}s</span>
            </div>
          ) : (
            <p>{message.content}</p>
          )}

          {/* Quick actions */}
          <button
            onClick={onShowReactions}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-stone-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          >
            <Sparkles className="w-3 h-3 text-[#C9A227]" />
          </button>

          {/* Reaction bar */}
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                className="absolute -top-12 left-0 bg-white rounded-full shadow-lg border border-stone-200 px-2 py-1.5 flex items-center gap-1 z-10"
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(emoji)}
                    className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center text-sm transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={onReply}
                  className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-transform hover:scale-125"
                >
                  <Reply className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reactions display */}
        {message.reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {Object.entries(
              message.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => (
              <span key={emoji} className="px-2 py-0.5 rounded-full bg-stone-100 text-xs flex items-center gap-1">
                {emoji} <span className="text-stone-500 font-semibold">{count}</span>
              </span>
            ))}
          </div>
        )}

        <p className={cn("text-[10px] text-stone-400 mt-0.5", isMe ? "text-right" : "text-left")}>
          {new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function BibleQuickPicker({ onSelect }: { onSelect: (ref: string, text: string) => void }) {
  const VERSES = [
    { reference: "Genèse 5:24", text: "Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit." },
    { reference: "Ésaïe 11:12", text: "Il rassemblera les dispersés d'Israël des quatre extrémités de la terre." },
    { reference: "1 Thessaloniciens 4:16", text: "Le Seigneur descendra du ciel au son de la trompette de Dieu." },
    { reference: "Matthieu 18:19", text: "Si deux d'entre vous s'accordent sur la terre, cela leur sera accordé." },
    { reference: "Hébreux 11:5", text: "C'est par la foi qu'Hénoch fut enlevé pour qu'il ne vît point la mort." },
    { reference: "Jean 14:27", text: "Je vous laisse la paix, je vous donne ma paix." },
  ];

  return (
    <div className="mb-3 p-3 bg-[#C9A227]/5 border border-[#C9A227]/20 rounded-xl">
      <p className="text-xs font-bold text-[#C9A227] mb-2 flex items-center gap-1">
        <BookOpen className="w-3 h-3" /> Partager un verset
      </p>
      <div className="grid grid-cols-2 gap-2">
        {VERSES.map((v) => (
          <button
            key={v.reference}
            onClick={() => onSelect(v.reference, v.text)}
            className="text-left p-2 rounded-lg bg-white border border-stone-200 hover:border-[#C9A227]/40 transition-colors"
          >
            <p className="text-xs font-serif italic text-[#1E0F2B] truncate">« {v.text} »</p>
            <p className="text-[10px] text-[#C9A227] font-semibold mt-0.5">{v.reference}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
