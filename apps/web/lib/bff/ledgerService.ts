// Ledger Service to record and fetch transactions

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

function getStrapiServiceHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
  };
}

export type TransactionCategory =
  | "TRADING"
  | "QUESTS"
  | "REWARDS"
  | "FEES"
  | "MAINTENANCE"
  | "PARTY"
  | "TRADE_P2P"
  | "OTHER";

export interface TransactionDTO {
  id: string;
  amount: number;
  category: TransactionCategory;
  description: string;
  createdAt: string;
}

export async function logTransaction(
  profileDocId: string,
  amount: number,
  category: TransactionCategory,
  description: string
): Promise<boolean> {
  const headers = getStrapiServiceHeaders();
  
  try {
    const res = await fetch(`${STRAPI_BASE_URL}/api/transactions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          playerProfile: profileDocId,
          amount,
          category,
          description,
        },
      }),
    });
    
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[ledger] Failed to log transaction: ${res.status} ${txt}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[ledger] Failed to log transaction:", error);
    return false;
  }
}

export async function getPlayerWalletSummary(username: string) {
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
  const totalBalance = Number(profile.wallet ?? 0);
  
  // 3. Fetch all transactions for this player
  const transUrl = new URL(`${STRAPI_BASE_URL}/api/transactions`);
  transUrl.searchParams.set("filters[playerProfile][documentId][$eq]", profileDocId);
  transUrl.searchParams.set("sort", "createdAt:desc");
  transUrl.searchParams.set("pagination[limit]", "150");
  const transRes = await fetch(transUrl, { headers, cache: "no-store" });
  const transJson = await transRes.json();
  const rawTrans: any[] = transJson.data ?? [];
  
  let income = 0;
  let expenses = 0;
  
  const categorySums: Record<string, number> = {
    trading: 0,
    quests: 0,
    rewards: 0,
    fees: 0,
    other: 0,
  };
  
  const recentTransactions: TransactionDTO[] = [];
  
  for (const raw of rawTrans) {
    const amount = Number(raw.amount ?? 0);
    const cat = String(raw.category ?? "OTHER").toUpperCase();
    const desc = String(raw.description ?? "N/A");
    
    // Aggregation of total Income vs Expenses
    if (amount > 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
    
    // Categorize for UI Category Breakdown
    // Map API ENUM Category to UI Category key
    let uiCategoryKey = "other";
    if (cat === "TRADING" || cat === "TRADE_P2P") {
      uiCategoryKey = "trading";
    } else if (cat === "QUESTS") {
      uiCategoryKey = "quests";
    } else if (cat === "REWARDS") {
      uiCategoryKey = "rewards";
    } else if (cat === "FEES") {
      uiCategoryKey = "fees";
    } else {
      uiCategoryKey = "other";
    }
    
    categorySums[uiCategoryKey] += Math.abs(amount);
    
    if (recentTransactions.length < 5) {
      recentTransactions.push({
        id: raw.documentId ?? String(raw.id),
        amount,
        category: raw.category,
        description: desc,
        createdAt: raw.createdAt ?? new Date().toISOString(),
      });
    }
  }
  
  const categoriesList = [
    { key: "trading", label: "Trading", amount: categorySums.trading, enabled: true },
    { key: "quests", label: "Quests", amount: categorySums.quests, enabled: true },
    { key: "rewards", label: "Rewards", amount: categorySums.rewards, enabled: true },
    { key: "fees", label: "Fees", amount: categorySums.fees, enabled: true },
    { key: "other", label: "Other & Maintenance", amount: categorySums.other, enabled: true },
  ];
  
  return {
    totalBalance,
    income,
    expenses,
    currencyCode: "USD",
    categories: categoriesList,
    recentTransactions,
  };
}
