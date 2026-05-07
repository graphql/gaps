#!/usr/bin/env node

/**
 * Builds the GAP website.
 *
 * Usage: ./scripts/build-website.js [--gaps-dir <directory>] [--out-dir <directory>]
 *
 * The default input is the repository root.
 */

import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Handlebars from "handlebars";
import merge from "lodash.merge";
import memoize from "lodash.memoize";
import pLimit from "p-limit";
import { parse as parseYaml } from "yaml";

const require = createRequire(import.meta.url);
const specMarkdown = require("@mlarah/spec-md");
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const websiteDir = join(rootDir, "website");
const logoAssetPath = join(websiteDir, "assets", "graphql-logo-wordmark.svg");
const siteCssPath = join(websiteDir, "site.css");
const templatesDir = join(websiteDir, "templates");

async function findGapDirs(parent) {
  return (await readdir(parent, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("GAP-"))
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(parent, name));
}

async function discoverDocuments(parent, gapName) {
  const draftPath = join(parent, "DRAFT.md");

  const documents = [
    {
      kind: "draft",
      label: "Draft",
      sourcePath: draftPath,
      href: `${gapName}/draft/`,
      outDir: join(gapName, "draft"),
    },
  ];

  const versionsDir = join(parent, "versions");
  if (existsSync(versionsDir)) {
    const versions = (await readdir(versionsDir))
      .filter((name) => /^\d{4}-\d{2}\.md$/.test(name))
      .sort()
      .reverse();

    for (const fileName of versions) {
      const version = fileName.replace(/\.md$/, "");
      documents.push({
        kind: "version",
        label: version,
        sourcePath: join(versionsDir, fileName),
        href: `${gapName}/versions/${version}/`,
        outDir: join(gapName, "versions", version),
        version,
      });
    }
  }

  return documents;
}

/**
 * Converts kebab-case to Title Case
 * @example titleCase("in-review") -> "In Review"
 */
function titleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function authorName(author) {
  const match = String(author).match(/^\s*(.*?)\s*<[^>]+>\s*$/);
  return match ? match[1] : String(author);
}

const readTemplate = memoize(async (name) => {
  const templatePath = join(templatesDir, name);
  return Handlebars.compile(await readFile(templatePath, "utf8"));
});

async function renderGapRow(gap) {
  const [gapRowTemplate, tagListTemplate, versionLinkTemplate] =
    await Promise.all([
      readTemplate("gap-row.html"),
      readTemplate("tag-list.html"),
      readTemplate("version-link.html"),
    ]);
  const publishedCount = gap.documents.filter(
    (document) => document.kind === "version",
  ).length;

  return gapRowTemplate({
    href: gap.href,
    name: gap.name,
    status: titleCase(gap.status),
    title: gap.title,
    summary: gap.summary,
    tagsHtml:
      gap.tags && gap.tags.length > 0
        ? tagListTemplate({
            tags: gap.tags.join(", "),
          })
        : "",
    releaseCount:
      publishedCount === 0
        ? "No published releases"
        : `${publishedCount} published ${publishedCount === 1 ? "release" : "releases"}`,
    versionLinksHtml: gap.documents
      .map((document) =>
        versionLinkTemplate({
          className: document.kind === "draft" ? "draft-link" : "",
          href: document.href,
          label: document.label,
        }),
      )
      .join(""),
  });
}

async function renderGapMeta(gap) {
  const gapMetaTemplate = await readTemplate("gap-meta.html");
  const items = [
    { label: "Status", value: titleCase(gap.status) },
    { label: "Authors", value: gap.authors.map(authorName).join(", ") },
    { label: "Sponsor", value: gap.sponsor },
  ];

  if (gap.tags.length > 0) {
    items.push({ label: "Tags", value: gap.tags.join(", ") });
  }

  if (gap.discussion) {
    items.push({
      label: "Discussion",
      href: gap.discussion,
    });
  }

  return gapMetaTemplate({
    items,
  });
}

async function renderGapVersionRows(gap) {
  const versionRowTemplate = await readTemplate("version-row.html");
  return gap.documents
    .map((document) => {
      const href = document.href.replace(`${gap.name}/`, "");
      const isDraft = document.kind === "draft";
      const className = isDraft
        ? "version-row version-row-draft"
        : "version-row";
      const note = isDraft ? "Current editable text" : "Published release";

      return versionRowTemplate({
        className,
        href,
        label: document.label,
        note,
      });
    })
    .join("\n");
}

async function renderPage({
  pageTitle,
  assetPrefix = "",
  header,
  mainClass = "wrap",
  mainHtml,
}) {
  const [pageTemplate, headerTemplate] = await Promise.all([
    readTemplate("page.html"),
    readTemplate("header.html"),
  ]);

  return pageTemplate({
    pageTitle,
    assetPrefix,
    headerHtml: headerTemplate({
      assetPrefix,
      mastheadClasses: ["masthead", header.mastheadClass]
        .filter(Boolean)
        .join(" "),
      eyebrow: header.eyebrow,
      eyebrowHref: header.eyebrowHref,
      eyebrowSuffix: header.eyebrowSuffix,
      title: header.title,
      lede: header.lede,
    }),
    mainClass,
    mainHtml,
  });
}

