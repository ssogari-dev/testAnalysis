// ===============================================================================
// 성적 분석 및 등급컷 관리 시스템
// 전국연합학력평가 1학년 성적 데이터 분석을 위한 JavaScript 모듈
// ===============================================================================

// ------------------- 탭 UI 및 전역 변수 -------------------
// 성적 분석 탭 상태 관리 변수들
let analyzeTab = 'all'; // 현재 활성화된 탭 ('all': 전체분석, 'compare': 비교분석, 'list': 학생명단)
let compareParsedData = []; // 비교용 파일에서 파싱된 학생 데이터 배열
let compareFileName = ''; // 업로드된 비교 파일명

/**
 * 성적 분석 탭 전환 함수
 * @param {string} tab - 전환할 탭 ID ('all', 'compare', 'list')
 */
function switchAnalyzeTab(tab) {
  analyzeTab = tab;
  // 모든 탭 버튼에서 active 클래스 제거
  document.querySelectorAll('.analyze-tab-btn').forEach(btn => btn.classList.remove('active'));
  // 선택된 탭 버튼에 active 클래스 추가
  document.getElementById('analyzeTabBtn_' + tab).classList.add('active');
  // 모든 섹션 숨기기
  document.querySelectorAll('.analyze-section').forEach(sec => sec.style.display = 'none');
  // 선택된 섹션만 표시
  document.getElementById('analyzeSection_' + tab).style.display = '';
  
  // 탭별 초기화 함수 실행
  if (tab === 'all') window.analyzeAll(); // 전체 성적 분석 실행
  if (tab === 'compare') resetCompareTab(); // 비교 분석 탭 초기화
  if (tab === 'list') renderStudentList(); // 학생 명단 렌더링
}

// ------------------- 등급컷 표 생성 및 입력 관리 -------------------
/**
 * 등급컷 입력 테이블 초기화 함수
 * 원점수와 표준점수 등급컷 입력 폼을 동적으로 생성
 */
