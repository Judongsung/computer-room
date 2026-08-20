import type { FilePolicy } from "./file";

export interface Identity {
  email: string;
}

export interface SessionInfo extends Identity {
  logoutUrl: string;
  filePolicy: FilePolicy;
}

export interface IdentityVerifier {
  verify(request: Request): Promise<Identity>;
}

export interface AccessVerifierConfig {
  teamDomain: string | undefined;
  audience: string | undefined;
  ownerEmail: string | undefined;
}

export interface ValidatedAccessConfig {
  issuer: string;
  audience: string;
  ownerEmail: string;
}

export interface AccessTokenClaims {
  email?: unknown;
}

export interface AccessTokenVerifier {
  verify(
    token: string,
    issuer: string,
    audience: string,
  ): Promise<AccessTokenClaims>;
}
