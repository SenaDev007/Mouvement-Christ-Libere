import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminServantsPage() {
  const servants = await db.servant.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          biographies: true,
          testimonies: true,
          teachings: true,
          videos: true,
          liveStreams: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Serviteurs
          </h1>
          <p className="text-sm text-stone">
            Gérez les deux serviteurs principaux (PAM et Pasteur Kongo).
          </p>
        </div>
        <Link
          href="/admin/servants/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau serviteur
        </Link>
      </div>

      <div className="grid gap-4">
        {servants.map((s) => (
          <div key={s.id} className="card-gold-top p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-gold bg-gold/10 flex-shrink-0">
                  <span className="font-serif text-sm font-semibold text-gold">
                    {s.code === "pam" ? "AP" : "PK"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-semibold text-ink">
                      {s.fullName}
                    </h2>
                    {!s.isActive && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-state-danger font-semibold">
                        Inactif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone uppercase tracking-[0.18em] font-semibold mt-0.5">
                    {s.shortName} · {s.role}
                  </p>
                  <p className="text-sm text-ink/70 mt-2 line-clamp-2">{s.bio}</p>

                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-stone">
                    <span>{s._count.biographies} biographies</span>
                    <span>· {s._count.testimonies} témoignages</span>
                    <span>· {s._count.teachings} enseignements</span>
                    <span>· {s._count.videos} vidéos</span>
                    <span>· {s._count.liveStreams} lives</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-4">
                <Link
                  href={`/admin/servants/${s.id}/edit`}
                  className="p-2 rounded hover:bg-gold/10 text-stone hover:text-gold transition-colors"
                  aria-label="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
