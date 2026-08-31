import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { Crown, Video, FileText, BookOpen, Radio, BookMarked, Radio as RadioIcon } from "lucide-react";
import { NewServantButton } from "@/components/admin/create-buttons";
import { ServantEditButton } from "@/components/admin/servant-edit-button";

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Gestion des serviteurs
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Serviteurs
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Gérez les serviteurs principaux du mouvement.
          </p>
        </div>
        <NewServantButton accentColor="#C9A227" />
      </div>

      {/* Cartes serviteurs */}
      <div className="grid md:grid-cols-2 gap-5">
        {servants.map((s) => {
          const isPam = s.code === "pam";
          const accentColor = isPam ? "#C9A227" : "#8C5FA8";
          const initials = isPam ? "PAM" : "PK";

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-[#8A8378]/15 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* En-tête avec gradient */}
              <div
                className="px-6 py-5 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 100%)`,
                }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"
                  style={{ background: `${accentColor}20` }}
                />
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Photo du serviteur ou initiales fallback */}
                    {s.portraitUrl ? (
                      <Image
                        src={s.portraitUrl}
                        alt={s.fullName}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-2xl object-cover shadow-md"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
                      >
                        {initials}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-[#1E0F2B]">{s.fullName}</h2>
                        {isPam && <Crown className="w-4 h-4 text-[#C9A227]" />}
                      </div>
                      <p className="text-xs uppercase tracking-[0.15em] font-semibold mt-0.5" style={{ color: accentColor }}>
                        {s.shortName} · {s.role}
                      </p>
                      {!s.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 mt-2">
                          Inactif
                        </span>
                      )}
                    </div>
                  </div>
                  <ServantEditButton
                    servant={{
                      id: s.id,
                      code: s.code,
                      fullName: s.fullName,
                      shortName: s.shortName,
                      role: s.role,
                      bio: s.bio,
                      portraitUrl: s.portraitUrl,
                      isActive: s.isActive,
                    }}
                  />
                  <Link
                    href={`/admin/servants/${s.id}/stream-config`}
                    className="p-2 rounded-lg hover:bg-white/60 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                    aria-label="Configuration streaming"
                    title="Configuration RTMP"
                  >
                    <RadioIcon className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Bio */}
              {s.bio && (
                <div className="px-6 py-3 border-b border-[#8A8378]/10">
                  <p className="text-sm text-[#1E0F2B]/70 line-clamp-2 leading-relaxed">{s.bio}</p>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-5 divide-x divide-[#8A8378]/10">
                <Link href={`/admin/videos?servant=${s.code}`} className="p-3 text-center hover:bg-[#FAF6EF] transition-colors group">
                  <Video className="w-4 h-4 mx-auto text-[#8A8378] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold text-[#1E0F2B] mt-1">{s._count.videos}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Vidéos</div>
                </Link>
                <Link href={`/admin/testimonies?servant=${s.code}`} className="p-3 text-center hover:bg-[#FAF6EF] transition-colors group">
                  <FileText className="w-4 h-4 mx-auto text-[#8A8378] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold text-[#1E0F2B] mt-1">{s._count.testimonies}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Témoig.</div>
                </Link>
                <Link href={`/admin/teachings?servant=${s.code}`} className="p-3 text-center hover:bg-[#FAF6EF] transition-colors group">
                  <BookOpen className="w-4 h-4 mx-auto text-[#8A8378] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold text-[#1E0F2B] mt-1">{s._count.teachings}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Enseig.</div>
                </Link>
                <Link href={`/admin/biographies?servant=${s.code}`} className="p-3 text-center hover:bg-[#FAF6EF] transition-colors group">
                  <BookMarked className="w-4 h-4 mx-auto text-[#8A8378] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold text-[#1E0F2B] mt-1">{s._count.biographies}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Biog.</div>
                </Link>
                <Link href={`/admin/lives?servant=${s.code}`} className="p-3 text-center hover:bg-[#FAF6EF] transition-colors group">
                  <Radio className="w-4 h-4 mx-auto text-[#8A8378] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold text-[#1E0F2B] mt-1">{s._count.liveStreams}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#8A8378]">Lives</div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {servants.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <p className="text-sm text-[#8A8378] italic">Aucun serviteur enregistré pour l&apos;instant.</p>
        </div>
      )}
    </div>
  );
}
