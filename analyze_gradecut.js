// ===============================================================================
// 성적 분석 및 등급컷 관리 시스템
// 전국연합학력평가 1학년 성적 데이터 분석을 위한 JavaScript 모듈
// ===============================================================================

// ------------------- 탭 UI 및 전역 변수 -------------------
// 성적 분석 탭 상태 관리 변수들
let analyzeTab = 'all'; // 현재 활성화된 탭 ('all': 전체분석, 'compare': 비교분석, 'list': 학생명단)
let compareParsedData = []; // 비교용 파일에서 파싱된 학생 데이터 배열
let compareFileName = ''; // 업로드된 비교 파일명

// 비교 성적 분석의 학년 필터 ('' = 전체)
window.compareTargetGrade = '';
window.compareCompareGrade = '';
function getCompareTargetData() {
  return window.compareTargetGrade ? parsedData.filter(s => String(s.학년) === window.compareTargetGrade) : parsedData;
}
function getCompareCompareData() {
  return window.compareCompareGrade ? compareParsedData.filter(s => String(s.학년) === window.compareCompareGrade) : compareParsedData;
}
// 학년 필터 드롭다운을 데이터에 맞게 채우고, 바뀌면 비교 결과를 다시 그린다
function updateCompareGradeFilters() {
  const tSel = document.getElementById('compareTargetGradeSel');
  const cSel = document.getElementById('compareCompareGradeSel');
  if (tSel) {
    const grades = [...new Set(parsedData.map(s => String(s.학년)).filter(Boolean))].sort();
    const prev = window.compareTargetGrade;
    tSel.innerHTML = '<option value="">전체</option>' + grades.map(g => `<option value="${g}">${g}학년</option>`).join('');
    tSel.value = grades.includes(prev) ? prev : '';
    window.compareTargetGrade = tSel.value;
  }
  if (cSel) {
    const grades = [...new Set(compareParsedData.map(s => String(s.학년)).filter(Boolean))].sort();
    const prev = window.compareCompareGrade;
    cSel.innerHTML = '<option value="">전체</option>' + grades.map(g => `<option value="${g}">${g}학년</option>`).join('');
    cSel.value = grades.includes(prev) ? prev : '';
    window.compareCompareGrade = cSel.value;
  }
}
function onCompareGradeFilterChange() {
  window.compareTargetGrade = document.getElementById('compareTargetGradeSel')?.value || '';
  window.compareCompareGrade = document.getElementById('compareCompareGradeSel')?.value || '';
  if (compareParsedData.length) renderCompareResult();
}

// 등급컷 입력(학년/대분류/하위과목) UI 상태
let cutSelectedGrade = '1'; // '1' | '2' | '3'
let cutMajorTab = ''; // 대분류 탭 키
let cutSelections = {
  // 2학년 하위 과목 선택 상태
  g2: {
    social: '생활과윤리',
    science: '물리학 I'
  },
  // 3학년 하위 과목 선택 상태
  g3: {
    korean: '화법과작문',
    math: '기하',
    social: '생활과윤리',
    science: '물리학 I'
  }
};

// EBSi 관련 오류 메시지를 한 형식으로 통일해서 보여준다 (기존엔 6곳에 문구가 조금씩 제각각이었음)
function showEbsiError(context, e) {
  const detail = e?.message || String(e || '');
  showMessage(`${context} 중 오류가 발생했습니다.\n${detail}`);
  console.error(e);
}

// 과목 슬러그 유틸
function subjectSlug(name) {
  const map = {
    '국어': 'korean', '수학': 'math', '영어': 'english', '한국사': 'history',
    '생활과윤리': 'soc_life_ethics', '윤리와사상': 'soc_ethics_thought', '한국지리': 'soc_k_geo', '세계사': 'soc_world_history',
    '세계지리': 'soc_world_geo', '동아시아사': 'soc_east_asia', '정치와법': 'soc_politics_law', '경제': 'soc_economy', '사회문화': 'soc_society_culture',
    '물리학 I': 'sci_phy1', '화학 I': 'sci_chem1', '생명과학 I': 'sci_bio1', '지구과학 I': 'sci_earth1',
    '물리학 II': 'sci_phy2', '화학 II': 'sci_chem2', '생명과학 II': 'sci_bio2', '지구과학 II': 'sci_earth2',
    '화법과작문': 'kor_speaking', '언어와매체': 'kor_language_media',
    '기하': 'math_geometry', '미적분': 'math_calculus', '확률과통계': 'math_probability'
  };
  return map[name] || name.replace(/\s+/g, '_');
}

function normalizeSubjectName(name) {
  if (!name) return '';
  let n = String(name).trim();
  n = n.replace(/[Ⅰ]/g, ' I').replace(/[Ⅱ]/g, ' II');
  n = n.replace(/[·\u00B7]/g, '');
  n = n.replace(/\s+/g, '');
  // 특수 케이스 정규화
  if (n === '사회문화') return '사회문화';
  if (n === '정치와법') return '정치와법';
  // 과학 I/II는 공백 추가 필요
  n = n.replace('물리학I', '물리학 I').replace('물리학II', '물리학 II')
    .replace('화학I', '화학 I').replace('화학II', '화학 II')
    .replace('생명과학I', '생명과학 I').replace('생명과학II', '생명과학 II')
    .replace('지구과학I', '지구과학 I').replace('지구과학II', '지구과학 II');
  return n;
}

function parseNumberCell(text) {
  const t = (text || '').toString().trim();
  if (t === '-' || t === '') return NaN;
  const v = Number(t);
  return isNaN(v) ? NaN : v;
}

function fillForwardMissing(arr) {
  if (!Array.isArray(arr)) return arr;
  const a = arr.slice();
  for (let i = 0; i < a.length - 1; i++) {
    if (isNaN(a[i]) || a[i] === undefined) {
      a[i] = a[i + 1];
    }
  }
  if (isNaN(a[a.length - 1]) || a[a.length - 1] === undefined) a[a.length - 1] = 0;
  return a;
}

const SUBJECT_SETS = {
  g2: {
    basic: ['국어', '수학', '영어', '한국사'],
    // 2026년(2026학년도)부터 2학년 탐구가 선택과목제(9+4개)에서 1학년과 같은 공통과목(통합사회/통합과학)으로 개편됨
    basicNew: [
      { name: '국어', key: 'korean' }, { name: '수학', key: 'math' },
      { name: '영어', key: 'english' }, { name: '한국사', key: 'history' },
      { name: '통합사회', key: 'social' }, { name: '통합과학', key: 'science' }
    ],
    social: ['생활과윤리', '윤리와사상', '한국지리', '세계사', '세계지리', '동아시아사', '정치와법', '경제', '사회문화'],
    science: ['물리학 I', '화학 I', '생명과학 I', '지구과학 I']
  },
  g3: {
    kor: ['화법과작문', '언어와매체'],
    math: ['기하', '미적분', '확률과통계'],
    engHis: ['영어', '한국사'],
    social: ['생활과윤리', '윤리와사상', '한국지리', '세계사', '세계지리', '동아시아사', '정치와법', '경제', '사회문화'],
    science: ['물리학 I', '화학 I', '생명과학 I', '지구과학 I', '물리학 II', '화학 II', '생명과학 II', '지구과학 II']
  }
};

// 2022 개정 교육과정 적용으로 탐구가 선택과목제 -> 공통과목(통합사회/통합과학)으로 바뀌는 연차를 판단한다.
// 1학년은 이미 항상 공통과목 체계(기존 UI 그대로), 2학년은 2026학년도부터, 3학년은 2027학년도부터 적용된다.
// (연도를 알 수 없으면 기존 선택과목제로 동작 — 하위 호환)
function isNewTamguSystem(gradeSelVal, year) {
  const y = Number(year);
  if (gradeSelVal === '1') return true;
  if (isNaN(y)) return false;
  if (gradeSelVal === '2') return y >= 2026;
  if (gradeSelVal === '3') return y >= 2027;
  return false;
}

// 성적 분석 엔진(getGradeDistByCut 등)은 항상 gradeCuts.target(1학년과 동일한 단순 구조)만 참조한다.
// 2학년이 신 교육과정(통합사회/통합과학 공통과목)이면 선택과목 조합 문제가 없어 1학년과 동일하게
// 취급할 수 있으므로, 입력/조회된 값을 gradeCuts.target에도 그대로 반영해 분석이 실제로 동작하게 한다.
// (구교육과정 선택과목제는 학생별 선택과목이 다를 수 있어 이 방식으로 단순 이관할 수 없다 — 별도 과제)
function syncG2BasicToTargetIfNewSystem(year) {
  if (!isNewTamguSystem('2', year)) return;
  ensureGradeCutDetails();
  const d2 = gradeCuts.details['2'];
  const cut = gradeCuts.target;
  ['korean', 'math', 'english', 'history', 'social', 'science'].forEach(subj => {
    cut.raw[subj] = (d2.basic.raw[subj] || []).map(v => (v === undefined || isNaN(v)) ? 0 : v);
    cut.std[subj] = (d2.basic.std[subj] || []).map(v => (v === undefined || isNaN(v)) ? 0 : v);
  });
  cut.exploreBySubject = null;
}

// 2학년 구교육과정(선택과목제)·3학년 등급컷도 분석 엔진이 쓰는 gradeCuts.target에 옮긴다.
// 예전엔 이 경우 details에만 저장되고 target은 비어 있어서, 등급컷을 불러와도 "저장 안 됨"으로 취급돼
// 성적 확인·성적 분석이 열리지 않았다.
// - 국어/수학: 표준점수 등급컷(3학년은 선택과목 통합 표준점수). 3학년 원점수는 선택과목마다 달라 비워둔다.
// - 영어/한국사: 원점수 등급컷
// - 탐구: 학생마다 과목이 달라 한 줄로 합칠 수 없으므로 과목별 등급컷(exploreBySubject)으로 넘기고,
//   resolveStudentGrade가 학생의 과목명으로 찾아 쓴다.
function syncDetailsToTarget(gradeKey, year) {
  if (gradeKey === '2' && isNewTamguSystem('2', year)) { syncG2BasicToTargetIfNewSystem(year); return; }
  if (gradeKey !== '2' && gradeKey !== '3') return;
  ensureGradeCutDetails();
  const clean = arr => (Array.isArray(arr) ? arr : []).map(v => (v === undefined || v === null || isNaN(v)) ? 0 : Number(v));
  const cut = gradeCuts.target;
  const bySubject = {};
  if (gradeKey === '2') {
    const d2 = gradeCuts.details['2'];
    ['korean', 'math', 'english', 'history'].forEach(subj => {
      cut.raw[subj] = clean(d2.basic.raw[subj]);
      cut.std[subj] = clean(d2.basic.std[subj]);
    });
    [d2.social, d2.science].forEach(group => Object.keys(group || {}).forEach(slug => {
      bySubject[slug] = { raw: clean(group[slug].raw), std: clean(group[slug].std) };
    }));
  } else {
    const d3 = gradeCuts.details['3'];
    cut.raw.korean = []; cut.raw.math = [];
    cut.std.korean = clean(d3.korCombined?.std);
    cut.std.math = clean(d3.mathCombined?.std);
    ['english', 'history'].forEach(subj => {
      cut.raw[subj] = clean(d3.engHis.raw[subj]);
      cut.std[subj] = clean(d3.engHis.std[subj]);
    });
    [d3.social, d3.science].forEach(group => Object.keys(group || {}).forEach(slug => {
      bySubject[slug] = { raw: clean(group[slug].raw), std: clean(group[slug].std) };
    }));
  }
  cut.raw.social = []; cut.raw.science = [];
  cut.std.social = []; cut.std.science = [];
  cut.exploreBySubject = bySubject;
  if (year) cut.year = year;
}

// 선택과목제 탐구: 학생 기록의 과목명으로 그 과목의 등급컷을 찾는다 (없으면 null)
function exploreCutsForRecord(record, scoreField) {
  const map = gradeCuts.target.exploreBySubject;
  if (!map || !record || !record.과목) return null;
  const entry = map[subjectSlug(normalizeSubjectName(record.과목))];
  if (!entry) return null;
  const cuts = scoreField === '원점수' ? entry.raw : entry.std;
  return cutsAreUsable(cuts) ? cuts : null;
}

// details 저장소 초기화 헬퍼
function ensureGradeCutDetails() {
  if (!gradeCuts.details) gradeCuts.details = {};
  if (!gradeCuts.details['2']) gradeCuts.details['2'] = { basic: { raw: {}, std: {} }, social: {}, science: {} };
  if (!gradeCuts.details['3']) gradeCuts.details['3'] = { kor: {}, math: {}, engHis: { raw: {}, std: {} }, social: {}, science: {}, korCombined: { std: [] }, mathCombined: { std: [] } };
  // 2학년 basic 과목 키 준비
  SUBJECT_SETS.g2.basic.forEach(n => {
    const k = subjectSlug(n);
    if (!gradeCuts.details['2'].basic.raw[k]) gradeCuts.details['2'].basic.raw[k] = [];
    if (!gradeCuts.details['2'].basic.std[k]) gradeCuts.details['2'].basic.std[k] = [];
  });
  // 3학년 eng/his 준비
  ['영어', '한국사'].forEach(n => {
    const k = subjectSlug(n);
    if (!gradeCuts.details['3'].engHis.raw[k]) gradeCuts.details['3'].engHis.raw[k] = [];
    if (!gradeCuts.details['3'].engHis.std[k]) gradeCuts.details['3'].engHis.std[k] = [];
  });
  if (!gradeCuts.details['3'].korCombined) gradeCuts.details['3'].korCombined = { std: [] };
  if (!gradeCuts.details['3'].mathCombined) gradeCuts.details['3'].mathCombined = { std: [] };
}

/**
 * 성적 분석 탭 전환 함수
 * @param {string} tab - 전환할 탭 ID ('all', 'compare', 'list')
 */
function switchAnalyzeTab(tab) {
  analyzeTab = tab;
  // 모든 탭 버튼에서 active 클래스 제거 (등급컷 화면의 과목 탭도 같은 클래스를 써서, 범위를 성적 분석 영역으로 한정)
  document.querySelectorAll('#analyzeContent .analyze-tab-btn').forEach(btn => btn.classList.remove('active'));
  // 선택된 탭 버튼에 active 클래스 추가
  document.getElementById('analyzeTabBtn_' + tab).classList.add('active');
  // 모든 섹션 숨기기 (hidden 클래스로 제어)
  document.querySelectorAll('.analyze-section').forEach(sec => sec.classList.add('hidden'));
  // 선택된 섹션만 표시
  document.getElementById('analyzeSection_' + tab).classList.remove('hidden');

  // 파일·등급컷이 준비되기 전에는 그리지 않는다 (빈 데이터로 그린 표가 남아 있지 않도록)
  if (typeof checkAccessPermission === 'function' && !checkAccessPermission('analyze')) return;

  // 탭별 초기화 함수 실행
  if (tab === 'all') window.analyzeAll(); // 전체 성적 분석 실행
  if (tab === 'compare') refreshCompareTab(); // 비교 분석 탭 (올려둔 비교 파일은 유지)
  if (tab === 'advanced') {
    if (typeof renderAdvancedCharts === 'function') renderAdvancedCharts();
  }
  if (tab === 'list') renderStudentList(); // 학생 명단 렌더링
}

// ------------------- 등급컷 표 생성 및 입력 관리 -------------------
/**
 * 등급컷 입력 테이블 초기화 함수
 * 원점수와 표준점수 등급컷 입력 폼을 동적으로 생성
 */
