"use client";

/**
 * ⭐ V3.45 — PageHero CHARGÉ CÔTÉ CLIENT (pour les pages 100 % client
 * qui ne passent pas par un wrapper serveur — ex. /soustitrage).
 *
 * Rend immédiatement le hero avec les VALEURS PAR DÉFAUT du code
 * (fallback — zéro flash au premier rendu), puis charge la config
 * réelle (back-office) via /api/heroes?page=… et met à jour si elle
 * diffère. Chute douce : échec réseau → défauts conservés.
 *
 * Les pages importantes (landing, pam, pasteur-kongo, temoignages,
 * enseignements, bible, calendrier, vidéos, intercession, disperses,
 * contribuer, contact) utilisent le chemin SERVEUR (getHero) — ce
 * composant n'est prévu que pour les pages outils secondaires.
 */

import { useEffect, useState } from "react";
import { PageHero } from "@/components/site/page-hero";
import { DEFAULT_HEROES, HeroConfig } from "@/lib/hero-defaults";

interface ClientPageHeroProps {
  page: string;
  secondaryCtaNode?: React.ReactNode;
}

export function ClientPageHero({ page, secondaryCtaNode }: ClientPageHeroProps) {
  const [hero, setHero] = useState<HeroConfig>(
    () => DEFAULT_HEROES[page] ?? DEFAULT_HEROES.temoignages
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/heroes?page=${encodeURIComponent(page)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HeroConfig | null) => {
        if (!cancelled && data && data.page === page) setHero(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <PageHero
      imageSrc={hero.backgroundImage}
      kicker={hero.kicker}
      title={hero.title}
      titleAccent={hero.titleAccent || undefined}
      titleSuffix={hero.titleSuffix || undefined}
      subtitle={hero.subtitle}
      primaryCta={hero.ctaLabel ? { label: hero.ctaLabel, href: hero.ctaHref } : undefined}
      secondaryCta={hero.cta2Label ? { label: hero.cta2Label, href: hero.cta2Href } : undefined}
      secondaryCtaNode={secondaryCtaNode}
    />
  );
}
