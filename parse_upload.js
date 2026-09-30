// ------------------- 파일 업로드 및 파싱 (임시 데이터 저장) -------------------

// 전역 변수: 원본 2차원 배열, 파싱된 객체 배열
// let csvData = [];
//let parsedData = [];

// 등급컷 데이터 구조(원점수, 표준점수 모두, 대상/비교)
if (typeof gradeCuts === 'undefined') {
  window.gradeCuts = {
    target: { // 대상군 등급컷
      raw: { korean: [], math: [], social: [], science: [], history: [], english: [] },
      std: { korean: [], math: [], social: [], science: [], history: [], english: [] }
    },
    compare: { // 비교군 등급컷 
      raw: { korean: [], math: [], social: [], science: [], history: [], english: [] },
      std: { korean: [], math: [], social: [], science: [], history: [], english: [] }
    }
  };
}
if (typeof currentCutTab === 'undefined') {
  window.currentCutTab = 'target';
}

// 파일 업로드 및 자동 파싱 (csv/xlsx, xls 안내)
window.parseFile = function() {
  showLoading();
  const fileInput = document.getElementById('csvFile');
  const file = fileInput.files[0];
  if (!file) {
    showMessage('파일을 선택하세요.');
    hideLoading();
    return;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  window.uploadedIsStdReport = false; // 표준점수 성적표면 해당 파서에서 다시 true로 바꾼다
  window.uploadedReportFormat = '';   // 교육청 성적표(HTML)면 'std' | 'area'
  window.uploadedReportLabel = (ext === 'csv' || ext === 'txt') ? 'CSV 파일' : '엑셀 파일';
  // 업로드 확장자 전역 저장 (.xls는 xlsx와 동일한 파싱 로직을 사용하므로 내부적으로 'xlsx'로 통일)
  try { window.uploadedFileExt = (ext === 'xls') ? 'xlsx' : ext; } catch(e) {}
  if (ext === 'csv' || ext === 'txt') {
    window.uploadedIsStdReport = false;
    readCsvFileText(file).then(text => {
      const lines = parseCsvText(text);
      csvData = lines;
      parsedData = parseCsvRows(lines); // 임시 저장
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showToast('CSV 파일이 업로드 및 파싱되었습니다.');
    }).catch(err => {
      showMessage('CSV 파싱 중 오류가 발생했습니다. ' + (err?.message || err));
    }).finally(hideLoading);
  } else if (ext === 'xlsx' || ext === 'xls') {
    // 실제 이진 XLSX/XLS 파일인지, EUC-KR HTML로 저장된 "성적표"(예: 교육청 [표준점수 기준] 리포트)인지
    // 먼저 파일 앞부분 바이트를 확인해서 분기한다.
    const headReader = new FileReader();
    headReader.onload = function (headEv) {
      const head = new Uint8Array(headEv.target.result);
      const isZip = head[0] === 0x50 && head[1] === 0x4B; // xlsx(zip)
      const isBiff = head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0; // 구형 xls(OLE)
      if (isZip || isBiff) {
        parseBinarySpreadsheet(file, ext);
      } else {
        parseHtmlReportFile(file);
      }
    };
    headReader.onerror = function () {
      // 헤더 확인에 실패하면 일단 정상 바이너리로 간주하고 시도
      parseBinarySpreadsheet(file, ext);
    };
    headReader.readAsArrayBuffer(file.slice(0, 8));
  } else {
    showMessage('지원하지 않는 파일 형식입니다.');
    hideLoading();
  }
};

// 실제 바이너리 XLSX(zip)/XLS(OLE) 파일 파싱 (Web Worker 우선, 실패 시 메인 스레드 폴백)
function parseBinarySpreadsheet(file, ext) {
  try {
    const worker = new Worker('parser.worker.js');
    const reader = new FileReader();
    reader.onload = function(ev) {
      worker.postMessage({ arrayBuffer: ev.target.result }, [ev.target.result]);
    };
    worker.onmessage = function(ev) {
      const { ok, rows, error } = ev.data || {};
      if (!ok) {
        console.error('Worker error:', error);
        // 폴백: 메인 스레드에서 파싱
        fallbackParse();
        return;
      }
      csvData = rows;
      parsedData = parseXlsxRows(rows);
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showToast(ext.toUpperCase() + ' 파일이 업로드 및 파싱되었습니다.');
      hideLoading();
      worker.terminate();
    };
    worker.onerror = function(err) {
      console.error('Worker onerror:', err);
      fallbackParse();
    };
    reader.readAsArrayBuffer(file);

    function fallbackParse() {
      const fr = new FileReader();
      fr.onload = function(e2) {
        try {
          const data = new Uint8Array(e2.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});
          csvData = rows;
          parsedData = parseXlsxRows(rows);
          displayParsedTable(parsedData);
          renderUploadSummary(parsedData, file.name);
          showToast(ext.toUpperCase() + ' 파일이 업로드 및 파싱되었습니다. (폴백)');
        } catch (e) {
          showMessage(ext.toUpperCase() + ' 파싱 중 오류가 발생했습니다. ' + e.message);
        } finally {
          hideLoading();
        }
      };
      fr.readAsArrayBuffer(file);
    }
  } catch (err) {
    console.error('Worker init failed:', err);
    // 워커 생성 실패 시 폴백
    const fr = new FileReader();
    fr.onload = function(e2) {
      try {
        const data = new Uint8Array(e2.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});
        csvData = rows;
        parsedData = parseXlsxRows(rows);
        displayParsedTable(parsedData);
        renderUploadSummary(parsedData, file.name);
        showToast(ext.toUpperCase() + ' 파일이 업로드 및 파싱되었습니다. (폴백)');
      } catch (e) {
        showMessage(ext.toUpperCase() + ' 파싱 중 오류가 발생했습니다. ' + e.message);
      } finally {
        hideLoading();
      }
    };
    fr.readAsArrayBuffer(file);
  }
}

