const sourceRows = [
  ["", "국가(사이트)", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "언어", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "포맷/산출물", "얼리버드", "", "", "", "", "", "", "", "상세페이지 오픈", "", "", "", "", "", "", "", "", "", "", "", "영상공개", "", "", "", "", "", ""],
  ["", "", "얼리버드 오가닉", "", "", "", "", "", "사이트", "얼리버드 오가닉", "사이트", "", "", "", "", "오가닉", "", "", "", "", "", "", "사이트", "오가닉", "", "", "", "", ""],
  ["", "", "콜로소 공계 피드", "", "스토리", "연사용 공계 피드", "", "카카오톡", "코스카드 썸네일", "EDM", "상세페이지", "메인배너", "큐레이션 배너", "포맷 전용 페이지", "", "피드", "", "스토리", "연사용 공계 피드", "", "EDM", "광고", "상세페이지 수정", "콜로소 공계 피드", "", "스토리", "연사용 오가닉", "", "광고"],
  ["", "", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "", "", "", "메인 페이지 ", "개별 상세 페이지", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "1:1", "4:5", "", "1:1", "4:5", ""],
];

const siteLanguageOptions = [
  { site: "KR", language: "KO", region: "KR" },
  { site: "JP", language: "JO", region: "JP" },
  { site: "GL", language: "EN", region: "GL" },
  { site: "GL", language: "ZH-TW", region: "TW" },
  { site: "GL", language: "TH", region: "TH" },
];
const regions = ["KR", "JP", "GL", "TW", "TH"];
const departments = ["온사이트", "오가닉", "CRM", "페이드"];
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
  insightList: document.getElementById("insightList"),
  heatmapCount: document.getElementById("heatmapCount"),
  heatmapHead: document.getElementById("heatmapHead"),
  heatmapBody: document.getElementById("heatmapBody"),
  leadTimeChart: document.getElementById("leadTimeChart"),
  reworkChart: document.getElementById("reworkChart"),
  standardGauge: document.getElementById("standardGauge"),
  datasetCount: document.getElementById("datasetCount"),
  schemaList: document.getElementById("schemaList"),
  sampleHead: document.getElementById("sampleHead"),
  sampleBody: document.getElementById("sampleBody"),
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
  if (item.group === "오가닉" && item.output === "연사용 스토리") {
    return item.phase === "얼리버드" ? "O" : "X";
  }
  return "O";
}

function getDefaultWorkOwner(item) {
  if (item.site === "KR" && item.group === "페이드" && item.output === "광고") return "마케터";
  return "";
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

function buildCaseAnalyses() {
  return buildCaseDefinitions().map(analyzeCase);
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

function analyzeCase(definition) {
  const scopes = siteLanguageOptions.map((scope) => buildScopeAnalysis(scope, definition));
  const availableScopes = scopes.filter((scope) => scope.state === "available");
  const baselineSignature = getMajorityScopeSignature(availableScopes);
  const differentScopes = availableScopes.filter((scope) => !baselineSignature || scope.operationSignature !== baselineSignature);
  const sameScopes = availableScopes.filter((scope) => baselineSignature && scope.operationSignature === baselineSignature);
  const records = buildTaskUnion(availableScopes);

  return {
    ...definition,
    scopes,
    availableScopes,
    sameScopes,
    differentScopes,
    records,
  };
}

function buildScopeAnalysis(scope, definition) {
  const state = getScopeState(scope, definition);
  const records = state === "available" ? buildOutputRecords(getCaseItems(scope, definition)) : [];
  const recordMap = new Map(records.map((record) => [record.key, record]));
  return {
    ...scope,
    courseType: definition.courseType,
    localizationType: definition.localizationType,
    courseFormat: definition.courseFormat,
    caseKey: definition.key,
    label: scope.region,
    state,
    records,
    recordMap,
    operationSignature: records.map((record) => [record.key, record.workOwnerKey, record.sizeKey].join("||")).join("\n"),
  };
}

function getScopeState(scope, definition) {
  if (isDiscussionScope(scope, definition)) return "discussion";
  if (!getLocalizationTypes(scope.site, scope.language, definition.courseType).includes(definition.localizationType)) return "unavailable";
  return items.some((item) => matchesCase(item, scope, definition)) ? "available" : "unavailable";
}

function isDiscussionScope(scope, definition) {
  return (
    (["KR", "JP"].includes(scope.site) && definition.courseType === "현지화" && definition.localizationType === "더빙") ||
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
  return {
    ...record,
    sizes,
    workOwners,
    sizeKey: sizes.join(","),
    workOwnerKey: workOwners.join(","),
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
      if (!union.has(record.key)) union.set(record.key, record);
    });
  });
  return [...union.values()].sort(compareRecords);
}

function getMajorityScopeSignature(scopes) {
  const counts = new Map();
  scopes.forEach((scope) => counts.set(scope.operationSignature, (counts.get(scope.operationSignature) || 0) + 1));
  const sorted = [...counts.entries()].sort(([, countA], [, countB]) => countB - countA);
  if (!sorted.length) return "";
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return "";
  return sorted[0][0];
}

