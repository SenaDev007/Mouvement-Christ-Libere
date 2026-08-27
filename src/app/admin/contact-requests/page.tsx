import { db } from "@/lib/db";
import { Inbox, Mail, Phone, CheckCircle, Archive, Clock, Trash2 } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { UpdateContactStatusButton } from "@/components/admin/update-contact-status-button";

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  PENDING: { label: "En attente", color: "bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30" },
  ANSWERED: { label: "Traité", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ARCHIVED: { label: "Archivé", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default async function AdminContactRequestsPage() {
  const requests = await db.contactRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Stats
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "PENDING").length,
    answered: requests.filter((r) => r.status === "ANSWERED").length,
    archived: requests.filter((r) => r.status === "ARCHIVED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
          Messagerie entrante
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          Demandes de contact
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Demandes transmises via le formulaire de contact public.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-[#1E0F2B]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold mt-0.5">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4">
          <div className="text-2xl font-bold text-[#A3821C]">{stats.pending}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3821C] font-semibold mt-0.5">En attente</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200/50 p-4">
          <div className="text-2xl font-bold text-emerald-700">{stats.answered}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mt-0.5">Traitées</div>
        </div>
        <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.archived}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">Archivées</div>
        </div>
      </div>

      {/* Liste */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <Inbox className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">Aucune demande pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => {
            const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
            const isEmail = r.contact.includes("@");

            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar initiales */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                    style={{
                      background: r.status === "PENDING"
                        ? "linear-gradient(135deg, #C9A227, #A3821C)"
                        : r.status === "ANSWERED"
                          ? "linear-gradient(135deg, #5B7052, #3F5039)"
                          : "linear-gradient(135deg, #8A8378, #6B6358)"
                    }}
                  >
                    {r.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="font-bold text-sm text-[#1E0F2B]">{r.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Contact */}
                    <a
                      href={isEmail ? `mailto:${r.contact}` : `tel:${r.contact}`}
                      className="inline-flex items-center gap-1.5 text-xs text-[#8C5FA8] hover:underline mt-1"
                    >
                      {isEmail ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                      {r.contact}
                    </a>

                    {/* Message */}
                    <div className="mt-2 px-3 py-2 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/10">
                      <p className="text-xs text-[#1E0F2B]/80 leading-relaxed whitespace-pre-wrap">{r.message}</p>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1 text-[11px] text-[#8A8378] mt-2">
                      <Clock className="w-3 h-3" />
                      {new Date(r.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0 ">
                    {r.status !== "ANSWERED" && (
                      <UpdateContactStatusButton id={r.id} status="ANSWERED" icon="check" />
                    )}
                    {r.status !== "ARCHIVED" && (
                      <UpdateContactStatusButton id={r.id} status="ARCHIVED" icon="archive" />
                    )}
                    <DeleteButton entity="contactrequests" id={r.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
