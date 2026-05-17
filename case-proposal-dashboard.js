const sourceRows = [
  ["", "국가(사이트)", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "언어", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "포맷/산출물", "얼리버드", "", "", "", "", "", "", "", "상세페이지 오픈", "", "", "", "", "", "", "", "", "", "", "", "영상공개", "", "", "", "", "", ""],
  ["", "", "얼리버드 오가닉", "", "", "", "", "", "사이트", "얼리버드 오가닉", "사이트", "", "", "", "", "오가닉", "", "", "", "", "", "", "사이트", "오가닉", "", "", "", "", ""],
  ["", "", "콜로소 공계 피드", "", "스토리", "연사용 공계 피드", "", "카카오톡", "코스카드 썸네일", "EDM", "상세페이지", "메인배너", "큐레이션 배너", "포맷 전용 페이지", "", "피드", "", "스토리", "연사용 공계 피드", "", "EDM", "광고", "상세페이지 수정", "콜로소 공계 피드", "", "스토리", "연사용 오가닉", "", "광고"],
  ["", "", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "", "", "", "메인 페이지 ", "개별 상세 페이지", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "1:1", "4:5", "", "1:1", "4:5", ""],
];

const siteLanguageOptions = [
  { site: "KR", language: "KO", label: "KR" },
  { site: "JP", language: "JO", label: "JP" },
  { site: "GL", language: "EN", label: "GL EN" },
  { site: "GL", language: "ZH-TW", label: "GL ZH-TW" },
  { site: "GL", language: "TH", label: "GL TH" },
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

const els = {
  syncStatus: document.getElementById("syncStatus"),
  summaryGrid: document.getElementById("summaryGrid"),
  proposalRuleCount: document.getElementById("proposalRuleCount"),
  proposalFlow: document.getElementById("proposalFlow"),
  axisGrid: document.getElementById("axisGrid"),
  moduleCount: document.getElementById("moduleCount"),
  moduleGrid: document.getElementById("moduleGrid"),
  workSplitCount: document.getElementById("workSplitCount"),
  workSplitBody: document.getElementById("workSplitBody"),
  rolloutList: document.getElementById("rolloutList"),
};

let overrides = loadOverrides();
let items = applyOverrides(buildItems(sourceRows));
let syncClient = null;
let isFileExtensionColumnMissing = false;

function buildItems(rows) {
  const baseItems = [];
  const carry = { phase: "", group: "", output: "" };

  for (let column = 2; column < rows[0].length; column += 1) {
    carry.phase = rows[2][column] || carry.phase;
    carry.group = rows[3][column] || carry.group;
    carry.output = rows[4][column] || carry.output;
    if (!carry.phase || !carry.output) continue;
    baseItems.push({
      sourceColumn: column,
      phase: carry.phase,
      group: carry.group,
      output: carry.output.trim(),
      size: String(rows[5][column] || "").trim(),
    });
  }

  const normalizedBaseItems = normalizeBaseItems(baseItems);
  return siteLanguageOptions.flatMap((scope) =>
    courseTypes.flatMap((courseType) => {
      const localizationTypes = getLocalizationTypes(scope.site, scope.language, courseType);
      return courseFormatOptions.flatMap((courseFormat) =>
        localizationTypes.flatMap((localizationType) =>
          normalizedBaseItems
            .filter((item) => isAvailableForCourseFormat(item, courseFormat))
            .map((item) =>
              withDefaults({
                ...scope,
                courseType,
                courseFormat,
                localizationType,
                ...item,
              })
            )
        )
      );
    })
  );
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
      return [{ ...normalizedItem, sourceColumn: `${normalizedItem.sourceColumn}_crm`, group: "CRM" }];
    }

    if (normalizedItem.group === "온사이트" && normalizedItem.output === "상세페이지") {
      return [
        { ...normalizedItem, sourceColumn: `${normalizedItem.sourceColumn}_image`, output: "상세페이지 이미지 제작" },
        { ...normalizedItem, sourceColumn: `${normalizedItem.sourceColumn}_admin`, output: "상세페이지 어드민 작업" },
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
  if (trimmedOutput === "연사용 공계 피드" || trimmedOutput === "연사용 오가닉") return "연사용 피드";
  return trimmedOutput;
}

function normalizeSize(item) {
  if (item.group === "페이드" && item.output === "광고") return "광고 소재에 따라 상이";
  return normalizeSizeValue(item.size);
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
      return replacements.get(trimmed.replace(/\s+/g, "")) || trimmed;
    })
    .join(", ");
}

