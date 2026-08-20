import type { SessionInfo } from "../../types/auth";
import { SITE_COPY } from "../constants/content";

interface SiteHeaderProps {
  readonly session: SessionInfo;
}

export function SiteHeader({ session }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div>
        <h1>{SITE_COPY.TITLE}</h1>
        <p>{SITE_COPY.TAGLINE}</p>
      </div>
      <div className="session">
        <span>{session.email}</span>
        <a href={session.logoutUrl}>{SITE_COPY.LOGOUT}</a>
      </div>
    </header>
  );
}
