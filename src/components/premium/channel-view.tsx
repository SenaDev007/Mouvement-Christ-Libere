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
  "super-admin": "bg-gold",
  moderator: "bg-lavender",
  member: "bg-stone",
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
      senderName: "PAM",
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
        senderName: "PAM",
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
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-ivory border border-stone/20 rounded-card overflow-hidden">
      {/* Sidebar : liste des canaux */}
      <div className="w-64 bg-imperial text-ivory flex flex-col flex-shrink-0 hidden md:flex">
        {/* En-tête */}
        <div className="p-4 border-b border-gold/15">
          <h2 className="font-serif text-lg font-semibold">Communauté</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-light/70 font-semibold mt-0.5">
            Mouvement Christ Libère
          </p>
        </div>

        {/* Recherche */}
        <div className="p-3 border-b border-gold/15">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ivory/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 rounded text-xs bg-imperial-light/40 text-ivory placeholder:text-ivory/40 border border-gold/15 focus:outline-none focus:border-gold/40"
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
                    ? "bg-gold/15 text-gold border-l-2 border-gold"
                    : "text-ivory/70 hover:bg-imperial-light/40 hover:text-ivory border-l-2 border-transparent"
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
        <div className="p-3 border-t border-gold/15">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gold/40 bg-gold/10">
                <span className="text-xs font-serif font-semibold text-gold">M</span>
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-state-success border border-imperial" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ivory truncate">Membre</p>
              <p className="text-[10px] text-ivory/50">En ligne</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-ivory/50" />
          </div>
        </div>
      </div>

      {/* Zone principale : messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* En-tête canal */}
        {selectedChannel && (
          <div className="px-4 py-3 border-b border-stone/15 flex items-center justify-between bg-ivory">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const Icon = CHANNEL_ICONS[selectedChannel.type];
                return <Icon className="w-4 h-4 text-stone flex-shrink-0" />;
              })()}
              <div className="min-w-0">
                <h3 className="font-serif text-base font-semibold text-ink truncate">
                  {selectedChannel.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-stone">
                  <Users className="w-3 h-3" />
                  <span>{selectedChannel.memberCount} membres</span>
                  {selectedChannel.isEncrypted && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-gold-dark">
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
                className="p-2 rounded hover:bg-stone/10 text-stone hover:text-imperial transition-colors"
                aria-label="Appel audio"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded hover:bg-stone/10 text-stone hover:text-imperial transition-colors"
                aria-label="Appel vidéo"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-discrete p-4 space-y-4 bg-ivory">
          {selectedChannel?.isEncrypted && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-card bg-gold/5 border border-gold/20 text-xs text-gold-dark">
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
              className="flex items-center gap-2 text-xs text-stone italic"
            >
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-stone animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-stone animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-stone animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              PAM écrit...
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie */}
        <div className="p-3 border-t border-stone/15 bg-ivory">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded hover:bg-stone/10 text-stone hover:text-imperial transition-colors flex-shrink-0"
              aria-label="Joindre un fichier"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-stone/10 text-stone hover:text-imperial transition-colors flex-shrink-0"
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
                className="w-full px-4 py-2.5 pr-10 rounded-full border border-stone/30 bg-ivory text-ink text-sm placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone hover:text-gold transition-colors"
                aria-label="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>
            <button
              className="p-2 rounded hover:bg-stone/10 text-stone hover:text-imperial transition-colors flex-shrink-0"
              aria-label="Message audio"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="w-10 h-10 rounded-full bg-gold text-ink flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {selectedChannel?.isEncrypted && (
            <p className="text-[10px] text-stone mt-2 text-center">
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
                ? "bg-gold/10 border border-gold/30"
                : message.senderRole === "super-admin"
                  ? "bg-gold/20 border border-gold"
                  : message.senderRole === "moderator"
                    ? "bg-lavender/20 border border-lavender"
                    : "bg-stone/10 border border-stone/30"
            )}
          >
            <span
              className={cn(
                "font-serif text-xs font-semibold",
                message.isOwn
                  ? "text-gold"
                  : message.senderRole === "super-admin"
                    ? "text-gold"
                    : message.senderRole === "moderator"
                      ? "text-lavender"
                      : "text-stone"
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
            <span className="text-xs font-semibold text-ink">{message.senderName}</span>
            {message.senderRole && message.senderRole !== "member" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em] font-bold",
                  message.senderRole === "super-admin"
                    ? "bg-gold/15 text-gold-dark"
                    : "bg-lavender/15 text-lavender"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", ROLE_COLORS[message.senderRole])} />
                {ROLE_LABELS[message.senderRole]}
              </span>
            )}
            <span className="text-[10px] text-stone">{time}</span>
            {message.isEncrypted && (
              <Lock className="w-2.5 h-2.5 text-gold/60" />
            )}
          </div>
        )}
        <div
          className={cn(
            "inline-block px-4 py-2.5 rounded-card text-sm leading-relaxed",
            message.isOwn
              ? "bg-gold text-ink rounded-br-sm"
              : message.senderRole === "super-admin"
                ? "bg-imperial/5 border border-gold/20 text-ink rounded-bl-sm"
                : message.senderRole === "moderator"
                  ? "bg-lavender/5 border border-lavender/20 text-ink rounded-bl-sm"
                  : "bg-stone/10 text-ink rounded-bl-sm"
          )}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}
