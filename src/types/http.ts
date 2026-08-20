export interface FeatureApiHandler {
  handle(request: Request, url: URL): Promise<Response | null>;
}