// EUC-KR HTML 기반 "성적표"(예: 교육청 [표준점수 기준] 수능성적표) 파일 파싱
// 학교 성적처리 프로그램에서 .xls 확장자로 저장되지만 실제로는 HTML 표인 경우가 많고,
// 실채점 이후에는 원점수 없이 표준점수/등급만 제공되는 경우가 있어 전용 파서로 처리한다.
function parseHtmlReportFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      // 머리글 지문으로 형식을 인식한다 (파일명은 보지 않음). 모르는 형식이면 여기서 오류로 멈춘다
      const { format, label, data: rowsData } = parseHtmlReport(text);
      window.uploadedFileExt = 'xlsx';
      window.uploadedReportFormat = format;
      window.uploadedReportLabel = label;
      window.uploadedIsStdReport = (format === 'std'); // 원점수 없이 표준점수/등급만 제공되는 리포트
      csvData = [];
      parsedData = rowsData;
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showToast(format === 'area'
        ? '영역별 기준 성적표 파일이 업로드 및 파싱되었습니다. (원점수·백분위·등급 모두 공식 값 사용)'
        : '표준점수 기준 성적표 파일이 업로드 및 파싱되었습니다. (원점수 없이 표준점수 기준으로 분석)');
    } catch (err) {
      showMessage('성적표 파일 파싱 중 오류가 발생했습니다. ' + err.message);
    } finally {
      hideLoading();
    }
  };
  reader.onerror = function () {
    showMessage('파일을 읽는 중 오류가 발생했습니다.');
    hideLoading();
  };
  // 이 형식의 리포트는 EUC-KR로 인코딩되어 있다 (meta charset=euc-kr)
  reader.readAsText(file, 'euc-kr');
}

