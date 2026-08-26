import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, BookOpen, Share2 } from "lucide-react";
import { MarkdownText } from "@/components/site/markdown-text";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TestimonyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const testimony = await db.testimony.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!testimony) notFound();

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop"
        kicker={testimony.themes.join(" · ")}
        title={testimony.title}
        subtitle={testimony.short}
        primaryCta={{ label: "Tous les témoignages", href: "/temoignages" }}
      />

      {/* Article */}
      <section className="py-16 md:py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4">
          {/* Meta */}
          <div className="flex items-center gap-4 mb-8 text-sm text-[#8A8378]">
            <span className="font-semibold text-[#1E0F2B]">{testimony.servant.shortName}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {testimony.readingTime}
            </span>
            {testimony.bookRef && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {testimony.bookRef}
              </span>
            )}
          </div>

          {/* Contenu — rendu Markdown */}
          <article className="prose prose-lg max-w-none">
            <MarkdownText>{testimony.content}</MarkdownText>
          </article>

          {/* Thèmes */}
          <div className="mt-12 pt-8 border-t border-[#C9A227]/20">
            <div className="flex flex-wrap gap-2">
              {testimony.themes.map((theme) => (
                <span
                  key={theme}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8] border border-[#8C5FA8]/20"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              href="/temoignages"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Tous les témoignages
            </Link>
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors">
              <Share2 className="w-4 h-4" />
              Partager discrètement
            </button>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="py-20 md:py-28 bg-[#2A0E3D] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4">
          <QuoteBlock
            text="Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe."
            reference="Pam — Christ Libère"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