function initCutTable() {
  ensureGradeCutDetails();
  const cutTable = document.getElementById('cutInputTable');
  const cut = gradeCuts.target;
  let html = '';

  // 학년은 EBSi 학년 드롭다운(#ebsiGrade)의 값을 사용 (D100/200/300)
  const ebsiGradeEl = document.getElementById('ebsiGrade');
  const gval = ebsiGradeEl?.value || '';
  const gmap = { D100: '1', D200: '2', D300: '3' };
  if (gval) {
    cutSelectedGrade = gmap[gval] || cutSelectedGrade || '1';
  } else if (!window._cutGradeUserSet && parsedData && parsedData.length > 0) {
    // 사용자가 아직 학년을 직접 고르지 않았다면, 업로드된 데이터의 학년을 기본값으로 삼는다.
    // (예전엔 항상 '1'로 시작해서, 2·3학년 파일을 올리자마자 등급컷 탭에 들어가는 순간
    //  아무것도 안 했는데 "학년이 다르다"는 경고가 바로 떴었다)
    const uploadedGrades = [...new Set(parsedData.map(s => String(s.학년)))];
    if (uploadedGrades.length === 1 && ['1', '2', '3'].includes(uploadedGrades[0])) {
      cutSelectedGrade = uploadedGrades[0];
    } else {
      cutSelectedGrade = cutSelectedGrade || '1';
    }
  } else {
    cutSelectedGrade = cutSelectedGrade || '1';
  }
  if (ebsiGradeEl && !ebsiGradeEl.dataset.cutInitBound) {
    ebsiGradeEl.addEventListener('change', () => { window._cutGradeUserSet = true; initCutTable(); });
    ebsiGradeEl.dataset.cutInitBound = '1';
  }

  // 연도에 따라 탐구가 선택과목제인지 공통과목(통합사회/통합과학)제인지 판단
  // (예: 2학년은 2026학년도부터 1학년처럼 통합사회/통합과학 공통과목으로 개편됨)
  const ebsiYearEl = document.getElementById('ebsiYear');
  const selectedYear = ebsiYearEl?.value || gradeCuts.details?.[cutSelectedGrade]?.year || cut.year || '';
  const newTamguSystem = isNewTamguSystem(cutSelectedGrade, selectedYear);
  if (ebsiYearEl && !ebsiYearEl.dataset.cutInitBound) {
    ebsiYearEl.addEventListener('change', () => initCutTable());
    ebsiYearEl.dataset.cutInitBound = '1';
  }

  // 학년 불일치 경고: 사용자가 학년 드롭다운을 "직접 바꾼" 뒤에만 검사한다.
  // (자동으로 맞춰준 초기값 상태에서는 애초에 불일치가 안 생기고, 이 경고도 뜨지 않는다)
  if (window._cutGradeUserSet && parsedData && parsedData.length > 0) {
    const fileGrades = [...new Set(parsedData.map(s => String(s.학년)))];
    if (fileGrades.length === 1 && fileGrades[0] !== cutSelectedGrade) {
      if (!window._gradeWarnShown || window._gradeWarnShown !== cutSelectedGrade) {
        window._gradeWarnShown = cutSelectedGrade;
        showMessage(`<strong>잠시만요!</strong> 업로드한 데이터는 ${fileGrades[0]}학년 자료입니다. 현재 등급컷은 ${cutSelectedGrade}학년을 선택하였는데, 올바른 선택인지 다시 한 번 확인해주세요.`);
      }
    }
  }

  // 1학년: 기존 UI 그대로
  if (cutSelectedGrade === '1') {
    html += `
    <div class="grade-cut-tables-container">
      <div class="table-wrapper">
        <h4 class="mb-6">원점수 등급컷</h4>
        <table class="cut-table">
          <thead>
            <tr>
              <th class="no-copy">등급</th>
              <th>국어</th>
              <th>수학</th>
              <th>사회탐구<br>(탐구1)</th>
              <th>과학탐구<br>(탐구2)</th>
              <th>한국사<br>(고정)</th>
              <th>영어<br>(고정)</th>
            </tr>
          </thead>
            <tbody>`;
    for (let i = 1; i <= 8; i++) {
      html += `
      <tr>
        <td class="no-copy">${i}등급</td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="raw" data-category="basic_1" data-subject="korean" data-level="${i}" id="raw_korean${i}" required placeholder="점수" value="${cut.raw.korean[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="raw" data-category="basic_1" data-subject="math" data-level="${i}" id="raw_math${i}" required placeholder="점수" value="${cut.raw.math[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="raw" data-category="basic_1" data-subject="social" data-level="${i}" id="raw_social${i}" required placeholder="점수" value="${cut.raw.social[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="raw" data-category="basic_1" data-subject="science" data-level="${i}" id="raw_science${i}" required placeholder="점수" value="${cut.raw.science[i - 1] || ''}"></td>
        <td>${cut.raw.history?.[i - 1] ?? ''}</td>
        <td>${cut.raw.english?.[i - 1] ?? ''}</td>
              </tr>`;
    }
    html += `
          </tbody>
        </table>
      </div>
      <div class="table-wrapper">
        <h4 class="mb-6">표준점수 등급컷</h4>
        <table class="cut-table">
          <thead>
            <tr>
              <th class="no-copy">등급</th>
              <th>국어</th>
              <th>수학</th>
              <th>사회탐구<br>(탐구1)</th>
              <th>과학탐구<br>(탐구2)</th>
            </tr>
          </thead>
            <tbody>`;
    for (let i = 1; i <= 8; i++) {
      html += `
      <tr>
        <td class="no-copy">${i}등급</td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="std" data-category="basic_1" data-subject="korean" data-level="${i}" id="std_korean${i}" required placeholder="점수" value="${cut.std.korean[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="std" data-category="basic_1" data-subject="math" data-level="${i}" id="std_math${i}" required placeholder="점수" value="${cut.std.math[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="std" data-category="basic_1" data-subject="social" data-level="${i}" id="std_social${i}" required placeholder="점수" value="${cut.std.social[i - 1] || ''}"></td>
                <td><input class="grade-cut-input" type="number" data-grade="1" data-type="std" data-category="basic_1" data-subject="science" data-level="${i}" id="std_science${i}" required placeholder="점수" value="${cut.std.science[i - 1] || ''}"></td>
              </tr>`;
    }
    html += `
          </tbody>
        </table>
      </div>
      </div>`;

    cutTable.innerHTML = html;
    attachCutInputValidation();
    return;
  }

  // 2·3학년: 대분류 탭 렌더
  function renderMajorTabs() {
    let tabsHtml = '<div class="mb-18">';
    if (cutSelectedGrade === '2') {
      // 신 교육과정(통합사회/통합과학, 2026학년도~)은 탐구가 공통과목이라 별도 탭이 필요 없음
      const tabs = newTamguSystem
        ? [{ key: 'g2_basic', label: '국어/수학/영어/한국사/통합사회/통합과학' }]
        : [
          { key: 'g2_basic', label: '국어/수학/영어/한국사' },
          { key: 'g2_social', label: '사회탐구' },
          { key: 'g2_science', label: '과학탐구' }
        ];
      if (!cutMajorTab || (newTamguSystem && cutMajorTab !== 'g2_basic')) cutMajorTab = 'g2_basic';
      if (tabs.length > 1) {
        tabs.forEach(t => {
          tabsHtml += `<button class="analyze-tab-btn ${cutMajorTab === t.key ? 'active' : ''}" onclick="(function(){cutMajorTab='${t.key}'; initCutTable();})()">${t.label}</button> `;
        });
      } else {
        tabsHtml += `<span class="analyze-tab-btn active" style="cursor:default;">${tabs[0].label} <span style="font-weight:normal; opacity:0.75;">(2022 개정 교육과정 · 공통과목)</span></span>`;
      }
    } else if (cutSelectedGrade === '3') {
      const tabs = [
        { key: 'g3_km', label: '국어/수학' },
        { key: 'g3_eh', label: '영어/한국사' },
        { key: 'g3_social', label: '사회탐구' },
        { key: 'g3_science', label: '과학탐구' }
      ];
      if (!cutMajorTab) cutMajorTab = 'g3_km';
      tabs.forEach(t => {
        tabsHtml += `<button class="analyze-tab-btn ${cutMajorTab === t.key ? 'active' : ''}" onclick="(function(){cutMajorTab='${t.key}'; initCutTable();})()">${t.label}</button> `;
      });
    }
    tabsHtml += '</div>';
    return tabsHtml;
  }

  function renderEightRowsCells(makeCell) {
    let rows = '';
    for (let i = 1; i <= 8; i++) {
      rows += `<tr><td class="no-copy">${i}등급</td>${makeCell(i)}</tr>`;
    }
    return rows;
  }

  function renderSingleSubjectTable(gradeKey, categoryKey, subjectName, rawArr, stdArr) {
    const subjKey = subjectSlug(subjectName);
    let s = '';
    s += '<div class="grade-cut-tables-container">';
    s += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th><th>' + subjectName + '</th></tr></thead><tbody>';
    s += renderEightRowsCells((i) => {
      const v = rawArr?.[i - 1] ?? '';
      return `<td><input class="grade-cut-input" type="number" data-grade="${gradeKey}" data-type="raw" data-category="${categoryKey}" data-subject="${subjKey}" data-level="${i}" id="raw_${subjKey}${i}" placeholder="점수" value="${v}"></td>`;
    });
    s += '</tbody></table></div>';
    s += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th><th>' + subjectName + '</th></tr></thead><tbody>';
    s += renderEightRowsCells((i) => {
      const v = stdArr?.[i - 1] ?? '';
      return `<td><input class="grade-cut-input" type="number" data-grade="${gradeKey}" data-type="std" data-category="${categoryKey}" data-subject="${subjKey}" data-level="${i}" id="std_${subjKey}${i}" placeholder="점수" value="${v}"></td>`;
    });
    s += '</tbody></table></div>';
    s += '</div>';
    return s;
  }

  // 본문 작성
  html += renderMajorTabs();

  // 콘텐츠 영역
  if (cutSelectedGrade === '2') {
    if (cutMajorTab === 'g2_basic') {
      // 2학년: 국/수/영/한(+신 교육과정이면 통합사회/통합과학까지) 한 화면 입력
      // 영어/한국사는 절대평가라 표준점수 자체가 없으므로, 원점수 표에만 포함하고 표준점수 표에서는 제외한다
      const d = gradeCuts.details['2'];
      const rawSubjects = newTamguSystem
        ? SUBJECT_SETS.g2.basicNew
        : SUBJECT_SETS.g2.basic.map(n => ({ name: n, key: subjectSlug(n) }));
      const stdSubjects = rawSubjects.filter(s => s.key !== 'english' && s.key !== 'history');
      html += '<div class="grade-cut-tables-container">';
      // 원점수 표
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th>' + rawSubjects.map(s => `<th>${s.name}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => rawSubjects.map(s => {
        const k = s.key;
        const v = d.basic.raw[k]?.[i - 1] ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"raw\" data-category=\"g2_basic\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수 표 (영어/한국사 제외)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th>' + stdSubjects.map(s => `<th>${s.name}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => stdSubjects.map(s => {
        const k = s.key;
        const v = d.basic.std[k]?.[i - 1] ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"std\" data-category=\"g2_basic\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      html += '</div>';
    }
    if (!newTamguSystem && cutMajorTab === 'g2_social') {
      const list = SUBJECT_SETS.g2.social;
      const d = gradeCuts.details['2'].social;
      // 원점수(스택 상단)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷 (사회탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.raw?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"raw\" data-category=\"g2_social\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수(스택 하단)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷 (사회탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.std?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"std\" data-category=\"g2_social\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
    }
    if (!newTamguSystem && cutMajorTab === 'g2_science') {
      const list = SUBJECT_SETS.g2.science;
      const d = gradeCuts.details['2'].science;
      html += '<div class="grade-cut-tables-container">';
      // 원점수
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷 (과학탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.raw?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"raw\" data-category=\"g2_science\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷 (과학탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.std?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"2\" data-type=\"std\" data-category=\"g2_science\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      html += '</div>';
    }
  }

  if (cutSelectedGrade === '3') {
    if (cutMajorTab === 'g3_km') {
      // 3학년 국어/수학: 과목별 원점수 + 통합 표준점수 한 표에 표시
      const d3 = gradeCuts.details['3'];
      const korRaw1 = d3.kor['kor_speaking']?.raw || [];
      const korRaw2 = d3.kor['kor_language_media']?.raw || [];
      const korStd = d3.korCombined.std || [];
      const mRawP = d3.math['math_probability']?.raw || [];
      const mRawC = d3.math['math_calculus']?.raw || [];
      const mRawG = d3.math['math_geometry']?.raw || [];
      const mStd = d3.mathCombined.std || [];

      html += `<div class="grade-cut-tables-container">`;
      // 국어 통합 표
      html += `<div class="table-wrapper">
        <h4 class="mb-6">국어 (3학년)</h4>
        <table class="cut-table">
          <thead>
            <tr>
              <th class="no-copy">등급</th>
              <th>화법과작문(원)</th>
              <th>언어와매체(원)</th>
              <th>국어 표준점수</th>
            </tr>
          </thead>
          <tbody>`;
      for (let i = 1; i <= 8; i++) {
        html += `<tr>
          <td class="no-copy">${i}등급</td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="raw" data-category="g3_korean" data-subject="kor_speaking" data-level="${i}" id="raw_kor_speaking${i}" placeholder="점수" value="${korRaw1[i - 1] ?? ''}"></td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="raw" data-category="g3_korean" data-subject="kor_language_media" data-level="${i}" id="raw_kor_language_media${i}" placeholder="점수" value="${korRaw2[i - 1] ?? ''}"></td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="std" data-category="g3_kor_combined" data-subject="kor_combined" data-level="${i}" id="std_kor_combined${i}" placeholder="점수" value="${korStd[i - 1] ?? ''}"></td>
        </tr>`;
      }
      html += `</tbody></table></div>`;

      // 수학 통합 표
      html += `<div class="table-wrapper">
        <h4 class="mb-6">수학 (3학년)</h4>
        <table class="cut-table">
          <thead>
            <tr>
              <th class="no-copy">등급</th>
              <th>확률과통계(원)</th>
              <th>미적분(원)</th>
              <th>기하(원)</th>
              <th>수학 표준점수</th>
            </tr>
          </thead>
          <tbody>`;
      for (let i = 1; i <= 8; i++) {
        html += `<tr>
          <td class="no-copy">${i}등급</td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="raw" data-category="g3_math" data-subject="math_probability" data-level="${i}" id="raw_math_probability${i}" placeholder="점수" value="${mRawP[i - 1] ?? ''}"></td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="raw" data-category="g3_math" data-subject="math_calculus" data-level="${i}" id="raw_math_calculus${i}" placeholder="점수" value="${mRawC[i - 1] ?? ''}"></td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="raw" data-category="g3_math" data-subject="math_geometry" data-level="${i}" id="raw_math_geometry${i}" placeholder="점수" value="${mRawG[i - 1] ?? ''}"></td>
          <td><input class="grade-cut-input" type="number" data-grade="3" data-type="std" data-category="g3_math_combined" data-subject="math_combined" data-level="${i}" id="std_math_combined${i}" placeholder="점수" value="${mStd[i - 1] ?? ''}"></td>
        </tr>`;
      }
      html += `</tbody></table></div>`;

      html += `</div>`;
    }
    if (cutMajorTab === 'g3_eh') {
      // 영어/한국사 한 화면 입력
      const d = gradeCuts.details['3'];
      const subjects = SUBJECT_SETS.g3.engHis; // ['영어','한국사']
      html += '<div class="grade-cut-tables-container">';
      // 원점수 표
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th>' + subjects.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => subjects.map(n => {
        const k = subjectSlug(n);
        const v = d.engHis.raw[k]?.[i - 1] ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"raw\" data-category=\"g3_eh\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수 표
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷</h4>\n<table class="cut-table">\n<thead><tr><th class="no-copy">등급</th>' + subjects.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => subjects.map(n => {
        const k = subjectSlug(n);
        const v = d.engHis.std[k]?.[i - 1] ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"std\" data-category=\"g3_eh\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      html += '</div>';
    }
    if (cutMajorTab === 'g3_social') {
      const list = SUBJECT_SETS.g3.social;
      const d = gradeCuts.details['3'].social;
      // 원점수(스택 상단)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷 (사회탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.raw?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"raw\" data-category=\"g3_social\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수(스택 하단)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷 (사회탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.std?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"std\" data-category=\"g3_social\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
    }
    if (cutMajorTab === 'g3_science') {
      const list = SUBJECT_SETS.g3.science;
      const d = gradeCuts.details['3'].science;
      // 원점수 (위)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">원점수 등급컷 (과학탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.raw?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"raw\" data-category=\"g3_science\" data-subject=\"${k}\" data-level=\"${i}\" id=\"raw_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
      // 표준점수 (아래)
      html += '<div class="table-wrapper">\n<h4 class="mb-6">표준점수 등급컷 (과학탐구 전 과목)</h4>\n<table class="cut-table">';
      html += '<thead><tr><th class="no-copy">등급</th>' + list.map(n => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
      html += renderEightRowsCells((i) => list.map(n => {
        const k = subjectSlug(n);
        const v = (d[k]?.std?.[i - 1]) ?? '';
        return `<td><input class=\"grade-cut-input\" type=\"number\" data-grade=\"3\" data-type=\"std\" data-category=\"g3_science\" data-subject=\"${k}\" data-level=\"${i}\" id=\"std_${k}${i}\" placeholder=\"점수\" value=\"${v}\"></td>`;
      }).join(''));
      html += '</tbody></table></div>';
    }
  }

  cutTable.innerHTML = html;
  attachCutInputValidation();
}

// ------------------- 등급컷 적용 및 저장 -------------------
/**
 * 입력된 등급컷 데이터를 전역 변수에 저장하는 함수
 * 사용자가 입력한 원점수/표준점수 등급컷을 gradeCuts.target에 저장
 */
window.applyCut = function (silent) {
  showLoading();
  setTimeout(() => {
    const validation = validateCutInputs(true);
    if (!validation.valid) {
      hideLoading();
      showMessage('등급컷 입력 오류\n- ' + validation.errors[0]);
      return;
    }

    // 1학년: 기존 방식 저장
    if (cutSelectedGrade === '1') {
      const cut = gradeCuts.target;
      cut.exploreBySubject = null;
      for (let i = 1; i <= 8; i++) {
        cut.raw.korean[i - 1] = Number(document.getElementById('raw_korean' + i).value);
        cut.raw.math[i - 1] = Number(document.getElementById('raw_math' + i).value);
        cut.raw.social[i - 1] = Number(document.getElementById('raw_social' + i).value);
        cut.raw.science[i - 1] = Number(document.getElementById('raw_science' + i).value);
        cut.std.korean[i - 1] = Number(document.getElementById('std_korean' + i).value);
        cut.std.math[i - 1] = Number(document.getElementById('std_math' + i).value);
        cut.std.social[i - 1] = Number(document.getElementById('std_social' + i).value);
        cut.std.science[i - 1] = Number(document.getElementById('std_science' + i).value);
      }
    } else {
      // 2·3학년: 화면의 입력 필드를 스캔하여 details에 저장
      ensureGradeCutDetails();
      const inputs = document.querySelectorAll('#cutInputTable input.grade-cut-input');
      inputs.forEach(inp => {
        const gradeKey = inp.getAttribute('data-grade'); // '2' | '3'
        const type = inp.getAttribute('data-type'); // 'raw' | 'std'
        const category = inp.getAttribute('data-category');
        const subj = inp.getAttribute('data-subject');
        const lvl = Number(inp.getAttribute('data-level'));
        const val = Number(inp.value);
        if (isNaN(lvl)) return;
        if (gradeKey === '2') {
          if (category === 'g2_basic') {
            const d = gradeCuts.details['2'];
            if (!d.basic[type][subj]) d.basic[type][subj] = [];
            d.basic[type][subj][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g2_social') {
            const k = subj; if (!gradeCuts.details['2'].social[k]) gradeCuts.details['2'].social[k] = { raw: [], std: [] };
            gradeCuts.details['2'].social[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g2_science') {
            const k = subj; if (!gradeCuts.details['2'].science[k]) gradeCuts.details['2'].science[k] = { raw: [], std: [] };
            gradeCuts.details['2'].science[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          }
        } else if (gradeKey === '3') {
          if (category === 'g3_korean') {
            const k = subj; if (!gradeCuts.details['3'].kor[k]) gradeCuts.details['3'].kor[k] = { raw: [], std: [] };
            gradeCuts.details['3'].kor[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_math') {
            const k = subj; if (!gradeCuts.details['3'].math[k]) gradeCuts.details['3'].math[k] = { raw: [], std: [] };
            gradeCuts.details['3'].math[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_kor_combined') {
            if (!gradeCuts.details['3'].korCombined) gradeCuts.details['3'].korCombined = { std: [] };
            if (type === 'std') gradeCuts.details['3'].korCombined.std[lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_math_combined') {
            if (!gradeCuts.details['3'].mathCombined) gradeCuts.details['3'].mathCombined = { std: [] };
            if (type === 'std') gradeCuts.details['3'].mathCombined.std[lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_eh') {
            const d = gradeCuts.details['3'];
            if (!d.engHis[type][subj]) d.engHis[type][subj] = [];
            d.engHis[type][subj][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_social') {
            const k = subj; if (!gradeCuts.details['3'].social[k]) gradeCuts.details['3'].social[k] = { raw: [], std: [] };
            gradeCuts.details['3'].social[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          } else if (category === 'g3_science') {
            const k = subj; if (!gradeCuts.details['3'].science[k]) gradeCuts.details['3'].science[k] = { raw: [], std: [] };
            gradeCuts.details['3'].science[k][type][lvl - 1] = isNaN(val) ? undefined : val;
          }
        }
      });

      // 분석 엔진이 참조하는 gradeCuts.target에도 반영 (2학년 신·구 교육과정, 3학년 모두)
      const selYear = document.getElementById('ebsiYear')?.value || gradeCuts.details[cutSelectedGrade]?.year || gradeCuts.target.year || '';
      syncDetailsToTarget(cutSelectedGrade, selYear);
    }

    if (!silent) showToast('등급컷이 저장되었습니다. 데이터 입력이 반영되었습니다.');
    if (typeof updateStepIndicator === 'function') updateStepIndicator();
    hideLoading();
  }, 300);
};

// ------------------- 등급컷 유효성 검사 (실시간/저장 전) -------------------
function attachCutInputValidation() {
  const inputs = document.querySelectorAll('#cutInputTable input[type="number"]');
  inputs.forEach(inp => {
    inp.addEventListener('input', () => validateCutInputs(true));
  });
}

function validateCutInputs(applyStyles = false) {
  const errors = [];
  // 기존 인라인 오류 텍스트 제거
  if (applyStyles) {
    document.querySelectorAll('#cutInputTable .cut-error-text').forEach(el => el.remove());
  }
  const markEl = (el, ok, msg) => {
    if (!applyStyles || !el) return;
    el.classList.remove('cut-valid', 'cut-invalid');
    el.style.borderColor = '';
    el.style.boxShadow = '';
    // 기존 오류 텍스트 제거
    const existing = el.parentElement?.querySelector('.cut-error-text');
    if (existing) existing.remove();
    if (ok) {
      if (el.value !== '') el.classList.add('cut-valid');
    } else {
      el.classList.add('cut-invalid');
      if (msg) {
        const errSpan = document.createElement('span');
        errSpan.className = 'cut-error-text';
        errSpan.textContent = msg;
        el.parentElement?.appendChild(errSpan);
      }
    }
  };

  // 그룹핑: raw/std 각각에 대해 subject별로 1~8 체크
  const allInputs = Array.from(document.querySelectorAll('#cutInputTable input.grade-cut-input'));
  const groups = { raw: {}, std: {} };
  allInputs.forEach(inp => {
    const type = inp.getAttribute('data-type');
    const subj = inp.getAttribute('data-subject');
    const level = Number(inp.getAttribute('data-level'));
    if (!groups[type][subj]) groups[type][subj] = {};
    groups[type][subj][level] = inp;
  });

  // 원점수 0~100, 표준점수 0~200, 단조감소
  const validateGroup = (type, rangeMax) => {
    Object.keys(groups[type]).forEach(subj => {
      // 실채점 발표 이후 EBSi에서 원점수 등급컷이 삭제되는 경우가 있어,
      // 원점수 입력칸을 전부 비워두면(=미제공) 필수 입력으로 취급하지 않고 통과시킨다.
      if (type === 'raw') {
        const cells = [];
        for (let i = 1; i <= 8; i++) { if (groups[type][subj][i]) cells.push(groups[type][subj][i]); }
        const allBlank = cells.length > 0 && cells.every(el => el.value === '');
        if (allBlank) {
          cells.forEach(el => markEl(el, true));
          return;
        }
      }
      let prev = Infinity;
      for (let i = 1; i <= 8; i++) {
        const el = groups[type][subj][i];
        if (!el) continue;
        const v = Number(el.value);
        const inRange = !isNaN(v) && v >= 0 && v <= rangeMax;
        if (!inRange) {
          markEl(el, false, `0~${rangeMax}`);
          errors.push(`[${type === 'raw' ? '원점수' : '표준점수'}/${subj}] ${i}등급 값이 유효하지 않습니다 (0~${rangeMax})`);
        } else if (!isNaN(v) && v > prev) {
          markEl(el, false, '감소 규칙 위반');
          errors.push(`[${type === 'raw' ? '원점수' : '표준점수'}/${subj}] ${i - 1}등급 ≥ ${i}등급 규칙 위반`);
        } else {
          markEl(el, true);
        }
        prev = isNaN(v) ? prev : v;
      }
    });
  };

  validateGroup('raw', 100);
  validateGroup('std', 200);

  return { valid: errors.length === 0, errors };
}

// ------------------- suneungcalc.com 참고 원점수 자동완성 -------------------
/**
 * suneungcalc.com의 데이터 파일(https://suneungcalc.com/js/data.js)은 시험(연도/월/시험유형)별로
 * 과목당 [표준점수, 백분위, 등급] 배열을 원점수 내림차순 인덱스로 담고 있다.
 * 예: data["202692nd"]["통합사회"][idx] -> 원점수 = 50 - idx*(50/(배열길이-1))
 * (국어/수학은 원점수 만점 100, 탐구는 만점 50 — 신교육과정 통합사회/통합과학은 0.5점 단위라 배열이 촘촘할 뿐,
 *  공식은 동일하게 "만점 - idx*(만점/(배열길이-1))"로 계산하면 자동으로 맞는다)
 * 이 데이터는 실제 실행 가능한 JS 파일(let data = {...})이라 JSON.parse로는 못 읽으므로(주석/트레일링 콤마 포함),
 * new Function으로 격리된 스코프에서 실행해 값만 꺼내온다. 하드코딩된 신뢰 도메인만 로드한다.
 */
window.loadSuneungCalcData = async function () {
  if (window.__suneungCalcData) return window.__suneungCalcData;
  const res = await fetch('https://suneungcalc.com/js/data.js');
  if (!res.ok) throw new Error('data.js를 불러오지 못했습니다. (HTTP ' + res.status + ')');
  const text = await res.text();
  const parsed = parseSuneungCalcDataText(text);
  if (!parsed) throw new Error('data.js에서 데이터를 찾지 못했습니다.');
  window.__suneungCalcData = parsed;
  return parsed;
};

// data.js를 "실행하지 않고" 값으로만 읽는다. (예전엔 new Function으로 실행했는데, 외부 사이트 파일이
// 바뀌거나 변조되면 학생 성적이 열려 있는 이 페이지에서 임의의 코드가 돌 수 있었다)
// 파일 모양: let data = { ... }; — 주석, 작은따옴표 문자열, 끝 쉼표가 섞인 JS 객체 리터럴이라
// 문자열 밖의 주석을 지우고 작은따옴표 문자열을 JSON 문자열로 바꾼 뒤 끝 쉼표를 없애 JSON으로 읽는다.
function parseSuneungCalcDataText(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  const src = text.slice(start, end + 1);
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1, val = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\') { val += src[j] + src[j + 1]; j += 2; continue; }
        val += src[j++];
      }
      if (ch === '"') out += '"' + val + '"';
      else out += JSON.stringify(val.replace(/\\'/g, "'"));
      i = j;
    } else if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += ch;
    }
  }
  out = out.replace(/,(\s*[\]}])/g, '$1');
  // 원본에 쉼표가 빠진 곳("[]\n[...]")이 있다. JS로 실행하면 이 부분은 "빈 배열[인덱스]" = undefined 한 칸이 되므로 똑같이 null 한 칸으로 읽는다
  out = out.replace(/\[\s*\]\s*\[[^\[\]]*\]/g, 'null');
  try { return JSON.parse(out); } catch (e) { return null; }
}

// suneungcalc 과목명과 우리 내부 과목명/슬러그 사이의 표기 차이(공백, 가운뎃점, 로마숫자 등)를 무시하고 비교
function suneungNormKey(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/[·∙·]/g, '')
    .replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II')
    .trim();
}

// examObj(특정 시험의 과목별 데이터)에서 candidates 이름 중 하나와 일치하는 실제 키를 찾는다.
function suneungFindSubjectKey(examObj, candidates) {
  if (!examObj) return null;
  const keys = Object.keys(examObj);
  for (const cand of candidates) {
    const normCand = suneungNormKey(cand);
    const found = keys.find(k => suneungNormKey(k) === normCand);
    if (found) return found;
  }
  return null;
}

// 표준점수로 원점수를 역산 (정확히 일치하는 값이 있을 때만 반환, 근사치 추정은 하지 않음)
function suneungReverseRaw(arr, stdTarget, maxRaw) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const target = Number(stdTarget);
  if (isNaN(target)) return null;
  const step = maxRaw / (arr.length - 1);
  for (let idx = 0; idx < arr.length; idx++) {
    const entry = arr[idx];
    if (entry && entry.length && Number(entry[0]) === target) {
      const raw = maxRaw - idx * step;
      return Math.round(raw * 100) / 100;
    }
  }
  return null;
}

// 표준점수로 원점수+백분위를 함께 역산 (표준점수 등급컷 자동완성과 달리, 학생 개인별 추정에 사용)
function suneungReverseLookup(arr, stdTarget, maxRaw) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const target = Number(stdTarget);
  if (isNaN(target)) return null;
  const step = maxRaw / (arr.length - 1);
  for (let idx = 0; idx < arr.length; idx++) {
    const entry = arr[idx];
    if (entry && entry.length && Number(entry[0]) === target) {
      const raw = Math.round((maxRaw - idx * step) * 100) / 100;
      const percentile = entry[1] !== undefined ? Number(entry[1]) : null;
      const grade = entry[2] !== undefined ? Number(entry[2]) : null;
      return { raw, percentile: isNaN(percentile) ? null : percentile, grade: isNaN(grade) ? null : grade };
    }
  }
  return null;
}

const SNC_SLUG_TO_KOREAN = {
  soc_life_ethics: '생활과윤리', soc_ethics_thought: '윤리와사상', soc_k_geo: '한국지리', soc_world_history: '세계사',
  soc_world_geo: '세계지리', soc_east_asia: '동아시아사', soc_politics_law: '정치와법', soc_economy: '경제', soc_society_culture: '사회문화',
  sci_phy1: '물리학 I', sci_chem1: '화학 I', sci_bio1: '생명과학 I', sci_earth1: '지구과학 I',
  sci_phy2: '물리학 II', sci_chem2: '화학 II', sci_bio2: '생명과학 II', sci_earth2: '지구과학 II'
};

/**
 * 학생별 원점수/백분위를 suneungcalc.com 자료로 추정해 채운다.
 * EBSi에서 방금 등급컷을 불러온 시험(연도/학년/시험) 정보가 있어야 동작한다.
 * - 대상(target) 학생: window.__lastEbsiExam (등급컷 탭에서 불러온 시험)
 * - 비교(compare) 학생: examContext로 직접 넘겨준 시험 정보 (비교 탭의 EBSi 등급컷 불러오기)
 *   — 대상과 비교는 서로 다른 시험(예: 올해 vs 작년)일 수 있으므로 반드시 구분해서 써야 한다.
 * 3학년 국어/수학은 공통+선택과목 조합형(회귀식)이라 단일 원점수로 역산할 수 없어 제외한다.
 * 사회/과학은 통합과목(1학년 항상, 2학년은 2026학년도부터)일 때만 안전하게 역산 가능 —
 * 구 교육과정 선택과목(개별 학생이 어떤 과목을 골랐는지 파일에 없음)은 추정하지 않는다.
 * 이미 원점수가 있는 과목은 절대 덮어쓰지 않는다.
 */
function clearStaleEstimates(students, currentKey) {
  const clear = rec => {
    if (!rec || !rec._추정) return;
    Object.keys(rec._추정).forEach(f => { if (rec._추정[f] !== currentKey) { rec[f] = ''; delete rec._추정[f]; } });
  };
  (students || []).forEach(s => {
    ['국어', '수학', '사회탐구', '과학탐구'].forEach(k => clear(s[k]));
    (s.탐구목록 || []).forEach(clear);
  });
}

async function estimateStudentsRawScores(students, examContext) {
  const ctx = examContext || window.__lastEbsiExam;
  if (!ctx) return;
  const type = detectSncTypeFromExamText(ctx.examText, { '1': 'D100', '2': 'D200', '3': 'D300' }[ctx.gradeVal]);
  const month = extractMonthFromExamText(ctx.examText);
  if (!type || !month) return;
  const yearNum = Number(ctx.year);
  if (isNaN(yearNum)) return;
  const sncYear = (type === 'sat') ? String(yearNum + 1) : ctx.year;
  const key = `${sncYear}${month}${type}`;

  let sncData;
  try { sncData = await window.loadSuneungCalcData(); } catch (e) { return; }
  const examObj = sncData[key];
  if (!examObj) {
    // 이 시험 자료가 없으면, 다른 시험 기준으로 추정해 둔 값은 틀린 값이므로 지운다
    clearStaleEstimates(students, key);
    return;
  }

  // 추정한 값은 실제 원점수/백분위 칸에 그대로 채운다 — 한 번 채워지면 "성적 확인"뿐 아니라
  // "성적 분석"의 통계·차트 등 원점수를 참조하는 모든 곳에서 자연스럽게 쓰이게 하기 위함.
  // (이미 값이 있으면 절대 덮어쓰지 않는다)
  //
  // 원점수와 백분위는 따로 판단한다:
  // - 백분위: 표준점수 → 백분위는 항상 1:1이라 표만 있으면 언제나 채울 수 있다.
  // - 원점수: 3학년·수능형 국어/수학처럼 표 맨 앞에 회귀식(공통+선택 조합) 객체가 있는 과목은
  //   원점수가 한 값으로 정해지지 않으므로 채우지 않는다. (학년이 아니라 데이터 모양으로 판단)
  // fillGrade: 탐구목록처럼 선택과목별 등급컷이 따로 없는 경우, 변환표의 등급 칸으로 등급도 채운다
  //
  // 추정해서 채운 칸은 rec._추정[칸] = 시험 키로 표시해 둔다. 나중에 다른 시험(등급컷)을 불러오면
  // 그 칸은 새 시험 기준으로 다시 계산한다 — 파일에 원래 있던 값(표시 없음)은 절대 건드리지 않는다.
  const fill = (rec, candidates, maxRaw, fillGrade) => {
    if (!rec || !rec.표준점수) return;
    const est = rec._추정 || (rec._추정 = {});
    const fields = fillGrade ? ['원점수', '백분위', '등급'] : ['원점수', '백분위'];
    // 다른 시험 기준으로 추정했던 칸은 비우고 다시 계산
    fields.forEach(f => { if (est[f] && est[f] !== key) { rec[f] = ''; delete est[f]; } });
    const isEmpty = f => rec[f] === undefined || rec[f] === null || String(rec[f]).trim() === '';
    const need = fields.filter(f => isEmpty(f));
    if (!need.length) return;
    const subjectKey = suneungFindSubjectKey(examObj, candidates.filter(Boolean));
    if (!subjectKey) return;
    const arr = examObj[subjectKey];
    const result = suneungReverseLookup(arr, rec.표준점수, maxRaw);
    if (!result) return;
    const rawInvertible = Array.isArray(arr) && Array.isArray(arr[0]);
    const put = (f, v) => { rec[f] = String(v); est[f] = key; };
    if (need.includes('원점수') && rawInvertible) put('원점수', result.raw);
    if (need.includes('백분위') && result.percentile !== null) put('백분위', result.percentile);
    if (need.includes('등급') && result.grade !== null) put('등급', result.grade);
  };

  students.forEach(s => {
    fill(s.국어, ['국어'], 100);
    fill(s.수학, ['수학'], 100);
    // 탐구: 학생이 실제로 응시한 선택과목명을 알면(표준점수 기준 리포트) 그 과목 표를 쓰고,
    // 모르면 통합사회/통합과학(공통과목) 표를 시도한다. 둘 다 없으면 건너뛴다.
    fill(s.사회탐구, [s.사회탐구?.과목, '사회', '통합사회'], 50);
    fill(s.과학탐구, [s.과학탐구?.과목, '과학', '통합과학'], 50);
    (s.탐구목록 || []).forEach(e => {
      const common = e.분류 === 'science' ? ['과학', '통합과학'] : ['사회', '통합사회'];
      fill(e, [e.과목, ...common], 50, true);
    });
  });
}

// ------------------- EBSi 불러오기 진행 상황 모달 -------------------
// EBSi 등급컷 자동 불러오기(loadEbsiGradeCuts) 진행 과정을 단계별로 보여주는 체크리스트 모달.
function showEbsiProgress(steps) {
  const modal = document.getElementById('ebsiProgressModal');
  const list = document.getElementById('ebsiProgressList');
  const overlay = document.getElementById('overlay');
  if (!modal || !list) return;
  list.innerHTML = steps.map(s =>
    `<li id="ebsiStep_${s.key}" class="pending"><span class="ebsi-step-icon">○</span><span class="ebsi-step-label">${s.label}</span></li>`
  ).join('');
  modal.style.display = 'block';
  if (overlay) overlay.style.display = 'block';
}
const EBSI_STEP_ICON = { pending: '○', loading: '◐', done: '✓', skip: '－', error: '✕' };
function setEbsiStepStatus(key, status, note) {
  const li = document.getElementById('ebsiStep_' + key);
  if (!li) return;
  li.className = status;
  const icon = li.querySelector('.ebsi-step-icon');
  if (icon) icon.textContent = EBSI_STEP_ICON[status] || '○';
  let noteEl = li.querySelector('.ebsi-step-note');
  if (note) {
    if (!noteEl) {
      noteEl = document.createElement('span');
      noteEl.className = 'ebsi-step-note';
      li.appendChild(noteEl);
    }
    noteEl.textContent = ' - ' + note;
  } else if (noteEl) {
    noteEl.remove();
  }
}
function hideEbsiProgress() {
  const modal = document.getElementById('ebsiProgressModal');
  const overlay = document.getElementById('overlay');
  if (modal) modal.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}
// 이미 떠 있는 진행 모달에 단계를 하나 더 추가한다 (필요한 경우에만 동적으로 붙이기 위함)
function addEbsiProgressStep(key, label) {
  const list = document.getElementById('ebsiProgressList');
  if (!list) return;
  const li = document.createElement('li');
  li.id = 'ebsiStep_' + key;
  li.className = 'pending';
  li.innerHTML = `<span class="ebsi-step-icon">○</span><span class="ebsi-step-label">${label}</span>`;
  list.appendChild(li);
}

// EBSi에서 선택한 시험명 텍스트(예: "3.26 학력평가", "9월 모의평가")로 suneungcalc 시험유형/월을 추정한다.
// (추측이 아니라 사용자가 EBSi에서 이미 고른 시험 그대로를 suneungcalc 키 형식으로 옮기는 것)
function detectSncTypeFromExamText(examText, ebsiGradeVal) {
  const t = String(examText || '');
  if (t.includes('수능') || t.includes('모의평가')) return 'sat';
  return { D100: '1st', D200: '2nd', D300: '3rd' }[ebsiGradeVal] || null;
}
function extractMonthFromExamText(examText) {
  const m = String(examText || '').match(/(\d{1,2})\s*[.월]/);
  return m ? String(Number(m[1])) : null;
}

// EBSi에서 방금 불러온 등급컷 중, 표준점수는 있는데 원점수가 비어있는 과목이 하나라도 있는지 확인한다.
// (네트워크 요청 없이 판단 — 필요할 때만 suneungcalc 단계를 진행 상황 모달에 추가/실행하기 위함)
function needsSuneungFill(gradeVal) {
  const need = (stdArr, rawArr) => Array.isArray(stdArr) && stdArr.some(v => Number(v) > 0) && !cutsAreUsable(rawArr);
  if (gradeVal === 'D100') {
    const cut = gradeCuts.target;
    return need(cut.std.korean, cut.raw.korean) || need(cut.std.math, cut.raw.math) ||
      need(cut.std.social, cut.raw.social) || need(cut.std.science, cut.raw.science);
  } else if (gradeVal === 'D200') {
    const d2 = gradeCuts.details && gradeCuts.details['2'];
    if (!d2) return false;
    // 신 교육과정(통합사회/통합과학)은 d2.basic 안에 함께 저장됨
    if (need(d2.basic.std.korean, d2.basic.raw.korean) || need(d2.basic.std.math, d2.basic.raw.math) ||
      need(d2.basic.std.social, d2.basic.raw.social) || need(d2.basic.std.science, d2.basic.raw.science)) return true;
    // 구 교육과정(선택과목제)은 과목별로 따로 저장됨
    return Object.values(d2.social || {}).some(e => need(e.std, e.raw)) ||
      Object.values(d2.science || {}).some(e => need(e.std, e.raw));
  } else if (gradeVal === 'D300') {
    const d3 = gradeCuts.details && gradeCuts.details['3'];
    if (!d3) return false;
    return Object.values(d3.social || {}).some(e => need(e.std, e.raw)) ||
      Object.values(d3.science || {}).some(e => need(e.std, e.raw));
  }
  return false;
}

/**
 * EBSi에서 등급컷(표준점수)을 불러온 뒤, 원점수 등급컷이 비어있는 과목에 한해
 * suneungcalc.com 자료로 표준점수 -> 원점수를 역산해서 채운다.
 * EBSi에서 이미 원점수를 받아온 과목은 건드리지 않는다.
 * @returns {Promise<{filled:number, reason:string|null}>}
 */
async function fillMissingRawFromSuneungCalc(gradeVal, year, examText) {
  const type = detectSncTypeFromExamText(examText, gradeVal);
  const month = extractMonthFromExamText(examText);
  if (!type || !month) {
    return { filled: 0, reason: '시험 유형/월 정보를 확인할 수 없어 건너뜀' };
  }

  // EBSi의 "연도"는 시행(달력) 연도. 학평(1st/2nd/3rd)은 suneungcalc도 시행 연도를 그대로 쓰지만,
  // 평가원 시험(sat: 6·9·11월 모의평가·수능)은 suneungcalc가 "학년도" 표기를 쓰므로 시행 연도+1이 된다.
  // (추측이 아니라 확정된 규칙 — EBSi에서 이미 고른 시험을 그대로 옮기는 것)
  const yearNum = Number(year);
  if (isNaN(yearNum)) {
    return { filled: 0, reason: '연도 정보를 확인할 수 없어 건너뜀' };
  }
  const sncYear = (type === 'sat') ? String(yearNum + 1) : year;

  let sncData;
  try {
    sncData = await window.loadSuneungCalcData();
  } catch (e) {
    return { filled: 0, reason: 'suneungcalc.com 자료를 불러오지 못함 (' + e.message + ')' };
  }

  const matchedKey = `${sncYear}${month}${type}`;
  const examObj = sncData[matchedKey];
  if (!examObj) {
    return { filled: 0, reason: `suneungcalc.com에 자료가 없음 (${matchedKey})` };
  }

  let filled = 0;

  // 한 과목(std 배열, raw 배열, 만점, suneungcalc 후보 이름)에 대해 비어있는 원점수를 채우는 공통 로직
  function fillSubject(stdArr, rawArrRef, candidates, maxRaw) {
    if (!Array.isArray(stdArr) || cutsAreUsable(rawArrRef.get())) return; // 원점수가 이미 있으면 건드리지 않음
    if (!stdArr.some(v => Number(v) > 0)) return; // 표준점수 자체가 없으면 역산 불가
    const subjectKey = suneungFindSubjectKey(examObj, candidates);
    if (!subjectKey) return;
    const newRaw = [];
    let any = false;
    for (let i = 0; i < 8; i++) {
      const raw = suneungReverseRaw(examObj[subjectKey], stdArr[i], maxRaw);
      if (raw !== null) { newRaw[i] = raw; any = true; } else { newRaw[i] = 0; }
    }
    if (any) { rawArrRef.set(newRaw); filled++; }
  }

  if (gradeVal === 'D100') {
    const cut = gradeCuts.target;
    fillSubject(cut.std.korean, { get: () => cut.raw.korean, set: v => { cut.raw.korean = v; } }, ['국어'], 100);
    fillSubject(cut.std.math, { get: () => cut.raw.math, set: v => { cut.raw.math = v; } }, ['수학'], 100);
    fillSubject(cut.std.social, { get: () => cut.raw.social, set: v => { cut.raw.social = v; } }, ['사회', '통합사회'], 50);
    fillSubject(cut.std.science, { get: () => cut.raw.science, set: v => { cut.raw.science = v; } }, ['과학', '통합과학'], 50);
  } else if (gradeVal === 'D200') {
    ensureGradeCutDetails();
    const d2 = gradeCuts.details['2'];
    fillSubject(d2.basic.std.korean, { get: () => d2.basic.raw.korean, set: v => { d2.basic.raw.korean = v; } }, ['국어'], 100);
    fillSubject(d2.basic.std.math, { get: () => d2.basic.raw.math, set: v => { d2.basic.raw.math = v; } }, ['수학'], 100);
    Object.keys(d2.social || {}).forEach(slug => {
      const kor = SNC_SLUG_TO_KOREAN[slug];
      if (!kor) return;
      const entry = d2.social[slug];
      fillSubject(entry.std, { get: () => entry.raw, set: v => { entry.raw = v; } }, [kor], 50);
    });
    Object.keys(d2.science || {}).forEach(slug => {
      const kor = SNC_SLUG_TO_KOREAN[slug];
      if (!kor) return;
      const entry = d2.science[slug];
      fillSubject(entry.std, { get: () => entry.raw, set: v => { entry.raw = v; } }, [kor], 50);
    });
  } else if (gradeVal === 'D300') {
    ensureGradeCutDetails();
    const d3 = gradeCuts.details['3'];
    // 3학년 국어/수학 선택과목(화작/언매, 확통/미적/기하)은 통합 표준점수 산출 공식이 별도라
    // 단순 역산이 불가능하므로 지원하지 않는다. 영어/한국사도 절대평가라 자료가 없다.
    Object.keys(d3.social || {}).forEach(slug => {
      const kor = SNC_SLUG_TO_KOREAN[slug];
      if (!kor) return;
      const entry = d3.social[slug];
      fillSubject(entry.std, { get: () => entry.raw, set: v => { entry.raw = v; } }, [kor], 50);
    });
    Object.keys(d3.science || {}).forEach(slug => {
      const kor = SNC_SLUG_TO_KOREAN[slug];
      if (!kor) return;
      const entry = d3.science[slug];
      fillSubject(entry.std, { get: () => entry.raw, set: v => { entry.raw = v; } }, [kor], 50);
    });
  }

  return { filled, reason: filled ? null : `일치하는 표준점수를 찾지 못함 (${matchedKey})` };
}

// 등급컷 표의 헤더 행(tr) 셀 텍스트를 읽어 원점수/표준점수 열 위치를 찾는다.
// 실채점 결과 발표 이후 EBSi에서 원점수 열이 삭제되는 경우가 있어,
// 고정 인덱스(2/3) 대신 헤더 텍스트로 열을 찾아야 안전하다.
// @returns {{rawIdx:number, stdIdx:number}} 못 찾으면 -1
function findRawStdColIdx(headerTr) {
  const cells = Array.from(headerTr?.children || []).map(c => (c.innerText || c.textContent || '').trim());
  let rawIdx = cells.findIndex(t => t.includes('원점수'));
  let stdIdx = cells.findIndex(t => t.includes('표준점수'));
  if (rawIdx === -1 && stdIdx === -1) { rawIdx = 2; stdIdx = 3; } // 폴백(과거 레이아웃)
  return { rawIdx, stdIdx };
}

// ------------------- EBSi 등급컷 HTML 파싱 및 추출 -------------------
/**
 * EBSi 웹사이트에서 복사한 HTML에서 등급컷 데이터를 추출하는 함수
 * @param {string} html - EBSi에서 복사한 등급컷 테이블 HTML
 * @param {string} tab - 저장할 등급컷 타입 ('target' 또는 'compare')
 */
window.parseEBSiGradeCutHtml = function (html, tab = 'target') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 과목명 매핑 (한글 → 영문 키)
  const subjMap = { '국어': 'korean', '수학': 'math', '영어': 'english', '한국사': 'history' };

  // 등급컷 배열 초기화
  ['korean', 'math', 'english', 'history'].forEach(subj => {
    gradeCuts[tab].raw[subj] = [];
    gradeCuts[tab].std[subj] = [];
  });

  // HTML에서 과목별 등급컷 테이블 파싱
  let missingRawSubjects = [];
  doc.querySelectorAll('.col_6').forEach(col => {
    const subjKor = col.querySelector('h3')?.textContent.trim();
    const subj = subjMap[subjKor];
    if (!subj) return;

    const trs = col.querySelectorAll('tbody tr');
    // 헤더 행(등급컷 표의 첫 번째 tr)의 셀 텍스트로 원점수/표준점수 열 위치를 찾는다.
    // 실채점 결과 발표 이후에는 EBSi에서 원점수 열 자체가 삭제되는 경우가 있어,
    // 고정 인덱스(2/3) 대신 헤더 텍스트 기반으로 열을 찾아야 안전하다.
    const headerCells = Array.from(trs[0]?.querySelectorAll('td,th') || []).map(c => (c.textContent || '').trim());
    let rawIdx = headerCells.findIndex(t => t.includes('원점수'));
    let stdIdx = headerCells.findIndex(t => t.includes('표준점수'));
    // 헤더를 못 찾은 경우 과거 레이아웃(2/3열)로 폴백
    if (rawIdx === -1 && stdIdx === -1) { rawIdx = 2; stdIdx = 3; }

    let rawArr = [], stdArr = [];
    for (let i = 1; i <= 8; i++) {
      const tr = trs[i];
      if (!tr) continue;
      const tds = tr.querySelectorAll('td');
      if (rawIdx !== -1) rawArr.push(Number(tds[rawIdx]?.textContent.trim() || 0));
      if (stdIdx !== -1) stdArr.push(Number(tds[stdIdx]?.textContent.trim() || 0));
    }

    // 원점수 열을 찾지 못했다면(=EBSi에서 삭제됨) 잘못된 값을 채우지 않고 비워둔다.
    if (rawIdx === -1) { rawArr = []; missingRawSubjects.push(subjKor); }
    gradeCuts[tab].raw[subj] = rawArr;
    gradeCuts[tab].std[subj] = stdArr;
  });

  if (missingRawSubjects.length) {
    showMessage(`붙여넣은 등급컷에서 표준점수 등급컷을 추출했습니다.\n(${missingRawSubjects.join(', ')}은(는) 원점수 등급컷이 제공되지 않아 표준점수만 반영되었습니다. 분석은 표준점수 기준으로 진행됩니다.)`);
  } else {
    showMessage('붙여넣은 등급컷에서 원점수/표준점수 등급컷을 모두 추출했습니다.');
  }
  initCutTable();
};

// ------------------- EBSi 등급컷 자동 불러오기 시스템 -------------------
/**
 * EBSi 웹사이트에서 시험 목록을 동적으로 불러와 드롭다운 메뉴를 생성하는 함수
 * 연도/학년/시험별 등급컷 데이터를 자동으로 가져올 수 있도록 함
 */
window.fetchEBSiCuts = async function () {
  showLoading();

  try {
    // 1단계: EBSi 메인 페이지에서 시험 목록 데이터 가져오기
    const mainRes = await fetch('https://www.ebsi.co.kr/ebs/xip/xipt/RetrieveSCVMainTop.ajax?irecord=202506041', {
      method: 'POST'
    });
    const mainHtml = await mainRes.text();

    // 2단계: HTML에서 JavaScript 코드 추출 (시험 목록 데이터 포함)
    const scriptMatch = mainHtml.match(/jQuery\('#search_year'\)\.on\('change'[\s\S]*?}\);/);
    if (!scriptMatch) {
      throw new Error('시험 목록 데이터를 찾을 수 없습니다.');
    }

    const jsCode = scriptMatch[0];

    // 3단계: JavaScript 코드에서 연도별 시험 데이터 파싱
    const examData = parseExamData(jsCode);

    // 4단계: 파싱된 데이터로 UI 업데이트
    updateEbsiUI(examData);

  } catch (e) {
    showEbsiError('EBSi 시험 목록 불러오기', e);
  } finally {
    hideLoading();
  }
};

/**
 * EBSi JavaScript 코드에서 시험 데이터를 파싱하는 함수
 * @param {string} jsCode - EBSi에서 가져온 JavaScript 코드
 * @returns {Object} 연도별/학년별 시험 목록 데이터
 */
function parseExamData(jsCode) {
  const examData = {};

  // 연도별 블록 추출 (정규표현식 사용)
  const yearPattern = /if\(year == '(\d{4})'\) \{([\s\S]*?)\}(?=\s*else if\(year|jQuery)/g;
  let yearMatch;

  while ((yearMatch = yearPattern.exec(jsCode)) !== null) {
    const year = yearMatch[1];
    const yearBlock = yearMatch[2];
    examData[year] = {};

    // 학년별 블록 추출
    const targetPattern = /if\(target == '(D\d{3})'\) \{([\s\S]*?)\}(?=\s*else if\(target|\s*\})/g;
    let targetMatch;

    while ((targetMatch = targetPattern.exec(yearBlock)) !== null) {
      const target = targetMatch[1];
      const targetBlock = targetMatch[2];

      // 시험 옵션 추출
      const optionPattern = /options \+= '<option value="(\d+)">([^<]+)<\/option>';/g;
      const options = [];
      let optionMatch;

      while ((optionMatch = optionPattern.exec(targetBlock)) !== null) {
        options.push({
          value: optionMatch[1], // irecord 값
          text: optionMatch[2]   // 시험명 (예: "3.26 학력평가")
        });
      }

      examData[year][target] = options;
    }
  }

  return examData;
}

/**
 * 파싱된 시험 데이터로 EBSi 드롭다운 UI를 생성하는 함수
 * @param {Object} examData - parseExamData에서 반환된 시험 데이터
 */
function updateEbsiUI(examData) {
  const ebsiContainer = document.getElementById('ebsiInputs');

  // 기존 내용 초기화
  ebsiContainer.innerHTML = '';

  // 연도/학년/시험 선택 드롭다운 UI 생성
  ebsiContainer.innerHTML = `
    <div class="flex-row gap-10 align-center mb-20">
      <label>
        <select id="ebsiYear" class="minw-90" onchange="updateGradeOptions()">
          <option value="">연도선택</option>
          ${Object.keys(examData).map(year => `<option value="${year}">${year}년</option>`).join('')}
        </select>
      </label>
      <label>
        <select id="ebsiGrade" class="minw-70" onchange="updateExamOptions(); initCutTable();">
          <option value="">학년선택</option>
          <option value="D100">1학년</option>
          <option value="D200">2학년</option>
          <option value="D300">3학년</option>
        </select>
      </label>
      <label>
        <select id="ebsiExam" class="minw-120">
          <option value="">시험선택</option>
        </select>
      </label>
      <button type="button" class="copy-btn" onclick="loadEbsiGradeCuts()">등급컷 불러오기</button>
      <button onclick="showPastePopup()" class="copy-btn ml-8">EBSi HTML 붙여넣기</button>
    </div>
  `;

  // 전역 변수에 시험 데이터 저장
  window.ebsiExamData = examData;
}

/**
 * 연도 선택 시 학년 드롭다운 활성화/비활성화 함수
 */
function updateGradeOptions() {
  const year = document.getElementById('ebsiYear').value;
  const gradeSelect = document.getElementById('ebsiGrade');
  const examSelect = document.getElementById('ebsiExam');

  // 연도가 선택되고 해당 연도 데이터가 있으면 학년 드롭다운 활성화
  if (year && window.ebsiExamData[year]) {
    gradeSelect.disabled = false;
  } else {
    gradeSelect.disabled = true;
    gradeSelect.value = '';
  }

  // 시험 드롭다운 초기화
  examSelect.innerHTML = '<option value="">시험선택</option>';
  examSelect.disabled = true;
}

/**
 * 학년 선택 시 시험 드롭다운 옵션 업데이트 함수
 */
function updateExamOptions() {
  const year = document.getElementById('ebsiYear').value;
  const grade = document.getElementById('ebsiGrade').value;
  const examSelect = document.getElementById('ebsiExam');

  // 연도와 학년이 모두 선택되고 해당 데이터가 있으면 시험 목록 표시
  if (year && grade && window.ebsiExamData[year] && window.ebsiExamData[year][grade]) {
    const exams = window.ebsiExamData[year][grade];
    examSelect.innerHTML = '<option value="">시험선택</option>' +
      exams.map(exam => `<option value="${exam.value}">${exam.text}</option>`).join('');
    examSelect.disabled = false;
  } else {
    examSelect.innerHTML = '<option value="">시험선택</option>';
    examSelect.disabled = true;
  }
}

/**
 * 선택된 시험의 등급컷을 EBSi에서 불러와 적용하는 함수
 */
async function loadEbsiGradeCuts() {
  const year = document.getElementById('ebsiYear').value;
  const grade = document.getElementById('ebsiGrade').value;
  const examSelectEl = document.getElementById('ebsiExam');
  const irecord = examSelectEl.value;
  const examText = examSelectEl.options[examSelectEl.selectedIndex]?.text || '';

  // 필수 선택 항목 검증
  if (!year || !grade || !irecord) {
    showMessage('연도, 학년, 시험을 모두 선택하세요.');
    return;
  }

  // 성적 확인 탭에서 학생별 원점수/백분위를 suneungcalc로 추정할 때 재사용할 시험 정보 저장
  const gmapForExam = { D100: '1', D200: '2', D300: '3' };
  window.__lastEbsiExam = { gradeVal: gmapForExam[grade] || '', year, examText };

  showLoading();

  // EBSi API 요청 설정 (과목별로 분리된 요청)
  let reqs = [];
  if (grade === 'D100') {
    // 1학년: 현행 (기존 subjectId)
    reqs = [
      { subjectId: '17012,17014,17020,110001', ord: 1, key: 'main' },
      { subjectId: '140072', ord: 2, key: 'social' },
      { subjectId: '140073', ord: 3, key: 'science' }
    ];
  } else if (grade === 'D200') {
    if (isNewTamguSystem('2', year)) {
      // 2026학년도부터 2학년 탐구가 1학년처럼 통합사회/통합과학 공통과목으로 개편됨
      reqs = [
        { subjectId: '17022,50612,120013,140111', ord: 1, key: 'g2_main' },
        { subjectId: '140220', ord: 2, key: 'g2_social_new' },
        { subjectId: '140221', ord: 3, key: 'g2_science_new' }
      ];
    } else {
      // 2026학년도 이전: 사회(9과목 선택) / 과학(4과목 선택)
      reqs = [
        { subjectId: '17022,50612,120013,140111', ord: 1, key: 'g2_main' },
        { subjectId: '17029,17037,17038,50613,50615,50616,50617,50618,140109', ord: 2, key: 'g2_social' },
        { subjectId: '17041,17042,17043,140113', ord: 3, key: 'g2_science' }
      ];
    }
  } else if (grade === 'D300') {
    // 3학년: 국수영한 / 사회 / 과학 (제공 subjectId)
    reqs = [
      { subjectId: '63004,80003,140117,140119', ord: 1, key: 'g3_main' },
      { subjectId: '141,142,146,63001,63002,63003,66001,66002,140112', ord: 2, key: 'g3_social' },
      { subjectId: '154,155,156,157,158,159,140115,140116', ord: 3, key: 'g3_science' }
    ];
  } else {
    // 3학년은 추후 보강 예정
    reqs = [
      { subjectId: '17012,17014,17020,110001', ord: 1, key: 'main' }
    ];
  }

  let cuts = { korean: [], math: [], english: [], history: [], social: [], science: [] };
  let stds = { korean: [], math: [], english: [], history: [], social: [], science: [] };
  const g2NewTamguFound = { social: false, science: false }; // 2학년 통합사회/통합과학 자동 조회 성공 여부

  // 진행 상황 모달 표시 (EBSi 요청 단계들. 원점수 자동완성 단계는 필요할 때만 나중에 추가됨)
  const EBSI_STEP_LABELS = {
    main: '국어·수학·영어·한국사 등급컷 불러오는 중',
    social: '사회탐구 등급컷 불러오는 중',
    science: '과학탐구 등급컷 불러오는 중',
    g2_main: '국어·수학·영어·한국사 등급컷 불러오는 중',
    g2_social: '사회탐구 등급컷 불러오는 중',
    g2_science: '과학탐구 등급컷 불러오는 중',
    g2_social_new: '통합사회 등급컷 불러오는 중',
    g2_science_new: '통합과학 등급컷 불러오는 중',
    g3_main: '국어·수학·영어·한국사 등급컷 불러오는 중',
    g3_social: '사회탐구 등급컷 불러오는 중',
    g3_science: '과학탐구 등급컷 불러오는 중'
  };
  hideLoading(); // 범용 로딩 스피너 대신 단계별 진행 모달을 보여준다
  showEbsiProgress(
    reqs.map(r => ({ key: r.key, label: EBSI_STEP_LABELS[r.key] || `${r.key} 등급컷 불러오는 중` }))
  );

  try {
    // 과목별로 등급컷 데이터 요청
    for (const req of reqs) {
      setEbsiStepStatus(req.key, 'loading');
      const form = new URLSearchParams();
      form.append('subjectId', req.subjectId);
      form.append('irecord', irecord);
      form.append('ord', req.ord);

      const url = 'https://www.ebsi.co.kr/ebs/xip/xipa/retrieveGrdCutList.ajax';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });

      const html = await res.text();
      // 응답 HTML을 화면 문서가 아닌 별도 문서로 읽는다 (응답 안의 이미지·이벤트 속성이 실행되지 않도록)
      const temp = new DOMParser().parseFromString(html, 'text/html').body;

      // 메인 과목 (국어, 수학, 영어, 한국사) 처리 - 1학년
      if (req.key === 'main') {
        const col6s = temp.querySelectorAll('.col_6');
        ['korean', 'math', 'english', 'history'].forEach((subj, idx) => {
          const trs = col6s[idx]?.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          cuts[subj] = [];
          stds[subj] = [];
          for (let i = 1; i <= 8; i++) {
            if (rawIdx !== -1) cuts[subj][i - 1] = Number(trs?.[i]?.children[rawIdx]?.innerText || 0);
            if (stdIdx !== -1) stds[subj][i - 1] = Number(trs?.[i]?.children[stdIdx]?.innerText || 0);
          }
          if (rawIdx === -1) cuts[subj] = []; // EBSi에서 원점수 열이 삭제된 경우 비워둠(표준점수로 대체 분석)
        });
      }
      // 탐구 과목 처리
      else if (req.key === 'social' || req.key === 'science') {
        const col6 = temp.querySelector('.col_6');
        const trs = col6?.querySelectorAll('tbody tr');
        const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
        cuts[req.key] = [];
        stds[req.key] = [];
        for (let i = 1; i <= 8; i++) {
          if (rawIdx !== -1) cuts[req.key][i - 1] = Number(trs?.[i]?.children[rawIdx]?.innerText || 0);
          if (stdIdx !== -1) stds[req.key][i - 1] = Number(trs?.[i]?.children[stdIdx]?.innerText || 0);
        }
        if (rawIdx === -1) cuts[req.key] = [];
      }
      // 3학년: 국/수/영/한 (특수 테이블)
      else if (req.key === 'g3_main') {
        ensureGradeCutDetails();
        const d3 = gradeCuts.details['3'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (nameKor === '국어') {
            const trs = col.querySelectorAll('table.kor_table tbody tr');
            const raw1 = [], raw2 = [], std = [];
            // tr 인덱스: 최고점 + 1~8 등급 → 등급행은 1..8 순으로 존재
            let gradeIdx = 0;
            trs.forEach(tr => {
              const tds = tr.children;
              if (!tds || tds.length < 5) return;
              const gtxt = (tds[0]?.innerText || '').trim();
              if (!/^(최고점|[1-8])$/.test(gtxt)) return;
              if (gtxt === '최고점') return;
              gradeIdx++;
              raw1[gradeIdx - 1] = parseNumberCell(tds[1]?.innerText);
              raw2[gradeIdx - 1] = parseNumberCell(tds[2]?.innerText);
              std[gradeIdx - 1] = parseNumberCell(tds[3]?.innerText);
            });
            d3.kor['kor_speaking'] = d3.kor['kor_speaking'] || { raw: [], std: [] };
            d3.kor['kor_language_media'] = d3.kor['kor_language_media'] || { raw: [], std: [] };
            // 실채점 발표 이후에는 EBSi가 화법과작문/언어와매체 각각의 원점수를 "-"로 표시하고
            // 표준점수만 제공한다. 이 경우 0으로 채우면 "원점수 0점"처럼 보여 오해를 부르므로 비워둔다.
            d3.kor['kor_speaking'].raw = raw1.map(v => isNaN(v) ? undefined : v);
            d3.kor['kor_language_media'].raw = raw2.map(v => isNaN(v) ? undefined : v);
            d3.korCombined.std = std.map(v => isNaN(v) ? 0 : v);
          } else if (nameKor === '수학') {
            const trs = col.querySelectorAll('table.math_table tbody tr');
            const rp = [], rc = [], rg = [], std = [];
            let gradeIdx = 0;
            trs.forEach(tr => {
              const tds = tr.children;
              if (!tds || tds.length < 6) return;
              const gtxt = (tds[0]?.innerText || '').trim();
              if (!/^(최고점|[1-8])$/.test(gtxt)) return;
              if (gtxt === '최고점') return;
              gradeIdx++;
              rp[gradeIdx - 1] = parseNumberCell(tds[1]?.innerText);
              rc[gradeIdx - 1] = parseNumberCell(tds[2]?.innerText);
              rg[gradeIdx - 1] = parseNumberCell(tds[3]?.innerText);
              std[gradeIdx - 1] = parseNumberCell(tds[4]?.innerText);
            });
            d3.math['math_probability'] = d3.math['math_probability'] || { raw: [], std: [] };
            d3.math['math_calculus'] = d3.math['math_calculus'] || { raw: [], std: [] };
            d3.math['math_geometry'] = d3.math['math_geometry'] || { raw: [], std: [] };
            // 실채점 발표 이후에는 EBSi가 확통/미적분/기하 각각의 원점수를 "-"로 표시하고
            // 표준점수만 제공한다. 0으로 채우면 오해를 부르므로 비워둔다.
            d3.math['math_probability'].raw = rp.map(v => isNaN(v) ? undefined : v);
            d3.math['math_calculus'].raw = rc.map(v => isNaN(v) ? undefined : v);
            d3.math['math_geometry'].raw = rg.map(v => isNaN(v) ? undefined : v);
            d3.mathCombined.std = std.map(v => isNaN(v) ? 0 : v);
          } else if (nameKor === '영어' || nameKor === '한국사') {
            const slug = subjectSlug(nameKor);
            const trs = col.querySelectorAll('tbody tr');
            const raw = [], std = [];
            let gradeIdx = 0;
            trs.forEach(tr => {
              const tds = tr.children;
              if (!tds || tds.length < 5) return;
              const gtxt = (tds[0]?.innerText || '').trim();
              if (!/^(최고점|[1-8])$/.test(gtxt)) return;
              if (gtxt === '최고점') return;
              gradeIdx++;
              raw[gradeIdx - 1] = parseNumberCell(tds[2]?.innerText);
              std[gradeIdx - 1] = parseNumberCell(tds[3]?.innerText);
            });
            d3.engHis.raw[slug] = raw.map(v => isNaN(v) ? 0 : v);
            d3.engHis.std[slug] = std.map(v => isNaN(v) ? 0 : v);
          }
        });
      }
      // 3학년: 사회 9과목
      else if (req.key === 'g3_social') {
        ensureGradeCutDetails();
        const d3 = gradeCuts.details['3'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (!nameKor) return;
          const slug = subjectSlug(nameKor);
          if (!d3.social[slug]) d3.social[slug] = { raw: [], std: [] };
          const trs = col.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          const raw = [], std = [];
          let gradeIdx = 0;
          trs.forEach(tr => {
            const tds = tr.children;
            if (!tds || tds.length < 5) return;
            const gtxt = (tds[0]?.innerText || '').trim();
            if (!/^(최고점|[1-8])$/.test(gtxt)) return;
            if (gtxt === '최고점') return;
            gradeIdx++;
            if (rawIdx !== -1) raw[gradeIdx - 1] = parseNumberCell(tds[rawIdx]?.innerText);
            if (stdIdx !== -1) std[gradeIdx - 1] = parseNumberCell(tds[stdIdx]?.innerText);
          });
          d3.social[slug].raw = (rawIdx === -1) ? [] : fillForwardMissing(raw);
          d3.social[slug].std = fillForwardMissing(std);
        });
      }
      // 3학년: 과학 8과목 (I/II 포함) + '-' 전파 반영
      else if (req.key === 'g3_science') {
        ensureGradeCutDetails();
        const d3 = gradeCuts.details['3'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (!nameKor) return;
          const slug = subjectSlug(nameKor);
          if (!d3.science[slug]) d3.science[slug] = { raw: [], std: [] };
          const trs = col.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          const raw = [], std = [];
          let gradeIdx = 0;
          trs.forEach(tr => {
            const tds = tr.children;
            if (!tds || tds.length < 5) return;
            const gtxt = (tds[0]?.innerText || '').trim();
            if (!/^(최고점|[1-8])$/.test(gtxt)) return;
            if (gtxt === '최고점') return;
            gradeIdx++;
            if (rawIdx !== -1) raw[gradeIdx - 1] = parseNumberCell(tds[rawIdx]?.innerText);
            if (stdIdx !== -1) std[gradeIdx - 1] = parseNumberCell(tds[stdIdx]?.innerText);
          });
          d3.science[slug].raw = (rawIdx === -1) ? [] : fillForwardMissing(raw);
          d3.science[slug].std = fillForwardMissing(std);
        });
      }

      // 2학년: 국/수/영/한 일괄 (g2_main)
      else if (req.key === 'g2_main') {
        ensureGradeCutDetails();
        const d2 = gradeCuts.details['2'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (!nameKor) return;
          const slug = subjectSlug(nameKor);
          if (!['korean', 'math', 'english', 'history'].includes(slug)) return;
          if (!d2.basic.raw[slug]) d2.basic.raw[slug] = [];
          if (!d2.basic.std[slug]) d2.basic.std[slug] = [];
          const trs = col.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          for (let i = 1; i <= 8; i++) {
            if (rawIdx !== -1) d2.basic.raw[slug][i - 1] = Number(trs?.[i]?.children?.[rawIdx]?.innerText || 0);
            if (stdIdx !== -1) d2.basic.std[slug][i - 1] = Number(trs?.[i]?.children?.[stdIdx]?.innerText || 0);
          }
          if (rawIdx === -1) d2.basic.raw[slug] = [];
        });
      }
      // 2학년: 사회 9과목 (g2_social)
      else if (req.key === 'g2_social') {
        ensureGradeCutDetails();
        const d2 = gradeCuts.details['2'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (!nameKor) return;
          const slug = subjectSlug(nameKor);
          if (!d2.social[slug]) d2.social[slug] = { raw: [], std: [] };
          const trs = col.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          for (let i = 1; i <= 8; i++) {
            if (rawIdx !== -1) d2.social[slug].raw[i - 1] = Number(trs?.[i]?.children?.[rawIdx]?.innerText || 0);
            if (stdIdx !== -1) d2.social[slug].std[i - 1] = Number(trs?.[i]?.children?.[stdIdx]?.innerText || 0);
          }
          if (rawIdx === -1) d2.social[slug].raw = [];
        });
      }
      // 2학년: 과학 4과목 (g2_science)
      else if (req.key === 'g2_science') {
        ensureGradeCutDetails();
        const d2 = gradeCuts.details['2'];
        const blocks = temp.querySelectorAll('.col_6');
        blocks.forEach(col => {
          const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
          if (!nameKor) return;
          const slug = subjectSlug(nameKor);
          if (!d2.science[slug]) d2.science[slug] = { raw: [], std: [] };
          const trs = col.querySelectorAll('tbody tr');
          const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
          for (let i = 1; i <= 8; i++) {
            if (rawIdx !== -1) d2.science[slug].raw[i - 1] = Number(trs?.[i]?.children?.[rawIdx]?.innerText || 0);
            if (stdIdx !== -1) d2.science[slug].std[i - 1] = Number(trs?.[i]?.children?.[stdIdx]?.innerText || 0);
          }
          if (rawIdx === -1) d2.science[slug].raw = [];
        });
      }
      // 2학년: 통합사회/통합과학 공통과목 (2026학년도~, g2_social_new/g2_science_new)
      // 이 응답에는 "최고점" 행이 포함되어 있어(구 subjectId 응답과 다름) 등급 텍스트로 행을 걸러야 한다.
      else if (req.key === 'g2_social_new' || req.key === 'g2_science_new') {
        ensureGradeCutDetails();
        const d2 = gradeCuts.details['2'];
        const targetSubj = (req.key === 'g2_social_new') ? 'social' : 'science';
        const col6 = temp.querySelector('.col_6');
        const trs = col6?.querySelectorAll('tbody tr');
        const { rawIdx, stdIdx } = findRawStdColIdx(trs?.[0]);
        const raw = [], std = [];
        let gradeIdx = 0;
        trs?.forEach(tr => {
          const tds = tr.children;
          if (!tds || tds.length < 2) return;
          const gtxt = (tds[0]?.innerText || '').trim();
          if (!/^(최고점|[1-8])$/.test(gtxt)) return;
          if (gtxt === '최고점') return;
          gradeIdx++;
          if (rawIdx !== -1) raw[gradeIdx - 1] = Number(tds[rawIdx]?.innerText || 0);
          if (stdIdx !== -1) std[gradeIdx - 1] = Number(tds[stdIdx]?.innerText || 0);
        });
        d2.basic.raw[targetSubj] = (rawIdx === -1) ? [] : raw;
        d2.basic.std[targetSubj] = std;
        g2NewTamguFound[targetSubj] = gradeIdx > 0;
      }

      if (req.key === 'g2_social_new' || req.key === 'g2_science_new') {
        setEbsiStepStatus(req.key, g2NewTamguFound[req.key === 'g2_social_new' ? 'social' : 'science'] ? 'done' : 'skip', g2NewTamguFound[req.key === 'g2_social_new' ? 'social' : 'science'] ? null : '자동 조회 결과 없음 — 직접 입력해주세요');
      } else {
        setEbsiStepStatus(req.key, 'done');
      }
    }

    // 불러온 등급컷 데이터를 전역 변수에 저장
    const cut = gradeCuts.target;
    if (grade === 'D100') {
      ['korean', 'math', 'english', 'history', 'social', 'science'].forEach(subj => {
        cut.raw[subj] = cuts[subj] || [];
        cut.std[subj] = stds[subj] || [];
      });
      cut.exploreBySubject = null;
      cut.year = year;
    } else if (grade === 'D200') {
      // 이미 루프 내에서 details['2']에 저장됨
      cut.year = year;
      gradeCuts.details['2'].year = year;
      // 분석 엔진이 참조하는 gradeCuts.target에도 반영 (신·구 교육과정 모두)
      syncDetailsToTarget('2', year);
    } else if (grade === 'D300') {
      gradeCuts.details['3'].year = year;
      syncDetailsToTarget('3', year);
    }

    // 원점수 등급컷이 EBSi에 없는 과목(실채점 이후 삭제된 경우 등)이 있을 때만
    // suneungcalc.com 자료로 채워보는 단계를 진행 모달에 추가해서 실행한다
    let sncResult = { filled: 0, reason: null };
    if (needsSuneungFill(grade)) {
      addEbsiProgressStep('suneung', '원점수 등급컷을 찾아보는 중');
      setEbsiStepStatus('suneung', 'loading');
      try {
        sncResult = await fillMissingRawFromSuneungCalc(grade, year, examText);
      } catch (e) {
        sncResult = { filled: 0, reason: '확인 중 오류: ' + e.message };
      }
      if (sncResult.filled > 0) {
        setEbsiStepStatus('suneung', 'done', `원점수 ${sncResult.filled}개 과목 채움`);
      } else {
        setEbsiStepStatus('suneung', 'skip', sncResult.reason || '해당 없음');
      }
    }

    // 업로드된 학생들의 원점수/백분위도 비어있으면 같은 시험 자료로 추정해서 채워둔다.
    // (성적 확인뿐 아니라 성적 분석의 통계·차트도 이 값을 그대로 참조하게 된다)
    if (parsedData && parsedData.length && typeof estimateStudentsRawScores === 'function') {
      try { await estimateStudentsRawScores(parsedData); } catch (e) { /* 추정 실패는 무시 */ }
    }

    // 등급컷 테이블 업데이트
    initCutTable();
    // 자동 적용 (silent 모드 — 별도 팝업 없이)
    applyCut(true);

    // 체크리스트 모달이 이미 단계별로 결과를 보여줬으므로, 완료 후엔 블로킹 팝업 대신
    // 가벼운 토스트로만 요약을 알린다 (모달 두 개가 연달아 뜨는 것을 방지)
    const sncMsg = sncResult.filled > 0 ? ` (원점수 등급컷 ${sncResult.filled}개 과목 반영)` : '';
    setTimeout(() => {
      hideEbsiProgress();
      showToast(`EBSi에서 등급컷을 불러와 자동 적용했습니다.${sncMsg}`);
    }, 500);
  } catch (e) {
    hideEbsiProgress();
    showEbsiError('EBSi 등급컷 불러오기', e);
  } finally {
    hideLoading();
  }
}

