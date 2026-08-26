import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, BookOpen, Download, Mail, Rss } from "lucide-react";
import { MarkdownText } from "@/components/site/markdown-text";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeachingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const teaching = await db.teaching.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!teaching) notFound();

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop"
        kicker={`${teaching.theme} · ${teaching.book}`}
        title={teaching.title}
        subtitle={teaching.excerpt}
        primaryCta={{ label: "Tous les enseignements", href: "/enseignements" }}
      />

      {/* Article */}
      <section className="py-16 md:py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4">
          {/* Meta */}
          <div className="flex items-center gap-4 mb-8 text-sm text-[#8A8378]">
            <span className="font-semibold text-[#1E0F2B]">{teaching.servant.shortName}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {teaching.readingTime}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-[#C9A227]/15 text-[#C9A227]">
              {teaching.level}
            </span>
          </div>

          {/* Contenu — rendu Markdown */}
          <article className="prose prose-lg max-w-none">
            <MarkdownText>{teaching.content}</MarkdownText>
          </article>

          {/* Actions */}
          <div className="mt-12 pt-8 border-t border-[#C9A227]/20 flex flex-wrap items-center gap-4">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#2A0E3D]/20 text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Télécharger en PDF
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#2A0E3D]/20 text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors">
              <Mail className="w-3.5 h-3.5" />
              Envoyer par email
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#2A0E3D]/20 text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors">
              <Rss className="w-3.5 h-3.5" />
              Flux RSS
            </button>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <Link
              href="/enseignements"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Tous les enseignements
            </Link>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="py-20 md:py-28 bg-[#2A0E3D] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4">
          <QuoteBlock
            text="La parole de Dieu est vivante et efficace, plus tranchante qu'une épée à deux tranchants."
            reference="Hébreux 4:12"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
