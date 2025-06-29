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
      showMessage('CSV 파일이 업로드 및 파싱되었습니다.');
      hideLoading();
    };
    reader.readAsText(file, 'euc-kr');
  } else if (ext === 'xlsx') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});
      csvData = rows;
      parsedData = parseXlsxRows(rows); // 임시 저장
      displayParsedTable(parsedData);
      showMessage('XLSX 파일이 업로드 및 파싱되었습니다.');
      hideLoading();
    };
    reader.readAsArrayBuffer(file);
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
    data.push({
      학년: grade,
      반: classNum,
      번호: number,
      이름: row[1] || '',
      국어: { 원점수: row[5] || '', 표준점수: row[6] || '', 백분위: row[7] || '' },
      수학: { 원점수: row[9] || '', 표준점수: row[10] || '', 백분위: row[11] || '' },
      영어: { 원점수: row[13] || '' },
      한국사: { 원점수: row[25] || '' },
      사회탐구: { 원점수: row[16] || '', 표준점수: row[17] || '', 백분위: row[18] || '' },
      과학탐구: { 원점수: row[21] || '', 표준점수: row[22] || '', 백분위: row[23] || '' }
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
