import crypto from "crypto";

export const toUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const dateKeyToUtcDate = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);

export const seededPercent = (seed: string, min: number, max: number) => {
  const hash = crypto.createHash("sha256").update(seed).digest();
  const int = hash.readUInt32BE(0);
  const unit = int / 0xffffffff;
  return min + unit * (max - min);
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roundInt = (value: number) => Math.round(value);
