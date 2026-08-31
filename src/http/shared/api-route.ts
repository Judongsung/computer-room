export function createExactApiRoutePattern(
  basePath: string,
  ...segments: readonly string[]
): RegExp {
  return new RegExp(`^${[basePath, ...segments].join("/")}$`);
}

export function matchesApiPathNamespace(
  pathname: string,
  namespace: string,
): boolean {
  return pathname === namespace || pathname.startsWith(`${namespace}/`);
}

export function readApiRouteSegment(
  match: RegExpExecArray,
  captureIndex = 1,
): string {
  return decodeURIComponent(match[captureIndex] ?? "");
}
