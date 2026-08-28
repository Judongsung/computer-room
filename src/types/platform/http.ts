export interface FeatureApiHandler {
  handle(request: Request, url: URL): Promise<Response | null>;
}

export interface ServiceApiHandler extends FeatureApiHandler {
  matches(url: URL): boolean;
}
