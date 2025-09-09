// ------------------- 성적 확인(학생별/반별/학년별) -------------------

// 등급컷 등은 common.js/parse_upload.js에서 전역으로 관리됨

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
      const useStd = (window.uploadedFileExt === 'xlsx');
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
          <th>원점수<br>(표점)</th><th>백분위</th><th>등급</th>
          <th>원점수<br>(표점)</th><th>백분위</th><th>등급</th>
          <th>원점수</th><th>등급</th>
          <th>원점수</th><th>등급</th>
          <th>원점수<br>(표점)</th><th>백분위</th><th>등급</th>
          <th>원점수<br>(표점)</th><th>백분위</th><th>등급</th>
        </tr>
      `;
      html += '</thead><tbody>';
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
        const korCuts = useStd ? gradeCuts.target.std.korean : gradeCuts.target.raw.korean;
        const mathCuts = useStd ? gradeCuts.target.std.math : gradeCuts.target.raw.math;
        const socCuts = useStd ? gradeCuts.target.std.social : gradeCuts.target.raw.social;
        const sciCuts = useStd ? gradeCuts.target.std.science : gradeCuts.target.raw.science;
        const engCuts = gradeCuts.target.raw.english;
        const hisCuts = gradeCuts.target.raw.history;
        const socRawInt = parseInt(s.사회탐구.원점수) || '-';
        const sciRawInt = parseInt(s.과학탐구.원점수) || '-';
        html += '<tr>';
        html += `<td class="no-copy">${s.반}</td>`;
        html += `<td class="no-copy">${s.번호}</td><td class="no-copy">${s.이름}</td>`;
        html += `<td>${s.국어.원점수}(${s.국어.표준점수})</td><td>${s.국어.백분위}</td><td>${getGrade(useStd?s.국어.표준점수:s.국어.원점수, korCuts)}</td>`;
        html += `<td>${s.수학.원점수}(${s.수학.표준점수})</td><td>${s.수학.백분위}</td><td>${getGrade(useStd?s.수학.표준점수:s.수학.원점수, mathCuts)}</td>`;
        html += `<td>${s.영어.원점수}</td><td>${getGrade(s.영어.원점수, engCuts)}</td>`;
        html += `<td>${s.한국사.원점수}</td><td>${getGrade(s.한국사.원점수, hisCuts)}</td>`;
        html += `<td>${socRawInt}(${s.사회탐구.표준점수})</td><td>${s.사회탐구.백분위}</td><td>${getGrade(useStd?s.사회탐구.표준점수:s.사회탐구.원점수, socCuts)}</td>`;
        html += `<td>${sciRawInt}(${s.과학탐구.표준점수})</td><td>${s.과학탐구.백분위}</td><td>${getGrade(useStd?s.과학탐구.표준점수:s.과학탐구.원점수, sciCuts)}</td>`;
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '<button class="copy-btn" onclick="copyTableBodyAsHtml(\'viewResultTable\')">데이터 복사</button>';
      document.getElementById('viewContent').innerHTML = html;
      hideLoading();
    }, 100);
  }