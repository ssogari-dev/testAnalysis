// ===============================================================================
// 심화 성적 분석
// - 반별 요약표 / 전국 대비 위치 / 등급 경계 학생 / 수능 최저 충족 시뮬레이션 / 선택과목별 비교
// - 국어·수학 산점도 / 학급별 평균 편차 / 학급별 등급 히트맵 / 학급별 성적 분포(상자 수염)
// 등급은 모두 studentGradeFor·exploreEntryGrade(성적 분석·내보내기와 같은 함수)로 매긴다.
// 백분위는 성적표의 공식 값, 없으면 등급컷을 불러온 시험 자료로 역산한 값을 쓴다.
// ===============================================================================

// 전국 등급 비율(상대평가 9등급 기준, %)
const NATIONAL_GRADE_RATIO = [4, 7, 12, 17, 20, 17, 12, 7, 4];
// 백분위로 본 등급 경계(누적 4·11·23%) — 산점도 기준선
const PCT_GRADE_LINES = [{ v: 96, g: 1 }, { v: 89, g: 2 }, { v: 77, g: 3 }];

const advState = {
  boundaryGap: 2,
  heatmapMode: 'count', // 'count' | 'ratio'
  minRule: { kor: true, math: true, eng: true, exp: true, expMode: 'best1', n: 2, sum: 5, his: '' }
};
const MIN_PRESETS = [
  { label: '2개 합 4', n: 2, sum: 4 }, { label: '2개 합 5', n: 2, sum: 5 }, { label: '2개 합 6', n: 2, sum: 6 },
  { label: '3개 합 6', n: 3, sum: 6 }, { label: '3개 합 7', n: 3, sum: 7 }, { label: '3개 합 9', n: 3, sum: 9 }
];

// ------------------- 공통 계산 -------------------
const advNum = v => (typeof toScore === 'function' ? toScore(v) : Number(v));
const advMean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
const advFmt = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(d);
const advPct = (a, b) => b ? (a / b * 100) : NaN;
const advGrade = (s, subj) => studentGradeFor(s, subj, 'target');
const advExploreGrades = s => studentExploreEntries(s).map(e => exploreEntryGrade(e, 'target')).filter(g => g !== null);