function withDefaults(item) {
  return {
    ...item,
    id: makeId(item),
    fileExtension: item.fileExtension || "",
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
  return "O";
}

function getDefaultWorkOwner(item) {
  if (isEarlybirdCloseOrganicTarget(item)) return "마케터";
  if (item.site === "KR" && item.group === "페이드" && item.output === "광고") return "마케터";
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

function makeId(item) {
  return [item.site, item.language, item.courseType, item.courseFormat, item.localizationType, item.sourceColumn]
    .join("_")
    .replace(/\s+/g, "");
}

function isAvailableForCourseFormat(item, courseFormat) {
  if (item.group === "온사이트" && item.output === "포맷 전용 페이지") return courseFormat === "시그니처";
  if (item.phase === "영상공개" && item.group === "페이드" && item.output === "광고") return false;
  return true;
}

function getLocalizationTypes(site, language, courseType) {
  if (courseType !== "현지화") return ["-"];
  if (["KR", "JP"].includes(site)) return localizationTypeOptions.filter((type) => type !== "확장");
  if (site === "GL" && language === "EN") return localizationTypeOptions.filter((type) => type !== "확장");
  return localizationTypeOptions;
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

function normalizeOverridesMap(map) {
  return Object.fromEntries(Object.entries(map).map(([id, override]) => [id, normalizeOverride(override)]));
}

function normalizeOverride(override) {
  if (!override || typeof override !== "object") return {};
  const normalized = { ...override };
  if (Object.prototype.hasOwnProperty.call(normalized, "size")) {
    normalized.size = normalizeSizeValue(normalized.size);
  }
  return normalized;
}

function applyOverrides(baseItems) {
  return baseItems.map((item) => {
    const override = normalizeOverride(getItemOverride(item) || {});
    const merged = { ...item, ...override };
    return { ...merged, workOwner: merged.workOwner || getDefaultWorkOwner(merged) };
  });
}

function getItemOverride(item) {
  if (overrides[item.id]) return overrides[item.id];
  if (item.courseFormat !== "에셋") return null;
  return overrides[makeId({ ...item, courseFormat: "에셋 유형" })] || null;
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
  return buildCaseDefinitions().map(analyzeCase);
}

function analyzeCase(definition) {
  const scopes = siteLanguageOptions.map((scope) => buildScopeAnalysis(scope, definition));
  const availableScopes = scopes.filter((scope) => scope.state === "available");
  const records = buildTaskUnion(availableScopes);
  const structuralDiffs = [];
  const attributeDiffs = [];
  const commonRecords = [];

  records.forEach((entry) => {
    const presentScopes = availableScopes.filter((scope) => scope.recordMap.has(entry.key));
    const missingScopes = availableScopes.filter((scope) => !scope.recordMap.has(entry.key));
    const attributeGroups = buildAttributeGroups(presentScopes, entry.key);
    if (missingScopes.length) {
      structuralDiffs.push({ ...entry, presentScopes, missingScopes, attributeGroups });
    } else if (attributeGroups.length > 1) {
      attributeDiffs.push({ ...entry, presentScopes, missingScopes, attributeGroups });
    } else if (presentScopes.length) {
      commonRecords.push(entry.record);
    }
  });

  const hasCoreCoverage = hasCoreSiteCoverage(availableScopes);
  const detailSignatureCount = new Set(availableScopes.map((scope) => scope.detailSignature)).size;
  const structureSignatureCount = new Set(availableScopes.map((scope) => scope.structureSignature)).size;

  return {
    ...definition,
    scopes,
    availableScopes,
    records,
    structuralDiffs,
    attributeDiffs,
    commonRecords,
    hasCoreCoverage,
    status: getCaseStatus({ availableScopes, hasCoreCoverage, detailSignatureCount, structureSignatureCount }),
  };
}

function buildScopeAnalysis(scope, definition) {
  const state = getScopeState(scope, definition);
  const records = state === "available" ? buildOutputRecords(getCaseItems(scope, definition)) : [];
  const recordMap = new Map(records.map((record) => [record.key, record]));
  return {
    ...scope,
    state,
    records,
    recordMap,
    structureSignature: records.map((record) => record.key).join("\n"),
    detailSignature: records.map((record) => record.signature).join("\n"),
    operationSignature: records.map((record) => [record.key, record.attributeKey, record.sizeKey].join("||")).join("\n"),
  };
}

function getScopeState(scope, definition) {
  if (isDiscussionScope(scope, definition)) return "discussion";
  if (!getLocalizationTypes(scope.site, scope.language, definition.courseType).includes(definition.localizationType)) return "unavailable";
  return items.some((item) => matchesCase(item, scope, definition)) ? "available" : "unavailable";
}

function isDiscussionScope(scope, definition) {
  return (
    (scope.site === "KR" && definition.courseType === "현지화" && definition.localizationType === "더빙") ||
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
  return ["N", "NO", "X", "FALSE", "0", "불필요", "미노출"].includes(String(value || "").trim().toUpperCase());
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
        workOwners: new Set(),
      });
    }
    const record = records.get(key);
    getSizeTags(item.size).forEach((size) => record.sizes.add(size));
    if (String(item.workOwner || "").trim()) record.workOwners.add(item.workOwner.trim());
  });
  return [...records.values()].map(finalizeRecord).sort(compareRecords);
}

