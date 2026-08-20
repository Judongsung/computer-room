import { describe, expect, it } from "vitest";
import { API_PATHS } from "../src/constants/api";
import { ACCESS_JWT_HEADER } from "../src/constants/auth";
import { AUTH_ERRORS } from "../src/constants/errors/auth";
import {
  CloudflareAccessIdentityVerifier,
  LocalIdentityVerifier,
} from "../src/infrastructure/access-identity-verifier";
import type { AccessTokenVerifier } from "../src/types/auth";

class StaticTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly email: unknown) {}

  async verify(): Promise<{ email?: unknown }> {
    return { email: this.email };
  }
}

const config = {
  teamDomain: "https://computer-room.cloudflareaccess.com",
  audience: "audience",
  ownerEmail: "owner@example.com",
};

const APPLICATION_ORIGIN = "https://computer-room.example";
const NON_LOCAL_ORIGIN = "https://computer-room.workers.dev";

describe("CloudflareAccessIdentityVerifier", () => {
  it("accepts a verified owner email case-insensitively", async () => {
    const verifier = new CloudflareAccessIdentityVerifier(
      config,
      new StaticTokenVerifier("Owner@Example.com"),
    );
    const request = new Request(`${APPLICATION_ORIGIN}${API_PATHS.SESSION}`, {
      headers: { [ACCESS_JWT_HEADER]: "signed-token" },
    });

    await expect(verifier.verify(request)).resolves.toEqual({ email: "owner@example.com" });
  });

  it("rejects a different verified account", async () => {
    const verifier = new CloudflareAccessIdentityVerifier(
      config,
      new StaticTokenVerifier("other@example.com"),
    );
    const request = new Request(`${APPLICATION_ORIGIN}${API_PATHS.SESSION}`, {
      headers: { [ACCESS_JWT_HEADER]: "signed-token" },
    });

    await expect(verifier.verify(request)).rejects.toMatchObject({
      status: AUTH_ERRORS.OWNER_ONLY.status,
      code: AUTH_ERRORS.OWNER_ONLY.code,
    });
  });

  it("fails closed when configuration or token is missing", async () => {
    const missingConfig = new CloudflareAccessIdentityVerifier(
      { teamDomain: undefined, audience: undefined, ownerEmail: undefined },
      new StaticTokenVerifier("owner@example.com"),
    );
    const configured = new CloudflareAccessIdentityVerifier(
      config,
      new StaticTokenVerifier("owner@example.com"),
    );

    await expect(
      missingConfig.verify(new Request(`${APPLICATION_ORIGIN}${API_PATHS.SESSION}`)),
    ).rejects.toMatchObject({
      status: AUTH_ERRORS.AUTH_CONFIGURATION_ERROR.status,
      code: AUTH_ERRORS.AUTH_CONFIGURATION_ERROR.code,
    });
    await expect(
      configured.verify(new Request(`${APPLICATION_ORIGIN}${API_PATHS.SESSION}`)),
    ).rejects.toMatchObject({
      status: AUTH_ERRORS.AUTHENTICATION_REQUIRED.status,
      code: AUTH_ERRORS.AUTHENTICATION_REQUIRED.code,
    });
  });
});

describe("LocalIdentityVerifier", () => {
  it("allows localhost and rejects non-local hosts", async () => {
    const verifier = new LocalIdentityVerifier("local@example.com");

    await expect(
      verifier.verify(new Request(`http://localhost${API_PATHS.SESSION}`)),
    ).resolves.toEqual({ email: "local@example.com" });
    await expect(
      verifier.verify(new Request(`${NON_LOCAL_ORIGIN}${API_PATHS.SESSION}`)),
    ).rejects.toMatchObject({
      status: AUTH_ERRORS.LOCAL_AUTH_ONLY.status,
      code: AUTH_ERRORS.LOCAL_AUTH_ONLY.code,
    });
  });
});
