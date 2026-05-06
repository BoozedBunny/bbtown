export type CentralManagementTab = "treasury" | "market";

export type CentralManagementIntentSource = "ticker" | "bank" | "query" | "manual";

export type CentralManagementIntent = {
  tab: CentralManagementTab;
  symbol?: string | null;
  source: CentralManagementIntentSource;
};
