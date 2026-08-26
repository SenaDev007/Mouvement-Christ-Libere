import { db } from "@/lib/db";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
          Utilisateurs
        </h1>
        <p className="text-sm text-[#8A8378]">
          Membres inscrits sur la plateforme ({users.length} affichés).
        </p>
      </div>

      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2A0E3D] text-[#FAF6EF]">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Nom</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Email</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Rôle</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Pays</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Inscrit le</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8378] italic">
                  Aucun utilisateur inscrit pour l&apos;instant.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-[#8A8378]/15 hover:bg-[#C9A227]/5">
                  <td className="px-4 py-3 text-sm font-medium text-[#1E0F2B]">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#8A8378]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#8C5FA8]/15 text-[#8C5FA8]">
                      {u.role.replace("_", " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A8378]">{u.country || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#8A8378]">
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="p-2 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                        aria-label="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <DeleteButton entity="users" id={u.id} />
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