function initCutTable() {
  const cutTable = document.getElementById('cutInputTable');
  const cut = gradeCuts.target; // 대상 등급컷 데이터 참조
  
  // 원점수 등급컷 테이블 HTML 생성
  let html = `
    <div style="display:flex;gap:32px;flex-wrap:wrap;">
      <div>
        <h4 style="margin-bottom:6px;">원점수 등급컷</h4>
        <table>
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
          <tbody>
  `;
  
  // 1~8등급 원점수 입력 필드 생성
  for (let i = 1; i <= 8; i++) {
    html += `
      <tr>
        <td class="no-copy">${i}등급</td>
        <td><input type="number" id="raw_korean${i}" required placeholder="점수" value="${cut.raw.korean[i-1]||''}"></td>
        <td><input type="number" id="raw_math${i}" required placeholder="점수" value="${cut.raw.math[i-1]||''}"></td>
        <td><input type="number" id="raw_social${i}" required placeholder="점수" value="${cut.raw.social[i-1]||''}"></td>
        <td><input type="number" id="raw_science${i}" required placeholder="점수" value="${cut.raw.science[i-1]||''}"></td>
        <td>${cut.raw.history?.[i-1]??''}</td>
        <td>${cut.raw.english?.[i-1]??''}</td>
      </tr>
    `;
  }
  
  // 표준점수 등급컷 테이블 HTML 생성 (한국사, 영어 제외)
  html += `
          </tbody>
        </table>
      </div>
      <div>
        <h4 style="margin-bottom:6px;">표준점수 등급컷</h4>
        <table>
          <thead>
            <tr>
              <th class="no-copy">등급</th>
              <th>국어</th>
              <th>수학</th>
              <th>사회탐구<br>(탐구1)</th>
              <th>과학탐구<br>(탐구2)</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  // 1~8등급 표준점수 입력 필드 생성
  for (let i = 1; i <= 8; i++) {
    html += `
      <tr>
        <td class="no-copy">${i}등급</td>
        <td><input type="number" id="std_korean${i}" required placeholder="점수" value="${cut.std.korean[i-1]||''}"></td>
        <td><input type="number" id="std_math${i}" required placeholder="점수" value="${cut.std.math[i-1]||''}"></td>
        <td><input type="number" id="std_social${i}" required placeholder="점수" value="${cut.std.social[i-1]||''}"></td>
        <td><input type="number" id="std_science${i}" required placeholder="점수" value="${cut.std.science[i-1]||''}"></td>
      </tr>
    `;
  }
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  cutTable.innerHTML = html;
}

// ------------------- 등급컷 적용 및 저장 -------------------
/**
 * 입력된 등급컷 데이터를 전역 변수에 저장하는 함수
 * 사용자가 입력한 원점수/표준점수 등급컷을 gradeCuts.target에 저장
 */
window.applyCut = function() {
  showLoading();
  setTimeout(() => {
    const cut = gradeCuts.target;
    
    // 1~8등급 원점수 및 표준점수 등급컷 저장
    for (let i = 1; i <= 8; i++) {
      // 원점수 등급컷 저장
      cut.raw.korean[i-1] = Number(document.getElementById('raw_korean'+i).value);
      cut.raw.math[i-1] = Number(document.getElementById('raw_math'+i).value);
      cut.raw.social[i-1] = Number(document.getElementById('raw_social'+i).value);
      cut.raw.science[i-1] = Number(document.getElementById('raw_science'+i).value);
      
      // 표준점수 등급컷 저장
      cut.std.korean[i-1] = Number(document.getElementById('std_korean'+i).value);
      cut.std.math[i-1] = Number(document.getElementById('std_math'+i).value);
      cut.std.social[i-1] = Number(document.getElementById('std_social'+i).value);
      cut.std.science[i-1] = Number(document.getElementById('std_science'+i).value);
    }
    
    showMessage('등급컷이 저장되었습니다. 데이터 분석에 적용됩니다.');
    hideLoading();
  }, 300);
};

// ------------------- EBSi 등급컷 HTML 파싱 및 추출 -------------------
/**
 * EBSi 웹사이트에서 복사한 HTML에서 등급컷 데이터를 추출하는 함수
 * @param {string} html - EBSi에서 복사한 등급컷 테이블 HTML
 * @param {string} tab - 저장할 등급컷 타입 ('target' 또는 'compare')
 */
window.parseEBSiGradeCutHtml = function(html, tab = 'target') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 과목명 매핑 (한글 → 영문 키)
  const subjMap = { '국어':'korean', '수학':'math', '영어':'english', '한국사':'history' };
  
  // 등급컷 배열 초기화
  ['korean','math','english','history'].forEach(subj=>{
    gradeCuts[tab].raw[subj] = [];
    gradeCuts[tab].std[subj] = [];
  });
  
  // HTML에서 과목별 등급컷 테이블 파싱
  doc.querySelectorAll('.col_6').forEach(col => {
    const subjKor = col.querySelector('h3')?.textContent.trim();
    const subj = subjMap[subjKor];
    if (!subj) return;
    
    const trs = col.querySelectorAll('tbody tr');
    let rawArr = [], stdArr = [];
    
    // 1~8등급 등급컷 추출
    for (let i = 1; i <= 8; i++) {
      const tr = trs[i];
      if (!tr) continue;
      const tds = tr.querySelectorAll('td');
      rawArr.push(Number(tds[2]?.textContent.trim() || 0)); // 원점수
      stdArr.push(Number(tds[3]?.textContent.trim() || 0)); // 표준점수
    }
    
    gradeCuts[tab].raw[subj] = rawArr;
    gradeCuts[tab].std[subj] = stdArr;
  });
  
  showMessage('붙여넣은 등급컷에서 원점수/표준점수 등급컷을 모두 추출했습니다.');
  initCutTable();
};

// ------------------- EBSi 등급컷 자동 불러오기 시스템 -------------------
/**
 * EBSi 웹사이트에서 시험 목록을 동적으로 불러와 드롭다운 메뉴를 생성하는 함수
 * 연도/학년/시험별 등급컷 데이터를 자동으로 가져올 수 있도록 함
 */
window.fetchEBSiCuts = async function() {
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
    showMessage('EBSi 시험 목록 불러오기 중 오류가 발생했습니다.' + e.message);
    console.error(e);
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
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px;">
      <label>
        <select id="ebsiYear" style="min-width:90px" onchange="updateGradeOptions()">
          <option value="">연도선택</option>
          ${Object.keys(examData).map(year => `<option value="${year}">${year}년</option>`).join('')}
        </select>
      </label>
      <label>
        <select id="ebsiGrade" style="min-width:70px" onchange="updateExamOptions()">
          <option value="">학년선택</option>
          <option value="D100">1학년</option>
          <option value="D200">2학년</option>
          <option value="D300">3학년</option>
        </select>
      </label>
      <label>
        <select id="ebsiExam" style="min-width:120px">
          <option value="">시험선택</option>
        </select>
      </label>
      <button type="button" class="copy-btn" onclick="loadEbsiGradeCuts()">등급컷 불러오기</button>
      <button onclick="showPastePopup()" class="copy-btn" style="margin-left:8px;">EBSi HTML 붙여넣기</button>
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
  const irecord = document.getElementById('ebsiExam').value;
  
  // 필수 선택 항목 검증
  if (!year || !grade || !irecord) {
    showMessage('연도, 학년, 시험을 모두 선택하세요.');
    return;
  }
  
  showLoading();
  
  // EBSi API 요청 설정 (과목별로 분리된 요청)
  const reqs = [
    {subjectId: '17012,17014,17020,110001', ord: 1, key: 'main'}, // 국어,수학,영어,한국사
    {subjectId: '140072', ord: 2, key: 'social'}, // 사회탐구
    {subjectId: '140073', ord: 3, key: 'science'} // 과학탐구
  ];
  
  let cuts = { korean: [], math: [], english: [], history: [], social: [], science: [] };
  let stds = { korean: [], math: [], english: [], history: [], social: [], science: [] };
  
  try {
    // 과목별로 등급컷 데이터 요청
    for (const req of reqs) {
      const form = new URLSearchParams();
      form.append('subjectId', req.subjectId);
      form.append('irecord', irecord);
      form.append('ord', req.ord);
      
      const res = await fetch('https://www.ebsi.co.kr/ebs/xip/xipa/retrieveGrdCutList.ajax', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: form.toString()
      });
      
      const html = await res.text();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      // 메인 과목 (국어, 수학, 영어, 한국사) 처리
      if (req.key === 'main') {
        const col6s = temp.querySelectorAll('.col_6');
        ['korean','math','english','history'].forEach((subj, idx) => {
          const trs = col6s[idx]?.querySelectorAll('tbody tr');
          cuts[subj] = [];
          stds[subj] = [];
          for (let i = 1; i <= 8; i++) {
            cuts[subj][i-1] = Number(trs?.[i]?.children[2]?.innerText || 0);
            stds[subj][i-1] = Number(trs?.[i]?.children[3]?.innerText || 0);
          }
        });
      } 
      // 탐구 과목 처리
      else if (req.key === 'social' || req.key === 'science') {
        const col6 = temp.querySelector('.col_6');
        const trs = col6?.querySelectorAll('tbody tr');
        cuts[req.key] = [];
        stds[req.key] = [];
        for (let i = 1; i <= 8; i++) {
          cuts[req.key][i-1] = Number(trs?.[i]?.children[2]?.innerText || 0);
          stds[req.key][i-1] = Number(trs?.[i]?.children[3]?.innerText || 0);
        }
      }
    }
    
    // 불러온 등급컷 데이터를 전역 변수에 저장
    const cut = gradeCuts.target;
    ['korean','math','english','history','social','science'].forEach(subj => {
      cut.raw[subj] = cuts[subj] || [];
      cut.std[subj] = stds[subj] || [];
    });
    
    // 연도 정보 저장
    cut.year = year;
    
    // 등급컷 테이블 업데이트
    initCutTable();
    showMessage(`EBSi에서 등급컷을 불러와 입력란에 반영했습니다.\n아래의 적용 버튼을 눌러주십시오.`);
  } catch (e) {
    showMessage('EBSi 등급컷 불러오기 중 오류가 발생했습니다.' + e.message);
    console.error(e);
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
function getGradeDistByCut(parsed, subject, rawCuts, stdCuts) {
  const useStd = (window.uploadedFileExt === 'xlsx'); // 파일 형식에 따른 점수 타입 결정
  let cuts, scoreField;
  
  // 파일 형식과 과목에 따른 등급컷 및 점수 필드 결정
  if (useStd) {
    // XLSX: 영어/한국사는 원점수, 나머지는 표준점수 사용
    if (subject === '영어' || subject === '한국사') {
      cuts = rawCuts;
      scoreField = '원점수';
    } else {
      cuts = stdCuts;
      scoreField = '표준점수';
    }
  } else {
    // CSV: 모든 과목 원점수 사용
    cuts = rawCuts;
    scoreField = '원점수';
  }
  
  // 등급컷 데이터 유효성 검사
  if (!Array.isArray(cuts) || cuts.length < 2) {
    return { dist: Array(9).fill(0), ratio: Array(9).fill('0'), total: 0 };
  }
  
  let dist = Array(9).fill(0); // 1~9등급 인원수 배열
  let total = 0; // 총 인원수
  
  // 각 학생의 점수를 등급컷과 비교하여 등급 산출
  parsed.forEach(s => {
    const score = Number(s[subject]?.[scoreField] ?? NaN);
    if (!isNaN(score)) {
      let grade = 9; // 기본값: 9등급
      
      // 1~8등급 등급컷과 비교 (높은 등급부터)
      for (let i = 0; i < 8; i++) {
        if (score >= (cuts[i] || 0)) {
          grade = i + 1;
          break;
        }
      }
      
      dist[grade - 1]++; // 해당 등급 인원수 증가
      total++; // 총 인원수 증가
    }
  });
  
  // 등급별 비율 계산 (백분율)
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
function get12GradeByCut(parsed, subject, rawCuts, stdCuts) {
  const useStd = (window.uploadedFileExt === 'xlsx');
  let cuts, scoreField;
  
  // 파일 형식에 따른 점수 타입 결정
  if (useStd) {
    if (subject === '영어' || subject === '한국사') {
      cuts = rawCuts;
      scoreField = '원점수';
    } else {
      cuts = stdCuts;
      scoreField = '표준점수';
    }
  } else {
    cuts = rawCuts;
    scoreField = '원점수';
  }
  
  if (!Array.isArray(cuts) || cuts.length < 2) {
    return { cnt: 0, ratio: '0', total: 0, sum: '0 / 0' };
  }
  
  let dist = Array(9).fill(0);
  let total = 0;
  
  // 등급 산출 및 집계
  parsed.forEach(s => {
    const score = Number(s[subject]?.[scoreField] ?? NaN);
    if (!isNaN(score)) {
      let grade = 9;
      for (let i = 0; i < 8; i++) {
        if (score >= (cuts[i] || 0)) { 
          grade = i+1; 
          break; 
        }
      }
      dist[grade-1]++;
      total++;
    }
  });
  
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
    
    const scoreTypes = ['원점수', '표준점수', '백분위'];
    const subjects = ['국어', '수학'];
    const statsLabels = [
      {label: '전체 평균', key: 'avg'},
      {label: '상위 10% 평균', key: 'top10'},
      {label: '상위 20% 평균', key: 'top20'},
      {label: '상위 30% 평균', key: 'top30'}
    ];
    
    let html = '';
    
    scoreTypes.forEach((scoreType, idx) => {
      html += `<h3>${scoreType} 기준 통계</h3>`;
      html += `<button class="copy-btn" onclick="showScoreDistributionChart('${scoreType}')">그래프 보기</button>`;
      html += `<table class="stats-table"><thead><tr><th>구분</th>`;
      subjects.forEach(subj => html += `<th>${subj} 영역</th>`);
      html += `</tr></thead><tbody>`;
      
      statsLabels.forEach(stat => {
        html += `<tr><td>${stat.label}</td>`;
        subjects.forEach(subj => {
          const arr = parsedData.map(s => Number(s[subj]?.[scoreType])).filter(n => !isNaN(n));
          arr.sort((a,b) => b-a);
          let value = '-';
          if (arr.length) {
            if (stat.key === 'avg') {
              value = (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2);
            }
            else if (stat.key === 'top10') {
              const top10Count = Math.ceil(arr.length*0.1);
              value = (arr.slice(0,top10Count).reduce((a,b)=>a+b,0)/top10Count).toFixed(2);
            }
            else if (stat.key === 'top20') {
              const top20Count = Math.ceil(arr.length*0.2);
              value = (arr.slice(0,top20Count).reduce((a,b)=>a+b,0)/top20Count).toFixed(2);
            }
            else if (stat.key === 'top30') {
              const top30Count = Math.ceil(arr.length*0.3);
              value = (arr.slice(0,top30Count).reduce((a,b)=>a+b,0)/top30Count).toFixed(2);
            }
          }
          html += `<td>${value}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      
      // 그래프 컨테이너 추가
      html += `<div id="chart_${scoreType}" style="display:none; margin-top:20px;">
        <canvas id="canvas_${scoreType}_korean" width="400" height="200"></canvas>
        <canvas id="canvas_${scoreType}_math" width="400" height="200"></canvas>
        <button class="copy-btn" onclick="hideChart('chart_${scoreType}')">그래프 숨기기</button>
      </div>`;
    });
    
    container.innerHTML = html;
  }
  

