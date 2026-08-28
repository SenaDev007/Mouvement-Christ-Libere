"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Archive, Loader2 } from "lucide-react";

interface UpdateContactStatusButtonProps {
  id: string;
  status: "ANSWERED" | "ARCHIVED";
  icon: "check" | "archive";
}

export function UpdateContactStatusButton({ id, status, icon }: UpdateContactStatusButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleClick = () => {
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/admin/api/contactrequests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur");
        }
        // Recharger la page pour voir le changement
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    });
  };

  const Icon = icon === "check" ? CheckCircle : Archive;
  const hoverColor = icon === "check" ? "hover:bg-emerald-100 hover:text-emerald-700" : "hover:bg-gray-100 hover:text-gray-700";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={status === "ANSWERED" ? "Marquer comme traité" : "Archiver"}
      className={`p-2 rounded-lg text-[#8A8378] ${hoverColor} transition-colors disabled:opacity-50`}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}