function finalizeRecord(record) {
  const sizes = [...record.sizes].sort(compareText);
  const workOwners = [...record.workOwners].sort(compareText);
  const attributeKey = workOwners.join(",");
  const sizeKey = sizes.join(",");
  return {
    ...record,
    sizes,
    workOwners,
    attributeKey,
    sizeKey,
    signature: [record.key, attributeKey, sizeKey].join("||"),
  };
}

function getSizeTags(size) {
  const value = normalizeSizeValue(size);
  if (!value || value === "-") return [];
  return value.split(/,\s*/).map((tag) => tag.trim()).filter(Boolean);
}

function buildTaskUnion(scopes) {
  const union = new Map();
  scopes.forEach((scope) => {
    scope.records.forEach((record) => {
      if (!union.has(record.key)) union.set(record.key, { key: record.key, phase: record.phase, group: record.group, output: record.output, record });
    });
  });
  return [...union.values()].sort(compareRecords);
}

function buildAttributeGroups(scopes, key) {
  const groups = new Map();
  scopes.forEach((scope) => {
    const record = scope.recordMap.get(key);
    if (!record) return;
    const label = record.workOwners.length ? `작업주체 ${record.workOwners.join(", ")}` : "작업주체 미지정";
    if (!groups.has(label)) groups.set(label, { label, scopes: [] });
    groups.get(label).scopes.push(scope);
  });
  return [...groups.values()];
}

function getCaseStatus({ availableScopes, hasCoreCoverage, detailSignatureCount, structureSignatureCount }) {
  if (availableScopes.length < 2 || !hasCoreCoverage) return "insufficient";
  if (detailSignatureCount === 1) return "same";
  if (structureSignatureCount === 1) return "attribute";
  return "different";
}

function hasCoreSiteCoverage(scopes) {
  const sites = new Set(scopes.map((scope) => scope.site));
  return ["KR", "JP", "GL"].every((site) => sites.has(site));
}

