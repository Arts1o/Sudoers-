/**
 * Catalogue de la « Fabrique à histoires ».
 *
 * Partagé entre le client (UI de composition) et le serveur (construction du
 * prompt). Aucun import Node/React ici : ce module doit rester neutre.
 *
 * Le modèle de profilage vient de la branche `react` (main.jsx) : l'âge pilote
 * l'écriture (longueur, vocabulaire, façon d'amener la notion), et quatre
 * « ingrédients » composent le récit.
 */

export type AgeId = '4-6' | '7-9' | '10-12' | '13-16';

export interface AgeBucket {
  id: AgeId;
  label: string;
  sub: string;
  /** Consigne d'adaptation injectée dans le prompt du modèle. */
  guidance: string;
}

export const AGES: AgeBucket[] = [
  {
    id: '4-6',
    label: '4–6 ans',
    sub: 'Tout-petits',
    guidance:
      'Phrases très courtes et simples, beaucoup de répétitions et de sons rigolos, 4 à 5 petits paragraphes, ton chaleureux et rassurant. Le concept est abordé de façon très concrète et imagée, sans aucun vocabulaire technique.',
  },
  {
    id: '7-9',
    label: '7–9 ans',
    sub: 'Primaire',
    guidance:
      'Phrases simples mais variées, un peu de dialogue, 5 à 6 paragraphes, une petite énigme à résoudre. Le concept est expliqué avec une image concrète et un exemple facile.',
  },
  {
    id: '10-12',
    label: '10–12 ans',
    sub: 'Collège',
    guidance:
      "Vocabulaire plus riche, intrigue avec un rebondissement, 6 à 7 paragraphes, le personnage raisonne à voix haute. Le concept est présenté avec ses idées clés et un exemple chiffré simple.",
  },
  {
    id: '13-16',
    label: '13–16 ans',
    sub: 'Ados',
    guidance:
      "Récit plus mature avec de vrais enjeux et de la tension, 6 à 8 paragraphes. Le concept est expliqué avec précision : énoncé, conditions d'application et un exemple concret travaillé.",
  },
];

export type CatKey = 'lieu' | 'personnage' | 'objet' | 'theme';

export interface Category {
  /** Numéro affiché (« 01 », « 02 »…). */
  n: string;
  titre: string;
  /** Classe de couleur appliquée côté CSS (cat--lieu, etc.). */
  color: CatKey;
  placeholder: string;
  options: string[];
}

export const CATS: Record<CatKey, Category> = {
  lieu: {
    n: '01',
    titre: 'Le lieu',
    color: 'lieu',
    placeholder: 'Autre lieu…',
    options: [
      'une forêt enchantée',
      'un château fort',
      'une plage déserte',
      "l'espace",
      'une ville futuriste',
      'une ferme',
      "le fond de l'océan",
      'une montagne enneigée',
    ],
  },
  personnage: {
    n: '02',
    titre: 'Le personnage',
    color: 'personnage',
    placeholder: 'Autre personnage…',
    options: [
      'un petit dragon',
      'une princesse intrépide',
      'un robot curieux',
      'une exploratrice',
      'un chat parlant',
      'un jeune magicien',
      'une astronaute',
      'un renard malin',
    ],
  },
  objet: {
    n: '03',
    titre: "L'objet",
    color: 'objet',
    placeholder: 'Autre objet…',
    options: [
      'une clé dorée',
      'un télescope',
      'une carte au trésor',
      'une boussole magique',
      'un grand miroir',
      'une longue corde',
      'une lanterne',
      'un carnet de croquis',
    ],
  },
  theme: {
    n: '04',
    titre: 'La notion à apprendre',
    color: 'theme',
    placeholder: 'Autre notion…',
    options: [
      'le théorème de Thalès',
      'le théorème de Pythagore',
      'les fractions',
      "le cycle de l'eau",
      'la photosynthèse',
      'la gravité',
      'les fuseaux horaires',
      'la symétrie',
      'les nombres premiers',
      'le système solaire',
    ],
  },
};

export const CAT_ORDER: CatKey[] = ['lieu', 'personnage', 'objet', 'theme'];

export type Picks = Record<CatKey, string>;

export interface Story {
  titre: string;
  paragraphes: string[];
  lecon: string;
}

export const DEFAULT_PICKS: Picks = {
  lieu: 'une forêt enchantée',
  personnage: 'un petit dragon',
  objet: 'une clé dorée',
  theme: 'le théorème de Thalès',
};

export const DEFAULT_AGE: AgeId = '7-9';

export const LOADING_LINES = [
  'On allume la lanterne…',
  'On choisit les mots justes…',
  'On installe le décor…',
  'Il était une fois…',
];

export function ageById(id: string): AgeBucket | undefined {
  return AGES.find((a) => a.id === id);
}
