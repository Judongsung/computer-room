export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
export const ACCESS_CERTS_PATH = "/cdn-cgi/access/certs";
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";
export const ACCESS_LOGIN_PATH = "/auth/login";
export const ACCESS_MODE_QUERY_PARAMETER = "access";
export const ACCESS_MODE_OWNER_VALUE = "owner";

export const RUNTIME_ENVIRONMENT = {
  DEVELOPMENT: "development",
  TEST: "test",
} as const;

export const ENABLED_ENV_VALUE = "true";
export const LOCAL_AUTH_DEFAULT_EMAIL = "local@example.com";

export const LOCAL_AUTH_HOSTNAME = {
  LOCALHOST: "localhost",
  LOOPBACK: "127.0.0.1",
} as const;
