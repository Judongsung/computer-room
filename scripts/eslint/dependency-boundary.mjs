import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { compilerOptions: { paths } } = JSON.parse(
  readFileSync(new URL("../../tsconfig.base.json", import.meta.url), "utf8"),
);
const ALLOWED = {
  domain: new Set(["domain", "constants", "types"]),
  application: new Set(["application", "domain", "constants", "types"]),
};

function resolveTarget(source, filename) {
  if (source.startsWith(".")) return path.resolve(path.dirname(filename), source);
  for (const [alias, targets] of Object.entries(paths)) {
    const prefix = alias.replace(/\*$/, "");
    if (source.startsWith(prefix)) {
      return path.resolve(ROOT, targets[0].replace("*", source.slice(prefix.length)));
    }
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: { forbidden: "{{kind}} dependency '{{target}}' is not allowed in {{layer}}." },
  },
  create(context) {
    const filename = context.filename;
    const layer = path.relative(ROOT, filename).split(path.sep)[1];
    const allowed = ALLOWED[layer];
    if (!allowed) return {};
    function check(node, source, kind) {
      const target = typeof source?.value === "string" ? source.value : null;
      const resolved = target === null ? null : resolveTarget(target, filename);
      const relative = resolved && path.relative(path.join(ROOT, "src"), resolved).split(path.sep);
      if (relative && allowed.has(relative[0]) &&
          !(relative[0] === "types" && relative[1] === "platform" && relative[2] === "generated")) return;
      context.report({ node, messageId: "forbidden", data: {
        kind, target: target ?? "<computed module>", layer,
      } });
    }
    function declaration(node) {
      if (!node.source) return;
      const typeOnly = node.importKind === "type" || node.exportKind === "type" ||
        (node.specifiers?.length > 0 && node.specifiers.every(s => s.importKind === "type" || s.exportKind === "type"));
      check(node, node.source, typeOnly ? "type" : "runtime");
    }
    return {
      ImportDeclaration: declaration,
      ExportNamedDeclaration: declaration,
      ExportAllDeclaration: declaration,
      ImportExpression(node) { check(node, node.source, "runtime"); },
      CallExpression(node) {
        if (node.callee.type === "Import" ||
            (node.callee.type === "Identifier" && node.callee.name === "require")) {
          check(node, node.arguments[0], "runtime");
        }
      },
      TSImportType(node) { check(node, node.argument, "type"); },
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type === "TSExternalModuleReference") {
          check(node, node.moduleReference.expression, node.importKind === "type" ? "type" : "runtime");
        }
      },
    };
  },
};
