import { db } from "@/lib/db";
import { Users, FileText, BookOpen, Video, MessageSquare, Inbox, Heart, Radio, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const [
    servants,
    biographies,
    testimonies,
    teachings,
    videos,
    channels,
    contactRequests,
    donations,
    liveStreams,
    pendingTestimonies,
    pendingContacts,
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
  ]);

  const totalDonations = await db.donation.aggregate({
    _sum: { amount: true },
  });

  return {
    servants,
    biographies,
    testimonies,
    teachings,
    videos,
    channels,
    contactRequests,
    donations,
    liveStreams,
    pendingTestimonies,
    pendingContacts,
    totalDonationsAmount: totalDonations._sum.amount || 0,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const recentTestimonies = await db.testimony.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { servant: true },
  });

  const recentContactRequests = await db.contactRequest.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const upcomingLives = await db.liveStream.findMany({
    take: 3,
    where: {
      scheduledAt: { gte: new Date() },
      status: "SCHEDULED",
    },
    orderBy: { scheduledAt: "asc" },
    include: { servant: true },
  });

  const statCards = [
    { label: "Serviteurs", value: stats.servants, icon: Users, href: "/admin/servants", color: "text-[#C9A227]" },
    { label: "Biographies", value: stats.biographies, icon: BookOpen, href: "/admin/biographies", color: "text-[#8C5FA8]" },
    { label: "Témoignages", value: stats.testimonies, icon: FileText, href: "/admin/testimonies", color: "text-[#C9A227]", badge: stats.pendingTestimonies > 0 ? `${stats.pendingTestimonies} à discerner` : null },
    { label: "Enseignements", value: stats.teachings, icon: BookOpen, href: "/admin/teachings", color: "text-[#8C5FA8]" },
    { label: "Vidéos", value: stats.videos, icon: Video, href: "/admin/videos", color: "text-[#C9A227]" },
    { label: "Lives programmés", value: stats.liveStreams, icon: Radio, href: "/admin/lives", color: "text-[#8C5FA8]" },
    { label: "Canaux", value: stats.channels, icon: MessageSquare, href: "/admin/channels", color: "text-[#C9A227]" },
    { label: "Demandes contact", value: stats.contactRequests, icon: Inbox, href: "/admin/contact-requests", color: "text-[#8C5FA8]", badge: stats.pendingContacts > 0 ? `${stats.pendingContacts} en attente` : null },
    { label: "Dons", value: stats.donations, icon: Heart, href: "/admin/donations", color: "text-[#C9A227]", sub: `${stats.totalDonationsAmount.toFixed(0)} €` },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
          Tableau de bord
        </h1>
        <p className="text-sm text-[#8A8378]">
          Vue d&apos;ensemble de la plateforme — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="card-gold-top p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                {stat.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/30">
                    {stat.badge}
                  </span>
                )}
              </div>
              <div className="font-serif text-3xl font-semibold text-[#1E0F2B]">
                {stat.value}
              </div>
              <div className="text-xs text-[#8A8378] mt-1">
                {stat.label}
                {stat.sub && <span className="ml-1 text-[#A3821C] font-semibold">· {stat.sub}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Témoignages récents */}
        <div className="card-gold-top p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#1E0F2B]">
              Témoignages récents
            </h2>
            <Link href="/admin/testimonies" className="text-xs font-semibold text-[#2A0E3D] hover:text-[#C9A227]">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {recentTestimonies.length === 0 ? (
              <p className="text-sm text-[#8A8378] italic">Aucun témoignage.</p>
            ) : (
              recentTestimonies.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-[#8A8378]/15 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1E0F2B] truncate">{t.title}</p>
                    <p className="text-xs text-[#8A8378]">{t.servant.shortName} · {new Date(t.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === "CONFIRMED"
                      ? "bg-state-success/15 text-state-success"
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
        <div className="card-gold-top p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#1E0F2B]">
              Demandes de contact
            </h2>
            <Link href="/admin/contact-requests" className="text-xs font-semibold text-[#2A0E3D] hover:text-[#C9A227]">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {recentContactRequests.length === 0 ? (
              <p className="text-sm text-[#8A8378] italic">Aucune demande.</p>
            ) : (
              recentContactRequests.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#8A8378]/15 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1E0F2B] truncate">{c.name}</p>
                    <p className="text-xs text-[#8A8378] truncate">{c.contact} · {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {c.status === "PENDING" && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9A227]/15 text-[#A3821C]">
                      En attente
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Prochains lives */}
      <div className="card-gold-top p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C9A227]" />
            Prochains directs
          </h2>
          <Link href="/admin/lives" className="text-xs font-semibold text-[#2A0E3D] hover:text-[#C9A227]">
            Gérer →
          </Link>
        </div>
        {upcomingLives.length === 0 ? (
          <p className="text-sm text-[#8A8378] italic">Aucun direct programmé.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {upcomingLives.map((live) => (
              <div key={live.id} className="p-4 rounded border border-[#8A8378]/20 bg-[#FAF6EF]">
                <p className="text-xs uppercase tracking-[0.18em] text-[#A3821C] font-semibold mb-1">
                  {live.servant.shortName}
                </p>
                <p className="font-serif text-sm font-semibold text-[#1E0F2B] mb-2">{live.title}</p>
                <p className="text-xs text-[#8A8378]">
                  {new Date(live.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à {" "}
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