// ------------------- 교육청 성적표(HTML 표) 형식 인식 -------------------
// 학교 성적처리 프로그램이 .xls 확장자로 내려주는 파일은 실제로는 HTML 표다.
// 파일명은 보지 않고 "머리글 지문"으로만 형식을 구분한다:
//  1) 병합 칸(colspan/rowspan)을 펼쳐 각 열의 머리글 경로를 만든다 (예: '국어/백분위', '국어/석차/전국')
//  2) 첫 줄 머리글 묶음이 등록된 형식 중 "정확히 하나"와 같아야 한다 (아니면 추측하지 않고 멈춘다)
//  3) 값은 열 번호가 아니라 머리글 경로로 찾는다 → 열 순서가 바뀌어도 값이 밀리지 않는다
//  4) 읽은 값이 상식적인 범위인지 검사한다 (등급 1~9, 백분위 0~100 …) → 열이 어긋나면 업로드를 멈춘다
const REPORT_FORMATS = [
  {
    id: 'std',
    label: '수능성적표 [표준점수 기준]',
    groups: ['순위', '학급', '번호', '이름', '총점(국수탐)', '국어', '수학', '영어', '한국사', '탐구1선택', '탐구2선택'],
    cols: {
      학급: '학급', 번호: '번호', 이름: '이름',
      국어과목: '국어/과목', 국어표준: '국어/점수',
      수학과목: '수학/과목', 수학표준: '수학/점수',
      영어등급: '영어/등급', 한국사등급: '한국사/등급',
      탐1과목: '탐구1선택/과목', 탐1표준: '탐구1선택/점수',
      탐2과목: '탐구2선택/과목', 탐2표준: '탐구2선택/점수'
    }
  },
  {
    id: 'area',
    label: '수능성적표 [영역별 기준]',
    groups: ['순위', '학급', '번호', '이름', '국어', '수학', '영어', '한국사', '탐구1선택', '탐구2선택', '제2외국어'],
    cols: {
      학급: '학급', 번호: '번호', 이름: '이름',
      국어과목: '국어/과목', 국어원점수: '국어/원점수', 국어표준: '국어/표준', 국어백분위: '국어/백분위', 국어등급: '국어/등급',
      수학과목: '수학/과목', 수학원점수: '수학/원점수', 수학표준: '수학/표준', 수학백분위: '수학/백분위', 수학등급: '수학/등급',
      영어원점수: '영어/원점수', 영어등급: '영어/등급',
      한국사원점수: '한국사/원점수', 한국사등급: '한국사/등급',
      탐1과목: '탐구1선택/과목', 탐1원점수: '탐구1선택/원점수', 탐1표준: '탐구1선택/표준', 탐1백분위: '탐구1선택/백분위', 탐1등급: '탐구1선택/등급',
      탐2과목: '탐구2선택/과목', 탐2원점수: '탐구2선택/원점수', 탐2표준: '탐구2선택/표준', 탐2백분위: '탐구2선택/백분위', 탐2등급: '탐구2선택/등급',
      제2외과목: '제2외국어/과목', 제2외원점수: '제2외국어/원점수', 제2외등급: '제2외국어/등급'
    }
  },
  {
    // [영역별 기준] 1학년형: 제2외국어 묶음이 없고, 국어·수학이 공통과목이라 과목 열도 없다.
    // 탐구 과목은 '사회탐구'/'과학탐구'(통합사회·통합과학)로 적혀 있다. 읽는 방식은 위 [영역별 기준]과 같다.
    id: 'area',
    label: '수능성적표 [영역별 기준] (제2외국어 없음)',
    groups: ['순위', '학급', '번호', '이름', '국어', '수학', '영어', '한국사', '탐구1선택', '탐구2선택'],
    cols: {
      학급: '학급', 번호: '번호', 이름: '이름',
      국어원점수: '국어/원점수', 국어표준: '국어/표준', 국어백분위: '국어/백분위', 국어등급: '국어/등급',
      수학원점수: '수학/원점수', 수학표준: '수학/표준', 수학백분위: '수학/백분위', 수학등급: '수학/등급',
      영어원점수: '영어/원점수', 영어등급: '영어/등급',
      한국사원점수: '한국사/원점수', 한국사등급: '한국사/등급',
      탐1과목: '탐구1선택/과목', 탐1원점수: '탐구1선택/원점수', 탐1표준: '탐구1선택/표준', 탐1백분위: '탐구1선택/백분위', 탐1등급: '탐구1선택/등급',
      탐2과목: '탐구2선택/과목', 탐2원점수: '탐구2선택/원점수', 탐2표준: '탐구2선택/표준', 탐2백분위: '탐구2선택/백분위', 탐2등급: '탐구2선택/등급'
    }
  }
];

// HTML 문자열 → 병합 칸을 펼친 격자 + 줄마다 머리글(th)만으로 된 줄인지 여부
function parseHtmlTableToGrid(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) throw new Error('표(<table>)를 찾을 수 없습니다.');
  const grid = [];
  const isHeader = [];
  Array.from(table.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0, allTh = true, any = false;
    Array.from(tr.cells).forEach(cell => {
      while (grid[r][c] !== undefined) c++;
      const cs = Math.max(1, cell.colSpan || 1);
      const rs = Math.max(1, cell.rowSpan || 1);
      const text = (cell.textContent || '').trim();
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = text;
      }
      if (cell.tagName !== 'TH') allTh = false;
      any = true;
      c += cs;
    });
    isHeader[r] = any && allTh;
  });
  return { grid, isHeader };
}

