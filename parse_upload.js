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
  // 업로드 확장자 전역 저장
  try { window.uploadedFileExt = ext; } catch(e) {}
  if (ext === 'xls') {
    showMessage(".xls 파일은 한글이 깨질 수 있습니다. Excel에서 '다른 이름으로 저장'을 통해 .xlsx 형식으로 저장하여 업로드를 권장드립니다.");
    hideLoading();
    return;
  }
  if (ext === 'csv' || ext === 'txt') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.trim().split('\n').map(row => row.split(','));
      csvData = lines;
      parsedData = parseCsvRows(lines); // 임시 저장
      displayParsedTable(parsedData);
      renderUploadSummary(parsedData, file.name);
      showMessage('CSV 파일이 업로드 및 파싱되었습니다.');
      hideLoading();
    };
    reader.readAsText(file, 'euc-kr');
  } else if (ext === 'xlsx') {
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
        showMessage('XLSX 파일이 업로드 및 파싱되었습니다.');
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
            showMessage('XLSX 파일이 업로드 및 파싱되었습니다. (폴백)');
          } catch (e) {
            showMessage('XLSX 파싱 중 오류가 발생했습니다. ' + e.message);
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
          showMessage('XLSX 파일이 업로드 및 파싱되었습니다. (폴백)');
        } catch (e) {
          showMessage('XLSX 파싱 중 오류가 발생했습니다. ' + e.message);
        } finally {
          hideLoading();
        }
      };
      fr.readAsArrayBuffer(file);
    }
  } else {
    showMessage('지원하지 않는 파일 형식입니다.');
    hideLoading();
  }
};

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
      과학탐구: { 원점수: row[21] || '', 표준점수: row[22] || '', 백분위: row[23] || '', 등급: row[24] || '' }
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
    html += `<td>${row.영어.원점수}</td>`;
    html += `<td>${row.한국사.원점수}</td>`;
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
  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="upload-summary-info">
      <strong>${fileName}</strong> &mdash; ${data.length}명 (${gradeText || '학년 정보 없음'})
    </div>
    <button class="upload-next-btn" onclick="showSection('cut')">
      등급컷 입력하러 가기
    </button>
  `;
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
