"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { MarkdownText } from "@/components/site/markdown-text";
import { ChevronRight, FileText, BookOpen, Video, Sparkles, MapPin, Calendar, Quote, Users } from "lucide-react";

// Biographie authentique du Pasteur Nkosi Congo — rédigée à la troisième personne
const BIOGRAPHIE_GHOSTWRITER = `Le Pasteur Nkosi Congo n'est pas un homme venu au monde par hasard. Dans sa langue maternelle, le kikongo parlé en République Démocratique du Congo, le mot « Congo » dépasse le cadre d'un simple nom géographique : il est un mandat, une charge spirituelle et une prophétie vivante. Il signifie littéralement **Amour, Vérité, Justice, Sécurité et Royauté**. Sa vie entière est configurée pour incarner cette restauration de l'amour, de la justice et de la royauté du Père sur la terre des hommes.

## Les Origines : Le Congo, Centre de Gravité du Monde

Nkosi Congo est originaire de la République Démocratique du Congo, cette terre d'Afrique centrale que Dieu a placée au cœur du continent. Le kikongo est sa langue maternelle, et le Père lui a révélé un grand mystère : le paléo-hébreu, l'hébreu originel parlé par Moïse lorsqu'il reçut les Tables de la Loi sur le mont Sinaï, n'est autre que le kikongo. En 1960, deux chercheurs ont découvert l'écriture hébraïque originelle gravée dans 17 grottes de l'Obu, en RDC, et furent stupéfaits de constater qu'elle était identique au kikongo pur.

Le Congo se trouve à l'intersection exacte du méridien et de l'équateur, ce qui en fait le centre de gravité physique de la terre, le point d'équilibre qui stabilise le monde. Le Père a placé 80% des ressources minérales mondiales — or, cobalt, diamant, cuivre, coltan, lithium — sous le sol congolais. À chaque étape historique de l'humanité, le Congo a fourni la solution technologique : le caoutchouc pour l'industrie automobile, l'uranium pour la bombe atomique, le coltan pour la technologie mobile et le lithium pour la transition énergétique.

## La Préparation Secrète et les Trois Visites de Lucifer

Avant que son ministère ne soit manifesté publiquement, le Père céleste a tenu Nkosi Congo caché, isolé et équipé dans le secret le plus absolu pendant seize ans. Durant cette période d'intimité profonde à l'écart des théologies humaines, il a été enseigné directement par l'Esprit du Père.

C'est au cours de ce temps de préparation que le diable lui a personnellement rendu visite à trois reprises dans sa chambre pendant son sommeil. Bien que ses yeux physiques soient fermés, ses yeux spirituels étaient grands ouverts. Lucifer se présentait sous l'aspect d'une créature hybride : une forme de femme magnifique de la tête aux hanches, mais se terminant par un corps de serpent dans sa partie inférieure. À chacune de ses visites, Lucifer le fixait avec effroi et lui posait la même question d'une voix tremblante : *« Qui es-tu ? Qui es-tu ? »*

Pourquoi le diable tremblait-il ainsi ? Parce que Lucifer sait que dès qu'un fils de Dieu réalise sa véritable identité divine et son autorité royale, il devient extrêmement dangereux pour le règne des ténèbres.

## Le Lancement du Ministère en Côte d'Ivoire (Août 2025)

Après seize ans de silence et d'équipement, le Père lui a ordonné de sortir du secret. C'est le 7 août 2025 que son ministère public a été officiellement lancé à Abidjan, en Côte d'Ivoire, lors d'une grande campagne d'évangélisation prophétique. Il s'est présenté comme un ouvrier de la 11e heure, mandaté pour apporter un message d'amour et de vérité à une Afrique en plein réveil spirituel.

Le deuxième jour de la campagne, un vent violent a fait tomber le drapeau officiel qui portait les couleurs de la RDC et de la Côte d'Ivoire, représentant prophétiquement toute l'Afrique. Alors que le protocole allait intervenir, le Saint-Esprit lui dit : *« Non, toi va et ramasse le drapeau. »* Il releva lui-même le drapeau et le stabilisa en posant une pierre lourde à sa base. C'est alors que l'Éternel lui déclara : *« Ainsi parle l'Éternel, le temps fixé est arrivé pour redresser le drapeau de l'Afrique et stabiliser le continent. »* Ce geste prophétique a marqué le début spirituel de la restauration de la souveraineté africaine.

## La Vision Ministérielle : La Théologie de la Révélation

La mission du Pasteur Congo consiste à détruire la théologie de la répétition pour établir la théologie de la révélation. Les théologiens modernes et les pharisiens sont figés dans les dogmes du passé. Mais le Saint-Esprit est dynamique et vivant. Le Père a suscité les ouvriers de la 11e heure pour communiquer des révélations fraîches, des mystères cachés, et faire passer l'Église directement de la troisième à la onzième heure parce que le temps est fini.

Il rétablit l'horloge céleste des prières. À 5h00 du matin et à 18h00, le Père descend personnellement sur la terre pour visiter son peuple, court-circuitant les intermédiaires angéliques. Ceux qui veillent à ces portes sacrées sont chargés d'une puissance créatrice directe pour briser les fléaux et piller les portes de l'enfer.

## L'Alliance Familiale et Spirituelle

Dans sa marche et son ministère, le Père l'a entouré de piliers familiaux indispensables. Sa mère souffrait d'une grave dépendance au tabac, jusqu'au jour où le Seigneur lui ouvrit les yeux spirituels : elle vit, tapi à l'intérieur de son propre corps, un gros crapaud démoniaque qui fumait à sa place. Dès que cet esprit fut chassé par la puissance du sang de l'Agneau, l'addiction disparut instantanément.

Son épouse, qu'il appelle affectueusement « la reine Africa », est sa partenaire spirituelle indispensable. Elle est dotée d'une onction de révélation et voyage fréquemment en esprit dans le monde invisible. Chaque jour, à 18h00 précises, ils se tiennent ensemble à la brèche avec leurs enfants pour offrir le parfum du soir et accueillir le jour nouveau spirituel.

*Je poursuis ma course avec fidélité, déclarant la vérité qui affranchit les captifs. Si votre Dieu est mort, essayez le mien !*`;

