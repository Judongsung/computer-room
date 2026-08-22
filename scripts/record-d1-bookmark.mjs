import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DATABASE_NAME = "computer-room-db";
const WRANGLER_ENTRY_URL = new URL(
  "../node_modules/wrangler/bin/wrangler.js",
  import.meta.url,
);
const BOOKMARK_DIRECTORY_URL = new URL(
  "../.wrangler/deploy-bookmarks/",
  import.meta.url,
);
const WRANGLER_ARGUMENTS = [
  fileURLToPath(WRANGLER_ENTRY_URL),
  "d1",
  "time-travel",
  "info",
  DATABASE_NAME,
  "--json",
];

const parseWranglerJson = (output) => {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Wrangler did not return a JSON object.");
  }

  return JSON.parse(output.slice(start, end + 1));
};

const toSafeTimestamp = (timestamp) => timestamp.replace(/[:.]/gu, "-");

const main = async () => {
  const result = spawnSync(process.execPath, WRANGLER_ARGUMENTS, {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`Wrangler exited with status ${result.status}.`);
  }

  const response = parseWranglerJson(result.stdout);

  if (typeof response.bookmark !== "string" || response.bookmark.length === 0) {
    throw new Error("Wrangler returned no D1 Time Travel bookmark.");
  }

  const createdAt = new Date().toISOString();
  const bookmarkFileUrl = new URL(
    `${toSafeTimestamp(createdAt)}.json`,
    BOOKMARK_DIRECTORY_URL,
  );
  const record = {
    database: DATABASE_NAME,
    createdAt,
    bookmark: response.bookmark,
  };

  await mkdir(BOOKMARK_DIRECTORY_URL, { recursive: true });
  await writeFile(bookmarkFileUrl, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });

  console.log(
    `Recorded D1 recovery bookmark at ${fileURLToPath(bookmarkFileUrl)}.`,
  );
};

await main();