// 파일에 학년이 여럿이면 "2학년 1반", 하나면 "1반"
function advClassKey(s) { return `${s.학년}-${String(s.반).padStart(2, '0')}`; }
function advClassLabel(key, multiGrade) {
  const [g, c] = key.split('-');
  return multiGrade ? `${g}학년 ${Number(c)}반` : `${Number(c)}반`;
}
function advClassGroups(data) {
  const multiGrade = new Set(data.map(s => String(s.학년))).size > 1;
  const map = new Map();
  data.forEach(s => {
    const k = advClassKey(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  });
  const keys = [...map.keys()].sort();
  return { multiGrade, keys, map, label: k => advClassLabel(k, multiGrade) };
}

// 학생의 과목 백분위 / 탐구 평균 백분위
const advPctOf = rec => advNum(rec?.백분위);
function advExplorePct(s) {
  const v = studentExploreEntries(s).map(e => advNum(e.백분위)).filter(n => !isNaN(n));
  return v.length ? advMean(v) : NaN;
}
function advExploreStd(s) {
  const v = studentExploreEntries(s).map(e => advNum(e.표준점수)).filter(n => !isNaN(n));
  return v.length ? advMean(v) : NaN;
}
// 백분위가 대부분(절반 이상) 있을 때만 백분위 기준으로 분석하고, 아니면 표준점수로 대신한다
function advHasPercentiles(data) {
  const withPct = data.filter(s => !isNaN(advPctOf(s.국어)) || !isNaN(advPctOf(s.수학))).length;
  return data.length > 0 && withPct / data.length >= 0.5;
}

// 선형 보간 사분위수
function advQuantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function advCardHtml(id, title, summary, detail, body) {
  return `<section class="adv-card" id="${id}">
    <div class="adv-card-head"><h4>${title}</h4></div>
    <p class="adv-desc">${summary}</p>
    ${detail ? `<details class="adv-more"><summary>자세히</summary><div>${detail}</div></details>` : ''}
    <div class="adv-body">${body}</div>
  </section>`;
}

// ------------------- 탭 뼈대 -------------------
function buildAdvancedSectionHtml() {
  const nav = [
    ['advClassSummary', '반별 요약'], ['advNational', '전국 대비'], ['advBoundary', '등급 경계 학생'],
    ['advMinimum', '수능 최저'], ['advElective', '선택과목 비교'], ['advScatterCard', '국어·수학 산점도'],
    ['advDeviation', '학급 평균 편차'], ['advHeatmap', '등급 히트맵'], ['advBoxplot', '성적 분포']
  ];
  return `
    <div class="adv-toolbar">
      <button id="showAdvancedBtn" class="copy-btn" onclick="renderAdvancedCharts()">데이터 새로고침</button>
      <nav class="adv-nav">${nav.map(([id, t]) => `<a href="#${id}" onclick="document.getElementById('${id}')?.scrollIntoView({behavior:'smooth'});return false;">${t}</a>`).join('')}</nav>
    </div>
    <p class="adv-note" id="advDataNote"></p>
    <div id="advancedResult" class="adv-grid" style="display:none;">
      ${advCardHtml('advClassSummary', '반별 요약표',
        '반마다 과목별 평균 백분위, 1~2등급 비율, 주요 영역 평균이 4등급 이하인 학생 비율을 한 표로 봅니다.',
        '주요 영역 평균 등급 = 국어·수학·영어·탐구(상위 1과목) 등급의 평균. 값이 없는 영역은 빼고 계산합니다. 표 아래 버튼으로 복사해 한글·엑셀에 붙여 넣을 수 있습니다.',
        '<div id="advClassSummaryBody"></div>')}
      ${advCardHtml('advNational', '전국 대비 위치',
        '우리 학교 등급 비율을 전국 기준 비율(1등급 4%, 누적 11%·23%·40%)과 나란히 놓습니다.',
        '상대평가 과목(국어·수학·탐구)만 비교합니다. 영어·한국사는 절대평가라 전국 기준 비율이 정해져 있지 않습니다. 배율이 1보다 크면 그 등급대 비율이 전국보다 높다는 뜻입니다. 평균 백분위는 50이 전국 중간입니다.',
        '<div id="advNationalBody"></div><div class="adv-chart"><canvas id="advNationalChart"></canvas></div>')}
      ${advCardHtml('advBoundary', '등급 경계 학생',
        '다음 등급까지 몇 점만 모자란 학생을 과목별로 찾습니다. 집중 지도 대상을 고를 때 씁니다.',
        '불러온 등급컷 기준입니다. 국어·수학·탐구는 표준점수, 영어는 원점수(성적표에 있을 때)로 계산합니다. 탐구는 학생이 본 과목의 등급컷을 씁니다.',
        '<div id="advBoundaryBody"></div>')}
      ${advCardHtml('advMinimum', '수능 최저학력기준 충족 시뮬레이션',
        '조건을 정하면 충족하는 학생 수와 명단을 반별로 보여 줍니다. 합이 1 모자라 아깝게 못 채운 학생도 따로 보여 줍니다.',
        '선택한 영역 중 등급이 좋은 N개의 합으로 판정합니다. 탐구는 상위 1과목 또는 2과목 평균(절사/올림) 중에서 고릅니다. 한국사 조건은 비워 두면 적용하지 않습니다.',
        '<div id="advMinimumControls"></div><div id="advMinimumBody"></div>')}
      ${advCardHtml('advElective', '선택과목별 비교',
        '화법과 작문·언어와 매체, 확률과 통계·미적분·기하, 탐구 과목별 응시 인원과 성취를 비교합니다.',
        '선택과목끼리 표준점수 척도가 달라 평균 표준점수보다 평균 백분위·등급 비율로 비교하는 편이 정확합니다. 공통과목만 있는 학년(1·2학년 국어·수학)은 표시하지 않습니다.',
        '<div id="advElectiveBody"></div>')}
      ${advCardHtml('advScatterCard', '국어·수학 산점도',
        '학생 한 명을 점 하나로 찍어 두 과목의 균형을 봅니다. 대각선 아래는 국어 강세, 위는 수학 강세입니다.',
        '백분위가 있으면 백분위, 없으면 표준점수로 그립니다. 가로·세로 점선은 1·2·3등급 경계입니다. 범례의 반 이름을 누르면 그 반을 켜고 끌 수 있고, 점에 마우스를 올리면 학생 정보가 보입니다.',
        '<div class="adv-chart adv-chart-tall"><canvas id="advChartScatter"></canvas></div>')}
      ${advCardHtml('advDeviation', '학급별 평균 편차',
        '반 평균이 학년 평균보다 얼마나 높거나 낮은지(백분위 %p) 과목별로 봅니다.',
        '막대 이름 옆 숫자는 반 인원입니다. 인원이 적은 반은 몇 명의 점수로도 평균이 크게 움직이니 함께 보세요. 마우스를 올리면 영어 평균 등급도 보입니다.',
        '<div class="adv-chart adv-chart-tall"><canvas id="advChartDiverging"></canvas></div>')}
      ${advCardHtml('advHeatmap', '학급별 등급 분포 히트맵',
        '반마다 어느 등급대에 학생이 몰려 있는지 색 농도로 봅니다.',
        '색이 진할수록 그 반에서 해당 등급 비율이 높습니다. 오른쪽 열은 1~2등급 비율, 4등급 이하 비율, 응시 인원입니다. 탐구는 학생이 본 모든 탐구 과목을 합쳐 셉니다.',
        '<div id="advHeatmapContainer"></div>')}
      ${advCardHtml('advBoxplot', '학급별 성적 분포 (상자 수염)',
        '반 안에서 성적이 얼마나 퍼져 있는지 봅니다. 상자는 가운데 50% 학생, 가로선은 중앙값, 점은 유난히 높거나 낮은 학생입니다.',
        '기준 점수: 국어·수학·탐구 백분위의 평균(백분위가 없으면 국어+수학 표준점수). 결시 과목이 있는 학생은 뺍니다. 수염은 상자 끝에서 상자 길이의 1.5배 안쪽의 최저·최고점까지입니다.',
        '<div class="adv-chart adv-chart-tall"><canvas id="advChartBoxplot"></canvas></div>')}
    </div>`;
}

// ------------------- 전체 그리기 -------------------
window.renderAdvancedCharts = async function () {
  if (!parsedData || parsedData.length === 0) {
    if (typeof showMessage === 'function') showMessage('파싱된 정상적인 데이터가 없습니다. 1단계 성적 파일을 먼저 업로드해주세요.');
    return;
  }
  // 백분위가 비어 있으면 등급컷을 불러온 시험 자료로 먼저 채운다
  if (typeof estimateStudentsRawScores === 'function') {
    try { await estimateStudentsRawScores(parsedData); } catch (e) { /* 추정 실패는 무시 */ }
  }
  const box = document.getElementById('advancedResult');
  if (!box) return;
  box.style.display = '';
  const note = document.getElementById('advDataNote');
  if (note) {
    note.textContent = advHasPercentiles(parsedData)
      ? `분석 대상 ${parsedData.length}명 · 백분위 기준`
      : `분석 대상 ${parsedData.length}명 · 백분위가 없어 표준점수 기준으로 분석합니다 (등급컷을 불러오면 백분위로 바뀝니다)`;
  }
  const steps = [renderAdvClassSummary, renderAdvNational, renderAdvBoundary, renderAdvMinimumControls, renderAdvMinimum,
    renderAdvElective, renderAdvScatter, renderAdvDeviation, renderAdvHeatmap, renderAdvBoxplot];
  steps.forEach(fn => { try { fn(parsedData); } catch (e) { console.error(fn.name, e); } });
};

// ------------------- G. 반별 요약표 -------------------
function advMainAvgGrade(s) {
  const gs = [advGrade(s, '국어'), advGrade(s, '수학'), advGrade(s, '영어')];
  const eg = advExploreGrades(s);
  if (eg.length) gs.push(Math.min(...eg));
  const v = gs.filter(g => g !== null && g !== undefined);
  return v.length ? advMean(v) : NaN;
}
function advSummaryRow(label, list, usePct) {
  const avgOf = f => advMean(list.map(f).filter(n => !isNaN(n)));
  const ratio12 = subj => {
    const gs = list.map(s => advGrade(s, subj)).filter(g => g !== null);
    return advPct(gs.filter(g => g <= 2).length, gs.length);
  };
  const engGrades = list.map(s => advGrade(s, '영어')).filter(g => g !== null);
  const mains = list.map(advMainAvgGrade).filter(n => !isNaN(n));
  const kor = usePct ? avgOf(s => advPctOf(s.국어)) : avgOf(s => advNum(s.국어?.표준점수));
  const math = usePct ? avgOf(s => advPctOf(s.수학)) : avgOf(s => advNum(s.수학?.표준점수));
  const exp = usePct ? avgOf(advExplorePct) : avgOf(advExploreStd);
  return `<tr><td>${escapeHtml(label)}</td><td>${list.length}</td>
    <td>${advFmt(kor)}</td><td>${advFmt(math)}</td><td>${advFmt(exp)}</td><td>${advFmt(advMean(engGrades), 2)}</td>
    <td>${advFmt(ratio12('국어'))}</td><td>${advFmt(ratio12('수학'))}</td><td>${advFmt(ratio12('영어'))}</td>
    <td>${advFmt(advPct(mains.filter(v => v >= 4).length, mains.length))}</td></tr>`;
}
function renderAdvClassSummary(data) {
  const el = document.getElementById('advClassSummaryBody');
  if (!el) return;
  const usePct = advHasPercentiles(data);
  const unit = usePct ? '평균 백분위' : '평균 표준점수';
  const { keys, map, label } = advClassGroups(data);
  let html = `<div class="table-container"><table id="advClassSummaryTable" class="adv-table"><thead>
    <tr><th rowspan="2">반</th><th rowspan="2">인원</th><th colspan="3">${unit}</th><th rowspan="2">영어<br>평균 등급</th>
      <th colspan="3">1~2등급 비율(%)</th><th rowspan="2">주요 영역 평균<br>4등급 이하(%)</th></tr>
    <tr><th>국어</th><th>수학</th><th>탐구</th><th>국어</th><th>수학</th><th>영어</th></tr></thead><tbody>`;
  keys.forEach(k => { html += advSummaryRow(label(k), map.get(k), usePct); });
  html += advSummaryRow('전체', data, usePct).replace('<tr>', '<tr class="adv-total">');
  html += `</tbody></table></div>
    <button class="copy-btn mt-10" onclick="copyTableBodyAsHtml('advClassSummaryTable')">표 복사</button>`;
  el.innerHTML = html;
}

// ------------------- F. 전국 대비 위치 -------------------
function advGradeDistFor(data, subj) {
  const grades = subj === '탐구'
    ? data.flatMap(s => studentExploreEntries(s).map(e => exploreEntryGrade(e, 'target'))).filter(g => g !== null)
    : data.map(s => advGrade(s, subj)).filter(g => g !== null);
  const dist = Array(9).fill(0);
  grades.forEach(g => { if (g >= 1 && g <= 9) dist[g - 1]++; });
  return { dist, total: grades.length, ratio: dist.map(n => advPct(n, grades.length)) };
}
function renderAdvNational(data) {
  const el = document.getElementById('advNationalBody');
  if (!el) return;
  const subjects = ['국어', '수학', '탐구'];
  const dists = subjects.map(s => advGradeDistFor(data, s));
  const cumSchool = (d, upto) => d.ratio.slice(0, upto).reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
  const cumNat = upto => NATIONAL_GRADE_RATIO.slice(0, upto).reduce((a, b) => a + b, 0);
  const pctAvg = [
    advMean(data.map(s => advPctOf(s.국어)).filter(n => !isNaN(n))),
    advMean(data.map(s => advPctOf(s.수학)).filter(n => !isNaN(n))),
    advMean(data.flatMap(s => studentExploreEntries(s).map(e => advNum(e.백분위))).filter(n => !isNaN(n)))
  ];
  let html = `<div class="table-container"><table class="adv-table" id="advNationalTable"><thead>
    <tr><th rowspan="2">구분</th><th rowspan="2">전국</th>${subjects.map(s => `<th colspan="2">${s}</th>`).join('')}</tr>
    <tr>${subjects.map(() => '<th>우리 학교</th><th>배율</th>').join('')}</tr></thead><tbody>`;
  [[1, '1등급'], [2, '1~2등급'], [3, '1~3등급'], [4, '1~4등급']].forEach(([upto, lbl]) => {
    const nat = cumNat(upto);
    html += `<tr><td>${lbl}</td><td>${nat}%</td>` + dists.map(d => {
      if (!d.total) return '<td>-</td><td>-</td>';
      const v = cumSchool(d, upto);
      const r = v / nat;
      return `<td>${advFmt(v)}%</td><td class="${r >= 1 ? 'adv-up' : 'adv-down'}">${advFmt(r, 2)}배</td>`;
    }).join('') + '</tr>';
  });
  html += `<tr><td>평균 백분위</td><td>50</td>` + pctAvg.map(v => `<td>${advFmt(v)}</td><td class="${v >= 50 ? 'adv-up' : 'adv-down'}">${isNaN(v) ? '-' : (v >= 50 ? '+' : '') + advFmt(v - 50)}</td>`).join('') + '</tr>';
  html += `<tr><td>응시 인원</td><td>-</td>` + dists.map(d => `<td colspan="2">${d.total}${subjects[dists.indexOf(d)] === '탐구' ? '과목' : '명'}</td>`).join('') + '</tr>';
  html += '</tbody></table></div>';
  el.innerHTML = html;

  const chart = window.analysisChart;
  chart.destroyChart('advNationalChart');
  const ctx = document.getElementById('advNationalChart')?.getContext('2d');
  if (!ctx) return;
  const colors = ['rgba(220, 38, 38, 0.65)', 'rgba(37, 99, 235, 0.65)', 'rgba(5, 150, 105, 0.65)'];
  chart.charts.advNationalChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(g => g + '등급'),
      datasets: [
        ...dists.map((d, i) => ({ label: `${subjects[i]} (우리 학교)`, data: d.ratio.map(v => isNaN(v) ? 0 : +v.toFixed(2)), backgroundColor: colors[i], order: 2 })),
        { type: 'line', label: '전국 기준', data: NATIONAL_GRADE_RATIO, borderColor: '#111827', backgroundColor: '#111827', borderDash: [5, 4], pointRadius: 3, order: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: '비율(%)' } } },
      plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}%` } } }
    }
  });
}

// ------------------- A. 등급 경계 학생 -------------------
// 점수와 등급컷으로 "다음 등급까지 부족한 점수"를 계산한다
function advBoundaryFor(rec, cuts, scoreField) {
  if (!rec || !cutsAreUsable(cuts)) return null;
  const score = advNum(rec[scoreField]);
  if (isNaN(score)) return null;
  let g = 9;
  for (let i = 0; i < 8; i++) { if (score >= (cuts[i] || 0)) { g = i + 1; break; } }
  if (g <= 1) return null;
  const nextCut = Number(cuts[g - 2]);
  if (!(nextCut > 0)) return null;
  return { grade: g, score, nextCut, need: +(nextCut - score).toFixed(2) };
}
function advBoundaryRows(data, gap) {
  const out = [];
  let anyCuts = false;
  data.forEach(s => {
    ['국어', '수학', '영어'].forEach(subj => {
      const [raw, std] = cutsForSide(subj, 'target');
      const { cuts, scoreField } = pickGradingCuts(subj, raw, std, 'target');
      if (cutsAreUsable(cuts)) anyCuts = true;
      const b = advBoundaryFor(s[subj], cuts, scoreField);
      if (b && b.need > 0 && b.need <= gap) out.push({ s, subj, name: subj, field: scoreField, ...b });
    });
    studentExploreEntries(s).forEach(e => {
      const cat = e.분류 === 'science' ? '과학탐구' : '사회탐구';
      const [raw, std] = cutsForSide(cat, 'target');
      let { cuts, scoreField } = pickGradingCuts(cat, raw, std, 'target');
      const own = exploreCutsForRecord(e, scoreField);
      if (own) cuts = own;
      if (cutsAreUsable(cuts)) anyCuts = true;
      const b = advBoundaryFor(e, cuts, scoreField);
      if (b && b.need > 0 && b.need <= gap) out.push({ s, subj: '탐구', name: e.과목 || cat, field: scoreField, ...b });
    });
  });
  return { rows: out, anyCuts };
}
function renderAdvBoundary(data) {
  const el = document.getElementById('advBoundaryBody');
  if (!el) return;
  const gap = advState.boundaryGap;
  const { rows, anyCuts } = advBoundaryRows(data, gap);
  const controls = `<div class="adv-controls"><label>다음 등급까지
      <select onchange="advState.boundaryGap=Number(this.value);renderAdvBoundary(parsedData)">
        ${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${v === gap ? 'selected' : ''}>${v}점 이내</option>`).join('')}
      </select></label></div>`;
  if (!anyCuts) {
    el.innerHTML = controls + '<p class="adv-empty">등급컷을 불러와야 계산할 수 있습니다. (등급컷 탭에서 이 시험의 등급컷을 불러오세요)</p>';
    return;
  }
  const bySubj = ['국어', '수학', '영어', '탐구'].map(k => [k, rows.filter(r => r.subj === k).length]);
  rows.sort((a, b) => ['국어', '수학', '영어', '탐구'].indexOf(a.subj) - ['국어', '수학', '영어', '탐구'].indexOf(b.subj) || a.need - b.need || String(a.s.반).localeCompare(String(b.s.반)));
  const multi = new Set(data.map(s => String(s.학년))).size > 1;
  let html = controls + `<div class="adv-chips">${bySubj.map(([k, n]) => `<span class="adv-chip"><b>${k}</b> ${n}명</span>`).join('')}</div>`;
  if (!rows.length) {
    html += `<p class="adv-empty">다음 등급까지 ${gap}점 이내인 학생이 없습니다.</p>`;
  } else {
    html += `<div class="table-container"><table id="advBoundaryTable" class="adv-table"><thead><tr>
      ${multi ? '<th>학년</th>' : ''}<th>반</th><th>번호</th><th>이름</th><th>과목</th><th>현재 등급</th><th>점수</th><th>다음 등급 컷</th><th>부족</th></tr></thead><tbody>`;
    rows.forEach(r => {
      html += `<tr>${multi ? `<td>${r.s.학년}</td>` : ''}<td>${Number(r.s.반)}</td><td>${escapeHtml(r.s.번호)}</td><td>${escapeHtml(r.s.이름)}</td>
        <td>${escapeHtml(r.name)}</td><td>${r.grade}등급 → ${r.grade - 1}등급</td>
        <td>${r.score}<span class="adv-sub">${r.field === '원점수' ? ' (원)' : ' (표)'}</span></td><td>${r.nextCut}</td><td class="adv-need">${r.need}점</td></tr>`;
    });
    html += `</tbody></table></div><button class="copy-btn mt-10" onclick="copyTableBodyAsHtml('advBoundaryTable')">표 복사</button>`;
  }
  el.innerHTML = html;
}