// 격자에서 형식을 인식하고 학생 데이터로 바꾼다 (DOM을 쓰지 않는 부분 — 테스트에서도 그대로 사용)
function recognizeReportGrid(grid, isHeader) {
  const norm = v => String(v ?? '').replace(/\s+/g, '');
  // 머리글 줄 수: 앞쪽의 th 줄. th가 없는 파일이면 학급(3자리 숫자)이 처음 나오는 줄 전까지
  let headerCount = 0;
  while (headerCount < grid.length && isHeader && isHeader[headerCount]) headerCount++;
  if (!headerCount) {
    headerCount = grid.findIndex(row => (row || []).slice(0, 4).some(v => /^\d{3}$/.test(String(v).trim())));
    if (headerCount <= 0) throw new Error('표의 머리글을 찾지 못했습니다. 교육청 성적표 파일이 맞는지 확인해주세요.');
  }
  const width = Math.max(...grid.slice(0, headerCount).map(r => (r || []).length));
  // 열마다 머리글 경로 (세로로 같은 글자가 반복되면(병합) 한 번만)
  const paths = [];
  for (let c = 0; c < width; c++) {
    const parts = [];
    for (let r = 0; r < headerCount; r++) {
      const t = norm(grid[r]?.[c]);
      if (t && parts[parts.length - 1] !== t) parts.push(t);
    }
    paths.push(parts.join('/'));
  }
  const groups = [...new Set(paths.map(p => p.split('/')[0]).filter(Boolean))];

  // 첫 줄 묶음이 정확히 일치하는 형식 찾기 (순서는 달라도 되지만, 더 많거나 적으면 안 된다)
  const matches = REPORT_FORMATS.filter(f =>
    f.groups.length === groups.length && f.groups.every(g => groups.includes(norm(g))));
  if (matches.length !== 1) {
    throw new Error(
      '지원하지 않는 성적표 형식입니다.\n' +
      `찾은 머리글: ${escapeHtml(groups.join(', ')) || '(없음)'}\n` +
      `지원하는 형식: ${REPORT_FORMATS.map(f => f.label).join(', ')}`);
  }
  const fmt = matches[0];

  // 필요한 열을 머리글 경로로 찾는다
  const idx = {};
  const missing = [];
  Object.entries(fmt.cols).forEach(([key, path]) => {
    const i = paths.indexOf(norm(path));
    if (i < 0) missing.push(path); else idx[key] = i;
  });
  if (missing.length) {
    throw new Error(`${fmt.label} 형식으로 보이지만 필요한 열을 찾지 못했습니다: ${missing.join(', ')}\n(교육청 파일 형식이 바뀌었을 수 있습니다)`);
  }

  // 학생 줄만 추린다 (학급이 숫자이고 이름이 있는 줄 — 합계·빈 줄 제외)
  const dataRows = grid.slice(headerCount).filter(row =>
    row && /^\d{1,3}(\.0+)?$/.test(String(row[idx.학급] ?? '').trim()) && String(row[idx.이름] ?? '').trim());
  const data = fmt.id === 'area' ? parseAreaReportRows(dataRows, idx) : parseStdReportRows(dataRows, idx);
  if (!data.length) throw new Error(`${fmt.label} 형식이지만 학생 데이터를 찾지 못했습니다.`);

  const problems = validateReportData(fmt.id, data);
  if (problems.length) {
    throw new Error(`${fmt.label} 형식으로 읽었지만 값이 이상합니다. 열이 어긋났을 수 있어 업로드를 멈췄습니다.\n- ` + problems.slice(0, 4).join('\n- '));
  }
  return { format: fmt.id, label: fmt.label, data };
}

// HTML 성적표 파일 내용 → { format, label, data } (대상·비교 업로드 공용)
function parseHtmlReport(html) {
  const { grid, isHeader } = parseHtmlTableToGrid(html);
  return recognizeReportGrid(grid, isHeader);
}

