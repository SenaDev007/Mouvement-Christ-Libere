import { db } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  Pencil, UserPlus, Crown, Shield, MessageSquare, Users as UsersIcon,
  Mail, MapPin, Clock, CheckCircle2, AlertCircle, Trash2, Crown as CrownIcon,
} from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { flagFromCountryCode } from "@/lib/data/flags";

export const dynamic = "force-dynamic";

// Badge rôle avec couleur distinctive
function RoleBadge({ role }: { role: string }) {
  const config: Record<string, {
    label: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
  }> = {
    SUPER_ADMIN: {
      label: "Super Admin",
      color: "text-[#C9A227]",
      icon: Crown,
      gradient: "from-[#C9A227] to-[#A3821C]",
    },
    ADMIN: {
      label: "Admin",
      color: "text-[#8C5FA8]",
      icon: Shield,
      gradient: "from-[#8C5FA8] to-[#6B4480]",
    },
    MODERATOR: {
      label: "Modérateur",
      color: "text-blue-700",
      icon: MessageSquare,
      gradient: "from-blue-500 to-blue-700",
    },
    ANIMATOR: {
      label: "Animateur",
      color: "text-green-700",
      icon: UsersIcon,
      gradient: "from-green-500 to-green-700",
    },
    MEMBER_VERIFIED: {
      label: "Membre vérifié",
      color: "text-emerald-700",
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-emerald-700",
    },
    MEMBER: {
      label: "Membre",
      color: "text-gray-600",
      icon: UsersIcon,
      gradient: "from-gray-400 to-gray-600",
    },
    GUEST: {
      label: "Visiteur",
      color: "text-gray-400",
      icon: UsersIcon,
      gradient: "from-gray-300 to-gray-400",
    },
  };
  const c = config[role] || config.MEMBER;
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-white ${c.color}`}
      style={{ borderColor: "currentColor" }}
    >
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// Avatar avec initiales et couleur selon rôle
function UserAvatar({ name, role }: { name: string | null; role: string }) {
  const config: Record<string, string> = {
    SUPER_ADMIN: "from-[#C9A227] to-[#A3821C]",
    ADMIN: "from-[#8C5FA8] to-[#6B4480]",
    MODERATOR: "from-blue-500 to-blue-700",
    ANIMATOR: "from-green-500 to-green-700",
    MEMBER_VERIFIED: "from-emerald-500 to-emerald-700",
    MEMBER: "from-gray-400 to-gray-600",
    GUEST: "from-gray-300 to-gray-400",
  };
  const gradient = config[role] || config.MEMBER;
  const initials = (name || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white text-sm shadow-md flex-shrink-0`}
    >
      {initials}
    </div>
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

  // Statistiques
  const stats = {
    total: users.length,
    superAdmins: users.filter((u) => u.role === "SUPER_ADMIN").length,
    admins: users.filter((u) => u.role === "ADMIN").length,
    moderators: users.filter((u) => u.role === "MODERATOR").length,
    animators: users.filter((u) => u.role === "ANIMATOR").length,
    members: users.filter((u) => u.role === "MEMBER" || u.role === "MEMBER_VERIFIED").length,
    pending: users.filter((u) => !u.isVerified).length,
    verified: users.filter((u) => u.isVerified).length,
  };

  // Groupes par rôle pour les onglets
  const roleGroups = [
    { id: "all", label: "Tous", count: stats.total, color: "#1E0F2B" },
    { id: "SUPER_ADMIN", label: "Super Admins", count: stats.superAdmins, color: "#C9A227" },
    { id: "ADMIN", label: "Admins", count: stats.admins, color: "#8C5FA8" },
    { id: "MODERATOR", label: "Modérateurs", count: stats.moderators, color: "#3B82F6" },
    { id: "ANIMATOR", label: "Animateurs", count: stats.animators, color: "#10B981" },
    { id: "MEMBER", label: "Membres", count: stats.members, color: "#6B7280" },
  ];

  return (
    <div className="space-y-6">
      {/* Header avec gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-bold mb-2">
              Gestion des comptes
            </p>
            <h1
              className="text-2xl md:text-3xl font-bold mb-1"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            >
              Utilisateurs
            </h1>
            <p className="text-sm text-white/70">
              {users.length} compte{users.length > 1 ? "s" : ""} · {stats.verified} vérifié{stats.verified > 1 ? "s" : ""} · {stats.pending} en attente
            </p>
          </div>
          {isSuperAdmin && (
            <Link
              href="/admin/users/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              Créer un administrateur
            </Link>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Crown className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.superAdmins}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Super Admins</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8C5FA8]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8C5FA8] to-[#6B4480]" />
          <Shield className="w-4 h-4 text-[#8C5FA8] mb-2" />
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.admins + stats.moderators + stats.animators}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Staff</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/50 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />
          <CheckCircle2 className="w-4 h-4 text-emerald-700 mb-2" />
          <div className="text-2xl font-bold text-emerald-700">{stats.verified}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5">Vérifiés</div>
        </div>
        <div className="bg-white rounded-xl border border-orange-200/50 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
          <AlertCircle className="w-4 h-4 text-orange-600 mb-2" />
          <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          <div className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold mt-0.5">En attente</div>
        </div>
      </div>

      {/* Avertissement si non super admin */}
      {!isSuperAdmin && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#8A8378]/10 border border-[#8A8378]/30">
          <Shield className="w-5 h-5 text-[#8A8378] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#1E0F2B] leading-relaxed">
            Seuls les <strong>super administrateurs</strong> peuvent créer de nouveaux comptes administrateur. Vous pouvez consulter et modifier les informations des utilisateurs existants.
          </p>
        </div>
      )}

      {/* Onglets filtres (visuel — le filtrage se fera côté client via un composant dédié si besoin) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">Filtrer:</span>
        {roleGroups.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              borderColor: `${g.color}30`,
              backgroundColor: `${g.color}08`,
              color: g.color,
            }}
          >
            {g.label}
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: g.color }}
            >
              {g.count}
            </span>
          </span>
        ))}
      </div>

      {/* Liste des utilisateurs en cartes */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <UsersIcon className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucun utilisateur inscrit pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:shadow-md hover:border-[#C9A227]/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <UserAvatar name={u.name} role={u.role} />

                {/* Contenu principal */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-[#1E0F2B]">{u.name || "Sans nom"}</h3>
                        {u.role === "SUPER_ADMIN" && (
                          <CrownIcon className="w-3.5 h-3.5 text-[#C9A227]" />
                        )}
                        {/* Statut vérifié */}
                        {u.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Vérifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700">
                            <AlertCircle className="w-2.5 h-2.5" />
                            En attente
                          </span>
                        )}
                      </div>

                      {/* Email */}
                      <a
                        href={`mailto:${u.email}`}
                        className="inline-flex items-center gap-1 text-xs text-[#8C5FA8] hover:underline mt-1"
                      >
                        <Mail className="w-3 h-3" />
                        {u.email}
                      </a>
                    </div>

                    {/* Role badge */}
                    <RoleBadge role={u.role} />
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[11px] text-[#8A8378] flex-wrap">
                    {u.country && (
                      <span className="flex items-center gap-1">
                        <span aria-hidden>{flagFromCountryCode(u.country)}</span>
                        {u.country}
                      </span>
                    )}
                    {u.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {u.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1  flex-shrink-0">
                  <Link
                    href={`/admin/users/${u.id}/edit`}
                    className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                    aria-label="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  {u.role !== "SUPER_ADMIN" && (
                    <DeleteButton entity="users" id={u.id} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