// ------------------- 등급 계산 및 통계 함수들 -------------------
/**
 * 등급컷 기준으로 학생들의 등급별 인원/비율을 계산하는 함수
 * @param {Array} parsed - 파싱된 학생 데이터 배열
 * @param {string} subject - 과목명 ('국어', '수학', '영어' 등)
 * @param {Array} rawCuts - 원점수 등급컷 배열
 * @param {Array} stdCuts - 표준점수 등급컷 배열
 * @returns {Object} 등급별 인원수, 비율, 총인원 정보
 */
// 등급컷 배열이 실제로 사용 가능한지(값이 채워져 있는지) 확인
function cutsAreUsable(cuts) {
  return Array.isArray(cuts) && cuts.length >= 2 && cuts.some(v => Number(v) > 0);
}

/**
 * 한 학생의 특정 과목 등급을 산출한다.
 * - 점수(scoreField)가 있으면 등급컷과 비교해 등급을 계산
 * - 점수가 없지만(예: 실채점 이후 원점수 없이 표준점수만 제공되는 "표준점수 기준" 성적표에서
 *   영어/한국사처럼 등급만 제공되는 경우) 기록된 등급(record.등급)이 있으면 그것을 그대로 사용
 * @returns {number|null} 1~9등급, 산출 불가(미응시 등)면 null
 */
