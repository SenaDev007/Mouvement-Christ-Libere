"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Mic,
  Lock,
  Hash,
  Volume2,
  Megaphone,
  Users,
  ArrowLeft,
  Search,
  Settings,
  Phone,
  Video,
  Smile,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  isEncrypted: boolean;
  type: "text" | "audio" | "image" | "file";
  isOwn: boolean;
  senderRole?: "super-admin" | "moderator" | "member";
}

interface Channel {
  id: string;
  name: string;
  description: string;
  type: "text" | "voice" | "video" | "announcement" | "restricted";
  isEncrypted: boolean;
  memberCount: number;
}

interface ChannelViewProps {
  channels: Channel[];
  initialChannelId?: string;
}

const ROLE_COLORS: Record<string, string> = {
  "super-admin": "bg-[#C9A227]",
  moderator: "bg-[#8C5FA8]",
  member: "bg-[#8A8378]",
};

const ROLE_LABELS: Record<string, string> = {
  "super-admin": "Super-admin",
  moderator: "Modérateur",
  member: "Membre",
};

const CHANNEL_ICONS = {
  text: Hash,
  voice: Volume2,
  video: Video,
  announcement: Megaphone,
  restricted: Lock,
};

// Messages de démo pour simuler une conversation
const DEMO_MESSAGES: Record<string, Message[]> = {
  default: [
    {
      id: "1",
      sender: "pam",
      senderName: "Pam",
      content: "Shalom à tous. Que la paix du Seigneur soit avec vous.",
      timestamp: Date.now() - 60 * 60 * 1000,
      isEncrypted: true,
      type: "text",
      isOwn: false,
      senderRole: "super-admin",
    },
    {
      id: "2",
      sender: "kongo",
      senderName: "Pasteur Kongo",
      content: "Shalom. Le Seigneur nous rassemble encore aujourd'hui. Soyez les bienvenus.",
      timestamp: Date.now() - 55 * 60 * 1000,
      isEncrypted: true,
      type: "text",
      isOwn: false,
      senderRole: "super-admin",
    },
    {
      id: "3",
      sender: "user1",
      senderName: "Sarah",
      content: "Bénédiction pasteur. J'ai une question sur l'enseignement d'hier soir.",
      timestamp: Date.now() - 30 * 60 * 1000,
      isEncrypted: true,
      type: "text",
      isOwn: false,
      senderRole: "member",
    },
    {
      id: "4",
      sender: "mod1",
      senderName: "Modérateur",
      content: "Bienvenue Sarah. Tu peux poser ta question, l'équipe pastorale te répondra.",
      timestamp: Date.now() - 25 * 60 * 1000,
      isEncrypted: true,
      type: "text",
      isOwn: false,
      senderRole: "moderator",
    },
    {
      id: "5",
      sender: "me",
      senderName: "Vous",
      content: "Bénédiction à tous. Je viens de rejoindre la communauté.",
      timestamp: Date.now() - 5 * 60 * 1000,
      isEncrypted: true,
      type: "text",
      isOwn: true,
      senderRole: "member",
    },
  ],
};

