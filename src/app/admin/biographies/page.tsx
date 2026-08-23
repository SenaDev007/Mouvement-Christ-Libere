import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminBiographiesPage() {
  const biographies = await db.biography.findMany({
    orderBy: [{ servantId: "asc" }, { order: "asc" }],
    include: { servant: true },
  });

  // Grouper par serviteur
  const byServant = biographies.reduce((acc, b) => {
    const key = b.servant.shortName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {} as Record<string, typeof biographies>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Biographies
          </h1>
          <p className="text-sm text-stone">
            Frises chronologiques des serviteurs.
          </p>
        </div>
        <Link
          href="/admin/biographies/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau jalon
        </Link>
      </div>

      {Object.entries(byServant).map(([servantName, items]) => (
        <div key={servantName} className="card-gold-top p-6">
          <h2 className="font-serif text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gold" />
            {servantName}
            <span className="text-xs text-stone font-sans">({items.length} jalons)</span>
          </h2>
          <div className="space-y-3">
            {items.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between py-3 border-b border-stone/15 last:border-0"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gold/40 bg-gold/5 flex-shrink-0">
                    <span className="text-[10px] font-semibold text-gold">{b.order}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-gold-dark font-semibold">
                        {b.date}
                      </span>
                    </div>
                    <p className="font-serif text-sm font-semibold text-ink mt-0.5">
                      {b.title}
                    </p>
                    <p className="text-xs text-stone line-clamp-2 mt-1">{b.description}</p>
                    {b.verseRef && (
                      <p className="text-[10px] text-stone mt-1 italic">
                        « {b.verseRef} »
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Link
                    href={`/admin/biographies/${b.id}/edit`}
                    className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
                    aria-label="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <DeleteButton entity="biographies" id={b.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