function resolveStudentGrade(record, scoreField, cuts) {
  if (!record) return null;
  const rawVal = record[scoreField];
  const text = (rawVal === undefined || rawVal === null) ? '' : String(rawVal).trim();
  if (text === '') {
    // 점수가 없는 경우: 기록된 등급이 있으면 그대로 사용
    const g = Number(record.등급);
    if (!isNaN(g) && g >= 1 && g <= 9) return g;
    return null; // 응시 정보 없음
  }
  const score = Number(text);
  if (isNaN(score)) return null;
  // 선택과목제 탐구면 학생이 본 과목의 등급컷을 우선 사용
  const subjectCuts = exploreCutsForRecord(record, scoreField);
  if (subjectCuts) cuts = subjectCuts;
  if (!cutsAreUsable(cuts)) return null;
  for (let i = 0; i < 8; i++) {
    if (score >= (cuts[i] || 0)) return i + 1;
  }
  return 9;
}

// 대상/비교 파일별 분석 옵션 (확장자, CSV 옵션 토글)
function gradingOptionsFor(side) {
  if (side === 'compare') {
    return {
      ext: window.compareUploadedFileExt,
      useRecorded: window.csvCompareUseRecorded === true,
      stdKorMath: !!window.csvCompareUseStdKorMath,
      stdExplore: !!window.csvCompareUseStdExplore
    };
  }
  return {
    ext: window.uploadedFileExt,
    useRecorded: window.csvTargetUseRecorded === true,
    stdKorMath: !!window.csvTargetUseStdKorMath,
    stdExplore: !!window.csvTargetUseStdExplore
  };
}

