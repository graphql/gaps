#!/usr/bin/env node

/**
 * Validates the structure of a GAP directory.
 *
 * Usage: ./scripts/validate-structure.js <gap-directory>
 *
 * Can be xarg'd over all GAP directories:
 *   find . -maxdepth 1 -type d -name 'GAP-*' | xargs -I{} node scripts/validate-structure.js {}
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Ajv from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";
import validator from "validator";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load JSON Schema from root directory
const schemaPath = join(__dirname, "..", "metadata.schema.json");
const metadataSchema = JSON.parse(readFileSync(schemaPath, "utf8"));

// Set up ajv with JSON Schema
const ajv = new Ajv({ allErrors: true });
const validateMetadataSchema = ajv.compile(metadataSchema);

function error(gapName, message) {
  console.error(`${gapName}: ${message}`);
  process.exit(1);
}

function validateDirectoryNaming(dirPath) {
  const dirName = basename(dirPath);

  // Special case: GAP-0 is allowed
  if (dirName === "GAP-0") {
    return dirName;
  }

  // Must match GAP-NNNN format (4 digits, zero-padded)
  if (!/^GAP-\d{4}$/.test(dirName)) {
    error(
      dirName,
      `Invalid directory name format. Expected GAP-NNNN (4 digits, zero-padded)`,
    );
  }

  return dirName;
}

function validateReadmeExists(dirPath, gapName) {
  const readmePath = join(dirPath, "README.md");
  if (!existsSync(readmePath)) {
    error(gapName, "No README.md file found");
  }
}

function validateMetadata(dirPath, gapName) {
  const metadataPath = join(dirPath, "metadata.yml");

  if (!existsSync(metadataPath)) {
    error(gapName, "No metadata.yml file found");
  }

  let content;
  try {
    content = readFileSync(metadataPath, "utf8");
  } catch (err) {
    error(gapName, `Failed to read metadata.yml: ${err.message}`);
  }

  let metadata;
  try {
    metadata = parseYaml(content);
  } catch (err) {
    error(gapName, `Invalid YAML in metadata.yml: ${err.message}`);
  }

  if (typeof metadata !== "object") {
    error(gapName, "metadata.yml must contain a valid YAML object");
  }

  // Validate against JSON Schema
  const valid = validateMetadataSchema(metadata);
  if (!valid) {
    const errors = validateMetadataSchema.errors
      .map((err) => {
        const prefix = err.instancePath ? `${err.instancePath}: ` : "";
        return `${prefix}${err.message}`;
      })
      .join("\n");
    error(gapName, `metadata.yml validation failed:\n\n${errors}`);
  }

  // Validate authors have valid email format
  for (const author of metadata.authors) {
    if (!validator.isEmail(author, { allow_display_name: true })) {
      error(
        gapName,
        `metadata.yml invalid author "${author}" - must be "Name <email>" or a valid email`,
      );
    }
  }

  // Validate sponsor starts with @
  if (!metadata.sponsor.startsWith("@")) {
    error(
      gapName,
      `metadata.yml sponsor must be a GitHub username starting with @ (got "${metadata.sponsor}")`,
    );
  }

  // Validate discussion is a valid URL
  if (!validator.isURL(metadata.discussion)) {
    error(
      gapName,
      `metadata.yml discussion must be a valid URL (got "${metadata.discussion}")`,
    );
  }
}

function main() {
  const { positionals } = parseArgs({ allowPositionals: true, strict: true });

  if (positionals.length !== 1) {
    console.error("Usage: ./scripts/validate-structure.js <gap-directory>");
    process.exit(1);
  }

  const dirPath = positionals[0];

  if (!existsSync(dirPath)) {
    console.error(`Directory does not exist: ${dirPath}`);
    process.exit(1);
  }

  if (!statSync(dirPath).isDirectory()) {
    console.error(`Not a directory: ${dirPath}`);
    process.exit(1);
  }

  // Validate directory naming
  const gapName = validateDirectoryNaming(dirPath);

  // Validate README.md exists
  validateReadmeExists(dirPath, gapName);

  // Validate metadata.yml
  validateMetadata(dirPath, gapName);
}

main();
