import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import {
  Users, FileText, BookOpen, Video, MessageSquare, Inbox, Heart,
  Radio, Calendar, TrendingUp, ArrowUpRight, Clock, Crown
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Timeout 30s (Vercel serverless)

async function getStats() {
  const [
    servants, biographies, testimonies, teachings, videos, channels,
    donations, liveStreams, pendingTestimonies,
    meetingTransmises,
    afrikaServant, kongoServant,
    totalDonations, totalViews,
    recentTestimonies, recentMeetingRequests, upcomingLives,
  ] = await Promise.all([
    db.servant.count(),
    db.biography.count(),
    db.testimony.count(),
    db.teaching.count(),
    db.video.count(),
    db.channel.count(),
    db.donation.count(),
    db.liveStream.count(),
    db.testimony.count({ where: { status: "TO_DISCERN" } }),
    // ⭐ V3.74 — « Demandes de contact » remplacées par les demandes de
    // rencontre TRANSMISES par la secrétaire (réception /admin/demandes).
    db.meetingRequest.count({ where: { status: "TRANSMISE" } }),
    db.servant.findFirst({ where: { code: "afrika" }, include: { _count: { select: { videos: true, testimonies: true, teachings: true } } } }),
    db.servant.findFirst({ where: { code: "kongo" }, include: { _count: { select: { videos: true, testimonies: true, teachings: true } } } }),
    db.donation.aggregate({ _sum: { amount: true } }),
    db.video.aggregate({ _sum: { views: true } }),
    db.testimony.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { servant: true } }),
    db.meetingRequest.findMany({
      take: 5,
      orderBy: { transmittedAt: "desc" },
      where: { status: "TRANSMISE" },
      select: { id: true, requesterName: true, servantCode: true, subject: true, urgency: true, transmittedAt: true, createdAt: true },
    }),
    db.liveStream.findMany({ take: 3, where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, include: { servant: true } }),
  ]);

  return {
    servants, biographies, testimonies, teachings, videos, channels,
    donations, liveStreams, pendingTestimonies, meetingTransmises,
    totalDonationsAmount: totalDonations._sum.amount || 0,
    totalViews: totalViews._sum.views || 0,
    afrika: afrikaServant,
    kongo: kongoServant,
    recentTestimonies,
    recentMeetingRequests,
    upcomingLives,
  };
}