// 과목별로 어떤 점수(원점수/표준점수)와 어떤 등급컷을 쓸지 정한다.
// - XLSX(성적표 포함): 영어/한국사는 원점수, 나머지는 표준점수
// - CSV: 영어/한국사는 원점수, 나머지는 옵션에 따라
// - 고른 등급컷이 비어 있으면(실채점 이후 원점수 컷 삭제 등) 다른 쪽 등급컷으로 대체
function pickGradingCuts(subject, rawCuts, stdCuts, side) {
  const o = gradingOptionsFor(side);
  let cuts, scoreField;
  const absolute = (subject === '영어' || subject === '한국사');
  if (absolute) { cuts = rawCuts; scoreField = '원점수'; }
  else if (o.ext === 'xlsx') { cuts = stdCuts; scoreField = '표준점수'; }
  else if ((subject === '국어' || subject === '수학') && o.ext === 'csv' && o.stdKorMath) { cuts = stdCuts; scoreField = '표준점수'; }
  else if ((subject === '사회탐구' || subject === '과학탐구') && o.ext === 'csv' && o.stdExplore) { cuts = stdCuts; scoreField = '표준점수'; }
  else { cuts = rawCuts; scoreField = '원점수'; }
  if (!cutsAreUsable(cuts)) {
    const altCuts = (scoreField === '원점수') ? stdCuts : rawCuts;
    const altField = (scoreField === '원점수') ? '표준점수' : '원점수';
    if (cutsAreUsable(altCuts)) { cuts = altCuts; scoreField = altField; }
  }
  return { cuts, scoreField };
}

// 대상/비교 쪽 등급컷. 비교 쪽 국어/수학은 비교 시험의 등급컷을 써야 한다
// (표준점수는 시험마다 척도가 달라, 대상 시험 등급컷으로 매기면 등급이 틀어진다).
// 영어/한국사는 절대평가라 컷이 같고, 탐구 비교 컷은 불러오지 않으므로 대상 컷을 쓴다.
function cutsForSide(subject, side) {
  const key = { '국어': 'korean', '수학': 'math', '영어': 'english', '한국사': 'history', '사회탐구': 'social', '과학탐구': 'science' }[subject];
  const t = gradeCuts.target;
  if (side === 'compare' && (key === 'korean' || key === 'math')) {
    const c = gradeCuts.compare;
    if (cutsAreUsable(c.std[key]) || cutsAreUsable(c.raw[key])) return [c.raw[key] || [], c.std[key] || []];
  }
  return [t.raw[key] || [], t.std[key] || []];
}

// 학생 한 명의 과목 등급 (화면·통계·내보내기가 모두 같은 규칙을 쓰도록 한 곳에 모음)
function studentGradeFor(s, subject, side) {
  const rec = s?.[subject];
  const o = gradingOptionsFor(side);
  if (o.ext === 'csv' && o.useRecorded) {
    const g = Number(rec?.등급);
    return (!isNaN(g) && g >= 1 && g <= 9) ? g : null;
  }
  const [rawCuts, stdCuts] = cutsForSide(subject, side);
  const { cuts, scoreField } = pickGradingCuts(subject, rawCuts, stdCuts, side);
  return resolveStudentGrade(rec, scoreField, cuts);
}

// 학생의 탐구 응시 과목 목록(탐구1·탐구2 순서). 성적표에 목록이 없으면 사회탐구/과학탐구 칸으로 만든다.
// 사회 2과목처럼 같은 분류를 두 번 본 학생도 빠짐없이 합산하기 위해 학생 명단·내보내기가 함께 쓴다.
function studentExploreEntries(s) {
  if (Array.isArray(s?.탐구목록) && s.탐구목록.length) return s.탐구목록;
  const out = [];
  [['사회탐구', 'social'], ['과학탐구', 'science']].forEach(([k, cat]) => {
    const r = s?.[k];
    if (r && (String(r.표준점수 || '').trim() || String(r.원점수 || '').trim())) out.push({ ...r, 분류: cat });
  });
  return out;
}

// 탐구 과목 하나의 등급: 다른 화면과 같은 규칙(점수→등급컷, 과목별 등급컷 우선), 못 매기면 기록/변환표 등급
function exploreEntryGrade(e, side) {
  const cat = e.분류 === 'science' ? '과학탐구' : '사회탐구';
  const o = gradingOptionsFor(side);
  if (!(o.ext === 'csv' && o.useRecorded)) {
    const [rawCuts, stdCuts] = cutsForSide(cat, side);
    const { cuts, scoreField } = pickGradingCuts(cat, rawCuts, stdCuts, side);
    const g = resolveStudentGrade(e, scoreField, cuts);
    if (g !== null) return g;
  }
  const r = Number(e.등급);
  return (String(e.등급 ?? '').trim() !== '' && r >= 1 && r <= 9) ? r : null;
}

function getGradeDistByCut(parsed, subject, rawCuts, stdCuts, side) {
  const o = gradingOptionsFor(side);
  // CSV에서 '기록 등급 사용' 옵션이면 기록된 등급으로 집계
  if (o.ext === 'csv' && o.useRecorded) return getGradeDistByRecordedGrade(parsed, subject);
  const { cuts, scoreField } = pickGradingCuts(subject, rawCuts, stdCuts, side);

  let dist = Array(9).fill(0); // 1~9등급 인원수 배열
  let total = 0; // 총 인원수
  // 각 학생의 점수를 등급컷과 비교하여 등급 산출 (점수가 없고 기록된 등급만 있는 경우 그 등급을 사용)
  parsed.forEach(s => {
    const grade = resolveStudentGrade(s?.[subject], scoreField, cuts);
    if (grade === null) return; // 응시 정보 없음
    dist[grade - 1]++;
    total++;
  });
  const ratio = dist.map(n => total ? (n / total * 100).toFixed(2) : '0');
  return { dist, ratio, total };
}

/**
 * 학생 데이터의 등급 필드를 기준으로 등급별 인원/비율을 계산하는 함수
 * @param {Array} parsed - 파싱된 학생 데이터 배열
 * @param {string} subject - 과목명
 * @returns {Object} 등급별 인원수, 비율, 총인원 정보
 */
function getGradeDistByRecordedGrade(parsed, subject) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { dist: Array(9).fill(0), ratio: Array(9).fill('0'), total: 0 };
  }

  let dist = Array(9).fill(0);
  let total = 0;

  // 학생 데이터의 등급 필드에서 직접 등급 정보 추출
  parsed.forEach(s => {
    const grade = Number(s[subject]?.등급 ?? NaN);
    if (!isNaN(grade) && grade >= 1 && grade <= 9) {
      dist[grade - 1]++;
      total++;
    }
  });

  const ratio = dist.map(n => total ? (n / total * 100).toFixed(2) : '0');
  return { dist, ratio, total };
}

/**
 * 등급컷 기준으로 1,2등급 학생 비율을 계산하는 함수
 * @param {Array} parsed - 파싱된 학생 데이터 배열
 * @param {string} subject - 과목명
 * @param {Array} rawCuts - 원점수 등급컷 배열
 * @param {Array} stdCuts - 표준점수 등급컷 배열
 * @returns {Object} 1,2등급 인원수, 비율, 총인원 정보
 */
function get12GradeByCut(parsed, subject, rawCuts, stdCuts, side) {
  const o = gradingOptionsFor(side);
  if (o.ext === 'csv' && o.useRecorded) return get12GradeByRecordedGrade(parsed, subject);
  const { dist, total } = getGradeDistByCut(parsed, subject, rawCuts, stdCuts, side);
  const cnt = dist[0] + dist[1]; // 1등급 + 2등급 인원수
  const ratio = total ? (cnt / total * 100).toFixed(2) : '0';
  return { cnt, ratio, total, sum: cnt + ' / ' + ratio };
}

/**
 * 학생 등급 필드 기준으로 1,2등급 비율을 계산하는 함수
 * @param {Array} parsed - 파싱된 학생 데이터 배열
 * @param {string} subject - 과목명
 * @returns {Object} 1,2등급 인원수, 비율, 총인원 정보
 */
function get12GradeByRecordedGrade(parsed, subject) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { cnt: 0, ratio: '0', total: 0, sum: '0 / 0' };
  }

  let cnt = 0; // 1,2등급 인원수
  let total = 0; // 총 인원수

  parsed.forEach(s => {
    const grade = Number(s[subject]?.등급 ?? NaN);
    if (!isNaN(grade) && grade >= 1 && grade <= 9) {
      if (grade <= 2) cnt++; // 1등급 또는 2등급인 경우
      total++;
    }
  });

  const ratio = total ? (cnt / total * 100).toFixed(2) : '0';
  return { cnt, ratio, total, sum: cnt + ' / ' + ratio };
}

// ------------------- 전체 성적 분석 통계 테이블 렌더링 -------------------
/**
 * 원점수/표준점수/백분위 기준 통계 테이블을 렌더링하는 함수
 * 전체평균, 상위 10%/20%/30% 평균을 과목별로 계산하여 표시
 */
function renderOverallStatsTables() {
  const container = document.getElementById('overallStatsTables');
  if (!container) return;

  const subjects = ['국어', '수학'];
  const exploreSubjects = ['사회탐구', '과학탐구'];
  const statsLabels = [
    { label: '전체 평균', key: 'avg' },
    { label: '상위 10% 평균', key: 'top10' },
    { label: '상위 20% 평균', key: 'top20' },
    { label: '상위 30% 평균', key: 'top30' }
  ];

  // 원점수가 아예 없는 파일(실채점 이후 표준점수만 제공되는 리포트 등)이면
  // "원점수 기준 통계" 탭 자체가 전부 빈 값("-")만 나오므로 표시하지 않는다.
  const hasRawScore = parsedData.some(s =>
    (s.국어?.원점수 && s.국어.원점수 !== '') || (s.수학?.원점수 && s.수학.원점수 !== ''));
  const scoreTypes = hasRawScore ? ['원점수', '표준점수', '백분위'] : ['표준점수', '백분위'];

  let html = '';

  scoreTypes.forEach((scoreType, idx) => {
    html += `<h3>${scoreType} 기준 통계 (국어, 수학)
      <button class="chart-toggle-btn" onclick="openScoreDistributionModal('${scoreType}')" title="분포 그래프">&#9632; 분포도</button>
      <button class="chart-toggle-btn" onclick="openScoreCdfModal('${scoreType}')" title="누적 분포도">&#9632; 누적분포(CDF)</button></h3>`;
    html += `<div class="table-container"><table class="stats-table"><thead><tr><th>구분</th>`;
    subjects.forEach(subj => html += `<th>${subj} 영역</th>`);
    html += `</tr></thead><tbody>`;

    statsLabels.forEach(stat => {
      html += `<tr><td>${stat.label}</td>`;
      subjects.forEach(subj => {
        const arr = parsedData.map(s => s[subj]?.[scoreType]).filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(Number).filter(n => !isNaN(n));
        arr.sort((a, b) => b - a);
        let value = '-';
        if (arr.length) {
          if (stat.key === 'avg') {
            value = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
          }
          else if (stat.key === 'top10') {
            const top10Count = Math.ceil(arr.length * 0.1);
            value = (arr.slice(0, top10Count).reduce((a, b) => a + b, 0) / top10Count).toFixed(2);
          }
          else if (stat.key === 'top20') {
            const top20Count = Math.ceil(arr.length * 0.2);
            value = (arr.slice(0, top20Count).reduce((a, b) => a + b, 0) / top20Count).toFixed(2);
          }
          else if (stat.key === 'top30') {
            const top30Count = Math.ceil(arr.length * 0.3);
            value = (arr.slice(0, top30Count).reduce((a, b) => a + b, 0) / top30Count).toFixed(2);
          }
        }
        html += `<td>${value}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
  });

  scoreTypes.forEach(scoreType => {
    html += `<h3>${scoreType} 기준 통계 (탐구 과목)
      <button class="chart-toggle-btn" onclick="openExploreDistributionModal('${scoreType}')" title="분포 그래프">&#9632; 그래프</button>
      <button class="chart-toggle-btn" onclick="openExploreCdfModal('${scoreType}')" title="누적 분포도">&#9632; 탐구 CDF</button></h3>`;
    html += `<div class="table-container"><table class="stats-table"><thead><tr><th>구분</th>`;
    exploreSubjects.forEach(subj => html += `<th>${subj} 영역</th>`);
    html += `</tr></thead><tbody>`;

    statsLabels.forEach(stat => {
      html += `<tr><td>${stat.label}</td>`;
      exploreSubjects.forEach(subj => {
        const arr = parsedData.map(s => s[subj]?.[scoreType]).filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(Number).filter(n => !isNaN(n));
        arr.sort((a, b) => b - a);
        let value = '-';
        if (arr.length) {
          if (stat.key === 'avg') {
            value = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
          }
          else if (stat.key === 'top10') {
            const top10Count = Math.ceil(arr.length * 0.1);
            value = (arr.slice(0, top10Count).reduce((a, b) => a + b, 0) / top10Count).toFixed(2);
          }
          else if (stat.key === 'top20') {
            const top20Count = Math.ceil(arr.length * 0.2);
            value = (arr.slice(0, top20Count).reduce((a, b) => a + b, 0) / top20Count).toFixed(2);
          }
          else if (stat.key === 'top30') {
            const top30Count = Math.ceil(arr.length * 0.3);
            value = (arr.slice(0, top30Count).reduce((a, b) => a + b, 0) / top30Count).toFixed(2);
          }
        }
        html += `<td>${value}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
  });

  container.innerHTML = html;
}


// ------------------- 전체 성적 분석 메인 함수 -------------------
/**
 * 전체 성적 분석 탭의 모든 테이블과 통계를 생성하는 메인 함수
 * 응시자 현황, 등급컷 정보, 통계, 등급별 인원 현황 등을 종합적으로 분석
 */
window.analyzeAll = async function () {
  showLoading();

  // "성적 확인"을 거치지 않고 바로 "성적 분석"으로 와도 원점수/백분위가 비어있으면
  // (같은 시험 정보가 있는 경우) 미리 채워둔다 — 불필요하게 다른 탭을 거칠 필요가 없도록.
  if (parsedData && parsedData.length && typeof estimateStudentsRawScores === 'function') {
    try { await estimateStudentsRawScores(parsedData); } catch (e) { /* 추정 실패는 무시 */ }
  }

  setTimeout(() => {
    const parsed = parsedData;
    const useStd = (window.uploadedFileExt === 'xlsx');

    /**
     * 영역별 응시자 현황을 계산하는 내부 함수
     * @param {Array} parsed - 파싱된 학생 데이터
     * @returns {Array} 과목별 응시자 수와 비율 정보
     */
    // 원점수 없이 표준점수/등급만 제공되는 성적표(실채점 이후 등)도 응시로 인식하기 위해
    // 원점수·표준점수·등급 중 하나라도 값이 있으면 응시한 것으로 판단
    function hasAnyScore(rec) {
      if (!rec) return false;
      return (rec.원점수 && rec.원점수 !== '') || (rec.표준점수 && rec.표준점수 !== '') || (rec.등급 && rec.등급 !== '');
    }
    function getExamStatus(parsed) {
      const total = parsed.filter(s => hasAnyScore(s.한국사)).length;
      const kor = parsed.filter(s => hasAnyScore(s.국어)).length;
      const math = parsed.filter(s => hasAnyScore(s.수학)).length;
      const eng = parsed.filter(s => hasAnyScore(s.영어)).length;

      return [
        { name: '한국사', count: total, ratio: '100.00' },
        { name: '국어', count: kor, ratio: total ? (kor / total * 100).toFixed(2) : '0.00' },
        { name: '수학', count: math, ratio: total ? (math / total * 100).toFixed(2) : '0.00' },
        { name: '영어', count: eng, ratio: total ? (eng / total * 100).toFixed(2) : '0.00' }
      ];
    }

    // 1. 영역별 응시자 현황 테이블
    let html = `<div class="analysis-header">
      <h3>1. 영역별 응시자 현황</h3>
      <div class="btn-container"></div>
    </div>
    <table id="examStatusTable"><thead>
      <tr>
        <th class="no-copy" rowspan="2">구분</th>
        <th>한국사영역</th>
        <th>국어영역</th>
        <th>수학영역</th>
        <th>영어영역</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="no-copy">응시인원<br>및 비율</td>
        ${getExamStatus(parsed).map(s => `<td>${s.count}<br>(${s.ratio})</td>`).join('')}
      </tr>
      <tr>
        <td class="no-copy">합계</td>
        ${getExamStatus(parsed).map(s => `<td>${s.count} (${s.ratio.split('.')[0]})</td>`).join('')}
      </tr>
    </tbody></table>`;

    // 2. 저장된 과목별 등급 구분 표준점수 테이블
    html += `<h3>2. (저장된) 과목별 등급 구분 표준점수</h3>`;
    html += `<table id="stdCutTable"><thead>
      <tr><th class="no-copy">구분</th><th>국어영역</th><th>수학영역</th></tr>
    </thead><tbody>
      <tr><td class="no-copy">1등급</td><td>${gradeCuts.target.std.korean[0]}</td><td>${gradeCuts.target.std.math[0]}</td></tr>
      <tr><td class="no-copy">2등급</td><td>${gradeCuts.target.std.korean[1]}</td><td>${gradeCuts.target.std.math[1]}</td></tr>
      <tr><td class="no-copy">3등급</td><td>${gradeCuts.target.std.korean[2]}</td><td>${gradeCuts.target.std.math[2]}</td></tr>
    </tbody></table>`;

    // 3~5. 통계 표들을 위한 컨테이너
    html += `<div id="overallStatsTables"></div>`;

    // 6. 국어, 수학, 영어 영역별 등급 인원 현황
    html += `<h3>6. 국어, 수학, 영어 영역별 등급 인원 현황
    <button class="chart-toggle-btn" onclick="openGradePieChartModal()" title="그래프 보기">&#9632; 그래프</button></h3>
    <table id="gradeDistTable"><thead>
      <tr>
        <th class="no-copy" rowspan="2">구분</th>
        <th colspan="2">국어영역</th>
        <th colspan="2">수학영역</th>
        <th colspan="2">영어영역</th>
      </tr>
      <tr>
        <th>인원</th><th>비율</th>
        <th>인원</th><th>비율</th>
        <th>인원</th><th>비율</th>
      </tr>
    </thead><tbody>`;

    // 1~9등급별 인원 및 비율 계산
    for (let g = 1; g <= 9; g++) {
      html += `<tr><td class="no-copy">${g}등급</td>`;
      html += `<td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).dist[g - 1]}</td><td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).ratio[g - 1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).dist[g - 1]}</td><td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).ratio[g - 1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).dist[g - 1]}</td><td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).ratio[g - 1]}</td>`;
      html += `</tr>`;
    }

    // 합계 행
    html += `<tr><td class="no-copy">합계</td>`;
    html += `<td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).total}</td><td>100</td>`;
    html += `</tr></tbody></table>`;

    // 7. 국어, 수학, 영어 영역별 1,2등급 비율
    html += `<h3>7. 국어, 수학, 영어 영역별 1,2등급 비율</h3>
    <table id="grade12Table"><thead>
      <tr><th class="no-copy">구분</th><th>국어영역</th><th>수학영역</th><th>영어영역</th></tr>
    </thead><tbody>
      <tr><td class="no-copy">1,2등급 인원 및 비율</td>`;
    html += `<td>${get12GradeByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).cnt} / ${get12GradeByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).ratio}</td>`;
    html += `<td>${get12GradeByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).cnt} / ${get12GradeByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).ratio}</td>`;
    html += `<td>${get12GradeByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).cnt} / ${get12GradeByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).ratio}</td>`;
    html += `</tr>
      <tr><td class="no-copy">합계</td>`;
    html += `<td>${get12GradeByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).sum}</td>`;
    html += `<td>${get12GradeByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).sum}</td>`;
    html += `<td>${get12GradeByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).sum}</td>`;
    html += `</tr></tbody></table>`;


    // 8. 탐구 과목 영역별 등급 인원 현황
    html += `<h3>8. 탐구 과목 영역별 등급 인원 현황
    <button class="chart-toggle-btn" onclick="openExploreGradePieChartModal()" title="그래프 보기">&#9632; 그래프</button></h3>
    <table id="exploreGradeDistTable"><thead>
      <tr>
        <th class="no-copy" rowspan="2">구분</th>
        <th colspan="2">사회탐구</th>
        <th colspan="2">과학탐구</th>
      </tr>
      <tr>
        <th>인원</th><th>비율</th>
        <th>인원</th><th>비율</th>
      </tr>
    </thead><tbody>`;

    for (let g = 1; g <= 9; g++) {
      html += `<tr><td class="no-copy">${g}등급</td>`;
      html += `<td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).dist[g - 1]}</td><td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).ratio[g - 1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).dist[g - 1]}</td><td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).ratio[g - 1]}</td>`;
      html += `</tr>`;
    }

    html += `<tr><td class="no-copy">합계</td>`;
    html += `<td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).total}</td><td>100</td>`;
    html += `</tr></tbody></table>`;

    html += `<h3>8-1. 탐구 과목 영역별 1,2등급 비율</h3>
