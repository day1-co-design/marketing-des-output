const sourceRows = [
  ["", "국가(사이트)", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "언어", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "포맷/산출물", "얼리버드", "", "", "", "", "", "", "", "상세페이지 오픈", "", "", "", "", "", "", "", "", "", "", "", "영상공개", "", "", "", "", "", ""],
  ["", "", "얼리버드 오가닉", "", "", "", "", "", "사이트", "얼리버드 오가닉", "사이트", "", "", "", "", "오가닉", "", "", "", "", "", "", "사이트", "오가닉", "", "", "", "", ""],
  ["", "", "콜로소 공계 피드", "", "스토리", "연사용 공계 피드", "", "카카오톡", "코스카드 썸네일", "EDM", "상세페이지", "메인배너", "큐레이션 배너", "포맷 전용 페이지", "", "피드", "", "스토리", "연사용 공계 피드", "", "EDM", "광고", "상세페이지 수정", "콜로소 공계 피드", "", "스토리", "연사용 오가닉", "", "광고"],
  ["", "", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "", "", "", "메인 페이지 ", "개별 상세 페이지", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "1:1", "4:5", "", "1:1", "4:5", ""],
];

const siteLanguageOptions = [
  { site: "KR", language: "KO" },
  { site: "JP", language: "JO" },
  { site: "GL", language: "EN" },
  { site: "GL", language: "ZH-TW" },
  { site: "GL", language: "TH" },
];

const courseTypes = ["오리지널", "현지화"];

const courseFormatOptions = [
  "코스",
  "시그니처",
  "딕셔너리",
  "에셋",
  "클래스",
  "클래스 +",
  "프로젝트",
  "신규",
];

const localizationTypeOptions = ["폐강옵션", "정규", "더빙", "확장"];

const guideLinks = [
  { label: "통합", url: "" },
  { label: "KR", url: "" },
  { label: "JP", url: "" },
  { label: "GL", url: "" },
];

const csvColumns = [
  { key: "id", label: "ID" },
  { key: "site", label: "사이트" },
  { key: "language", label: "언어" },
  { key: "courseType", label: "코스유형" },
  { key: "courseFormat", label: "코스포맷" },
  { key: "localizationType", label: "현지화유형" },
  { key: "phase", label: "런칭 타임라인" },
  { key: "group", label: "구분" },
  { key: "output", label: "업무내용" },
  { key: "size", label: "규격" },
  { key: "fileExtension", label: "파일 확장자" },
  { key: "workIncluded", label: "업무유무" },
  { key: "typeFit", label: "유형적합여부" },
  { key: "memo", label: "메모" },
];

const headerMap = new Map(
  csvColumns.flatMap((column) => [
    [column.key, column.key],
    [column.label, column.key],
  ])
);
headerMap.set("업무구간", "phase");
headerMap.set("업무 구간", "phase");
headerMap.set("런칭타임라인", "phase");
headerMap.set("파일확장자", "fileExtension");

const overrideStorageKey = "colosoDesignOutputChecks";
const dbTableName = "marketing_output_overrides";
const remoteOverrideColumns = "id,size,file_extension,memo,work_included,type_fit";
const remoteOverrideFallbackColumns = "id,size,memo,work_included,type_fit";
const remoteOverridePageSize = 1000;
let overrides = loadOverrides();
let items = applyOverrides(buildItems(sourceRows));
let hasUnsavedChanges = false;
let syncClient = null;
let syncChannel = null;
let isFileExtensionColumnMissing = false;
let isEditAuthorized = false;
let editPasscode = "";
let pendingAuthorizedAction = null;

