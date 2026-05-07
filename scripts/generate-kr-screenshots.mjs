#!/usr/bin/env node

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const indexUrl = pathToFileURL(path.join(rootDir, "index.html")).href;
const args = new Set(process.argv.slice(2));
const useLiveSync = args.has("--live-sync");
const useAllDubbingCases = args.has("--all-dubbing");
const useDubbingOnly = args.has("--only-dubbing");

const courseFormats = [
  { label: "코스", slug: "course" },
  { label: "시그니처", slug: "signature" },
  { label: "딕셔너리", slug: "dictionary" },
  { label: "에셋", slug: "asset" },
  { label: "클래스", slug: "class" },
  { label: "클래스 +", slug: "class-plus" },
  { label: "프로젝트", slug: "project" },
  { label: "신규", slug: "new" },
];

const dubbingRepresentativeFormat = courseFormats[0];

const languageOptions = [
  { site: "KR", language: "KO", languageSlug: "KO" },
  { site: "JP", language: "JO", languageSlug: "JO" },
  { site: "GL", language: "EN", languageSlug: "EN" },
  { site: "GL", language: "ZH-TW", languageSlug: "ZH-TW" },
  { site: "GL", language: "TH", languageSlug: "TH" },
];

const localizationTypes = [
  { label: "폐강옵션", slug: "closed-option" },
  { label: "정규", slug: "regular" },
  { label: "더빙", slug: "dubbing" },
  { label: "확장", slug: "extension" },
];

const requestedSites = getRequestedSites();
const { chromium } = loadPlaywright();

const browser = await chromium.launch({
  headless: true,
  ...getBrowserLaunchOptions(),
});

try {
  for (const site of requestedSites) {
    await captureSite(site);
  }
} finally {
  await browser.close();
}

