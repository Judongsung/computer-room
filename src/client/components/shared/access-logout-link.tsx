import type { MouseEvent, ReactNode } from "react";
import { useAccessLogout } from "@client/hooks/platform/use-access-logout";

interface AccessLogoutLinkProps {
  readonly logoutUrl: string;
  readonly className?: string;
  readonly title?: string;
  readonly children: ReactNode;
  readonly pendingChildren: ReactNode;
}

export function AccessLogoutLink({
  logoutUrl,
  className,
  title,
  children,
  pendingChildren,
}: AccessLogoutLinkProps) {
  const { isLoggingOut, logout } = useAccessLogout(logoutUrl);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    if (!isLoggingOut) void logout();
  };

  return (
    <a
      className={className}
      href={logoutUrl}
      title={title}
      aria-busy={isLoggingOut}
      aria-disabled={isLoggingOut}
      onClick={handleClick}
    >
      {isLoggingOut ? pendingChildren : children}
    </a>
  );
}
