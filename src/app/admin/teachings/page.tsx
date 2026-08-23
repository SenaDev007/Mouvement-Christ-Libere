import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, BookOpen } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminTeachingsPage() {
  const teachings = await db.teaching.findMany({
    orderBy: { createdAt: "desc" },
    include: { servant: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Enseignements
          </h1>
          <p className="text-sm text-stone">
            Études bibliques classées par thème, livre et niveau.
          </p>
        </div>
        <Link
          href="/admin/teachings/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel enseignement
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Titre</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Serviteur</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Thème</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Niveau</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachings.map((t) => (
              <tr key={t.id} className="border-b border-stone/15 hover:bg-gold/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-stone flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-ink">{t.title}</p>
                      <p className="text-xs text-stone line-clamp-1">{t.excerpt}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-ink">{t.servant.shortName}</td>
                <td className="px-4 py-3 text-xs text-stone">{t.theme}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-lavender/15 text-lavender">
                    {t.level === "DECOUVERTE" ? "Découverte" : t.level === "INTERMEDIAIRE" ? "Intermédiaire" : "Avancé"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/teachings/${t.id}/edit`}
                      className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="teachings" id={t.id} />
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
