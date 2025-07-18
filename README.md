## Usage

Install Deno

`curl -fsSL https://deno.land/install.sh | sh`

Run the scoop

This will:
	- Clone the Azure schema repo to a temp directory
	- Extract only the latest API version of each resource
	- Write everything into arm-schemas/

`deno task scoop`

Verify resource types

This checker:
	- Parses all individual spec files
	- Determines whether each one is a child resource
	- Emits a report to arm-schemas/resource-structure-report.json

`deno task checker`

⸻

## Schema Source

All ARM schemas are sourced from:

https://github.com/Azure/azure-resource-manager-schemas

This repo is cloned during the scoop and removed after.

⸻
