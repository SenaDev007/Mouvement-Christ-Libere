import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Radio, Calendar } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminLivesPage() {
  const lives = await db.liveStream.findMany({
    orderBy: { scheduledAt: "desc" },
    include: { servant: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Lives
          </h1>
          <p className="text-sm text-stone">
            Sessions de streaming programmées et passées.
          </p>
        </div>
        <Link
          href="/admin/lives/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Programmer un live
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Titre</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Serviteur</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Date</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Statut</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lives.map((l) => (
              <tr key={l.id} className="border-b border-stone/15 hover:bg-gold/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-stone flex-shrink-0" />
                    <p className="text-sm font-medium text-ink">{l.title}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-ink">{l.servant.shortName}</td>
                <td className="px-4 py-3 text-xs text-stone">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(l.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} à {" "}
                    {new Date(l.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    l.status === "LIVE"
                      ? "bg-state-danger text-ivory animate-pulse"
                      : l.status === "SCHEDULED"
                        ? "bg-gold/15 text-gold-dark"
                        : l.status === "ENDED"
                          ? "bg-stone/15 text-stone"
                          : "bg-state-danger/15 text-state-danger"
                  }`}>
                    {l.status === "LIVE" ? "EN DIRECT" : l.status === "SCHEDULED" ? "Programmé" : l.status === "ENDED" ? "Terminé" : "Annulé"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/lives/${l.id}/edit`}
                      className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="lives" id={l.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
