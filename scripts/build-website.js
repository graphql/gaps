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
import { Resvg } from "@resvg/resvg-js";
import { parse as parseYaml } from "yaml";

const require = createRequire(import.meta.url);
const specMarkdown = require("@mlarah/spec-md");
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const websiteDir = join(rootDir, "website");
const logoAssetPath = join(websiteDir, "assets", "graphql-logo-wordmark.svg");
const siteCssPath = join(websiteDir, "site.css");
const templatesDir = join(websiteDir, "templates");

const siteName = "GraphQL Auxiliary Proposals";
const siteUrl = "https://gaps.graphql.org/";
const siteDescription =
  "Community specifications and auxiliary proposals outside the core GraphQL specification.";
const openGraphImage = {
  dir: "assets/opengraph",
  width: 1200,
  height: 630,
  type: "image/png",
};

async function findGapDirs(parent) {
  return (await readdir(parent, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("GAP-"))
    .map((entry) => entry.name)
    .sort(
      (a, b) => parseInt(a.split("-")[1], 10) - parseInt(b.split("-")[1], 10),
    )
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

function renderHeadMetadata({ title, description, path, type, imagePath }) {
  const canonicalUrl = new URL(path, siteUrl).href;
  const imageUrl = new URL(imagePath, siteUrl).href;
  const escaped = {
    title: Handlebars.escapeExpression(title.replace(/\s+/g, " ")),
    description: Handlebars.escapeExpression(description.replace(/\s+/g, " ")),
    type: Handlebars.escapeExpression(type),
    siteName: Handlebars.escapeExpression(siteName),
    canonicalUrl: Handlebars.escapeExpression(canonicalUrl),
    imageUrl: Handlebars.escapeExpression(imageUrl),
    imageType: Handlebars.escapeExpression(openGraphImage.type),
  };

  return [
    `<meta name="description" content="${escaped.description}" />`,
    `<link rel="canonical" href="${escaped.canonicalUrl}" />`,
    `<meta property="og:site_name" content="${escaped.siteName}" />`,
    `<meta property="og:title" content="${escaped.title}" />`,
    `<meta property="og:description" content="${escaped.description}" />`,
    `<meta property="og:type" content="${escaped.type}" />`,
    `<meta property="og:url" content="${escaped.canonicalUrl}" />`,
    `<meta property="og:image" content="${escaped.imageUrl}" />`,
    `<meta property="og:image:secure_url" content="${escaped.imageUrl}" />`,
    `<meta property="og:image:type" content="${escaped.imageType}" />`,
    `<meta property="og:image:width" content="${openGraphImage.width}" />`,
    `<meta property="og:image:height" content="${openGraphImage.height}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escaped.title}" />`,
    `<meta name="twitter:description" content="${escaped.description}" />`,
    `<meta name="twitter:image" content="${escaped.imageUrl}" />`,
  ].join("\n");
}

function wrapText(value, maxLineLength, maxLines) {
  const words = value.replace(/\s+/g, " ").split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length <= maxLineLength) {
      line = nextLine;
      continue;
    }

    if (line) {
      lines.push(line);
      line = word;
    } else {
      lines.push(word);
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  const consumedLength = lines.join(" ").length;
  const normalized = value.replace(/\s+/g, " ");
  if (consumedLength < normalized.length && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine.endsWith("…")
      ? lastLine
      : lastLine.length >= maxLineLength
        ? lastLine
            .replace(/\s+$/g, " ")
            .slice(0, maxLineLength - 1)
            .trimEnd() + "…"
        : `${lastLine}…`;
  }

  return lines;
}

function renderTextLines(lines, { x, y, lineHeight, className }) {
  return lines
    .map(
      (line, index) =>
        `<text class="${className}" x="${x}" y="${y + index * lineHeight}">${Handlebars.escapeExpression(line)}</text>`,
    )
    .join("\n");
}

let graphQLLogoWordmarkPromise;

async function writeOpenGraphImage(outDir, image) {
  const imagePath = `${openGraphImage.dir}/${image.name}.png`;
  const outputPath = join(outDir, imagePath);
  const titleLines = wrapText(image.title, 32, 2);
  const titleFontSize = 60;
  const titleLineHeight = titleFontSize + 10;
  const descriptionY = 350 + (titleLines.length - 1) * titleLineHeight;
  const descriptionLines = wrapText(image.description, 70, 3);

  graphQLLogoWordmarkPromise ??= readFile(
    join(websiteDir, "assets", "graphql-logo-wordmark.svg"),
    "utf8",
  ).then((source) =>
    source
      .replace(/<style>[\s\S]*?<\/style>/g, "")
      .replace(/^<svg\b[^>]*>/, "")
      .replace(/<\/svg>\s*$/, ""),
  );
  const logoWordmark = await graphQLLogoWordmarkPromise;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${openGraphImage.width}" height="${openGraphImage.height}" viewBox="0 0 ${openGraphImage.width} ${openGraphImage.height}" role="img">
  <style>
    .eyebrow {
      fill: #e10098;
      font-size: 27px;
      font-weight: 700;
    }
    .title {
      fill: #171717;
      font-size: ${titleFontSize}px;
      font-weight: 800;
    }
    .description {
      fill: #676b63;
      font-size: 31px;
      font-weight: 400;
    }
  </style>
  <rect width="1200" height="630" fill="#f6f4ee" />
  <rect x="60" y="58" width="1080" height="514" fill="#fffef9" stroke="#d8d3c8" stroke-width="2" />
  <rect x="60" y="558" width="1080" height="14" fill="#e10098" />
  <g transform="translate(92 92) scale(0.58)" fill="#e10098">${logoWordmark}</g>
  <text class="eyebrow" x="92" y="202">${siteName}</text>
  ${renderTextLines(titleLines, {
    x: 92,
    y: 284,
    lineHeight: titleLineHeight,
    className: "title",
  })}
  ${renderTextLines(descriptionLines, {
    x: 96,
    y: descriptionY,
    lineHeight: 43,
    className: "description",
  })}
</svg>`;
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: openGraphImage.width,
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Arial",
    },
  });
  const png = resvg.render().asPng();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);

  return imagePath;
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
    { label: "Authors", value: gap.authors.map((a) => a.name).join(", ") },
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
  pageDescription,
  pagePath,
  openGraphTitle,
  openGraphType = "website",
  openGraphImagePath,
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
    headMetadataHtml: renderHeadMetadata({
      title: openGraphTitle,
      description: pageDescription,
      path: pagePath,
      type: openGraphType,
      imagePath: openGraphImagePath,
    }),
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
    pageDescription: gap.summary,
    pagePath: gap.href,
    openGraphTitle: `${gap.name}: ${gap.title}`,
    openGraphType: "article",
    openGraphImagePath: gap.openGraphImagePath,
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

async function renderIndex(manifest, openGraphImagePath) {
  const indexTemplate = await readTemplate("index.html");
  const gapRows = await Promise.all(manifest.gaps.map(renderGapRow));

  return renderPage({
    pageTitle: siteName,
    pageDescription: siteDescription,
    pagePath: "",
    openGraphTitle: siteName,
    openGraphImagePath,
    header: {
      eyebrow: siteName,
      title: "GAPs Directory",
      lede: siteDescription,
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

	const openGraphImagePath = await writeOpenGraphImage(outDir, {
		name: gapName,
		title: `${gapName}: ${gapMetadata.title}`,
		description: gapMetadata.summary,
	});

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
          Authors: gapMetadata.authors.map((a) => a.name).join(", "),
          Discussion: gapMetadata.discussion,
        },
      });
      metadata.head = renderHeadMetadata({
        title: `${gapName}: ${gapMetadata.title} - ${document.label}`,
        description: gapMetadata.summary,
        path: document.href,
        type: "article",
        imagePath: openGraphImagePath,
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
    openGraphImagePath,
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
    gaps: gaps.map(({ openGraphImagePath: _, ...gap }) => gap),
  };
  const indexOpenGraphImagePath = await writeOpenGraphImage(outDir, {
    name: "index",
    title: "GAPs Directory",
    description: siteDescription,
  });

  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    join(outDir, "index.html"),
    await renderIndex(manifest, indexOpenGraphImagePath),
  );
  console.log(`Built site in ${relative(rootDir, outDir)}`);
}

await main();
