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
    { label: "Serviteurs", value: stats.servants, icon: Users, href: "/admin/servants", color: "text-gold" },
    { label: "Biographies", value: stats.biographies, icon: BookOpen, href: "/admin/biographies", color: "text-lavender" },
    { label: "Témoignages", value: stats.testimonies, icon: FileText, href: "/admin/testimonies", color: "text-gold", badge: stats.pendingTestimonies > 0 ? `${stats.pendingTestimonies} à discerner` : null },
    { label: "Enseignements", value: stats.teachings, icon: BookOpen, href: "/admin/teachings", color: "text-lavender" },
    { label: "Vidéos", value: stats.videos, icon: Video, href: "/admin/videos", color: "text-gold" },
    { label: "Lives programmés", value: stats.liveStreams, icon: Radio, href: "/admin/lives", color: "text-lavender" },
    { label: "Canaux", value: stats.channels, icon: MessageSquare, href: "/admin/channels", color: "text-gold" },
    { label: "Demandes contact", value: stats.contactRequests, icon: Inbox, href: "/admin/contact-requests", color: "text-lavender", badge: stats.pendingContacts > 0 ? `${stats.pendingContacts} en attente` : null },
    { label: "Dons", value: stats.donations, icon: Heart, href: "/admin/donations", color: "text-gold", sub: `${stats.totalDonationsAmount.toFixed(0)} €` },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
          Tableau de bord
        </h1>
        <p className="text-sm text-stone">
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/15 text-gold-dark border border-gold/30">
                    {stat.badge}
                  </span>
                )}
              </div>
              <div className="font-serif text-3xl font-semibold text-ink">
                {stat.value}
              </div>
              <div className="text-xs text-stone mt-1">
                {stat.label}
                {stat.sub && <span className="ml-1 text-gold-dark font-semibold">· {stat.sub}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Témoignages récents */}
        <div className="card-gold-top p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Témoignages récents
            </h2>
            <Link href="/admin/testimonies" className="text-xs font-semibold text-imperial hover:text-gold">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {recentTestimonies.length === 0 ? (
              <p className="text-sm text-stone italic">Aucun témoignage.</p>
            ) : (
              recentTestimonies.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-stone/15 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                    <p className="text-xs text-stone">{t.servant.shortName} · {new Date(t.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === "CONFIRMED"
                      ? "bg-state-success/15 text-state-success"
                      : "bg-gold/15 text-gold-dark"
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
            <h2 className="font-serif text-lg font-semibold text-ink">
              Demandes de contact
            </h2>
            <Link href="/admin/contact-requests" className="text-xs font-semibold text-imperial hover:text-gold">
              Tout voir →
            </Link>
          </div>
          <div className="space-y-3">
            {recentContactRequests.length === 0 ? (
              <p className="text-sm text-stone italic">Aucune demande.</p>
            ) : (
              recentContactRequests.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-stone/15 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                    <p className="text-xs text-stone truncate">{c.contact} · {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {c.status === "PENDING" && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/15 text-gold-dark">
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
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold" />
            Prochains directs
          </h2>
          <Link href="/admin/lives" className="text-xs font-semibold text-imperial hover:text-gold">
            Gérer →
          </Link>
        </div>
        {upcomingLives.length === 0 ? (
          <p className="text-sm text-stone italic">Aucun direct programmé.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {upcomingLives.map((live) => (
              <div key={live.id} className="p-4 rounded border border-stone/20 bg-ivory">
                <p className="text-xs uppercase tracking-[0.18em] text-gold-dark font-semibold mb-1">
                  {live.servant.shortName}
                </p>
                <p className="font-serif text-sm font-semibold text-ink mb-2">{live.title}</p>
                <p className="text-xs text-stone">
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
