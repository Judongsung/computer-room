import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import config from "../../eslint.config.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: true, overrideConfig: config });
async function diagnostics(code, file = "src/domain/shared/probe.ts") {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
  return result.messages;
}

describe("configured dependency boundaries", () => {
  it.each([
    'import { x } from "@/domain/shared/x";',
    'import type { X } from "@/types/widgets/widget";',
    'export { x } from "../../constants/widgets/widget";',
    '// import x from "react";\nconst text = "require(react)";',
  ])("allows shared pure dependencies and ignores text: %s", async (code) => {
    expect(await diagnostics(code)).toEqual([]);
  });

  it.each([
    ['import x from "react";', "runtime"],
    ['import type { X } from "@/infrastructure/x";', "type"],
    ['import { type X } from "@client/types/widgets/dashboard";', "type"],
    ['export * from "../../http/shared/responses";', "runtime"],
    ['export type { X } from "@/application/widgets/x";', "type"],
    ['const x = import("@/infrastructure/x");', "runtime"],
    ['const x = require("node:fs");', "runtime"],
    ['type X = import("@/infrastructure/x").X;', "type"],
    ['import X = require("@/infrastructure/x");', "runtime"],
    ['import type { Env } from "@/types/platform/generated/worker-configuration";', "type"],
    ['const x = import(moduleName);', "runtime"],
    ['const x = require(moduleName);', "runtime"],
  ])("rejects forbidden dependencies: %s", async (code, kind) => {
    const messages = await diagnostics(code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ruleId: "architecture/dependency-boundary", severity: 2 });
    expect(messages[0].message).toContain(`${kind} dependency`);
  });

  it("allows application orchestration and composition root infrastructure imports", async () => {
    expect(await diagnostics('import x from "@/application/widgets/x";', "src/application/widgets/probe.ts")).toEqual([]);
    expect(await diagnostics('import x from "@/infrastructure/x";', "src/index.ts")).toEqual([]);
    expect(await diagnostics('import x from "@/http/x";', "src/application/widgets/probe.ts"))
      .toEqual([expect.objectContaining({ ruleId: "architecture/dependency-boundary" })]);
  });
});

describe("configured React hook rules", () => {
  it("parses TypeScript and JSX and accepts complete dependencies", async () => {
    expect(await diagnostics(`
      import { useEffect } from "react";
      export function Probe({ value }: { value: string }) {
        useEffect(() => { document.title = value; }, [value]);
        return <span>{value}</span>;
      }
    `, "src/client/components/probe.tsx")).toEqual([]);
  });

  it.each([
    ['if (value) useEffect(() => {}, []);', "react-hooks/rules-of-hooks"],
    ['useEffect(() => { document.title = value; }, []);', "react-hooks/exhaustive-deps"],
  ])("detects hook violations: %s", async (body, ruleId) => {
    expect(await diagnostics(`
      import { useEffect } from "react";
      export function Probe({ value }: { value: string }) { ${body} return <span />; }
    `, "src/client/components/probe.tsx"))
      .toEqual([expect.objectContaining({ ruleId, severity: 2 })]);
  });
});
