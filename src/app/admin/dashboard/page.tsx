import { db } from "@/lib/db";
import {
  Users, FileText, BookOpen, Video, MessageSquare, Inbox, Heart,
  Radio, Calendar, TrendingUp, ArrowUpRight, Clock, Crown, Eye
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Timeout 30s (Vercel serverless)

async function getStats() {
  const [
    servants, biographies, testimonies, teachings, videos, channels,
    contactRequests, donations, liveStreams, pendingTestimonies, pendingContacts,
    pamServant, kongoServant,
    totalDonations, totalViews,
    recentTestimonies, recentContactRequests, upcomingLives,
  ] = await Promise.all([
    db.servant.count(),
    db.biography.count(),
    db.testimony.count(),
    db.teaching.count(),
    db.video.count(),
    db.channel.count(),
    db.contactRequest.count(),
    db.donation.count(),
    db.liveStream.count(),
    db.testimony.count({ where: { status: "TO_DISCERN" } }),
    db.contactRequest.count({ where: { status: "PENDING" } }),
    db.servant.findFirst({ where: { code: "pam" }, include: { _count: { select: { videos: true, testimonies: true, teachings: true } } } }),
    db.servant.findFirst({ where: { code: "kongo" }, include: { _count: { select: { videos: true, testimonies: true, teachings: true } } } }),
    db.donation.aggregate({ _sum: { amount: true } }),
    db.video.aggregate({ _sum: { views: true } }),
    db.testimony.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { servant: true } }),
    db.contactRequest.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    db.liveStream.findMany({ take: 3, where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" }, orderBy: { scheduledAt: "asc" }, include: { servant: true } }),
  ]);

  return {
    servants, biographies, testimonies, teachings, videos, channels,
    contactRequests, donations, liveStreams, pendingTestimonies, pendingContacts,
    totalDonationsAmount: totalDonations._sum.amount || 0,
    totalViews: totalViews._sum.views || 0,
    pam: pamServant,
    kongo: kongoServant,
    recentTestimonies,
    recentContactRequests,
    upcomingLives,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  // Cards principales (KPIs)
  const kpiCards = [
    { label: "Serviteurs", value: stats.servants, icon: Users, href: "/admin/servants", color: "from-[#C9A227] to-[#A3821C]", bg: "bg-[#C9A227]/10" },
    { label: "Témoignages", value: stats.testimonies, icon: FileText, href: "/admin/testimonies", color: "from-[#8A857C] to-[#6B675F]", bg: "bg-[#8A857C]/10", badge: stats.pendingTestimonies > 0 ? `${stats.pendingTestimonies} à discerner` : null },
    { label: "Enseignements", value: stats.teachings, icon: BookOpen, href: "/admin/teachings", color: "from-[#5B7052] to-[#3F5039]", bg: "bg-[#5B7052]/10" },
    { label: "Vidéos", value: stats.videos, icon: Video, href: "/admin/videos", color: "from-[#C9A227] to-[#A3821C]", bg: "bg-[#C9A227]/10", sub: `${stats.totalViews.toLocaleString("fr-FR")} vues` },
    { label: "Dons", value: stats.donations, icon: Heart, href: "/admin/donations", color: "from-[#8A857C] to-[#6B675F]", bg: "bg-[#8A857C]/10", sub: `${stats.totalDonationsAmount.toFixed(0)} €` },
    { label: "Demandes contact", value: stats.contactRequests, icon: Inbox, href: "/admin/contact-requests", color: "from-[#5B7052] to-[#3F5039]", bg: "bg-[#5B7052]/10", badge: stats.pendingContacts > 0 ? `${stats.pendingContacts} en attente` : null },
  ];

  // Cards secondaires
  const secondaryCards = [
    { label: "Biographies", value: stats.biographies, icon: BookOpen, href: "/admin/biographies" },
    { label: "Lives", value: stats.liveStreams, icon: Radio, href: "/admin/lives" },
    { label: "Canaux", value: stats.channels, icon: MessageSquare, href: "/admin/channels" },
  ];

  return (
    <div className="space-y-8">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#000000] via-[#161513] to-[#000000] p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8A857C]/10 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2">
              Tableau de bord
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              Bienvenue dans votre espace
            </h1>
            <p className="text-sm text-white/70">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <TrendingUp className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs font-semibold">{stats.videos} vidéos · {stats.totalViews.toLocaleString("fr-FR")} vues</span>
          </div>
        </div>
      </div>

      {/* KPI Cards principales */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-3 px-1">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group relative bg-white rounded-xl border border-[#8A857C]/15 p-4 hover:border-[#FF7A1A]/40 hover:shadow-lg transition-all overflow-hidden"
              >
                {/* Accent bar top */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-80`} />

                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <Icon className="w-4 h-4 text-[#000000]" />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#8A857C]/40 group-hover:text-[#FF7A1A] transition-colors" />
                </div>

                <div className="text-2xl font-bold text-[#000000] leading-tight">
                  {stat.value}
                </div>
                <div className="text-[11px] text-[#8A857C] mt-0.5">
                  {stat.label}
                </div>
                {stat.sub && (
                  <div className="text-[10px] text-[#A3821C] font-semibold mt-1">
                    {stat.sub}
                  </div>
                )}
                {stat.badge && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30">
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
              className="group flex items-center gap-3 bg-white rounded-xl border border-[#8A857C]/15 p-3 hover:border-[#FF7A1A]/40 transition-colors"
            >
              <div className="p-2 rounded-lg bg-[#000000]/5">
                <Icon className="w-4 h-4 text-[#000000]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[#000000] leading-tight">{stat.value}</div>
                <div className="text-[10px] text-[#8A857C]">{stat.label}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Section serviteurs (Pam & Kongo) */}
      <div className="grid md:grid-cols-2 gap-4">
        {stats.pam && (
          <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#C9A227]/10 to-transparent border-b border-[#8A857C]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C9A227]/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-[#C9A227]" />
                </div>
                <div>
                  <div className="font-bold text-[#000000]">{stats.pam.shortName}</div>
                  <div className="text-xs text-[#8A857C]">{stats.pam.role}</div>
                </div>
              </div>
              <Link href="/admin/servants" className="text-xs text-[#C9A227] font-semibold hover:underline">
                Gérer →
              </Link>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#8A857C]/10">
              <Link href="/admin/videos?servant=pam" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.pam._count.videos}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Vidéos</div>
              </Link>
              <Link href="/admin/testimonies?servant=pam" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.pam._count.testimonies}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Témoignages</div>
              </Link>
              <Link href="/admin/teachings?servant=pam" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.pam._count.teachings}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Enseignements</div>
              </Link>
            </div>
          </div>
        )}
        {stats.kongo && (
          <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#8A857C]/10 to-transparent border-b border-[#8A857C]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#8A857C]/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-[#8A857C]" />
                </div>
                <div>
                  <div className="font-bold text-[#000000]">{stats.kongo.shortName}</div>
                  <div className="text-xs text-[#8A857C]">{stats.kongo.role}</div>
                </div>
              </div>
              <Link href="/admin/servants" className="text-xs text-[#8A857C] font-semibold hover:underline">
                Gérer →
              </Link>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#8A857C]/10">
              <Link href="/admin/videos?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.kongo._count.videos}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Vidéos</div>
              </Link>
              <Link href="/admin/testimonies?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.kongo._count.testimonies}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Témoignages</div>
              </Link>
              <Link href="/admin/teachings?servant=kongo" className="p-3 md:p-4 text-center hover:bg-[#F0E9DE] transition-colors">
                <div className="text-xl font-bold text-[#000000]">{stats.kongo._count.teachings}</div>
                <div className="text-[9px] sm:text-[10px] uppercase sm:tracking-wider text-[#8A857C] mt-0.5">Enseignements</div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Activité récente : 2 colonnes */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Témoignages récents */}
        <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#8A857C]/10">
            <h2 className="font-bold text-[#000000] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C9A227]" />
              Témoignages récents
            </h2>
            <Link href="/admin/testimonies" className="text-xs font-semibold text-[#C9A227] hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="divide-y divide-[#8A857C]/10">
            {stats.recentTestimonies.length === 0 ? (
              <p className="text-sm text-[#8A857C] italic p-5 text-center">Aucun témoignage.</p>
            ) : (
              stats.recentTestimonies.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F0E9DE] transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-[#000000] truncate">{t.title}</p>
                    <p className="text-xs text-[#8A857C] flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold">{t.servant.shortName}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    t.status === "CONFIRMED"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[#C9A227]/15 text-[#A3821C]"
                  }`}>
                    {t.status === "CONFIRMED" ? "Confirmé" : "À discerner"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Demandes de contact récentes */}
        <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#8A857C]/10">
            <h2 className="font-bold text-[#000000] flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#8A857C]" />
              Demandes de contact
            </h2>
            <Link href="/admin/contact-requests" className="text-xs font-semibold text-[#8A857C] hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="divide-y divide-[#8A857C]/10">
            {stats.recentContactRequests.length === 0 ? (
              <p className="text-sm text-[#8A857C] italic p-5 text-center">Aucune demande.</p>
            ) : (
              stats.recentContactRequests.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F0E9DE] transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-[#000000] truncate">{c.name}</p>
                    <p className="text-xs text-[#8A857C] truncate">{c.contact}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-[#8A857C]">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                    {c.status === "PENDING" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227]/15 text-[#A3821C]">
                        En attente
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
      <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#8A857C]/10">
          <h2 className="font-bold text-[#000000] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5B7052]" />
            Prochains directs
          </h2>
          <Link href="/admin/lives" className="text-xs font-semibold text-[#5B7052] hover:underline">
            Gérer →
          </Link>
        </div>
        {stats.upcomingLives.length === 0 ? (
          <p className="text-sm text-[#8A857C] italic p-5 text-center">Aucun direct programmé.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3 p-4">
            {stats.upcomingLives.map((live) => (
              <div key={live.id} className="p-4 rounded-xl border border-[#8A857C]/20 bg-gradient-to-br from-[#F0E9DE] to-white">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-3.5 h-3.5 text-[#5B7052]" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#5B7052] font-bold">
                    {live.servant.shortName}
                  </span>
                </div>
                <p className="font-bold text-sm text-[#000000] mb-2 leading-tight">{live.title}</p>
                <p className="text-xs text-[#8A857C] flex items-center gap-1">
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