// ------------------- 전체 성적 분석 메인 함수 -------------------
/**
 * 전체 성적 분석 탭의 모든 테이블과 통계를 생성하는 메인 함수
 * 응시자 현황, 등급컷 정보, 통계, 등급별 인원 현황 등을 종합적으로 분석
 */
window.analyzeAll = async function() {
  showLoading();
  
  setTimeout(() => {
    const parsed = parsedData;
    const useStd = (window.uploadedFileExt === 'xlsx');

    /**
     * 영역별 응시자 현황을 계산하는 내부 함수
     * @param {Array} parsed - 파싱된 학생 데이터
     * @returns {Array} 과목별 응시자 수와 비율 정보
     */
    function getExamStatus(parsed) {
      const total = parsed.filter(s => s.한국사.원점수 && s.한국사.원점수 !== '').length;
      const kor = parsed.filter(s => s.국어.원점수 && s.국어.원점수 !== '').length;
      const math = parsed.filter(s => s.수학.원점수 && s.수학.원점수 !== '').length;
      const eng = parsed.filter(s => s.영어.원점수 && s.영어.원점수 !== '').length;
      
      return [
        { name: '한국사', count: total, ratio: '100.00' },
        { name: '국어', count: kor, ratio: total ? (kor/total*100).toFixed(2) : '0.00' },
        { name: '수학', count: math, ratio: total ? (math/total*100).toFixed(2) : '0.00' },
        { name: '영어', count: eng, ratio: total ? (eng/total*100).toFixed(2) : '0.00' }
      ];
    }

    // 1. 영역별 응시자 현황 테이블
    let html = `<h3>1. 영역별 응시자 현황</h3>
    <table id="examStatusTable"><thead>
      <tr>
        <th class="no-copy" rowspan="2">구분</th>
        <th>한국사영역</th>
        <th>국어영역</th>
        <th>수학영역</th>
        <th>영어영역</th>
      </tr>
      <tr>
        <th> </th><th> </th><th> </th><th> </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="no-copy">응시인원<br>및 비율</td>
        ${getExamStatus(parsed).map(s=>`<td>${s.count}<br>(${s.ratio})</td>`).join('')}
      </tr>
      <tr>
        <td class="no-copy">합계</td>
        ${getExamStatus(parsed).map(s=>`<td>${s.count} (${s.ratio.split('.')[0]})</td>`).join('')}
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
    html += `<h3>6. 국어, 수학, 영어 영역별 등급 인원 현황</h3>
    <button class="copy-btn" onclick="showGradePieCharts()">그래프 보기</button>
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
    for(let g=1;g<=9;g++){
      html += `<tr><td class="no-copy">${g}등급</td>`;
      html += `<td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).dist[g-1]}</td><td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).ratio[g-1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).dist[g-1]}</td><td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).ratio[g-1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).dist[g-1]}</td><td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).ratio[g-1]}</td>`;
      html += `</tr>`;
    }
    
    // 합계 행
    html += `<tr><td class="no-copy">합계</td>`;
    html += `<td>${getGradeDistByCut(parsed, '국어', gradeCuts.target.raw.korean, gradeCuts.target.std.korean).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '수학', gradeCuts.target.raw.math, gradeCuts.target.std.math).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '영어', gradeCuts.target.raw.english, gradeCuts.target.std.english).total}</td><td>100</td>`;
    html += `</tr></tbody></table>`;

    html += `</table>
<div id="gradeCharts" style="display:none; margin-top:20px;">
  <div style="display:flex; gap:20px; flex-wrap:wrap;">
    <div><h4>국어</h4><canvas id="koreanGradeChart" width="300" height="300"></canvas></div>
    <div><h4>수학</h4><canvas id="mathGradeChart" width="300" height="300"></canvas></div>
    <div><h4>영어</h4><canvas id="englishGradeChart" width="300" height="300"></canvas></div>
  </div>
  <button class="copy-btn" onclick="hideChart('gradeCharts')">그래프 숨기기</button>
</div>`;

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
    html += `<h3>8. 탐구 과목 영역별 등급 인원 현황</h3>
    <button class="copy-btn" onclick="showExploreGradePieCharts()">그래프 보기</button>
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
    
    for(let g=1;g<=9;g++){
      html += `<tr><td class="no-copy">${g}등급</td>`;
      html += `<td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).dist[g-1]}</td><td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).ratio[g-1]}</td>`;
      html += `<td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).dist[g-1]}</td><td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).ratio[g-1]}</td>`;
      html += `</tr>`;
    }
    
    html += `<tr><td class="no-copy">합계</td>`;
    html += `<td>${getGradeDistByCut(parsed, '사회탐구', gradeCuts.target.raw.social, gradeCuts.target.std.social).total}</td><td>100</td>`;
    html += `<td>${getGradeDistByCut(parsed, '과학탐구', gradeCuts.target.raw.science, gradeCuts.target.std.science).total}</td><td>100</td>`;
    html += `</tr></tbody></table>`;

    html += `</table>
