import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const strict = process.argv.includes("--strict");

function loadTypescriptModule(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    return nativeRequire(id);
  };
  const factory = new Function("exports", "require", "module", "__filename", "__dirname", output);
  factory(module.exports, customRequire, module, filename, path.dirname(filename));
  return module.exports;
}

const recipeParser = loadTypescriptModule("lib/recipePasteParser.ts");
const ingredientParser = loadTypescriptModule("lib/ingredientParser.ts", {
  "@/lib/recipeModel": {
    createEntityId: () => "fixture-id",
  },
});

const recipeFixtures = JSON.parse(
  fs.readFileSync(path.join(root, "tests/parser/recipe-fixtures.json"), "utf8"),
);
const ingredientFixtures = JSON.parse(
  fs.readFileSync(path.join(root, "tests/parser/ingredient-fixtures.json"), "utf8"),
);

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compare(expected, actual) {
  return Object.entries(expected)
    .filter(([field, expectedValue]) => !same(expectedValue, actual[field]))
    .map(([field, expectedValue]) => ({ field, expected: expectedValue, actual: actual[field] }));
}

const recipeResults = recipeFixtures.map((fixture) => {
  const parsed = recipeParser.parseRecipe(fixture.raw, fixture.context ?? {});
  const actual = { ...parsed, methodBodies: parsed.method.map((step) => step.body) };
  const diffs = compare(fixture.expected, actual);
  return { id: fixture.id, name: fixture.name, passed: diffs.length === 0, diffs };
});

const ingredientResults = ingredientFixtures.map((fixture) => {
  const parsed = ingredientParser.parseIngredientLine(fixture.input);
  const actual = {
    quantityMin: parsed.quantity.min,
    quantityMax: parsed.quantity.max,
    unit: parsed.unit,
    canonicalIngredient: parsed.canonicalIngredient,
    preparationNote: parsed.preparationNote,
  };
  const diffs = compare(fixture.expected, actual);
  return { id: fixture.id, name: fixture.input, passed: diffs.length === 0, diffs };
});

const all = [...recipeResults, ...ingredientResults];
const passing = all.filter((result) => result.passed).length;
const failing = all.length - passing;

console.log("\nRecipe Library Parser v2 regression suite\n");
console.log(`Full recipes: ${recipeResults.filter((result) => result.passed).length}/${recipeResults.length}`);
console.log(`Ingredient lines: ${ingredientResults.filter((result) => result.passed).length}/${ingredientResults.length}`);
console.log(`Overall: ${passing}/${all.length} passing; ${failing} need work\n`);

for (const group of [
  ["FULL RECIPES", recipeResults],
  ["INGREDIENT LINES", ingredientResults],
]) {
  console.log(group[0]);
  for (const result of group[1]) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.id} — ${result.name}`);
    if (!result.passed) {
      for (const diff of result.diffs) {
        console.log(`      ${diff.field}: expected ${JSON.stringify(diff.expected)}; got ${JSON.stringify(diff.actual)}`);
      }
    }
  }
  console.log("");
}

if (strict && failing > 0) process.exitCode = 1;
