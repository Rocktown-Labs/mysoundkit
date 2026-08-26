/* eslint-disable node/no-sync, sort-vars */
import { existsSync } from "node:fs";
import path from "node:path";

import { CANONICAL_ROUTES, NATIVE_TAB_ROUTES } from "../lib/route-manifest";
import type { CanonicalRoute } from "../lib/route-manifest";

const expectedTabs: ReadonlySet<string> = new Set([
    "dashboard",
    "explore",
    "library",
    "live",
  ]),
  actualTabs: ReadonlySet<string> = new Set(
    NATIVE_TAB_ROUTES.map((route) => route.id)
  ),
  canonicalRoutes: readonly CanonicalRoute[] = CANONICAL_ROUTES,
  scriptDirectory = import.meta.dirname,
  duplicateValues = (values: readonly string[]) =>
    values.filter((value, index) => values.indexOf(value) !== index),
  errors: string[] = [];

for (const expectedTab of expectedTabs) {
  if (!actualTabs.has(expectedTab)) {
    errors.push(`Missing native tab: ${expectedTab}`);
  }
}

for (const route of NATIVE_TAB_ROUTES) {
  if (!existsSync(path.resolve(scriptDirectory, "..", route.expoFile))) {
    errors.push(`Missing Expo route file for ${route.id}: ${route.expoFile}`);
  }
}

for (const duplicateId of duplicateValues(
  canonicalRoutes.map(({ id }) => id)
)) {
  errors.push(`Duplicate canonical route id: ${duplicateId}`);
}

for (const duplicatePath of duplicateValues(
  canonicalRoutes.map(({ webPath }) => webPath)
)) {
  errors.push(`Duplicate canonical web path: ${duplicatePath}`);
}

for (const route of canonicalRoutes) {
  if (route.status === "web-only" && route.nativeHref !== null) {
    errors.push(`Web-only route ${route.id} must not define a native href.`);
  }
  if (route.status !== "web-only" && route.nativeHref === null) {
    errors.push(`Native route ${route.id} must define a native href.`);
  }
  if (route.status === "web-only" && route.owner !== "web") {
    errors.push(`Web-only route ${route.id} must be owned by web.`);
  }
}

if (errors.length > 0) {
  throw new Error(
    `Native route manifest is invalid:\n- ${errors.join("\n- ")}`
  );
}

process.stdout.write(
  `Validated ${canonicalRoutes.length} canonical routes and ${NATIVE_TAB_ROUTES.length} native tabs.\n`
);
