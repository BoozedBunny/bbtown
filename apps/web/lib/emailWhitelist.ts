export const EMAIL_WHITELIST = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.de",
  "hotmail.com",
  "hotmail.de",
  "outlook.com",
  "outlook.de",
  "live.com",
  "live.de",
  "aol.com",
  "icloud.com",
  "mail.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "freenet.de",
  "zoho.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
];

export function isEmailWhitelisted(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const parts = email.trim().split("@");
  const domain = parts[parts.length - 1]?.toLowerCase();
  return EMAIL_WHITELIST.includes(domain);
}
