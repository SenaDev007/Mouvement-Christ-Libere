"use client";

import Image from "next/image";

/**
 * ⭐ V3.45 — Image intelligente : next/image (optimisée) pour les
 * chemins locaux et URLs http(s), <img> natif pour les data URLs
 * (photos uploadées depuis le back-office — next/image ne les traite
 * pas : on évite tout risque de loader invalide).
 *
 * Même API que next/image en version fixe (width/height).
 */
export function SmartImage({
  src,
  alt,
  width,
  height,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) return null;
  if (src.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} className={className} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
