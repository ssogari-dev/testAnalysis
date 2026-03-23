// ------------------- 성적 확인(학생별/반별/학년별) -------------------

// 등급컷 등은 common.js/parse_upload.js에서 전역으로 관리됨

// 성적 확인 테이블 정렬 상태
let viewSortKey = '';
let viewSortDesc = true;
let lastViewStudents = []; // 정렬 재렌더용 캠시

function updateClassDropdown() {
    const parsed = parsedData;
    const grade = document.getElementById('viewGrade').value;
    const classSel = document.getElementById('viewClass');
    classSel.innerHTML = '<option value="">전체</option>';
    classSel.onchange = updateNumberDropdown;
    const classes = [...new Set(parsed.filter(s => s.학년 === grade).map(s => s.반))].sort();
    classes.forEach(c => {
      classSel.innerHTML += `<option value="${c}">${c}반</option>`;
    });
    updateNumberDropdown();
  }
  
  function updateNumberDropdown() {
    const parsed = parsedData;
    const grade = document.getElementById('viewGrade').value;
    const cls = document.getElementById('viewClass').value;
    const numSel = document.getElementById('viewNumber');
    numSel.innerHTML = '<option value="">전체</option>';
    let nums = parsed.filter(s => s.학년 === grade && (!cls || s.반 === cls)).map(s => s.번호);
    
    if (!cls) {
        // 반이 '전체'인 경우 번호 메뉴 비활성화
        numSel.disabled = true;
        numSel.innerHTML = '<option value="">전체</option>';
        return;
      }
    
    numSel.disabled = false;
    nums = [...new Set(nums)].sort((a,b) => a - b);
    nums.forEach(n => {
      numSel.innerHTML += `<option value="${n}">${n}번</option>`;
    });
  }
  
  // 성적 확인: 업로드 파일 확장자에 따라 등급컷 기준 자동 분기
  function showStudentData() {
    showLoading();
    setTimeout(() => {
      const parsed = parsedData;
      const grade = document.getElementById('viewGrade').value;
      const cls = document.getElementById('viewClass').value;
      const num = document.getElementById('viewNumber').value;
      let students = parsed.filter(s => s.학년 === grade);
      if (cls) students = students.filter(s => s.반 === cls);
      if (num) students = students.filter(s => s.번호 === num);
      if (!students.length) {
        document.getElementById('viewContent').innerHTML = '<p>해당 학생이 없습니다.</p>';
        hideLoading();
        return;
      }
      // 확장자에 따라 등급컷 분기
      // XLSX 기본 표준점수, CSV는 토글로 표준점수 허용
      const useStdKorMath = (window.uploadedFileExt === 'xlsx') || (window.uploadedFileExt === 'csv' && window.csvTargetUseStdKorMath);
      const useStdExplore = (window.uploadedFileExt === 'xlsx') || (window.uploadedFileExt === 'csv' && window.csvTargetUseStdExplore);
      let html = '<table id="viewResultTable"><thead>';
      html += `
        <tr>
          <th class="no-copy" rowspan="2">반</th>
          <th class="no-copy" rowspan="2">번호</th>
          <th class="no-copy" rowspan="2">이름</th>
          <th colspan="3">국어</th>
          <th colspan="3">수학</th>
          <th colspan="2">영어</th>
          <th colspan="2">한국사</th>
          <th colspan="3">사회탐구</th>
          <th colspan="3">과학탐구</th>
        </tr>
        <tr>
          <th class="sortable" onclick="sortViewTable('국어_원')">원점수<br>(표점)${viewSortKey==='국어_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>백분위</th><th>등급</th>
          <th class="sortable" onclick="sortViewTable('수학_원')">원점수<br>(표점)${viewSortKey==='수학_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>백분위</th><th>등급</th>
          <th class="sortable" onclick="sortViewTable('영어_원')">원점수${viewSortKey==='영어_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>등급</th>
          <th class="sortable" onclick="sortViewTable('한국사_원')">원점수${viewSortKey==='한국사_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>등급</th>
          <th class="sortable" onclick="sortViewTable('사회_원')">원점수<br>(표점)${viewSortKey==='사회_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>백분위</th><th>등급</th>
          <th class="sortable" onclick="sortViewTable('과학_원')">원점수<br>(표점)${viewSortKey==='과학_원' ? (viewSortDesc?' \u25B2':' \u25BC') : ''}</th><th>백분위</th><th>등급</th>
        </tr>
      `;
      html += '</thead><tbody>';
      // 정렬 적용
      if (viewSortKey) {
        students.sort((a, b) => {
          let va, vb;
          const getVal = (s, key) => {
            if (key === '국어_원') return Number(s.국어.원점수) || 0;
            if (key === '수학_원') return Number(s.수학.원점수) || 0;
            if (key === '영어_원') return Number(s.영어.원점수) || 0;
            if (key === '한국사_원') return Number(s.한국사.원점수) || 0;
            if (key === '사회_원') return Number(s.사회탐구.원점수) || 0;
            if (key === '과학_원') return Number(s.과학탐구.원점수) || 0;
            return 0;
          };
          va = getVal(a, viewSortKey);
          vb = getVal(b, viewSortKey);
          return viewSortDesc ? vb - va : va - vb;
        });
      }
      lastViewStudents = students;
      students.forEach(s => {
        // 과목별로 등급컷 기준 분기
        const getGrade = (score, cuts) => {
          if (!score || isNaN(score)) return '-';
          score = Number(score);
          for (let i = 0; i < 8; i++) {
            if (score >= (cuts[i] || 0)) return i+1;
          }
          return 9;
        };
        // 등급컷 선택
        const korCuts = useStdKorMath ? gradeCuts.target.std.korean : gradeCuts.target.raw.korean;
        const mathCuts = useStdKorMath ? gradeCuts.target.std.math : gradeCuts.target.raw.math;
        const socCuts = useStdExplore ? gradeCuts.target.std.social : gradeCuts.target.raw.social;
        const sciCuts = useStdExplore ? gradeCuts.target.std.science : gradeCuts.target.raw.science;
        const engCuts = gradeCuts.target.raw.english;
        const hisCuts = gradeCuts.target.raw.history;
        const socRawInt = parseInt(s.사회탐구.원점수) || '-';
        const sciRawInt = parseInt(s.과학탐구.원점수) || '-';
        html += '<tr>';
        html += `<td class="no-copy">${s.반}</td>`;
        html += `<td class="no-copy">${s.번호}</td><td class="no-copy">${s.이름}</td>`;
        // 기록 등급 사용 토글이 켜져 있고 CSV인 경우, 등급 칸에는 기록된 등급 표시
        const useRecorded = (window.uploadedFileExt === 'csv' && window.csvTargetUseRecorded === true);
        const korGradeDisp = useRecorded ? (s.국어?.등급 || '-') : getGrade(useStdKorMath?s.국어.표준점수:s.국어.원점수, korCuts);
        const mathGradeDisp = useRecorded ? (s.수학?.등급 || '-') : getGrade(useStdKorMath?s.수학.표준점수:s.수학.원점수, mathCuts);
        const engGradeDisp = useRecorded ? (s.영어?.등급 || '-') : getGrade(s.영어.원점수, engCuts);
        const hisGradeDisp = useRecorded ? (s.한국사?.등급 || '-') : getGrade(s.한국사.원점수, hisCuts);
        const socGradeDisp = useRecorded ? (s.사회탐구?.등급 || '-') : getGrade(useStdExplore?s.사회탐구.표준점수:s.사회탐구.원점수, socCuts);
        const sciGradeDisp = useRecorded ? (s.과학탐구?.등급 || '-') : getGrade(useStdExplore?s.과학탐구.표준점수:s.과학탐구.원점수, sciCuts);

        html += `<td>${s.국어.원점수}(${s.국어.표준점수})</td><td>${s.국어.백분위}</td><td>${korGradeDisp}</td>`;
        html += `<td>${s.수학.원점수}(${s.수학.표준점수})</td><td>${s.수학.백분위}</td><td>${mathGradeDisp}</td>`;
        html += `<td>${s.영어.원점수}</td><td>${engGradeDisp}</td>`;
        html += `<td>${s.한국사.원점수}</td><td>${hisGradeDisp}</td>`;
        html += `<td>${socRawInt}(${s.사회탐구.표준점수})</td><td>${s.사회탐구.백분위}</td><td>${socGradeDisp}</td>`;
        html += `<td>${sciRawInt}(${s.과학탐구.표준점수})</td><td>${s.과학탐구.백분위}</td><td>${sciGradeDisp}</td>`;
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '<button class="copy-btn" onclick="copyTableBodyAsHtml(\'viewResultTable\')">데이터 복사</button>';
      document.getElementById('viewContent').innerHTML = html;
      hideLoading();
    }, 100);
  }

  // 성적 확인 테이블 정렬 함수
  function sortViewTable(key) {
    if (viewSortKey === key) {
      viewSortDesc = !viewSortDesc;
    } else {
      viewSortKey = key;
      viewSortDesc = true;
    }
    showStudentData();
  }