// ------------------- C. 수능 최저 충족 시뮬레이션 -------------------
function renderAdvMinimumControls() {
  const el = document.getElementById('advMinimumControls');
  if (!el) return;
  const r = advState.minRule;
  const chk = (key, lbl) => `<label><input type="checkbox" ${r[key] ? 'checked' : ''} onchange="advState.minRule.${key}=this.checked;renderAdvMinimum(parsedData)"> ${lbl}</label>`;
  el.innerHTML = `<div class="adv-controls adv-controls-wrap">
    <div class="adv-presets">자주 쓰는 조건: ${MIN_PRESETS.map((p, i) => `<button class="action-btn-secondary btn-sm" onclick="advApplyMinPreset(${i})">${p.label}</button>`).join('')}</div>
    <div class="adv-row"><span class="adv-label">반영 영역</span>${chk('kor', '국어')}${chk('math', '수학')}${chk('eng', '영어')}${chk('exp', '탐구')}</div>
    <div class="adv-row"><span class="adv-label">탐구 반영</span>
      <select onchange="advState.minRule.expMode=this.value;renderAdvMinimum(parsedData)">
        <option value="best1" ${r.expMode === 'best1' ? 'selected' : ''}>상위 1과목</option>
        <option value="avg2floor" ${r.expMode === 'avg2floor' ? 'selected' : ''}>2과목 평균 (소수점 절사)</option>
        <option value="avg2ceil" ${r.expMode === 'avg2ceil' ? 'selected' : ''}>2과목 평균 (소수점 올림)</option>
      </select></div>
    <div class="adv-row"><span class="adv-label">조건</span>
      <label>등급 좋은 <input type="number" min="1" max="4" value="${r.n}" class="adv-num" onchange="advState.minRule.n=Number(this.value);renderAdvMinimum(parsedData)">개 영역</label>
      <label>합 <input type="number" min="1" max="36" value="${r.sum}" class="adv-num" onchange="advState.minRule.sum=Number(this.value);renderAdvMinimum(parsedData)"> 이내</label>
      <label>한국사 <input type="number" min="1" max="9" value="${r.his}" placeholder="없음" class="adv-num" onchange="advState.minRule.his=this.value;renderAdvMinimum(parsedData)"> 등급 이내</label>
    </div></div>`;
}
function advApplyMinPreset(i) {
  const p = MIN_PRESETS[i];
  Object.assign(advState.minRule, { n: p.n, sum: p.sum });
  renderAdvMinimumControls();
  renderAdvMinimum(parsedData);
}
function advExploreForMin(s, mode) {
  const gs = advExploreGrades(s).sort((a, b) => a - b);
  if (!gs.length) return null;
  if (mode === 'best1') return gs[0];
  if (gs.length < 2) return null; // 2과목 평균인데 1과목만 응시
  const avg = (gs[0] + gs[1]) / 2;
  return mode === 'avg2ceil' ? Math.ceil(avg) : Math.floor(avg);
}
function advMinimumEval(s, r) {
  const parts = [];
  if (r.kor) parts.push(['국어', advGrade(s, '국어')]);
  if (r.math) parts.push(['수학', advGrade(s, '수학')]);
  if (r.eng) parts.push(['영어', advGrade(s, '영어')]);
  if (r.exp) parts.push(['탐구', advExploreForMin(s, r.expMode)]);
  const valid = parts.filter(([, g]) => g !== null && g !== undefined).sort((a, b) => a[1] - b[1]);
  const his = advGrade(s, '한국사');
  const hisLimit = Number(r.his);
  const hisOk = !r.his || (his !== null && his <= hisLimit);
  if (valid.length < r.n) return { ok: false, sum: null, parts, his, hisOk, reason: '반영 영역 부족' };
  const sum = valid.slice(0, r.n).reduce((a, [, g]) => a + g, 0);
  return { ok: sum <= r.sum && hisOk, sum, parts, his, hisOk, near: sum === r.sum + 1 && hisOk };
}
function renderAdvMinimum(data) {
  const el = document.getElementById('advMinimumBody');
  if (!el) return;
  const r = advState.minRule;
  const areaCount = ['kor', 'math', 'eng', 'exp'].filter(k => r[k]).length;
  if (!areaCount || r.n < 1 || r.n > areaCount) {
    el.innerHTML = `<p class="adv-empty">반영 영역 수(${areaCount}개)보다 많은 영역(${r.n}개)을 합칠 수 없습니다.</p>`;
    return;
  }
  const evals = data.map(s => ({ s, e: advMinimumEval(s, r) }));
  const pass = evals.filter(x => x.e.ok);
  const near = evals.filter(x => !x.e.ok && x.e.near);
  const { keys, map, label } = advClassGroups(data);
  const cond = `${['국어', '수학', '영어', '탐구'].filter((_, i) => r[['kor', 'math', 'eng', 'exp'][i]]).join('·')} 중 ${r.n}개 합 ${r.sum} 이내${r.his ? `, 한국사 ${r.his}등급 이내` : ''}`;
  let html = `<div class="adv-chips"><span class="adv-chip adv-chip-strong">충족 ${pass.length}명 / ${data.length}명 (${advFmt(advPct(pass.length, data.length))}%)</span>
    <span class="adv-chip">합이 1 모자람 ${near.length}명</span><span class="adv-chip adv-chip-muted">${escapeHtml(cond)}</span></div>`;
  html += `<div class="table-container"><table class="adv-table" id="advMinimumClassTable"><thead><tr><th>반</th><th>인원</th><th>충족</th><th>비율(%)</th><th>1 모자람</th></tr></thead><tbody>`;
  keys.forEach(k => {
    const list = evals.filter(x => advClassKey(x.s) === k);
    const p = list.filter(x => x.e.ok).length;
    html += `<tr><td>${escapeHtml(label(k))}</td><td>${list.length}</td><td>${p}</td><td>${advFmt(advPct(p, list.length))}</td><td>${list.filter(x => !x.e.ok && x.e.near).length}</td></tr>`;
  });
  html += `<tr class="adv-total"><td>전체</td><td>${data.length}</td><td>${pass.length}</td><td>${advFmt(advPct(pass.length, data.length))}</td><td>${near.length}</td></tr></tbody></table></div>`;

  const listTable = (id, title, list) => {
    if (!list.length) return '';
    let t = `<h5 class="adv-subtitle">${title} (${list.length}명)</h5><div class="table-container"><table class="adv-table" id="${id}"><thead><tr>
      <th>반</th><th>번호</th><th>이름</th><th>국어</th><th>수학</th><th>영어</th><th>탐구</th><th>한국사</th><th>${r.n}개 합</th></tr></thead><tbody>`;
    list.slice().sort((a, b) => (a.e.sum ?? 99) - (b.e.sum ?? 99) || advClassKey(a.s).localeCompare(advClassKey(b.s))).forEach(({ s, e }) => {
      const g = n => { const p = e.parts.find(([k]) => k === n); return p ? (p[1] ?? '-') : '<span class="adv-sub">미반영</span>'; };
      t += `<tr><td>${escapeHtml(label(advClassKey(s)))}</td><td>${escapeHtml(s.번호)}</td><td>${escapeHtml(s.이름)}</td>
        <td>${g('국어')}</td><td>${g('수학')}</td><td>${g('영어')}</td><td>${g('탐구')}</td><td>${e.his ?? '-'}</td><td><b>${e.sum ?? '-'}</b></td></tr>`;
    });
    return t + `</tbody></table></div><button class="copy-btn mt-10" onclick="copyTableBodyAsHtml('${id}')">표 복사</button>`;
  };
  html += listTable('advMinimumPassTable', '충족 학생', pass);
  html += listTable('advMinimumNearTable', '합이 1 모자란 학생', near);
  el.innerHTML = html;
}

