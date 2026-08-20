import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ACCESS_CERTS_PATH,
  ACCESS_JWT_HEADER,
  LOCAL_AUTH_HOSTNAME,
} from "../constants/auth";
import { AUTH_ERRORS } from "../constants/errors/auth";
import { AppError } from "../domain/errors";
import type {
  AccessTokenClaims,
  AccessTokenVerifier,
  AccessVerifierConfig,
  Identity,
  IdentityVerifier,
  ValidatedAccessConfig,
} from "../types/auth";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class JoseAccessTokenVerifier implements AccessTokenVerifier {
  async verify(token: string, issuer: string, audience: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, getJwks(issuer), {
      issuer,
      audience,
    });
    return { email: payload.email };
  }
}

export class CloudflareAccessIdentityVerifier implements IdentityVerifier {
  constructor(
    private readonly config: AccessVerifierConfig,
    private readonly tokens: AccessTokenVerifier = new JoseAccessTokenVerifier(),
  ) {}

  async verify(request: Request): Promise<Identity> {
    const { issuer, audience, ownerEmail } = this.validatedConfig();
    const token = request.headers.get(ACCESS_JWT_HEADER);

    if (!token) {
      throw new AppError(AUTH_ERRORS.AUTHENTICATION_REQUIRED);
    }

    try {
      const claims = await this.tokens.verify(token, issuer, audience);
      const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";

      if (!email) {
        throw new AppError(AUTH_ERRORS.EMAIL_CLAIM_REQUIRED);
      }

      if (email !== ownerEmail) {
        throw new AppError(AUTH_ERRORS.OWNER_ONLY);
      }

      return { email };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AUTH_ERRORS.INVALID_ACCESS_TOKEN);
    }
  }

  private validatedConfig(): ValidatedAccessConfig {
    const { teamDomain, audience, ownerEmail } = this.config;

    if (!teamDomain || !audience || !ownerEmail) {
      throw configurationError();
    }

    let issuer: URL;
    try {
      issuer = new URL(teamDomain);
    } catch {
      throw configurationError();
    }

    if (issuer.protocol !== "https:" || issuer.pathname !== "/") {
      throw configurationError();
    }

    return {
      issuer: issuer.origin,
      audience,
      ownerEmail: ownerEmail.trim().toLowerCase(),
    };
  }
}

export class LocalIdentityVerifier implements IdentityVerifier {
  constructor(private readonly email: string) {}

  async verify(request: Request): Promise<Identity> {
    const hostname = new URL(request.url).hostname;
    if (
      hostname !== LOCAL_AUTH_HOSTNAME.LOCALHOST &&
      hostname !== LOCAL_AUTH_HOSTNAME.LOOPBACK
    ) {
      throw new AppError(AUTH_ERRORS.LOCAL_AUTH_ONLY);
    }

    return { email: this.email.toLowerCase() };
  }
}

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksCache.get(issuer);
  if (existing) {
    return existing;
  }

  const created = createRemoteJWKSet(new URL(`${issuer}${ACCESS_CERTS_PATH}`));
  jwksCache.set(issuer, created);
  return created;
}

function configurationError(): AppError {
  return new AppError(AUTH_ERRORS.AUTH_CONFIGURATION_ERROR);
}