export default function PasteurKongoPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO avec vraie photo du Pasteur Kongo ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/pasteur-kongo.jpeg"
            alt="Pasteur Kongo"
            fill
            priority
            className="object-cover object-center opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Ministère pastoral
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-4 drop-shadow-lg"
          >
            <span className="text-[#C9A227]">Pasteur</span> Kongo
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-lg text-[#FAF6EF]/80 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow"
          >
            La Voix de la Réforme Prophétique de la 11e Heure et la Restauration de l'Afrique.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#FAF6EF]/70"
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C9A227]" />
              Berger de la communauté
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
              Ministère pastoral
            </span>
          </motion.div>
        </div>
      </section>

      {/* ═══ BIOGRAPHIE — Style ghostwriter avec photo (comme Pam) ═══ */}
      <article className="py-16 md:py-24 bg-[#FAF6EF]">
        <div className="max-w-6xl mx-auto px-4">
          {/* En-tête biographie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-bold mb-3">
              Biographie
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1E0F2B] mb-4">
              La Voix de la Réforme Prophétique
            </h2>
            <div className="flex items-center justify-center gap-2">
              <div className="w-12 h-px bg-[#C9A227]/40" />
              <Quote className="w-4 h-4 text-[#C9A227]" />
              <div className="w-12 h-px bg-[#C9A227]/40" />
            </div>
          </motion.div>

          {/* Layout biographie : texte + photo côte à côte */}
          <div className="grid lg:grid-cols-[1fr_400px] gap-8 md:gap-12 items-start">
            {/* Colonne gauche : texte biographique (style ghostwriter) */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-2 lg:order-1"
            >
              <div className="bg-white rounded-2xl shadow-md border border-[#8A8378]/15 p-8 md:p-10 border-l-[4px] border-l-[#C9A227]">
                {/* Citation d'ouverture */}
                <div className="mb-6 pb-6 border-b border-[#8A8378]/15">
                  <p className="font-serif text-lg md:text-xl italic text-[#2A0E3D] leading-relaxed">
                    « Le temps fixé est arrivé pour redresser le drapeau de l'Afrique
                    et stabiliser le continent. »
                  </p>
                </div>

                {/* Texte biographique */}
                <div className="prose-bio">
                  <MarkdownText>{BIOGRAPHIE_GHOSTWRITER}</MarkdownText>
                </div>

                {/* Signature */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-px bg-[#C9A227]" />
                  <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8A8378]">
                    Biographie rédigée par la rédaction de Christ Libère
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Colonne droite : photo + nom animés (comme Pam) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="order-1 lg:order-2 lg:sticky lg:top-24"
            >
              <div className="relative group">
                {/* Halo doré animé derrière la photo */}
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#C9A227]/30 via-[#C9A227]/10 to-transparent blur-2xl pointer-events-none"
                />

                {/* Cadre photo */}
                <div className="relative bg-[#2A0E3D] rounded-2xl overflow-hidden shadow-xl border-2 border-[#C9A227]/30">
                  {/* Photo du Pasteur Kongo */}
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <Image
                      src="/pasteur-kongo.jpeg"
                      alt="Pasteur Kongo"
                      fill
                      sizes="(max-width: 1024px) 100vw, 400px"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Gradient overlay en bas */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2A0E3D] via-[#2A0E3D]/20 to-transparent" />

                    {/* Badge "Ministère pastoral" */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/80 backdrop-blur-sm border border-[#C9A227]/40"
                    >
                      <Sparkles className="w-3 h-3 text-[#C9A227]" />
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A227]">
                        Ministère pastoral
                      </span>
                    </motion.div>

                    {/* Nom + identité animés en bas de la photo */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#C9A227] mb-1"
                      >
                        Pasteur
                      </motion.p>
                      <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.4 }}
                        className="font-serif text-2xl font-bold text-[#FAF6EF] drop-shadow-lg"
                      >
                        Kongo
                      </motion.h3>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="h-0.5 bg-gradient-to-r from-[#C9A227] to-transparent mt-2 origin-left"
                      />
                    </div>
                  </div>

                  {/* Footer de la carte */}
                  <div className="px-5 py-4 border-t border-[#C9A227]/20">
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                      <span className="text-[#FAF6EF]/70 font-medium">
                        Berger de la communauté
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <Calendar className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                      <span className="text-[#FAF6EF]/70 font-medium">
                        Ministère pastoral
                      </span>
                    </div>
                  </div>
                </div>

                {/* Indicateur "Biographie officielle" */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C7E1E]">
                    Biographie officielle
                  </span>
                </motion.div>
              </div>
            </motion.div>
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
