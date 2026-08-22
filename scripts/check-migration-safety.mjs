import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";

const MIGRATIONS_DIRECTORY_URL = new URL("../migrations/", import.meta.url);
const BASELINE_URL = new URL(
  "../migrations/meta/safety-baseline.json",
  import.meta.url,
);
const SQL_FILE_SUFFIX = ".sql";
const FOREIGN_KEYS_DISABLED_PATTERN = /PRAGMA\s+foreign_keys\s*=\s*OFF/i;
const DROP_TABLE_PATTERN =
  /DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([`"[]?[\w.-]+[`"\]]?)/gi;
const TABLE_IDENTIFIER_WRAPPERS_PATTERN = /^[`"[]|[`"\]]$/g;
const DROP_TABLE_APPROVAL_PREFIX = "migration-safety: allow-table-drop";
const ACCEPT_NEW_ARGUMENT = "--accept-new";

const hashSql = (sql) => createHash("sha256").update(sql).digest("hex");

const normalizeTableName = (identifier) =>
  identifier.replace(TABLE_IDENTIFIER_WRAPPERS_PATTERN, "");

const hasDropApproval = (sql, tableName) => {
  const approval = `${DROP_TABLE_APPROVAL_PREFIX} ${tableName}`.toLowerCase();

  return sql
    .split(/\r?\n/u)
    .some((line) => line.trim().toLowerCase() === `-- ${approval}`);
};

const findUnsafeStatements = (sql) => {
  const errors = [];

  if (FOREIGN_KEYS_DISABLED_PATTERN.test(sql)) {
    errors.push(
      "PRAGMA foreign_keys=OFF is unsafe in D1 migrations; explicitly preserve dependent rows instead.",
    );
  }

  for (const match of sql.matchAll(DROP_TABLE_PATTERN)) {
    const tableName = normalizeTableName(match[1]);

    if (!hasDropApproval(sql, tableName)) {
      errors.push(
        `DROP TABLE ${tableName} requires an explicit manual review marker: -- ${DROP_TABLE_APPROVAL_PREFIX} ${tableName}`,
      );
    }
  }

  return errors;
};

const main = async () => {
  const baseline = JSON.parse(await readFile(BASELINE_URL, "utf8"));
  const migrationNames = (await readdir(MIGRATIONS_DIRECTORY_URL))
    .filter((name) => name.endsWith(SQL_FILE_SUFFIX))
    .sort();
  const errors = [];

  for (const [name, expectedHash] of Object.entries(baseline.files)) {
    if (!migrationNames.includes(name)) {
      errors.push(`${name}: an applied migration must not be removed.`);
      continue;
    }

    const sql = await readFile(new URL(name, MIGRATIONS_DIRECTORY_URL), "utf8");
    const actualHash = hashSql(sql);

    if (actualHash !== expectedHash) {
      errors.push(`${name}: an applied migration was modified.`);
    }
  }

  const registeredNames = new Set(Object.keys(baseline.files));
  const unregisteredMigrations = [];

  for (const name of migrationNames) {
    if (registeredNames.has(name)) {
      continue;
    }

    const sql = await readFile(new URL(name, MIGRATIONS_DIRECTORY_URL), "utf8");
    unregisteredMigrations.push({ name, hash: hashSql(sql) });

    for (const error of findUnsafeStatements(sql)) {
      errors.push(`${name}: ${error}`);
    }
  }

  const shouldAcceptNew = process.argv.includes(ACCEPT_NEW_ARGUMENT);

  if (unregisteredMigrations.length > 0 && !shouldAcceptNew) {
    errors.push(
      `Unregistered migrations found (${unregisteredMigrations.map(({ name }) => name).join(", ")}). Review them, then run npm run db:migration:accept.`,
    );
  }

  if (errors.length > 0) {
    console.error("Migration safety check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  if (shouldAcceptNew && unregisteredMigrations.length > 0) {
    const files = { ...baseline.files };

    for (const { name, hash } of unregisteredMigrations) {
      files[name] = hash;
    }

    const updatedBaseline = {
      ...baseline,
      files: Object.fromEntries(
        Object.entries(files).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    };

    await writeFile(
      BASELINE_URL,
      `${JSON.stringify(updatedBaseline, null, 2)}\n`,
      "utf8",
    );
    console.log(
      `Registered ${unregisteredMigrations.length} reviewed migration(s).`,
    );
  }

  console.log(
    `Migration safety check passed (${migrationNames.length} immutable migration files).`,
  );
};

await main();
