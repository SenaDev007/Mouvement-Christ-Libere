"use client";

import { useEffect } from "react";
import { KEYBOARD_SHORTCUTS, type KeyboardShortcut } from "./types";

interface UseKeyboardShortcutsOptions {
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSeekBy: (delta: number) => void;
  onSetTrimStart: () => void;
  onSetTrimEnd: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onExport: () => void;
  onSwitchTab: (tab: string) => void;
  currentTime: number;
  totalDuration: number;
  enabled?: boolean;
}

function matchShortcut(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Ignorer si le focus est dans un input/textarea/select
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    // Sauf pour les raccourcis avec Ctrl (Ctrl+Z, Ctrl+S, etc.)
    if (!shortcut.ctrl) return false;
  }

  const key = e.key === " " ? " " : e.key;
  if (key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (!!e.ctrlKey !== !!shortcut.ctrl && !(e.metaKey && shortcut.ctrl)) return false;
  if (!!e.shiftKey !== !!shortcut.shift) return false;
  if (!!e.altKey !== !!shortcut.alt) return false;
  return true;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of KEYBOARD_SHORTCUTS) {
        if (matchShortcut(e, shortcut)) {
          e.preventDefault();
          e.stopPropagation();

          switch (shortcut.action) {
            case "play-pause":
              options.onPlayPause();
              break;
            case "seek-back-10":
              options.onSeekBy(-10);
              break;
            case "seek-forward-10":
              options.onSeekBy(10);
              break;
            case "seek-back-1":
              options.onSeekBy(-1);
              break;
            case "seek-forward-1":
              options.onSeekBy(1);
              break;
            case "set-trim-start":
              options.onSetTrimStart();
              break;
            case "set-trim-end":
              options.onSetTrimEnd();
              break;
            case "delete-selected":
              options.onDeleteSelected();
              break;
            case "undo":
              options.onUndo();
              break;
            case "redo":
              options.onRedo();
              break;
            case "save-project":
              options.onSaveProject();
              break;
            case "export":
              options.onExport();
              break;
            case "tab-trim":
              options.onSwitchTab("trim");
              break;
            case "tab-text":
              options.onSwitchTab("text");
              break;
            case "tab-image":
              options.onSwitchTab("image");
              break;
            case "tab-subtitles":
              options.onSwitchTab("subtitles");
              break;
            case "tab-transitions":
              options.onSwitchTab("transitions");
              break;
            case "tab-color":
              options.onSwitchTab("color");
              break;
            case "tab-speed":
              options.onSwitchTab("speed");
              break;
            case "tab-transform":
              options.onSwitchTab("transform");
              break;
            case "tab-audio":
              options.onSwitchTab("audio");
              break;
            case "tab-export":
              options.onSwitchTab("export");
              break;
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, options]);
}
