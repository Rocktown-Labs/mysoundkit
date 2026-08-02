import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "apps/website/src");
const ignoredFiles = new Set([path.join(sourceDir, "routeTree.gen.ts")]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const reactHooks = new Set([
  "useActionState",
  "useCallback",
  "useContext",
  "useDebugValue",
  "useDeferredValue",
  "useEffect",
  "useEffectEvent",
  "useId",
  "useImperativeHandle",
  "useInsertionEffect",
  "useLayoutEffect",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition",
]);

const formatLocation = (sourceFile, node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const relativePath = path.relative(rootDir, sourceFile.fileName);

  return `${relativePath}:${position.line + 1}:${position.character + 1}`;
};

const collectFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
};

const getReactNamedImports = (sourceFile) => {
  const imports = new Set();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "react"
    ) {
      continue;
    }

    const namedBindings = statement.importClause?.namedBindings;

    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const specifier of namedBindings.elements) {
      imports.add(specifier.propertyName?.text ?? specifier.name.text);
    }
  }

  return imports;
};

const checkFile = async (filePath) => {
  const source = await readFile(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const reactNamedImports = getReactNamedImports(sourceFile);
  const missingImports = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      reactHooks.has(node.expression.text) &&
      !reactNamedImports.has(node.expression.text)
    ) {
      missingImports.push({
        hook: node.expression.text,
        location: formatLocation(sourceFile, node.expression),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return missingImports;
};

const main = async () => {
  try {
    await access(sourceDir);
  } catch {
    throw new Error(`Website source directory not found: ${sourceDir}`);
  }

  const checkedFiles = await collectFiles(sourceDir);
  const fileResults = await Promise.all(
    checkedFiles
      .filter((filePath) => !ignoredFiles.has(filePath))
      .map(checkFile)
  );
  const failures = fileResults.flat();

  if (failures.length > 0) {
    console.error("React hook import check failed:");

    for (const failure of failures) {
      console.error(
        `- ${failure.location} calls ${failure.hook} without importing it from react`
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log("React hook import check passed.");
};

void main();
