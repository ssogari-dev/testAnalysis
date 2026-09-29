// ------------------- 성적 확인(학생별/반별/학년별) -------------------

// 등급컷 등은 common.js/parse_upload.js에서 전역으로 관리됨

// 성적 확인 테이블 정렬 상태
let viewSortKey = '';
let viewSortDesc = true;
let lastViewStudents = []; // 정렬 재렌더용 캠시

function updateClassDropdown() {
    const parsed = parsedData;
    const gradeSel = document.getElementById('viewGrade');
    // 업로드된 데이터에 실제로 존재하는 학년만 옵션으로 채운다.
    // (기존엔 HTML에 "1학년"만 고정돼 있어, 2·3학년 파일을 올려도 항상 1학년으로 조회를 시도해
    //  "해당 학생이 없습니다"만 나오는 문제가 있었다)
    const gradesInData = [...new Set(parsed.map(s => String(s.학년)).filter(Boolean))].sort();
    const prevSelected = gradeSel.value;
    gradeSel.innerHTML = gradesInData.map(g => `<option value="${g}">${g}학년</option>`).join('');
    if (gradesInData.includes(prevSelected)) gradeSel.value = prevSelected;
    if (!gradeSel.onchange) gradeSel.onchange = updateClassDropdown;
    const grade = gradeSel.value;
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
  async function showStudentData() {
    showLoading();
    setTimeout(async () => {
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
      // 원점수가 없는 과목은 suneungcalc.com 자료로 추정 시도 (EBSi로 등급컷을 불러온 적이 있을 때만)
      if (typeof estimateStudentsRawScores === 'function') {
        try { await estimateStudentsRawScores(students); } catch (e) { /* 추정 실패는 무시하고 빈 값 유지 */ }
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
          const rawOrEstimate = (rec) => Number(rec.원점수) || Number(rec._원점수추정) || 0;
          const getVal = (s, key) => {
            if (key === '국어_원') return rawOrEstimate(s.국어);
            if (key === '수학_원') return rawOrEstimate(s.수학);
            if (key === '영어_원') return rawOrEstimate(s.영어);
            if (key === '한국사_원') return rawOrEstimate(s.한국사);
            if (key === '사회_원') return rawOrEstimate(s.사회탐구);
            if (key === '과학_원') return rawOrEstimate(s.과학탐구);
            return 0;
          };
          va = getVal(a, viewSortKey);
          vb = getVal(b, viewSortKey);
          return viewSortDesc ? vb - va : va - vb;
        });
      }
      lastViewStudents = students;
      // estimateStudentsRawScores가 suneungcalc 추정치를 원점수/백분위 칸에 직접 채워두므로
      // (성적 분석 등 다른 화면에서도 똑같이 쓰이도록) 여기서는 그냥 있는 값을 보여주면 된다.
      const rawCell = (rec) => (rec.원점수 && rec.원점수 !== '') ? `${rec.원점수}(${rec.표준점수})` : `(${rec.표준점수 || '-'})`;
      const pctCell = (rec) => (rec.백분위 && rec.백분위 !== '') ? rec.백분위 : '-';
      students.forEach(s => {
        // 등급컷 선택
        const korCuts = useStdKorMath ? gradeCuts.target.std.korean : gradeCuts.target.raw.korean;
        const mathCuts = useStdKorMath ? gradeCuts.target.std.math : gradeCuts.target.raw.math;
        const socCuts = useStdExplore ? gradeCuts.target.std.social : gradeCuts.target.raw.social;
        const sciCuts = useStdExplore ? gradeCuts.target.std.science : gradeCuts.target.raw.science;
        const engCuts = gradeCuts.target.raw.english;
        const hisCuts = gradeCuts.target.raw.history;
        html += '<tr>';
        html += `<td class="no-copy">${s.반}</td>`;
        html += `<td class="no-copy">${s.번호}</td><td class="no-copy">${escapeHtml(s.이름)}</td>`;
        // 기록 등급 사용 토글이 켜져 있고 CSV인 경우, 등급 칸에는 기록된 등급 표시
        const useRecorded = (window.uploadedFileExt === 'csv' && window.csvTargetUseRecorded === true);
        // resolveStudentGrade: 점수가 없어도 기록된 등급(예: 영어/한국사 "N등급" 텍스트)이 있으면 그걸 사용한다
        const korGradeDisp = useRecorded ? (s.국어?.등급 || '-') : (resolveStudentGrade(s.국어, useStdKorMath ? '표준점수' : '원점수', korCuts) ?? '-');
        const mathGradeDisp = useRecorded ? (s.수학?.등급 || '-') : (resolveStudentGrade(s.수학, useStdKorMath ? '표준점수' : '원점수', mathCuts) ?? '-');
        const engGradeDisp = useRecorded ? (s.영어?.등급 || '-') : (resolveStudentGrade(s.영어, '원점수', engCuts) ?? '-');
        const hisGradeDisp = useRecorded ? (s.한국사?.등급 || '-') : (resolveStudentGrade(s.한국사, '원점수', hisCuts) ?? '-');
        const socGradeDisp = useRecorded ? (s.사회탐구?.등급 || '-') : (resolveStudentGrade(s.사회탐구, useStdExplore ? '표준점수' : '원점수', socCuts) ?? '-');
        const sciGradeDisp = useRecorded ? (s.과학탐구?.등급 || '-') : (resolveStudentGrade(s.과학탐구, useStdExplore ? '표준점수' : '원점수', sciCuts) ?? '-');

        html += `<td>${rawCell(s.국어)}</td><td>${pctCell(s.국어)}</td><td>${korGradeDisp}</td>`;
        html += `<td>${rawCell(s.수학)}</td><td>${pctCell(s.수학)}</td><td>${mathGradeDisp}</td>`;
        html += `<td>${s.영어.원점수 || (s.영어.등급 ? '' : '-')}</td><td>${engGradeDisp}</td>`;
        html += `<td>${s.한국사.원점수 || (s.한국사.등급 ? '' : '-')}</td><td>${hisGradeDisp}</td>`;
        html += `<td>${rawCell(s.사회탐구)}</td><td>${pctCell(s.사회탐구)}</td><td>${socGradeDisp}</td>`;
        html += `<td>${rawCell(s.과학탐구)}</td><td>${pctCell(s.과학탐구)}</td><td>${sciGradeDisp}</td>`;
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