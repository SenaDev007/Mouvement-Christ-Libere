import { db } from "@/lib/db";
import { Heart, Euro } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminDonationsPage() {
  const donations = await db.donation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const total = donations.reduce((sum, d) => sum + d.amount, 0);
  const thisMonth = donations.filter(
    (d) => d.createdAt.getMonth() === new Date().getMonth()
  );
  const monthTotal = thisMonth.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
          Dons
        </h1>
        <p className="text-sm text-[#8A8378]">
          Contributions financières reçues via la plateforme.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-gold-top p-5">
          <Heart className="w-5 h-5 text-[#C9A227] mb-2" />
          <div className="font-serif text-2xl font-semibold text-[#1E0F2B]">{donations.length}</div>
          <div className="text-xs text-[#8A8378]">dons reçus</div>
        </div>
        <div className="card-gold-top p-5">
          <Euro className="w-5 h-5 text-[#C9A227] mb-2" />
          <div className="font-serif text-2xl font-semibold text-[#1E0F2B]">{total.toFixed(0)} €</div>
          <div className="text-xs text-[#8A8378]">total accumulé</div>
        </div>
        <div className="card-gold-top p-5">
          <Euro className="w-5 h-5 text-[#8C5FA8] mb-2" />
          <div className="font-serif text-2xl font-semibold text-[#1E0F2B]">{monthTotal.toFixed(0)} €</div>
          <div className="text-xs text-[#8A8378]">ce mois-ci</div>
        </div>
      </div>

      {/* Liste */}
      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2A0E3D] text-[#FAF6EF]">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Date</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Donateur</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Montant</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Méthode</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Message</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8378] italic">
                  Aucun don pour l&apos;instant.
                </td>
              </tr>
            ) : (
              donations.map((d) => (
                <tr key={d.id} className="border-b border-[#8A8378]/15 hover:bg-[#C9A227]/5">
                  <td className="px-4 py-3 text-xs text-[#8A8378]">
                    {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#1E0F2B]">
                    {d.isAnonymous ? "Anonyme" : d.donorName || d.donorEmail || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#A3821C]">
                    {d.amount.toFixed(2)} {d.currency}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A8378]">{d.method}</td>
                  <td className="px-4 py-3 text-xs text-[#8A8378] italic line-clamp-1">
                    {d.message || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <DeleteButton entity="donations" id={d.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
