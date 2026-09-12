import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Clock, BookOpen, GraduationCap, Calendar, User } from "lucide-react";
import { MarkdownText } from "@/components/site/markdown-text";
import { ShareButtons } from "@/components/site/share-buttons";
import { IsololeText } from "@/lib/isolole";

export const dynamic = "force-dynamic"; // Force dynamic — évite le pré-render au build (pas de DB au build)

interface PageProps {
  params: Promise<{ id: string }>;
}

// Images d'illustration selon le thème de l'enseignement
const THEME_IMAGES: Record<string, string> = {
  "Trinité": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Shabbat": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Dîme": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Baptême": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Mariage": "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1920&auto=format&fit=crop",
  "Sanctification": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1920&auto=format&fit=crop",
  "Prière": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Fêtes": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Chofar": "https://images.unsplash.com/photo-1519834785169-98be25ff3f6c?q=80&w=1920&auto=format&fit=crop",
  "Dispersés": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop",
  "Royaume": "https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1920&auto=format&fit=crop",
  "Combat spirituel": "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop",
  "Réveil": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
  "Prophétie": "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop",
  "Gouvernement": "https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=1920&auto=format&fit=crop",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop";

function getImageForTheme(theme: string): string {
  return THEME_IMAGES[theme] || DEFAULT_IMAGE;
}

export default async function TeachingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const teaching = await db.teaching.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!teaching) notFound();

  const heroImage = getImageForTheme(teaching.theme);
  const shareUrl = `/enseignements/${teaching.id}`;

  return (
    <div className="min-h-screen bg-[#F0E9DE]">
      {/* ═══ HERO avec image appropriée au thème ═══ */}
      <section className="relative min-h-[60vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#000000] text-[#F0E9DE]">
        <div className="absolute inset-0 z-0">
          <Image
            src={heroImage}
            alt={teaching.title}
            fill
            priority
            className="object-cover opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/70 via-[#000000]/80 to-[#000000]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Thème + niveau */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30 backdrop-blur-sm">
              {teaching.theme}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#000000]/40 text-[#F0E9DE]/80 border border-[#F0E9DE]/20 backdrop-blur-sm">
              {teaching.level}
            </span>
          </div>

          {/* Titre */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-[#F0E9DE] leading-tight mb-6 drop-shadow-lg">
            <IsololeText>{teaching.title}</IsololeText>
          </h1>

          {/* Résumé */}
          <p className="text-base md:text-lg text-[#F0E9DE]/70 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow">
            <IsololeText>{teaching.excerpt}</IsololeText>
          </p>

          {/* Métadonnées */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[#F0E9DE]/60">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#C9A227]" />
              {teaching.servant.shortName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C9A227]" />
              {teaching.readingTime}
            </span>
            {teaching.book && (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#C9A227]" />
                {teaching.book}
              </span>
            )}
            {teaching.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                {new Date(teaching.publishedAt).toLocaleDateString("fr-FR", {
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
          <div className="bg-white rounded-3xl shadow-xl border border-[#8A857C]/15 overflow-hidden">
            {/* En-tête carte */}
            <div className="px-8 md:px-12 py-6 bg-gradient-to-r from-[#000000]/5 to-transparent border-b border-[#8A857C]/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#000000] flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-[#C9A227]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C9A227]">
                    Enseignement biblique
                  </p>
                  <p className="text-sm font-bold text-[#000000]">
                    Enseigné par {teaching.servant.shortName}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="px-8 md:px-12 py-8 md:py-10">
              {/* Citation d'ouverture */}
              {teaching.excerpt && (
                <div className="mb-8 pb-6 border-b border-[#8A857C]/12">
                  <p className="font-serif text-lg md:text-xl italic text-[#000000] leading-relaxed">
                    « <IsololeText>{teaching.excerpt}</IsololeText> »
                  </p>
                </div>
              )}

              {/* Texte de l'enseignement (rendu markdown) */}
              <div className="prose-bio">
                <MarkdownText>{teaching.content}</MarkdownText>
              </div>

              {/* Référence biblique */}
              {teaching.book && (
                <div className="mt-8 p-4 rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/20">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-[#9C7E1E] mb-0.5">
                        Référence biblique
                      </p>
                      <p className="text-sm font-serif font-bold text-[#000000]">
                        {teaching.book}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div className="mt-8 pt-6 border-t border-[#8A857C]/12 flex items-center gap-3">
                <div className="w-10 h-px bg-[#C9A227]" />
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A857C]">
                  Rédigé par la rédaction de Christ Libère
                </span>
              </div>
            </div>
          </div>

          {/* Section partage */}
          <div className="mt-10 p-6 md:p-8 bg-white rounded-2xl shadow-md border border-[#8A857C]/15">
            <ShareButtons url={shareUrl} title={teaching.title} variant="light" />
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              href="/enseignements"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#000000] hover:text-[#FF7A1A] transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Tous les enseignements
            </Link>
            <Link
              href={teaching.servant.code === "pam" ? "/pam" : "/pasteur-kongo"}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#000000] hover:text-[#FF7A1A] transition-colors"
            >
              Voir {teaching.servant.shortName}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>

      {/* ═══ CITATION FINALE ═══ */}
      <section className="py-16 md:py-20 bg-[#000000] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <BookOpen className="w-10 h-10 text-[#C9A227] mx-auto mb-6 opacity-50" />
          <p className="font-serif text-xl md:text-2xl italic text-[#F0E9DE]/90 leading-relaxed mb-4">
            « La parole de Dieu est vivante et efficace, plus tranchante qu'une épée à deux tranchants. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">
            Hébreux 4:12
          </p>
        </div>
      </section>
    </div>
  );
}
