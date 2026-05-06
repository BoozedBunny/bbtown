export type CentralManagementTab = "treasury" | "market" | "news";

export type CentralManagementIntentSource = "ticker" | "bank" | "query" | "manual" | "news";

export type CentralManagementIntent = {
  tab: CentralManagementTab;
  symbol?: string | null;
  source: CentralManagementIntentSource;
};
