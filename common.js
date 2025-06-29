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
  