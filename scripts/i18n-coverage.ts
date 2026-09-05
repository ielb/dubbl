import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

interface ModuleDefinition {
  name: string;
  namespace: string;
  directory: string;
}

const root = process.cwd();
const dashboardRoot = path.join(root, "app", "(dashboard)");
const modules: ModuleDefinition[] = [
  { name: "Sales", namespace: "Sales", directory: "sales" },
  { name: "Purchases", namespace: "Purchases", directory: "purchases" },
  { name: "Accounting", namespace: "Accounting", directory: "accounting" },
  { name: "Payroll", namespace: "Payroll", directory: "payroll" },
  { name: "Inventory", namespace: "Inventory", directory: "inventory" },
  { name: "Reports", namespace: "Reports", directory: "reports" },
  { name: "CRM", namespace: "CRM", directory: "crm" },
  { name: "Projects", namespace: "Projects", directory: "projects" },
  { name: "Documents", namespace: "Documents", directory: "documents" },
  { name: "Tax", namespace: "Tax", directory: "tax" },
];

function findPageFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findPageFiles(entryPath));
    if (entry.isFile() && entry.name === "page.tsx") files.push(entryPath);
  }
  return files;
}

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

const english = JSON.parse(readFileSync(path.join(root, "messages", "en.json"), "utf8"));
const french = JSON.parse(readFileSync(path.join(root, "messages", "fr.json"), "utf8"));

console.log("# French UI coverage");
console.log("");
console.log("| Module | Localized screens | Total screens | Coverage | EN keys | FR keys | Catalog parity |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | --- |");

let localizedTotal = 0;
let screenTotal = 0;
let hasCatalogMismatch = false;

for (const moduleDefinition of modules) {
  const pages = findPageFiles(path.join(dashboardRoot, moduleDefinition.directory));
  const localized = pages.filter((file) => {
    const source = readFileSync(file, "utf8");
    return source.includes("useTranslations(") || source.includes("getTranslations(");
  });
  const englishKeys = new Set(flattenKeys(english[moduleDefinition.namespace]));
  const frenchKeys = new Set(flattenKeys(french[moduleDefinition.namespace]));
  const missingFrench = [...englishKeys].filter((key) => !frenchKeys.has(key));
  const missingEnglish = [...frenchKeys].filter((key) => !englishKeys.has(key));
  const parity = missingFrench.length === 0 && missingEnglish.length === 0;

  localizedTotal += localized.length;
  screenTotal += pages.length;
  hasCatalogMismatch ||= !parity;

  const percentage = pages.length === 0 ? 100 : Math.round((localized.length / pages.length) * 100);
  console.log(
    `| ${moduleDefinition.name} | ${localized.length} | ${pages.length} | ${percentage}% | ${englishKeys.size} | ${frenchKeys.size} | ${parity ? "yes" : "no"} |`
  );

  if (!parity) {
    if (missingFrench.length > 0) {
      console.error(`${moduleDefinition.name}: missing French keys: ${missingFrench.join(", ")}`);
    }
    if (missingEnglish.length > 0) {
      console.error(`${moduleDefinition.name}: missing English keys: ${missingEnglish.join(", ")}`);
    }
  }
}

const overallPercentage = screenTotal === 0 ? 100 : Math.round((localizedTotal / screenTotal) * 100);
console.log("");
console.log(`Overall localized screens: ${localizedTotal}/${screenTotal} (${overallPercentage}%)`);
console.log("Catalog parity compares leaf message keys in the English and French module namespaces.");

if (hasCatalogMismatch) process.exitCode = 1;