function calculateProposal() {
  const analyses = buildCaseAnalyses();
  const operated = analyses.flatMap((analysis) =>
    analysis.availableScopes.map((scope) => ({ analysis, scope }))
  );
  const recordStats = buildRecordStats(operated);
  const totalScopeCases = operated.length;
  const core = recordStats.filter((record) => record.count === totalScopeCases);
  const nearCore = recordStats.filter((record) => record.count >= totalScopeCases * 0.85 && record.count < totalScopeCases);
  const options = recordStats.filter((record) => record.count < totalScopeCases * 0.85);
  const structureClusterCount = new Set(operated.map(({ scope }) => scope.structureSignature)).size;
  const operationClusterCount = new Set(operated.map(({ scope }) => scope.operationSignature)).size;
  const comparableCases = analyses.filter((analysis) => analysis.hasCoreCoverage);
  const statusCounts = ["same", "attribute", "different", "insufficient"].reduce((acc, status) => {
    acc[status] = analyses.filter((analysis) => analysis.status === status).length;
    return acc;
  }, {});
  const proposedRuleCount = 2 + options.length;

  return {
    analyses,
    operated,
    recordStats,
    core,
    nearCore,
    options,
    totalScopeCases,
    structureClusterCount,
    operationClusterCount,
    comparableCases,
    statusCounts,
    proposedRuleCount,
  };
}

