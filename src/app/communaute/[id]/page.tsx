import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { ChannelView } from "@/components/premium/channel-view";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { isMatrixConfigured } from "@/lib/matrix";
import { AlertCircle, Lock } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;

  const channel = await db.channel.findUnique({
    where: { id },
    include: {
      community: true,
      members: { include: { user: true } },
    },
  });

  if (!channel) notFound();

  // Récupérer tous les canaux de la même communauté pour la sidebar
  const allChannels = await db.channel.findMany({
    where: { communityId: channel.communityId },
    orderBy: { order: "asc" },
    include: { _count: { select: { members: true } } },
  });

  const serializedChannels = allChannels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || "",
    type: c.type.toLowerCase() as "text" | "voice" | "video" | "announcement" | "restricted",
    isEncrypted: c.isEncrypted,
    memberCount: c._count.members,
  }));

  const matrixConfigured = isMatrixConfigured();

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1511632765486-a0a80de485a5?q=80=w=1920&auto=format&fit=crop"
        kicker={channel.isEncrypted ? "Canal chiffré E2E" : "Canal de communauté"}
        title={channel.name}
        subtitle={channel.description || "Canal de discussion de la communauté Mouvement Christ Libère."}
        primaryCta={{ label: "Retour aux canaux", href: "/communaute" }}
      />

      <section className="bg-[#FAF6EF] py-12 md:py-16">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Alerte mode démo si Matrix n'est pas configuré */}
          {!matrixConfigured && (
            <div className="mb-6 p-4 rounded-2xl bg-[#C9A227]/5 border border-[#C9A227]/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#1E0F2B] mb-1">
                  Mode démonstration
                </p>
                <p className="text-xs text-[#8A8378] leading-relaxed">
                  Le serveur Matrix Synapse n&apos;est pas encore configuré.
                  L&apos;interface de messagerie fonctionne en mode démo (messages simulés localement).
                  Pour activer le chiffrement E2E réel et la messagerie temps réel,
                  déployez un serveur Matrix Synapse et configurez la variable{" "}
                  <code className="px-1 py-0.5 rounded bg-[#8A8378]/10 text-[#A3821C] font-mono text-[10px]">
                    NEXT_PUBLIC_MATRIX_HOMESERVER_URL
                  </code>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Bandeau sécurité si canal chiffré */}
          {channel.isEncrypted && (
            <div className="mb-6 p-4 rounded-2xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#1E0F2B] mb-1">
                  Canal chiffré de bout en bout
                </p>
                <p className="text-xs text-[#8A8378] leading-relaxed">
                  Les messages de ce canal sont chiffrés (Signal Protocol via Matrix).
                  Seuls les participants du canal disposent des clés de déchiffrement.
                  Ni l&apos;équipe technique ni les hébergeurs n&apos;y ont accès.
                </p>
              </div>
            </div>
          )}

          {/* Interface de messagerie */}
          <ChannelView channels={serializedChannels} initialChannelId={channel.id} />
        </div>
      </section>
    </div>
  );
}