<table id="exploreGrade12Table"><thead>
  <tr><th class="no-copy">구분</th><th>사회탐구영역</th><th>과학탐구영역</th></tr>
</thead><tbody>
  <tr><td class="no-copy">1,2등급 인원 및 비율</td>`;
    html += `<td>${get12GradeByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).cnt} / ${get12GradeByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).ratio}</td>`;
    html += `<td>${get12GradeByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).cnt} / ${get12GradeByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).ratio}</td>`;
    html += `</tr>
  <tr><td class="no-copy">합계</td>`;
    html += `<td>${get12GradeByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).sum}</td>`;
    html += `<td>${get12GradeByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).sum}</td>`;
    html += `</tr></tbody></table>`;

    // 9. 과목 조합 분석 카드
    html += `<h3>9. 과목 조합 분석</h3>`;
    html += `<div id="comboContainer">` + renderSubjectComboControlsHTML() + renderSubjectComboCardsHTML() + `</div>`;

    // HTML을 페이지에 적용
    document.getElementById('analyzeSection_all').innerHTML = html;

    // 3~5번 통계 표들을 별도 렌더링
    renderOverallStatsTables();

    hideLoading();
  }, 300);
};

// PDF 내보내기 기능은 요구에 따라 제거되었습니다.

// ------------------- 비교 성적 분석 시스템 -------------------
/**
 * 비교 성적 분석 탭을 초기화하는 함수
 * 파일 업로드 UI와 각종 테이블들을 초기 상태로 설정
 */
function refreshCompareTab() {
  // 예전엔 이 탭을 누를 때마다 비교 파일을 지웠다. 이제는 UI만 준비하고, 올려둔 비교 파일이 있으면 결과를 다시 그린다.
  if (!document.getElementById('ebsiCutLoader')) renderEbsiCutLoaderUI(); // EBSi 등급컷 불러오기 UI
  if (typeof updateCompareGradeFilters === 'function') updateCompareGradeFilters();
  const showBtn = document.getElementById('showCompareBtn');
  if (showBtn) showBtn.disabled = !compareParsedData.length;
  if (compareParsedData.length) {
    renderCompareResult();
  } else {
    renderCompareGradeTable();
    renderCompareStatsTables();
    renderGradeDistTable();
    renderGrade12RatioTable();
  }
}

/**
 * 비교용 XLSX 파일의 행 데이터를 분석용 객체 배열로 변환하는 함수
 * @param {Array} rows - XLSX에서 추출한 2차원 배열 데이터
 * @returns {Array} 파싱된 학생 데이터 객체 배열
 */
function parseCompareXlsxRows(rows) {
  const data = [];

  // 첫 행은 헤더이므로 i=1부터 시작
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    // 각 행을 학생 객체로 변환
    data.push({
      학년: row[0] || '',
      반: row[1] || '',
      번호: row[2] || '',
      이름: row[3] || '',
      국어: { 원점수: row[4] || '', 표준점수: row[5] || '', 백분위: row[6] || '', 등급: row[7] || '' },
      수학: { 원점수: row[8] || '', 표준점수: row[9] || '', 백분위: row[10] || '', 등급: row[11] || '' },
      영어: { 원점수: row[12] || '', 등급: row[13] || '' },
      한국사: { 원점수: row[14] || '', 등급: row[15] || '' },
      사회탐구: { 원점수: row[16] || '', 표준점수: row[17] || '', 백분위: row[18] || '', 등급: row[19] || '' },
      과학탐구: { 원점수: row[20] || '', 표준점수: row[21] || '', 백분위: row[22] || '', 등급: row[23] || '' }
    });
  }

  return data;
}

/**
 * 비교용 파일 업로드 처리 함수
 * @param {Event} e - 파일 입력 이벤트
 */
window.handleCompareFile = function (e) {
  const file = e.target.files[0];
  if (!file) return;

  compareFileName = file.name;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    try { window.compareUploadedFileExt = ext; } catch (e) { }
    readCsvFileText(file).then(async function (text) {
      try {
        const lines = parseCsvText(text);
        compareParsedData = parseCsvRows(lines);
        // 비교 등급컷을 이미 불러와둔 상태라면(보통 등급컷을 먼저 불러오고 파일을 올리는 흐름),
        // 그 시험 정보로 원점수/백분위를 업로드 즉시 역산해서 채운다.
        if (window.__lastEbsiCompareExam && typeof estimateStudentsRawScores === 'function') {
          try { await estimateStudentsRawScores(compareParsedData, window.__lastEbsiCompareExam); } catch (e) { /* 추정 실패는 무시 */ }
        }
        document.getElementById('showCompareBtn').disabled = false;
        updateCompareGradeFilters();
        showToast(`비교 파일이 업로드되었습니다: ${compareFileName}`);
      } catch (err) {
        console.error(err);
        compareParsedData = [];
        document.getElementById('showCompareBtn').disabled = true;
        showMessage('CSV 파싱 중 오류가 발생했습니다.');
      }
    }).catch(err => showMessage('CSV 파일을 읽는 중 오류가 발생했습니다. ' + (err?.message || err)));
    return;
  }

  if (ext !== 'xlsx' && ext !== 'xls') {
    showMessage('지원하지 않는 파일 형식입니다. (.csv, .xlsx, .xls)');
    compareParsedData = [];
    document.getElementById('showCompareBtn').disabled = true;
    return;
  }

  // xlsx/xls: 실제 바이너리 스프레드시트인지, EUC-KR HTML 기반 성적표(예: 교육청 [표준점수 기준] 리포트)인지
  // 파일 앞부분 바이트로 판별한다.
  try { window.compareUploadedFileExt = 'xlsx'; } catch (e) { }
  const headReader = new FileReader();
  headReader.onload = function (headEv) {
    const head = new Uint8Array(headEv.target.result);
    const isZip = head[0] === 0x50 && head[1] === 0x4B;
    const isBiff = head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0;
    if (isZip || isBiff) {
      const reader = new FileReader();
      reader.onload = async function (ev) {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          compareParsedData = parseCompareXlsxRows(rows);
          if (window.__lastEbsiCompareExam && typeof estimateStudentsRawScores === 'function') {
            try { await estimateStudentsRawScores(compareParsedData, window.__lastEbsiCompareExam); } catch (e) { /* 추정 실패는 무시 */ }
          }
          document.getElementById('showCompareBtn').disabled = false;
          updateCompareGradeFilters();
          showToast(`비교 파일이 업로드되었습니다: ${compareFileName}`);
        } catch (err) {
          console.error(err);
          compareParsedData = [];
          document.getElementById('showCompareBtn').disabled = true;
          showMessage('XLSX 파싱 중 오류가 발생했습니다. ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // EUC-KR HTML 기반 성적표(원점수 없이 표준점수/등급만 제공되는 경우 포함)
      const reader = new FileReader();
      reader.onload = async function (ev) {
        try {
          const text = ev.target.result;
          const rows = (typeof parseHtmlTableToRows === 'function') ? parseHtmlTableToRows(text) : [];
          const rowsData = (typeof parseStdReportRows === 'function') ? parseStdReportRows(rows) : [];
          if (!rowsData.length) throw new Error('표에서 학생 데이터를 찾지 못했습니다. 파일 형식을 확인해주세요.');
          compareParsedData = rowsData;
          if (window.__lastEbsiCompareExam && typeof estimateStudentsRawScores === 'function') {
            try { await estimateStudentsRawScores(compareParsedData, window.__lastEbsiCompareExam); } catch (e) { /* 추정 실패는 무시 */ }
          }
          document.getElementById('showCompareBtn').disabled = false;
          updateCompareGradeFilters();
          showToast(`비교 파일이 업로드되었습니다: ${compareFileName} (원점수 없이 표준점수 기준으로 비교)`);
        } catch (err) {
          console.error(err);
          compareParsedData = [];
          document.getElementById('showCompareBtn').disabled = true;
          showMessage('성적표 파일 파싱 중 오류가 발생했습니다. ' + err.message);
        }
      };
      reader.readAsText(file, 'euc-kr');
    }
  };
  headReader.onerror = function () {
    showMessage('파일을 읽는 중 오류가 발생했습니다.');
  };
  headReader.readAsArrayBuffer(file.slice(0, 8));
};

/**
 * 비교 분석 결과를 화면에 렌더링하는 함수
 */
async function renderCompareResult() {
  if (!compareParsedData.length) {
    document.getElementById('compareResult').innerHTML = '<p>비교 파일을 업로드하세요.</p>';
    return;
  }

  // 대상/비교 데이터 모두 원점수·백분위가 비어있으면 추정해서 채워둔다.
  // 대상은 window.__lastEbsiExam(등급컷 탭 시험), 비교는 window.__lastEbsiCompareExam(비교 탭 시험)을
  // 각각 사용한다 — 대상과 비교가 서로 다른 시험(예: 올해 vs 작년)일 수 있기 때문.
  if (typeof estimateStudentsRawScores === 'function') {
    try {
      await estimateStudentsRawScores(parsedData);
      await estimateStudentsRawScores(compareParsedData, window.__lastEbsiCompareExam);
    } catch (e) { /* 추정 실패는 무시 */ }
  }

  document.getElementById('compareResult').innerHTML = `<div class="mb-10"><b>비교 파일:</b> ${escapeHtml(compareFileName)}</div>`;

  // 각종 비교 테이블들 렌더링
  renderCompareGradeTable(); // 등급컷 비교 테이블
  renderCompareStatsTables(); // 통계 비교 테이블
  renderGradeDistTable(); // 등급별 인원 비교 테이블
  renderGrade12RatioTable(); // 1,2등급 비율 비교 테이블
}

// ------------------- EBSi 비교용 등급컷 불러오기 -------------------
// "비교" 쪽도 등급컷 탭과 똑같이 연도/학년/시험을 골라 EBSi에서 직접 불러온다.
// (예전엔 1학년 전용 별도 API를 썼는데, 그 API가 stdntGrd=1로 고정돼 있어 2·3학년을
//  아예 지원하지 못했다. 이제 등급컷 탭과 동일한 시험 목록·요청 방식을 재사용한다)

/**
 * 비교 분석용 EBSi 등급컷 불러오기 UI를 동적으로 생성하는 함수
 */
function renderEbsiCutLoaderUI() {
  const container = document.getElementById('analyzeSection_compare');
  if (!container) return;

  const prev = document.getElementById('ebsiCutLoader');
  if (prev) prev.remove();
  const prevStatus = document.getElementById('ebsiCutStatus');
  if (prevStatus) prevStatus.remove();

  const div = document.createElement('div');
  div.id = 'ebsiCutLoader';
  div.className = 'mb-18';
  div.innerHTML = `
    <label>연도:
      <select id="ebsiCompareYear" class="minw-90" onchange="updateCompareGradeOptions()"><option value="">연도선택</option></select>
    </label>
    <label>학년:
      <select id="ebsiCompareGrade" class="minw-70" disabled onchange="updateCompareExamOptions()">
        <option value="">학년선택</option>
        <option value="D100">1학년</option>
        <option value="D200">2학년</option>
        <option value="D300">3학년</option>
      </select>
    </label>
    <label>시험:
      <select id="ebsiCompareExam" class="minw-120" disabled><option value="">시험선택</option></select>
    </label>
    <button type="button" id="ebsiCutFetchBtn" class="copy-btn ml-8">등급컷 불러오기</button>
  `;
  container.prepend(div);

  const statusDiv = document.createElement('div');
  statusDiv.id = 'ebsiCutStatus';
  statusDiv.className = 'status-text';
  container.insertBefore(statusDiv, div.nextSibling);

  // 등급컷 탭에서 이미 시험 목록(window.ebsiExamData)을 불러온 적이 있으면 그걸 재사용하고,
  // 없으면(등급컷 탭을 아직 안 들렀으면) 새로 불러온다.
  if (window.ebsiExamData) {
    populateCompareYearOptions();
  } else if (typeof fetchEBSiCuts === 'function') {
    fetchEBSiCuts().then(populateCompareYearOptions);
  }
  document.getElementById('ebsiCutFetchBtn').onclick = fetchCompareEbsiCuts;
}

function populateCompareYearOptions() {
  const sel = document.getElementById('ebsiCompareYear');
  if (!sel || !window.ebsiExamData) return;
  sel.innerHTML = '<option value="">연도선택</option>' +
    Object.keys(window.ebsiExamData).map(y => `<option value="${y}">${y}년</option>`).join('');
}

function updateCompareGradeOptions() {
  const year = document.getElementById('ebsiCompareYear').value;
  const gradeSelect = document.getElementById('ebsiCompareGrade');
  const examSelect = document.getElementById('ebsiCompareExam');
  if (year && window.ebsiExamData?.[year]) {
    gradeSelect.disabled = false;
  } else {
    gradeSelect.disabled = true;
    gradeSelect.value = '';
  }
  examSelect.innerHTML = '<option value="">시험선택</option>';
  examSelect.disabled = true;
}

function updateCompareExamOptions() {
  const year = document.getElementById('ebsiCompareYear').value;
  const grade = document.getElementById('ebsiCompareGrade').value;
  const examSelect = document.getElementById('ebsiCompareExam');
  if (year && grade && window.ebsiExamData?.[year]?.[grade]) {
    const exams = window.ebsiExamData[year][grade];
    examSelect.innerHTML = '<option value="">시험선택</option>' +
      exams.map(exam => `<option value="${exam.value}">${exam.text}</option>`).join('');
    examSelect.disabled = false;
  } else {
    examSelect.innerHTML = '<option value="">시험선택</option>';
    examSelect.disabled = true;
  }
}

/**
 * 비교용 EBSi 등급컷(국어·수학 표준점수)을 불러와서 gradeCuts.compare에 저장하는 함수.
 * 등급컷 탭의 reqs 구성·파싱 로직과 같은 EBSi 엔드포인트를 그대로 사용하되,
 * 비교 표에 필요한 국어/수학 표준점수만 뽑아서 gradeCuts.compare(대상과 별도 저장소)에 담는다.
 */
async function fetchCompareEbsiCuts() {
  const year = document.getElementById('ebsiCompareYear').value;
  const grade = document.getElementById('ebsiCompareGrade').value;
  const examSelectEl = document.getElementById('ebsiCompareExam');
  const irecord = examSelectEl.value;
  const examText = examSelectEl.options[examSelectEl.selectedIndex]?.text || '';
  if (!year || !grade || !irecord) {
    showMessage('연도, 학년, 시험을 모두 선택하세요.');
    return;
  }

  // 비교 학생들의 원점수/백분위 추정(estimateStudentsRawScores)에 쓸 "비교 쪽" 시험 정보를 저장해둔다.
  // (대상 학생은 window.__lastEbsiExam을 쓰고, 비교 학생은 여기서 저장하는 이 정보를 쓴다 — 서로 다른 시험이므로 구분)
  const gmapForCompareExam = { D100: '1', D200: '2', D300: '3' };
  window.__lastEbsiCompareExam = { gradeVal: gmapForCompareExam[grade] || '', year, examText };

  let req;
  if (grade === 'D100') req = { subjectId: '17012,17014,17020,110001', ord: 1, key: 'main' };
  else if (grade === 'D200') req = { subjectId: '17022,50612,120013,140111', ord: 1, key: 'g2_main' };
  else if (grade === 'D300') req = { subjectId: '63004,80003,140117,140119', ord: 1, key: 'g3_main' };
  else { showMessage('지원하지 않는 학년입니다.'); return; }

  showLoading();
  const std = { korean: [], math: [] };

  try {
    const form = new URLSearchParams();
    form.append('subjectId', req.subjectId);
    form.append('irecord', irecord);
    form.append('ord', req.ord);
    const res = await fetch('https://www.ebsi.co.kr/ebs/xip/xipa/retrieveGrdCutList.ajax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const html = await res.text();
    // 응답 HTML을 화면 문서가 아닌 별도 문서로 읽는다 (응답 안의 이미지·이벤트 속성이 실행되지 않도록)
    const temp = new DOMParser().parseFromString(html, 'text/html').body;

    if (req.key === 'main' || req.key === 'g2_main') {
      // 1·2학년: 국어/수학이 각각 독립된 표준점수 등급컷 표로 나온다
      const col6s = temp.querySelectorAll('.col_6');
      ['korean', 'math'].forEach((subj, idx) => {
        const trs = col6s[idx]?.querySelectorAll('tbody tr');
        const { stdIdx } = findRawStdColIdx(trs?.[0]);
        for (let i = 1; i <= 8; i++) {
          std[subj][i - 1] = (stdIdx !== -1) ? Number(trs?.[i]?.children[stdIdx]?.innerText || 0) : 0;
        }
      });
    } else if (req.key === 'g3_main') {
      // 3학년: 국어(화작/언매 통합)·수학(확통/미적/기하 통합) 표준점수 표가 별도 구조
      const blocks = temp.querySelectorAll('.col_6');
      blocks.forEach(col => {
        const nameKor = normalizeSubjectName(col.querySelector('h3')?.textContent || '');
        if (nameKor === '국어') {
          const trs = col.querySelectorAll('table.kor_table tbody tr');
          const arr = [];
          let gradeIdx = 0;
          trs.forEach(tr => {
            const tds = tr.children;
            if (!tds || tds.length < 5) return;
            const gtxt = (tds[0]?.innerText || '').trim();
            if (!/^(최고점|[1-8])$/.test(gtxt) || gtxt === '최고점') return;
            gradeIdx++;
            arr[gradeIdx - 1] = parseNumberCell(tds[3]?.innerText);
          });
          std.korean = arr.map(v => isNaN(v) ? 0 : v);
        } else if (nameKor === '수학') {
          const trs = col.querySelectorAll('table.math_table tbody tr');
          const arr = [];
          let gradeIdx = 0;
          trs.forEach(tr => {
            const tds = tr.children;
            if (!tds || tds.length < 6) return;
            const gtxt = (tds[0]?.innerText || '').trim();
            if (!/^(최고점|[1-8])$/.test(gtxt) || gtxt === '최고점') return;
            gradeIdx++;
            arr[gradeIdx - 1] = parseNumberCell(tds[4]?.innerText);
          });
          std.math = arr.map(v => isNaN(v) ? 0 : v);
        }
      });
    }

    hideLoading();
    if (std.korean.length < 3 || std.math.length < 3) throw new Error('등급컷 파싱 실패');

    gradeCuts.compare.std.korean = std.korean;
    gradeCuts.compare.std.math = std.math;
    gradeCuts.compare.year = year;

    // 비교 학생들의 원점수/백분위도 이 시험 정보로 바로 추정해서 채워둔다
    if (compareParsedData?.length && typeof estimateStudentsRawScores === 'function') {
      try { await estimateStudentsRawScores(compareParsedData, window.__lastEbsiCompareExam); } catch (e) { /* 추정 실패는 무시 */ }
    }

    const gradeLabel = { D100: '1', D200: '2', D300: '3' }[grade];
    showToast(`EBSi에서 ${year}년(${gradeLabel}학년) 등급컷을 불러왔습니다.`);

    // 비교 테이블들 업데이트
    renderCompareGradeTable();
    renderCompareStatsTables();
    renderGradeDistTable();
    renderGrade12RatioTable();
  } catch (e) {
    hideLoading();
    showEbsiError('EBSi 비교용 등급컷 불러오기', e);
  }
}

// ------------------- 비교 분석 테이블 렌더링 함수들 -------------------
/**
 * 대상 연도 정보를 가져오는 함수
 * @returns {string} 대상 연도 또는 기본값
 */
function getTargetYear() {
  // gradeCuts에 연도 정보가 있다면 사용
  if (gradeCuts && gradeCuts.target && gradeCuts.target.year) return gradeCuts.target.year;

  // EBSi 자동 불러오기에서 연도 입력 필드 확인
  const yearInput = document.getElementById('ebsYear');
  if (yearInput && yearInput.value) return yearInput.value;

  // 기본값
  return '대상';
}

/**
 * 표준점수/백분위 비교 표를 렌더링하는 함수
 */
function renderCompareGradeTable() {
  const targetKor = gradeCuts.target.std.korean || [];
  const targetMath = gradeCuts.target.std.math || [];
  const compareKor = gradeCuts.compare.std.korean || [];
  const compareMath = gradeCuts.compare.std.math || [];

  let html = `<table class="grade-compare-table mt-18">
      <thead>
        <tr>
          <th rowspan="2">구분</th>
          <th colspan="2">국어 영역</th>
          <th colspan="2">수학 영역</th>
        </tr>
        <tr>
          <th>대상</th>
          <th>비교</th>
          <th>대상</th>
          <th>비교</th>
        </tr>
      </thead>
      <tbody>`;

  for (let i = 1; i <= 3; i++) {
    html += `<tr>
        <td>${i}등급</td>
        <td>${targetKor[i - 1] ?? '-'}</td>
        <td>${compareKor[i - 1] ?? '-'}</td>
        <td>${targetMath[i - 1] ?? '-'}</td>
        <td>${compareMath[i - 1] ?? '-'}</td>
      </tr>`;
  }

  html += `</tbody></table>`;

  let tableDiv = document.getElementById('compareGradeTable');
  if (!tableDiv) {
    tableDiv = document.createElement('div');
    tableDiv.id = 'compareGradeTable';
    const container = document.getElementById('analyzeSection_compare');
    container.appendChild(tableDiv);
  }
  tableDiv.innerHTML = html;
}

/**
 * 비교 성적 분석 통계 테이블을 렌더링하는 함수
 */
function renderCompareStatsTables() {
  const container = document.getElementById('analyzeSection_compare');
  if (!container) return;

  let statsContainer = document.getElementById('compareStatsContainer');
  if (!statsContainer) {
    statsContainer = document.createElement('div');
    statsContainer.id = 'compareStatsContainer';
    container.appendChild(statsContainer);
  }
  statsContainer.innerHTML = '';

  const scoreTypes = ['표준점수', '백분위'];
  const subjects = ['국어', '수학'];
  const statsLabels = [
    { label: '전체 평균', key: 'avg' },
    { label: '상위 10% 평균', key: 'top10' },
    { label: '상위 20% 평균', key: 'top20' },
    { label: '상위 30% 평균', key: 'top30' }
  ];

  const targetYear = getTargetYear();
  const compareYear = gradeCuts.compare.year || '비교';

  scoreTypes.forEach((scoreType, idx) => {
    let html = `<h3>${scoreType} 기준 통계</h3>`;
    html += `<table class="compare-stats-table">
        <thead>
          <tr><th rowspan="2">구분</th>`;
    subjects.forEach(subj => {
      html += `<th colspan="2">${subj} 영역</th>`;
    });
    html += `</tr>
          <tr>`;
    subjects.forEach(subj => {
      html += `<th>${targetYear}</th><th>${compareYear}</th>`;
    });
    html += `</tr>
        </thead>
        <tbody>`;

    statsLabels.forEach(stat => {
      html += `<tr><td>${stat.label}</td>`;
      subjects.forEach(subj => {
        const v1 = getSubjectStat(getCompareTargetData(), subj, scoreType, stat.key);
        const v2 = getSubjectStat(getCompareCompareData(), subj, scoreType, stat.key);
        html += `<td>${v1 ?? '-'}</td><td>${v2 ?? '-'}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    statsContainer.innerHTML += html;
  });
}

// 비교 탭의 등급 분포 / 1·2등급 비율 (대상·비교 각각 자기 시험의 등급컷과 자기 파일의 옵션으로 계산)
function compareTabDist(side, subj) {
  const data = side === 'compare' ? getCompareCompareData() : getCompareTargetData();
  const [rawCuts, stdCuts] = cutsForSide(subj, side);
  return getGradeDistByCut(data, subj, rawCuts, stdCuts, side);
}
function compareTab12(side, subj) {
  const data = side === 'compare' ? getCompareCompareData() : getCompareTargetData();
  const [rawCuts, stdCuts] = cutsForSide(subj, side);
  return get12GradeByCut(data, subj, rawCuts, stdCuts, side);
}

