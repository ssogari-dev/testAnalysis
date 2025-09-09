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
    document.getElementById('messageContent').innerText = message;
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
    function setLastUploadInfo(name){
      const el = document.getElementById('lastUploadInfo');
      if (el) el.textContent = name ? `최근 파일: ${name}` : '';
    }
    try {
      const last = localStorage.getItem('lastUploadName');
      if (last) setLastUploadInfo(last);
    } catch(e){}
    ;['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover');}));
    ;['dragleave','drop'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover');}));
    drop.addEventListener('drop', e=>{
      const files = e.dataTransfer?.files;
      if (files && files.length){
        input.files = files;
        try { localStorage.setItem('lastUploadName', files[0].name); setLastUploadInfo(files[0].name);} catch(e){}
      }
    });
    input.addEventListener('change', e=>{
      const f = e.target.files?.[0];
      if (f){ try { localStorage.setItem('lastUploadName', f.name); setLastUploadInfo(f.name);} catch(e){} }
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
    navigator.clipboard.writeText(clipboardString.trim()).catch(err => {
      console.error('클립보드 쓰기 실패: ', err);
      showMessage('데이터 복사에 실패했습니다.');
    });
  }
}

// 문서 전체에 copy 이벤트 리스너 추가
document.addEventListener('copy', handleTableCopy);
  