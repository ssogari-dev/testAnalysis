// ------------------- 팝업/로딩/네비/전역 데이터 -------------------
function showSection(id) {
    if (!checkAccessPermission(id)) {
        return; // 접근 차단
    }

    document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const idx = {upload:0,cut:1,view:2,analyze:3,compare:4}[id];
    document.querySelectorAll('nav button')[idx].classList.add('active');
    if (id === 'cut' && typeof initCutTable === 'function') initCutTable();
    if (id === 'cut' && typeof fetchEBSiCuts === 'function') fetchEBSiCuts();
    if (id === 'view' && typeof updateClassDropdown === 'function') updateClassDropdown();
    updateStepIndicator();
  }

  function checkAccessPermission(section) {
    if (section === 'view' || section === 'analyze') {
      // 파일 업로드 체크
      if (!parsedData || parsedData.length === 0) {
        showMessage('성적 입력 파일을 업로드해주세요!\n아직 분석을 할 수 없습니다.');
        return false;
      }
      // 등급컷 등록 체크
      const hasGradeCuts = gradeCuts.target.std.korean.length > 0 && gradeCuts.target.std.math.length > 0;
      if (!hasGradeCuts) {
        showMessage('등급컷을 입력해주세요!\n아직 분석을 할 수 없습니다.');
        return false;
      }
    }
    return true;
  }
  
  function showMessage(message) {
    document.getElementById('messageContent').innerHTML = message;
    document.getElementById('messagePopup').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
  }
  function closeMessage() {
    document.getElementById('messagePopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
  }
  function showLoading() {
    document.getElementById('loadingPopup').style.display = 'block';
  }
  function hideLoading() {
    document.getElementById('loadingPopup').style.display = 'none';
  }

  // ------------------- 업로드 UX: 드래그앤드랍/최근 파일 -------------------
  (function initUploadUX(){
    const drop = document.getElementById('uploadDrop');
    const input = document.getElementById('csvFile');
    if (!drop || !input) return;
    function setLastUploadInfo(name, isReadyToParse = false){
      const el = document.getElementById('lastUploadInfo');
      const box = document.getElementById('uploadDrop');
      if (el) {
        if (name && isReadyToParse) {
           el.innerHTML = `<strong style="color:var(--primary-color); font-size:1.05rem;">✔ 선택된 파일:</strong> <span style="font-weight:600; font-size:1.05rem; color:#111827;">${name}</span>`;
        } else if (name && !isReadyToParse) {
           el.innerHTML = `<span style="color:var(--subtle-text-color);">최근 생성 기록: ${name}</span>`;
        } else {
           el.innerHTML = '';
        }
      }
      if (box) {
         if (name && isReadyToParse) {
           box.style.borderColor = 'var(--primary-color)';
           box.style.backgroundColor = '#f8fafc';
           box.style.borderStyle = 'solid';
           box.style.borderWidth = '2px';
         } else {
           box.style.borderColor = '';
           box.style.backgroundColor = '';
           box.style.borderStyle = '';
           box.style.borderWidth = '';
         }
      }
    }
    
    // 이전에 작업했던 기록은 파싱 대기 상태가 아님 (isReadyToParse = false)
    try {
      const last = localStorage.getItem('lastUploadName');
      if (last) setLastUploadInfo(last, false);
    } catch(e){}
    
    ;['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover');}));
    ;['dragleave','drop'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover');}));
    drop.addEventListener('drop', e=>{
      const files = e.dataTransfer?.files;
      if (files && files.length){
        input.files = files;
        try { localStorage.setItem('lastUploadName', files[0].name); setLastUploadInfo(files[0].name, true);} catch(e){}
      }
    });
    input.addEventListener('change', e=>{
      const f = e.target.files?.[0];
      if (f){ try { localStorage.setItem('lastUploadName', f.name); setLastUploadInfo(f.name, true);} catch(e){} }
    });
  })();
  
  // ------------------- 전역 데이터 -------------------
  // 원본 데이터
  let csvData = [];
  let parsedData = [];
  
  // 등급컷 데이터 구조(원점수, 표준점수 모두)
  let gradeCuts = {
    target: {
      raw: { korean: [], math: [], social: [], science: [], history: [], english: [] },
      std: { korean: [], math: [], social: [], science: [], history: [], english: [] }
    },
    compare: {
      raw: { korean: [], math: [], social: [], science: [], history: [], english: [] },
      std: { korean: [], math: [], social: [], science: [], history: [], english: [] }
    }
  };
  
  // 업로드 파일 확장자 및 CSV 분석 토글 전역 상태
  // uploadedFileExt: 'csv' | 'xlsx' | ''
  if (typeof window.uploadedFileExt === 'undefined') {
    window.uploadedFileExt = '';
  }
  // CSV 분석 시 표준점수 강제 사용 여부 (기본: false)
  if (typeof window.csvAnalysisUseStd === 'undefined') {
    window.csvAnalysisUseStd = false;
  }
  // CSV 분석 시 파일에 기록된 등급을 그대로 사용할지 여부 (기본: false)
  if (typeof window.csvAnalysisUseRecorded === 'undefined') {
    window.csvAnalysisUseRecorded = false;
  }
  // 비교 업로드 파일 확장자
  if (typeof window.compareUploadedFileExt === 'undefined') {
    window.compareUploadedFileExt = '';
  }

  // 세분화된 CSV 옵션(대상)
  if (typeof window.csvTargetUseStdKorMath === 'undefined') window.csvTargetUseStdKorMath = false;
  if (typeof window.csvTargetUseStdExplore === 'undefined') window.csvTargetUseStdExplore = false;
  if (typeof window.csvTargetUseRecorded === 'undefined') window.csvTargetUseRecorded = false;
  // 세분화된 CSV 옵션(비교)
  if (typeof window.csvCompareUseStdKorMath === 'undefined') window.csvCompareUseStdKorMath = false;
  if (typeof window.csvCompareUseStdExplore === 'undefined') window.csvCompareUseStdExplore = false;
  if (typeof window.csvCompareUseRecorded === 'undefined') window.csvCompareUseRecorded = false;
  
  // 현재 활성화된 등급컷 메뉴(대상/비교)
  let currentCutTab = 'target';
  
  // 학급번호(101 등) → {학년, 반}
  function splitClassNumber(classNum) {
    if (!classNum) return { 학년: '', 반: '' };
    const str = String(classNum).replace(/\.0+$/, '').padStart(3, '0');
    return {
      학년: str[0],
      반: str.slice(1, 3)
    };
  }
  
  function copyTableBodyAsHtml(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return '';

    const rows = table.querySelectorAll('tbody tr');
    let html = '';
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let rowHtml = '<tr>';
        for (let j = 0; j < row.children.length; j++) {
            const cell = row.children[j];
            // 복사 대상이 아닌 경우에만 포함
            if (!cell.classList.contains('no-copy')) {
                rowHtml += '<td>' + cell.innerHTML + '</td>';
            }
        }
        rowHtml += '</tr>';
        html += rowHtml;
    }
    return html;
  }

  // ------------------- 스텝 인디케이터 갱신 -------------------
  function updateStepIndicator() {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    if (!step1) return;

    const hasFile = parsedData && parsedData.length > 0;
    const hasCuts = gradeCuts.target.std.korean.length > 0 && gradeCuts.target.std.math.length > 0;

    // 초기화
    [step1, step2, step3].forEach(s => { s.classList.remove('step-done', 'step-active'); });

    if (hasFile && hasCuts) {
      // 모두 완료
      step1.classList.add('step-done');
      step2.classList.add('step-done');
      step3.classList.add('step-active');
    } else if (hasFile) {
      // 파일만 완료
      step1.classList.add('step-done');
      step2.classList.add('step-active');
    } else {
      // 아직 시작 전
      step1.classList.add('step-active');
    }

    // 빈 상태 가이드 표시/숨기기
    const cutGuide = document.getElementById('cutEmptyGuide');
    const viewGuide = document.getElementById('viewEmptyGuide');
    const analyzeGuide = document.getElementById('analyzeEmptyGuide');
    if (cutGuide) cutGuide.classList.toggle('hidden', hasFile);
    if (viewGuide) viewGuide.classList.toggle('hidden', hasFile && hasCuts);
    if (analyzeGuide) analyzeGuide.classList.toggle('hidden', hasFile && hasCuts);
  }

  // 초기 호출
  document.addEventListener('DOMContentLoaded', updateStepIndicator);

  // ------------------- 차트 모달 -------------------
  function openChartModal(title, renderFn) {
    const modal = document.getElementById('chartModal');
    const titleEl = document.getElementById('chartModalTitle');
    const body = document.getElementById('chartModalBody');
    if (!modal) return;
    titleEl.textContent = title;
    body.innerHTML = '';
    modal.classList.add('active');
    // renderFn은 body 요소 안에 캔버스를 만들고 차트를 그리는 콜백
    setTimeout(() => renderFn(body), 50);
  }

  function closeChartModal() {
    const modal = document.getElementById('chartModal');
    const body = document.getElementById('chartModalBody');
    if (!modal) return;
    modal.classList.remove('active');
    // 차트 해제
    if (body) {
      body.querySelectorAll('canvas').forEach(cv => {
        if (window.analysisChart) window.analysisChart.destroyChart(cv.id);
      });
      body.innerHTML = '';
    }
  }

