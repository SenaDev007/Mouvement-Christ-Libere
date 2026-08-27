import { db } from "@/lib/db";
import { Heart, Euro, TrendingUp, Calendar, MessageSquare, User, Mail, Clock } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminDonationsPage() {
  const donations = await db.donation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Stats
  const now = new Date();
  const total = donations.reduce((sum, d) => sum + d.amount, 0);
  const thisMonth = donations.filter((d) => {
    const dDate = new Date(d.createdAt);
    return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((sum, d) => sum + d.amount, 0);
  const averageDon = donations.length > 0 ? total / donations.length : 0;

  // Top donateur (non anonyme)
  const donors = donations.filter((d) => !d.isAnonymous && d.donorName);
  const donorSums: Record<string, number> = {};
  donors.forEach((d) => {
    const name = d.donorName!;
    donorSums[name] = (donorSums[name] || 0) + d.amount;
  });
  const topDonors = Object.entries(donorSums)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
          Contributions financières
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          Dons
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Dons reçus via la plateforme.
        </p>
      </div>

      {/* Stats cards premium */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Heart className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold text-[#1E0F2B]">{donations.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Dons reçus</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Euro className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold text-[#1E0F2B]">{total.toFixed(0)} €</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Total accumulé</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8C5FA8]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8C5FA8] to-[#6B4480]" />
          <Calendar className="w-4 h-4 text-[#8C5FA8] mb-2" />
          <div className="text-2xl font-bold text-[#8C5FA8]">{monthTotal.toFixed(0)} €</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8C5FA8] font-semibold mt-0.5">Ce mois-ci</div>
        </div>
        <div className="bg-white rounded-xl border border-[#5B7052]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B7052] to-[#3F5039]" />
          <TrendingUp className="w-4 h-4 text-[#5B7052] mb-2" />
          <div className="text-2xl font-bold text-[#5B7052]">{averageDon.toFixed(0)} €</div>
          <div className="text-[10px] uppercase tracking-wider text-[#5B7052] font-semibold mt-0.5">Don moyen</div>
        </div>
      </div>

      {/* Top donateurs + Liste */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top donateurs */}
        <div className="bg-white rounded-2xl border border-[#8A8378]/15 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#8A8378]/10 bg-gradient-to-r from-[#C9A227]/10 to-transparent">
            <h2 className="font-bold text-sm text-[#1E0F2B] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#C9A227]" />
              Top donateurs
            </h2>
          </div>
          {topDonors.length === 0 ? (
            <p className="text-sm text-[#8A8378] italic p-5 text-center">Aucun donateur identifié.</p>
          ) : (
            <div className="divide-y divide-[#8A8378]/10">
              {topDonors.map(([name, amount], i) => (
                <div key={name} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? "bg-[#C9A227]" : i === 1 ? "bg-[#8C5FA8]" : i === 2 ? "bg-[#5B7052]" : "bg-[#8A8378]"
                    }`}>
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-[#1E0F2B]">{name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#A3821C]">{amount.toFixed(0)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liste complète */}
        <div className="lg:col-span-2 space-y-3">
          {donations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
              <Heart className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
              <p className="text-sm text-[#8A8378] italic">Aucun don pour l&apos;instant.</p>
            </div>
          ) : (
            donations.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-3">
                  {/* Icon don */}
                  <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 text-[#C9A227]" />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div>
                        <h3 className="font-bold text-sm text-[#1E0F2B]">
                          {d.isAnonymous ? "Don anonyme" : d.donorName || d.donorEmail || "Donateur"}
                        </h3>
                        {!d.isAnonymous && d.donorEmail && (
                          <a href={`mailto:${d.donorEmail}`} className="inline-flex items-center gap-1 text-xs text-[#8C5FA8] hover:underline mt-0.5">
                            <Mail className="w-3 h-3" />
                            {d.donorEmail}
                          </a>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-[#A3821C]">{d.amount.toFixed(2)} €</div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8A8378]/10 text-[#8A8378]">
                          {d.method}
                        </span>
                      </div>
                    </div>

                    {/* Message */}
                    {d.message && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/10 flex items-start gap-2">
                        <MessageSquare className="w-3 h-3 text-[#8A8378] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[#1E0F2B]/70 italic line-clamp-2">{d.message}</p>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-1 text-[11px] text-[#8A8378] mt-2">
                      <Clock className="w-3 h-3" />
                      {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <DeleteButton entity="donations" id={d.id} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