const els = {
  siteFilter: document.getElementById("siteFilter"),
  languageControl: document.getElementById("languageControl"),
  languageFilter: document.getElementById("languageFilter"),
  courseTypeFilter: document.getElementById("courseTypeFilter"),
  courseFormatFilter: document.getElementById("courseFormatFilter"),
  localizationTypeControl: document.getElementById("localizationTypeControl"),
  localizationTypeFilter: document.getElementById("localizationTypeFilter"),
  phaseFilter: document.getElementById("phaseFilter"),
  selectedScope: document.getElementById("selectedScope"),
  taskCount: document.getElementById("taskCount"),
  taskList: document.getElementById("taskList"),
  managementCount: document.getElementById("managementCount"),
  managementTableHead: document.getElementById("managementTableHead"),
  managementTableBody: document.getElementById("managementTableBody"),
  guideLinkList: document.getElementById("guideLinkList"),
  syncStatus: document.getElementById("syncStatus"),
  csvFileInput: document.getElementById("csvFileInput"),
  importCsvBtn: document.getElementById("importCsvBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  saveBtn: document.getElementById("saveBtn"),
  editAuthModal: document.getElementById("editAuthModal"),
  editPasscodeInput: document.getElementById("editPasscodeInput"),
  editAuthError: document.getElementById("editAuthError"),
  cancelEditAuthBtn: document.getElementById("cancelEditAuthBtn"),
  confirmEditAuthBtn: document.getElementById("confirmEditAuthBtn"),
  tabButtons: document.querySelectorAll("[data-view]"),
  viewPanels: document.querySelectorAll("[data-panel]"),
};

function buildItems(rows) {
  const baseItems = [];
  const carry = {
    phase: "",
    group: "",
    output: "",
  };

  for (let column = 2; column < rows[0].length; column += 1) {
    carry.phase = rows[2][column] || carry.phase;
    carry.group = rows[3][column] || carry.group;
    carry.output = rows[4][column] || carry.output;

    const size = rows[5][column] || "";

    if (!carry.phase || !carry.output) continue;

    baseItems.push({
      sourceColumn: column,
      phase: carry.phase,
      group: carry.group,
      output: carry.output.trim(),
      size: size.trim(),
    });
  }

  const normalizedBaseItems = normalizeBaseItems(baseItems);

  return siteLanguageOptions.flatMap((option) =>
    courseTypes.flatMap((courseType) => {
      const localizationTypes = getLocalizationTypes(option.site, courseType);

      return courseFormatOptions.flatMap((courseFormat) =>
        localizationTypes.flatMap((localizationType) =>
          normalizedBaseItems
            .filter((item) => isAvailableForCourseFormat(item, courseFormat))
            .map((item) => ({
              ...withDefaults({
                site: option.site,
                language: option.language,
                courseType,
                courseFormat,
                localizationType,
                ...item,
              }),
            }))
        )
      );
    })
  );
}

function isAvailableForCourseFormat(item, courseFormat) {
  if (item.group === "온사이트" && item.output === "포맷 전용 페이지") {
    return courseFormat === "시그니처";
  }
  return true;
}

function getLocalizationTypes(site, courseType) {
  if (courseType !== "현지화") return ["-"];
  if (site === "KR") return localizationTypeOptions.filter((type) => type !== "확장");
  return localizationTypeOptions;
}

function normalizeBaseItems(baseItems) {
  const normalizedItems = baseItems.flatMap((item) => {
    const normalizedItem = {
      ...item,
      group: normalizeGroup(item.group, item.output),
      output: normalizeOutput(item.output),
    };
    normalizedItem.size = normalizeSize(normalizedItem);

    if (normalizedItem.group === "오가닉" && normalizedItem.output === "카카오톡") {
      return [
        {
          ...normalizedItem,
          sourceColumn: `${normalizedItem.sourceColumn}_crm`,
          group: "CRM",
        },
      ];
    }

    if (normalizedItem.group === "온사이트" && normalizedItem.output === "상세페이지") {
      return [
        {
          ...normalizedItem,
          sourceColumn: `${normalizedItem.sourceColumn}_image`,
          output: "상세페이지 이미지 제작",
        },
        {
          ...normalizedItem,
          sourceColumn: `${normalizedItem.sourceColumn}_admin`,
          output: "상세페이지 어드민 작업",
        },
      ];
    }

    return [normalizedItem];
  });

  const rehearsalStoryItems = [];
  const rehearsalStoryKeys = new Set();
  normalizedItems.forEach((item) => {
    if (item.group !== "오가닉" || item.output !== "연사용 피드") return;

    const key = [item.phase, item.group].join("|");
    if (rehearsalStoryKeys.has(key)) return;

    rehearsalStoryKeys.add(key);
    rehearsalStoryItems.push({
      ...item,
      sourceColumn: `${item.sourceColumn}_story`,
      output: "연사용 스토리",
      size: "",
      workIncluded: item.phase === "얼리버드" ? "O" : "X",
    });
  });

  return [
    ...normalizedItems,
    ...rehearsalStoryItems,
    {
      sourceColumn: "trailer_thumbnail",
      phase: "상세페이지 오픈",
      group: "오가닉",
      output: "트레일러 썸네일",
      size: "",
    },
  ];
}

function normalizeGroup(group, output) {
  const trimmedGroup = String(group || "").trim();
  const trimmedOutput = normalizeOutput(output);

  if (trimmedOutput === "EDM") return "CRM";
  if (trimmedOutput === "광고") return "페이드";
  if (trimmedGroup === "사이트") return "온사이트";
  if (trimmedGroup === "얼리버드 오가닉" || trimmedGroup === "오가닉") return "오가닉";
  if (trimmedGroup === "광고") return "페이드";
  return trimmedGroup;
}

function normalizeOutput(output) {
  const trimmedOutput = String(output || "").trim();

  if (trimmedOutput === "콜로소 공계 피드" || trimmedOutput === "피드") return "공계용 피드";
  if (trimmedOutput === "스토리") return "공계용 스토리";
  if (trimmedOutput === "연사용 공계 피드" || trimmedOutput === "연사용 오가닉") {
    return "연사용 피드";
  }
  return trimmedOutput;
}

function normalizeSizeValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const replacements = new Map([
    ["1:01", "1:1"],
    ["01:01", "1:1"],
    ["1:01:00", "1:1"],
    ["01:01:00", "1:1"],
    ["4:05", "4:5"],
    ["04:05", "4:5"],
    ["4:05:00", "4:5"],
    ["04:05:00", "4:5"],
  ]);

  return text
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const compact = trimmed.replace(/\s+/g, "");
      return replacements.get(compact) || trimmed;
    })
    .join(", ");
}

function normalizeSize(item) {
  if (item.group === "페이드" && item.output === "광고") return "광고 소재에 따라 상이";
  return normalizeSizeValue(item.size);
}