// ------------------- D. 선택과목별 비교 -------------------
function advElectiveStats(items) {
  // items: [{ std, pct, grade }]
  const n = items.length;
  const std = advMean(items.map(i => i.std).filter(v => !isNaN(v)));
  const pct = advMean(items.map(i => i.pct).filter(v => !isNaN(v)));
  const gs = items.map(i => i.grade).filter(g => g !== null && g !== undefined);
  return { n, std, pct, grade: advMean(gs), r12: advPct(gs.filter(g => g <= 2).length, gs.length), r4: advPct(gs.filter(g => g >= 4).length, gs.length) };
}
function renderAdvElective(data) {
  const el = document.getElementById('advElectiveBody');
  if (!el) return;
  const groupBy = (list, keyOf) => {
    const m = new Map();
    list.forEach(x => { const k = keyOf(x); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  };
  const sections = [];
  ['국어', '수학'].forEach(subj => {
    const m = groupBy(data.filter(s => String(s[subj]?.표준점수 || '').trim()), s => {
      const n = normalizeSubjectName(s[subj]?.과목 || '');
      return (!n || n === subj) ? null : n;
    });
    if (m.size) sections.push([subj, m, s => ({ std: advNum(s[subj].표준점수), pct: advPctOf(s[subj]), grade: advGrade(s, subj) })]);
  });
  const exps = data.flatMap(s => studentExploreEntries(s).map(e => ({ s, e })));
  const em = groupBy(exps, x => normalizeSubjectName(x.e.과목 || '') || null);
  if (em.size) sections.push(['탐구', em, x => ({ std: advNum(x.e.표준점수), pct: advNum(x.e.백분위), grade: exploreEntryGrade(x.e, 'target') })]);

  if (!sections.length) {
    el.innerHTML = '<p class="adv-empty">선택과목 정보가 없습니다. (공통과목만 있는 학년이거나, 성적 파일에 과목명이 없습니다)</p>';
    return;
  }
  let html = '';
  sections.forEach(([title, m, pick], si) => {
    const rows = [...m.entries()].map(([name, list]) => [name, advElectiveStats(list.map(pick))]).sort((a, b) => b[1].n - a[1].n);
    const id = 'advElectiveTable' + si;
    html += `<h5 class="adv-subtitle">${title}</h5><div class="table-container"><table class="adv-table" id="${id}"><thead><tr>
      <th>과목</th><th>응시</th><th>평균 표준점수</th><th>평균 백분위</th><th>평균 등급</th><th>1~2등급(%)</th><th>4등급 이하(%)</th></tr></thead><tbody>`;
    rows.forEach(([name, st]) => {
      html += `<tr><td>${escapeHtml(name)}</td><td>${st.n}</td><td>${advFmt(st.std)}</td><td>${advFmt(st.pct)}</td><td>${advFmt(st.grade, 2)}</td><td>${advFmt(st.r12)}</td><td>${advFmt(st.r4)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  el.innerHTML = html;
}

// ------------------- 국어·수학 산점도 -------------------
const ADV_CLASS_COLORS = ['#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4f46e5', '#65a30d', '#9333ea', '#0284c7', '#b45309', '#475569'];
function renderAdvScatter(data) {
  const chart = window.analysisChart;
  chart.destroyChart('advChartScatter');
  const ctx = document.getElementById('advChartScatter')?.getContext('2d');
  if (!ctx) return;
  const usePct = advHasPercentiles(data);
  const val = rec => usePct ? advPctOf(rec) : advNum(rec?.표준점수);
  const { keys, map, label } = advClassGroups(data);
  const datasets = keys.map((k, i) => ({
    label: label(k),
    data: map.get(k).map(s => ({ x: val(s.국어), y: val(s.수학), s })).filter(p => !isNaN(p.x) && !isNaN(p.y)),
    backgroundColor: ADV_CLASS_COLORS[i % ADV_CLASS_COLORS.length] + 'b3',
    borderColor: ADV_CLASS_COLORS[i % ADV_CLASS_COLORS.length],
    pointRadius: 4, pointHoverRadius: 7
  })).filter(d => d.data.length);
  const all = datasets.flatMap(d => d.data);
  if (!all.length) return;
  const lo = usePct ? 0 : Math.floor(Math.min(...all.map(p => Math.min(p.x, p.y))) / 5) * 5;
  const hi = usePct ? 100 : Math.ceil(Math.max(...all.map(p => Math.max(p.x, p.y))) / 5) * 5;
  // 등급 경계선: 백분위면 96·89·77, 표준점수면 불러온 등급컷
  const kLines = usePct ? PCT_GRADE_LINES : (gradeCuts.target.std.korean || []).slice(0, 3).map((v, i) => ({ v, g: i + 1 })).filter(l => l.v > 0);
  const mLines = usePct ? PCT_GRADE_LINES : (gradeCuts.target.std.math || []).slice(0, 3).map((v, i) => ({ v, g: i + 1 })).filter(l => l.v > 0);
  const ann = {};
  kLines.forEach(l => { ann['kx' + l.g] = { type: 'line', xMin: l.v, xMax: l.v, borderColor: 'rgba(17,24,39,0.35)', borderDash: [4, 4], borderWidth: 1, label: { display: true, content: `국어 ${l.g}등급`, position: 'start', font: { size: 10 }, backgroundColor: 'rgba(255,255,255,0.85)', color: '#374151' } }; });
  mLines.forEach(l => { ann['my' + l.g] = { type: 'line', yMin: l.v, yMax: l.v, borderColor: 'rgba(17,24,39,0.35)', borderDash: [4, 4], borderWidth: 1, label: { display: true, content: `수학 ${l.g}등급`, position: 'start', font: { size: 10 }, backgroundColor: 'rgba(255,255,255,0.85)', color: '#374151' } }; });
  if (usePct) {
    ann.diag = { type: 'line', xMin: 0, yMin: 0, xMax: 100, yMax: 100, borderColor: 'rgba(107,114,128,0.5)', borderWidth: 1 };
    ann.korStrong = { type: 'label', xValue: 82, yValue: 12, content: ['국어 강세 ↘'], color: '#9ca3af', font: { size: 12, weight: 'bold' } };
    ann.mathStrong = { type: 'label', xValue: 18, yValue: 88, content: ['↖ 수학 강세'], color: '#9ca3af', font: { size: 12, weight: 'bold' } };
  }
  const unit = usePct ? '백분위' : '표준점수';
  chart.charts.advChartScatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { min: lo, max: hi, title: { display: true, text: `국어 ${unit}` } },
        y: { min: lo, max: hi, title: { display: true, text: `수학 ${unit}` } }
      },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
        annotation: { annotations: ann },
        tooltip: {
          callbacks: {
            label: c => {
              const s = c.raw.s;
              const eg = advExploreGrades(s);
              return `${c.dataset.label} ${s.번호}번 ${s.이름} — 국어 ${c.raw.x} / 수학 ${c.raw.y} (${unit})` +
                ` · 등급 국${advGrade(s, '국어') ?? '-'} 수${advGrade(s, '수학') ?? '-'} 영${advGrade(s, '영어') ?? '-'}${eg.length ? ' 탐' + eg.join('·') : ''}`;
            }
          }
        }
      }
    }
  });
}

// ------------------- 학급별 평균 편차 -------------------
function renderAdvDeviation(data) {
  const chart = window.analysisChart;
  chart.destroyChart('advChartDiverging');
  const ctx = document.getElementById('advChartDiverging')?.getContext('2d');
  if (!ctx) return;
  const usePct = advHasPercentiles(data);
  const subjects = [
    ['국어', s => usePct ? advPctOf(s.국어) : advNum(s.국어?.표준점수), '#dc2626'],
    ['수학', s => usePct ? advPctOf(s.수학) : advNum(s.수학?.표준점수), '#2563eb'],
    ['탐구', s => usePct ? advExplorePct(s) : advExploreStd(s), '#059669']
  ];
  const { keys, map, label } = advClassGroups(data);
  const avgOf = (list, f) => advMean(list.map(f).filter(n => !isNaN(n)));
  const engAvg = list => advMean(list.map(s => advGrade(s, '영어')).filter(g => g !== null));
  const schoolEng = engAvg(data);
  const datasets = subjects.map(([name, f, color]) => {
    const base = avgOf(data, f);
    return {
      label: `${name} 편차`,
      data: keys.map(k => { const v = avgOf(map.get(k), f) - base; return isNaN(v) ? 0 : +v.toFixed(2); }),
      backgroundColor: color + 'b3', borderColor: color, borderWidth: 1
    };
  });
  const unit = usePct ? '%p (백분위)' : '점 (표준점수)';
  chart.charts.advChartDiverging = new Chart(ctx, {
    type: 'bar',
    data: { labels: keys.map(k => `${label(k)} (${map.get(k).length}명)`), datasets },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: `학년 평균 대비 ${unit}` }, grid: { color: c => c.tick.value === 0 ? '#111827' : '#e5e7eb', lineWidth: c => c.tick.value === 0 ? 2 : 1 } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${c.raw > 0 ? '+' : ''}${c.raw}${usePct ? '%p' : '점'}`,
            footer: items => {
              const k = keys[items[0].dataIndex];
              return `영어 평균 등급: ${advFmt(engAvg(map.get(k)), 2)} (학년 ${advFmt(schoolEng, 2)})`;
            }
          }
        }
      }
    }
  });
}

