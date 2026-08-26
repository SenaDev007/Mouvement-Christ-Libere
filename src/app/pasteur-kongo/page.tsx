import Link from "next/link";
import { ChevronRight, BookOpen, Video, Users, Sparkles, Clock } from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "Pasteur Kongo | Mouvement Christ Libère",
  description: "Page du Pasteur Kongo — ministère pastoral. Contenu biographique à implémenter.",
};

export default function PasteurKongoPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[60vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1504052434529-acb89d45a1ab?q=80&w=1920&auto=format&fit=crop"
            alt="Bible ouverte"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Ministère pastoral
            </span>
          </div>
          <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-4">
            <span className="text-[#C9A227]">Pasteur</span> Kongo
          </h1>
          <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto">
            Berger de la communauté, marchant aux côtés de Pam dans l'œuvre du Royaume.
          </p>
        </div>
      </section>

      {/* ═══ MESSAGE « À IMPLÉMENTER » ═══ */}
      <section className="py-20 md:py-28">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C9A227]/10 mb-6">
            <Clock className="w-8 h-8 text-[#C9A227]" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-4">
            À implémenter
          </p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1E0F2B] mb-4">
            Biographie en cours de préparation
          </h2>
          <p className="text-sm md:text-base text-[#8A8378] leading-relaxed mb-8">
            Les informations biographiques du Pasteur Kongo seront bientôt disponibles.
            Nous collectons actuellement son témoignage authentique et son parcours.
            En attendant, il est reconnu comme le berger de la communauté,
            marchant aux côtés de Pam dans l'œuvre du Royaume.
            Revenez bientôt pour découvrir son parcours.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2A0E3D]/5 border border-[#8A8378]/20">
            <span className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />
            <span className="text-xs font-bold text-[#8A8378] uppercase tracking-wider">
              Contenu à venir
            </span>
          </div>
        </div>
      </section>

      {/* ═══ LIENS DISPONIBLES ═══ */}
      <section className="py-16 bg-[#2A0E3D]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              En attendant
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#FAF6EF]">
              Explorer le ministère
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link
              href="/enseignements?servant=kongo"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <BookOpen className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Enseignements
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Études bibliques : fêtes de l'Éternel, discernement spirituel.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Étudier <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/videos?servant=kongo"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <Video className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Vidéos & Lives
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Enseignements vidéo et directs du Pasteur Kongo.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Regarder <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/communaute"
              className="group bg-[#FAF6EF]/5 hover:bg-[#FAF6EF]/10 border border-[#C9A227]/20 hover:border-[#C9A227]/40 rounded-xl p-6 transition-all"
            >
              <Users className="w-6 h-6 text-[#C9A227] mb-3" />
              <h3 className="font-serif text-base font-bold text-[#FAF6EF] mb-1">
                Communauté
              </h3>
              <p className="text-xs text-[#FAF6EF]/60 leading-relaxed mb-3">
                Berger de la communauté, accompagnement pastoral.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                Rejoindre <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA PAM ═══ */}
      <section className="py-12 bg-[#1A0826]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
            Découvrez également
          </p>
          <Link
            href="/pam"
            className="inline-flex items-center gap-2 text-[#FAF6EF] hover:text-[#C9A227] font-serif text-lg font-bold transition-colors"
          >
            Pam — Afrika Alkebulane Pamela Dali <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
