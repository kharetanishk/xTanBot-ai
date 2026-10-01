/** Single source of truth for the app's look. Dark, soft, amber accent. */
export const colors = {
  bg: "#09090b",
  surface: "#111827",
  surfaceAlt: "#1f2937",
  border: "#1f2937",
  borderStrong: "#374151",
  text: "#f9fafb",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  accent: "#FBBF24",
  accentSoft: "rgba(251,191,36,0.12)",
  onAccent: "#0a0a0a",
  success: "#22c55e",
  successSoft: "rgba(34,197,94,0.12)",
  danger: "#ef4444",
  dangerSoft: "rgba(239,68,68,0.12)",
  info: "#818cf8",
  infoSoft: "rgba(129,140,248,0.14)",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export type Tone = "neutral" | "accent" | "success" | "danger" | "info";

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textMuted, bg: colors.surfaceAlt },
  accent: { fg: colors.accent, bg: colors.accentSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
};
