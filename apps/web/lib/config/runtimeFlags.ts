export type StrapiSotMode = "off" | "shadow" | "on";

function normalizeMode(value: string | undefined): StrapiSotMode {
  if (value === "off" || value === "shadow" || value === "on") return value;
  return "shadow";
}

function normalizeBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function getRuntimeFlags() {
  const strapiSotMode = normalizeMode(process.env.STRAPI_SOT_MODE);
  return {
    strapiSotMode,
    legacyWriteEnabled: normalizeBool(process.env.LEGACY_WRITE_ENABLED, true),
    strapiAdminOverrideWins: normalizeBool(process.env.STRAPI_ADMIN_OVERRIDE_WINS, true),
  };
}

export function isStrapiSotOn() {
  return getRuntimeFlags().strapiSotMode === "on";
}
