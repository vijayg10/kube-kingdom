import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
// .env lives at the monorepo root, one level above this workspace.
dotenvConfig({ path: resolve(process.cwd(), '../.env') });

/**
 * Centralized environment configuration for the Kube Kingdom server.
 * Documented in the root `.env.example`.
 */
export interface AppConfig {
  /** true = synthetic demo cluster; false = connect to a real Kubernetes cluster. */
  mockMode: boolean;
  /** true = observe only (no mutations); false = enable restart/scale/delete actions. */
  readOnly: boolean;
  /** Path to kubeconfig (only used when mockMode=false and no inline config provided). */
  kubeconfigPath: string;
  /** Backend HTTP + WebSocket port. */
  port: number;
  /** WebSocket URL the frontend connects to (echoed back via GET /env). */
  wsUrl: string;
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export const config: AppConfig = {
  mockMode: boolEnv(process.env.MOCK_MODE, true),
  readOnly: boolEnv(process.env.READ_ONLY, true),
  kubeconfigPath: process.env.KUBECONFIG ?? '~/.kube/config',
  port: Number(process.env.PORT ?? 3001),
  wsUrl: process.env.VITE_WS_URL ?? 'ws://localhost:3001',
};
