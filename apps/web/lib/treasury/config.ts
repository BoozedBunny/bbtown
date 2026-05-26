const parseNumber = (value: string | undefined, defaultValue: number) => {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseIntNumber = (value: string | undefined, defaultValue: number) => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const treasuryConfig = {
  dailyVariationMinPct: parseNumber(process.env.TREASURY_DAILY_VARIATION_MIN_PCT, -1.5) / 100,
  dailyVariationMaxPct: parseNumber(process.env.TREASURY_DAILY_VARIATION_MAX_PCT, 1.2) / 100,
  dailyVariationFloorAbs: parseIntNumber(process.env.TREASURY_DAILY_VARIATION_FLOOR_ABS, -250),
  dailyVariationCapAbs: parseIntNumber(process.env.TREASURY_DAILY_VARIATION_CAP_ABS, 1500),
  treasuryFloorBalance: parseIntNumber(process.env.TREASURY_FLOOR_BALANCE, 0),
  treasuryReserveMin: parseIntNumber(process.env.TREASURY_RESERVE_MIN, 1000),

  loanMaxLtvOfWallet: parseNumber(process.env.LOAN_MAX_LTV_OF_WALLET, 3),
  loanHardCap: parseIntNumber(process.env.LOAN_HARD_CAP, 25_000),
  loanMinPrincipal: parseIntNumber(process.env.LOAN_MIN_PRINCIPAL, 500),
  loanAprBps: parseIntNumber(process.env.LOAN_APR_BPS, 1200),
  loanTermDays: parseIntNumber(process.env.LOAN_TERM_DAYS, 7),
  loanOriginationFeeBps: parseIntNumber(process.env.LOAN_ORIGINATION_FEE_BPS, 100),
  loanLateFeeFlat: parseIntNumber(process.env.LOAN_LATE_FEE_FLAT, 150),
  loanGraceDays: parseIntNumber(process.env.LOAN_GRACE_DAYS, 1),
  loanCooldownDaysAfterClose: parseIntNumber(process.env.LOAN_COOLDOWN_DAYS_AFTER_CLOSE, 2),
  loanDefaultDays: parseIntNumber(process.env.LOAN_DEFAULT_DAYS, 5),
  loanDefaultLockDays: parseIntNumber(process.env.LOAN_DEFAULT_LOCK_DAYS, 7),
  repayMinAmount: parseIntNumber(process.env.REPAY_MIN_AMOUNT, 100),
  quoteTtlMs: parseIntNumber(process.env.LOAN_QUOTE_TTL_MS, 30_000),
  quoteSalt: process.env.LOAN_QUOTE_SALT ?? "bbtown-loan-quote-salt",
};