async function captureSite(site) {
  const outputDir = path.join(rootDir, "outputs", `${site.toLowerCase()}-screenshots`);
  const caseEntries = buildCases(site)
    .map((screenshotCase, index) => ({
      number: index + 1,
      screenshotCase,
    }))
    .filter(({ screenshotCase }) => shouldCaptureCase(screenshotCase));
  const manifest = [];

  await prepareOutputDir(outputDir, caseEntries);

  for (const { number, screenshotCase } of caseEntries) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    if (!useLiveSync) {
      await stubRemoteSync(page);
    }

    await page.goto(indexUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForDashboard(page);
    await prepareScreenshotPage(page);
    await selectCase(page, screenshotCase);
    await page.evaluate(() => window.scrollTo(0, 0));

    const fileName = makeFileName(number, screenshotCase);
    const filePath = path.join(outputDir, fileName);
    await page.screenshot({
      path: filePath,
      fullPage: true,
      animations: "disabled",
    });

    manifest.push({
      number,
      file: fileName,
      label: makeCaseLabel(screenshotCase),
      selectedScope: await page.locator("#selectedScope").textContent(),
      taskCount: await page.locator("#taskCount").textContent(),
      syncStatus: await page.locator("#syncStatus").textContent(),
    });

    await page.close();
    console.log(`Captured ${fileName}`);
  }

  const nextManifest = useDubbingOnly
    ? await mergeManifest(outputDir, site, manifest)
    : buildManifest(site, manifest);

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(nextManifest, null, 2)}\n`
  );
  await fs.writeFile(path.join(outputDir, "index.html"), renderGallery(site, nextManifest.cases));

  console.log(`Done: ${manifest.length} screenshots saved to ${outputDir}`);
}

async function prepareOutputDir(outputDir, caseEntries) {
  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(outputDir).catch(() => []);
  const removableEntries = useDubbingOnly
    ? new Set(caseEntries.map(({ number, screenshotCase }) => makeFileName(number, screenshotCase)))
    : new Set(
        entries.filter(
          (entry) => entry.endsWith(".png") || entry === "manifest.json" || entry === "index.html"
        )
      );

  await Promise.all(
    entries
      .filter((entry) => removableEntries.has(entry))
      .map((entry) => fs.unlink(path.join(outputDir, entry)))
  );
}

function shouldCaptureCase(screenshotCase) {
  if (!useDubbingOnly) return true;
  return screenshotCase.courseType === "현지화" && screenshotCase.localizationType === "더빙";
}

function buildManifest(site, cases) {
  return {
    generatedAt: new Date().toISOString(),
    source: useLiveSync ? "dashboard-with-live-sync" : "dashboard-local-source",
    site,
    caseCount: cases.length,
    cases,
  };
}

async function mergeManifest(outputDir, site, updatedCases) {
  const manifestPath = path.join(outputDir, "manifest.json");
  const currentManifest = await readManifest(manifestPath);
  const caseByFile = new Map((currentManifest?.cases || []).map((item) => [item.file, item]));

  updatedCases.forEach((item) => {
    caseByFile.set(item.file, item);
  });

  const cases = [...caseByFile.values()].sort((a, b) => a.number - b.number);
  return {
    ...(currentManifest || {}),
    generatedAt: new Date().toISOString(),
    source: useLiveSync ? "dashboard-with-live-sync" : "dashboard-local-source",
    site,
    caseCount: cases.length,
    cases,
  };
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PACKAGE_DIR,
    path.join(rootDir, "node_modules", "playwright"),
    path.join(
      os.homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return require(candidate);
  }

  return require("playwright");
}

function getRequestedSites() {
  const siteArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--site=") || arg.startsWith("--sites="));

  const sites = siteArg
    ? siteArg
        .split("=")[1]
        .split(",")
        .map((site) => site.trim().toUpperCase())
        .filter(Boolean)
    : ["KR"];

  const availableSites = new Set(languageOptions.map((option) => option.site));
  const invalidSites = sites.filter((site) => !availableSites.has(site));
  if (invalidSites.length) {
    throw new Error(`Unsupported site: ${invalidSites.join(", ")}`);
  }

  return [...new Set(sites)];
}

function buildCases(site) {
  return languageOptions
    .filter((option) => option.site === site)
    .flatMap((option) => buildLanguageCases(option));
}

function buildLanguageCases(option) {
  return [
    ...buildOriginalCases(option),
    ...getLocalizationTypes(option).flatMap((localizationType) =>
      buildLocalizationCases(option, localizationType)
    ),
  ];
}

function buildOriginalCases(option) {
  if (isGlThaiOriginalDiscussionCase(option)) {
    return [makeCase(option, "오리지널", null, dubbingRepresentativeFormat)];
  }

  return courseFormats.map((format) => makeCase(option, "오리지널", null, format));
}

function buildLocalizationCases(option, localizationType) {
  if (localizationType.label === "더빙") {
    const formats = useAllDubbingCases ? courseFormats : [dubbingRepresentativeFormat];
    return formats.map((format) => makeCase(option, "현지화", localizationType, format));
  }

  return courseFormats.map((format) => makeCase(option, "현지화", localizationType, format));
}

function getLocalizationTypes(option) {
  if (["KR", "JP"].includes(option.site)) {
    return localizationTypes.filter((type) => type.label !== "확장");
  }

  if (option.site === "GL" && option.language === "EN") {
    return localizationTypes.filter((type) => type.label !== "확장");
  }

  return localizationTypes;
}

function isGlThaiOriginalDiscussionCase(option) {
  return option.site === "GL" && option.language === "TH";
}

function makeCase(option, courseType, localizationType, courseFormat) {
  return {
    site: option.site,
    language: option.language,
    languageSlug: option.languageSlug,
    courseType,
    courseTypeSlug: courseType === "오리지널" ? "original" : "localized",
    localizationType: localizationType?.label || "-",
    localizationTypeSlug: localizationType?.slug || "",
    courseFormat: courseFormat.label,
    courseFormatSlug: courseFormat.slug,
  };
}

function getBrowserLaunchOptions() {
  const executablePath = getBrowserExecutablePath();
  return executablePath ? { executablePath } : {};
}

function getBrowserExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    path.join(os.homedir(), "Applications/Chromium.app/Contents/MacOS/Chromium"),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) || "";
}

async function stubRemoteSync(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();

    if (url.includes("@supabase/supabase-js")) {
      await route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = undefined;",
      });
      return;
    }

    if (url.includes("supabase.co")) {
      await route.abort();
      return;
    }

    await route.continue();
  });
}

async function waitForDashboard(page) {
  await page.waitForSelector("#siteFilter option", { state: "attached", timeout: 10000 });

  if (useLiveSync) {
    await page
      .waitForFunction(() => {
        const status = document.querySelector("#syncStatus")?.textContent || "";
        return status && status !== "DB 연결 중";
      }, null, { timeout: 12000 })
      .catch(() => {});
  }
}

async function prepareScreenshotPage(page) {
  await page.addStyleTag({
    content: `
      .topbar,
      .guide-bar {
        display: none !important;
      }
    `,
  });
}

async function selectCase(page, screenshotCase) {
  await selectOption(page, "#siteFilter", screenshotCase.site);

  if (screenshotCase.site === "GL") {
    await selectOption(page, "#languageFilter", screenshotCase.language);
  }

  await selectOption(page, "#courseTypeFilter", screenshotCase.courseType);

  if (screenshotCase.courseType === "현지화") {
    await selectOption(page, "#localizationTypeFilter", screenshotCase.localizationType);
  }

  await selectOption(page, "#courseFormatFilter", screenshotCase.courseFormat);
  await selectOption(page, "#phaseFilter", "전체");
  await page.waitForTimeout(120);
}

async function selectOption(page, selector, value) {
  await page.waitForFunction(
    ({ selector: innerSelector, value: innerValue }) => {
      const select = document.querySelector(innerSelector);
      return Array.from(select?.options || []).some((option) => option.value === innerValue);
    },
    { selector, value },
    { timeout: 10000 }
  );
  await page.evaluate(
    ({ selector: innerSelector, value: innerValue }) => {
      const select = document.querySelector(innerSelector);
      select.value = innerValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value }
  );
  await page.waitForTimeout(40);
}

function makeFileName(number, screenshotCase) {
  const parts = [
    String(number).padStart(2, "0"),
    screenshotCase.site,
    ...(screenshotCase.site === "GL" ? [screenshotCase.languageSlug] : []),
    screenshotCase.courseTypeSlug,
    screenshotCase.localizationTypeSlug,
    screenshotCase.courseFormatSlug,
  ].filter(Boolean);

  return `${parts.join("_")}.png`;
}

function makeCaseLabel(screenshotCase) {
  return [
    screenshotCase.site,
    ...(screenshotCase.site === "GL" ? [screenshotCase.language] : []),
    screenshotCase.courseType,
    screenshotCase.courseType === "현지화" ? screenshotCase.localizationType : "",
    screenshotCase.courseFormat,
  ]
    .filter(Boolean)
    .join(" / ");
}

function renderGallery(site, items) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(site)} 작업 산출물 스크린샷</title>
    <style>
      body {
        background: #f5f6f8;
        color: #1d252c;
        font-family:
          Inter, "Pretendard", "Noto Sans KR", -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        letter-spacing: 0;
        margin: 0;
      }

      main {
        display: grid;
        gap: 18px;
        padding: 24px;
      }

      header {
        background: #ffffff;
        border: 1px solid #dce2e7;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        padding: 18px 20px;
      }

      h1,
      p {
        margin: 0;
      }

      h1 {
        font-size: 22px;
        line-height: 1.3;
      }

      p {
        color: #65717c;
        font-size: 13px;
        font-weight: 700;
      }

      .gallery {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      }

      article {
        background: #ffffff;
        border: 1px solid #dce2e7;
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      img {
        border: 1px solid #dce2e7;
        display: block;
        height: auto;
        width: 100%;
      }

      strong {
        font-size: 14px;
        line-height: 1.35;
      }

      @media (max-width: 520px) {
        main {
          padding: 16px;
        }

        header {
          display: grid;
        }

        .gallery {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(site)} 작업 산출물 스크린샷</h1>
        <p>${items.length}개 케이스</p>
      </header>
      <section class="gallery">
        ${items
          .map(
            (item) => `<article>
          <a href="./${escapeAttribute(item.file)}" target="_blank" rel="noreferrer">
            <img src="./${escapeAttribute(item.file)}" alt="${escapeAttribute(item.label)}" />
          </a>
          <strong>${escapeHtml(item.number)}. ${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.taskCount)} · ${escapeHtml(item.selectedScope || "")}</p>
        </article>`
          )
          .join("\n")}
      </section>
    </main>
  </body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
