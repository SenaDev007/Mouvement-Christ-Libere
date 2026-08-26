"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from "react";

export type ServantId = "pam" | "kongo" | "commun";

export interface Servant {
  id: ServantId;
  name: string;
  fullName: string;
  shortName: string;
  role: string;
  bio: string;
  portrait: string; // initiales pour médaillon
}

const SERVANTS: Record<ServantId, Servant> = {
  pam: {
    id: "pam",
    name: "Pam",
    fullName: "Afrika Alkebulane Pamela Dali",
    shortName: "Pam",
    role: "Servante de l'Éternel",
    bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole.",
    portrait: "AP",
  },
  kongo: {
    id: "kongo",
    name: "Pasteur Kongo",
    fullName: "Pasteur Kongo",
    shortName: "Pasteur Kongo",
    role: "Époux, ministre pastoral",
    bio: "Ministère pastoral complémentaire, enseignements et partages spirituels.",
    portrait: "PK",
  },
  commun: {
    id: "commun",
    name: "Commun",
    fullName: "Pam & Pasteur Kongo",
    shortName: "Pam & Pasteur Kongo",
    role: "Ministère conjoint",
    bio: "Déclarations officielles, enseignements communs, vision partagée du couple.",
    portrait: "MC",
  },
};

interface ServantContextValue {
  current: ServantId;
  servant: Servant;
  setServant: (id: ServantId) => void;
  servants: Record<ServantId, Servant>;
}

const ServantContext = createContext<ServantContextValue | null>(null);

export function ServantProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ServantId>("commun");

  const value = useMemo<ServantContextValue>(
    () => ({
      current,
      servant: SERVANTS[current],
      setServant: setCurrent,
      servants: SERVANTS,
    }),
    [current]
  );

  return (
    <ServantContext.Provider value={value}>{children}</ServantContext.Provider>
  );
}

export function useServant() {
  const ctx = useContext(ServantContext);
  if (!ctx) {
    throw new Error("useServant must be used within ServantProvider");
  }
  return ctx;
}

export { SERVANTS };
