import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  SPRING_FEAST: "Fête de printemps",
  FALL_FEAST: "Fête d'automne",
  SHABBAT: "Shabbat",
  NEW_MOON: "Nouvelle lune",
  OTHER: "Autre",
};

export default async function AdminCalendarPage() {
  const events = await db.liturgicalEvent.findMany({
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#000000] mb-1">
            Calendrier liturgique
          </h1>
          <p className="text-sm text-[#8A857C]">
            Gérez les fêtes bibliques et événements liturgiques.
          </p>
        </div>
        <Link
          href="/admin/calendar/new"
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded bg-[#C9A227] text-[#000000] text-sm font-semibold hover:bg-[#FF7A1A] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel événement
        </Link>
      </div>

      {/* Tableau : conteneur scrollable propre (fin de l'overflow global du main) */}
      <div className="card-gold-top overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-[#000000] text-[#F0E9DE]">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Fête</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Date début</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Date fin</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[#8A857C]/15 hover:bg-[#FF7A1A]/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#8A857C] flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-6 rounded-full" style={{ backgroundColor: e.color }} />
                      <div>
                        <p className="text-sm font-medium text-[#000000]">{e.nameFr}</p>
                        <p className="text-xs text-[#8A857C]">{e.name}{e.nameHe && ` · ${e.nameHe}`}</p>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#8A857C] whitespace-nowrap">{TYPE_LABELS[e.type]}</td>
                <td className="px-4 py-3 text-xs text-[#8A857C] whitespace-nowrap">
                  {new Date(e.startDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-xs text-[#8A857C] whitespace-nowrap">
                  {e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/calendar/${e.id}/edit`}
                      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded hover:bg-[#FF7A1A]/10 text-[#8A857C] hover:text-[#FF7A1A] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="calendar" id={e.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
