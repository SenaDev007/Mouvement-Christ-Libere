"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/lib/api-client";
import { parserReference } from "@/lib/bible/references";

/**
 * SlashCommands — barre de commandes type Discord/Slack.
 *
 * Commands disponibles :
 *   /bible <référence>     — Partager un verset biblique
 *                            (appelle /api/bible-v2/[version]/[livre]/[chapitre]
 *                             puis extrait le ou les versets demandés)
 *   /poll <question>       — Créer un sondage (placeholder V2)
 *   /announce <texte>      — Publier une annonce officielle (placeholder V2)
 *   /clear                 — Vider l'écran de chat (côté client uniquement)
 *   /help                  — Afficher l'aide
 *
 * Usage dans MessagingView :
 *   1. Quand l'input commence par "/", afficher <SlashCommands /> au-dessus
 *      du textarea. L'utilisateur navigue avec ↑/↓, valide avec Entrée ou
 *      clic, échappe avec Échap.
 *   2. On confirm : appeler `executeCommand(cmd, args, convId)` qui retourne
 *      un `SlashCommandResult`. Le caller décide ensuite quoi faire
 *      (envoyer un message, clearer l'écran, etc.).
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
  { name: "clear", description: "Vider l'écran de chat (local)", usage: "/clear", icon: "🧹" },
  { name: "help", description: "Afficher l'aide", usage: "/help", icon: "❓" },
];

interface SlashCommandsProps {
  input: string;
  onCommand: (command: string, args: string) => void;
  onDismiss: () => void;
}

export function SlashCommands({ input, onCommand, onDismiss }: SlashCommandsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extraire le nom de la commande (sans le /) et les args éventuels
  const { cmdName, args } = useMemo(() => parseInput(input), [input]);

  // ⭐ V2.1 — Calcul dérivé (useMemo) plutôt que state + effect, pour éviter
  // les cascading renders signalées par react-hooks/set-state-in-effect.
  // La liste filtrée se recalcule automatiquement quand l'input change.
  const filteredCommands = useMemo<SlashCommand[]>(() => {
    if (!input.startsWith("/")) return [];
    if (!args) {
      return COMMANDS.filter((c) => c.name.startsWith(cmdName));
    }
    // Une fois qu'on a un espace + des args, on montre juste la commande
    // sélectionnée (pour rappeler le usage)
    const cmd = COMMANDS.find((c) => c.name === cmdName);
    return cmd ? [cmd] : [];
  }, [input, cmdName, args]);

  // Clamper selectedIndex dans les bornes de la liste filtrée (sans effect).
  // Si la liste se raccourcit (ex: l'utilisateur tape une commande inconnue),
  // on remet selectedIndex à 0.
  const safeSelectedIndex = filteredCommands.length === 0
    ? 0
    : Math.min(selectedIndex, filteredCommands.length - 1);

  // Dismiss automatique quand l'input ne matche plus (effet autorisé car il
  // appelle un callback du parent, pas un setState local synchrone).
  useEffect(() => {
    if (!input.startsWith("/") || filteredCommands.length === 0) {
      onDismiss();
    }
  }, [input, filteredCommands.length, onDismiss]);

  // Navigation clavier : ↑/↓ pour changer, Entrée pour valider, Échap pour fermer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        // On n'empêche pas le Enter global — le caller gère l'envoi. Mais si
        // une commande est sélectionnée et qu'on tape Entrée alors qu'il n'y
        // a pas encore d'args, on déclenche la commande.
        const cmd = filteredCommands[safeSelectedIndex];
        if (cmd && !args) {
          e.preventDefault();
          onCommand(cmd.name, "");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredCommands, safeSelectedIndex, args, onCommand, onDismiss]);

  if (filteredCommands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-[#8A8378]/20 overflow-hidden z-50"
    >
      <div className="px-4 py-2 bg-[#FAF6EF] border-b border-[#8A8378]/10 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8A8378]">
          Commandes
        </p>
        <p className="text-[10px] text-[#8A8378]/60">
          ↑↓ naviguer · Entrée valider · Échap fermer
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {filteredCommands.map((cmd, i) => (
          <button
            key={cmd.name}
            onClick={() => onCommand(cmd.name, args)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              i === safeSelectedIndex ? "bg-[#C9A227]/10" : "hover:bg-[#FAF6EF]"
            }`}
          >
            <span className="text-xl">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E0F2B]">/{cmd.name}</p>
              <p className="text-xs text-[#8A8378] truncate">{cmd.description}</p>
            </div>
            <span className="text-[10px] text-[#8A8378]/60 font-mono hidden sm:inline">
              {cmd.usage}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Parse "/bible Genèse 1:1" → { cmdName: "bible", args: "Genèse 1:1" } */
function parseInput(input: string): { cmdName: string; args: string } {
  if (!input.startsWith("/")) return { cmdName: "", args: "" };
  const trimmed = input.substring(1);
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { cmdName: trimmed.toLowerCase(), args: "" };
  return {
    cmdName: trimmed.substring(0, spaceIdx).toLowerCase(),
    args: trimmed.substring(spaceIdx + 1).trim(),
  };
}

// ─── Execute command ──────────────────────────────────────────────────────

