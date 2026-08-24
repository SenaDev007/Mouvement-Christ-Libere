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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Calendrier liturgique
          </h1>
          <p className="text-sm text-stone">
            Gérez les fêtes bibliques et événements liturgiques.
          </p>
        </div>
        <Link
          href="/admin/calendar/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel événement
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Fête</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Type</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Date début</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Date fin</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-stone/15 hover:bg-gold/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-stone flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-6 rounded-full" style={{ backgroundColor: e.color }} />
                      <div>
                        <p className="text-sm font-medium text-ink">{e.nameFr}</p>
                        <p className="text-xs text-stone">{e.name}{e.nameHe && ` · ${e.nameHe}`}</p>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-stone">{TYPE_LABELS[e.type]}</td>
                <td className="px-4 py-3 text-xs text-stone">
                  {new Date(e.startDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-xs text-stone">
                  {e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/calendar/${e.id}/edit`}
                      className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
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
  );
}