function calculateMetrics() {
  const analyses = buildCaseAnalyses();
  const availableScopes = analyses.flatMap((analysis) => analysis.availableScopes);
  const sameScopes = analyses.flatMap((analysis) => analysis.sameScopes);
  const differentScopes = analyses.flatMap((analysis) => analysis.differentScopes);
  const totalWorkItems = availableScopes.reduce((total, scope) => total + scope.records.length, 0);
  const sameWorkItems = sameScopes.reduce((total, scope) => total + scope.records.length, 0);
  const differentWorkItems = differentScopes.reduce((total, scope) => total + scope.records.length, 0);
  const heatmap = buildHeatmap(analyses);
  const drivers = buildDrivers(analyses);
  const topHeatmapCell = [...heatmap.values()].sort((a, b) => b.different - a.different)[0];
  return {
    analyses,
    availableScopes,
    sameScopes,
    differentScopes,
    totalWorkItems,
    sameWorkItems,
    differentWorkItems,
    commonRate: availableScopes.length ? sameScopes.length / availableScopes.length : 0,
    heatmap,
    drivers,
    topHeatmapCell,
  };
}

function buildHeatmap(analyses) {
  const heatmap = new Map();
  regions.forEach((region) => {
    departments.forEach((department) => {
      heatmap.set(`${region}|${department}`, { region, department, total: 0, different: 0 });
    });
  });
  analyses.forEach((analysis) => {
    const differentScopeSet = new Set(analysis.differentScopes.map((scope) => `${scope.region}|${analysis.key}`));
    analysis.availableScopes.forEach((scope) => {
      scope.records.forEach((record) => {
        const cell = heatmap.get(`${scope.region}|${record.group}`);
        if (!cell) return;
        cell.total += 1;
        if (differentScopeSet.has(`${scope.region}|${analysis.key}`)) cell.different += 1;
      });
    });
  });
  return heatmap;
}

function buildDrivers(analyses) {
  const drivers = { workMissing: 0, ownerDiff: 0, sizeDiff: 0, languageDiff: 0 };
  analyses.forEach((analysis) => {
    analysis.records.forEach((record) => {
      const states = analysis.availableScopes.map((scope) => scope.recordMap.get(record.key));
      if (new Set(states.map((state) => (state ? "present" : "absent"))).size > 1) drivers.workMissing += 1;
      if (new Set(states.filter(Boolean).map((state) => state.workOwnerKey)).size > 1) drivers.ownerDiff += 1;
      if (new Set(states.filter(Boolean).map((state) => state.sizeKey)).size > 1) drivers.sizeDiff += 1;
      const glStates = analysis.availableScopes
        .filter((scope) => ["GL", "TW", "TH"].includes(scope.region))
        .map((scope) => scope.recordMap.get(record.key))
        .map((state) => (state ? [state.workOwnerKey, state.sizeKey].join("|") : "absent"));
      if (glStates.length > 1 && new Set(glStates).size > 1) drivers.languageDiff += 1;
    });
  });
  return drivers;
}

function render() {
  const metrics = calculateMetrics();
  renderSummary(metrics);
  renderInsights(metrics);
  renderHeatmap(metrics);
  renderComparisonCharts(metrics);
  renderGauge(metrics);
  renderSchema(metrics);
  renderSampleRows(metrics);
}

