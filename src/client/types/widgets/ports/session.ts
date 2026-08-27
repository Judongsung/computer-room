import type { SessionInfo } from "@/types/platform/auth";

export interface SessionGateway {
  getSession(): Promise<SessionInfo>;
}
