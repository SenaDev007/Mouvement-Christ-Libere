"use client";

/**
 * ⭐ V3.74 — Cloche de notifications de l'espace Secrétariat.
 *
 * Directive : « quand le serviteur valide la demande, la secrétaire reçoit
 * une notification ». Ce composant vit dans l'en-tête de la sidebar de
 * l'espace (visible sur TOUTES les pages) :
 *  · badge doré = notifications non lues (polling 60 s) ;
 *  · panneau déroulant : titre, message, lien direct, date relative ;
 *  · « tout marquer lu » (les notifications lues restent visibles 7 j).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

interface NotificationStaff {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  lien: string | null;
  readAt: string | null;
  createdAt: string;
}

function dateRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

export function ClocheNotifications({
  prefixeEspace = "/secretariat",
}: {
  prefixeEspace?: string;
}) {
  const [nonLues, setNonLues] = useState(0);
  const [items, setItems] = useState<NotificationStaff[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [marquageEnCours, setMarquageEnCours] = useState(false);
  const panneauRef = useRef<HTMLDivElement | null>(null);
  const boutonRef = useRef<HTMLButtonElement | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${prefixeEspace}/api/notifications`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setNonLues(data.nonLues || 0);
      setItems(data.items || []);
    } catch {
      // silencieux : la cloche n'est pas critique.
    }
  }, [prefixeEspace]);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 60_000);
    return () => clearInterval(t);
  }, [charger]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    const handler = (e: MouseEvent) => {
      if (
        panneauRef.current &&
        !panneauRef.current.contains(e.target as Node) &&
        boutonRef.current &&
        !boutonRef.current.contains(e.target as Node)
      ) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ouvert]);

  const marquerToutLu = async () => {
    setMarquageEnCours(true);
    try {
      await fetch(`${prefixeEspace}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marquerLues" }),
      });
      await charger();
    } catch {
      // silencieux.
    } finally {
      setMarquageEnCours(false);
    }
  };

  const ouvrirPanneau = async () => {
    const nouveau = !ouvert;
    setOuvert(nouveau);
    if (nouveau) {
      setChargement(true);
      await charger();
      setChargement(false);
    }
  };

  // Notifications des 7 derniers jours (les plus anciennes restent lues).
  const visibles = items.filter(
    (n) => Date.now() - new Date(n.createdAt).getTime() < 7 * 24 * 3600_000
  );

  return (
    <div className="relative">
      <button
        ref={boutonRef}
        onClick={ouvrirPanneau}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg text-[#F0E9DE]/70 hover:text-[#F0E9DE] hover:bg-[#F0E9DE]/10 transition-colors"
        aria-label={`Notifications${nonLues > 0 ? ` (${nonLues} non lues)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {nonLues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#C9A227] text-[#000000] text-[10px] font-bold flex items-center justify-center">
            {nonLues > 99 ? "99+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          ref={panneauRef}
          className="absolute left-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white border border-[#8A857C]/20 shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#8A857C]/10 bg-[#F0E9DE]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#000000]">
              Notifications
            </p>
            {nonLues > 0 && (
              <button
                onClick={marquerToutLu}
                disabled={marquageEnCours}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#A3821C] hover:text-[#000000] transition-colors disabled:opacity-50"
              >
                {marquageEnCours ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {chargement ? (
              <div className="flex items-center justify-center py-8 text-[#8A857C]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-8 text-xs text-[#8A857C] text-center">
                Aucune notification — vous serez prévenue dès qu&apos;un
                serviteur valide une demande.
              </p>
            ) : (
              <ul className="divide-y divide-[#8A857C]/10">
                {visibles.map((n) => {
                  const contenu = (
                    <div className="px-4 py-3 hover:bg-[#F0E9DE]/60 transition-colors">
                      <div className="flex items-start gap-2">
                        {!n.readAt && (
                          <span className="w-2 h-2 rounded-full bg-[#C9A227] flex-shrink-0 mt-1.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold leading-tight ${
                              n.readAt ? "text-[#8A857C]" : "text-[#000000]"
                            }`}
                          >
                            {n.titre}
                          </p>
                          {n.message && (
                            <p className="text-[11px] text-[#8A857C] leading-relaxed mt-0.5">
                              {n.message}
                            </p>
                          )}
                          <p className="text-[10px] text-[#8A857C]/60 mt-1">
                            {dateRelative(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.lien ? (
                        <Link
                          href={n.lien}
                          onClick={() => setOuvert(false)}
                          className="block"
                        >
                          {contenu}
                        </Link>
                      ) : (
                        contenu
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
