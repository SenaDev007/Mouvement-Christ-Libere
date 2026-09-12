"use client";

/**
 * ⭐ V3.66 — Graphiques du tableau de bord Trésorerie (recharts).
 *
 *  · GrapheMensuel : recettes vs dépenses des 6 derniers mois (barres) ;
 *  · GrapheCategories : répartition par catégorie (donut recettes / anneau dépenses).
 *
 * Palette du ministère : vert #5B7052 (recettes), rouge #B3452E (dépenses),
 * or #C9A227, violet #8C5FA8, taupe #8A8378.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  RECETTE_CATEGORIES,
  DEPENSE_CATEGORIES,
  formaterMontant,
  libelleCategorie,
} from "@/lib/staff-space/constants";

export interface SerieMensuelle {
  mois: string;
  recettes: number;
  depenses: number;
}

export interface DonneeCategorie {
  categorie: string;
  recettes: number;
  depenses: number;
}

export function GrapheMensuel({
  serie,
  devise,
}: {
  serie: SerieMensuelle[];
  devise: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={serie} barGap={4}>
        <XAxis
          dataKey="mois"
          tick={{ fill: "#8A8378", fontSize: 11 }}
          axisLine={{ stroke: "#8A8378/30" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#8A8378", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip
          formatter={(value: number, nom: string) => [
            formaterMontant(Number(value), devise),
            nom === "recettes" ? "Recettes" : "Dépenses",
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(138,131,120,0.25)",
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(v: string) => (v === "recettes" ? "Recettes" : "Dépenses")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="recettes" fill="#5B7052" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="depenses" fill="#B3452E" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const COULEURS = ["#C9A227", "#5B7052", "#8C5FA8", "#B3452E", "#8A8378", "#A3821C", "#6B4480", "#3F5039"];

export function GrapheCategories({
  categories,
  devise,
}: {
  categories: DonneeCategorie[];
  devise: string;
}) {
  // Donut recettes.
  const donneesRecettes = categories
    .filter((c) => c.recettes > 0)
    .map((c) => ({
      nom: libelleCategorie(c.categorie, "RECETTE"),
      valeur: c.recettes,
    }));
  const donneesDepenses = categories
    .filter((c) => c.depenses > 0)
    .map((c) => ({
      nom: libelleCategorie(c.categorie, "DEPENSE"),
      valeur: c.depenses,
    }));

  if (donneesRecettes.length === 0 && donneesDepenses.length === 0) {
    return (
      <p className="text-xs text-[#8A8378] text-center py-10">
        Aucune donnée à afficher sur la période.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {donneesRecettes.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#3F5039] mb-1 text-center">
            Recettes par catégorie
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donneesRecettes}
                dataKey="valeur"
                nameKey="nom"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
              >
                {donneesRecettes.map((_, i) => (
                  <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, nom: string) => [
                  formaterMontant(Number(v), devise),
                  nom,
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(138,131,120,0.25)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-1 mt-1">
            {donneesRecettes.map((d, i) => (
              <li key={d.nom} className="flex items-center gap-2 text-[11px] text-[#1E0F2B]">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COULEURS[i % COULEURS.length] }}
                />
                <span className="truncate flex-1">{d.nom}</span>
                <span className="text-[#8A8378]">
                  {formaterMontant(d.valeur, devise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {donneesDepenses.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#B3452E] mb-1 text-center">
            Dépenses par catégorie
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donneesDepenses}
                dataKey="valeur"
                nameKey="nom"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
              >
                {donneesDepenses.map((_, i) => (
                  <Cell key={i} fill={COULEURS[(i + 2) % COULEURS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, nom: string) => [
                  formaterMontant(Number(v), devise),
                  nom,
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(138,131,120,0.25)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-1 mt-1">
            {donneesDepenses.map((d, i) => (
              <li key={d.nom} className="flex items-center gap-2 text-[11px] text-[#1E0F2B]">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COULEURS[(i + 2) % COULEURS.length] }}
                />
                <span className="truncate flex-1">{d.nom}</span>
                <span className="text-[#8A8378]">
                  {formaterMontant(d.valeur, devise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Exportés pour les libellés d'affichage. */
export { RECETTE_CATEGORIES, DEPENSE_CATEGORIES };
