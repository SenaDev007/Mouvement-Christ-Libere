import { PAM_BIOGRAPHY } from "@/lib/data/authentic-content";
import { MarkdownText } from "@/components/site/markdown-text";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, FileText, BookOpen, Video, MapPin, Calendar, Sparkles } from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "Pam — Afrika Alkebulane Pamela Dali | Christ Libère",
  description: "Biographie authentique de la Servante de Dieu Pamela Dali : ses origines en Afrique (Alkebulan), son appel en 2003, sa traversée du désert, sa mort le 18 juillet 2011 et sa résurrection.",
};

export default function PamPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO avec vraie photo de Pam ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/pam.jpeg"
            alt="Afrika Alkebulane Pamela Dali"
            fill
            priority
            className="object-cover object-center opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Servante de l'Éternel
            </span>
          </div>
          <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-4 drop-shadow-lg">
            Afrika Alkebulane
            <br />
            <span className="text-[#C9A227]">Pamela Dali</span>
          </h1>
          <p className="text-base md:text-lg text-[#FAF6EF]/80 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow">
            Biographie authentique d'une servante marquée dès le sein maternel,
            morte le 18 juillet 2011 et ressuscitée pour témoigner du Royaume des Cieux.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#FAF6EF]/70">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C9A227]" />
              Alkebulan (Afrique)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
              Appel en 2003 · Résurrection en 2011
            </span>
          </div>
        </div>
      </section>

      {/* ═══ BIOGRAPHIE — Article ═══ */}
      <article className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          {/* En-tête biographie */}
          <div className="mb-12 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Biographie
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1E0F2B] mb-4">
              Ma Marche avec Adonaï
            </h2>
            <p className="text-sm text-[#8A8378] italic max-w-xl mx-auto">
              « Mon histoire, ma mort et ma résurrection — écrite avec mes propres mots,
              pour que votre manière de suivre le Christ change. »
            </p>
          </div>

          {/* Sections biographiques */}
          <div className="space-y-12">
            {PAM_BIOGRAPHY.map((section, i) => (
              <section key={i} className="relative">
                {/* Numéro de section */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2A0E3D] text-[#C9A227] text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {section.date && (
                    <span className="text-xs uppercase tracking-[0.18em] font-bold text-[#C9A227]">
                      {section.date}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl md:text-2xl font-bold text-[#1E0F2B] mb-4 leading-tight">
                  {section.title}
                </h3>
                <div className="prose-bio">
                  <MarkdownText>{section.description}</MarkdownText>
                </div>
              </section>
            ))}
          </div>

          {/* Citation finale */}
          <div className="mt-16 p-8 rounded-2xl bg-[#2A0E3D] text-[#FAF6EF] text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <p className="font-serif text-lg md:text-xl italic leading-relaxed mb-3">
                « Le ciel existe, et l'enfer existe bel et bien,
                je les ai vus de mes propres yeux. »
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">
                — Pamela Dali
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* ═══ LIENS VERS AUTRES CONTENUS ═══ */}
      <section className="py-16 bg-[#2A0E3D]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Aller plus loin
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#FAF6EF]">
              Découvrir le ministère de Pam
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link
              href="/temoignages?servant=pam"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <FileText className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Témoignages
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Récits détaillés des enlèvements au ciel et paroles reçues.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Lire <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/enseignements?servant=pam"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <BookOpen className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Enseignements
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Études bibliques : Trinité, Shabbat, dîme, baptême, mariage.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Étudier <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/videos?servant=pam"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <Video className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Vidéos & Lives
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Enseignements vidéo et lives archivés dans leur intégralité.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Regarder <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA Pasteur Kongo ═══ */}
      <section className="py-12 bg-[#1A0826]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
            Découvrez également
          </p>
          <Link
            href="/pasteur-kongo"
            className="inline-flex items-center gap-2 text-[#FAF6EF] hover:text-[#C9A227] font-serif text-lg font-bold transition-colors"
          >
            Le Pasteur Kongo <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
