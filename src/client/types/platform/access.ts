import type { SessionInfo } from "@/types/platform/auth";
import type { GuestSessionInfo } from "@/types/guest/guest";
import type {
  ACCESS_BOOTSTRAP_STATUS,
  CLIENT_ACCESS_MODE,
} from "@client/constants/platform/access";

export type ClientAccessMode =
  (typeof CLIENT_ACCESS_MODE)[keyof typeof CLIENT_ACCESS_MODE];

export type AccessBootstrapState =
  | { readonly status: typeof ACCESS_BOOTSTRAP_STATUS.LOADING }
  | {
      readonly status: typeof ACCESS_BOOTSTRAP_STATUS.OWNER;
      readonly session: SessionInfo | null;
    }
  | {
      readonly status: typeof ACCESS_BOOTSTRAP_STATUS.GUEST;
      readonly session: GuestSessionInfo;
    }
  | {
      readonly status: typeof ACCESS_BOOTSTRAP_STATUS.ERROR;
      readonly message: string;
    };

export interface GuestSessionGateway {
  getSession(): Promise<GuestSessionInfo>;
}
