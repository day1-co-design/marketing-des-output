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
const courseFormatOptions = ["코스", "시그니처", "딕셔너리", "에셋", "클래스", "클래스 +", "프로젝트", "신규"];
const localizationTypeOptions = ["폐강옵션", "정규", "더빙", "확장"];
const overrideStorageKey = "colosoDesignOutputChecks";
const dbTableName = "marketing_output_overrides";
const remoteOverrideColumns = "id,size,file_extension,request_owner,work_owner,memo,work_included,type_fit";
const remoteOverrideFallbackColumns = "id,size,file_extension,memo,work_included,type_fit";
const remoteOverrideLegacyColumns = "id,size,memo,work_included,type_fit";
const remoteOverridePageSize = 1000;

const statusOptions = [
  { value: "전체", label: "전체" },
  { value: "same", label: "완전 동일" },
  { value: "attribute", label: "작업주체 차이" },
  { value: "different", label: "업무 차이" },
  { value: "insufficient", label: "국가별 업무 확인 추가 필요" },
  { value: "excluded", label: "논의 제외" },
];

const statusMeta = {
  same: { label: "완전 동일", className: "is-same" },
  attribute: { label: "작업주체 차이", className: "is-attribute" },
  different: { label: "업무 차이", className: "is-different" },
  insufficient: { label: "국가별 업무 확인 추가 필요", className: "is-insufficient" },
  excluded: { label: "논의 제외", className: "is-excluded" },
};

const els = {
  syncStatus: document.getElementById("syncStatus"),
  courseTypeFilter: document.getElementById("courseTypeFilter"),
  localizationTypeFilter: document.getElementById("localizationTypeFilter"),
  courseFormatFilter: document.getElementById("courseFormatFilter"),
  statusFilter: document.getElementById("statusFilter"),
  summaryGrid: document.getElementById("summaryGrid"),
  overviewCount: document.getElementById("overviewCount"),
  allTaskCount: document.getElementById("allTaskCount"),
  allTaskTableHead: document.getElementById("allTaskTableHead"),
  allTaskTableBody: document.getElementById("allTaskTableBody"),
  commonTaskCount: document.getElementById("commonTaskCount"),
  differentTaskCount: document.getElementById("differentTaskCount"),
  exceptionCount: document.getElementById("exceptionCount"),
  commonTaskList: document.getElementById("commonTaskList"),
  differentTaskList: document.getElementById("differentTaskList"),
  exceptionList: document.getElementById("exceptionList"),
  patternTableHead: document.getElementById("patternTableHead"),
  patternTableBody: document.getElementById("patternTableBody"),
  countryFormatTableHead: document.getElementById("countryFormatTableHead"),
  countryFormatTableBody: document.getElementById("countryFormatTableBody"),
  readyCount: document.getElementById("readyCount"),
  attributeCount: document.getElementById("attributeCount"),
  differentCount: document.getElementById("differentCount"),
  readyList: document.getElementById("readyList"),
  attributeList: document.getElementById("attributeList"),
  differentList: document.getElementById("differentList"),
  caseCount: document.getElementById("caseCount"),
  caseTableBody: document.getElementById("caseTableBody"),
  detailTitle: document.getElementById("detailTitle"),
  detailStatus: document.getElementById("detailStatus"),
  detailBody: document.getElementById("detailBody"),
};

let overrides = loadOverrides();
let items = applyOverrides(buildItems(sourceRows));
let syncClient = null;
let isFileExtensionColumnMissing = false;
let selectedCaseKey = "";

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
      const localizationTypes = getLocalizationTypes(option.site, option.language, courseType);

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
  if (item.phase === "영상공개" && item.group === "페이드" && item.output === "광고") {
    return false;
  }
  return true;
}

function getLocalizationTypes(site, language, courseType) {
  if (courseType !== "현지화") return ["-"];
  if (["KR", "JP"].includes(site)) {
    return localizationTypeOptions.filter((type) => type !== "확장");
  }
  if (site === "GL" && language === "EN") {
    return localizationTypeOptions.filter((type) => type !== "확장");
  }
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
    {
      sourceColumn: "earlybird_close_organic",
      phase: "얼리버드 마감",
      group: "오가닉",
      output: "얼리버드 마감 오가닉",
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
    requestOwner: item.requestOwner || "",
    workOwner: item.workOwner || getDefaultWorkOwner(item),
    memo: item.memo || "",
    workIncluded: item.workIncluded || getDefaultWorkIncluded(item),
    typeFit: item.typeFit || "O",
  };
}

function getDefaultWorkIncluded(item) {
  if (isEarlybirdCloseOrganic(item)) {
    return isEarlybirdCloseOrganicTarget(item) ? "O" : "X";
  }

  if (item.group === "오가닉" && item.output === "연사용 스토리") {
    return item.phase === "얼리버드" ? "O" : "X";
  }
  return "O";
}

function getDefaultWorkOwner(item) {
  if (isEarlybirdCloseOrganicTarget(item)) {
    return "마케터";
  }

  if (item.site === "KR" && item.group === "페이드" && item.output === "광고") {
    return "마케터";
  }
  return "";
}

function isEarlybirdCloseOrganic(item) {
  return item.sourceColumn === "earlybird_close_organic";
}

function isEarlybirdCloseOrganicTarget(item) {
  return (
    isEarlybirdCloseOrganic(item) &&
    item.site === "KR" &&
    (item.courseType === "오리지널" ||
      (item.courseType === "현지화" && item.localizationType === "정규"))
  );
}

