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
  // 업로드 확장자 전역 저장 (.xls는 xlsx와 동일한 파싱 로직을 사용하므로 내부적으로 'xlsx'로 통일)
  try { window.uploadedFileExt = (ext === 'xls') ? 'xlsx' : ext; } catch(e) {}
  if (ext === 'csv' || ext === 'txt') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.trim().split('\n').map(row => row.split(','));
      csvData = lines;
      parsedData = parseCsvRows(lines); // 임시 저장
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showToast('CSV 파일이 업로드 및 파싱되었습니다.');
      hideLoading();
    };
    reader.readAsText(file, 'euc-kr');
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
      const rows = parseHtmlTableToRows(text);
      const rowsData = parseStdReportRows(rows);
      if (!rowsData.length) throw new Error('표에서 학생 데이터를 찾지 못했습니다. 파일 형식을 확인해주세요.');
      window.uploadedFileExt = 'xlsx';
      window.uploadedIsStdReport = true; // 원점수 없이 표준점수/등급만 제공되는 리포트임을 표시
      csvData = rows;
      parsedData = rowsData;
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showToast('표준점수 기준 성적표 파일이 업로드 및 파싱되었습니다. (원점수 없이 표준점수 기준으로 분석)');
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

// HTML 문자열에서 <table> 하나를 찾아 2차원 배열(행x셀 텍스트)로 변환
function parseHtmlTableToRows(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) throw new Error('표(<table>)를 찾을 수 없습니다.');
  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td,th')).map(td => (td.textContent || '').trim());
    rows.push(cells);
  });
  return rows;
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

// "[표준점수 기준] 수능성적표" 형식(순위/학급/번호/이름/총점/국어/수학/영어/한국사/탐구1선택/탐구2선택)을
// 파싱하여 공통 학생 데이터 구조로 변환. 원점수/백분위는 이 리포트에 없으므로 빈 값으로 둔다.
function parseStdReportRows(rows) {
  if (!rows || rows.length < 4) return [];
  const data = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 32 || !row[3]) continue;
    const classInfo = splitClassNumber(row[1]);

    const explore1Cat = classifyExploreCategory(row[26]);
    const explore2Cat = classifyExploreCategory(row[29]);
    let socialScore = '', scienceScore = '';
    // 선택과목명도 함께 보관 — 구 교육과정(선택과목제)에서 원점수/백분위를 역산할 때
    // 학생이 실제로 본 과목의 변환표를 찾는 데 쓴다 ('사회탐구'처럼 통칭이면 비워둔다)
    let socialName = '', scienceName = '';
    const specificName = (n) => {
      const t = (typeof normalizeSubjectName === 'function') ? normalizeSubjectName(n) : String(n || '').trim();
      return (t === '사회탐구' || t === '과학탐구') ? '' : t;
    };
    if (explore1Cat === 'social') { socialScore = row[27] || ''; socialName = specificName(row[26]); }
    else if (explore1Cat === 'science') { scienceScore = row[27] || ''; scienceName = specificName(row[26]); }
    if (explore2Cat === 'social') { socialScore = row[30] || ''; socialName = specificName(row[29]); }
    else if (explore2Cat === 'science') { scienceScore = row[30] || ''; scienceName = specificName(row[29]); }

    data.push({
      학년: classInfo.학년,
      반: classInfo.반,
      번호: row[2] || '',
      이름: row[3] || '',
      // 과목: 3학년은 선택과목명(화법과작문, 미적분 등), 1·2학년은 '국어'/'수학' — 대교협 자료의 영역 칸에 쓴다
      국어: { 원점수: '', 표준점수: row[9] || '', 백분위: '', 과목: (row[8] && row[8] !== '-') ? row[8] : '' },
      수학: { 원점수: '', 표준점수: row[14] || '', 백분위: '', 과목: (row[13] && row[13] !== '-') ? row[13] : '' },
      영어: { 원점수: '', 등급: row[18] || '' },
      한국사: { 원점수: '', 등급: row[22] || '' },
      사회탐구: { 원점수: '', 표준점수: socialScore, 백분위: '', 과목: socialName },
      과학탐구: { 원점수: '', 표준점수: scienceScore, 백분위: '', 과목: scienceName },
      // 탐구1/탐구2를 원래 순서·과목명 그대로 보관 (사회 2과목을 본 학생도 잃지 않도록).
      // 분석은 위의 사회탐구/과학탐구를 쓰고, 이 목록은 대교협 자료 내보내기 등에서 쓴다.
      탐구목록: [[row[26], row[27], explore1Cat], [row[29], row[30], explore2Cat]]
        .filter(([name, score]) => name && name !== '-' && score && score !== '-')
        .map(([name, score, cat]) => ({ 과목: specificName(name), 분류: cat, 원점수: '', 표준점수: score, 백분위: '', 등급: '' }))
    });
  }
  return data;
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
    html += `<td class="no-copy">${row.학년}</td><td class="no-copy">${row.반}</td><td class="no-copy">${row.번호}</td><td class="no-copy">${row.이름}</td>`;
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
  const hasGradeCuts = (typeof gradeCuts !== 'undefined') &&
    gradeCuts.target.std.korean.length > 0 && gradeCuts.target.std.math.length > 0;

  card.classList.remove('hidden');
  if (hasGradeCuts) {
    card.innerHTML = `
      <div class="upload-summary-info">
        <strong>${fileName}</strong> &mdash; ${data.length}명 (${gradeText || '학년 정보 없음'})
      </div>
      <button class="upload-next-btn" onclick="showSection('analyze')">
        바로 분석하러 가기
      </button>
    `;
    // 이미 등급컷이 있으므로 자동으로 분석 화면까지 진행 (최신 데이터로 다시 렌더링)
    if (typeof showSection === 'function') showSection('analyze');
    if (typeof window.initAnalyzeTabs === 'function') window.initAnalyzeTabs();
  } else {
    card.innerHTML = `
      <div class="upload-summary-info">
        <strong>${fileName}</strong> &mdash; ${data.length}명 (${gradeText || '학년 정보 없음'})
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
    html += `<td class="no-copy">${row.학년}</td><td class="no-copy">${row.반}</td><td class="no-copy">${row.번호}</td><td class="no-copy">${row.이름}</td>`;
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
