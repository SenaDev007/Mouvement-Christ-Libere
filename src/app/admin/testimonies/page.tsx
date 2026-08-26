import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, FileText } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminTestimoniesPage() {
  const testimonies = await db.testimony.findMany({
    orderBy: { createdAt: "desc" },
    include: { servant: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Témoignages
          </h1>
          <p className="text-sm text-[#8A8378]">
            Récits d&apos;expériences spirituelles — gestion et modération.
          </p>
        </div>
        <Link
          href="/admin/testimonies/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau témoignage
        </Link>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2A0E3D] text-[#FAF6EF]">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Titre</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Serviteur</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Statut</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Date</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonies.map((t) => (
              <tr key={t.id} className="border-b border-[#8A8378]/15 hover:bg-[#C9A227]/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#8A8378] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#1E0F2B]">{t.title}</p>
                      <p className="text-xs text-[#8A8378] line-clamp-1">{t.short}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#1E0F2B]">{t.servant.shortName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === "CONFIRMED"
                      ? "bg-state-success/15 text-state-success"
                      : t.status === "TO_DISCERN"
                        ? "bg-[#C9A227]/15 text-[#A3821C]"
                        : "bg-[#8A8378]/15 text-[#8A8378]"
                  }`}>
                    {t.status === "CONFIRMED" ? "Confirmé" : t.status === "TO_DISCERN" ? "À discerner" : "Archivé"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#8A8378]">
                  {t.publishedAt ? new Date(t.publishedAt).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/testimonies/${t.id}/edit`}
                      className="p-2 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="testimonies" id={t.id} />
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