// 읽은 값이 상식적인 범위인지 검사. 값이 5개 이상 있는 항목 중 90% 미만만 정상이면 문제로 본다.
function validateReportData(format, data) {
  const problems = [];
  const check = (label, values, ok) => {
    const vals = values.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    if (vals.length < 5) return;
    const good = vals.filter(v => ok(String(v).trim())).length;
    if (good / vals.length < 0.9) problems.push(`${label}: ${vals.length}개 중 ${vals.length - good}개가 예상 범위를 벗어남`);
  };
  const num = (lo, hi) => v => { const n = Number(v); return !isNaN(n) && n >= lo && n <= hi; };
  const grade = v => /^[1-9]$/.test(v);
  const notNum = v => isNaN(Number(v));
  const pick = f => data.map(f);
  const exps = data.flatMap(s => s.탐구목록 || []);

  check('학년', pick(s => s.학년), v => /^[1-3]$/.test(v));
  check('번호', pick(s => s.번호), num(1, 99));
  check('국어 표준점수', pick(s => s.국어.표준점수), num(0, 200));
  check('수학 표준점수', pick(s => s.수학.표준점수), num(0, 200));
  check('영어 등급', pick(s => s.영어.등급), grade);
  check('한국사 등급', pick(s => s.한국사.등급), grade);
  check('탐구 과목명', exps.map(e => e.과목), notNum);
  check('탐구 표준점수', exps.map(e => e.표준점수), num(0, 100));
  if (format === 'area') {
    check('국어 원점수', pick(s => s.국어.원점수), num(0, 100));
    check('국어 백분위', pick(s => s.국어.백분위), num(0, 100));
    check('국어 등급', pick(s => s.국어.등급), grade);
    check('수학 원점수', pick(s => s.수학.원점수), num(0, 100));
    check('수학 백분위', pick(s => s.수학.백분위), num(0, 100));
    check('수학 등급', pick(s => s.수학.등급), grade);
    check('영어 원점수', pick(s => s.영어.원점수), num(0, 100));
    check('한국사 원점수', pick(s => s.한국사.원점수), num(0, 50));
    check('탐구 원점수', exps.map(e => e.원점수), num(0, 50));
    check('탐구 백분위', exps.map(e => e.백분위), num(0, 100));
    check('탐구 등급', exps.map(e => e.등급), grade);
  }
  return problems;
}

// 탐구 과목명을 사회/과학으로 분류 (2학년 리포트는 '사회탐구'/'과학탐구'로 이미 명시되기도 함)
function classifyExploreCategory(name) {
  const n = (typeof normalizeSubjectName === 'function') ? normalizeSubjectName(name) : String(name || '').trim();
  if (!n) return null;
  if (n === '사회탐구') return 'social';
  if (n === '과학탐구') return 'science';
  if (typeof subjectSlug === 'function') {
    const slug = subjectSlug(n);
    if (slug.indexOf('soc_') === 0) return 'social';
    if (slug.indexOf('sci_') === 0) return 'science';
  }
  return null;
}

// 성적표 칸 값 정리: '-'·빈칸은 '', 숫자는 "40.0" → "40"
function reportValue(x) {
  const t = (x === undefined || x === null) ? '' : String(x).trim();
  if (t === '' || t === '-') return '';
  const n = Number(t);
  return isNaN(n) ? t : String(n);
}
function reportName(x) {
  const t = (x === undefined || x === null) ? '' : String(x).trim();
  return t === '-' ? '' : t;
}
// '사회탐구'/'과학탐구'처럼 통칭이면 비워둔다 (선택과목명만 보관)
function specificExploreName(n) {
  const t = (typeof normalizeSubjectName === 'function') ? normalizeSubjectName(n) : String(n || '').trim();
  return (t === '사회탐구' || t === '과학탐구') ? '' : t;
}

// "[표준점수 기준] 수능성적표": 원점수/백분위는 없으므로 빈 값으로 둔다 (나중에 등급컷 시험 자료로 역산)
// idx: 머리글 경로로 찾은 열 번호 (REPORT_FORMATS의 cols 키)
function parseStdReportRows(dataRows, idx) {
  return dataRows.map(row => {
    const g = key => row[idx[key]];
    const classInfo = splitClassNumber(g('학급'));
    const explores = [['탐1과목', '탐1표준'], ['탐2과목', '탐2표준']]
      .map(([nk, sk]) => ({ name: reportName(g(nk)), score: reportValue(g(sk)) }))
      .filter(e => e.name && e.score)
      .map(e => ({ 과목: specificExploreName(e.name), 분류: classifyExploreCategory(e.name), 원점수: '', 표준점수: e.score, 백분위: '', 등급: '' }));
    // 사회탐구/과학탐구 칸: 분류별 마지막 과목 — 과목명도 보관 (역산할 때 학생이 본 과목의 변환표를 찾는다)
    const bucket = cat => {
      const e = explores.filter(x => x.분류 === cat).pop();
      return { 원점수: '', 표준점수: e ? e.표준점수 : '', 백분위: '', 과목: e ? e.과목 : '' };
    };
    return {
      학년: classInfo.학년,
      반: classInfo.반,
      번호: reportValue(g('번호')),
      이름: reportName(g('이름')),
      // 과목: 3학년은 선택과목명(화법과작문, 미적분 등), 1·2학년은 '국어'/'수학' — 대교협 자료의 영역 칸에 쓴다
      국어: { 원점수: '', 표준점수: reportValue(g('국어표준')), 백분위: '', 과목: reportName(g('국어과목')) },
      수학: { 원점수: '', 표준점수: reportValue(g('수학표준')), 백분위: '', 과목: reportName(g('수학과목')) },
      영어: { 원점수: '', 등급: reportValue(g('영어등급')) },
      한국사: { 원점수: '', 등급: reportValue(g('한국사등급')) },
      사회탐구: bucket('social'),
      과학탐구: bucket('science'),
      // 탐구1/탐구2를 원래 순서·과목명 그대로 보관 (사회 2과목을 본 학생도 잃지 않도록)
      탐구목록: explores
    };
  });
}

