import { db } from "@/lib/db";
import { ensureIntercessionAudioColumns, ensureIntercessionContactColumns } from "@/lib/ensure-schema";
import { Heart, Flame, CheckCircle2, Archive, HandHeart, Lock, AudioLines, MapPin, Phone, Mail } from "lucide-react";
import { IntercessionActions } from "@/components/admin/intercession-actions";

export const dynamic = "force-dynamic";

/**
 * ⭐ V3.2 — BACK-OFFICE INTERCESSION (demande explicite) :
 * « toute demande est dirigée directement dans le back-office — aucune
 * demande ne doit rester publique ». Cette page reçoit et gère toutes les
 * demandes déposées depuis la page publique /intercession : l'équipe
 * pastorale les lit (nom, sujet, description, urgence), les marque « en
 * prière » / « exaucé », enregistre les témoignages d'exaucement.
 *
 * ⭐ V3.32 — LOCALISATION + CONTACT : chaque carte affiche désormais le pays,
 * la ville, le téléphone et l'email de la personne (demande du pasteur :
 * « savoir d'où vient la personne qui fait la demande »). Téléphone et email
 * sont cliquables (appel / mail direct).
 *
 * ⭐ V3.32 — RESPONSIVE MOBILE (capture utilisateur) : sur téléphone, la
 * rangée de 5 boutons d'actions écrasait le texte (~50px restants) et les
 * filtres se repliaient en désordre. Désormais :
 *   - les actions passent en PIED DE CARTE sur une ligne dédiée (bordure
 *     haute), le contenu garde toute la largeur ;
 *   - les filtres défilent horizontalement (une seule ligne, jamais repliée) ;
 *   - le lecteur audio garde sa hauteur naturelle (plus de rognage h-10).
 */

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  ouvert: { label: "Ouvert", color: "bg-[#8A8378]/15 text-[#8A8378] border-[#8A8378]/25" },
  en_priere: { label: "En prière", color: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30" },
  exauce: { label: "Exaucé", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  archive: { label: "Archivé", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

const CATEGORIE_LABELS: Record<string, string> = {
  general: "Général",
  sante: "Santé",
  famille: "Famille",
  spiritual: "Spirituel",
  action_graces: "Action de grâces",
};

export default async function AdminIntercessionPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut: statutFilter = "tous" } = await searchParams;

  // ⭐ V3.30.1 — Auto-réparation des colonnes audio AVANT lecture (P2022 :
  // « The column IntercessionRequest.audioUrl does not exist » → 500 « Une
  // erreur est survenue » dès l'entrée du module, tant qu'aucune demande
  // n'a été déposée depuis le déploiement V3.30). Même garde que le POST
  // /api/intercession, qui l'avait déjà.
  // ⭐ V3.32 — Idem colonnes pays/ville/telephone/email.
  await ensureIntercessionAudioColumns();
  await ensureIntercessionContactColumns();

  const where =
    statutFilter !== "tous" && statutFilter !== ""
      ? { statut: statutFilter }
      : {};

  const [demandes, all] = await Promise.all([
    db.intercessionRequest.findMany({
      where,
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.intercessionRequest.findMany({ select: { statut: true } }),
  ]);

  const stats = {
    total: all.length,
    enPriere: all.filter((d) => d.statut === "en_priere").length,
    exauces: all.filter((d) => d.statut === "exauce").length,
    archives: all.filter((d) => d.statut === "archive").length,
  };

  const FILTERS = [
    { id: "tous", label: "Toutes" },
    { id: "ouvert", label: "Ouvertes" },
    { id: "en_priere", label: "En prière" },
    { id: "exauce", label: "Exaucées" },
    { id: "archive", label: "Archivées" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#C9A227]" />
          Espace confidentiel
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
          style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        >
          Demandes d&apos;intercession
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Toutes les demandes de prière déposées depuis le site arrivent ici — elles ne sont
          visibles que par l&apos;administration et l&apos;équipe pastorale.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5 flex items-center gap-1">
            <Heart className="w-3 h-3" /> Total reçues
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.enPriere}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5 flex items-center gap-1">
            <HandHeart className="w-3 h-3" /> En prière
          </div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/50 p-4">
          <div className="text-2xl font-bold text-emerald-700">{stats.exauces}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Exaucées
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.archives}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5 flex items-center gap-1">
            <Archive className="w-3 h-3" /> Archivées
          </div>
        </div>
      </div>

      {/* Filtres — ⭐ V3.32 : défilement horizontal sur mobile (une seule
          ligne, plus de repli désordonné des pastilles) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-discrete pb-1">
        {FILTERS.map((f) => (
          <a
            key={f.id}
            href={`/admin/intercession?statut=${f.id}`}
            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statutFilter === f.id
                ? "bg-[#2A0E3D] text-[#FAF6EF]"
                : "border border-[#2A0E3D]/25 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Liste */}
      {demandes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <Heart className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">
            Aucune demande {statutFilter !== "tous" ? "dans ce statut " : ""}pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {demandes.map((d) => {
            const statut = STATUT_CONFIG[d.statut] || STATUT_CONFIG.ouvert;
            // ⭐ V3.32 — Localisation + contact (facultatifs).
            const localisation = [d.ville, d.pays].filter(Boolean).join(", ");
            return (
              <div
                key={d.id}
                className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                  d.isUrgent ? "border-state-danger/40" : "border-[#8A8378]/15"
                }`}
              >
                {/* En-tête : avatar + titre + statut — le contenu garde toute
                    la largeur, le statut reste à droite */}
                <div className="flex items-start gap-3">
                  {/* Avatar initiales */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                    style={{
                      background: d.isUrgent
                        ? "linear-gradient(135deg, #D05050, #A03A3A)"
                        : "linear-gradient(135deg, #C9A227, #A3821C)",
                    }}
                  >
                    {(d.auteur || "?").charAt(0).toUpperCase()}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#1E0F2B] min-w-0 break-words flex items-center gap-2 flex-wrap">
                        {d.sujet}
                        {d.isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-state-danger text-white flex-shrink-0">
                            <Flame className="w-2.5 h-2.5" /> URGENT
                          </span>
                        )}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${statut.color}`}
                      >
                        {statut.label}
                      </span>
                    </div>

                    <p className="text-xs text-[#8A8378] mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>
                        par <span className="font-semibold text-[#1E0F2B]">{d.auteur}</span>
                      </span>
                      <span aria-hidden>·</span>
                      <span>{CATEGORIE_LABELS[d.categorie] || d.categorie}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {new Date(d.createdAt).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>

                    {/* ⭐ V3.32 — Localisation : d'où vient la demande */}
                    {localisation && (
                      <p className="text-xs text-[#8A8378] mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                        <span className="font-semibold text-[#1E0F2B]/80">{localisation}</span>
                      </p>
                    )}

                    {/* ⭐ V3.32 — Contacts cliquables (appel / mail direct) */}
                    {(d.telephone || d.email) && (
                      <p className="text-xs mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {d.telephone && (
                          <a
                            href={`tel:${d.telephone}`}
                            className="inline-flex items-center gap-1 text-[#8C5FA8] hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {d.telephone}
                          </a>
                        )}
                        {d.email && (
                          <a
                            href={`mailto:${d.email}`}
                            className="inline-flex items-center gap-1 text-[#8C5FA8] hover:underline break-all"
                          >
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {d.email}
                          </a>
                        )}
                      </p>
                    )}

                    <p className="text-sm text-[#1E0F2B]/80 leading-relaxed mt-2 whitespace-pre-wrap">
                      {d.description}
                    </p>

                    {/* ⭐ V3.30 — Note vocale : lecteur direct dans le back-office */}
                    {d.audioUrl && (
                      <div className="mt-3 p-3 bg-[#C9A227]/5 border border-[#C9A227]/25 rounded-xl">
                        <p className="text-[11px] font-bold text-[#A3821C] mb-1.5 flex items-center gap-1.5">
                          <AudioLines className="w-3.5 h-3.5" />
                          Note vocale
                          {d.audioDuration
                            ? ` · ${Math.floor(d.audioDuration / 60)}:${String(Math.round(d.audioDuration % 60)).padStart(2, "0")}`
                            : ""}
                          {d.audioSize ? ` · ${Math.round(d.audioSize / 1024)} Ko` : ""}
                        </p>
                        {/* ⭐ V3.32 — hauteur naturelle (fini le rognage h-10
                            des contrôles sur petits écrans) */}
                        <audio controls src={d.audioUrl} preload="metadata" className="w-full" />
                      </div>
                    )}

                    {d.temoignageExaucement && (
                      <div className="mt-3 p-3 bg-state-success/5 border border-state-success/20 rounded-xl">
                        <p className="text-[11px] font-bold text-state-success mb-0.5">
                          Témoignage d&apos;exaucement
                        </p>
                        <p className="text-xs text-[#1E0F2B]/70 italic">
                          « {d.temoignageExaucement} »
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ⭐ V3.32 — Actions en PIED DE CARTE (capture utilisateur :
                    sur mobile, la rangée de 5 boutons écrasait le texte).
                    Ligne dédiée pleine largeur, bordure haute, jamais de
                    collision avec le contenu. */}
                <div className="mt-2 pt-2 border-t border-[#8A8378]/10">
                  <IntercessionActions
                    id={d.id}
                    statut={d.statut}
                    temoignageExaucement={d.temoignageExaucement}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {demandes.length > 0 && (
        <p className="text-[11px] text-[#8A8378]">
          {demandes.length} demande{demandes.length > 1 ? "s" : ""} affichée
          {demandes.length > 1 ? "s" : ""} — les demandes ne sont JAMAIS visibles publiquement.
        </p>
      )}
    </div>
  );
}
