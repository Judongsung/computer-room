export const CLIENT_ACCESS_MODE = {
  OWNER: "owner",
  GUEST: "guest",
} as const;

export const ACCESS_BOOTSTRAP_STATUS = {
  LOADING: "loading",
  OWNER: "owner",
  GUEST: "guest",
  ERROR: "error",
} as const;

export const OWNER_ACCESS_STORAGE_KEY = "computer-room.access-mode";