/** Payload à envoyer comme message (posté via l'API messages). */
export interface SendMessagePayload {
  content: string;
  type?: "TEXT" | "VERSE" | "ANNOUNCEMENT" | "POLL";
  verseRef?: string;
  verseText?: string;
  pollOptions?: string[];
}

/** Action à exécuter après qu'une commande slash a été validée. */
export type SlashCommandResult =
  | { type: "send"; message: SendMessagePayload }
  | { type: "clear" } // clearer l'écran de chat côté client
  | { type: "noop"; toast?: string }; // rien à faire (ex: commande exécutée ailleurs)

const HELP_TEXT = `📖 /bible <référence> — Partager un verset biblique
📊 /poll <question> — Créer un sondage
📢 /announce <texte> — Annonce officielle
🧹 /clear — Vider l'écran de chat (local)
❓ /help — Afficher cette aide`;

/**
 * Execute a slash command and return a structured result.
 *
 * Le caller (MessagingView) inspecte `result.type` :
 *   - "send"  → POST le `result.message` vers l'API messages
 *   - "clear" → vide localement la liste des messages affichés
 *   - "noop"  → rien à faire (toast d'info optionnel)
 */
export async function executeCommand(
  command: string,
  args: string,
  _conversationId: string,
): Promise<SlashCommandResult> {
  switch (command) {
    case "bible": {
      const reference = args.trim();
      if (!reference) {
        return {
          type: "send",
          message: {
            content: "⚠️ Usage : /bible <référence> — exemple : /bible Jean 3:16",
            type: "TEXT",
          },
        };
      }

      const parsed = parserReference(reference);
      if (!parsed) {
        return {
          type: "send",
          message: {
            content: `⚠️ Référence biblique invalide : "${reference}". Exemple valide : /bible Jean 3:16`,
            type: "TEXT",
          },
        };
      }

      // ⭐ Appel à l'API bible-v2 : /api/bible-v2/[version]/[livre]/[chapitre]
      // Version par défaut : fr-apee (Bible de l'Épée en français)
      const version = "fr-apee";
      const url = api.url(
        `/api/bible-v2/${version}/${encodeURIComponent(parsed.livre.id)}/${parsed.chapitre}`,
      );
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          return {
            type: "send",
            message: {
              content: `⚠️ Impossible de charger ${parsed.referenceNormalisee} (erreur ${res.status}).`,
              type: "TEXT",
            },
          };
        }
        const data = await res.json();
        const versets: Array<{ numero: number; texte: string }> = data.versets || [];

        // Extraire le ou les versets demandés (versetDebut..versetFin)
        const fin = parsed.versetFin ?? parsed.versetDebut;
        const selected = versets.filter(
          (v) => v.numero >= parsed.versetDebut && v.numero <= fin,
        );

        if (selected.length === 0) {
          return {
            type: "send",
            message: {
              content: `⚠️ Verset(s) ${parsed.referenceNormalisee} introuvable(s) dans ${data.livre || parsed.livre.nomFr} chapitre ${parsed.chapitre}.`,
              type: "TEXT",
            },
          };
        }

        const verseText = selected
          .map((v) => `${v.numero}. ${v.texte}`)
          .join("\n");

        // Pour l'affichage dans le chat, on garde le content court (référence)
        // et on stocke le texte complet dans verseText (rendu spécial VERSE).
        return {
          type: "send",
          message: {
            content: parsed.referenceNormalisee,
            type: "VERSE",
            verseRef: parsed.referenceNormalisee,
            verseText,
          },
        };
      } catch (e) {
        console.error("[slash bible] error:", e);
        return {
          type: "send",
          message: {
            content: `⚠️ Erreur réseau lors du chargement de ${parsed.referenceNormalisee}.`,
            type: "TEXT",
          },
        };
      }
    }

    case "poll": {
      // Placeholder V2 — on envoie juste la question comme un message texte.
      // (L'UI de sondage dédiée existe déjà via le bouton BarChart3 dans
      // MessagingView.)
      const question = args.trim();
      if (!question) {
        return {
          type: "send",
          message: {
            content: "⚠️ Usage : /poll <question>",
            type: "TEXT",
          },
        };
      }
      return {
        type: "send",
        message: {
          content: `📊 ${question}`,
          type: "TEXT",
        },
      };
    }

    case "announce": {
      // Placeholder V2 — on envoie comme un message ANNOUNCEMENT.
      // (L'UI d'annonces officielles dédiée existe déjà dans le menu.)
      const texte = args.trim();
      if (!texte) {
        return {
          type: "send",
          message: {
            content: "⚠️ Usage : /announce <texte>",
            type: "TEXT",
          },
        };
      }
      return {
        type: "send",
        message: {
          content: `📢 ${texte}`,
          type: "ANNOUNCEMENT",
        },
      };
    }

    case "clear": {
      // Côté client uniquement — le caller vide messages[convId]
      return { type: "clear" };
    }

    case "help": {
      return {
        type: "send",
        message: {
          content: HELP_TEXT,
          type: "TEXT",
        },
      };
    }

    default:
      return {
        type: "noop",
        toast: `Commande inconnue : /${command}`,
      };
  }
}