export default async function AdminDashboardPage() {
  // ⭐ V3.74 — tables du flux des demandes (staff) vérifiées/créées ;
  // ContactRequest disparu (DROP idempotent côté base).
  await ensureStaffSpaces();
  const stats = await getStats();

  // Cards principales (KPIs)
  const kpiCards = [
    { label: "Serviteurs", value: stats.servants, icon: Users, href: "/admin/servants", color: "from-[#C9A227] to-[#A3821C]", bg: "bg-[#C9A227]/10" },
    { label: "Témoignages", value: stats.testimonies, icon: FileText, href: "/admin/testimonies", color: "from-[#8C5FA8] to-[#6B4480]", bg: "bg-[#8C5FA8]/10", badge: stats.pendingTestimonies > 0 ? `${stats.pendingTestimonies} à discerner` : null },
    { label: "Enseignements", value: stats.teachings, icon: BookOpen, href: "/admin/teachings", color: "from-[#5B7052] to-[#3F5039]", bg: "bg-[#5B7052]/10" },
    { label: "Vidéos", value: stats.videos, icon: Video, href: "/admin/videos", color: "from-[#C9A227] to-[#A3821C]", bg: "bg-[#C9A227]/10", sub: `${stats.totalViews.toLocaleString("fr-FR")} vues` },
    { label: "Dons", value: stats.donations, icon: Heart, href: "/admin/donations", color: "from-[#8C5FA8] to-[#6B4480]", bg: "bg-[#8C5FA8]/10", sub: `${stats.totalDonationsAmount.toFixed(0)} €` },
    { label: "Demandes reçues", value: stats.meetingTransmises, icon: Inbox, href: "/admin/demandes", color: "from-[#5B7052] to-[#3F5039]", bg: "bg-[#5B7052]/10", sub: "transmises par le secrétariat" },
  ];

  // Cards secondaires
  const secondaryCards = [
    { label: "Biographies", value: stats.biographies, icon: BookOpen, href: "/admin/biographies" },
    { label: "Lives", value: stats.liveStreams, icon: Radio, href: "/admin/lives" },
    { label: "Canaux", value: stats.channels, icon: MessageSquare, href: "/admin/channels" },
  ];

  return (
    <div className="space-y-8">
      {/* ⭐ V3.98 — Hero Win Agro : violet impérial + grain + halos + badge ping */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] bg-grain-dark p-6 md:p-8 text-white shadow-xl border border-[#C9A227]/15">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8C5FA8]/10 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#DDBE55] font-semibold mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DDBE55] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A227]" />
              </span>
              Tableau de bord
            </p>
            <h1 className="text-2xl md:text-3xl font-bold font-serif mb-1">
              Bienvenue dans votre{" "}
              <span className="relative inline-block">
                espace
                <span className="absolute left-0 -bottom-1 h-[3px] w-full bg-gradient-to-r from-[#C9A227] to-transparent" />
              </span>
            </h1>
            <p className="text-sm text-white/70">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A0826]/10 backdrop-blur-sm border border-[#C9A227]/25">
            <TrendingUp className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs font-semibold">{stats.videos} vidéos · {stats.totalViews.toLocaleString("fr-FR")} vues</span>
          </div>
        </div>
      </div>

      {/* KPI Cards principales */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-3 px-1">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group relative bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 hover:border-[#C9A227]/40 hover:shadow-lg transition-all overflow-hidden"
              >
                {/* Accent bar top */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-80`} />

                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <Icon className="w-4 h-4 text-[#DDBE55]" />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#FAF6EF]/25 group-hover:text-[#C9A227] transition-colors" />
                </div>

                <div className="text-2xl font-black font-serif text-[#FAF6EF] leading-tight">
                  {stat.value}
                </div>
                <div className="text-[11px] text-[#BDB4C9] mt-0.5">
                  {stat.label}
                </div>
                {stat.sub && (
                  <div className="text-[10px] text-[#DDBE55] font-semibold mt-1">
                    {stat.sub}
                  </div>
                )}
                {stat.badge && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-[#C9A227]/15 text-[#DDBE55] border border-[#C9A227]/30">
                    {stat.badge}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Cards secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {secondaryCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group flex items-center gap-3 bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-3 hover:border-[#C9A227]/40 transition-colors"
            >
              <div className="p-2 rounded-lg bg-[#C9A227]/10">
                <Icon className="w-4 h-4 text-[#DDBE55]" />
              </div>
              <div>
                <div className="text-lg font-bold font-serif text-[#FAF6EF] leading-tight">{stat.value}</div>
                <div className="text-[10px] text-[#BDB4C9]">{stat.label}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Section serviteurs (Afrika & Kongo) */}
      <div className="grid md:grid-cols-2 gap-4">
        {stats.afrika && (
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#C9A227]/10 to-transparent border-b border-[#C9A227]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C9A227]/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-[#C9A227]" />
                </div>
                <div>
                  <div className="font-bold font-serif text-[#FAF6EF]">{stats.afrika.shortName}</div>
                  <div className="text-xs text-[#BDB4C9]">{stats.afrika.role}</div>
                </div>
              </div>
              <Link href="/admin/servants" className="text-xs text-[#C9A227] font-semibold hover:underline">
                Gérer →
              </Link>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#C9A227]/10">
              <Link href="/admin/videos?servant=afrika" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.afrika._count.videos}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Vidéos</div>
              </Link>
              <Link href="/admin/testimonies?servant=afrika" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.afrika._count.testimonies}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Témoignages</div>
              </Link>
              <Link href="/admin/teachings?servant=afrika" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.afrika._count.teachings}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Enseignements</div>
              </Link>
            </div>
          </div>
        )}
        {stats.kongo && (
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#8C5FA8]/10 to-transparent border-b border-[#C9A227]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#8C5FA8]/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-[#C9AEE3]" />
                </div>
                <div>
                  <div className="font-bold font-serif text-[#FAF6EF]">{stats.kongo.shortName}</div>
                  <div className="text-xs text-[#BDB4C9]">{stats.kongo.role}</div>
                </div>
              </div>
              <Link href="/admin/servants" className="text-xs text-[#C9AEE3] font-semibold hover:underline">
                Gérer →
              </Link>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#C9A227]/10">
              <Link href="/admin/videos?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.kongo._count.videos}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Vidéos</div>
              </Link>
              <Link href="/admin/testimonies?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.kongo._count.testimonies}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Témoignages</div>
              </Link>
              <Link href="/admin/teachings?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#C9A227]/10 transition-colors">
                <div className="text-xl font-bold font-serif text-[#FAF6EF]">{stats.kongo._count.teachings}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#BDB4C9] mt-0.5">Enseignements</div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Activité récente : 2 colonnes */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Témoignages récents */}
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#C9A227]/10">
            <h2 className="font-bold font-serif text-[#FAF6EF] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C9A227]" />
              Témoignages récents
            </h2>
            <Link href="/admin/testimonies" className="text-xs font-semibold text-[#C9A227] hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="divide-y divide-[#C9A227]/10">
            {stats.recentTestimonies.length === 0 ? (
              <p className="text-sm text-[#BDB4C9] italic p-5 text-center">Aucun témoignage.</p>
            ) : (
              stats.recentTestimonies.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#C9A227]/10 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-[#FAF6EF] truncate">{t.title}</p>
                    <p className="text-xs text-[#BDB4C9] flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold">{t.servant.shortName}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    t.status === "CONFIRMED"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-[#C9A227]/15 text-[#DDBE55]"
                  }`}>
                    {t.status === "CONFIRMED" ? "Confirmé" : "À discerner"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Demandes transmises par la secrétaire (⭐ V3.74 — remplace
            « Demandes de contact » : le serviteur les réceptionne et les
            valide dans /admin/demandes) */}
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#C9A227]/10">
            <h2 className="font-bold font-serif text-[#FAF6EF] flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#A3C9B0]" />
              Demandes transmises
            </h2>
            <Link href="/admin/demandes" className="text-xs font-semibold text-[#A3C9B0] hover:underline">
              Réceptionner →
            </Link>
          </div>
          <div className="divide-y divide-[#C9A227]/10">
            {stats.recentMeetingRequests.length === 0 ? (
              <p className="text-sm text-[#BDB4C9] italic p-5 text-center">
                Aucune demande transmise pour l&apos;instant.
              </p>
            ) : (
              stats.recentMeetingRequests.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#C9A227]/10 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-[#FAF6EF] truncate">{c.requesterName}</p>
                    <p className="text-xs text-[#BDB4C9] truncate">
                      {c.subject} · {c.servantCode === "afrika" ? "Sœur Afrika" : "Pasteur Kongo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-[#BDB4C9]">
                      {(c.transmittedAt ? new Date(c.transmittedAt) : new Date(c.createdAt)).toLocaleDateString("fr-FR")}
                    </span>
                    {c.urgency === "urgente" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B3452E]/10 text-[#E08B6D]">
                        Urgente
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Prochains lives */}
      <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C9A227]/10">
          <h2 className="font-bold font-serif text-[#FAF6EF] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#A3C9B0]" />
            Prochains directs
          </h2>
          <Link href="/admin/lives" className="text-xs font-semibold text-[#A3C9B0] hover:underline">
            Gérer →
          </Link>
        </div>
        {stats.upcomingLives.length === 0 ? (
          <p className="text-sm text-[#BDB4C9] italic p-5 text-center">Aucun direct programmé.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3 p-4">
            {stats.upcomingLives.map((live) => (
              <div key={live.id} className="p-4 rounded-xl border border-[#C9A227]/20 bg-gradient-to-br from-[#FAF6EF] to-white">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-3.5 h-3.5 text-[#A3C9B0]" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#A3C9B0] font-bold">
                    {live.servant.shortName}
                  </span>
                </div>
                <p className="font-bold text-sm text-[#FAF6EF] mb-2 leading-tight">{live.title}</p>
                <p className="text-xs text-[#BDB4C9] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(live.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à{" "}
                  {new Date(live.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
