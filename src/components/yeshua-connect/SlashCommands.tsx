"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

/**
 * SlashCommands — barre de commandes type Discord.
 *
 * Commands disponibles:
 *   /bible <référence>     — Partager un verset biblique
 *   /poll <question>       — Créer un sondage
 *   /announce <texte>      — Publier une annonce officielle
 *   /giphy <recherche>     — Partager un GIF (V2)
 *   /clear                 — Vider la conversation (admin)
 *   /help                  — Afficher l'aide
 */

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  icon: string;
}

export const COMMANDS: SlashCommand[] = [
  { name: "bible", description: "Partager un verset biblique", usage: "/bible Genèse 1:1", icon: "📖" },
  { name: "poll", description: "Créer un sondage", usage: "/poll Quelle est votre fête préférée ?", icon: "📊" },
  { name: "announce", description: "Publier une annonce officielle", usage: "/announce Message important", icon: "📢" },
  { name: "clear", description: "Vider la conversation (admin)", usage: "/clear", icon: "🧹" },
  { name: "help", description: "Afficher l'aide", usage: "/help", icon: "❓" },
];

interface SlashCommandsProps {
  input: string;
  onCommand: (command: string, args: string) => void;
  onDismiss: () => void;
}

export function SlashCommands({ input, onCommand, onDismiss }: SlashCommandsProps) {
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(COMMANDS);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!input.startsWith("/")) {
      onDismiss();
      return;
    }

    const parts = input.substring(1).split(" ");
    const cmdName = parts[0].toLowerCase();

    if (parts.length === 1) {
      // Show filtered commands
      setFilteredCommands(COMMANDS.filter(c => c.name.startsWith(cmdName)));
    } else {
      // Command selected, show usage hint
      const cmd = COMMANDS.find(c => c.name === cmdName);
      if (cmd) setFilteredCommands([cmd]);
      else onDismiss();
    }
  }, [input]);

  if (filteredCommands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-[#8A8378]/20 overflow-hidden z-50">
      <div className="px-4 py-2 bg-[#FAF6EF] border-b border-[#8A8378]/10">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8A8378]">Commandes</p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filteredCommands.map((cmd, i) => (
          <button
            key={cmd.name}
            onClick={() => onCommand(cmd.name, input.substring(cmd.name.length + 2))}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              i === selectedIndex ? "bg-[#C9A227]/10" : "hover:bg-[#FAF6EF]"
            }`}
          >
            <span className="text-xl">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E0F2B]">/{cmd.name}</p>
              <p className="text-xs text-[#8A8378] truncate">{cmd.description}</p>
            </div>
            <span className="text-[10px] text-[#8A8378]/60 font-mono">{cmd.usage}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Execute a slash command and return the result */
export async function executeCommand(command: string, args: string, conversationId: string): Promise<any> {
  switch (command) {
    case "bible": {
      // Fetch verse from API
      const res = await fetch(api.url(`/api/bible/${encodeURIComponent(args)}`));
      if (res.ok) {
        const data = await res.json();
        return {
          type: "VERSE",
          content: args,
          verseRef: args,
          verseText: data.text || data.versets?.[0]?.texte || "",
        };
      }
      return null;
    }
    case "poll": {
      return {
        type: "POLL",
        content: args,
        pollOptions: ["Option 1", "Option 2", "Option 3"],
      };
    }
    case "announce": {
      const res = await fetch(api.url("/api/yeshua-connect/announcements"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: args.split("\n")[0],
          body: args,
          channelId: conversationId,
          userId: "current",
        }),
      });
      return res.ok ? { type: "ANNOUNCEMENT", content: args } : null;
    }
    case "help": {
      return {
        type: "TEXT",
        content: "📖 /bible <référence> — Partager un verset\n📊 /poll <question> — Créer un sondage\n📢 /announce <texte> — Annonce officielle\n🧹 /clear — Vider (admin)\n❓ /help — Aide",
      };
    }
    default:
      return null;
  }
}
