export type RecordRow = { input: string; expected: string; category: string };
export type Dataset = {
  id: string;
  title: string;
  description: string;
  category: string;
  language: string;
  publisher: string;
  price: string;
  durationDays: number;
  quota: number;
  version: string;
  terms: string;
  digest: string;
  records: RecordRow[];
  createdAt: string;
};
export type Permit = {
  id: string;
  datasetId: string;
  title: string;
  owner: string;
  expiresAt: string;
  quota: number;
  used: number;
  revoked: boolean;
  token: string;
  createdAt: string;
  txHash?: string;
  provisioningStatus?: "pending" | "ready";
};
export type Activity = {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
};
export type DemoState = {
  datasets: Dataset[];
  permits: Permit[];
  activity: Activity[];
};
