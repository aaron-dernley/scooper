// verify_structure.ts

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { basename } from "https://deno.land/std@0.224.0/path/mod.ts";

interface ResourceSchema {
  properties?: {
    type?: {
      enum?: string[];
    };
  };
}

const INDIVIDUAL_SPECS_DIR = "./arm-schemas/individual-specs";
const OUTPUT_FILE = "./arm-schemas/resource-structure-report.json";

async function verifyStructure() {
  const report: {
    file: string;
    resourceType: string;
    isChild: boolean;
    parentType?: string;
  }[] = [];

  for await (const entry of walk(INDIVIDUAL_SPECS_DIR, { exts: [".json"], includeDirs: false })) {
    const fileText = await Deno.readTextFile(entry.path);
    const json = JSON.parse(fileText) as ResourceSchema;
    const resourceFile = basename(entry.path);

    const typeEnum = json.properties?.type?.enum?.[0] ?? "";
    const isChild = typeEnum.split("/").length > 2;
    const parentType = isChild ? typeEnum.split("/").slice(0, -1).join("/") : undefined;

    report.push({
      file: resourceFile,
      resourceType: typeEnum,
      isChild,
      parentType,
    });
  }

  await Deno.writeTextFile(
    OUTPUT_FILE,
    JSON.stringify(report, null, 2)
  );

  console.log(`Wrote resource structure report for ${report.length} resources to ${OUTPUT_FILE}`);
}

await verifyStructure();
