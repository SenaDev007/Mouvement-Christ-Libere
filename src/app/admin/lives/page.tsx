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
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Lives
          </h1>
          <p className="text-sm text-[#8A8378]">
            Sessions de streaming programmées et passées.
          </p>
        </div>
        <Link
          href="/admin/lives/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Programmer un live
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2A0E3D] text-[#FAF6EF]">
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
              <tr key={l.id} className="border-b border-[#8A8378]/15 hover:bg-[#C9A227]/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#8A8378] flex-shrink-0" />
                    <p className="text-sm font-medium text-[#1E0F2B]">{l.title}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#1E0F2B]">{l.servant.shortName}</td>
                <td className="px-4 py-3 text-xs text-[#8A8378]">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(l.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} à {" "}
                    {new Date(l.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    l.status === "LIVE"
                      ? "bg-state-danger text-[#FAF6EF] animate-pulse"
                      : l.status === "SCHEDULED"
                        ? "bg-[#C9A227]/15 text-[#A3821C]"
                        : l.status === "ENDED"
                          ? "bg-[#8A8378]/15 text-[#8A8378]"
                          : "bg-state-danger/15 text-state-danger"
                  }`}>
                    {l.status === "LIVE" ? "EN DIRECT" : l.status === "SCHEDULED" ? "Programmé" : l.status === "ENDED" ? "Terminé" : "Annulé"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/lives/${l.id}/edit`}
                      className="p-2 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
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