function buildRecordStats(operated) {
  const stats = new Map();
  operated.forEach(({ analysis, scope }) => {
    scope.records.forEach((record) => {
      if (!stats.has(record.key)) {
        stats.set(record.key, {
          key: record.key,
          phase: record.phase,
          group: record.group,
          output: record.output,
          count: 0,
          sites: new Map(),
          types: new Map(),
          formats: new Map(),
        });
      }
      const stat = stats.get(record.key);
      stat.count += 1;
      increment(stat.sites, scope.site);
      increment(stat.types, analysis.courseType === "현지화" ? `현지화 ${analysis.localizationType}` : "오리지널");
      increment(stat.formats, analysis.courseFormat);
    });
  });

  return [...stats.values()].sort((a, b) => b.count - a.count || compareRecords(a, b));
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function render() {
  const proposal = calculateProposal();
  renderSummary(proposal);
  renderProposalFlow(proposal);
  renderAxes();
  renderModules(proposal);
  renderWorkSplit(proposal);
  renderRollout();
}

function renderSummary(proposal) {
  const currentDefinitionCount = proposal.analyses.length;
  const reduction = Math.round((1 - proposal.proposedRuleCount / currentDefinitionCount) * 100);
  els.summaryGrid.innerHTML = [
    renderSummaryCard("현재 정의 케이스", currentDefinitionCount, "유형 × 현지화유형 × 포맷 기준"),
    renderSummaryCard("실제 운영 케이스", proposal.totalScopeCases, "국가/언어별 실제 운영 조합"),
    renderSummaryCard("제안 운영 모듈", proposal.proposedRuleCount, "공통 2개 + 옵션 업무"),
    renderSummaryCard("축소 가능률", `${reduction}%`, `${currentDefinitionCount}개 기준안을 모듈화했을 때`),
    renderSummaryCard("운영 클러스터", proposal.operationClusterCount, "작업주체/규격까지 반영한 실제 패턴"),
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

function renderProposalFlow(proposal) {
  els.proposalRuleCount.textContent = `${proposal.proposedRuleCount}개 모듈`;
  els.proposalFlow.innerHTML = `
    <article class="flow-card is-current">
      <h3>현재 방식</h3>
      <strong>${proposal.analyses.length}개</strong>
      <p>코스 유형, 현지화 유형, 코스 포맷을 먼저 나누고 국가/언어별 업무 차이를 비교합니다.</p>
      <ul>
        <li>포맷별 반복 케이스가 계속 생성됨</li>
        <li>국가 차이가 업무 조건이 아니라 별도 케이스처럼 보임</li>
        <li>더빙/확장처럼 논의 중인 영역도 전체 판단을 흐림</li>
      </ul>
    </article>
    <div class="flow-arrow" aria-hidden="true">→</div>
    <article class="flow-card is-proposed">
      <h3>제안 방식</h3>
      <strong>${proposal.proposedRuleCount}개</strong>
      <p>공통 업무 템플릿을 먼저 두고, 국가/언어/포맷/유형 차이는 옵션 조건으로 붙입니다.</p>
      <ul>
        <li>코스 포맷은 시그니처/에셋 예외만 옵션 처리</li>
        <li>국가는 업무별 포함 여부, 규격, 작업주체 필드로 관리</li>
        <li>더빙/확장은 확정 전까지 별도 예외 버킷으로 분리</li>
      </ul>
    </article>
  `;
}

function renderAxes() {
  const axes = [
    {
      title: "국가/언어",
      mode: "케이스 축에서 제외",
      className: "is-remove",
      body: "KR, JP, GL을 별도 케이스로 두지 않고 업무별 포함 여부, 규격, 작업주체 조건으로 둡니다.",
      tags: ["KR", "JP", "GL EN", "GL ZH-TW", "GL TH"],
    },
    {
      title: "코스 포맷",
      mode: "옵션 산출물만 유지",
      className: "is-option",
      body: "대부분 포맷은 같은 흐름을 공유합니다. 시그니처와 에셋에서만 추가 산출물을 붙입니다.",
      tags: ["시그니처: 포맷 전용 페이지", "에셋: 큐레이션 배너"],
    },
    {
      title: "코스 유형/현지화 유형",
      mode: "운영 시나리오로 축소",
      className: "is-exception",
      body: "오리지널/정규/폐강옵션은 오가닉 옵션 차이로 흡수하고, 더빙/확장은 확정 전 예외로 둡니다.",
      tags: ["오리지널", "정규", "폐강옵션", "더빙 확인", "확장 예외"],
    },
  ];

  els.axisGrid.innerHTML = axes
    .map(
      (axis) => `
        <article class="axis-card ${axis.className}">
          <h3>${escapeHtml(axis.title)}</h3>
          <strong>${escapeHtml(axis.mode)}</strong>
          <p>${escapeHtml(axis.body)}</p>
          ${renderTags(axis.tags)}
        </article>
      `
    )
    .join("");
}

function renderModules(proposal) {
  const formatOptions = proposal.options.filter((record) => ["포맷 전용 페이지", "큐레이션 배너"].includes(record.output));
  const organicOptions = proposal.options.filter((record) => !["포맷 전용 페이지", "큐레이션 배너"].includes(record.output));
  const modules = [
    {
      title: "공통 코어 템플릿",
      count: proposal.core.length,
      className: "is-core",
      body: "모든 운영 케이스에 들어가는 업무입니다. 국가/유형/포맷과 무관하게 기본값으로 둡니다.",
      tags: proposal.core.map(formatRecordLabel),
    },
    {
      title: "기본 런칭 패키지",
      count: proposal.nearCore.length,
      className: "is-core",
      body: "거의 모든 케이스에 들어가므로 기본값으로 두고 일부 미운영 조건만 예외 처리합니다.",
      tags: proposal.nearCore.map(formatRecordLabel),
    },
    {
      title: "오가닉/CRM 옵션",
      count: organicOptions.length,
      className: "is-option",
      body: "현재 케이스 폭증의 주 원인입니다. 코스 케이스가 아니라 선택형 업무 옵션으로 관리합니다.",
      tags: organicOptions.map(formatRecordLabel),
    },
    {
      title: "포맷 예외 옵션",
      count: formatOptions.length,
      className: "is-option",
      body: "포맷 전체를 나누지 않고 해당 산출물만 조건부로 추가합니다.",
      tags: formatOptions.map(formatRecordLabel),
    },
    {
      title: "국가/언어 파라미터",
      count: 5,
      className: "is-exception",
      body: "국가를 케이스 축으로 쓰지 않고 각 업무에 적용되는 조건값으로 둡니다.",
      tags: ["포함 여부", "규격", "작업주체", "확인 필요"],
    },
    {
      title: "논의/예외 버킷",
      count: 2,
      className: "is-exception",
      body: "KR 더빙과 GL 확장은 확정 전까지 공통화 판단에서 분리해 관리합니다.",
      tags: ["KR/JP 더빙", "GL 확장", "GL TH 오리지널 미운영"],
    },
  ];

  els.moduleCount.textContent = `${modules.length}개 그룹`;
  els.moduleGrid.innerHTML = modules
    .map(
      (module) => `
        <article class="module-card ${module.className}">
          <h3>${escapeHtml(module.title)}</h3>
          <strong>${escapeHtml(module.count)}개</strong>
          <p>${escapeHtml(module.body)}</p>
          ${renderTags(module.tags)}
        </article>
      `
    )
    .join("");
}

function renderWorkSplit(proposal) {
  const rows = [
    ...proposal.core.map((record) => ({ record, type: "is-core", label: "공통 코어", rule: "항상 기본 포함" })),
    ...proposal.nearCore.map((record) => ({ record, type: "is-near", label: "기본 패키지", rule: "기본 포함 후 미운영 국가/유형만 제외" })),
    ...proposal.options.map((record) => ({ record, type: "is-option", label: "옵션", rule: getOptionRule(record) })),
  ];

  els.workSplitCount.textContent = `${rows.length}개 업무`;
  els.workSplitBody.innerHTML = rows
    .map(
      ({ record, type, label, rule }) => `
        <tr class="${type}">
          <td><span class="rule-pill ${type.replace("is-", "is-")}">${escapeHtml(label)}</span></td>
          <td>
            <div class="case-name">${escapeHtml(record.output)}</div>
            <div class="case-note">${escapeHtml(record.phase)} · ${escapeHtml(record.group)}</div>
          </td>
          <td>${escapeHtml(formatCoverage(record))}</td>
          <td>${escapeHtml(rule)}</td>
        </tr>
      `
    )
    .join("");
}

function getOptionRule(record) {
  if (record.output === "포맷 전용 페이지") return "시그니처 포맷에서만 산출물 옵션으로 추가";
  if (record.output === "큐레이션 배너") return "에셋 포맷에서만 산출물 옵션으로 추가";
  if (record.group === "오가닉") return "런칭/국가 운영 방식에 따라 오가닉 옵션으로 선택";
  if (record.group === "CRM") return "KR 등 특정 채널 운영 시에만 CRM 옵션으로 선택";
  return "특정 운영 조건에서만 옵션으로 선택";
}

function formatCoverage(record) {
  const siteText = [...record.sites.entries()].map(([site, count]) => `${site} ${count}`).join(" · ");
  return `${record.count}개 운영 케이스 / ${siteText}`;
}

function renderRollout() {
  const steps = [
    {
      title: "공통 코어 고정",
      body: "항상 포함되는 업무를 기본 템플릿으로 잠그고 케이스 비교에서 제외합니다.",
    },
    {
      title: "포맷 축 제거",
      body: "코스 포맷 8종을 케이스 축에서 빼고 시그니처/에셋 산출물만 조건으로 둡니다.",
    },
    {
      title: "오가닉 옵션화",
      body: "차이를 만드는 오가닉 업무를 국가/유형 조건이 달린 선택 모듈로 분리합니다.",
    },
    {
      title: "예외 버킷 운영",
      body: "더빙, 확장, 미운영 언어는 확정 전까지 공통화 점수에서 별도 관리합니다.",
    },
  ];

  els.rolloutList.innerHTML = steps
    .map(
      (step, index) => `
        <article class="rollout-item">
          <span>${index + 1}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.body)}</p>
        </article>
      `
    )
    .join("");
}

function renderTags(tags) {
  if (!tags.length) return "";
  return `<div class="tag-stack">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function formatRecordLabel(record) {
  return `${record.output} · ${record.phase}`;
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
    render();
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
  if (Object.prototype.hasOwnProperty.call(row, "file_extension")) override.fileExtension = row.file_extension || "";
  if (Object.prototype.hasOwnProperty.call(row, "request_owner")) override.requestOwner = row.request_owner || "";
  if (Object.prototype.hasOwnProperty.call(row, "work_owner")) override.workOwner = row.work_owner || "";
  return override;
}

function normalizeCheckValue(value) {
  return isNo(value) ? "X" : "O";
}

function compareRecords(a, b) {
  return getPhaseRank(a.phase) - getPhaseRank(b.phase) || getGroupRank(a.group) - getGroupRank(b.group) || compareText(a.output, b.output);
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ko");
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

render();
initSharedSync();
