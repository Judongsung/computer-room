import type { SessionInfo } from "../../types/auth";
import { SITE_COPY } from "../constants/content";

interface SiteHeaderProps {
  readonly session: SessionInfo;
}

export function SiteHeader({ session }: SiteHeaderProps) {
  return (
    <header className="site-header window">
      <div className="title-bar">
        <h1 className="title-bar-text">{SITE_COPY.TITLE}</h1>
      </div>
      <div className="site-header__body window-body">
        <p>{SITE_COPY.TAGLINE}</p>
        <div className="session">
          <span>{session.email}</span>
          <a href={session.logoutUrl}>{SITE_COPY.LOGOUT}</a>
        </div>
      </div>
    </header>
  );
}
