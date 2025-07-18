// scoop_arm_schemas.ts

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { basename, join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { emptyDir } from "https://deno.land/std@0.224.0/fs/empty_dir.ts";

interface SchemaFile {
  resourceDefinitions?: Record<string, unknown>;
}

interface VersionedResource {
  version: string;
  schema: unknown;
}

function parseVersion(version: string): number[] {
  return version.split("-").map(Number);
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function toAzureFilename(provider: string, resourceType: string): string {
  const providerParts = provider.split(".");
  const group = providerParts[1] ?? providerParts[0];
  const type = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  return `Azure::${group}::${type}.json`;
}

async function cloneSchemaRepo(tempDir: string) {
  console.log("Cloning Azure schema repo...");
  const cmd = new Deno.Command("git", {
    args: ["clone", "--depth=1", "https://github.com/Azure/azure-resource-manager-schemas.git", tempDir],
    stdout: "null",
    stderr: "inherit"
  });
  const { code } = await cmd.output();
  if (code !== 0) throw new Error("Git clone failed");
  console.log("Clone complete.");
}

async function scoopSchemasFrom(schemaDir: string) {
  const versionedMap: Record<string, VersionedResource[]> = {};
  const outputDir = "arm-schemas/individual-specs";
  const mergedOutput = "arm-schemas/all-arm-resource-specs.json";

  await Deno.mkdir(outputDir, { recursive: true });

  for await (const entry of walk(schemaDir, { exts: [".json"], includeDirs: false })) {
    const pathParts = entry.path.split("/");
    const apiVersion = pathParts[pathParts.length - 2];
    const provider = basename(entry.path, ".json");

    const schemaText = await Deno.readTextFile(entry.path);
    const schemaJson: SchemaFile = JSON.parse(schemaText);

    if (schemaJson.resourceDefinitions) {
      for (const [resType, resSchema] of Object.entries(schemaJson.resourceDefinitions)) {
        const key = `${provider}/${resType}`;
        versionedMap[key] ??= [];
        versionedMap[key].push({ version: apiVersion, schema: resSchema });
      }
    }
  }

  const latestOnly: Record<string, unknown> = {};

  for (const [key, versions] of Object.entries(versionedMap)) {
    versions.sort((a, b) => compareVersions(a.version, b.version));
    const { version, schema } = versions[0];
    latestOnly[`${key}@${version}`] = schema;

    const [provider, resType] = key.split("/");
    const outputName = toAzureFilename(provider, resType);
    const outputPath = join(outputDir, outputName);
    await Deno.writeTextFile(outputPath, JSON.stringify(schema, null, 2));
  }

  await Deno.writeTextFile(mergedOutput, JSON.stringify(latestOnly, null, 2));

  console.log(`Wrote ${Object.keys(latestOnly).length} individual latest-version specs.`);
  console.log(`Index file written to: ${mergedOutput}`);
}

async function main() {
  const tempClonePath = ".tmp-azure-schemas";
  const schemaSourcePath = join(tempClonePath, "schemas");

  if (await exists(tempClonePath)) {
    await Deno.remove(tempClonePath, { recursive: true });
  }

  if (await exists("arm-schemas")) {
    await emptyDir("arm-schemas");
  }

  await Deno.mkdir("arm-schemas", { recursive: true });

  await cloneSchemaRepo(tempClonePath);
  await scoopSchemasFrom(schemaSourcePath);
  await Deno.remove(tempClonePath, { recursive: true });

  console.log("Temporary clone removed.");
}

await main();