// ------------------- 학급별 등급 히트맵 -------------------
function renderAdvHeatmap(data) {
  const el = document.getElementById('advHeatmapContainer');
  if (!el) return;
  const mode = advState.heatmapMode;
  const { keys, map, label } = advClassGroups(data);
  const subjects = [
    ['국어', list => list.map(s => advGrade(s, '국어')), [220, 38, 38]],
    ['수학', list => list.map(s => advGrade(s, '수학')), [37, 99, 235]],
    ['영어', list => list.map(s => advGrade(s, '영어')), [217, 119, 6]],
    ['탐구', list => list.flatMap(s => studentExploreEntries(s).map(e => exploreEntryGrade(e, 'target'))), [5, 150, 105]]
  ];
  let html = `<div class="adv-controls">
    <label><input type="radio" name="advHeatMode" ${mode === 'count' ? 'checked' : ''} onchange="advState.heatmapMode='count';renderAdvHeatmap(parsedData)"> 인원</label>
    <label><input type="radio" name="advHeatMode" ${mode === 'ratio' ? 'checked' : ''} onchange="advState.heatmapMode='ratio';renderAdvHeatmap(parsedData)"> 비율(%)</label></div>`;
  subjects.forEach(([name, pick, rgb]) => {
    const rowOf = list => {
      const gs = pick(list).filter(g => g !== null && g !== undefined && g >= 1 && g <= 9);
      const dist = Array(9).fill(0);
      gs.forEach(g => dist[g - 1]++);
      return { dist, total: gs.length };
    };
    const rows = keys.map(k => [label(k), rowOf(map.get(k))]);
    const all = ['전체', rowOf(data)];
    if (!all[1].total) return;
    html += `<h5 class="adv-subtitle">${name}${name === '탐구' ? ' (응시 과목 수 기준)' : ''}</h5><div class="table-container"><table class="adv-table adv-heat"><thead><tr><th>반</th>
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => `<th>${g}</th>`).join('')}<th>1~2(%)</th><th>4 이하(%)</th><th>${name === '탐구' ? '과목 수' : '인원'}</th></tr></thead><tbody>`;
    [...rows, all].forEach(([lbl, r], ri) => {
      const isTotal = ri === rows.length;
      html += `<tr${isTotal ? ' class="adv-total"' : ''}><td>${escapeHtml(lbl)}</td>`;
      r.dist.forEach((n, gi) => {
        const ratio = r.total ? n / r.total : 0;
        const alpha = Math.min(0.9, ratio * 2.2);
        const fg = alpha > 0.5 ? '#fff' : '#111827';
        const text = n ? (mode === 'ratio' ? (ratio * 100).toFixed(1) : n) : '';
        html += `<td style="background:rgba(${rgb.join(',')},${alpha.toFixed(3)});color:${fg}" title="${escapeHtml(lbl)} ${gi + 1}등급: ${n}명 (${(ratio * 100).toFixed(1)}%)">${text}</td>`;
      });
      html += `<td>${advFmt(advPct(r.dist[0] + r.dist[1], r.total))}</td><td>${advFmt(advPct(r.dist.slice(3).reduce((a, b) => a + b, 0), r.total))}</td><td>${r.total}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });
  el.innerHTML = html;
}

// ------------------- 학급별 성적 분포 (상자 수염) -------------------
function renderAdvBoxplot(data) {
  const chart = window.analysisChart;
  chart.destroyChart('advChartBoxplot');
  const ctx = document.getElementById('advChartBoxplot')?.getContext('2d');
  if (!ctx) return;
  const usePct = advHasPercentiles(data);
  // 결시 과목이 있는 학생은 뺀다
  const metric = s => {
    if (usePct) {
      const k = advPctOf(s.국어), m = advPctOf(s.수학), e = advExplorePct(s);
      return (isNaN(k) || isNaN(m) || isNaN(e)) ? NaN : (k + m + e) / 3;
    }
    const k = advNum(s.국어?.표준점수), m = advNum(s.수학?.표준점수);
    return (isNaN(k) || isNaN(m)) ? NaN : k + m;
  };
  const { keys, map, label } = advClassGroups(data);
  const stats = keys.map(k => {
    const list = map.get(k);
    const vals = list.map(s => ({ s, v: metric(s) })).filter(x => !isNaN(x.v)).sort((a, b) => a.v - b.v);
    const sorted = vals.map(x => x.v);
    if (!sorted.length) return null;
    const q1 = advQuantile(sorted, 0.25), med = advQuantile(sorted, 0.5), q3 = advQuantile(sorted, 0.75);
    const iqr = q3 - q1;
    const loFence = q1 - 1.5 * iqr, hiFence = q3 + 1.5 * iqr;
    const inside = sorted.filter(v => v >= loFence && v <= hiFence);
    return {
      label: `${label(k)} (${sorted.length}명)`, q1, med, q3,
      lo: Math.min(...inside), hi: Math.max(...inside),
      outliers: vals.filter(x => x.v < loFence || x.v > hiFence),
      excluded: list.length - sorted.length
    };
  }).filter(Boolean);
  if (!stats.length) return;
  const labels = stats.map(s => s.label);
  const r1 = v => +v.toFixed(1);
  chart.charts.advChartBoxplot = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '수염 (최저~최고, 이상치 제외)', data: stats.map(s => [r1(s.lo), r1(s.hi)]), backgroundColor: 'rgba(107,114,128,0.55)', barPercentage: 0.06, grouped: false, order: 3 },
        { label: '가운데 50% (Q1~Q3)', data: stats.map(s => [r1(s.q1), r1(s.q3)]), backgroundColor: 'rgba(79,70,229,0.55)', borderColor: 'rgba(79,70,229,1)', borderWidth: 1, barPercentage: 0.5, grouped: false, order: 2 },
        { type: 'scatter', label: '중앙값', data: stats.map((s, i) => ({ x: labels[i], y: r1(s.med) })), pointStyle: 'line', pointRadius: 16, pointHoverRadius: 16, borderWidth: 3, borderColor: '#dc2626', backgroundColor: '#dc2626', order: 1 },
        { type: 'scatter', label: '이상치', data: stats.flatMap((s, i) => s.outliers.map(o => ({ x: labels[i], y: r1(o.v), s: o.s }))), pointRadius: 4, backgroundColor: '#f59e0b', borderColor: '#b45309', order: 0 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: usePct ? '국·수·탐 평균 백분위' : '국어+수학 표준점수' } } },
      plugins: {
        tooltip: {
          callbacks: {
            label: c => {
              if (c.dataset.label === '이상치') return ` ${c.raw.s.번호}번 ${c.raw.s.이름}: ${c.raw.y}`;
              if (c.dataset.type === 'scatter') return ` 중앙값: ${c.raw.y}`;
              return ` ${c.dataset.label}: ${c.raw[0]} ~ ${c.raw[1]}`;
            },
            footer: items => {
              const st = stats[items[0].dataIndex];
              return st && st.excluded ? `결시 과목이 있어 제외: ${st.excluded}명` : '';
            }
          }
        }
      }
    }
  });
}