function withDefaults(item) {
  return {
    ...item,
    id: makeId(item),
    fileExtension: item.fileExtension || getFileExtension(item),
    memo: item.memo || "",
    workIncluded: item.workIncluded || getDefaultWorkIncluded(item),
    typeFit: item.typeFit || "O",
  };
}

function getDefaultWorkIncluded(item) {
  if (item.group === "오가닉" && item.output === "연사용 스토리") {
    return item.phase === "얼리버드" ? "O" : "X";
  }
  return "O";
}

function getFileExtension(item) {
  const group = String(item.group || "").trim();
  const output = String(item.output || "").trim().toUpperCase();

  if (output === "EDM") return "jpg";
  if (output === "광고" || group === "페이드" || group === "광고") return "png 또는 mp4";
  if (group === "오가닉" || group === "얼리버드 오가닉") {
    return output === "트레일러 썸네일" ? "jpg" : "png";
  }
  return "-";
}

function makeId(item) {
  return [
    item.site,
    item.language,
    item.courseType,
    item.courseFormat,
    item.localizationType,
    item.sourceColumn,
  ]
    .join("_")
    .replace(/\s+/g, "");
}

function loadOverrides() {
  const saved = localStorage.getItem(overrideStorageKey);
  if (!saved) return {};

  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? normalizeOverridesMap(parsed) : {};
  } catch {
    return {};
  }
}

function applyOverrides(baseItems) {
  return baseItems.map((item) => {
    const override = normalizeOverride(getItemOverride(item) || {});
    return {
      ...item,
      ...override,
    };
  });
}

function normalizeOverridesMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([id, override]) => [id, normalizeOverride(override)])
  );
}

function normalizeOverride(override) {
  if (!override || typeof override !== "object") return {};

  const normalized = { ...override };
  if (Object.prototype.hasOwnProperty.call(normalized, "size")) {
    normalized.size = normalizeSizeValue(normalized.size);
  }
  return normalized;
}

function getItemOverride(item) {
  if (overrides[item.id]) return overrides[item.id];
  if (item.courseFormat !== "에셋") return null;

  const legacyId = makeId({
    ...item,
    courseFormat: "에셋 유형",
  });
  return overrides[legacyId] || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fillSelect(select, values, includeAll = values.length > 1) {
  const current = select.value;
  const options = includeAll ? ["전체", ...values] : values;

  select.innerHTML = options
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");

  if (options.includes(current)) {
    select.value = current;
  }
}

function renderSiteOptions() {
  fillSelect(els.siteFilter, unique(siteLanguageOptions.map((item) => item.site)), false);
}

function renderGuideLinks() {
  els.guideLinkList.innerHTML = guideLinks
    .map((link) => {
      if (!link.url) {
        return `<span class="guide-link is-disabled" aria-disabled="true">${escapeHtml(link.label)}</span>`;
      }

      return `<a class="guide-link" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`;
    })
    .join("");
}

function renderLanguageOptions() {
  const site = els.siteFilter.value;
  fillSelect(
    els.languageFilter,
    unique(
      siteLanguageOptions
        .filter((item) => site === "전체" || item.site === site)
        .map((item) => item.language)
    ),
    false
  );
  syncLanguageVisibility();
}

function renderFormatOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  const useLocalizationType = isLocalizationTypeActive();
  fillSelect(
    els.phaseFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (els.courseTypeFilter.value === "전체" ||
              item.courseType === els.courseTypeFilter.value) &&
            (els.courseFormatFilter.value === "전체" ||
              item.courseFormat === els.courseFormatFilter.value) &&
            (!useLocalizationType ||
              els.localizationTypeFilter.value === "전체" ||
              item.localizationType === els.localizationTypeFilter.value)
        )
        .map((item) => item.phase)
    )
  );
}

function renderCourseTypeOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  fillSelect(
    els.courseTypeFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language)
        )
        .map((item) => item.courseType)
    ),
    false
  );
}

function renderCourseFormatOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  const courseType = els.courseTypeFilter.value;
  const localizationType = els.localizationTypeFilter.value;
  const useLocalizationType = isLocalizationTypeActive();
  fillSelect(
    els.courseFormatFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (courseType === "전체" || item.courseType === courseType) &&
            (!useLocalizationType ||
              localizationType === "전체" ||
              item.localizationType === localizationType)
        )
        .map((item) => item.courseFormat)
    ),
    false
  );
}

function renderLocalizationTypeOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  const courseType = els.courseTypeFilter.value;

  if (!isLocalizationTypeActive()) {
    fillSelect(els.localizationTypeFilter, ["전체"]);
    syncLocalizationTypeVisibility();
    return;
  }

  fillSelect(
    els.localizationTypeFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (courseType === "전체" || item.courseType === courseType)
        )
        .map((item) => item.localizationType)
    ),
    false
  );
  syncLocalizationTypeVisibility();
}

function getSelectedItems() {
  return dedupeItems(getFilteredItems().filter(isVisible));
}

function getFilteredItems() {
  const useLocalizationType = isLocalizationTypeActive();
  return items.filter(
    (item) =>
      (els.siteFilter.value === "전체" || item.site === els.siteFilter.value) &&
      (els.languageFilter.value === "전체" || item.language === els.languageFilter.value) &&
      (els.courseTypeFilter.value === "전체" || item.courseType === els.courseTypeFilter.value) &&
      (els.courseFormatFilter.value === "전체" ||
        item.courseFormat === els.courseFormatFilter.value) &&
      (!useLocalizationType ||
        els.localizationTypeFilter.value === "전체" ||
        item.localizationType === els.localizationTypeFilter.value) &&
      (els.phaseFilter.value === "전체" || item.phase === els.phaseFilter.value)
  );
}