// ------------------- 스마트 복사 이벤트 핸들러 -------------------
/**
 * 사용자가 표 내부에서 복사할 때 .no-copy 클래스를 가진 열을 제외하고 복사하는 함수
 * @param {ClipboardEvent} event - 클립보드 이벤트
 */
function handleTableCopy(event) {
  const selection = document.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // 선택 영역이 메인 콘텐츠 내부의 테이블인지 확인
  const table = container.nodeType === Node.ELEMENT_NODE 
    ? container.closest('main table') 
    : container.parentElement.closest('main table');
  
  if (!table) return; // 테이블이 아니면 기본 복사 동작 실행

  event.preventDefault(); // 기본 복사 동작을 막고 커스텀 로직 실행

  const selectedRows = new Set();
  const allCells = [...table.querySelectorAll('th, td')];
  
  // 선택된 모든 셀이 포함된 행(row)들을 찾음
  for(const cell of allCells){
      if(selection.containsNode(cell, true)){ // true는 부분 선택도 포함
          selectedRows.add(cell.parentNode);
      }
  }
  
  const rowsArray = Array.from(selectedRows).sort((a, b) => a.rowIndex - b.rowIndex);

  let clipboardString = '';
  rowsArray.forEach(row => {
      const cellsToCopy = [];
      Array.from(row.children).forEach(cell => {
          // 셀이 선택 영역에 포함되고, .no-copy 클래스가 없을 경우에만 복사 목록에 추가
          if (selection.containsNode(cell, true) && !cell.classList.contains('no-copy')) {
              cellsToCopy.push(cell.innerText);
          }
      });
      if (cellsToCopy.length > 0) {
          clipboardString += cellsToCopy.join('\t') + '\n';
      }
  });

  if (clipboardString) {
    navigator.clipboard.writeText(clipboardString.trim()).then(() => {
      // 복사 성공 피드백: 가장 가까운 복사 버튼의 텍스트 임시 변경
      const copyBtns = document.querySelectorAll('.copy-btn');
      copyBtns.forEach(btn => {
        if (btn.textContent.includes('복사') && !btn.classList.contains('copied')) {
          const original = btn.textContent;
          btn.textContent = '복사됨!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
        }
      });
    }).catch(err => {
      console.error('클립보드 쓰기 실패: ', err);
      showMessage('데이터 복사에 실패했습니다.');
    });
  }
}

// 문서 전체에 copy 이벤트 리스너 추가
document.addEventListener('copy', handleTableCopy);
  