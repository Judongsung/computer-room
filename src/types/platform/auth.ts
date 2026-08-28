import type { FilePolicy } from "@/types/filesystem/file";

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

export interface RequestVerifier {
  verify(request: Request): Promise<void>;
}

export interface AccessApplicationVerifierConfig {
  teamDomain: string | undefined;
  audience: string | readonly string[] | undefined;
}

export interface AccessVerifierConfig extends AccessApplicationVerifierConfig {
  ownerEmail: string | undefined;
}

export interface ValidatedAccessApplicationConfig {
  issuer: string;
  audience: string | string[];
}

export interface ValidatedAccessConfig
  extends ValidatedAccessApplicationConfig {
  ownerEmail: string;
}

export interface AccessTokenClaims {
  email?: unknown;
}

export interface AccessTokenVerifier {
  verify(
    token: string,
    issuer: string,
    audience: string | string[],
  ): Promise<AccessTokenClaims>;
}