async function renderGapOverview(gap) {
  const [gapOverviewTemplate, versionRowsHtml, gapMetaHtml] = await Promise.all(
    [
      readTemplate("gap-overview.html"),
      renderGapVersionRows(gap),
      renderGapMeta(gap),
    ],
  );

  return renderPage({
    pageTitle: `${gap.name}: ${gap.title} | GraphQL Auxiliary Proposals`,
    assetPrefix: "../",
    header: {
      eyebrow: "GAPs Directory",
      eyebrowHref: "../",
      eyebrowSuffix: ` / ${gap.name}`,
      title: gap.title,
      lede: gap.summary,
      mastheadClass: "gap-masthead",
    },
    mainClass: "wrap gap-detail",
    mainHtml: gapOverviewTemplate({
      gapName: gap.name,
      versionRowsHtml,
      gapMetaHtml,
    }),
  });
}

async function renderIndex(manifest) {
  const indexTemplate = await readTemplate("index.html");
  const gapRows = await Promise.all(manifest.gaps.map(renderGapRow));

  return renderPage({
    pageTitle: "GraphQL Auxiliary Proposals",
    header: {
      eyebrow: "GraphQL Auxiliary Proposals",
      title: "GAPs Directory",
      lede: "Community specifications and auxiliary proposals outside the core GraphQL specification.",
    },
    mainHtml: indexTemplate({
      gapRowsHtml: gapRows.join("\n"),
    }),
  });
}

async function buildGap(gapDir, outDir) {
  const gapName = basename(gapDir);

  const gapMetadata = parseYaml(
    await readFile(join(gapDir, "metadata.yml"), "utf8"),
  );
  const specMetadataPath = join(gapDir, "metadata.json");
  const baseSpecMetadata = existsSync(specMetadataPath)
    ? JSON.parse(await readFile(specMetadataPath, "utf8"))
    : {};

  const documents = await discoverDocuments(gapDir, gapName);
  const builtDocuments = await Promise.all(
    documents.map(async (document) => {
      const documentOutDir = join(outDir, document.outDir);
      await mkdir(documentOutDir, { recursive: true });

      const metadata = merge({}, baseSpecMetadata, {
        githubSource: `https://github.com/graphql/gaps/pull/${gapMetadata.id}/`,
        frontmatter: {
          [gapName]: gapMetadata.title,
          Version: document.label,
          Authors: gapMetadata.authors.map(authorName).join(", "),
          Discussion: gapMetadata.discussion,
        },
      });

      const documentOutputPath = join(documentOutDir, "index.html");
      await writeFile(
        documentOutputPath,
        specMarkdown.html(document.sourcePath, metadata),
      );

      return {
        kind: document.kind,
        label: document.label,
        version: document.version,
        href: document.href,
        source: relative(rootDir, document.sourcePath).split(sep).join("/"),
      };
    }),
  );

  const gap = {
    id: gapMetadata.id,
    name: gapName,
    title: gapMetadata.title,
    status: gapMetadata.status,
    authors: gapMetadata.authors,
    sponsor: gapMetadata.sponsor,
    discussion: gapMetadata.discussion,
    tags: gapMetadata.tags ?? [],
    related: gapMetadata.related ?? [],
    replaces: gapMetadata.replaces,
    supersededBy: gapMetadata.supersededBy,
    summary: gapMetadata.summary,
    href: `${gapName}/`,
    documents: builtDocuments,
  };

  await writeFile(
    join(outDir, gapName, "index.html"),
    await renderGapOverview(gap),
  );

  console.log(`Built ${gapName}: ${documents.length} document(s)`);
  return gap;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "gaps-dir": { type: "string", default: join(rootDir, "gaps") },
      "out-dir": { type: "string", default: join(rootDir, "_site") },
    },
  });

  const gapsParentDir = resolve(rootDir, values["gaps-dir"]);
  const outDir = resolve(rootDir, values["out-dir"]);

  if (existsSync(outDir)) {
    throw new Error(`Output directory already exists: ${outDir}`);
  }

  const gapDirs = await findGapDirs(gapsParentDir);
  if (gapDirs.length === 0) {
    throw new Error(`No GAP directories found in ${gapsParentDir}`);
  }

  await mkdir(join(outDir, "assets"), { recursive: true });
  await Promise.all([
    copyFile(
      logoAssetPath,
      join(outDir, "assets", "graphql-logo-wordmark.svg"),
    ),
    copyFile(siteCssPath, join(outDir, "assets", "site.css")),
  ]);

  const limit = pLimit(6);
  const gaps = await Promise.all(
    gapDirs.map((gapDir) => limit(() => buildGap(gapDir, outDir))),
  );

  const manifest = {
    source: relative(rootDir, gapsParentDir) || ".",
    gaps,
  };

  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(join(outDir, "index.html"), await renderIndex(manifest));
  console.log(`Built site in ${relative(rootDir, outDir)}`);
}

await main();