function renderSummary(metrics) {
  els.summaryGrid.innerHTML = [
    renderSummaryCard("실제 운영 케이스", metrics.availableScopes.length, "권역/언어별 운영 중인 케이스"),
    renderSummaryCard("전체 업무 항목", metrics.totalWorkItems, "현재 기준에서 실제 대응해야 하는 업무량"),
    renderSummaryCard("상이 케이스", metrics.differentScopes.length, "공통 기준과 다르게 운영되는 케이스"),
    renderSummaryCard("동일 케이스", metrics.sameScopes.length, "현재 기준으로 공통 운영 가능한 케이스"),
    renderSummaryCard("공통 운영 가능률", formatPercent(metrics.commonRate), "동일 케이스 / 실제 운영 케이스"),
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

function renderInsights(metrics) {
  const top = metrics.topHeatmapCell;
  const insights = [
    `현재 실제 운영 케이스 ${metrics.availableScopes.length}개 중 ${metrics.differentScopes.length}개가 공통 기준과 다르게 운영되어, 권역별 예외 대응이 디자인팀 병목으로 누적되고 있습니다.`,
    `전체 업무 항목은 ${metrics.totalWorkItems}개이며, 이 중 상이 케이스에 포함된 업무 항목만 ${metrics.differentWorkItems}개입니다.`,
    `${top.region} ${top.department} 영역에서 비공통 업무 ${top.different}개가 잡혀 우선 정리 대상입니다.`,
    `상이 원인은 업무 포함 여부 ${metrics.drivers.workMissing}건, 작업주체 차이 ${metrics.drivers.ownerDiff}건, 규격 차이 ${metrics.drivers.sizeDiff}건으로 분해됩니다.`,
    "현재 데이터에는 요청 부서, 리드타임, 재작업 횟수, 협의 이슈 필드가 없으므로 시간 손실과 재작업 비용은 추가 로깅이 필요합니다.",
  ];
  els.insightList.innerHTML = insights.map((insight) => `<div class="insight-item">${escapeHtml(insight)}</div>`).join("");
}

function renderHeatmap(metrics) {
  const maxDifferent = Math.max(1, ...[...metrics.heatmap.values()].map((cell) => cell.different));
  els.heatmapCount.textContent = `${metrics.differentWorkItems}개 비공통 업무`;
  els.heatmapHead.innerHTML = `
    <tr>
      <th>권역</th>
      ${departments.map((department) => `<th>${escapeHtml(department)}</th>`).join("")}
    </tr>
  `;
  els.heatmapBody.innerHTML = regions
    .map(
      (region) => `
        <tr>
          <th>${escapeHtml(region)}</th>
          ${departments
            .map((department) => {
              const cell = metrics.heatmap.get(`${region}|${department}`);
              const alpha = 0.12 + (cell.different / maxDifferent) * 0.6;
              return `
                <td class="heatmap-cell" style="background: rgba(182, 70, 70, ${alpha.toFixed(2)})">
                  <strong>${cell.different}</strong>
                  <span>비공통 / 전체 ${cell.total}</span>
                </td>
              `;
            })
            .join("")}
        </tr>
      `
    )
    .join("");
}

function renderComparisonCharts(metrics) {
  renderBarChart(els.leadTimeChart, [
    { label: "동일 케이스 평균 업무", value: averageRecords(metrics.sameScopes), className: "is-normal", suffix: "개" },
    { label: "상이 케이스 평균 업무", value: averageRecords(metrics.differentScopes), className: "is-issue", suffix: "개" },
  ]);
  renderBarChart(els.reworkChart, [
    { label: "업무 포함 여부 차이", value: metrics.drivers.workMissing, className: "is-issue", suffix: "건" },
    { label: "작업주체 차이", value: metrics.drivers.ownerDiff, className: "is-issue", suffix: "건" },
    { label: "규격 차이", value: metrics.drivers.sizeDiff, className: "is-issue", suffix: "건" },
    { label: "GL 언어별 차이", value: metrics.drivers.languageDiff, className: "is-issue", suffix: "건" },
  ]);
}

function averageRecords(scopes) {
  if (!scopes.length) return 0;
  return scopes.reduce((total, scope) => total + scope.records.length, 0) / scopes.length;
}

function renderBarChart(container, rows) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  container.innerHTML = rows
    .map((row) => {
      const width = Math.max(10, (row.value / maxValue) * 100);
      return `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(row.label)}</span>
            <strong>${row.value.toFixed(1)}${escapeHtml(row.suffix)}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${row.className}" style="width: ${width.toFixed(1)}%">
              ${row.value.toFixed(1)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGauge(metrics) {
  const degrees = Math.round(metrics.commonRate * 360);
  els.standardGauge.innerHTML = `
    <div class="gauge" style="--value: ${degrees}deg">
      <strong>${formatPercent(metrics.commonRate)}</strong>
      <span>Common</span>
    </div>
    <p class="gauge-note">실제 운영 케이스 중 현재 기준으로 공통 운영 가능한 비율입니다.</p>
  `;
}

function renderSchema(metrics) {
  const schema = [
    ["Region", "KR, JP, GL, TW, TH로 산정"],
    ["Work_Group", "온사이트, 오가닉, CRM, 페이드"],
    ["Course_Type / Format", "오리지널/현지화와 코스 포맷"],
    ["Localization_Type", "폐강옵션, 정규, 더빙, 확장"],
    ["Work_Output", "업무명"],
    ["Size", "규격 차이 산정"],
    ["Work_Owner", "작업주체 차이 산정"],
    ["Work_Included / Type_Fit", "실제 운영 업무 포함 여부 산정"],
  ];
  els.datasetCount.textContent = `${metrics.availableScopes.length} 케이스`;
  els.schemaList.innerHTML = schema
    .map(
      ([name, description]) => `
        <div class="schema-item">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(description)}</span>
        </div>
      `
    )
    .join("");
}

function renderSampleRows(metrics) {
  const rows = metrics.availableScopes.slice(0, 10).map((scope) => ({
    Region: scope.region,
    Course_Type: scope.courseType,
    Localization_Type: scope.localizationType,
    Course_Format: scope.courseFormat,
    Work_Count: scope.records.length,
    Signature_State: metrics.differentScopes.includes(scope) ? "Different" : "Common",
  }));
  const columns = ["Region", "Course_Type", "Localization_Type", "Course_Format", "Work_Count", "Signature_State"];
  els.sampleHead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  els.sampleBody.innerHTML = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`)
    .join("");
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
  return ["얼리버드", "상세페이지 오픈", "영상공개"].indexOf(phase);
}

function getGroupRank(group) {
  if (group === "온사이트") return 0;
  if (group === "오가닉") return 1;
  if (group === "CRM") return 2;
  if (group === "페이드") return 3;
  return 9;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
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
