export type CentralManagementTab = "treasury" | "market" | "news" | "inventory" | "wholesale" | "p2p";

export type CentralManagementIntentSource = "ticker" | "bank" | "query" | "manual" | "news";

export type CentralManagementIntent = {
  tab: CentralManagementTab;
  symbol?: string | null;
  source: CentralManagementIntentSource;
};
