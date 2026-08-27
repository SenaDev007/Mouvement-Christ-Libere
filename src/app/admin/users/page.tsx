import { db } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { Pencil, UserPlus, Crown, Shield, MessageSquare, Users as UsersIcon } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Badge rôle avec couleur distinctive
function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
    SUPER_ADMIN: { label: "Super Admin", color: "bg-[#C9A227]/20 text-[#C9A227] border-[#C9A227]/40", icon: Crown },
    ADMIN: { label: "Admin", color: "bg-[#8C5FA8]/15 text-[#8C5FA8] border-[#8C5FA8]/30", icon: Shield },
    MODERATOR: { label: "Modérateur", color: "bg-blue-100 text-blue-700 border-blue-200", icon: MessageSquare },
    ANIMATOR: { label: "Animateur", color: "bg-green-100 text-green-700 border-green-200", icon: UsersIcon },
    MEMBER_VERIFIED: { label: "Membre vérifié", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: UsersIcon },
    MEMBER: { label: "Membre", color: "bg-gray-100 text-gray-600 border-gray-200", icon: UsersIcon },
    GUEST: { label: "Visiteur", color: "bg-gray-50 text-gray-400 border-gray-100", icon: UsersIcon },
  };
  const c = config[role] || config.MEMBER;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${c.color}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// Décode le userId et le rôle depuis le token de session
function decodeSessionUser(token: string): { userId: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    const userParts = data.user.split(":");
    if (userParts.length >= 3 && userParts[0] === "admin") {
      return { userId: userParts[1], role: userParts[2] };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  // Récupération du rôle de l'admin courant
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  let currentAdmin: { userId: string; role: string } | null = null;
  if (sessionToken && verifySessionToken(sessionToken)) {
    currentAdmin = decodeSessionUser(sessionToken);
  }
  const isSuperAdmin = currentAdmin?.role === "SUPER_ADMIN";

  // Statistiques rapides
  const stats = {
    total: users.length,
    superAdmins: users.filter((u) => u.role === "SUPER_ADMIN").length,
    admins: users.filter((u) => u.role === "ADMIN").length,
    moderators: users.filter((u) => u.role === "MODERATOR").length,
    members: users.filter((u) => u.role === "MEMBER" || u.role === "MEMBER_VERIFIED").length,
    pending: users.filter((u) => !u.isVerified).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Utilisateurs
          </h1>
          <p className="text-sm text-[#8A8378]">
            Membres inscrits et administrateurs ({users.length} affichés).
          </p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#B8901F] transition-colors shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            Créer un administrateur
          </Link>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-[#1E0F2B]" },
          { label: "Super Admins", value: stats.superAdmins, color: "text-[#C9A227]" },
          { label: "Admins", value: stats.admins, color: "text-[#8C5FA8]" },
          { label: "Modérateurs", value: stats.moderators, color: "text-blue-600" },
          { label: "En attente", value: stats.pending, color: "text-orange-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-[#8A8378]/15 p-4 text-center"
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Avertissement si non super admin */}
      {!isSuperAdmin && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#8A8378]/10 border border-[#8A8378]/30">
          <Shield className="w-5 h-5 text-[#8A8378] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#1E0F2B] leading-relaxed">
            Seuls les <strong>super administrateurs</strong> (Pam, Pasteur Kongo)
            peuvent créer de nouveaux comptes administrateur. Vous pouvez
            consulter et modifier les informations des utilisateurs existants.
          </p>
        </div>
      )}

      {/* Tableau */}
      <div className="card-gold-top overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#2A0E3D] text-[#FAF6EF]">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Nom</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Email</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Rôle</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Statut</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Pays</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Inscrit le</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8378] italic">
                  Aucun utilisateur inscrit pour l&apos;instant.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-[#8A8378]/15 hover:bg-[#C9A227]/5">
                  <td className="px-4 py-3 text-sm font-medium text-[#1E0F2B]">
                    {u.name || "—"}
                    {u.role === "SUPER_ADMIN" && (
                      <Crown className="inline-block w-3.5 h-3.5 ml-2 text-[#C9A227]" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A8378]">{u.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {u.isVerified ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        Vérifié
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                        En attente
                      </span>
                    )}
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
                      {u.role !== "SUPER_ADMIN" && (
                        <DeleteButton entity="users" id={u.id} />
                      )}
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
