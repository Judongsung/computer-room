export const CLIENT_BUNDLE_POLICY = Object.freeze({
  OUTPUT_DIRECTORY: "dist/client",
  MANIFEST_PATH: "dist/client/.vite/manifest.json",
  ENTRY_SOURCE: "index.html",
  MAX_INTERFACE_BYTES: 500 * 1024,
  INTERFACE_SOURCES: Object.freeze({
    desktop:
      "src/client/components/desktop/application/desktop-application.tsx",
    mobile: "src/client/components/mobile/mobile-application.tsx",
  }),
});
