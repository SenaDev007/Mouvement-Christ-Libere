import { db } from "@/lib/db";
import { Users, Crown, Eye, Calendar, MapPin, Phone } from "lucide-react";
import { flagFromCountryCode } from "@/lib/data/flags";

export const dynamic = "force-dynamic";

export default async function AdminLiveMembersPage() {
  const members = await db.liveMember.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: {
        select: { liveViewers: true },
      },
    },
  });

  // Stats
  const stats = {
    total: members.length,
    activeThisWeek: members.filter((m) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(m.updatedAt) > weekAgo;
    }).length,
    totalXp: members.reduce((sum, m) => sum + m.totalXp, 0),
    totalLivesWatched: members.reduce((sum, m) => sum + m.livesWatched, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-1">
          Spectateurs inscrits
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#000000]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          Membres Live
        </h1>
        <p className="text-sm text-[#8A857C] mt-1">
          Utilisateurs inscrits pour suivre les lives en direct.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Users className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold text-[#000000]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A857C] font-semibold mt-0.5">Total inscrits</div>
        </div>
        <div className="bg-white rounded-xl border border-[#5B7052]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B7052] to-[#3F5039]" />
          <Eye className="w-4 h-4 text-[#5B7052] mb-2" />
          <div className="text-2xl font-bold text-[#5B7052]">{stats.activeThisWeek}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#5B7052] font-semibold mt-0.5">Actifs (7j)</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A857C]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8A857C] to-[#6B675F]" />
          <Crown className="w-4 h-4 text-[#8A857C] mb-2" />
          <div className="text-2xl font-bold text-[#8A857C]">{stats.totalXp}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A857C] font-semibold mt-0.5">XP total</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Calendar className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold text-[#000000]">{stats.totalLivesWatched}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A857C] font-semibold mt-0.5">Lives vus</div>
        </div>
      </div>

      {/* Liste des membres */}
      {members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A857C]/30 p-12 text-center">
          <Users className="w-10 h-10 text-[#8A857C]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A857C] italic">Aucun membre inscrit pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#8A857C]/15 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-[#000000] text-[#F0E9DE]">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Nom</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Pays</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Ville</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Contact</th>
                <th className="text-center px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">XP</th>
                <th className="text-center px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Lives</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[#8A857C]/15 hover:bg-[#FF7A1A]/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: m.firstName.charCodeAt(0) % 2 === 0 ? "#C9A227" : "#8A857C" }}
                      >
                        {m.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#000000]">
                          {m.firstName} {m.lastName || ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A857C]">
                    {m.country ? (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{flagFromCountryCode(m.country)}</span>
                        {m.country}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A857C]">
                    {m.city ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {m.city}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A857C]">
                    {m.contact ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {m.contact}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8A857C]/15 text-[#8A857C]">
                      <Crown className="w-2.5 h-2.5" />
                      {m.totalXp}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-[#000000]">
                    {m.livesWatched}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A857C]">
                    {new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
