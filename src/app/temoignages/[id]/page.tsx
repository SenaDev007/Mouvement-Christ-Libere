import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Clock, BookOpen, Quote, Calendar, User } from "lucide-react";
import { MarkdownText } from "@/components/site/markdown-text";
import { ShareButtons } from "@/components/site/share-buttons";

export const dynamic = "force-dynamic"; // Force dynamic — évite le pré-render au build (pas de DB au build)

interface PageProps {
  params: Promise<{ id: string }>;
}

// Images d'illustration selon le thème du témoignage
const THEME_IMAGES: Record<string, string> = {
  "Ciel": "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop",
  "Visite au ciel": "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop",
  "Royaume": "https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1920&auto=format&fit=crop",
  "Anges": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop",
  "Combat spirituel": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Résurrection": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1920&auto=format&fit=crop",
  "Sanctification": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Shabbat": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Chofar": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Prière": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Réveil": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
  "Afrique": "https://images.unsplash.com/photo-1519677100203-a9b5e1e1e1e1?q=80&w=1920&auto=format&fit=crop",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop";

function getImageForThemes(themes: string[]): string {
  for (const theme of themes) {
    if (THEME_IMAGES[theme]) return THEME_IMAGES[theme];
  }
  return DEFAULT_IMAGE;
}

export default async function TestimonyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const testimony = await db.testimony.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!testimony) notFound();

  const heroImage = getImageForThemes(testimony.themes);
  const shareUrl = `/temoignages/${testimony.id}`;

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO avec image appropriée au témoignage ═══ */}
      <section className="relative min-h-[60vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <Image
            src={heroImage}
            alt={testimony.title}
            fill
            priority
            className="object-cover opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Thèmes */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {testimony.themes.map((theme) => (
              <span
                key={theme}
                className="inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30 backdrop-blur-sm"
              >
                {theme}
              </span>
            ))}
          </div>

          {/* Titre */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-[#FAF6EF] leading-tight mb-6 drop-shadow-lg">
            {testimony.title}
          </h1>

          {/* Résumé */}
          <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow">
            {testimony.short}
          </p>

          {/* Métadonnées */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[#FAF6EF]/60">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#C9A227]" />
              {testimony.servant.shortName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C9A227]" />
              {testimony.readingTime}
            </span>
            {testimony.bookRef && (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#C9A227]" />
                {testimony.bookRef}
              </span>
            )}
            {testimony.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                {new Date(testimony.publishedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ═══ ARTICLE — style ghostwriter ═══ */}
      <article className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          {/* Carte texte principale */}
          <div className="bg-white rounded-3xl shadow-xl border border-[#8A8378]/15 overflow-hidden">
            {/* En-tête carte */}
            <div className="px-8 md:px-12 py-6 bg-gradient-to-r from-[#2A0E3D]/5 to-transparent border-b border-[#8A8378]/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#2A0E3D] flex-shrink-0">
                  <Quote className="w-5 h-5 text-[#C9A227]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A227]">
                    Témoignage authentique
                  </p>
                  <p className="text-sm font-bold text-[#1E0F2B]">
                    Récit rapporté par {testimony.servant.shortName}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="px-8 md:px-12 py-8 md:py-10">
              {/* Citation d'ouverture */}
              {testimony.short && (
                <div className="mb-8 pb-6 border-b border-[#8A8378]/12">
                  <p className="font-serif text-lg md:text-xl italic text-[#2A0E3D] leading-relaxed">
                    « {testimony.short} »
                  </p>
                </div>
              )}

              {/* Texte du témoignage (rendu markdown) */}
              <div className="prose-bio">
                <MarkdownText>{testimony.content}</MarkdownText>
              </div>

              {/* Référence biblique */}
              {testimony.bookRef && (
                <div className="mt-8 p-4 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/20">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-[#9C7E1E] mb-0.5">
                        Référence biblique
                      </p>
                      <p className="text-sm font-serif font-bold text-[#1E0F2B]">
                        {testimony.bookRef}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div className="mt-8 pt-6 border-t border-[#8A8378]/12 flex items-center gap-3">
                <div className="w-10 h-px bg-[#C9A227]" />
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378]">
                  Rédigé par la rédaction de Christ Libère
                </span>
              </div>
            </div>
          </div>

          {/* Section partage */}
          <div className="mt-10 p-6 md:p-8 bg-white rounded-2xl shadow-md border border-[#8A8378]/15">
            <ShareButtons url={shareUrl} title={testimony.title} variant="light" />
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              href="/temoignages"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Tous les témoignages
            </Link>
            <Link
              href={testimony.servant.code === "pam" ? "/pam" : "/pasteur-kongo"}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              Voir {testimony.servant.shortName}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>

      {/* ═══ CITATION FINALE ═══ */}
      <section className="py-16 md:py-20 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Quote className="w-10 h-10 text-[#C9A227] mx-auto mb-6 opacity-50" />
          <p className="font-serif text-xl md:text-2xl italic text-[#FAF6EF]/90 leading-relaxed mb-4">
            « Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">
            Christ Libère
          </p>
        </div>
      </section>
    </div>
  );
}