// "[영역별 기준] 수능성적표": 원점수·표준점수·백분위·등급이 모두 공식 값으로 들어 있다
function parseAreaReportRows(dataRows, idx) {
  return dataRows.map(row => {
    const g = key => row[idx[key]];
    const classInfo = splitClassNumber(g('학급'));
    const subj = p => ({
      과목: reportName(g(p + '과목')), 원점수: reportValue(g(p + '원점수')), 표준점수: reportValue(g(p + '표준')),
      백분위: reportValue(g(p + '백분위')), 등급: reportValue(g(p + '등급'))
    });
    const explores = ['탐1', '탐2'].map(p => {
      const e = subj(p);
      if (!e.과목 && !e.표준점수 && !e.원점수) return null;
      return { ...e, 과목: specificExploreName(e.과목), 분류: classifyExploreCategory(e.과목) };
    }).filter(Boolean);
    const bucket = cat => {
      const e = explores.filter(x => x.분류 === cat).pop();
      return e ? { 원점수: e.원점수, 표준점수: e.표준점수, 백분위: e.백분위, 등급: e.등급, 과목: e.과목 }
               : { 원점수: '', 표준점수: '', 백분위: '', 등급: '', 과목: '' };
    };
    // 제2외국어: 과목이 비어 있으면(점수 0) 미응시
    const f2name = reportName(g('제2외과목'));
    return {
      학년: classInfo.학년,
      반: classInfo.반,
      번호: reportValue(g('번호')),
      이름: reportName(g('이름')),
      국어: subj('국어'),
      수학: subj('수학'),
      영어: { 원점수: reportValue(g('영어원점수')), 등급: reportValue(g('영어등급')) },
      한국사: { 원점수: reportValue(g('한국사원점수')), 등급: reportValue(g('한국사등급')) },
      사회탐구: bucket('social'),
      과학탐구: bucket('science'),
      탐구목록: explores,
      제2외국어: f2name ? { 과목: f2name, 원점수: reportValue(g('제2외원점수')), 등급: reportValue(g('제2외등급')) } : null
    };
  });
}

// CSV 구조 파싱 (공통)
function parseCsvRows(rows) {
  if (!rows || rows.length < 2) return [];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue;
    const id = row[0] || '';
    const grade = id.substring(2, 3).padStart(1, '0');
    const classNum = id.substring(3, 5).padStart(2, '0');
    const number = id.substring(5, 8).padStart(3, '0');
    // CSV 포맷: 아이디, 이름, 학년, 시험일자, 출제기관,
    // 국어(원/표/백/등), 수학(원/표/백/등), 영어(원/등),
    // 탐1과목명, 탐1(원/표/백/등), 탐2과목명, 탐2(원/표/백/등), 한국사(원/등), 잠금상태
    // 인덱스는 샘플과 코드 주석에 맞춤
    data.push({
      학년: grade,
      반: classNum,
      번호: number,
      이름: row[1] || '',
      국어: { 원점수: row[5] || '', 표준점수: row[6] || '', 백분위: row[7] || '', 등급: row[8] || '' },
      수학: { 원점수: row[9] || '', 표준점수: row[10] || '', 백분위: row[11] || '', 등급: row[12] || '' },
      영어: { 원점수: row[13] || '', 등급: row[14] || '' },
      한국사: { 원점수: row[25] || '', 등급: row[26] || '' },
      사회탐구: { 원점수: row[16] || '', 표준점수: row[17] || '', 백분위: row[18] || '', 등급: row[19] || '' },
      과학탐구: { 원점수: row[21] || '', 표준점수: row[22] || '', 백분위: row[23] || '', 등급: row[24] || '' },
      // 탐구1/탐구2 원래 순서·과목명 (대교협 자료 내보내기 등에서 사용)
      탐구목록: [[15, 16], [20, 21]]
        .filter(([ni, si]) => (row[ni] || '').trim() && ((row[si] || '').trim() || (row[si + 1] || '').trim()))
        .map(([ni, si]) => {
          const name = (row[ni] || '').trim();
          return { 과목: name, 분류: classifyExploreCategory(name), 원점수: row[si] || '', 표준점수: row[si + 1] || '', 백분위: row[si + 2] || '', 등급: row[si + 3] || '' };
        })
    });
  }
  return data;
}