function dedupeItems(source) {
  const seen = new Set();
  return source.filter((item) => {
    const key = [
      item.site,
      item.language,
      item.courseType,
      item.courseFormat,
      item.localizationType,
      item.phase,
      item.group,
      item.output,
      item.size,
      item.fileExtension,
      item.workIncluded,
      item.typeFit,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isVisible(item) {
  return !isNo(item.workIncluded) && !isNo(item.typeFit);
}

function isNo(value) {
  return ["N", "NO", "X", "FALSE", "0", "불필요", "미노출"].includes(
    String(value || "").trim().toUpperCase()
  );
}

function renderList() {
  const scopeParts = [
    els.siteFilter.value,
    ...(isLanguageFilterActive() ? [els.languageFilter.value] : []),
    els.courseTypeFilter.value,
    ...(isLocalizationTypeActive() ? [els.localizationTypeFilter.value] : []),
    els.courseFormatFilter.value,
    els.phaseFilter.value,
  ];
  els.selectedScope.textContent = scopeParts.join(" · ");

  if (isKrDubbingDiscussionScope()) {
    els.taskCount.textContent = "논의 필요";
    els.taskList.innerHTML = `
      <div class="discussion-state">
        <strong>추후 논의 필요</strong>
        <span>KR 현지화 더빙 업무 항목은 추후 확정 후 업데이트됩니다.</span>
      </div>
    `;
    return;
  }

  const selectedItems = getSelectedItems();
  els.taskCount.textContent = `${selectedItems.length}개`;

  if (!selectedItems.length) {
    els.taskList.innerHTML = `<div class="empty-state">등록된 업무 구조가 없습니다</div>`;
    return;
  }

  els.taskList.innerHTML = renderTimelineCards(selectedItems);
}

function isKrDubbingDiscussionScope() {
  return (
    els.siteFilter.value === "KR" &&
    els.courseTypeFilter.value === "현지화" &&
    els.localizationTypeFilter.value === "더빙"
  );
}

function renderTimelineCards(selectedItems) {
  const phaseEntries = [...groupBy(selectedItems, (item) => item.phase).entries()];

  return `
    <div class="timeline-dashboard">
      ${phaseEntries
        .map(([phase, phaseItems]) => renderTimelinePhase(phase, phaseItems))
        .join("")}
    </div>
  `;
}

function renderTimelinePhase(phase, phaseItems) {
  const groupEntries = [...groupBy(phaseItems, (item) => item.group || "-").entries()].sort(
    compareGroupEntries
  );
  const outputCount = groupEntries.reduce(
    (total, [, groupItems]) => total + buildTimelineOutputRows(groupItems).length,
    0
  );

  return `
    <section class="timeline-phase" style="${toneStyle(getPhaseTone(phase), "phase")}">
      <header class="timeline-phase-header">
        <h3 class="timeline-phase-title">${escapeHtml(phase)}</h3>
        <span>${outputCount}개 산출물</span>
      </header>
      <div class="timeline-group-grid">
        ${groupEntries
          .map(([groupName, groupItems]) => renderTimelineGroup(groupName, groupItems))
          .join("")}
      </div>
    </section>
  `;
}

function renderTimelineGroup(groupName, groupItems) {
  const outputRows = buildTimelineOutputRows(groupItems);

  return `
    <section class="timeline-group" style="${toneStyle(getGroupTone(groupName), "group")}">
      <header class="timeline-group-header">
        <h4>${escapeHtml(groupName || "-")}</h4>
        <span>${outputRows.length}개</span>
      </header>
      <div class="timeline-output-list">
        ${outputRows.map(renderTimelineOutput).join("")}
      </div>
    </section>
  `;
}

function buildTimelineOutputRows(source) {
  const rows = new Map();

  source.forEach((item) => {
    const key = [
      item.site,
      item.language,
      item.courseType,
      item.courseFormat,
      item.localizationType,
      item.output,
    ].join("|");

    if (!rows.has(key)) {
      rows.set(key, {
        output: item.output,
        variants: [],
        extensions: [],
      });
    }

    const row = rows.get(key);
    getSizeTags(item.size).forEach((size) => {
      if (!row.variants.includes(size)) row.variants.push(size);
    });

    getExtensionTags(item.fileExtension).forEach((extension) => {
      if (!row.extensions.includes(extension)) row.extensions.push(extension);
    });
  });

  return [...rows.values()];
}

function getExtensionTags(fileExtension) {
  const value = String(fileExtension || "").trim();
  if (!value || value === "-") return [];

  return value
    .split(/\s*또는\s*|,\s*|\/\s*/)
    .map((extension) => extension.trim())
    .filter(Boolean);
}

function getSizeTags(size) {
  const value = normalizeSizeValue(size);
  if (!value || value === "-") return [];

  return value
    .split(/,\s*/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function renderTimelineOutput(row) {
  return `
    <article class="timeline-output-row">
      <div class="timeline-output-main">
        <strong>${escapeHtml(row.output)}</strong>
        ${row.variants.length ? renderTimelineTags(row.variants) : ""}
      </div>
      ${row.extensions.length ? renderTimelineExtension(row.extensions) : ""}
    </article>
  `;
}

function renderTimelineExtension(extensions) {
  return `<span class="timeline-extension-note">확장자 : ${escapeHtml(extensions.join(", "))}</span>`;
}

function renderTimelineTags(tags) {
  return `
    <div class="timeline-variant-list">
      ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function getPhaseTone(phase) {
  const tones = {
    얼리버드: {
      color: "#e7ddff",
      border: "#cbb8ff",
      ink: "#7055aa",
    },
    "상세페이지 오픈": {
      color: "#ffe2f1",
      border: "#f3bfdc",
      ink: "#a95f88",
    },
    영상공개: {
      color: "#e1ebff",
      border: "#bdceff",
      ink: "#5c73ad",
    },
  };
  return tones[phase] || { color: "#ece8ff", border: "#cbb8ff", ink: "#7055aa" };
}

function getGroupTone(group) {
  const tones = {
    온사이트: {
      color: "#5c73ad",
      border: "#bdceff",
      bg: "#f4f7ff",
    },
    사이트: {
      color: "#5c73ad",
      border: "#bdceff",
      bg: "#f4f7ff",
    },
    오가닉: {
      color: "#a95f88",
      border: "#f3bfdc",
      bg: "#fff6fb",
    },
  };
  return tones[group] || { color: "#7055aa", border: "#cbb8ff", bg: "#f8f5ff" };
}

function toneStyle(tone, type) {
  if (type === "phase") {
    return `--timeline-phase-bg: ${tone.color}; --timeline-phase-border: ${tone.border}; --timeline-phase-ink: ${tone.ink};`;
  }

  return `--timeline-group-color: ${tone.color}; --timeline-group-border: ${tone.border}; --timeline-group-bg: ${tone.bg};`;
}

function compareGroupEntries([groupA], [groupB]) {
  return getGroupRank(groupA) - getGroupRank(groupB);
}

function getGroupRank(group) {
  if (group === "온사이트" || group === "사이트") return 0;
  if (group === "오가닉" || group === "얼리버드 오가닉") return 1;
  return 2;
}

function renderDashboardTable(selectedItems) {
  const showLocalizationType = isLocalizationTypeActive();
  return `
    <div class="table-wrap compact">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>런칭 타임라인</th>
            <th>구분</th>
            <th>업무내용</th>
            ${showLocalizationType ? "<th>현지화 유형</th>" : ""}
            <th>코스 포맷</th>
            <th>규격</th>
            <th>파일 확장자</th>
          </tr>
        </thead>
        <tbody>
          ${selectedItems
            .map(
              (item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(item.phase)}</td>
                  <td>${escapeHtml(item.group || "-")}</td>
                  <td class="primary-cell">${escapeHtml(item.output)}</td>
                  ${showLocalizationType ? `<td>${escapeHtml(item.localizationType || "-")}</td>` : ""}
                  <td>${escapeHtml(item.courseFormat)}</td>
                  <td>${escapeHtml(item.size || "-")}</td>
                  <td>${escapeHtml(item.fileExtension || "-")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderManagementTable() {
  const managedItems = getFilteredItems();
  const showLocalizationType = isLocalizationTypeActive();
  els.managementCount.textContent = `${managedItems.length}개`;
  renderManagementHeader(showLocalizationType);

  if (!managedItems.length) {
    const columnCount = showLocalizationType ? 14 : 13;
    els.managementTableBody.innerHTML = `<tr><td colspan="${columnCount}" class="empty-state">편집할 업무 항목이 없습니다</td></tr>`;
    return;
  }

  els.managementTableBody.innerHTML = managedItems
    .map(
      (item, index) => `
        <tr class="${isVisible(item) ? "" : "is-hidden-row"}">
          <td>${index + 1}</td>
          <td>${escapeHtml(item.site)}</td>
          <td>${escapeHtml(item.language)}</td>
          <td>${escapeHtml(item.courseType)}</td>
          ${showLocalizationType ? `<td>${escapeHtml(item.localizationType || "-")}</td>` : ""}
          <td>${escapeHtml(item.courseFormat)}</td>
          <td>${escapeHtml(item.phase)}</td>
          <td>${escapeHtml(item.group || "-")}</td>
          <td class="primary-cell">${escapeHtml(item.output)}</td>
          <td>
            <input
              class="table-input"
              data-id="${escapeHtml(item.id)}"
              data-field="size"
              value="${escapeHtml(item.size || "")}"
            />
          </td>
          <td>
            <input
              class="table-input"
              data-id="${escapeHtml(item.id)}"
              data-field="fileExtension"
              value="${escapeHtml(item.fileExtension || "")}"
            />
          </td>
          <td>${renderEditableSelect(item, "workIncluded")}</td>
          <td>${renderEditableSelect(item, "typeFit")}</td>
          <td>
            <input
              class="table-input memo-input"
              data-id="${escapeHtml(item.id)}"
              data-field="memo"
              placeholder="수정 확인 메모"
              value="${escapeHtml(item.memo || "")}"
            />
          </td>
        </tr>
      `
    )
    .join("");
}

function renderManagementHeader(showLocalizationType) {
  els.managementTableHead.innerHTML = `
    <tr>
      <th>번호</th>
      <th>사이트</th>
      <th>언어</th>
      <th>코스 유형</th>
      ${showLocalizationType ? "<th>현지화 유형</th>" : ""}
      <th>코스 포맷</th>
      <th>런칭 타임라인</th>
      <th>구분</th>
      <th>업무내용</th>
      <th>규격</th>
      <th>파일 확장자</th>
      <th>업무유무</th>
      <th>유형적합여부</th>
      <th>메모</th>
    </tr>
  `;
}

function renderEditableSelect(item, field) {
  const value = normalizeCheckValue(item[field] || "O");
  return `
    <select class="table-select" data-id="${escapeHtml(item.id)}" data-field="${field}">
      ${["O", "X"]
        .map(
          (option) =>
            `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`
        )
        .join("")}
    </select>
  `;
}

function updateItem(id, field, value) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  const normalizedValue = field === "size" ? normalizeSizeValue(value) : value;
  overrides[id] = {
    ...(overrides[id] || {}),
    [field]: ["size", "fileExtension", "memo"].includes(field)
      ? normalizedValue
      : normalizeCheckValue(value),
  };
  items = applyOverrides(buildItems(sourceRows));
  renderList();
  renderManagementTable();
  setSaveState("dirty");
}

function updateTextField(id, field, value) {
  if (!["size", "fileExtension", "memo"].includes(field)) return;

  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  const normalizedValue = field === "size" ? normalizeSizeValue(value) : value;
  item[field] = normalizedValue;
  overrides[id] = {
    ...(overrides[id] || {}),
    [field]: normalizedValue,
  };

  if (field === "size" || field === "fileExtension") renderList();
  setSaveState("dirty");
}

function exportCsv() {
  const csv = [
    csvColumns.map((column) => column.label).join(","),
    ...items.map((item) =>
      csvColumns.map((column) => csvEscape(item[column.key] || "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "coloso-design-output-checks.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result || ""));
    const headers = rows.shift() || [];
    const normalizedHeaders = headers.map((header) => headerMap.get(header.trim()) || "");
    const nextOverrides = {};

    rows.forEach((row) => {
      const record = {};
      normalizedHeaders.forEach((key, index) => {
        if (key) record[key] = row[index] || "";
      });

      if (!record.id) return;

      nextOverrides[record.id] = {
        size: normalizeSizeValue(record.size || ""),
        ...(Object.prototype.hasOwnProperty.call(record, "fileExtension")
          ? { fileExtension: record.fileExtension || "" }
          : {}),
        memo: record.memo || "",
        workIncluded: normalizeCheckValue(record.workIncluded || "O"),
        typeFit: normalizeCheckValue(record.typeFit || "O"),
      };
    });

    overrides = nextOverrides;
    items = applyOverrides(buildItems(sourceRows));
    renderAll();
    setSaveState("dirty");
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim()));
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeCheckValue(value) {
  return isNo(value) ? "X" : "O";
}

function setSaveState(state) {
  els.saveBtn.classList.remove("is-dirty", "is-saved");

  if (state === "dirty") {
    hasUnsavedChanges = true;
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "저장";
    els.saveBtn.classList.add("is-dirty");
    return;
  }

  if (state === "saved") {
    hasUnsavedChanges = false;
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "저장됨";
    els.saveBtn.classList.add("is-saved");
    return;
  }

  hasUnsavedChanges = false;
  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "저장";
}

function createSyncClient() {
  const config = window.COLOSO_DB_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!window.supabase || !window.supabase.createClient) return null;

  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function setSyncStatus(state, text) {
  els.syncStatus.className = `sync-status is-${state}`;
  els.syncStatus.textContent = text;
}

async function initSharedSync() {
  syncClient = createSyncClient();

  if (!syncClient) {
    setSyncStatus("local", "로컬 저장");
    return;
  }

  setSyncStatus("syncing", "DB 연결 중");

  try {
    const remoteOverrides = await fetchRemoteOverrides();
    const hasRemoteOverrides = Object.keys(remoteOverrides).length > 0;
    const hasLocalOverrides = Object.keys(overrides).length > 0;

    if (!hasRemoteOverrides && hasLocalOverrides) {
      setSyncStatus("syncing", "DB 저장 필요");
      setSaveState("dirty");
      subscribeRemoteOverrides();
      return;
    }

    overrides = remoteOverrides;
    localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
    items = applyOverrides(buildItems(sourceRows));
    renderAll();
    setSaveState("clean");
    setSyncStatus(
      isFileExtensionColumnMissing ? "error" : "online",
      isFileExtensionColumnMissing ? "DB 컬럼 업데이트 필요" : "DB 연동"
    );
    subscribeRemoteOverrides();
  } catch (error) {
    console.error(error);
    setSyncStatus("error", "DB 연결 실패");
  }
}

async function fetchRemoteOverrides() {
  try {
    const rows = await fetchAllRemoteOverrideRows(remoteOverrideColumns);
    isFileExtensionColumnMissing = false;
    return rowsToOverrides(rows);
  } catch (error) {
    if (!isMissingFileExtensionColumnError(error)) throw error;
    isFileExtensionColumnMissing = true;
    const rows = await fetchAllRemoteOverrideRows(remoteOverrideFallbackColumns);
    return rowsToOverrides(rows);
  }
}

function isMissingFileExtensionColumnError(error) {
  return error.code === "42703" || String(error.message || "").includes("file_extension");
}

async function fetchAllRemoteOverrideRows(columns) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await syncClient
      .from(dbTableName)
      .select(columns)
      .range(from, from + remoteOverridePageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));

    if (!data || data.length < remoteOverridePageSize) break;
    from += remoteOverridePageSize;
  }

  return rows;
}

function rowsToOverrides(rows) {
  return Object.fromEntries(rows.map((row) => [row.id, rowToOverride(row)]));
}

function rowToOverride(row) {
  const override = {
    size: normalizeSizeValue(row.size || ""),
    memo: row.memo || "",
    workIncluded: normalizeCheckValue(row.work_included || "O"),
    typeFit: normalizeCheckValue(row.type_fit || "O"),
  };

  if (Object.prototype.hasOwnProperty.call(row, "file_extension")) {
    override.fileExtension = row.file_extension || "";
  }

  return override;
}

function overrideToRow(id, override) {
  return {
    id,
    size: normalizeSizeValue(override.size || ""),
    file_extension: override.fileExtension || "",
    memo: override.memo || "",
    work_included: normalizeCheckValue(override.workIncluded || "O"),
    type_fit: normalizeCheckValue(override.typeFit || "O"),
    updated_at: new Date().toISOString(),
  };
}

function subscribeRemoteOverrides() {
  if (syncChannel) return;

  syncChannel = syncClient
    .channel("marketing-output-overrides")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: dbTableName },
      handleRemoteOverrideChange
    )
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      setSyncStatus(
        isFileExtensionColumnMissing ? "error" : "online",
        isFileExtensionColumnMissing ? "DB 컬럼 업데이트 필요" : "DB 실시간 연동"
      );
    });
}

function handleRemoteOverrideChange(payload) {
  if (hasUnsavedChanges) {
    setSyncStatus("syncing", "원격 변경 대기");
    return;
  }

  if (payload.eventType === "DELETE" && payload.old && payload.old.id) {
    delete overrides[payload.old.id];
  } else if (payload.new && payload.new.id) {
    overrides[payload.new.id] = rowToOverride(payload.new);
  }

  localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
  items = applyOverrides(buildItems(sourceRows));
  renderAll();
  setSaveState("clean");
  setSyncStatus(
    isFileExtensionColumnMissing ? "error" : "online",
    isFileExtensionColumnMissing ? "DB 컬럼 업데이트 필요" : "DB 동기화됨"
  );
}

async function persistOverrides() {
  localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));

  if (!syncClient) {
    setSaveState("saved");
    return true;
  }

  if (!isEditAuthorized || !editPasscode) {
    requireEditAuthorization(() => els.saveBtn.click());
    return false;
  }

  const rows = Object.entries(overrides).map(([id, override]) => overrideToRow(id, override));
  setSyncStatus("syncing", "DB 저장 중");

  if (!rows.length) {
    setSaveState("saved");
    setSyncStatus(
      isFileExtensionColumnMissing ? "error" : "online",
      isFileExtensionColumnMissing ? "DB 컬럼 업데이트 필요" : "DB 연동"
    );
    return true;
  }

  const { error } = await syncClient.rpc("save_marketing_output_overrides", {
    p_passcode: editPasscode,
    p_rows: rows,
  });

  if (error) {
    console.error(error);
    if (String(error.message || "").includes("invalid_edit_passcode")) {
      clearEditAuthorization();
      openEditAuthModal();
    }
    setSyncStatus("error", "DB 저장 실패");
    return false;
  }

  if (isFileExtensionColumnMissing) {
    setSyncStatus("error", "DB 컬럼 업데이트 필요");
    return false;
  }

  const isVerified = await verifyRemotePersisted(overrides);
  if (!isVerified) {
    setSyncStatus("error", "DB 함수 업데이트 필요");
    return false;
  }

  setSaveState("saved");
  setSyncStatus("online", "DB 저장됨");
  return true;
}

async function verifyRemotePersisted(expectedOverrides) {
  try {
    const remoteOverrides = await fetchRemoteOverrides();
    if (isFileExtensionColumnMissing) return false;

    const hasMismatch = Object.entries(expectedOverrides).some(([id, expected]) => {
      const actual = remoteOverrides[id] || {};
      return ["size", "fileExtension", "memo", "workIncluded", "typeFit"].some((field) => {
        if (!Object.prototype.hasOwnProperty.call(expected, field)) return false;
        const expectedValue =
          field === "workIncluded" || field === "typeFit"
            ? normalizeCheckValue(expected[field] || "O")
            : String(expected[field] || "");
        const actualValue =
          field === "workIncluded" || field === "typeFit"
            ? normalizeCheckValue(actual[field] || "O")
            : String(actual[field] || "");
        return expectedValue !== actualValue;
      });
    });

    if (hasMismatch) return false;

    overrides = remoteOverrides;
    localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
    items = applyOverrides(buildItems(sourceRows));
    renderAll();
    return true;
  } catch (error) {
    console.error(error);
    setSyncStatus("error", "DB 저장 확인 실패");
    return false;
  }
}

function switchView(viewName) {
  els.tabButtons.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewName);
  });
  els.viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === viewName);
  });
}