function getFileExtension() {
  return "";
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
    const merged = {
      ...item,
      ...override,
    };
    return {
      ...merged,
      workOwner: merged.workOwner || getDefaultWorkOwner(merged),
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

function buildCaseDefinitions() {
  return courseTypes.flatMap((courseType) => {
    const localizationTypes = courseType === "현지화" ? localizationTypeOptions : ["-"];
    return localizationTypes.flatMap((localizationType) =>
      courseFormatOptions.map((courseFormat) => ({
        key: [courseType, localizationType, courseFormat].join("|"),
        courseType,
        localizationType,
        courseFormat,
      }))
    );
  });
}

function buildCaseAnalyses() {
  return buildCaseDefinitions().map((definition) => analyzeCase(definition)).sort(compareAnalyses);
}

function analyzeCase(definition) {
  const scopes = siteLanguageOptions.map((scope) => buildScopeAnalysis(scope, definition));
  const availableScopes = scopes.filter((scope) => scope.state === "available");
  const discussionScopes = scopes.filter((scope) => scope.state === "discussion");
  const taskUnion = buildTaskUnion(availableScopes);
  const structuralDiffs = [];
  const attributeDiffs = [];
  const commonRecords = [];

  taskUnion.forEach((entry) => {
    const presentScopes = availableScopes.filter((scope) => scope.recordMap.has(entry.key));
    const missingScopes = availableScopes.filter((scope) => !scope.recordMap.has(entry.key));
    const attributeGroups = buildAttributeGroups(presentScopes, entry.key);

    if (missingScopes.length) {
      structuralDiffs.push({
        ...entry,
        presentScopes,
        missingScopes,
        attributeGroups,
        type: "structure",
      });
      return;
    }

    if (attributeGroups.length > 1) {
      attributeDiffs.push({
        ...entry,
        presentScopes,
        missingScopes,
        attributeGroups,
        type: "attribute",
      });
      return;
    }

    if (presentScopes.length) {
      commonRecords.push(entry.record);
    }
  });

  const detailSignatures = availableScopes.map((scope) => scope.detailSignature);
  const structureSignatures = availableScopes.map((scope) => scope.structureSignature);
  const detailSignatureCount = new Set(detailSignatures).size;
  const structureSignatureCount = new Set(structureSignatures).size;
  const counts = availableScopes.map((scope) => scope.records.length);
  const minCount = counts.length ? Math.min(...counts) : 0;
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const hasCoreCoverage = hasCoreSiteCoverage(availableScopes);
  const status = getCaseStatus({
    availableScopes,
    discussionScopes,
    hasCoreCoverage,
    detailSignatureCount,
    structureSignatureCount,
  });

  return {
    ...definition,
    status,
    scopes,
    availableScopes,
    discussionScopes,
    commonRecords,
    structuralDiffs,
    attributeDiffs,
    allDiffs: [...structuralDiffs, ...attributeDiffs],
    minCount,
    maxCount,
    hasCoreCoverage,
    availableCount: availableScopes.length,
    totalScopeCount: scopes.length,
  };
}

function buildScopeAnalysis(scope, definition) {
  const state = getScopeState(scope, definition);
  const records =
    state === "available" ? buildOutputRecords(getCaseItems(scope, definition)) : [];
  const recordMap = new Map(records.map((record) => [record.key, record]));

  return {
    ...scope,
    label: scopeLabel(scope),
    state,
    stateReason: getScopeStateReason(scope, definition, state),
    records,
    recordMap,
    structureSignature: records.map((record) => record.key).join("\n"),
    detailSignature: records.map((record) => record.signature).join("\n"),
    operationSignature: records
      .map((record) => [record.key, record.attributeKey, record.sizeKey].join("||"))
      .join("\n"),
  };
}

function getScopeState(scope, definition) {
  if (isDiscussionScope(scope, definition)) return "discussion";

  const localizationTypes = getLocalizationTypes(scope.site, scope.language, definition.courseType);
  if (!localizationTypes.includes(definition.localizationType)) return "unavailable";

  const hasItems = items.some((item) => matchesCase(item, scope, definition));
  return hasItems ? "available" : "unavailable";
}

function getScopeStateReason(scope, definition, state) {
  if (state === "available") return "";
  if (state === "discussion") {
    if (
      scope.site === "KR" &&
      definition.courseType === "현지화" &&
      definition.localizationType === "더빙"
    ) {
      return "더빙 기준 확정 전";
    }
    if (scope.site === "GL" && scope.language === "TH" && definition.courseType === "오리지널") {
      return "오리지널 미운영";
    }
    return "논의 필요";
  }
  return "대상 없음";
}

function isDiscussionScope(scope, definition) {
  return (
    (scope.site === "KR" &&
      definition.courseType === "현지화" &&
      definition.localizationType === "더빙") ||
    (scope.site === "GL" && scope.language === "TH" && definition.courseType === "오리지널")
  );
}

function getCaseItems(scope, definition) {
  return items.filter((item) => matchesCase(item, scope, definition) && isVisible(item));
}

function matchesCase(item, scope, definition) {
  return (
    item.site === scope.site &&
    item.language === scope.language &&
    item.courseType === definition.courseType &&
    item.localizationType === definition.localizationType &&
    item.courseFormat === definition.courseFormat
  );
}

function isVisible(item) {
  return !isNo(item.workIncluded) && !isNo(item.typeFit);
}

function isNo(value) {
  return ["N", "NO", "X", "FALSE", "0", "불필요", "미노출"].includes(
    String(value || "").trim().toUpperCase()
  );
}

function buildOutputRecords(caseItems) {
  const records = new Map();

  caseItems.forEach((item) => {
    const key = [item.phase, item.group || "-", item.output].join("|");
    if (!records.has(key)) {
      records.set(key, {
        key,
        phase: item.phase,
        group: item.group || "-",
        output: item.output,
        sizes: new Set(),
        extensions: new Set(),
        requestOwners: new Set(),
        workOwners: new Set(),
      });
    }

    const record = records.get(key);
    getSizeTags(item.size).forEach((size) => record.sizes.add(size));
    getExtensionTags(item.fileExtension).forEach((extension) => record.extensions.add(extension));
    if (String(item.requestOwner || "").trim()) record.requestOwners.add(item.requestOwner.trim());
    if (String(item.workOwner || "").trim()) record.workOwners.add(item.workOwner.trim());
  });

  return [...records.values()].map(finalizeRecord).sort(compareRecords);
}

function finalizeRecord(record) {
  const sizes = [...record.sizes].sort(compareText);
  const extensions = [...record.extensions].sort(compareText);
  const requestOwners = [...record.requestOwners].sort(compareText);
  const workOwners = [...record.workOwners].sort(compareText);
  const attributeKey = workOwners.join(",");
  const sizeKey = sizes.join(",");

  return {
    ...record,
    sizes,
    extensions,
    requestOwners,
    workOwners,
    attributeKey,
    sizeKey,
    signature: [record.key, attributeKey].join("||"),
  };
}

function getSizeTags(size) {
  const value = normalizeSizeValue(size);
  if (!value || value === "-") return [];

  return value
    .split(/,\s*/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getExtensionTags(fileExtension) {
  const value = String(fileExtension || "").trim();
  if (!value || value === "-") return [];

  return value
    .split(/\s*또는\s*|,\s*|\/\s*/)
    .map((extension) => extension.trim())
    .filter(Boolean);
}

function buildTaskUnion(scopes) {
  const union = new Map();
  scopes.forEach((scope) => {
    scope.records.forEach((record) => {
      if (!union.has(record.key)) {
        union.set(record.key, {
          key: record.key,
          phase: record.phase,
          group: record.group,
          output: record.output,
          record,
        });
      }
    });
  });
  return [...union.values()].sort(compareRecords);
}

function buildAttributeGroups(scopes, key) {
  const groups = new Map();

  scopes.forEach((scope) => {
    const record = scope.recordMap.get(key);
    if (!record) return;

    const label = formatWorkOwnerAttribute(record);
    if (!groups.has(label)) {
      groups.set(label, {
        label,
        scopes: [],
      });
    }
    groups.get(label).scopes.push(scope);
  });

  return [...groups.values()];
}

function getCaseStatus({
  availableScopes,
  discussionScopes,
  hasCoreCoverage,
  detailSignatureCount,
  structureSignatureCount,
}) {
  if (!availableScopes.length && discussionScopes.length) return "excluded";
  if (availableScopes.length < 2 || !hasCoreCoverage) return "insufficient";
  if (detailSignatureCount === 1) return "same";
  if (structureSignatureCount === 1) return "attribute";
  return "different";
}

function hasCoreSiteCoverage(scopes) {
  const sites = new Set(scopes.map((scope) => scope.site));
  return ["KR", "JP", "GL"].every((site) => sites.has(site));
}

function applyFilters(analyses) {
  return analyses.filter((analysis) => {
    const courseType = els.courseTypeFilter.value;
    const localizationType = els.localizationTypeFilter.value;
    const courseFormat = els.courseFormatFilter.value;
    const status = els.statusFilter.value;

    return (
      (courseType === "전체" || analysis.courseType === courseType) &&
      (localizationType === "전체" || analysis.localizationType === localizationType) &&
      (courseFormat === "전체" || analysis.courseFormat === courseFormat) &&
      (status === "전체" || analysis.status === status)
    );
  });
}

function renderDashboard() {
  const analyses = buildCaseAnalyses();
  const visibleAnalyses = applyFilters(analyses);

  if (!visibleAnalyses.some((analysis) => analysis.key === selectedCaseKey)) {
    selectedCaseKey = visibleAnalyses[0] ? visibleAnalyses[0].key : "";
  }

  renderSummary(visibleAnalyses);
  renderOverview(visibleAnalyses);
  renderDecisionPanels(visibleAnalyses);
  renderCaseTable(visibleAnalyses);
  renderDetail(visibleAnalyses.find((analysis) => analysis.key === selectedCaseKey));
}

function renderSummary(analyses) {
  const scopeCases = analyses.flatMap((analysis) => analysis.scopes);
  const operatedScopeCases = scopeCases.filter((scope) => scope.state === "available");
  const alignment = buildScopeCaseAlignment(analyses);
  const workItemCount = operatedScopeCases.reduce((total, scope) => total + scope.records.length, 0);
  const sameCount = analyses.filter((analysis) => analysis.status === "same").length;
  const attributeCount = analyses.filter((analysis) => analysis.status === "attribute").length;
  const notSameCount = analyses.filter((analysis) => analysis.status !== "same").length;
  const confirmNeededCount = analyses.filter((analysis) =>
    ["insufficient", "excluded"].includes(analysis.status)
  ).length;
  const commonizableCount = sameCount + attributeCount;

  els.summaryGrid.innerHTML = [
    renderSummaryCard("실제 운영 케이스", operatedScopeCases.length, "국가/언어별 운영 중인 케이스"),
    renderSummaryCard("전체 업무 항목", workItemCount, "디자인팀이 보는 실제 업무 항목 합계"),
    renderSummaryCard("상이 케이스", alignment.different.length, "국가/언어별 기준과 다르게 운영"),
    renderSummaryCard("동일 케이스", alignment.same.length, "현재 기준으로 공통 운영 가능"),
    renderSummaryCard("공통화 가능 안", commonizableCount, `이미 동일 ${sameCount} · 작업주체 정리 ${attributeCount}`),
  ].join("");
}

function renderSummaryCard(label, value, note) {
  return `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}

function buildScopeCaseAlignment(analyses) {
  const same = [];
  const different = [];

  analyses.forEach((analysis) => {
    const availableScopes = analysis.scopes.filter((scope) => scope.state === "available");
    if (!availableScopes.length) return;

    const baseline = getMajorityScopeSignature(availableScopes);
    availableScopes.forEach((scope) => {
      const entry = {
        analysis,
        scope,
      };
      if (!baseline || scope.operationSignature !== baseline) {
        different.push(entry);
      } else {
        same.push(entry);
      }
    });
  });

  return { same, different };
}

function getMajorityScopeSignature(scopes) {
  const counts = new Map();
  scopes.forEach((scope) => {
    counts.set(scope.operationSignature, (counts.get(scope.operationSignature) || 0) + 1);
  });

  const sorted = [...counts.entries()].sort(([, countA], [, countB]) => countB - countA);
  if (!sorted.length) return "";
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return "";
  return sorted[0][0];
}

function renderOverview(analyses) {
  const operatedAnalyses = analyses.filter((analysis) => analysis.availableCount > 0);
  const comparableAnalyses = analyses.filter((analysis) => analysis.hasCoreCoverage);
  const allTaskStats = buildTaskStats(operatedAnalyses).sort(compareAllTaskStats);
  const taskOverviewRows = buildTaskOverviewRows(operatedAnalyses);
  const taskStats = buildTaskStats(comparableAnalyses);
  const commonTasks = taskStats
    .filter((stat) => stat.commonStructureCases > 0)
    .sort(compareCommonTaskStats);
  const differentTasks = taskStats
    .filter((stat) => stat.differenceCases > 0)
    .sort(compareDifferentTaskStats);
  const exceptions = buildOperationExceptions(analyses);

  els.overviewCount.textContent = `${allTaskStats.length}개 업무`;
  els.allTaskCount.textContent = `${allTaskStats.length}개`;
  els.commonTaskCount.textContent = `${commonTasks.length}개`;
  els.differentTaskCount.textContent = `${differentTasks.length}개`;
  els.exceptionCount.textContent = `${exceptions.length}개`;
  renderTaskOverviewTable(taskOverviewRows);
  els.commonTaskList.innerHTML = renderTaskStatList(commonTasks.slice(0, 12), comparableAnalyses.length, "common");
  els.differentTaskList.innerHTML = renderTaskStatList(differentTasks.slice(0, 12), comparableAnalyses.length, "different");
  els.exceptionList.innerHTML = renderExceptionList(exceptions);
  renderPatternTable(analyses);
  renderCountryFormatTable(analyses);
}

function buildTaskStats(analyses) {
  const stats = new Map();

  analyses.forEach((analysis) => {
    const commonKeys = new Set(analysis.commonRecords.map((record) => record.key));
    const attributeKeys = new Set(analysis.attributeDiffs.map((diff) => diff.key));
    const structuralKeys = new Set(analysis.structuralDiffs.map((diff) => diff.key));
    const allKeys = new Set([
      ...analysis.commonRecords.map((record) => record.key),
      ...analysis.attributeDiffs.map((diff) => diff.key),
      ...analysis.structuralDiffs.map((diff) => diff.key),
    ]);

    allKeys.forEach((key) => {
      const record = findAnalysisRecord(analysis, key);
      if (!record) return;
      if (!stats.has(key)) {
        stats.set(key, {
          key,
          phase: record.phase,
          group: record.group,
          output: record.output,
          cases: 0,
          commonStructureCases: 0,
          sameAttributeCases: 0,
          attributeDifferenceCases: 0,
          sizeDifferenceCases: 0,
          structuralDifferenceCases: 0,
          differenceCases: 0,
          examples: [],
          patterns: [],
        });
      }

      const stat = stats.get(key);
      const hasSizeDiff = hasTaskSizeDifference(analysis, key);
      stat.cases += 1;
      if (commonKeys.has(key) || attributeKeys.has(key)) stat.commonStructureCases += 1;
      if (commonKeys.has(key)) stat.sameAttributeCases += 1;
      if (attributeKeys.has(key)) stat.attributeDifferenceCases += 1;
      if (hasSizeDiff) stat.sizeDifferenceCases += 1;
      if (structuralKeys.has(key)) stat.structuralDifferenceCases += 1;
      if (attributeKeys.has(key) || structuralKeys.has(key) || hasSizeDiff) stat.differenceCases += 1;
      if (stat.examples.length < 3) stat.examples.push(caseTitle(analysis));
      if ((attributeKeys.has(key) || structuralKeys.has(key) || hasSizeDiff) && stat.patterns.length < 3) {
        const pattern = summarizeTaskOverviewDifference(analysis, key);
        if (pattern && !stat.patterns.includes(pattern)) {
          stat.patterns.push(`${caseTitle(analysis)}: ${pattern}`);
        }
      }
    });
  });

  return [...stats.values()];
}

function findAnalysisRecord(analysis, key) {
  return (
    analysis.commonRecords.find((record) => record.key === key) ||
    analysis.attributeDiffs.find((diff) => diff.key === key) ||
    analysis.structuralDiffs.find((diff) => diff.key === key)
  );
}

function summarizeTaskDifference(analysis, key) {
  const structuralDiff = analysis.structuralDiffs.find((diff) => diff.key === key);
  if (structuralDiff) {
    return `${structuralDiff.presentScopes.map((scope) => scope.label).join(", ")} 포함 / ${structuralDiff.missingScopes.map((scope) => scope.label).join(", ")} 제외`;
  }

  const attributeDiff = analysis.attributeDiffs.find((diff) => diff.key === key);
  if (!attributeDiff) return "";

  return attributeDiff.attributeGroups
    .map((group) => `${group.scopes.map((scope) => scope.label).join(", ")} ${group.label}`)
    .join(" / ");
}

function buildTaskOverviewRows(analyses) {
  const rows = new Map();

  analyses.forEach((analysis) => {
    const activeScopes = analysis.scopes.filter((scope) => scope.state === "available");
    const taskKeys = new Set(
      activeScopes.flatMap((scope) => scope.records.map((record) => record.key))
    );

    taskKeys.forEach((key) => {
      const record = findAnalysisRecord(analysis, key) || findScopeRecord(activeScopes, key);
      if (!record) return;

      if (!rows.has(key)) {
        rows.set(key, {
          key,
          phase: record.phase,
          group: record.group,
          output: record.output,
          operatedScopes: 0,
          possibleScopes: 0,
          templateCases: 0,
          commonCases: 0,
          workDiffCases: 0,
          ownerDiffCases: 0,
          sizeDiffCases: 0,
          countryDiffCases: 0,
          languageDiffCases: 0,
          formatDiffs: new Set(),
          typeDiffs: new Set(),
          examples: [],
        });
      }

      const row = rows.get(key);
      const presentScopes = activeScopes.filter((scope) => scope.recordMap.has(key));
      const hasWorkDiff = analysis.structuralDiffs.some((diff) => diff.key === key);
      const hasOwnerDiff = analysis.attributeDiffs.some((diff) => diff.key === key);
      const hasSizeDiff = hasTaskSizeDifference(analysis, key);
      const hasCountryDiff = hasTaskCountryDifference(analysis, key);
      const hasLanguageDiff = hasTaskLanguageDifference(analysis, key);
      const typeLabel = caseTypeLabel(analysis);

      row.operatedScopes += presentScopes.length;
      row.possibleScopes += activeScopes.length;
      row.templateCases += 1;
      if (!hasWorkDiff) row.commonCases += 1;
      if (hasWorkDiff) row.workDiffCases += 1;
      if (hasOwnerDiff) row.ownerDiffCases += 1;
      if (hasSizeDiff) row.sizeDiffCases += 1;
      if (hasCountryDiff) row.countryDiffCases += 1;
      if (hasLanguageDiff) row.languageDiffCases += 1;
      if (hasWorkDiff || hasOwnerDiff || hasSizeDiff) {
        row.formatDiffs.add(analysis.courseFormat);
        row.typeDiffs.add(typeLabel);
      }
      if ((hasWorkDiff || hasOwnerDiff || hasSizeDiff || hasCountryDiff || hasLanguageDiff) && row.examples.length < 3) {
        row.examples.push(`${caseTitle(analysis)}: ${summarizeTaskOverviewDifference(analysis, key)}`);
      }
    });
  });

  return [...rows.values()].sort(compareTaskOverviewRows);
}

function findScopeRecord(scopes, key) {
  for (const scope of scopes) {
    const record = scope.recordMap.get(key);
    if (record) return record;
  }
  return null;
}

function hasTaskCountryDifference(analysis, key) {
  const countryStates = ["KR", "JP", "GL"].map((country) => getTaskCountryState(analysis, key, country));
  const comparableStates = countryStates.filter((state) => state !== "none" && state !== "confirm");
  if (countryStates.includes("confirm")) return true;
  return new Set(comparableStates).size > 1;
}

function getTaskCountryState(analysis, key, country) {
  const scopes = analysis.scopes.filter((scope) => scope.site === country);
  const availableScopes = scopes.filter((scope) => scope.state === "available");
  if (!availableScopes.length) {
    return scopes.some((scope) => scope.state === "discussion") ? "confirm" : "none";
  }

  const states = availableScopes.map((scope) => {
    const record = scope.recordMap.get(key);
    return record ? `present:${record.attributeKey}:${record.sizeKey}` : "absent";
  });
  return [...new Set(states)].sort().join("|");
}

function hasTaskLanguageDifference(analysis, key) {
  const states = analysis.scopes
    .filter((scope) => scope.site === "GL" && scope.state === "available")
    .map((scope) => {
      const record = scope.recordMap.get(key);
      return record ? `present:${record.attributeKey}:${record.sizeKey}` : "absent";
    });

  return states.length > 1 && new Set(states).size > 1;
}

function hasTaskSizeDifference(analysis, key) {
  const states = analysis.scopes
    .filter((scope) => scope.state === "available")
    .map((scope) => {
      const record = scope.recordMap.get(key);
      return record ? `present:${record.sizeKey}` : "absent";
    });

  return states.length > 1 && new Set(states).size > 1;
}

function summarizeTaskOverviewDifference(analysis, key) {
  const pieces = [];
  const structuralDiff = analysis.structuralDiffs.find((diff) => diff.key === key);
  if (structuralDiff) pieces.push(summarizeTaskDifference(analysis, key));

  const attributeDiff = analysis.attributeDiffs.find((diff) => diff.key === key);
  if (attributeDiff) pieces.push(summarizeTaskDifference(analysis, key));

  if (hasTaskSizeDifference(analysis, key)) {
    pieces.push(summarizeTaskSizeDifference(analysis, key));
  }

  if (hasTaskLanguageDifference(analysis, key)) {
    pieces.push("GL 언어별 포함/작업주체/규격 차이");
  }
  if (!pieces.length && hasTaskCountryDifference(analysis, key)) {
    pieces.push("국가별 포함/작업주체/규격 차이");
  }
  return pieces.length ? unique(pieces).join(" · ") : "차이 없음";
}

function summarizeTaskSizeDifference(analysis, key) {
  const groups = new Map();

  analysis.scopes
    .filter((scope) => scope.state === "available")
    .forEach((scope) => {
      const record = scope.recordMap.get(key);
      const label = record && record.sizes.length ? record.sizes.join(", ") : record ? "규격 미지정" : "업무 없음";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(scope.label);
    });

  return [...groups.entries()]
    .map(([size, scopes]) => `${scopes.join(", ")} ${size}`)
    .join(" / ");
}

function caseTypeLabel(analysis) {
  return analysis.courseType === "현지화"
    ? `${analysis.courseType} · ${analysis.localizationType}`
    : analysis.courseType;
}

function renderTaskOverviewTable(rows) {
  els.allTaskTableHead.innerHTML = `
    <tr>
      <th>업무</th>
      <th>운영량</th>
      <th>업무 공통</th>
      <th>국가 차이</th>
      <th>작업주체 차이</th>
      <th>규격 차이</th>
      <th>포맷 영향</th>
      <th>유형 영향</th>
      <th>언어 차이</th>
      <th>주요 차이</th>
    </tr>
  `;

  if (!rows.length) {
    els.allTaskTableBody.innerHTML = `<tr><td colspan="10" class="empty-state">운영 중인 업무가 없습니다</td></tr>`;
    return;
  }

  els.allTaskTableBody.innerHTML = rows.map(renderTaskOverviewRow).join("");
}

function renderTaskOverviewRow(row) {
  const diffTotal =
    row.workDiffCases +
    row.ownerDiffCases +
    row.sizeDiffCases +
    row.countryDiffCases +
    row.languageDiffCases;
  const rowClass = diffTotal ? "has-attention" : "is-clean";

  return `
    <tr class="${rowClass}">
      <td>
        <div class="case-name">${escapeHtml(row.output)}</div>
        <div class="case-note">${escapeHtml(row.phase)} · ${escapeHtml(row.group)}</div>
      </td>
      <td>
        <strong>${row.operatedScopes}</strong>
        <span class="mini-note">/ ${row.possibleScopes} 국가/언어 케이스</span>
      </td>
      <td>${renderMetricCell(row.commonCases, row.templateCases, "기준안")}</td>
      <td>${renderMetricCell(row.countryDiffCases, row.templateCases, "케이스")}</td>
      <td>${renderMetricCell(row.ownerDiffCases, row.templateCases, "케이스")}</td>
      <td>${renderMetricCell(row.sizeDiffCases, row.templateCases, "케이스")}</td>
      <td>${renderSetMetric(row.formatDiffs, "포맷")}</td>
      <td>${renderSetMetric(row.typeDiffs, "유형")}</td>
      <td>${renderMetricCell(row.languageDiffCases, row.templateCases, "케이스")}</td>
      <td class="case-note">${escapeHtml(row.examples.length ? row.examples.join(" / ") : "차이 없음")}</td>
    </tr>
  `;
}

function renderMetricCell(value, total, unit) {
  return `
    <div class="metric-cell">
      <strong>${value}</strong>
      <span>/ ${total} ${unit}</span>
    </div>
  `;
}

function renderSetMetric(values, label) {
  const list = [...values];
  return `
    <div class="metric-cell">
      <strong>${list.length}</strong>
      <span>${escapeHtml(list.length ? list.join(", ") : `차이 ${label} 없음`)}</span>
    </div>
  `;
}

function buildOperationExceptions(analyses) {
  const exceptions = [];

  const glThaiOriginals = analyses.filter(
    (analysis) =>
      analysis.courseType === "오리지널" &&
      analysis.scopes.some(
        (scope) => scope.site === "GL" && scope.language === "TH" && scope.state === "discussion"
      )
  );
  if (glThaiOriginals.length) {
    exceptions.push({
      title: "GL TH 오리지널 미운영",
      count: glThaiOriginals.length,
      note: `${glThaiOriginals.map((analysis) => analysis.courseFormat).join(", ")} 포맷은 현지화 기준으로만 확인`,
    });
  }

  const glExtensionAnalyses = analyses.filter(
    (analysis) => analysis.courseType === "현지화" && analysis.localizationType === "확장"
  );
  if (glExtensionAnalyses.length) {
    const operatedLanguages = unique(
      glExtensionAnalyses.flatMap((analysis) =>
        analysis.scopes
          .filter((scope) => scope.site === "GL" && scope.state === "available")
          .map((scope) => scope.language)
      )
    );
    const unavailableSites = unique(
      glExtensionAnalyses.flatMap((analysis) =>
        analysis.scopes
          .filter((scope) => scope.state === "unavailable")
          .map((scope) => scopeLabel(scope))
      )
    );
    exceptions.push({
      title: "현지화 확장 운영 범위",
      count: glExtensionAnalyses.length,
      note: `운영 ${operatedLanguages.map((language) => `GL ${language}`).join(", ")} · 미운영 ${unavailableSites.join(", ")}`,
    });
  }

  const glExtensionDifferences = glExtensionAnalyses.filter(hasGlLanguageDifference);
  if (glExtensionDifferences.length) {
    exceptions.push({
      title: "GL 확장 TH/TW 업무 차이",
      count: glExtensionDifferences.length,
      note: glExtensionDifferences
        .slice(0, 4)
        .map((analysis) => `${analysis.courseFormat}: ${summarizeGlLanguageDifference(analysis)}`)
        .join(" / "),
    });
  } else if (glExtensionAnalyses.length) {
    exceptions.push({
      title: "GL 확장 TH/TW 업무",
      count: glExtensionAnalyses.length,
      note: "현재 기준에서는 GL ZH-TW와 GL TH의 확장 업무 구성이 동일합니다.",
    });
  }

  const dubbingDiscussions = analyses.filter(
    (analysis) =>
      analysis.courseType === "현지화" &&
      analysis.localizationType === "더빙" &&
      analysis.scopes.some((scope) => ["KR", "JP"].includes(scope.site) && scope.state === "discussion")
  );
  if (dubbingDiscussions.length) {
    exceptions.push({
      title: "KR/JP 더빙 기준 미확정",
      count: dubbingDiscussions.length,
      note: "KR/JP 더빙은 추후 확정 전이라 GL 더빙 기준과 바로 통합 판단하지 않습니다.",
    });
  }

  return exceptions;
}

function hasGlLanguageDifference(analysis) {
  const signatures = analysis.scopes
    .filter((scope) => scope.site === "GL" && scope.state === "available")
    .map((scope) => scope.operationSignature);
  return new Set(signatures).size > 1;
}

function summarizeGlLanguageDifference(analysis) {
  const groups = new Map();
  analysis.scopes
    .filter((scope) => scope.site === "GL" && scope.state === "available")
    .forEach((scope) => {
      const summary = `${scope.records.length}개 업무`;
      if (!groups.has(summary)) groups.set(summary, []);
      groups.get(summary).push(scope.language);
    });

  return [...groups.entries()]
    .map(([summary, languages]) => `${languages.map((language) => `GL ${language}`).join(", ")} ${summary}`)
    .join(" / ");
}

function renderTaskStatList(stats, totalCases, mode) {
  if (!totalCases) {
    return `<div class="empty-state">국가 비교 가능한 케이스가 없습니다</div>`;
  }
  if (!stats.length) return `<div class="empty-state">해당 업무가 없습니다</div>`;

  return stats
    .map((stat) => {
      const primaryCount =
        mode === "common"
          ? stat.commonStructureCases
          : mode === "different"
            ? stat.differenceCases
            : stat.cases;
      const primaryLabel = mode === "common" ? "공통" : mode === "different" ? "차이" : "운영";
      const secondary =
        mode === "common"
          ? `작업주체까지 동일 ${stat.sameAttributeCases} · 작업주체만 다름 ${stat.attributeDifferenceCases}`
          : mode === "different"
            ? `업무 포함 차이 ${stat.structuralDifferenceCases} · 작업주체 차이 ${stat.attributeDifferenceCases} · 규격 차이 ${stat.sizeDifferenceCases}`
            : `공통 ${stat.commonStructureCases} · 차이 ${stat.differenceCases}`;

      return `
        <article class="task-stat-item">
          <div>
            <strong>${escapeHtml(stat.output)}</strong>
            <span>${escapeHtml(stat.phase)} · ${escapeHtml(stat.group)}</span>
          </div>
          <div class="task-stat-meter" aria-hidden="true">
            <span style="width: ${formatPercent(primaryCount, totalCases)}"></span>
          </div>
          <p>
            ${escapeHtml(primaryLabel)} ${primaryCount}/${totalCases}개 케이스 · ${escapeHtml(secondary)}
          </p>
          <p class="mini-note">${escapeHtml((mode === "different" && stat.patterns.length ? stat.patterns : stat.examples).join(", "))}</p>
        </article>
      `;
    })
    .join("");
}

function renderExceptionList(exceptions) {
  if (!exceptions.length) return `<div class="empty-state">운영 예외가 없습니다</div>`;

  return exceptions
    .map(
      (exception) => `
        <article class="task-stat-item">
          <div>
            <strong>${escapeHtml(exception.title)}</strong>
            <span>${escapeHtml(exception.count)}개 케이스</span>
          </div>
          <p>${escapeHtml(exception.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderPatternTable(analyses) {
  const rows = buildPatternRows(analyses);

  els.patternTableHead.innerHTML = `
    <tr>
      <th>유형</th>
      ${courseFormatOptions.map((format) => `<th>${escapeHtml(format)}</th>`).join("")}
    </tr>
  `;

  if (!rows.length) {
    els.patternTableBody.innerHTML = `<tr><td colspan="${courseFormatOptions.length + 1}" class="empty-state">조건에 맞는 패턴이 없습니다</td></tr>`;
    return;
  }

  els.patternTableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <th>${escapeHtml(row.label)}</th>
          ${courseFormatOptions
            .map((format) => renderPatternCell(row.analyses.get(format)))
            .join("")}
        </tr>
      `
    )
    .join("");
}

function buildPatternRows(analyses) {
  const rows = new Map();

  analyses.forEach((analysis) => {
    const key = [analysis.courseType, analysis.localizationType].join("|");
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label:
          analysis.courseType === "현지화"
            ? `${analysis.courseType} · ${analysis.localizationType}`
            : analysis.courseType,
        courseType: analysis.courseType,
        localizationType: analysis.localizationType,
        analyses: new Map(),
      });
    }
    rows.get(key).analyses.set(analysis.courseFormat, analysis);
  });

  return [...rows.values()].sort(
    (a, b) =>
      courseTypes.indexOf(a.courseType) - courseTypes.indexOf(b.courseType) ||
      getLocalizationRank(a.localizationType) - getLocalizationRank(b.localizationType)
  );
}

function renderPatternCell(analysis) {
  if (!analysis) return `<td class="pattern-empty">-</td>`;

  const status = statusMeta[analysis.status];
  return `
    <td>
      <button class="pattern-cell ${status.className}" type="button" data-case-key="${escapeHtml(analysis.key)}">
        <span>${escapeHtml(shortStatusLabel(analysis.status))}</span>
        <strong>${escapeHtml(formatPatternMetric(analysis))}</strong>
      </button>
    </td>
  `;
}

function shortStatusLabel(status) {
  const labels = {
    same: "동일",
    attribute: "주체",
    different: "업무",
    insufficient: "확인",
    excluded: "논의",
  };
  return labels[status] || "-";
}

function formatPatternMetric(analysis) {
  if (analysis.status === "insufficient") return "국가 확인";
  if (analysis.status === "excluded") return "논의 필요";
  return `공통 ${analysis.commonRecords.length} · 주체 ${analysis.attributeDiffs.length} · 업무 ${analysis.structuralDiffs.length}`;
}

function renderCountryFormatTable(analyses) {
  const rows = buildCountryFormatRows(analyses);

  els.countryFormatTableHead.innerHTML = `
    <tr>
      <th>국가</th>
      ${courseFormatOptions.map((format) => `<th>${escapeHtml(format)}</th>`).join("")}
      <th>합계</th>
    </tr>
  `;

  els.countryFormatTableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <th>${escapeHtml(row.label)}</th>
          ${courseFormatOptions.map((format) => renderCountryFormatCell(row.formats.get(format))).join("")}
          ${renderCountryFormatCell(row.total)}
        </tr>
      `
    )
    .join("");
}

function buildCountryFormatRows(analyses) {
  return ["KR", "JP", "GL"].map((country) => {
    const formats = new Map(
      courseFormatOptions.map((format) => [format, { total: 0, different: 0, confirm: 0 }])
    );
    const row = {
      label: country,
      formats,
      total: { total: 0, different: 0, confirm: 0 },
    };

    analyses.forEach((analysis) => {
      const state = getCountryAlignmentState(analysis, country);
      if (state === "none") return;

      const bucket = formats.get(analysis.courseFormat);
      bucket.total += 1;
      row.total.total += 1;

      if (state === "different") {
        bucket.different += 1;
        row.total.different += 1;
      }
      if (state === "confirm") {
        bucket.confirm += 1;
        row.total.confirm += 1;
      }
    });

    return row;
  });
}

function renderCountryFormatCell(bucket) {
  const attention = bucket.different + bucket.confirm;
  const className = attention ? "has-attention" : "is-clean";

  return `
    <td class="country-format-cell ${className}">
      <strong>${attention}</strong>
      <span>차이 ${bucket.different} · 확인 ${bucket.confirm}</span>
      <em>/ ${bucket.total}</em>
    </td>
  `;
}

function getCountryAlignmentState(analysis, country) {
  const scopes = analysis.scopes.filter((scope) => scope.site === country);
  if (!scopes.length) return "none";

  const availableScopes = scopes.filter((scope) => scope.state === "available");
  const discussionScopes = scopes.filter((scope) => scope.state === "discussion");
  const unavailableScopes = scopes.filter((scope) => scope.state === "unavailable");

  if (!availableScopes.length) {
    return discussionScopes.length || analysis.availableScopes.length ? "confirm" : "none";
  }

  if (
    discussionScopes.length ||
    (country === "GL" && unavailableScopes.length && analysis.localizationType === "확장")
  ) {
    return "confirm";
  }

  if (analysis.status === "same") return "same";
  if (["insufficient", "excluded"].includes(analysis.status) && !analysis.hasCoreCoverage) {
    return "same";
  }

  const countrySignatures = getCountrySignatures(analysis);
  const signature = countrySignatures.get(country);
  if (!signature) return "confirm";
  if (signature.hasInternalDifference) return "different";

  const majoritySignature = getMajorityCountrySignature(countrySignatures);
  if (!majoritySignature) return "different";

  return signature.value === majoritySignature ? "same" : "different";
}

function getCountrySignatures(analysis) {
  const signatures = new Map();

  ["KR", "JP", "GL"].forEach((country) => {
    const scopeSignatures = analysis.scopes
      .filter((scope) => scope.site === country && scope.state === "available")
      .map((scope) => scope.operationSignature);

    if (!scopeSignatures.length) return;

    const uniqueSignatures = [...new Set(scopeSignatures)].sort();
    signatures.set(country, {
      value: uniqueSignatures.join("\n---\n"),
      hasInternalDifference: uniqueSignatures.length > 1,
    });
  });

  return signatures;
}

function getMajorityCountrySignature(countrySignatures) {
  const counts = new Map();

  countrySignatures.forEach((signature) => {
    counts.set(signature.value, (counts.get(signature.value) || 0) + 1);
  });

  const sorted = [...counts.entries()].sort(([, countA], [, countB]) => countB - countA);
  if (!sorted.length) return "";
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return "";
  return sorted[0][0];
}

function renderDecisionPanels(analyses) {
  const same = analyses.filter((analysis) => analysis.status === "same");
  const attribute = analyses.filter((analysis) => analysis.status === "attribute");
  const needsAlignment = analyses
    .filter((analysis) => ["different", "insufficient", "excluded"].includes(analysis.status))
    .sort((a, b) => b.structuralDiffs.length - a.structuralDiffs.length);

  els.readyCount.textContent = `${same.length}개`;
  els.attributeCount.textContent = `${attribute.length}개`;
  els.differentCount.textContent = `${needsAlignment.length}개`;
  els.readyList.innerHTML = renderDecisionList(same, "동일 기준");
  els.attributeList.innerHTML = renderDecisionList(attribute, "작업주체 기준 확인");
  els.differentList.innerHTML = renderDecisionList(needsAlignment, "업무 구성 또는 국가별 기준 확인");
}

function renderDecisionList(analyses, noteLabel) {
  if (!analyses.length) return `<div class="empty-state">해당 케이스가 없습니다</div>`;

  return analyses
    .slice(0, 10)
    .map(
      (analysis) => `
        <button class="decision-item" type="button" data-case-key="${escapeHtml(analysis.key)}">
          <strong>${escapeHtml(caseTitle(analysis))}</strong>
          <span>${escapeHtml(noteLabel)} · ${escapeHtml(scopeSummary(analysis))}</span>
        </button>
      `
    )
    .join("");
}

function renderCaseTable(analyses) {
  els.caseCount.textContent = `${analyses.length}개`;

  if (!analyses.length) {
    els.caseTableBody.innerHTML = `<tr><td colspan="12" class="empty-state">조건에 맞는 케이스가 없습니다</td></tr>`;
    return;
  }

  els.caseTableBody.innerHTML = analyses
    .map(
      (analysis) => `
        <tr data-case-key="${escapeHtml(analysis.key)}" class="${analysis.key === selectedCaseKey ? "is-selected" : ""}">
          <td>${renderStatusPill(analysis.status)}</td>
          <td>
            <div class="case-name">${escapeHtml(caseTitle(analysis))}</div>
            <div class="case-note">${escapeHtml(caseSubtitle(analysis))}</div>
          </td>
          <td>${escapeHtml(scopeSummary(analysis))}</td>
          <td>${escapeHtml(formatCountRange(analysis))}</td>
          <td>${analysis.structuralDiffs.length}</td>
          <td>${analysis.attributeDiffs.length}</td>
          ${siteLanguageOptions.map((scope) => renderScopeCountCell(analysis, scope)).join("")}
          <td class="case-note">${escapeHtml(majorDifferenceText(analysis))}</td>
        </tr>
      `
    )
    .join("");
}

function renderScopeCountCell(analysis, scope) {
  const scopeAnalysis = analysis.scopes.find(
    (entry) => entry.site === scope.site && entry.language === scope.language
  );
  const text =
    scopeAnalysis.state === "available"
      ? `${scopeAnalysis.records.length}`
      : scopeAnalysis.state === "discussion"
        ? "논의"
        : "-";
  const className = scopeAnalysis.state === "available" ? "is-active" : "is-muted";
  return `<td class="scope-cell ${className}">${escapeHtml(text)}</td>`;
}

function renderDetail(analysis) {
  if (!analysis) {
    els.detailTitle.textContent = "케이스 상세";
    els.detailStatus.textContent = "-";
    els.detailStatus.className = "count-pill";
    els.detailBody.innerHTML = `<div class="empty-state">선택된 케이스가 없습니다</div>`;
    return;
  }

  const status = statusMeta[analysis.status];
  els.detailTitle.textContent = caseTitle(analysis);
  els.detailStatus.textContent = status.label;
  els.detailStatus.className = `status-pill ${status.className}`;

  els.detailBody.innerHTML = `
    <div class="detail-summary">
      ${renderDetailStat("비교 대상", `${analysis.availableCount}/${analysis.totalScopeCount}`, "실제 비교에 사용된 대상")}
      ${renderDetailStat("공통 업무", analysis.commonRecords.length, "모든 비교 대상에 동일하게 존재")}
      ${renderDetailStat("업무 차이", analysis.structuralDiffs.length, "대상별 포함 여부가 다름")}
      ${renderDetailStat("작업주체 차이", analysis.attributeDiffs.length, "업무는 같고 작업주체만 다름")}
    </div>
    <div class="scope-grid">
      ${analysis.scopes.map(renderScopeCard).join("")}
    </div>
    ${renderReasonBlock(analysis)}
    ${renderDifferenceBlock(analysis)}
    ${renderCommonBlock(analysis)}
  `;
}

function renderDetailStat(label, value, note) {
  return `
    <article class="detail-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p class="mini-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function renderScopeCard(scope) {
  const stateLabel =
    scope.state === "available" ? `${scope.records.length}개 업무` : scope.stateReason;

  return `
    <article class="scope-card is-${escapeHtml(scope.state)}">
      <h3>${escapeHtml(scope.label)}</h3>
      <strong>${scope.state === "available" ? scope.records.length : "-"}</strong>
      <span>${escapeHtml(stateLabel)}</span>
      ${scope.state === "available" ? `<p>${escapeHtml(formatScopeGroups(scope.records))}</p>` : ""}
    </article>
  `;
}

function renderReasonBlock(analysis) {
  if (!["insufficient", "excluded"].includes(analysis.status)) return "";

  return `
    <div class="detail-block">
      <h3>왜 확인이 필요한가</h3>
      <div class="explanation-box">
        <p>${escapeHtml(insufficientReasonText(analysis))}</p>
        ${renderTagRow(analysis.scopes.map((scope) => `${scope.label}: ${scopeStateText(scope)}`))}
      </div>
    </div>
  `;
}

function renderDifferenceBlock(analysis) {
  const diffs = analysis.allDiffs.sort(compareDiffs);

  if (!diffs.length) {
    return `
      <div class="detail-block">
        <h3>차이 항목</h3>
        <div class="empty-state">모든 비교 대상의 업무 구성과 작업주체가 같습니다</div>
      </div>
    `;
  }

  return `
    <div class="detail-block">
      <h3>차이 항목</h3>
      <div class="table-wrap">
        <table class="difference-table">
          <thead>
            <tr>
              <th>업무</th>
              <th>구분</th>
              <th>포함 대상</th>
              <th>비포함 대상</th>
              <th>작업주체</th>
            </tr>
          </thead>
          <tbody>
            ${diffs.map(renderDifferenceRow).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDifferenceRow(diff) {
  return `
    <tr>
      <td>
        <div class="case-name">${escapeHtml(diff.output)}</div>
        <div class="case-note">${escapeHtml(diff.phase)} · ${escapeHtml(diff.group)}</div>
      </td>
      <td>${diff.type === "structure" ? "업무 포함" : "작업주체"}</td>
      <td>${renderTagRow(diff.presentScopes.map((scope) => scope.label))}</td>
      <td>${renderTagRow(diff.missingScopes.map((scope) => scope.label)) || `<span class="mini-note">-</span>`}</td>
      <td>${renderAttributeGroups(diff.attributeGroups)}</td>
    </tr>
  `;
}

function renderCommonBlock(analysis) {
  const records = analysis.commonRecords.slice(0, 24);

  if (!records.length) {
    return "";
  }

  return `
    <div class="detail-block">
      <h3>공통 업무</h3>
      <div class="table-wrap">
        <table class="common-table">
          <thead>
            <tr>
              <th>런칭 타임라인</th>
              <th>구분</th>
              <th>업무</th>
              <th>작업주체</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map(
                (record) => `
                  <tr>
                    <td>${escapeHtml(record.phase)}</td>
                    <td>${escapeHtml(record.group)}</td>
                    <td class="case-name">${escapeHtml(record.output)}</td>
                    <td>${escapeHtml(formatRecordAttributes(record))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        analysis.commonRecords.length > records.length
          ? `<p class="mini-note">공통 업무 ${analysis.commonRecords.length}개 중 ${records.length}개만 표시합니다.</p>`
          : ""
      }
    </div>
  `;
}

function renderTagRow(tags) {
  if (!tags.length) return "";

  return `
    <div class="tag-row">
      ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function renderAttributeGroups(groups) {
  if (!groups.length) return `<span class="mini-note">-</span>`;

  return `
    <div class="attribute-stack">
      ${groups
        .map(
          (group) => `
            <div class="attribute-line">
              <strong>${escapeHtml(group.scopes.map((scope) => scope.label).join(", "))}</strong>
              · ${escapeHtml(group.label)}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function fillSelect(select, options) {
  const current = select.value;
  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  if (options.some((option) => option.value === current)) {
    select.value = current;
  } else if (options.length) {
    select.value = options[0].value;
  }
}

function renderFilters() {
  fillSelect(els.courseTypeFilter, [
    { value: "전체", label: "전체" },
    ...courseTypes.map((value) => ({ value, label: value })),
  ]);
  fillSelect(els.localizationTypeFilter, [
    { value: "전체", label: "전체" },
    { value: "-", label: "오리지널" },
    ...localizationTypeOptions.map((value) => ({ value, label: value })),
  ]);
  fillSelect(els.courseFormatFilter, [
    { value: "전체", label: "전체" },
    ...courseFormatOptions.map((value) => ({ value, label: value })),
  ]);
  fillSelect(els.statusFilter, statusOptions);
}

function renderStatusPill(statusKey) {
  const status = statusMeta[statusKey] || statusMeta.insufficient;
  return `<span class="status-pill ${status.className}">${escapeHtml(status.label)}</span>`;
}

function setSyncStatus(state, text) {
  els.syncStatus.className = `sync-status is-${state}`;
  els.syncStatus.textContent = text;
}

function createSyncClient() {
  const config = window.COLOSO_DB_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!window.supabase || !window.supabase.createClient) return null;

  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function initSharedSync() {
  syncClient = createSyncClient();

  if (!syncClient) {
    setSyncStatus("local", "로컬 기준");
    return;
  }

  setSyncStatus("syncing", "DB 연결 중");

  try {
    overrides = await fetchRemoteOverrides();
    localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
    items = applyOverrides(buildItems(sourceRows));
    renderDashboard();
    setSyncStatus(
      isFileExtensionColumnMissing ? "error" : "online",
      isFileExtensionColumnMissing ? "DB 컬럼 업데이트 필요" : "DB 기준"
    );
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
    try {
      const rows = await fetchAllRemoteOverrideRows(remoteOverrideFallbackColumns);
      return rowsToOverrides(rows);
    } catch (fallbackError) {
      if (!isMissingFileExtensionColumnError(fallbackError)) throw fallbackError;
      const rows = await fetchAllRemoteOverrideRows(remoteOverrideLegacyColumns);
      return rowsToOverrides(rows);
    }
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
  if (Object.prototype.hasOwnProperty.call(row, "request_owner")) {
    override.requestOwner = row.request_owner || "";
  }
  if (Object.prototype.hasOwnProperty.call(row, "work_owner")) {
    override.workOwner = row.work_owner || "";
  }

  return override;
}

function normalizeCheckValue(value) {
  return isNo(value) ? "X" : "O";
}

function caseTitle(analysis) {
  const typeLabel =
    analysis.courseType === "현지화"
      ? `${analysis.courseType} · ${analysis.localizationType}`
      : analysis.courseType;
  return `${typeLabel} / ${analysis.courseFormat}`;
}

function caseSubtitle(analysis) {
  return analysis.courseType === "현지화"
    ? `현지화 유형 ${analysis.localizationType}`
    : "오리지널 공통 기준";
}

function scopeLabel(scope) {
  if (scope.site === "GL") return `GL ${scope.language}`;
  return scope.site;
}

function scopeSummary(analysis) {
  const labels = analysis.availableScopes.map((scope) => scope.label);
  if (!labels.length) return "비교 대상 없음";
  return `${labels.join(", ")} (${analysis.availableCount}/${analysis.totalScopeCount})`;
}

function formatCountRange(analysis) {
  if (!analysis.availableCount) return "-";
  if (analysis.minCount === analysis.maxCount) return `${analysis.minCount}개`;
  return `${analysis.minCount}-${analysis.maxCount}개`;
}

function majorDifferenceText(analysis) {
  if (analysis.status === "same") return "동일";
  if (analysis.status === "insufficient") return insufficientReasonText(analysis);
  if (analysis.status === "excluded") return "논의 제외";

  const targets = analysis.allDiffs.slice(0, 3).map((diff) => diff.output);
  const suffix = analysis.allDiffs.length > targets.length ? ` 외 ${analysis.allDiffs.length - targets.length}개` : "";
  return targets.length ? `${targets.join(", ")}${suffix}` : "-";
}

function insufficientReasonText(analysis) {
  const availableSites = new Set(analysis.availableScopes.map((scope) => scope.site));
  const missingSites = ["KR", "JP", "GL"].filter((site) => !availableSites.has(site));
  const discussionSites = new Set(
    analysis.scopes.filter((scope) => scope.state === "discussion").map((scope) => scope.site)
  );
  const unconfirmedSites = missingSites.filter((site) => !discussionSites.has(site));
  const discussionLabels = analysis.scopes
    .filter((scope) => scope.state === "discussion")
    .map((scope) => `${scope.label} ${scope.stateReason}`);
  const availableLabels = analysis.availableScopes.map((scope) => scope.label);

  if (!analysis.availableScopes.length) {
    return discussionLabels.length
      ? `${discussionLabels.join(", ")} 상태라 비교할 실제 업무 기준이 없습니다.`
      : "현재 비교할 실제 업무 기준이 없습니다.";
  }

  const reasonParts = [];
  if (unconfirmedSites.length) {
    reasonParts.push(`${unconfirmedSites.join(", ")} 업무 기준 확인 필요`);
  }
  if (discussionLabels.length) {
    reasonParts.push(discussionLabels.join(", "));
  }

  return `${reasonParts.join(" · ")}. 현재는 ${availableLabels.join(", ")} 기준만 있어 국가 전체 통합 판단 전 추가 확인이 필요합니다.`;
}

function scopeStateText(scope) {
  if (scope.state === "available") return `${scope.records.length}개 업무`;
  return scope.stateReason;
}

function formatRatio(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.max(4, Math.round((value / total) * 100))}%`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatScopeGroups(records) {
  const groups = new Map();
  records.forEach((record) => {
    groups.set(record.group, (groups.get(record.group) || 0) + 1);
  });
  return [...groups.entries()].map(([group, count]) => `${group} ${count}`).join(" · ");
}

function formatRecordAttributes(record) {
  return formatWorkOwnerAttribute(record);
}

function formatWorkOwnerAttribute(record) {
  return record.workOwners.length ? `작업주체 ${record.workOwners.join(", ")}` : "작업주체 미지정";
}

function compareAnalyses(a, b) {
  const statusRank = {
    same: 0,
    attribute: 1,
    different: 2,
    insufficient: 3,
    excluded: 4,
  };
  return (
    statusRank[a.status] - statusRank[b.status] ||
    courseTypes.indexOf(a.courseType) - courseTypes.indexOf(b.courseType) ||
    getLocalizationRank(a.localizationType) - getLocalizationRank(b.localizationType) ||
    courseFormatOptions.indexOf(a.courseFormat) - courseFormatOptions.indexOf(b.courseFormat)
  );
}

function compareCommonTaskStats(a, b) {
  return (
    b.commonStructureCases - a.commonStructureCases ||
    b.sameAttributeCases - a.sameAttributeCases ||
    compareRecords(a, b)
  );
}

function compareAllTaskStats(a, b) {
  return b.cases - a.cases || compareRecords(a, b);
}

function compareTaskOverviewRows(a, b) {
  const diffA =
    a.workDiffCases + a.ownerDiffCases + a.sizeDiffCases + a.countryDiffCases + a.languageDiffCases;
  const diffB =
    b.workDiffCases + b.ownerDiffCases + b.sizeDiffCases + b.countryDiffCases + b.languageDiffCases;
  return diffB - diffA || b.templateCases - a.templateCases || compareRecords(a, b);
}

function compareDifferentTaskStats(a, b) {
  return (
    b.differenceCases - a.differenceCases ||
    b.structuralDifferenceCases - a.structuralDifferenceCases ||
    b.sizeDifferenceCases - a.sizeDifferenceCases ||
    compareRecords(a, b)
  );
}

function compareRecords(a, b) {
  return (
    getPhaseRank(a.phase) - getPhaseRank(b.phase) ||
    getGroupRank(a.group) - getGroupRank(b.group) ||
    compareText(a.output, b.output)
  );
}

function compareDiffs(a, b) {
  return compareRecords(a, b);
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ko");
}

function getLocalizationRank(value) {
  if (value === "-") return -1;
  const index = localizationTypeOptions.indexOf(value);
  return index === -1 ? 99 : index;
}

function getPhaseRank(phase) {
  const index = ["얼리버드", "상세페이지 오픈", "얼리버드 마감", "영상공개"].indexOf(phase);
  return index === -1 ? 99 : index;
}

function getGroupRank(group) {
  if (group === "온사이트" || group === "사이트") return 0;
  if (group === "오가닉" || group === "얼리버드 오가닉") return 1;
  if (group === "CRM") return 2;
  if (group === "페이드") return 3;
  return 9;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

[els.courseTypeFilter, els.localizationTypeFilter, els.courseFormatFilter, els.statusFilter].forEach(
  (select) => {
    select.addEventListener("change", renderDashboard);
  }
);

els.caseTableBody.addEventListener("click", (event) => {
  const row = event.target.closest("[data-case-key]");
  if (!row) return;
  selectedCaseKey = row.dataset.caseKey;
  renderDashboard();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".decision-item[data-case-key], .pattern-cell[data-case-key]");
  if (!button) return;
  selectedCaseKey = button.dataset.caseKey;
  renderDashboard();
  document.getElementById("detailSection").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderFilters();
renderDashboard();
initSharedSync();
