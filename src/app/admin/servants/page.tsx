import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { Crown, Video, FileText, BookOpen, Radio, BookMarked, Radio as RadioIcon, MapPin } from "lucide-react";
import { NewServantButton } from "@/components/admin/create-buttons";
import { ServantEditButton } from "@/components/admin/servant-edit-button";
import { flagFromCountryCode } from "@/lib/data/flags";
import { ensureServantLocationColumns } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

export default async function AdminServantsPage() {
  // ⭐ V3.3 — Auto-réparation des colonnes Servant.pays / Servant.ville
  // (idempotent : sans ça, le findMany ci-dessous échouerait si les colonnes
  // n'existent pas encore en base).
  await ensureServantLocationColumns();

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
          <p className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-1">
            Gestion des serviteurs
          </p>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
            Serviteurs
          </h1>
          <p className="text-sm text-[#BDB4C9] mt-1">
            Gérez les serviteurs principaux du mouvement.
          </p>
        </div>
        <NewServantButton accentColor="#C9A227" />
      </div>

      {/* Cartes serviteurs */}
      <div className="grid md:grid-cols-2 gap-5">
        {servants.map((s) => {
          const isAfrika = s.code === "afrika";
          const accentColor = isAfrika ? "#C9A227" : "#8C5FA8";
          const initials = isAfrika ? "Afrika" : "PK";

          return (
            <div
              key={s.id}
              className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden hover:shadow-lg transition-shadow"
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
                        <h2 className="text-lg font-bold font-serif text-[#FAF6EF]">{s.fullName}</h2>
                        {isAfrika && <Crown className="w-4 h-4 text-[#C9A227]" />}
                      </div>
                      <p className="text-xs uppercase tracking-[0.15em] font-semibold mt-0.5" style={{ color: accentColor }}>
                        {s.shortName} · {s.role}
                      </p>
                      {(s.pays || s.ville) && (
                        <p className="text-xs text-[#FAF6EF]/70 mt-1.5 inline-flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-[#C9A227] flex-shrink-0" />
                          {s.pays ? flagFromCountryCode(s.pays) : ""}{" "}
                          {s.ville || (s.pays ? s.pays : "")}
                        </p>
                      )}
                      {!s.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400/15 text-red-400 mt-2">
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
                      pays: s.pays,
                      ville: s.ville,
                    }}
                  />
                  <Link
                    href={`/admin/servants/${s.id}/stream-config`}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#BDB4C9] hover:text-[#C9A227] transition-colors"
                    aria-label="Configuration streaming"
                    title="Configuration RTMP"
                  >
                    <RadioIcon className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Bio */}
              {s.bio && (
                <div className="px-6 py-3 border-b border-[#C9A227]/10">
                  <p className="text-sm text-[#FAF6EF]/70 line-clamp-2 leading-relaxed">{s.bio}</p>
                </div>
              )}

              {/* Stats grid — 3 colonnes lisibles <640px, 5 à partir de sm */}
              <div className="grid grid-cols-3 sm:grid-cols-5 sm:divide-x divide-[#C9A227]/10">
                <Link href={`/admin/videos?servant=${s.code}`} className="p-3 text-center hover:bg-[#C9A227]/10 transition-colors group">
                  <Video className="w-4 h-4 mx-auto text-[#BDB4C9] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold font-serif text-[#FAF6EF] mt-1">{s._count.videos}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9]">Vidéos</div>
                </Link>
                <Link href={`/admin/testimonies?servant=${s.code}`} className="p-3 text-center hover:bg-[#C9A227]/10 transition-colors group">
                  <FileText className="w-4 h-4 mx-auto text-[#BDB4C9] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold font-serif text-[#FAF6EF] mt-1">{s._count.testimonies}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9]">Témoignages</div>
                </Link>
                <Link href={`/admin/teachings?servant=${s.code}`} className="p-3 text-center hover:bg-[#C9A227]/10 transition-colors group">
                  <BookOpen className="w-4 h-4 mx-auto text-[#BDB4C9] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold font-serif text-[#FAF6EF] mt-1">{s._count.teachings}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9]">Enseignements</div>
                </Link>
                <Link href={`/admin/biographies?servant=${s.code}`} className="p-3 text-center hover:bg-[#C9A227]/10 transition-colors group">
                  <BookMarked className="w-4 h-4 mx-auto text-[#BDB4C9] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold font-serif text-[#FAF6EF] mt-1">{s._count.biographies}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9]">Biographies</div>
                </Link>
                <Link href={`/admin/lives?servant=${s.code}`} className="p-3 text-center hover:bg-[#C9A227]/10 transition-colors group">
                  <Radio className="w-4 h-4 mx-auto text-[#BDB4C9] group-hover:text-[#C9A227] transition-colors" />
                  <div className="text-base font-bold font-serif text-[#FAF6EF] mt-1">{s._count.liveStreams}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9]">Lives</div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {servants.length === 0 && (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-dashed border-[#C9A227]/30 p-12 text-center">
          <p className="text-sm text-[#BDB4C9] italic">Aucun serviteur enregistré pour l&apos;instant.</p>
        </div>
      )}
    </div>
  );
}