function requireEditAuthorization(action) {
  if (isEditAuthorized) {
    action();
    return true;
  }

  pendingAuthorizedAction = action;
  openEditAuthModal();
  return false;
}

function openEditAuthModal() {
  els.editAuthError.textContent = "";
  els.editPasscodeInput.value = "";
  els.editAuthModal.hidden = false;
  window.setTimeout(() => els.editPasscodeInput.focus(), 0);
}

function closeEditAuthModal() {
  els.editAuthModal.hidden = true;
  els.editAuthError.textContent = "";
  els.confirmEditAuthBtn.disabled = false;
  els.confirmEditAuthBtn.textContent = "확인";
}

function clearEditAuthorization() {
  isEditAuthorized = false;
  editPasscode = "";
}

async function confirmEditAuthorization() {
  const passcode = els.editPasscodeInput.value.trim();

  if (!passcode) {
    els.editAuthError.textContent = "인증번호를 입력해주세요.";
    return;
  }

  if (!syncClient) {
    els.editAuthError.textContent = "DB 연결 후 편집 인증을 사용할 수 있습니다.";
    return;
  }

  els.confirmEditAuthBtn.disabled = true;
  els.confirmEditAuthBtn.textContent = "확인 중";

  const { data, error } = await syncClient.rpc("verify_marketing_output_passcode", {
    p_passcode: passcode,
  });

  if (error || data !== true) {
    els.editAuthError.textContent = "인증번호가 맞지 않습니다.";
    els.confirmEditAuthBtn.disabled = false;
    els.confirmEditAuthBtn.textContent = "확인";
    return;
  }

  isEditAuthorized = true;
  editPasscode = passcode;
  closeEditAuthModal();

  const action = pendingAuthorizedAction;
  pendingAuthorizedAction = null;
  if (action) action();
}

