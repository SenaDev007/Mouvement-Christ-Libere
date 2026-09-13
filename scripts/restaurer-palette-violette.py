#!/usr/bin/env python3
"""⭐ V3.75 — Restauration palette violette (Concept D) sur les fichiers
créés/modifiés APRÈS V3.68 avec la palette noir/or/feu.

Le revert de dc308d5 a restauré tous les fichiers qui existaient avant
V3.68, mais les fichiers NOUVEAUX (V3.69-V3.74 : admin/demandes,
admin/tresorerie, notifications, courrier+paramétrage, mot-de-passe-oublie,
email-templates…) ont été écrits AVEC la palette V3.68 — ils doivent être
convertis manuellement vers le violet impérial.
"""

import re
import sys

FICHIERS = [
    "src/app/admin/tresorerie/page.tsx",
    "src/app/admin/demandes/page.tsx",
    "src/app/secretariat/courrier/page.tsx",
    "src/app/tresorerie/caisse/page.tsx",
    "src/components/staff-space/notifications.tsx",
    "src/components/auth/mot-de-passe-oublie.tsx",
    "src/lib/email-templates.ts",
    "src/app/secretariat/demandes/page.tsx",
    "src/components/ui/navigation-menu-4.tsx",
    "src/app/admin/api/demandes/route.ts",
    "src/app/admin/api/demandes/[id]/route.ts",
    "src/app/secretariat/api/notifications/route.ts",
    "src/app/secretariat/api/courrier/route.ts",
]

# Règles ordonnées : les plus SPÉCIFIQUES d'abord.
REGLES = [
    # ── Gradients d'en-tête staff (V3.68 : noir/coal → violet impérial) ──
    ("from-[#000000] via-[#161513] to-[#000000]", "from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D]"),
    ("from-[#161513] to-[#000000]", "from-[#3D1A54] to-[#2A0E3D]"),
    ("from-[#000000] to-[#161513]", "from-[#2A0E3D] to-[#1A0826]"),
    ("via-[#161513]", "via-[#3D1A54]"),
    # ── Bouton or principal (texte noir → texte impérial) ──
    ("bg-[#C9A227] text-[#000000]", "bg-[#C9A227] text-[#2A0E3D]"),
    # ── Hovers feu → or clair (règle pre-V3.68 : l'or clair #DDBE55 est la
    #     couleur de hover, JAMAIS le feu) ──
    ("hover:bg-[#FF7A1A]", "hover:bg-[#DDBE55]"),
    ("hover:bg-[#FF7A1A]/", "hover:bg-[#DDBE55]/"),
    ("hover:text-[#FF7A1A]", "hover:text-[#DDBE55]"),
    ("hover:border-[#FF7A1A]", "hover:border-[#DDBE55]"),
    # ── Accents feu résiduels → or ──
    ("bg-[#FF7A1A]", "bg-[#C9A227]"),
    ("bg-[#FF7A1A]/", "bg-[#C9A227]/"),
    ("text-[#FF7A1A]", "text-[#C9A227]"),
    ("border-[#FF7A1A]", "border-[#C9A227]"),
    ("border-[#FF7A1A]/", "border-[#C9A227]/"),
    ("from-[#FF7A1A]", "from-[#DDBE55]"),
    ("to-[#FF7A1A]", "to-[#DDBE55]"),
    ("via-[#FF7A1A]", "via-[#DDBE55]"),
    # ── Fonds noirs → violet impérial ──
    ("bg-[#000000]", "bg-[#2A0E3D]"),
    ("bg-[#000000]/", "bg-[#2A0E3D]/"),
    ("bg-[#161513]", "bg-[#1A0826]"),
    ("bg-[#161513]/", "bg-[#1A0826]/"),
    ("border-[#000000]", "border-[#1E0F2B]"),
    ("border-[#161513]", "border-[#1A0826]"),
    # ── Textes noirs → encre violette ──
    ("text-[#000000]", "text-[#1E0F2B]"),
    ("text-[#000000]/", "text-[#1E0F2B]/"),
    ("text-[#161513]", "text-[#1A0826]"),
    # ── Blanc cassé → ivoire chaud ──
    ("#F0E9DE", "#FAF6EF"),
    ("#f0e9de", "#FAF6EF"),
    # ── Gris chaud V3.68 → stone Concept D ──
    ("#8A857C", "#8A8378"),
    ("#8a857c", "#8A8378"),
    ("#6B675F", "#6B6459"),
    ("#6b675f", "#6B6459"),
    # ── Constantes email-templates (valeurs JS) ──
    ('const FEU = "#FF7A1A";', 'const FEU = "#DDBE55"; /* or clair — hover/gradient (ex-feu V3.68, restauré) */'),
    ('const NOIR = "#000000";', 'const NOIR = "#2A0E3D"; /* violet impérial (ex-noir V3.68, restauré) */'),
    ('const IVOIRE = "#F0E9DE";', 'const IVOIRE = "#FAF6EF";'),
    ('const GRIS = "#8A857C";', 'const GRIS = "#8A8378";'),
    ('"#FF7A1A"', '"#DDBE55"'),
    ('"#000000"', '"#2A0E3D"'),
]

total = 0
for chemin in FICHIERS:
    try:
        with open(chemin, encoding="utf-8") as f:
            contenu = f.read()
    except FileNotFoundError:
        print(f"  (absent, ignoré) {chemin}")
        continue
    original = contenu
    for ancien, nouveau in REGLES:
        contenu = contenu.replace(ancien, nouveau)
    if contenu != original:
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(contenu)
        n = sum(1 for a, _ in REGLES if a in original)
        total += 1
        print(f"  ✔ converti : {chemin}")
    else:
        print(f"  · sans changement : {chemin}")

print(f"\n{total} fichiers convertis vers la palette violette Concept D.")