export function ChannelView({ channels, initialChannelId }: ChannelViewProps) {
  const [selectedChannelId, setSelectedChannelId] = useState(
    initialChannelId || channels[0]?.id
  );
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const currentMessages = messages[selectedChannelId || ""] || DEMO_MESSAGES.default;

  // Scroll en bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, selectedChannelId]);

  // Simuler réponse automatique en mode démo
  const sendDemoMessage = useCallback((text: string) => {
    if (!selectedChannelId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "me",
      senderName: "Vous",
      content: text,
      timestamp: Date.now(),
      isEncrypted: selectedChannel?.isEncrypted || false,
      type: "text",
      isOwn: true,
      senderRole: "member",
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChannelId]: [...(prev[selectedChannelId] || DEMO_MESSAGES.default), newMessage],
    }));

    // Simuler réponse
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "pam",
        senderName: "Pam",
        content: "Que le Seigneur vous bénisse. Nous prions pour vous.",
        timestamp: Date.now(),
        isEncrypted: selectedChannel?.isEncrypted || false,
        type: "text",
        isOwn: false,
        senderRole: "super-admin",
      };
      setMessages((prev) => ({
        ...prev,
        [selectedChannelId]: [...(prev[selectedChannelId] || DEMO_MESSAGES.default), reply],
      }));
    }, 2500);
  }, [selectedChannelId, selectedChannel]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendDemoMessage(inputText.trim());
    setInputText("");
    inputRef.current?.focus();
  }, [inputText, sendDemoMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-[#FAF6EF] border border-[#8A8378]/20 rounded-2xl overflow-hidden">
      {/* Sidebar : liste des canaux */}
      <div className="w-64 bg-[#2A0E3D] text-[#FAF6EF] flex flex-col flex-shrink-0 hidden md:flex">
        {/* En-tête */}
        <div className="p-4 border-b border-[#C9A227]/15">
          <h2 className="font-serif text-lg font-semibold">Communauté</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/70 font-semibold mt-0.5">
            Mouvement Christ Libère
          </p>
        </div>

        {/* Recherche */}
        <div className="p-3 border-b border-[#C9A227]/15">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#FAF6EF]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 rounded text-xs bg-[#3D1A54]/40 text-[#FAF6EF] placeholder:text-[#FAF6EF]/40 border border-[#C9A227]/15 focus:outline-none focus:border-[#C9A227]/40"
            />
          </div>
        </div>

        {/* Liste canaux */}
        <div className="flex-1 overflow-y-auto scrollbar-discrete py-2">
          {filteredChannels.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.type];
            const isSelected = channel.id === selectedChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => setSelectedChannelId(channel.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                  isSelected
                    ? "bg-[#C9A227]/15 text-[#C9A227] border-l-2 border-[#C9A227]"
                    : "text-[#FAF6EF]/70 hover:bg-[#3D1A54]/40 hover:text-[#FAF6EF] border-l-2 border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{channel.name}</span>
                {channel.isEncrypted && (
                  <Lock className="w-3 h-3 flex-shrink-0 opacity-60" />
                )}
                {channel.memberCount > 0 && (
                  <span className="text-[10px] opacity-50">{channel.memberCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer utilisateur */}
        <div className="p-3 border-t border-[#C9A227]/15">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10">
                <span className="text-xs font-serif font-semibold text-[#C9A227]">M</span>
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-state-success border border-[#2A0E3D]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#FAF6EF] truncate">Membre</p>
              <p className="text-[10px] text-[#FAF6EF]/50">En ligne</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-[#FAF6EF]/50" />
          </div>
        </div>
      </div>

      {/* Zone principale : messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* En-tête canal */}
        {selectedChannel && (
          <div className="px-4 py-3 border-b border-[#8A8378]/15 flex items-center justify-between bg-[#FAF6EF]">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const Icon = CHANNEL_ICONS[selectedChannel.type];
                return <Icon className="w-4 h-4 text-[#8A8378] flex-shrink-0" />;
              })()}
              <div className="min-w-0">
                <h3 className="font-serif text-base font-semibold text-[#1E0F2B] truncate">
                  {selectedChannel.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-[#8A8378]">
                  <Users className="w-3 h-3" />
                  <span>{selectedChannel.memberCount} membres</span>
                  {selectedChannel.isEncrypted && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-[#A3821C]">
                        <Lock className="w-2.5 h-2.5" />
                        Chiffré E2E
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#2A0E3D] transition-colors"
                aria-label="Appel audio"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#2A0E3D] transition-colors"
                aria-label="Appel vidéo"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-discrete p-4 space-y-4 bg-[#FAF6EF]">
          {selectedChannel?.isEncrypted && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#C9A227]/5 border border-[#C9A227]/20 text-xs text-[#A3821C]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                Les messages de ce canal sont chiffrés de bout en bout. Ni l'équipe technique ni les hébergeurs n'y ont accès.
              </span>
            </div>
          )}

          {currentMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              showAvatar={i === 0 || currentMessages[i - 1].sender !== msg.sender}
            />
          ))}

          {/* Indicateur de frappe */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-[#8A8378] italic"
            >
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A8378] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A8378] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A8378] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              Pam écrit...
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie */}
        <div className="p-3 border-t border-[#8A8378]/15 bg-[#FAF6EF]">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#2A0E3D] transition-colors flex-shrink-0"
              aria-label="Joindre un fichier"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#2A0E3D] transition-colors flex-shrink-0"
              aria-label="Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Écrire dans ${selectedChannel?.name || "le canal"}...`}
                className="w-full px-4 py-2.5 pr-10 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                aria-label="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>
            <button
              className="p-2 rounded hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#2A0E3D] transition-colors flex-shrink-0"
              aria-label="Message audio"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="w-10 h-10 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center hover:bg-[#DDBE55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {selectedChannel?.isEncrypted && (
            <p className="text-[10px] text-[#8A8378] mt-2 text-center">
              <Lock className="w-2.5 h-2.5 inline mr-1" />
              Message chiffré de bout en bout
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, showAvatar }: { message: Message; showAvatar: boolean }) {
  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        message.isOwn && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      {showAvatar ? (
        <div className="flex-shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              message.isOwn
                ? "bg-[#C9A227]/10 border border-[#C9A227]/30"
                : message.senderRole === "super-admin"
                  ? "bg-[#C9A227]/20 border border-[#C9A227]"
                  : message.senderRole === "moderator"
                    ? "bg-[#8C5FA8]/20 border border-[#8C5FA8]"
                    : "bg-[#8A8378]/10 border border-[#8A8378]/30"
            )}
          >
            <span
              className={cn(
                "font-serif text-xs font-semibold",
                message.isOwn
                  ? "text-[#C9A227]"
                  : message.senderRole === "super-admin"
                    ? "text-[#C9A227]"
                    : message.senderRole === "moderator"
                      ? "text-[#8C5FA8]"
                      : "text-[#8A8378]"
              )}
            >
              {message.senderName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-9 flex-shrink-0" />
      )}

      {/* Bulle message */}
      <div className={cn("flex-1 min-w-0 max-w-[70%]", message.isOwn && "flex flex-col items-end")}>
        {showAvatar && (
          <div className={cn("flex items-center gap-2 mb-1", message.isOwn && "flex-row-reverse")}>
            <span className="text-xs font-semibold text-[#1E0F2B]">{message.senderName}</span>
            {message.senderRole && message.senderRole !== "member" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em] font-bold",
                  message.senderRole === "super-admin"
                    ? "bg-[#C9A227]/15 text-[#A3821C]"
                    : "bg-[#8C5FA8]/15 text-[#8C5FA8]"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", ROLE_COLORS[message.senderRole])} />
                {ROLE_LABELS[message.senderRole]}
              </span>
            )}
            <span className="text-[10px] text-[#8A8378]">{time}</span>
            {message.isEncrypted && (
              <Lock className="w-2.5 h-2.5 text-[#C9A227]/60" />
            )}
          </div>
        )}
        <div
          className={cn(
            "inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            message.isOwn
              ? "bg-[#C9A227] text-[#1E0F2B] rounded-br-sm"
              : message.senderRole === "super-admin"
                ? "bg-[#2A0E3D]/5 border border-[#C9A227]/20 text-[#1E0F2B] rounded-bl-sm"
                : message.senderRole === "moderator"
                  ? "bg-[#8C5FA8]/5 border border-[#8C5FA8]/20 text-[#1E0F2B] rounded-bl-sm"
                  : "bg-[#8A8378]/10 text-[#1E0F2B] rounded-bl-sm"
          )}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}
