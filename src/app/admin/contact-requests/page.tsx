import { db } from "@/lib/db";
import Link from "next/link";
import { Inbox, Mail, Phone, CheckCircle, Archive } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminContactRequestsPage() {
  const requests = await db.contactRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const updateStatus = async (id: string, status: "ANSWERED" | "ARCHIVED") => {
    "use server";
    await db.contactRequest.update({ where: { id }, data: { status } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
          Demandes de contact
        </h1>
        <p className="text-sm text-stone">
          Demandes d&apos;échange transmises via le formulaire de contact.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card-gold-top p-12 text-center">
          <Inbox className="w-10 h-10 text-stone/40 mx-auto mb-3" />
          <p className="text-sm text-stone italic">
            Aucune demande pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((r) => (
            <div key={r.id} className="card-gold-top p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-serif text-base font-semibold text-ink">{r.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      r.status === "PENDING"
                        ? "bg-gold/15 text-gold-dark"
                        : r.status === "ANSWERED"
                          ? "bg-state-success/15 text-state-success"
                          : "bg-stone/15 text-stone"
                    }`}>
                      {r.status === "PENDING" ? "En attente" : r.status === "ANSWERED" ? "Traité" : "Archivé"}
                    </span>
                  </div>
                  <p className="text-xs text-stone mb-2 flex items-center gap-1">
                    {r.contact.includes("@") ? (
                      <Mail className="w-3 h-3" />
                    ) : (
                      <Phone className="w-3 h-3" />
                    )}
                    <a href={`mailto:${r.contact}`} className="hover:text-gold">{r.contact}</a>
                    <span className="ml-2">·</span>
                    <span>{new Date(r.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                  <p className="text-sm text-ink/80 leading-relaxed mt-2 p-3 bg-ivory rounded border border-stone/15">
                    {r.message}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <form action={updateStatus.bind(null, r.id, "ANSWERED")}>
                    <button
                      type="submit"
                      className="p-2 rounded hover:bg-state-success/10 text-stone hover:text-state-success transition-colors"
                      title="Marquer comme traité"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </form>
                  <form action={updateStatus.bind(null, r.id, "ARCHIVED")}>
                    <button
                      type="submit"
                      className="p-2 rounded hover:bg-stone/10 text-stone transition-colors"
                      title="Archiver"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </form>
                  <DeleteButton entity="contactrequests" id={r.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
