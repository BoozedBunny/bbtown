const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

function getStrapiServiceHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
  };
}

export interface MailMessageDTO {
  id: string;
  senderName: string | null;
  senderAvatar: string | null;
  recipientId: string;
  subject: string;
  body: string;
  isRead: boolean;
  type: "SYSTEM" | "TRADE_PROPOSAL";
  createdAt: string;
}

export async function sendSystemMail(
  recipientDocId: string,
  subject: string,
  body: string,
  type: "SYSTEM" | "TRADE_PROPOSAL" = "SYSTEM"
): Promise<boolean> {
  const headers = getStrapiServiceHeaders();

  try {
    const res = await fetch(`${STRAPI_BASE_URL}/api/mail-messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          sender: null, // SYSTEM is represented by a null sender
          recipient: recipientDocId,
          subject,
          body,
          isRead: false,
          type,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[mail] Failed to dispatch system mail: ${res.status} ${txt}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] Failed to dispatch system mail:", error);
    return false;
  }
}

export async function getPlayerInbox(username: string): Promise<MailMessageDTO[]> {
  const headers = getStrapiServiceHeaders();

  // 1. Fetch user by username
  const userUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
  userUrl.searchParams.set("filters[username][$eq]", username);
  const userRes = await fetch(userUrl, { headers, cache: "no-store" });
  if (!userRes.ok) throw new Error("Failed to look up user");
  const users = await userRes.json();
  const user = users?.[0];
  if (!user) throw new Error(`User not found: ${username}`);

  const authUserId = user.id;

  // 2. Fetch Player Profile using authUserId
  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserId));
  profileUrl.searchParams.set("pagination[limit]", "1");
  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  const profileJson = await profileRes.json();
  const profile = profileJson.data?.[0];
  if (!profile) throw new Error(`Player profile not found for: ${username}`);

  const profileDocId = profile.documentId ?? String(profile.id);

  // 3. Fetch mail messages for this recipient
  const mailUrl = new URL(`${STRAPI_BASE_URL}/api/mail-messages`);
  mailUrl.searchParams.set("filters[recipient][documentId][$eq]", profileDocId);
  mailUrl.searchParams.set("sort", "createdAt:desc");
  mailUrl.searchParams.set("populate", "sender");
  mailUrl.searchParams.set("pagination[limit]", "100");

  const mailRes = await fetch(mailUrl, { headers, cache: "no-store" });
  if (!mailRes.ok) throw new Error("Failed to fetch player mailbox");
  const mailJson = await mailRes.json();
  const rawMail: any[] = mailJson.data ?? [];

  return rawMail.map((raw) => {
    const sender = raw.sender;
    return {
      id: raw.documentId ?? String(raw.id),
      senderName: sender ? String(sender.username || "Player") : "SYSTEM NODE",
      senderAvatar: sender ? String(sender.avatar || "bunny") : "system",
      recipientId: profileDocId,
      subject: String(raw.subject ?? ""),
      body: String(raw.body ?? ""),
      isRead: Boolean(raw.isRead),
      type: raw.type || "SYSTEM",
      createdAt: raw.createdAt ?? new Date().toISOString(),
    };
  });
}

export async function getUnreadMailCount(username: string): Promise<number> {
  const headers = getStrapiServiceHeaders();

  try {
    // 1. Fetch user by username
    const userUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
    userUrl.searchParams.set("filters[username][$eq]", username);
    const userRes = await fetch(userUrl, { headers, cache: "no-store" });
    if (!userRes.ok) return 0;
    const users = await userRes.json();
    const user = users?.[0];
    if (!user) return 0;

    const authUserId = user.id;

    // 2. Fetch Player Profile using authUserId
    const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
    profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserId));
    profileUrl.searchParams.set("pagination[limit]", "1");
    const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
    const profileJson = await profileRes.json();
    const profile = profileJson.data?.[0];
    if (!profile) return 0;

    const profileDocId = profile.documentId ?? String(profile.id);

    // 3. Query unread mail count
    const mailUrl = new URL(`${STRAPI_BASE_URL}/api/mail-messages`);
    mailUrl.searchParams.set("filters[recipient][documentId][$eq]", profileDocId);
    mailUrl.searchParams.set("filters[isRead][$eq]", "false");
    mailUrl.searchParams.set("pagination[limit]", "1");

    const mailRes = await fetch(mailUrl, { headers, cache: "no-store" });
    if (!mailRes.ok) return 0;
    const mailJson = await mailRes.json();
    return Number(mailJson.meta?.pagination?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function markMailAsRead(messageDocId: string): Promise<boolean> {
  const headers = getStrapiServiceHeaders();

  try {
    const res = await fetch(`${STRAPI_BASE_URL}/api/mail-messages/${messageDocId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          isRead: true,
        },
      }),
    });

    return res.ok;
  } catch (error) {
    console.error("[mail] Failed to mark mail as read:", error);
    return false;
  }
}

export async function deleteMailMessage(messageDocId: string): Promise<boolean> {
  const headers = getStrapiServiceHeaders();

  try {
    const res = await fetch(`${STRAPI_BASE_URL}/api/mail-messages/${messageDocId}`, {
      method: "DELETE",
      headers,
    });

    return res.ok;
  } catch (error) {
    console.error("[mail] Failed to delete mail message:", error);
    return false;
  }
}