/**
 * 비교 분석 등급별 인원 현황 테이블을 렌더링하는 함수
 */
function renderGradeDistTable() {
  const container = document.getElementById('analyzeSection_compare');
  if (!container) return;

  let distContainer = document.getElementById('gradeDistContainer');
  if (!distContainer) {
    distContainer = document.createElement('div');
    distContainer.id = 'gradeDistContainer';
    container.appendChild(distContainer);
  }
  distContainer.innerHTML = '';

  const subjects = ['국어', '수학', '영어'];
  const subjectMap = { '국어': 'korean', '수학': 'math', '영어': 'english' };
  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  let html = `<div class="analysis-header"><h3>등급별 인원 현황 <button class="chart-toggle-btn" onclick="openComparisonChartModal()" title="그래프 보기">&#9632; 그래프</button></h3></div>`;
  html += `<table class="grade-dist-table">
      <thead>
        <tr><th rowspan="2">구분</th>`;
  subjects.forEach(subj => {
    html += `<th colspan="2">${subj} 영역</th>`;
  });
  html += `</tr>
        <tr>`;
  subjects.forEach(subj => {
    html += `<th>인원</th><th>비율</th>`;
  });
  html += `</tr>
      </thead>
      <tbody>`;

  grades.forEach(g => {
    html += `<tr><td>${g}등급</td>`;
    subjects.forEach(subj => {
      const subjKey = subjectMap[subj];
      const base = compareTabDist('target', subj);
      const comp = compareTabDist('compare', subj);
      html += `<td>${base.dist[g - 1] ?? '-'} / ${comp.dist[g - 1] ?? '-'}</td><td>${base.ratio[g - 1] ?? '-'} / ${comp.ratio[g - 1] ?? '-'}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  distContainer.innerHTML = html;
}

/**
 * 비교 분석 1,2등급 비율 테이블을 렌더링하는 함수
 */
function renderGrade12RatioTable() {
  const container = document.getElementById('analyzeSection_compare');
  if (!container) return;

  let ratioContainer = document.getElementById('grade12RatioContainer');
  if (!ratioContainer) {
    ratioContainer = document.createElement('div');
    ratioContainer.id = 'grade12RatioContainer';
    container.appendChild(ratioContainer);
  }
  ratioContainer.innerHTML = '';

  const subjects = ['국어', '수학', '영어'];
  const subjectMap = { '국어': 'korean', '수학': 'math', '영어': 'english' };

  let html = `<div class="analysis-header"><h3>1,2등급 비율 <button class="chart-toggle-btn" onclick="openGrade12ChartModal()" title="그래프 보기">&#9632; 그래프</button></h3><div class="btn-container"></div></div>`;
  html += `<table class="grade-12-ratio-table">
      <thead>
        <tr><th>구분</th>`;
  subjects.forEach(subj => {
    html += `<th>${subj} 영역</th>`;
  });
  html += `</tr>
      </thead>
      <tbody>`;

  html += `<tr><td>인원 및 비율 (대상)</td>`;
  subjects.forEach(subj => {
    const v = compareTab12('target', subj);
    html += `<td>${v.cnt} / ${v.ratio}</td>`;
  });
  html += `</tr>`;

  html += `<tr><td>인원 및 비율 (비교)</td>`;
  subjects.forEach(subj => {
    const v = compareTab12('compare', subj);
    html += `<td>${v.cnt} / ${v.ratio}</td>`;
  });
  html += `</tr>`;
  html += `</tbody></table>`;

  ratioContainer.innerHTML = html;
}

// ------------------- 통계 계산 유틸리티 함수 -------------------
/**
 * 과목별 통계를 계산하는 함수
 * @param {Array} data - 학생 데이터 배열
 * @param {string} subject - 과목명
 * @param {string} scoreType - 점수 타입 ('원점수', '표준점수', '백분위')
 * @param {string} statKey - 통계 타입 ('avg', 'top10', 'top20', 'top30')
 * @returns {string} 계산된 통계값
 */
function getSubjectStat(data, subject, scoreType, statKey) {
  // 빈 칸은 제외해야 한다 — Number('')는 0이라서, 값이 없는 학생이 0점으로 평균에 섞여 들어갔었다
  const scores = data
    .map(s => s[subject]?.[scoreType])
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(Number)
    .filter(v => !isNaN(v));
  if (!scores.length) return '-';

  scores.sort((a, b) => b - a); // 내림차순 정렬

  if (statKey === 'avg') {
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  }
  if (statKey === 'top10') {
    const count = Math.ceil(scores.length * 0.1);
    return (scores.slice(0, count).reduce((a, b) => a + b, 0) / count).toFixed(2);
  }
  if (statKey === 'top20') {
    const count = Math.ceil(scores.length * 0.2);
    return (scores.slice(0, count).reduce((a, b) => a + b, 0) / count).toFixed(2);
  }
  if (statKey === 'top30') {
    const count = Math.ceil(scores.length * 0.3);
    return (scores.slice(0, count).reduce((a, b) => a + b, 0) / count).toFixed(2);
  }

  return '-';
}

// ------------------- 학생 명단 관리 시스템 -------------------
// 학생 명단 관련 전역 변수들
let studentSortKey = 'sum'; // 정렬 기준
let studentSortDesc = true; // 정렬 방향 (내림차순)
let showAllStudents = false; // 전체 학생 표시 여부
let showStudentDetails = true; // 학년/반/번호 표시 여부

// 학생 명단 등급 필터 상태 (1~9 기본)
let studentGradeFilter = {
  kor: { min: 1, max: 9 },
  math: { min: 1, max: 9 },
  eng: { min: 1, max: 9 }
};

// 등급 필터 값 설정 및 재렌더
function setStudentFilter(subjectKey) {
  const minSel = document.getElementById(`filter_${subjectKey}_min`);
  const maxSel = document.getElementById(`filter_${subjectKey}_max`);
  if (!minSel || !maxSel) return;
  let min = Number(minSel.value || '1');
  let max = Number(maxSel.value || '9');
  if (min > max) { const t = min; min = max; max = t; }
  studentGradeFilter[subjectKey] = { min, max };
  renderStudentList();
}

function resetStudentFilters() {
  studentGradeFilter = { kor: { min: 1, max: 9 }, math: { min: 1, max: 9 }, eng: { min: 1, max: 9 } };
  renderStudentList();
}

/**
 * 학생 명단을 렌더링하는 함수
 * 정렬, 필터링, 페이징 기능을 포함
 */
function renderStudentList() {
  // 학생 데이터 가공 및 정렬
  let students = parsedData.map(s => {
    const kor = Number(s.국어?.표준점수 || 0);
    const math = Number(s.수학?.표준점수 || 0);
    const eng = Number(s.영어?.원점수 || 0);
    // 탐구는 응시한 두 과목을 모두 더한다 (예전엔 사회 2과목 응시자는 한 과목만 합산돼
    // 결과 보고서의 성적 상위자 순위와 달라졌다)
    const exps = studentExploreEntries(s);
    const explore = exps.reduce((a, e) => a + (Number(toScore(e.표준점수)) || 0), 0);
    // 등급은 전체 분석·성적 확인과 같은 규칙(studentGradeFor)으로 매긴다.
    // 점수가 없으면 파일에 기록된 등급을 쓴다 (영어/한국사 등급만 있는 성적표 대응)
    const gradeOf = (subj) => studentGradeFor(s, subj, 'target') ?? '-';
    const exploreGrade = exps.map(e => exploreEntryGrade(e, 'target') ?? '-').join('·') || '-';

    return {
      ...s,
      kor, math, eng, explore,
      sum: kor + math + explore, // 표준점수 합계
      korGrade: gradeOf('국어'),
      mathGrade: gradeOf('수학'),
      engGrade: gradeOf('영어'),
      exploreGrade
    };
  });

  // 정렬 적용
  students.sort((a, b) => {
    if (studentSortDesc) return (b[studentSortKey] || 0) - (a[studentSortKey] || 0);
    else return (a[studentSortKey] || 0) - (b[studentSortKey] || 0);
  });

  // 등급 범위 필터 적용 (영어는 원점수 컷 기준으로 산출된 등급 사용)
  const inRange = (g, min, max) => {
    // 등급을 알 수 없는 학생(미응시 등)은 필터를 전체(1~9)로 둔 경우엔 그대로 보여준다
    if (g === '-' || isNaN(Number(g))) return min === 1 && max === 9;
    const n = Number(g);
    return n >= min && n <= max;
  };
  students = students.filter(s => {
    const okKor = inRange(s.korGrade, studentGradeFilter.kor.min, studentGradeFilter.kor.max);
    const okMath = inRange(s.mathGrade, studentGradeFilter.math.min, studentGradeFilter.math.max);
    const okEng = inRange(s.engGrade, studentGradeFilter.eng.min, studentGradeFilter.eng.max);
    return okKor && okMath && okEng;
  });

  // HTML 생성 시작
  let html = `
      <div style="margin-bottom: 10px;">
        <label>
          <input type="checkbox" id="showDetailsCheckbox" ${showStudentDetails ? 'checked' : ''} onchange="toggleStudentDetails()">
          학년/반/번호 표시
        </label>
      </div>
      <div class="filter-controls">
        <div class="filter-group">
          <label>국어 등급
            <select id="filter_kor_min" onchange="setStudentFilter('kor')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.kor.min === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
            ~
            <select id="filter_kor_max" onchange="setStudentFilter('kor')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.kor.max === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
          </label>
          <label>수학 등급
            <select id="filter_math_min" onchange="setStudentFilter('math')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.math.min === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
            ~
            <select id="filter_math_max" onchange="setStudentFilter('math')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.math.max === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
          </label>
          <label>영어 등급
            <select id="filter_eng_min" onchange="setStudentFilter('eng')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.eng.min === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
            ~
            <select id="filter_eng_max" onchange="setStudentFilter('eng')">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}" ${studentGradeFilter.eng.max === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
          </label>
          <button class="action-btn-secondary" onclick="resetStudentFilters()">필터 초기화</button>
        </div>
      </div>
      <table id="studentListTable"><thead><tr>`;

  // 헤더 생성 (조건부 표시)
  if (showStudentDetails) {
    html += `<th class="no-copy">학년</th><th class="no-copy">반</th><th class="no-copy">번호</th>`;
  }
  html += `<th class="no-copy">이름</th>
      <th class="sortable" onclick="sortStudentList('kor')">국어<span class="sort-indicator">${studentSortKey === 'kor' ? (studentSortDesc ? ' ▲' : ' ▼') : ''}</span></th>
      <th class="sortable" onclick="sortStudentList('math')">수학<span class="sort-indicator">${studentSortKey === 'math' ? (studentSortDesc ? ' ▲' : ' ▼') : ''}</span></th>
      <th class="sortable" onclick="sortStudentList('eng')">영어<span class="sort-indicator">${studentSortKey === 'eng' ? (studentSortDesc ? ' ▲' : ' ▼') : ''}</span></th>
      <th class="sortable" onclick="sortStudentList('explore')">탐구<span class="sort-indicator">${studentSortKey === 'explore' ? (studentSortDesc ? ' ▲' : ' ▼') : ''}</span></th>
      <th class="sortable" onclick="sortStudentList('sum')">표점합<span class="sort-indicator">${studentSortKey === 'sum' ? (studentSortDesc ? ' ▲' : ' ▼') : ''}</span></th>
    </tr></thead><tbody>`;

  // 표시할 학생 수 결정
  const showCount = showAllStudents ? students.length : 20;

  // 학생 데이터 행 생성
  for (let i = 0; i < Math.min(students.length, showCount); i++) {
    const s = students[i];
    html += `<tr>`;

    if (showStudentDetails) {
      html += `<td class="no-copy">${s.학년}</td><td class="no-copy">${s.반}</td><td class="no-copy">${s.번호}</td>`;
    }

    html += `<td class="no-copy">${escapeHtml(s.이름)}</td>
        <td>${s.kor}(${s.korGrade})</td>
        <td>${s.math}(${s.mathGrade})</td>
        <td>(${s.engGrade})</td>
        <td>${s.explore}(${s.exploreGrade})</td>
        <td>${s.sum}</td>
      </tr>`;
  }

  html += `</tbody></table>`;

  // 전체 보기/축소 버튼 추가
  if (!showAllStudents && students.length > 20) {
    html += `<button onclick="showAllStudents=true;renderStudentList();" class="copy-btn mt-12">전체(${students.length}명) 보기</button>`;
  } else if (showAllStudents && students.length > 20) {
    html += `<button onclick="showAllStudents=false;renderStudentList();" class="copy-btn mt-12">처음 20명만 보기</button>`;
  }

  document.getElementById('analyzeSection_list').innerHTML = html;
}

/**
 * 학생 명단 정렬 함수
 * @param {string} key - 정렬 기준 키
 */
function sortStudentList(key) {
  if (studentSortKey === key) {
    studentSortDesc = !studentSortDesc; // 같은 키면 방향 반전
  } else {
    studentSortKey = key; // 다른 키면 내림차순으로 설정
    studentSortDesc = true;
  }
  renderStudentList();
}

/**
 * 학년/반/번호 표시 토글 함수
 */
function toggleStudentDetails() {
  showStudentDetails = document.getElementById('showDetailsCheckbox').checked;
  renderStudentList();
}

/**
 * 점수를 등급으로 변환하는 함수
 * @param {number} score - 학생 점수
 * @param {Array} cuts - 등급컷 배열
 * @returns {number|string} 등급 (1~9) 또는 '-'
 */
function getGrade(score, cuts) {
  if (!score || isNaN(score)) return '-';
  score = Number(score);

  for (let i = 0; i < 8; i++) {
    if (score >= (cuts[i] || 0)) return i + 1;
  }
  return 9;
}

// ------------------- 탭 UI 초기화 시스템 -------------------
/**
 * 성적 분석 탭 UI를 초기화하는 함수
 * 페이지 로드 시 자동으로 실행되어 탭 구조를 생성
 */
window.initAnalyzeTabs = function () {
  // 탭 버튼 HTML 생성
  let tabHtml = `
      <div class="mb-18 analyze-tab-row">
        <div>
          <button id="analyzeTabBtn_all" class="analyze-tab-btn active" onclick="switchAnalyzeTab('all')">전체 성적 분석</button>
          <button id="analyzeTabBtn_compare" class="analyze-tab-btn" onclick="switchAnalyzeTab('compare')">비교 성적 분석</button>
          <button id="analyzeTabBtn_advanced" class="analyze-tab-btn" onclick="switchAnalyzeTab('advanced')">심화 성적 분석</button>
          <button id="analyzeTabBtn_list" class="analyze-tab-btn" onclick="switchAnalyzeTab('list')">학생 명단</button>
        </div>
        <div class="export-bar">
          <span class="export-bar-label">파일 내보내기</span>
          <button class="action-btn-secondary btn-sm" onclick="openExportDialog('hwpx')">결과 보고서 (HWPX)</button>
          <button class="action-btn-secondary btn-sm" onclick="openExportDialog('daegyo')">대교협 분석자료 (XLSX)</button>
        </div>
      </div>
    `;

  // 섹션 컨테이너 HTML 생성
  let sectionHtml = `
      <div id="analyzeSection_all" class="analyze-section"></div>
      <div id="analyzeSection_compare" class="analyze-section hidden"></div>
      <div id="analyzeSection_advanced" class="analyze-section hidden"></div>
      <div id="analyzeSection_list" class="analyze-section hidden"></div>
    `;

  // HTML을 페이지에 적용
  document.getElementById('analyzeContent').innerHTML = tabHtml + sectionHtml;

  // 비교 성적 분석 탭 UI 동적 생성
  document.getElementById('analyzeSection_compare').innerHTML = `
      <input type="file" id="compareUploadInput" accept=".csv,.xlsx,.xls" onchange="handleCompareFile(event)" />
      <button id="showCompareBtn" class="copy-btn" onclick="renderCompareResult()" disabled>비교 결과 보기</button>
      <div class="mt-10">
        <label>대상 학년:
          <select id="compareTargetGradeSel" class="minw-70" onchange="onCompareGradeFilterChange()"><option value="">전체</option></select>
        </label>
        <label class="ml-8">비교 학년:
          <select id="compareCompareGradeSel" class="minw-70" onchange="onCompareGradeFilterChange()"><option value="">전체</option></select>
        </label>
      </div>
      <div id="compareResult" class="mt-18"></div>
    `;
  updateCompareGradeFilters();

  // 심화 성적 분석 탭 UI 동적 생성
  document.getElementById('analyzeSection_advanced').innerHTML = `
      <div class="mb-16 pb-12" style="border-bottom: 1px dashed var(--border-color); color: var(--subtle-text-color); font-size: 0.9rem;">
        <span style="color: var(--primary-color);">ⓘ 참고:</span> 교육부와 Google Gemini AI의 학생 성적 분석 자료를 참고하여 제작되었습니다.
      </div>
      <div class="mb-18">
        <button id="showAdvancedBtn" class="copy-btn" onclick="renderAdvancedCharts()">데이터 새로고침</button>
      </div>
      
      <div id="advancedResult" class="chart-modal-grid cols-2" style="display:none; gap: 1.5rem;">
        
        <!-- 1. 과목 간 상관관계 산점도 -->
        <div class="table-container" style="background:#fff; padding:1.2rem; border-radius:8px; border:1px solid var(--border-color); grid-column:1/-1;">
          <h4 style="margin-top:0; margin-bottom:1rem; color:var(--primary-dark);">과목 간 상관관계 산점도 (국어 vs 수학)</h4>
          <div style="font-size:0.85rem; color:#4b5563; margin-bottom:1rem; line-height:1.6; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <p style="margin-top:0;">이 그래프는 <strong>학생 한 명 한 명을 점으로 나타내어 국어와 수학 성적 밸런스</strong>를 보여줍니다. 차트 상단의 <strong>학급별 지표(범례)를 클릭하시면 원하는 반 학생들만 즉시 켜고 끌 수(On/Off) 있어 선택적인 비교 분석이 가능</strong>합니다. 오른쪽 위로 뻗어갈수록 두 과목 모두 최상위권인 학생이며, 원점 방향인 왼쪽 아래로 향할수록 두 과목 모두 각별한 기초 학력 지원이 필요한 학생입니다.</p>
            <p style="margin-bottom:0;">그래프의 오른쪽 아래 구역에 면밀하게 퍼진 점들은 수학보다 국어 영역에서 뚜렷한 강점을 지닌 학생들입니다. 반대로 왼쪽 위 구역에 치우친 점들은 국어보다 수학 영역에서 훨씬 더 두각을 나타내는 집단입니다. 극단적인 과목별 편식을 보이는 학생들을 발굴하여 전체적인 학습 시간 밸런스 점검을 돕는 개별 밀착 상담용 뷰어(Viewer)로 유용하게 동작합니다.</p>
          </div>
          <div style="width:100%; max-width:800px; margin:0 auto; aspect-ratio:1.5;">
            <canvas id="advChartScatter"></canvas>
          </div>
        </div>

        <!-- 2. 학급별 성취도 편차 양방향 차트 -->
        <div class="table-container" style="background:#fff; padding:1.2rem; border-radius:8px; border:1px solid var(--border-color); grid-column:1/-1;">
          <h4 style="margin-top:0; color:var(--primary-dark);">학급별 평균 성취도 편차 (학년 전체 대비)</h4>
          <div style="font-size:0.85rem; color:#4b5563; margin-bottom:1rem; line-height:1.6; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #10b981;">
            <p style="margin-top:0;">전체 학년 평균 위치를 기준선인 0점(가운데 검은색 세로축)으로 고정했을 때, <strong>우리 반의 국어/수학 평균이 전체 학년 흐름 궤도 대비 어느 방향에 놓여 있는지(±)</strong>를 좌우 막대로 직관적으로 보여주는 그룹형 가로 막대 차트입니다.</p>
            <p style="margin-bottom:0;">붉은색 막대는 각 반의 '국어 평균 편차'를 뜻하며, 푸른색 막대는 '수학 평균 편차'를 의미합니다. 수치가 (+) 우측으로 넓게 뻗어 있다면 해당 학급은 과목 평균이 전체 학년 평균을 이끌어가는 긍정적 시너지를 내고 있음을 뜻합니다. 반면에 (-) 좌측으로 뻗어 학년 평균에 다소 안착하지 못한 과목이 발견된다면, 교과 선생님과의 협의를 통해 우리 반의 수업 참여도나 학습 장애 요인을 다각도로 진단하고 맞춤형 피드백을 모색하는 학급 경영 전략 지표로 유용하게 동작합니다.</p>
          </div>
          <div style="width:100%; max-width:900px; margin:0 auto;">
            <canvas id="advChartDiverging" style="max-height: 450px;"></canvas>
          </div>
        </div>

        <!-- 3. 학급별 성적 밀집도 히트맵 -->
        <div class="table-container" style="background:#fff; padding:1.2rem; border-radius:8px; border:1px solid var(--border-color); grid-column:1/-1;">
          <h4 style="margin-top:0; color:var(--primary-dark);">학급별/등급별 성적 밀집도 히트맵 (국어/수학)</h4>
          <div style="font-size:0.85rem; color:#4b5563; margin-bottom:1rem; line-height:1.6; padding: 12px; background: #fdf2f8; border-radius: 6px; border-left: 4px solid #ec4899;">
            <p style="margin-top:0;">1등급부터 9등급까지 전체 스펙트럼 상에서, 우리 반 학생들이 <strong>어느 등급대 구간에 눈에 띄게 많이 뭉쳐있는지를 '색상의 농도'로 진단</strong>하는 열화상(Heatmap) 형태의 도표입니다. 셀 안의 숫자는 해당 등급을 성취한 학생의 실제 인원수이며, 인원이 다수 응집하여 비율이 클수록 붉고 진한 색상으로 칠해집니다.</p>
            <p style="margin-bottom:0;">서로 엇비슷한 평균 점수를 기록한 두 학급이라 할지라도, 이 히트맵을 살펴보면 평균의 함정에 가려진 실제 학급 생태계를 깊숙이 들여다볼 수 있습니다. 1~2등급 칸과 8~9등급 칸 양끝이 동시에 붉게 물들어 있다면 양끝으로 넓게 나뉜 성취 다양성 학급의 모습일 것이고, 4~6등급 칸 전체가 시뻘겋게 칠해져 있다면 다수의 묵직한 중위권 학생들이 튼튼한 허리띠를 형성하고 있는 학급임을 말해줍니다. 이러한 분포 특질을 읽어내어 효율적인 멘토-멘티 그룹 결성 등에 곧바로 적용해 보세요.</p>
          </div>
          <div id="advHeatmapContainer" style="overflow-x:auto;"></div>
        </div>

        <!-- 4. 학급별 상자 수염 (상위/중위/하위 밀집도) -->
        <div class="table-container" style="background:#fff; padding:1.2rem; border-radius:8px; border:1px solid var(--border-color); grid-column:1/-1;">
          <h4 style="margin-top:0; color:var(--primary-dark);">학급별 학력 편차 (상자 수염 / Box Plot)</h4>
          <div style="font-size:0.85rem; color:#4b5563; margin-bottom:1rem; line-height:1.6; padding: 12px; background: #fefce8; border-radius: 6px; border-left: 4px solid #eab308;">
            <p style="margin-top:0;">상자 수염(Box Plot) 그림은 수십 명 학생들의 성적이 학급 내에서 어떻게 퍼져 있고 또 어떻게 핵심적으로 뭉쳐 있는지를 하나의 그림(막대와 선) 층위별로 압축해 낸 가장 다각적이고 입체적인 통계 시각화 기법입니다. (세로축 기준: 국어, 수학 표준점수 합산치)</p>
            <ul style="margin: 0.5rem 0 0 1.2rem; padding: 0;">
                <li style="margin-bottom:0.3rem;"><strong>연한 바탕 회색선 (최대~최소 범위):</strong> 해당 반에서 가장 높은 1등 학생의 점수(상단 끝)부터 기초선에 있는 학생의 점수(하단 끝)까지, 반 구성원 전체 성적이 뻗어 있는 폭넓은 최외곽 학력 스펙트럼을 의미합니다. 위아래로 길면 길수록 반 내에 다양한 층위와 배경의 학생들이 존재함을 나타냅니다.</li>
                <li style="margin-bottom:0.3rem;"><strong>보라색 진한 박스 (핵심 중위권 50% 구간):</strong> 이른바 상위 25% 지점(Q3) 컷오프에서부터 하위 25% 지점(Q1) 컷오프까지. 반 구성원의 <strong>'메인 허리 50% 층'</strong> 학생들이 옹기종기 모여 있는 골목입니다. 보라색 박스의 상하 꼬리가 짧고 뭉툭하다면 절반 이상의 학생들이 비슷한 영역대에서 오밀조밀 학업에 임하고 있다는 의미이며 반대로 길게 늘어났다면 메인 허리층 학생들의 폭이 매우 여유롭다는 뜻입니다.</li>
                <li><strong>가운데 두꺼운 빨간 선 (중앙값, Median):</strong> 반 전체 학생을 성적순으로 1렬 줄 세웠을 때, 정확히 정중앙 공간에 속하는 학생의 점수입니다.</li>
            </ul>
          </div>
          <div style="width:100%; max-width:900px; margin:0 auto;">
            <canvas id="advChartBoxplot" style="max-height: 400px;"></canvas>
          </div>
        </div>
      </div>
    `;

  // 기본적으로 전체 성적 분석 탭 활성화
  switchAnalyzeTab('all');
};

/**
 * 심화 분석 탭의 4가지 차트를 모두 그립니다.
 */
window.renderAdvancedCharts = function () {
  if (!parsedData || parsedData.length === 0) {
    if (typeof showMessage === 'function') showMessage('파싱된 정상적인 데이터가 없습니다. 1단계 성적 파일을 먼저 업로드해주세요.');
    return;
  }

  document.getElementById('advancedResult').style.display = 'grid';

  // 1. 과목 간 상관관계 산점도 (학급별 다중 데이터셋 전면 렌더링)
  window.analysisChart.createAdvScatterChart('advChartScatter', parsedData);

  // 2. 학급별 성취도 편차 양방향 차트 (국어/수학 그룹형)
  window.analysisChart.createAdvDivergingBarChart('advChartDiverging', parsedData);

  // 3. 학급별/등급별 성적 밀집도 히트맵 (HTML Table 기반)
  const heatmapContainer = document.getElementById('advHeatmapContainer');
  heatmapContainer.innerHTML = ''; // 초기화
  window.analysisChart.renderAdvHeatmap(heatmapContainer, parsedData);

  // 4. 학급별 학력 편차 (상자 수염 / Box Plot 가시화)
  window.analysisChart.createAdvBoxplotChart('advChartBoxplot', parsedData);
};

// ------------------- 그래프 관련 함수 -------------------
/**
* 점수 분포 그래프를 표시하는 함수
* @param {string} scoreType - 점수 타입 ('원점수', '표준점수', '백분위')
*/
function showScoreDistributionChart(scoreType) {
  document.getElementById(`chart_${scoreType}`).style.display = 'block';
  window.analysisChart.createScoreDistribution(`canvas_${scoreType}_korean`, parsedData, '국어', scoreType);
  window.analysisChart.createScoreDistribution(`canvas_${scoreType}_math`, parsedData, '수학', scoreType);
}

/**
 * 등급별 원형 그래프를 표시하는 함수 (국어, 수학, 영어)
 */
function showGradePieCharts() {
  document.getElementById('gradeCharts').style.display = 'block';
  const koreanData = getGradeDistByCut(parsedData, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean);
  const mathData = getGradeDistByCut(parsedData, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math);
  const englishData = getGradeDistByCut(parsedData, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english);

  window.analysisChart.createGradePieChart('koreanGradeChart', koreanData, '국어');
  window.analysisChart.createGradePieChart('mathGradeChart', mathData, '수학');
  window.analysisChart.createGradePieChart('englishGradeChart', englishData, '영어');
}

/**
 * 탐구 과목 원형 그래프를 표시하는 함수 (사회탐구, 과학탐구)
 */
function showExploreGradePieCharts() {
  document.getElementById('exploreCharts').style.display = 'block';
  const socialData = getGradeDistByCut(parsedData, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social);
  const scienceData = getGradeDistByCut(parsedData, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science);

  window.analysisChart.createGradePieChart('socialGradeChart', socialData, '사회탐구');
  window.analysisChart.createGradePieChart('scienceGradeChart', scienceData, '과학탐구');
}

/**
 * 비교 막대 그래프를 표시하는 함수
 */
function openComparisonChartModal() {
  openChartModal('비교 분석 그래프', function (body) {
    const subjects = ['국어', '수학', '영어'];
    const subjectMap = { '국어': 'korean', '수학': 'math', '영어': 'english' };

    // 등급별 인원 비교
    const h1 = document.createElement('h4');
    h1.textContent = '등급별 인원 비교';
    h1.style.width = '100%';
    h1.style.textAlign = 'center';
    h1.style.marginBottom = '1rem';
    body.appendChild(h1);

    const grid1 = document.createElement('div');
    grid1.className = 'chart-modal-grid cols-3';
    body.appendChild(grid1);

    subjects.forEach(subj => {
      const subjKey = subjectMap[subj];
      const div = document.createElement('div');
      div.style.width = '100%';
      const cv = document.createElement('canvas');
      cv.id = 'modal_compare_' + subjKey;
      cv.width = 360; cv.height = 260;
      div.appendChild(cv);
      grid1.appendChild(div);
      const targetData = compareTabDist('target', subj);
      const compareData = compareTabDist('compare', subj);
      window.analysisChart.createComparisonBarChart(cv.id, targetData, compareData, subj);
    });
    // 표준점수 분포 비교
    const h2 = document.createElement('h4');
    h2.textContent = '표준점수 분포 비교';
    h2.style.width = '100%';
    h2.style.textAlign = 'center';
    h2.style.marginTop = '2rem';
    h2.style.marginBottom = '1rem';
    body.appendChild(h2);

    const grid2 = document.createElement('div');
    grid2.className = 'chart-modal-grid cols-2';
    body.appendChild(grid2);

    ['국어', '수학'].forEach(subj => {
      const subjKey = subjectMap[subj];
      const div = document.createElement('div');
      div.style.width = '100%';
      const cv = document.createElement('canvas');
      cv.id = 'modal_std_' + subjKey;
      cv.width = 360; cv.height = 260;
      div.appendChild(cv);
      grid2.appendChild(div);
      window.analysisChart.createStdScoreComparisonChart(cv.id, getCompareTargetData(), getCompareCompareData(), subj);
    });
  });
}

/**
 * 1,2등급 비율 비교 그래프를 모달로 표시하는 함수
 */
function openGrade12ChartModal() {
  openChartModal('1,2등급 비율 비교', function (body) {
    const subjects = ['국어', '수학', '영어'];
    const subjectMap = { '국어': 'korean', '수학': 'math', '영어': 'english' };
    const targetData = {};
    const compareData = {};

    subjects.forEach(subj => {
      const subjKey = subjectMap[subj];
      targetData[subjKey] = compareTab12('target', subj);
      compareData[subjKey] = compareTab12('compare', subj);
    });

    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.maxWidth = '640px';
    div.style.margin = '0 auto';
    div.style.display = 'flex';
    div.style.justifyContent = 'center';
    const cv = document.createElement('canvas');
    cv.id = 'modal_grade12_chart';
    cv.width = 500; cv.height = 300;
    div.appendChild(cv);
    body.appendChild(div);

    window.analysisChart.createGrade12ComparisonChart(cv.id, targetData, compareData);
  });
}

// 7-2. 탐구 과목 영역별 점수 분포 그래프
function showExploreDistributionChart(scoreType) {
  document.getElementById(`exploreChart_${scoreType}`).style.display = 'block';
  window.analysisChart.createScoreDistribution(`canvas_${scoreType}_social`, parsedData, '사회탐구', scoreType);
  window.analysisChart.createScoreDistribution(`canvas_${scoreType}_science`, parsedData, '과학탐구', scoreType);
}

/**
 * 그래프를 숨기는 함수
 * @param {string} chartId - 숨길 그래프 컨테이너 ID
 */
function hideChart(chartId) {
  document.getElementById(chartId).style.display = 'none';
}

// ------------------- 페이지 로드 시 자동 초기화 -------------------
// DOM이 완전히 로드된 후 탭 UI 초기화 실행
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(window.initAnalyzeTabs, 0);
} else {
  window.addEventListener('DOMContentLoaded', window.initAnalyzeTabs);
}

// ------------------- 과목 조합 통계 유틸 -------------------
// 사용자 정의 조합 전역 상태 (재선언 방지)
if (typeof comboScoreType === 'undefined') {
  var comboScoreType = 'auto'; // 'auto' | '표준점수' | '원점수' | '백분위'
}
if (typeof comboSelections === 'undefined') {
  var comboSelections = { kor: true, math: true, explore: true }; // 기본: 국+수+탐
}

function getUseStdForCombo() {
  if (comboScoreType === '표준점수') return true;
  if (comboScoreType === '원점수' || comboScoreType === '백분위') return false;
  // auto: XLSX는 표준, CSV는 사용자 토글 반영
  if (window.uploadedFileExt === 'xlsx') return true;
  if (window.uploadedFileExt === 'csv') return !!window.csvAnalysisUseStd;
  return false;
}

function getScoreBySubjectAndType(s, subject) {
  if (comboScoreType === '백분위') {
    if (subject === '탐구') {
      const a = Number(s.사회탐구?.백분위 ?? NaN);
      const b = Number(s.과학탐구?.백분위 ?? NaN);
      return (isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b);
    }
    return Number(s[subject]?.백분위 ?? NaN);
  }
  const useStd = getUseStdForCombo();
  return getScoreBySubject(s, subject, useStd);
}

function getScoreBySubject(s, subject, useStd) {
  if (subject === '국어' || subject === '수학') {
    return Number(useStd ? (s[subject]?.표준점수 ?? NaN) : (s[subject]?.원점수 ?? NaN));
  }
  if (subject === '탐구') {
    const a = Number(useStd ? (s.사회탐구?.표준점수 ?? NaN) : (s.사회탐구?.원점수 ?? NaN));
    const b = Number(useStd ? (s.과학탐구?.표준점수 ?? NaN) : (s.과학탐구?.원점수 ?? NaN));
    return (isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b);
  }
  return NaN;
}

function computeComboScores(data, combo) {
  return data.map(s => combo.reduce((sum, subj) => {
    const v = getScoreBySubjectAndType(s, subj);
    return sum + (isNaN(v) ? 0 : v);
  }, 0)).filter(v => !isNaN(v));
}

function summarizeScores(scores) {
  if (!scores.length) return { avg: '-', top10: '-', top20: '-', top30: '-' };
  const arr = [...scores].sort((a, b) => b - a);
  const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
  const pct = p => {
    const c = Math.max(1, Math.ceil(arr.length * p));
    return (arr.slice(0, c).reduce((a, b) => a + b, 0) / c).toFixed(2);
  };
  return { avg, top10: pct(0.1), top20: pct(0.2), top30: pct(0.3) };
}

function renderSubjectComboCardsHTML() {
  const selected = buildSelectedCombo();
  if (selected.length === 0) return '<p>조합을 선택하세요.</p>';
  const combos = [{ key: 'custom', label: selected.join(' + '), subjects: selected }];
  let html = '<div class="subject-combo-box">';
  combos.forEach(c => {
    const scores = computeComboScores(parsedData, c.subjects);
    const stats = summarizeScores(scores);
    html += `
      <div class="table-container p-12">
        <h4 class="mt-6 mb-10">${c.label}</h4>
        <table><thead><tr><th>지표</th><th>값</th></tr></thead>
        <tbody>
          <tr><td>평균</td><td>${stats.avg}</td></tr>
          <tr><td>상위 10% 평균</td><td>${stats.top10}</td></tr>
          <tr><td>상위 20% 평균</td><td>${stats.top20}</td></tr>
          <tr><td>상위 30% 평균</td><td>${stats.top30}</td></tr>
        </tbody></table>
      </div>`;
  });
  html += '</div>';
  return html;
}

function buildSelectedCombo() {
  const arr = [];
  if (comboSelections.kor) arr.push('국어');
  if (comboSelections.math) arr.push('수학');
  if (comboSelections.explore) arr.push('탐구');
  return arr;
}

window.renderAnalyzeCombos = function () {
  // 전체 분석 섹션 내 조합 컨트롤/카드 영역 재구성
  const container = document.getElementById('comboContainer');
  if (container) {
    container.innerHTML = renderSubjectComboControlsHTML() + renderSubjectComboCardsHTML();
  }
}

function renderSubjectComboControlsHTML() {
  return `
    <div class="filter-controls">
      <div class="filter-group">
        <label><input type="checkbox" id="combo_kor" ${comboSelections.kor ? 'checked' : ''} onchange="toggleComboSubject('kor')">국어</label>
        <label><input type="checkbox" id="combo_math" ${comboSelections.math ? 'checked' : ''} onchange="toggleComboSubject('math')">수학</label>
        <label><input type="checkbox" id="combo_explore" ${comboSelections.explore ? 'checked' : ''} onchange="toggleComboSubject('explore')">탐구(2)</label>
        <label>점수 기준
          <select id="combo_score_type" onchange="changeComboScoreType()">
            <option value="auto" ${comboScoreType === 'auto' ? 'selected' : ''}>자동(파일 형식)</option>
            <option value="표준점수" ${comboScoreType === '표준점수' ? 'selected' : ''}>표준점수</option>
            <option value="원점수" ${comboScoreType === '원점수' ? 'selected' : ''}>원점수</option>
            <option value="백분위" ${comboScoreType === '백분위' ? 'selected' : ''}>백분위</option>
          </select>
        </label>
        <button class="action-btn-secondary" onclick="renderAnalyzeCombos()">적용</button>
      </div>
    </div>`;
}

window.toggleComboSubject = function (key) {
  comboSelections[key] = document.getElementById(`combo_${key}`).checked;
};
window.changeComboScoreType = function () {
  comboScoreType = document.getElementById('combo_score_type').value;
};

function toggleElementVisibility(containerId, show) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
  // 차트 메모리 회수: 숨길 때 해당 컨테이너 내 캔버스 차트 destroy
  if (!show) {
    const canvases = el.querySelectorAll('canvas');
    canvases.forEach(cv => window.analysisChart.destroyChart(cv.id));
  }
}

function openGradePieChartModal() {
  openChartModal('과목별 등급 내 인원 현황', function (body) {
    const koreanData = getGradeDistByCut(parsedData, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean);
    const mathData = getGradeDistByCut(parsedData, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math);
    const englishData = getGradeDistByCut(parsedData, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english);

    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-3';

    ['korean', 'math', 'english'].forEach((subj, i) => {
      const labels = ['국어', '수학', '영어'];
      const datas = [koreanData, mathData, englishData];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_pie_' + subj;
      cv.width = 250; cv.height = 250;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createGradePieChart('modal_pie_korean', koreanData, '국어');
    window.analysisChart.createGradePieChart('modal_pie_math', mathData, '수학');
    window.analysisChart.createGradePieChart('modal_pie_english', englishData, '영어');
  });
}

function openExploreGradePieChartModal() {
  openChartModal('탐구 영역 등급 내 인원 현황', function (body) {
    const socialData = getGradeDistByCut(parsedData, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social);
    const scienceData = getGradeDistByCut(parsedData, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science);

    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-2';

    ['social', 'science'].forEach((subj, i) => {
      const labels = ['사회탐구', '과학탐구'];
      const datas = [socialData, scienceData];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_pie_' + subj;
      cv.width = 250; cv.height = 250;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createGradePieChart('modal_pie_social', socialData, '사회탐구');
    window.analysisChart.createGradePieChart('modal_pie_science', scienceData, '과학탐구');
  });
}

function openScoreDistributionModal(scoreType) {
  openChartModal(scoreType + ' 분포', function (body) {
    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-2';

    ['korean', 'math'].forEach((subj, i) => {
      const labels = ['국어', '수학'];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_dist_' + subj;
      cv.width = 300; cv.height = 200;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createScoreDistribution('modal_dist_korean', parsedData, '국어', scoreType);
    window.analysisChart.createScoreDistribution('modal_dist_math', parsedData, '수학', scoreType);
  });
}

function openScoreCdfModal(scoreType) {
  openChartModal(scoreType + ' 누적분포(CDF)', function (body) {
    const infoDiv = document.createElement('div');
    infoDiv.style.textAlign = 'left';
    infoDiv.style.background = '#f8fafc';
    infoDiv.style.padding = '1.2rem 1.5rem';
    infoDiv.style.borderRadius = '8px';
    infoDiv.style.border = '1px solid #e2e8f0';
    infoDiv.style.marginBottom = '2rem';
    infoDiv.innerHTML = `
        <strong style="color: var(--primary-dark); font-size: 1.05rem; display: block; margin-bottom: 0.8rem;">📊 누적분포도 (CDF) 쉽게 이해하기</strong>
        <ul style="margin: 0; padding-left: 1.2rem; line-height: 1.6; color: #334155; font-size: 0.95rem;">
          <li style="margin-bottom: 0.5rem;"><strong>어떤 그래프인가요?</strong> 왼쪽(낮은 점수)부터 오른쪽(높은 점수)으로 갈수록 학생들의 비율을 계속 더해나간 그래프입니다. 특정 점수에서의 Y값은 <strong>"해당 점수 이하를 받은 학생들의 비율"</strong>을 뜻합니다.</li>
          <li style="margin-bottom: 0.5rem;"><strong>기울기의 의미:</strong> 그래프가 <strong>위로 가파르게 솟아오르는 구간</strong>은 그 점수대에 성적이 비슷한 학생들이 <strong>가장 밀집</strong>해 있다는 뜻입니다. (완만한 구간은 학생 수가 적음을 의미합니다.)</li>
          <li><strong>기준선 읽는 법:</strong>
            <ul style="margin-top: 0.3rem; padding-left: 1.2rem; color: #475569; list-style-type: circle;">
              <li><strong style="color:#111827">Median (P50)</strong>: 전체 학생 중 정확히 한가운데(50%) 등수인 학생의 점수로, 체감 평균을 나타냅니다.</li>
              <li><strong style="color:#9ca3af">P90</strong>: 하위 90% (상위 10%) 성적입니다. 상위권 학생들의 컷오프를 파악할 때 유용합니다.</li>
              <li><strong style="color:#6b7280">P25, P75</strong>: 각각 하위 25%, 75% 지점으로 학생들의 전반적인 점수가 어느 구간에 몰려있는지(박스권) 파악할 수 있습니다.</li>
            </ul>
          </li>
        </ul>
      `;
    body.appendChild(infoDiv);

    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-2';

    ['korean', 'math'].forEach((subj, i) => {
      const labels = ['국어', '수학'];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_cdf_' + subj;
      cv.width = 300; cv.height = 200;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createCdfChart('modal_cdf_korean', parsedData, '국어', scoreType);
    window.analysisChart.createCdfChart('modal_cdf_math', parsedData, '수학', scoreType);
  });
}

function openExploreDistributionModal(scoreType) {
  openChartModal(scoreType + ' 탐구 영역 분포', function (body) {
    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-2';

    ['social', 'science'].forEach((subj, i) => {
      const labels = ['사회탐구', '과학탐구'];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_exp_dist_' + subj;
      cv.width = 300; cv.height = 200;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createScoreDistribution('modal_exp_dist_social', parsedData, '사회탐구', scoreType);
    window.analysisChart.createScoreDistribution('modal_exp_dist_science', parsedData, '과학탐구', scoreType);
  });
}

function openExploreCdfModal(scoreType) {
  openChartModal(scoreType + ' 탐구 누적분포(CDF)', function (body) {
    const infoDiv = document.createElement('div');
    infoDiv.style.textAlign = 'left';
    infoDiv.style.background = '#f8fafc';
    infoDiv.style.padding = '1.2rem 1.5rem';
    infoDiv.style.borderRadius = '8px';
    infoDiv.style.border = '1px solid #e2e8f0';
    infoDiv.style.marginBottom = '2rem';
    infoDiv.innerHTML = `
        <strong style="color: var(--primary-dark); font-size: 1.05rem; display: block; margin-bottom: 0.8rem;">📊 누적분포도 (CDF) 쉽게 이해하기</strong>
        <ul style="margin: 0; padding-left: 1.2rem; line-height: 1.6; color: #334155; font-size: 0.95rem;">
          <li style="margin-bottom: 0.5rem;"><strong>어떤 그래프인가요?</strong> 왼쪽(낮은 점수)부터 오른쪽(높은 점수)으로 갈수록 학생들의 비율을 계속 더해나간 그래프입니다. 특정 점수에서의 Y값은 <strong>"해당 점수 이하를 받은 학생들의 비율"</strong>을 뜻합니다.</li>
          <li style="margin-bottom: 0.5rem;"><strong>기울기의 의미:</strong> 그래프가 <strong>위로 가파르게 솟아오르는 구간</strong>은 그 점수대에 성적이 비슷한 학생들이 <strong>가장 밀집</strong>해 있다는 뜻입니다. (완만한 구간은 학생 수가 적음을 의미합니다.)</li>
          <li><strong>기준선 읽는 법:</strong>
            <ul style="margin-top: 0.3rem; padding-left: 1.2rem; color: #475569; list-style-type: circle;">
              <li><strong style="color:#111827">Median (P50)</strong>: 전체 학생 중 정확히 한가운데(50%) 등수인 학생의 점수로, 체감 평균을 나타냅니다.</li>
              <li><strong style="color:#9ca3af">P90</strong>: 하위 90% (상위 10%) 성적입니다. 상위권 학생들의 컷오프를 파악할 때 유용합니다.</li>
              <li><strong style="color:#6b7280">P25, P75</strong>: 각각 하위 25%, 75% 지점으로 학생들의 전반적인 점수가 어느 구간에 몰려있는지(박스권) 파악할 수 있습니다.</li>
            </ul>
          </li>
        </ul>
      `;
    body.appendChild(infoDiv);

    const divContainer = document.createElement('div');
    divContainer.className = 'chart-modal-grid cols-2';

    ['social', 'science'].forEach((subj, i) => {
      const labels = ['사회탐구', '과학탐구'];
      const div = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = labels[i];
      h4.style.textAlign = 'center';
      div.appendChild(h4);

      const cv = document.createElement('canvas');
      cv.id = 'modal_exp_cdf_' + subj;
      cv.width = 300; cv.height = 200;
      div.appendChild(cv);
      divContainer.appendChild(div);
    });
    body.appendChild(divContainer);

    window.analysisChart.createCdfChart('modal_exp_cdf_social', parsedData, '사회탐구', scoreType);
    window.analysisChart.createCdfChart('modal_exp_cdf_science', parsedData, '과학탐구', scoreType);
  });
}


// ------------------- 과목 조합 통계 유틸 (중복 선언 방지)
if (typeof comboScoreType === 'undefined') {
  var comboScoreType = 'auto';
}
if (typeof comboSelections === 'undefined') {
  var comboSelections = { kor: true, math: true, explore: true };
}