function isLocalizationTypeActive() {
  return els.courseTypeFilter.value === "현지화";
}

function isLanguageFilterActive() {
  return els.siteFilter.value === "GL";
}

function syncLanguageVisibility() {
  const show = isLanguageFilterActive();
  els.languageControl.classList.toggle("is-hidden", !show);
  els.languageControl.setAttribute("aria-hidden", String(!show));
  els.languageFilter.disabled = !show;
}

function syncLocalizationTypeVisibility() {
  const show = isLocalizationTypeActive();
  if (!show) {
    els.localizationTypeFilter.value = "전체";
    els.localizationTypeFilter.blur();
  }
  els.localizationTypeControl.classList.toggle("is-hidden", !show);
  els.localizationTypeControl.setAttribute("aria-hidden", String(!show));
  els.localizationTypeFilter.disabled = !show;
}

function groupBy(source, keyGetter) {
  const groups = new Map();
  source.forEach((item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function renderAll() {
  renderGuideLinks();
  renderSiteOptions();
  renderLanguageOptions();
  renderCourseTypeOptions();
  renderLocalizationTypeOptions();
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

els.siteFilter.addEventListener("change", () => {
  renderLanguageOptions();
  renderCourseTypeOptions();
  renderLocalizationTypeOptions();
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.languageFilter.addEventListener("change", () => {
  renderCourseTypeOptions();
  renderLocalizationTypeOptions();
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.courseTypeFilter.addEventListener("change", () => {
  renderLocalizationTypeOptions();
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.localizationTypeFilter.addEventListener("change", () => {
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.courseFormatFilter.addEventListener("change", () => {
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.phaseFilter.addEventListener("change", renderList);
els.phaseFilter.addEventListener("change", renderManagementTable);
els.exportCsvBtn.addEventListener("click", exportCsv);
els.importCsvBtn.addEventListener("click", () => {
  requireEditAuthorization(() => els.csvFileInput.click());
});
els.csvFileInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) {
    requireEditAuthorization(() => importCsv(file));
  }
  event.target.value = "";
});
els.managementTableBody.addEventListener("change", (event) => {
  if (!isEditAuthorized) return;
  const target = event.target;
  if (!target.matches("[data-id][data-field]")) return;
  if (target.matches(".table-input")) return;
  updateItem(target.dataset.id, target.dataset.field, target.value);
});
els.managementTableBody.addEventListener("input", (event) => {
  if (!isEditAuthorized) return;
  const target = event.target;
  if (!target.matches(".table-input[data-id][data-field]")) return;
  updateTextField(target.dataset.id, target.dataset.field, target.value);
});
els.saveBtn.addEventListener("click", async () => {
  if (!hasUnsavedChanges) return;
  const isSaved = await persistOverrides();
  if (!isSaved) return;

  window.setTimeout(() => {
    setSaveState("clean");
    if (syncClient) setSyncStatus("online", "DB 실시간 연동");
  }, 1200);
});
els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "maintenance") {
      requireEditAuthorization(() => switchView("maintenance"));
      return;
    }

    switchView(button.dataset.view);
  });
});
els.cancelEditAuthBtn.addEventListener("click", () => {
  pendingAuthorizedAction = null;
  closeEditAuthModal();
});
els.confirmEditAuthBtn.addEventListener("click", confirmEditAuthorization);
els.editPasscodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmEditAuthorization();
  if (event.key === "Escape") {
    pendingAuthorizedAction = null;
    closeEditAuthModal();
  }
});

renderAll();
setSaveState("clean");
initSharedSync();
