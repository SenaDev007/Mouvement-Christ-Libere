import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Pencil, Video, Radio } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const videos = await db.video.findMany({
    orderBy: { createdAt: "desc" },
    include: { servant: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Vidéos
          </h1>
          <p className="text-sm text-[#8A8378]">
            Vidéos archivées et lives enregistrés.
          </p>
        </div>
        <Link
          href="/admin/videos/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle vidéo
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => (
          <div key={v.id} className="card-gold-top p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded bg-[#2A0E3D]/10 flex-shrink-0">
                {v.isLive ? (
                  <Radio className="w-4 h-4 text-state-danger" />
                ) : (
                  <Video className="w-4 h-4 text-[#2A0E3D]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1E0F2B] line-clamp-2">{v.title}</p>
                <p className="text-xs text-[#8A8378] mt-1">
                  {v.servant.shortName} · {v.duration} · {v.views.toLocaleString("fr-FR")} vues
                </p>
                {v.isLive && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-state-danger text-[#FAF6EF] animate-pulse">
                    EN DIRECT
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#8A8378]/15">
              <Link
                href={`/admin/videos/${v.id}/edit`}
                className="p-2 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                aria-label="Modifier"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
              <DeleteButton entity="videos" id={v.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
