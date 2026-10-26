export type Translation = { title: string; description: string };

export const GUIDE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
] as const;
