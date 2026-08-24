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
        <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
          Dons
        </h1>
        <p className="text-sm text-stone">
          Contributions financières reçues via la plateforme.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-gold-top p-5">
          <Heart className="w-5 h-5 text-gold mb-2" />
          <div className="font-serif text-2xl font-semibold text-ink">{donations.length}</div>
          <div className="text-xs text-stone">dons reçus</div>
        </div>
        <div className="card-gold-top p-5">
          <Euro className="w-5 h-5 text-gold mb-2" />
          <div className="font-serif text-2xl font-semibold text-ink">{total.toFixed(0)} €</div>
          <div className="text-xs text-stone">total accumulé</div>
        </div>
        <div className="card-gold-top p-5">
          <Euro className="w-5 h-5 text-lavender mb-2" />
          <div className="font-serif text-2xl font-semibold text-ink">{monthTotal.toFixed(0)} €</div>
          <div className="text-xs text-stone">ce mois-ci</div>
        </div>
      </div>

      {/* Liste */}
      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-imperial text-ivory">
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-stone italic">
                  Aucun don pour l&apos;instant.
                </td>
              </tr>
            ) : (
              donations.map((d) => (
                <tr key={d.id} className="border-b border-stone/15 hover:bg-gold/5">
                  <td className="px-4 py-3 text-xs text-stone">
                    {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {d.isAnonymous ? "Anonyme" : d.donorName || d.donorEmail || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gold-dark">
                    {d.amount.toFixed(2)} {d.currency}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone">{d.method}</td>
                  <td className="px-4 py-3 text-xs text-stone italic line-clamp-1">
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