function parseXlsxRows(rows) {
  if (!rows || rows.length < 3) return [];
  const data = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[3]) continue;
    const classInfo = splitClassNumber(row[1]);
    data.push({
      학년: classInfo.학년,
      반: classInfo.반,
      번호: row[2] || '',
      이름: row[3] || '',
      국어: { 원점수: row[4] || '', 표준점수: row[5] || '', 백분위: row[6] || '' },
      수학: { 원점수: row[8] || '', 표준점수: row[9] || '', 백분위: row[10] || '' },
      영어: { 원점수: row[12] || '' },
      한국사: { 원점수: row[14] || '' },
      사회탐구: { 원점수: row[17] || '', 표준점수: row[18] || '', 백분위: row[19] || '' },
      과학탐구: { 원점수: row[22] || '', 표준점수: row[23] || '', 백분위: row[24] || '' }
    });
  }
  return data;
}

// 테이블 표시
function displayParsedTable(data) {
  const container = document.getElementById('csvTableContainer');
  if (!data.length) {
    container.innerHTML = '<p>파싱된 데이터가 없습니다.</p>';
    return;
  }
  let html = '<table id="parsedTable"><thead>';
  html += `
    <tr>
      <th class="no-copy" rowspan="2">학년</th>
      <th class="no-copy" rowspan="2">반</th>
      <th class="no-copy" rowspan="2">번호</th>
      <th class="no-copy" rowspan="2">이름</th>
      <th colspan="3">국어</th>
      <th colspan="3">수학</th>
      <th rowspan="2">영어</th>
      <th rowspan="2">한국사</th>
      <th colspan="3">사회탐구</th>
      <th colspan="3">과학탐구</th>
    </tr>
    <tr>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
    </tr>
  `;
  html += '</thead><tbody>';
  data.forEach(row => {
    html += '<tr>';
    html += `<td class="no-copy">${row.학년}</td><td class="no-copy">${row.반}</td><td class="no-copy">${row.번호}</td><td class="no-copy">${escapeHtml(row.이름)}</td>`;
    html += `<td>${row.국어.원점수}</td><td>${row.국어.표준점수}</td><td>${row.국어.백분위}</td>`;
    html += `<td>${row.수학.원점수}</td><td>${row.수학.표준점수}</td><td>${row.수학.백분위}</td>`;
    html += `<td>${row.영어.원점수 || (row.영어.등급 ? row.영어.등급 + '등급' : '')}</td>`;
    html += `<td>${row.한국사.원점수 || (row.한국사.등급 ? row.한국사.등급 + '등급' : '')}</td>`;
    html += `<td>${row.사회탐구.원점수}</td><td>${row.사회탐구.표준점수}</td><td>${row.사회탐구.백분위}</td>`;
    html += `<td>${row.과학탐구.원점수}</td><td>${row.과학탐구.표준점수}</td><td>${row.과학탐구.백분위}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<button class="copy-btn" onclick="copyTableBodyAsHtml(\'parsedTable\')">데이터 복사</button>';
  container.innerHTML = html;
}

// 업로드 요약 카드 렌더링
function renderUploadSummary(data, fileName) {
  const card = document.getElementById('uploadSummaryCard');
  if (!card) return;
  const grades = [...new Set(data.map(s => s.학년))].sort();
  const gradeText = grades.map(g => g + '학년').join(', ');

  // 등급컷이 이미 입력되어 있으면(예: 실채점 데이터를 다시 올리는 경우) 바로 분석 화면으로 안내
  const hasGradeCuts = (typeof hasGradingBasis === 'function') && hasGradingBasis();

  card.classList.remove('hidden');
  if (hasGradeCuts) {
    // 이미 불러온 등급컷이 있으면 그 시험 기준으로 분석한다. 다른 시험 파일일 수도 있으니
    // 어떤 시험의 등급컷인지 보여주고, 학년이 다르면 경고한다 (예전엔 아무 확인 없이 바로 분석했다)
    const ex = window.__lastEbsiExam;
    const official = window.uploadedReportFormat === 'area';
    const cutLabel = (ex ? `${ex.year}년 ${ex.gradeVal ? ex.gradeVal + '학년 ' : ''}${ex.examText || ''}`.trim() : '직접 입력한 등급컷')
      + (official ? ' (학생 등급은 성적표의 공식 등급 사용)' : '');
    // 등급컷은 분석 자료의 "등급 구분 표준점수"로도 쓰이므로, 공식 등급이 있는 파일이어도 시험이 다르면 경고한다
    const gradeMismatch = ex && ex.gradeVal && grades.length && !grades.includes(String(ex.gradeVal));
    card.innerHTML = `
      <div class="upload-summary-info">
        <strong>${escapeHtml(fileName)}</strong> &mdash; ${data.length}명 (${gradeText || '학년 정보 없음'})
        <div class="upload-summary-note">인식한 형식: ${escapeHtml(window.uploadedReportLabel || '-')}</div>
        <div class="upload-summary-note">현재 등급컷: ${escapeHtml(cutLabel)}${gradeMismatch ? ' — <strong>파일 학년과 다릅니다. 다른 시험이면 등급컷을 다시 불러오세요.</strong>' : ''}</div>
      </div>
      <button class="upload-next-btn" onclick="showSection('analyze')">
        바로 분석하러 가기
      </button>
      <button class="upload-next-btn upload-next-secondary" onclick="showSection('cut')">
        등급컷 다시 불러오기
      </button>
    `;
    // 학년이 맞을 때만 자동으로 분석 화면까지 진행
    if (!gradeMismatch && typeof showSection === 'function') showSection('analyze');
  } else {
    card.innerHTML = `
      <div class="upload-summary-info">
        <strong>${escapeHtml(fileName)}</strong> &mdash; ${data.length}명 (${gradeText || '학년 정보 없음'})
        <div class="upload-summary-note">인식한 형식: ${escapeHtml(window.uploadedReportLabel || '-')}</div>
      </div>
      <button class="upload-next-btn" onclick="showSection('cut')">
        등급컷 입력하러 가기
      </button>
    `;
  }
  // 업로드 성공 애니메이션
  const dropBox = document.getElementById('uploadDrop');
  if (dropBox) {
    dropBox.classList.add('upload-success');
    setTimeout(() => dropBox.classList.remove('upload-success'), 2000);
  }
  // 스텝 인디케이터 갱신
  if (typeof updateStepIndicator === 'function') updateStepIndicator();
}

function displayCompareTable(data) {
  const container = document.getElementById('compareTableContainer');
  if (!data.length) {
    container.innerHTML = '<p>파싱된 데이터가 없습니다.</p>';
    return;
  }
  let html = '<table id="compareParsedTable"><thead>';
  html += `
    <tr>
      <th class="no-copy" rowspan="2">학년</th>
      <th class="no-copy" rowspan="2">반</th>
      <th class="no-copy" rowspan="2">번호</th>
      <th class="no-copy" rowspan="2">이름</th>
      <th colspan="3">국어</th>
      <th colspan="3">수학</th>
      <th rowspan="2">영어</th>
      <th rowspan="2">한국사</th>
      <th colspan="3">사회탐구</th>
      <th colspan="3">과학탐구</th>
    </tr>
    <tr>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
      <th>원점수</th><th>표준점수</th><th>백분위</th>
    </tr>
  `;
  html += '</thead><tbody>';
  data.forEach(row => {
    html += '<tr>';
    html += `<td class="no-copy">${row.학년}</td><td class="no-copy">${row.반}</td><td class="no-copy">${row.번호}</td><td class="no-copy">${escapeHtml(row.이름)}</td>`;
    html += `<td>${row.국어.원점수}</td><td>${row.국어.표준점수}</td><td>${row.국어.백분위}</td>`;
    html += `<td>${row.수학.원점수}</td><td>${row.수학.표준점수}</td><td>${row.수학.백분위}</td>`;
    html += `<td>${row.영어.원점수}</td>`;
    html += `<td>${row.한국사.원점수}</td>`;
    html += `<td>${row.사회탐구.원점수}</td><td>${row.사회탐구.표준점수}</td><td>${row.사회탐구.백분위}</td>`;
    html += `<td>${row.과학탐구.원점수}</td><td>${row.과학탐구.표준점수}</td><td>${row.과학탐구.백분위}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<button class="copy-btn" onclick="copyTableBodyAsHtml(\'compareParsedTable\')">데이터 복사</button>';
  container.innerHTML = html;
}