<div id="exploreCharts" style="display:none; margin-top:20px;">
  <div style="display:flex; gap:20px; flex-wrap:wrap;">
    <div><h4>사회탐구</h4><canvas id="socialGradeChart" width="300" height="300"></canvas></div>
    <div><h4>과학탐구</h4><canvas id="scienceGradeChart" width="300" height="300"></canvas></div>
  </div>
  <button class="copy-btn" onclick="hideChart('exploreCharts')">그래프 숨기기</button>
</div>`;

    // HTML을 페이지에 적용
    document.getElementById('analyzeSection_all').innerHTML = html;

    // 3~5번 통계 표들을 별도 렌더링
    renderOverallStatsTables();

    hideLoading();
  }, 300);
};

// ------------------- 비교 성적 분석 시스템 -------------------
/**
 * 비교 성적 분석 탭을 초기화하는 함수
 * 파일 업로드 UI와 각종 테이블들을 초기 상태로 설정
 */
function resetCompareTab() {
  renderEbsiCutLoaderUI(); // EBSi 등급컷 불러오기 UI 생성
  renderCompareGradeTable(); // 등급컷 비교 테이블 초기화
  renderCompareStatsTables(); // 통계 비교 테이블 초기화
  renderGradeDistTable(); // 등급별 인원 비교 테이블 초기화
  renderGrade12RatioTable(); // 1,2등급 비율 비교 테이블 초기화
  
  // 비교 데이터 초기화
  compareParsedData = [];
  compareFileName = '';
  
  // UI 요소들 초기화
  const uploadInput = document.getElementById('compareUploadInput');
  if (uploadInput) uploadInput.value = '';
  const showBtn = document.getElementById('showCompareBtn');
  if (showBtn) showBtn.disabled = true;
  const result = document.getElementById('compareResult');
  if (result) result.innerHTML = '';
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
window.handleCompareFile = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  compareFileName = file.name;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  
  reader.onload = function(ev) {
    let rows;
    if (ext === 'xlsx') {
      // XLSX 파일 처리
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});
      compareParsedData = parseCompareXlsxRows(rows);
      
      // 파일 업로드 성공 시 버튼 활성화
      document.getElementById('showCompareBtn').disabled = false;
      showMessage(`비교 파일이 업로드되었습니다: ${compareFileName}`);
    } else {
      // XLSX 파일이 아닌 경우 오류 메시지
      showMessage("xlsx 파일만 업로드 가능합니다!\nExcel에서 다른 이름으로 저장하기를 통해\nxlsx 파일로 저장 후 업로드해주세요.");
      compareParsedData = [];
      document.getElementById('showCompareBtn').disabled = true;
    }
  };
  
  reader.readAsArrayBuffer(file);
};

/**
 * 비교 분석 결과를 화면에 렌더링하는 함수
 */
function renderCompareResult() {
  if (!compareParsedData.length) {
    document.getElementById('compareResult').innerHTML = '<p>비교 파일을 업로드하세요.</p>';
    return;
  }
  
  document.getElementById('compareResult').innerHTML = `<div style="margin-bottom:10px;"><b>비교 파일:</b> ${compareFileName}</div>`;

  // 각종 비교 테이블들 렌더링
  renderCompareGradeTable(); // 등급컷 비교 테이블
  renderCompareStatsTables(); // 통계 비교 테이블
  renderGradeDistTable(); // 등급별 인원 비교 테이블
  renderGrade12RatioTable(); // 1,2등급 비율 비교 테이블
}

// ------------------- EBSi 비교용 등급컷 불러오기 -------------------
// 비교 분석용 EBSi 등급컷 데이터 저장 변수
let ebsiCompareCuts = {
  korean: [], // 국어 등급컷
  math: []    // 수학 등급컷
};

/**
 * 비교 분석용 EBSi 등급컷 불러오기 UI를 동적으로 생성하는 함수
 */
function renderEbsiCutLoaderUI() {
  const container = document.getElementById('analyzeSection_compare');
  if (!container) return;
  
  // 기존 UI 요소들 제거
  const prev = document.getElementById('ebsiCutLoader');
  if (prev) prev.remove();
  const prevStatus = document.getElementById('ebsiCutStatus');
  if (prevStatus) prevStatus.remove();
  
  // 새로운 UI 요소 생성
  const div = document.createElement('div');
  div.id = 'ebsiCutLoader';
  div.style.marginBottom = '18px';
  div.innerHTML = `
    <label>연도:
      <select id="ebsiYearSelect" style="min-width:90px"></select>
    </label>
    <label>학년:
      <select id="ebsiGradeSelect" disabled style="min-width:70px">
        <option value="1" selected>1학년</option>
      </select>
    </label>
    <label>월:
      <select id="ebsiMonthSelect" style="min-width:70px"></select>
    </label>
    <button type="button" id="ebsiCutFetchBtn" class="copy-btn" style="margin-left:8px">EBSi 등급컷 불러오기</button>
  `;
  
  container.prepend(div);
  
  // 상태 표시 div 생성
  const statusDiv = document.createElement('div');
  statusDiv.id = 'ebsiCutStatus';
  statusDiv.style.color = '#888';
  statusDiv.style.fontSize = '0.97em';
  statusDiv.style.marginBottom = '8px';
  container.insertBefore(statusDiv, div.nextSibling);
  
  // 초기화 함수들 실행
  setTimeout(() => {
    loadEbsiYearList();
    document.getElementById('ebsiCutFetchBtn').onclick = fetchEbsiCompareCuts;
  }, 0);
}

/**
 * EBSi에서 사용 가능한 연도 목록을 불러오는 함수
 */
async function loadEbsiYearList() {
  const sel = document.getElementById('ebsiYearSelect');
  sel.innerHTML = '<option>로딩중...</option>';
  
  try {
    const res = await fetch('https://www.ebsi.co.kr/ebs/xip/xipa/retrievePastGrdCutYearList.ajax', { 
      method: 'POST' 
    });
    const data = await res.json();
    sel.innerHTML = '';
    
    // 연도 옵션들 추가
    data.result.forEach(y => {
      sel.innerHTML += `<option value="${y.code}">${y.value-1}</option>`;
    });
    
    sel.onchange = loadEbsiMonthList; // 연도 변경 시 월 목록 업데이트
    loadEbsiMonthList(); // 초기 월 목록 로드
  } catch (e) {
    showMessage("EBSi 등급컷 불러오기 중 오류가 발생했습니다." + e.message);
  }
}

/**
 * 선택된 연도에 해당하는 월 목록을 불러오는 함수
 */
async function loadEbsiMonthList() {
  const year = document.getElementById('ebsiYearSelect').value;
  const sel = document.getElementById('ebsiMonthSelect');
  sel.innerHTML = '<option>로딩중...</option>';
  
  try {
    const res = await fetch('https://www.ebsi.co.kr/ebs/xip/xipa/retrievePastGrdCutMonthList.ajax', {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: `year=${year}&stdntGrd=1`
    });
    const data = await res.json();
    sel.innerHTML = '';
    
    // 월 옵션들 추가
    data.result.forEach(m => {
      sel.innerHTML += `<option value="${m.code}">${m.value}월</option>`;
    });
  } catch (e) {
    showMessage("EBSi 등급컷 불러오기 중 오류가 발생했습니다." + e.message);
  }
}

/**
 * EBSi 등급컷 HTML에서 국어/수학 등급컷을 파싱하는 함수
 * @param {string} html - EBSi에서 받은 등급컷 HTML
 * @returns {Object} 파싱된 국어/수학 등급컷 데이터
 */
function parseEbsiCutHtml(html) {
  const kor = [];
  const math = [];
  
  try {
    const div = document.createElement('div');
    div.innerHTML = html;
    const tables = div.querySelectorAll('.col_6 table');
    
    // 국어 등급컷 추출
    if (tables[0]) {
      const trs = tables[0].querySelectorAll('tbody tr');
      for (let i = 1; i <= 9; i++) {
        const row = Array.from(trs).find(tr => tr.children[0].innerText.trim() === String(i));
        if (row) kor.push(Number(row.children[2].innerText.trim()) || 0);
      }
    }
    
    // 수학 등급컷 추출
    if (tables[1]) {
      const trs = tables[1].querySelectorAll('tbody tr');
      for (let i = 1; i <= 9; i++) {
        const row = Array.from(trs).find(tr => tr.children[0].innerText.trim() === String(i));
        if (row) math.push(Number(row.children[2].innerText.trim()) || 0);
      }
    }
  } catch(e) {
    showMessage("EBSi 등급컷 불러오기 중 오류가 발생했습니다.\n" + e.message);
  }
  return { korean: kor, math: math };
}
/**
 * 비교용 EBSi 등급컷을 불러와서 저장하는 함수
 */
async function fetchEbsiCompareCuts() {
    const year = document.getElementById('ebsiYearSelect').value;
    const month = document.getElementById('ebsiMonthSelect').value;
    const status = document.getElementById('ebsiCutStatus');
    showLoading();
    
    try {
      const res = await fetch('https://www.ebsi.co.kr/ebs/xip/xipa/retrievePastGrdCutList.ajax', {
        method: 'POST',
        headers: {
          'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: `year=${year}&stdntGrd=1&month=${month}&subjCd=4203,3103,1103,2105`
      });
      const html = await res.text();
      const cuts = parseEbsiCutHtml(html);
      hideLoading();
      
      if (cuts.korean.length < 3 || cuts.math.length < 3) throw new Error('등급컷 파싱 실패');
      
      ebsiCompareCuts.korean = cuts.korean;
      ebsiCompareCuts.math = cuts.math;
      showMessage(`EBSi에서 ${year-1}년 ${month}월 등급컷을 불러왔습니다.`);
      
      // 비교 테이블들 업데이트
      renderCompareGradeTable();
      renderCompareStatsTables();
      renderGradeDistTable();
      renderGrade12RatioTable();
    } catch (e) {
      showMessage("EBSi 등급컷 불러오기 중 오류가 발생했습니다." + e.message);
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
    const compareKor = ebsiCompareCuts.korean || [];
    const compareMath = ebsiCompareCuts.math || [];
    
    let html = `<table class="grade-compare-table" style="margin-top:18px">
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
        <td>${targetKor[i-1] ?? '-'}</td>
        <td>${compareKor[i-1] ?? '-'}</td>
        <td>${targetMath[i-1] ?? '-'}</td>
        <td>${compareMath[i-1] ?? '-'}</td>
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
      {label: '전체 평균', key: 'avg'},
      {label: '상위 10% 평균', key: 'top10'},
      {label: '상위 20% 평균', key: 'top20'},
      {label: '상위 30% 평균', key: 'top30'}
    ];
    
    const targetYear = getTargetYear();
    const compareYear = document.getElementById('ebsiYearSelect')?.value-1 || '비교';
    
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
          const v1 = getSubjectStat(parsedData, subj, scoreType, stat.key);
          const v2 = getSubjectStat(compareParsedData, subj, scoreType, stat.key);
          html += `<td>${v1 ?? '-'}</td><td>${v2 ?? '-'}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      statsContainer.innerHTML += html;
    });
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
  const subjectMap = {'국어': 'korean', '수학': 'math', '영어': 'english'};
  const grades = [1,2,3,4,5,6,7,8,9];
  
  let html = `<h3>등급별 인원 현황</h3>`;
  html += `<button class="copy-btn" onclick="showComparisonBarCharts()">그래프 보기</button>`;
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
        // 기준 파일: 등급컷 기준 (올바른 키 사용)
        const base = getGradeDistByCut(parsedData, subj, gradeCuts.target.raw[subjKey], gradeCuts.target.std[subjKey]);
        // 비교 파일: 학생 등급 필드 기준
        const comp = getGradeDistByRecordedGrade(compareParsedData, subj);
        html += `<td>${base.dist[g-1] ?? '-'} / ${comp.dist[g-1] ?? '-'}</td><td>${base.ratio[g-1] ?? '-'} / ${comp.ratio[g-1] ?? '-'}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    html += `</table>
  <div id="comparisonCharts" style="display:none; margin-top:20px;">
    <div style="display:flex; gap:20px; flex-wrap:wrap;">
      <div><h4>국어</h4><canvas id="compareKoreanChart" width="400" height="300"></canvas></div>
      <div><h4>수학</h4><canvas id="compareMathChart" width="400" height="300"></canvas></div>
      <div><h4>영어</h4><canvas id="compareEnglishChart" width="400" height="300"></canvas></div>
    </div>
    <button class="copy-btn" onclick="hideChart('comparisonCharts')">그래프 숨기기</button>
  </div>`;
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
    const subjectMap = {'국어': 'korean', '수학': 'math', '영어': 'english'};
    
    let html = `<h3>1,2등급 비율</h3>`;
    html += `<button class="copy-btn" onclick="showGrade12ComparisonChart()">그래프 보기</button>`;
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
      const subjKey = subjectMap[subj];
      const v = get12GradeByCut(parsedData, subj, gradeCuts.target.raw[subjKey], gradeCuts.target.std[subjKey]);
      html += `<td>${v.cnt} / ${v.ratio}</td>`;
    });
    html += `</tr>`;
    
    html += `<tr><td>인원 및 비율 (비교)</td>`;
    subjects.forEach(subj => {
      const v = get12GradeByRecordedGrade(compareParsedData, subj);
      html += `<td>${v.cnt} / ${v.ratio}</td>`;
    });
    html += `</tr>`;
    html += `</tbody></table>`;
    html += `</table>
  <div id="grade12Chart" style="display:none; margin-top:20px;">
    <canvas id="grade12ComparisonChart" width="500" height="300"></canvas>
    <button class="copy-btn" onclick="hideChart('grade12Chart')">그래프 숨기기</button>
  </div>`;
  
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
    const scores = data.map(s => Number(s[subject]?.[scoreType] ?? '')).filter(v => !isNaN(v));
    if (!scores.length) return '-';
    
    scores.sort((a, b) => b - a); // 내림차순 정렬
    
    if (statKey === 'avg') {
      return (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2);
    }
    if (statKey === 'top10') {
      const count = Math.ceil(scores.length*0.1);
      return (scores.slice(0, count).reduce((a,b)=>a+b,0)/count).toFixed(2);
    }
    if (statKey === 'top20') {
      const count = Math.ceil(scores.length*0.2);
      return (scores.slice(0, count).reduce((a,b)=>a+b,0)/count).toFixed(2);
    }
    if (statKey === 'top30') {
      const count = Math.ceil(scores.length*0.3);
      return (scores.slice(0, count).reduce((a,b)=>a+b,0)/count).toFixed(2);
    }
    
    return '-';
  }
  
  // ------------------- 학생 명단 관리 시스템 -------------------
  // 학생 명단 관련 전역 변수들
  let studentSortKey = 'sum'; // 정렬 기준
  let studentSortDesc = true; // 정렬 방향 (내림차순)
  let showAllStudents = false; // 전체 학생 표시 여부
  let showStudentDetails = true; // 학년/반/번호 표시 여부
  
  /**
   * 학생 명단을 렌더링하는 함수
   * 정렬, 필터링, 페이징 기능을 포함
   */
  function renderStudentList() {
    // 학생 데이터 가공 및 정렬
    let students = parsedData.map(s => {
      const kor = Number(s.국어?.표준점수||0);
      const math = Number(s.수학?.표준점수||0);
      const eng = Number(s.영어?.원점수||0);
      const soc = Number(s.사회탐구?.표준점수||0);
      const sci = Number(s.과학탐구?.표준점수||0);
      const socGrade = getGrade(s.사회탐구?.표준점수, gradeCuts.target.std.social);
      const sciGrade = getGrade(s.과학탐구?.표준점수, gradeCuts.target.std.science);
      
      return {
        ...s,
        kor, math, eng, soc, sci,
        sum: kor+math+soc+sci, // 표준점수 합계
        explore: soc+sci, // 탐구 합계
        korGrade: getGrade(kor, gradeCuts.target.std.korean),
        mathGrade: getGrade(math, gradeCuts.target.std.math),
        engGrade: getGrade(eng, gradeCuts.target.raw.english),
        exploreGrade: `${socGrade}${sciGrade}`
      };
    });
    
    // 정렬 적용
    students.sort((a,b) => {
      if (studentSortDesc) return (b[studentSortKey]||0)-(a[studentSortKey]||0);
      else return (a[studentSortKey]||0)-(b[studentSortKey]||0);
    });
    
    // HTML 생성 시작
    let html = `
      <div style="margin-bottom: 10px;">
        <label>
          <input type="checkbox" id="showDetailsCheckbox" ${showStudentDetails ? 'checked' : ''} onchange="toggleStudentDetails()">
          학년/반/번호 표시
        </label>
      </div>
      <table id="studentListTable"><thead><tr>`;
    
    // 헤더 생성 (조건부 표시)
    if (showStudentDetails) {
      html += `<th class="no-copy">학년</th><th class="no-copy">반</th><th class="no-copy">번호</th>`;
    }
    html += `<th class="no-copy">이름</th>
      <th class="sortable" onclick="sortStudentList('kor')">국어</th>
      <th class="sortable" onclick="sortStudentList('math')">수학</th>
      <th class="sortable" onclick="sortStudentList('eng')">영어</th>
      <th class="sortable" onclick="sortStudentList('explore')">탐구</th>
      <th class="sortable" onclick="sortStudentList('sum')">표점합</th>
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
      
      html += `<td class="no-copy">${s.이름}</td>
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
      html += `<button onclick="showAllStudents=true;renderStudentList();" class="copy-btn" style="margin-top:12px;">전체(${students.length}명) 보기</button>`;
    } else if (showAllStudents && students.length > 20) {
      html += `<button onclick="showAllStudents=false;renderStudentList();" class="copy-btn" style="margin-top:12px;">처음 20명만 보기</button>`;
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
      if (score >= (cuts[i] || 0)) return i+1;
    }
    return 9;
  }
  
  // ------------------- 탭 UI 초기화 시스템 -------------------
  /**
   * 성적 분석 탭 UI를 초기화하는 함수
   * 페이지 로드 시 자동으로 실행되어 탭 구조를 생성
   */
  window.initAnalyzeTabs = function() {
    // 탭 버튼 HTML 생성
    let tabHtml = `
      <div style="margin-bottom:18px;">
        <button id="analyzeTabBtn_all" class="analyze-tab-btn active" onclick="switchAnalyzeTab('all')">전체 성적 분석</button>
        <button id="analyzeTabBtn_compare" class="analyze-tab-btn" onclick="switchAnalyzeTab('compare')">비교 성적 분석</button>
        <button id="analyzeTabBtn_list" class="analyze-tab-btn" onclick="switchAnalyzeTab('list')">학생 명단</button>
      </div>
    `;
    
    // 섹션 컨테이너 HTML 생성
    let sectionHtml = `
      <div id="analyzeSection_all" class="analyze-section"></div>
      <div id="analyzeSection_compare" class="analyze-section" style="display:none;"></div>
      <div id="analyzeSection_list" class="analyze-section" style="display:none;"></div>
    `;
    
    // HTML을 페이지에 적용
    document.getElementById('analyzeContent').innerHTML = tabHtml + sectionHtml;
  
    // 비교 성적 분석 탭 UI 동적 생성
    document.getElementById('analyzeSection_compare').innerHTML = `
      <input type="file" id="compareUploadInput" accept=".xlsx" onchange="handleCompareFile(event)" />
      <button id="showCompareBtn" class="copy-btn" onclick="renderCompareResult()" disabled>비교 결과 보기</button>
      <div id="compareResult" style="margin-top:18px;"></div>
    `;
  
    // 기본적으로 전체 성적 분석 탭 활성화
    switchAnalyzeTab('all');
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
  function showComparisonBarCharts() {
    document.getElementById('comparisonCharts').style.display = 'block';
    const subjects = ['국어', '수학', '영어'];
    const subjectMap = {'국어': 'korean', '수학': 'math', '영어': 'english'};
    
    subjects.forEach(subj => {
      const subjKey = subjectMap[subj];
      const targetData = getGradeDistByCut(parsedData, subj, gradeCuts.target.raw[subjKey], gradeCuts.target.std[subjKey]);
      const compareData = getGradeDistByRecordedGrade(compareParsedData, subj);
      window.analysisChart.createComparisonBarChart(`compare${subjKey.charAt(0).toUpperCase() + subjKey.slice(1)}Chart`, targetData, compareData, subj);
    });
  }
  
  /**
   * 1,2등급 비율 비교 그래프를 표시하는 함수
   */
  function showGrade12ComparisonChart() {
    document.getElementById('grade12Chart').style.display = 'block';
    const subjects = ['국어', '수학', '영어'];
    const subjectMap = {'국어': 'korean', '수학': 'math', '영어': 'english'};
    
    const targetData = {};
    const compareData = {};
    
    subjects.forEach(subj => {
      const subjKey = subjectMap[subj];
      targetData[subjKey] = get12GradeByCut(parsedData, subj, gradeCuts.target.raw[subjKey], gradeCuts.target.std[subjKey]);
      compareData[subjKey] = get12GradeByRecordedGrade(compareParsedData, subj);
    });
    
    window.analysisChart.createGrade12ComparisonChart('grade12ComparisonChart', targetData, compareData);
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