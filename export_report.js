// ------------------- 파일 내보내기 (HWPX 결과 보고서 / 대교협 분석자료 XLSX) -------------------
// 두 기능 모두 hwpx/ 폴더의 서식 파일을 불러와 "숫자·글자만" 바꿔 끼워 넣는다.
// 서식(레이아웃·표 모양·수식 등)은 원본 그대로 두는 것이 원칙이다.

const HWPX_TEMPLATE_PATH = 'hwpx/result.hwpx';
const DAEGYO_TEMPLATE_PATH = 'hwpx/de.xlsx';
const HP_NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph';

// ======================= 공통 유틸 =======================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 서식 파일을 불러온다. 사이트가 서버로 열려 있으면 바로 받아오고,
// 로컬 파일(file://)로 연 경우처럼 받아올 수 없으면 사용자에게 직접 고르게 한다.
async function loadTemplateArrayBuffer(path, label) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (res.ok) return await res.arrayBuffer();
  } catch (e) { /* 아래에서 직접 선택으로 대체 */ }
  hideLoading();
  showMessage(`${label} 서식 파일(${path})을 자동으로 불러오지 못했습니다.\n확인을 누른 뒤 서식 파일을 직접 선택해주세요.`);
  return await new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = path.endsWith('.hwpx') ? '.hwpx' : '.xlsx';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error('서식 파일을 선택하지 않았습니다.'));
      showLoading();
      f.arrayBuffer().then(resolve, reject);
    };
    input.addEventListener('cancel', () => reject(new Error('서식 파일을 선택하지 않았습니다.')));
    // 메시지 팝업의 "닫기"를 누르면 파일 선택창을 띄운다
    const closeBtn = document.querySelector('#messagePopup button');
    if (closeBtn) closeBtn.addEventListener('click', () => input.click(), { once: true });
    else input.click();
  });
}

// 서식 압축 파일에서 한 항목만 바꿔 새 파일을 만든다.
// - 다른 항목은 원래 압축 방식(저장/압축)을 그대로 따르므로 압축된 바이트까지 원본과 같게 복사된다.
// - 폴더 항목('xl/' 등)을 새로 만들지 않고, 파일 순서도 그대로 둔다.
async function rebuildZip(zip, changed, mimeType, type) {
  const methodOf = f => (f._data && f._data.compression && f._data.compression.magic === '\x00\x00') ? 'STORE' : 'DEFLATE';
  Object.keys(zip.files).forEach(name => {
    const f = zip.files[name];
    if (!f.dir) f.options.compression = methodOf(f);
  });
  for (const [path, content] of Object.entries(changed)) {
    const orig = zip.file(path);
    zip.file(path, content, { compression: orig ? methodOf(orig) : 'DEFLATE', createFolders: false, date: orig ? orig.date : undefined });
  }
  return zip.generateAsync({ type: type || 'blob', mimeType });
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 점수를 숫자로 (빈 칸이면 '')
function numOrBlank(v) {
  const n = (typeof toScore === 'function') ? toScore(v) : Number(v);
  return isNaN(n) ? '' : n;
}

// 등급: 화면(전체 분석·성적 확인·학생 명단)과 같은 규칙으로 매긴다 — 점수가 있으면 등급컷,
// 점수가 없으면 파일에 기록된 등급 (CSV '기록 등급 사용' 옵션이면 기록된 등급)
function subjectGrade(s, subject) {
  const g = studentGradeFor(s, subject, 'target');
  return g === null || g === undefined ? '' : g;
}

// 학생의 탐구1/탐구2 목록 (원래 순서) + 대교협 과목명 + 등급
function exploreEntriesOf(s, examYear) {
  const newSys = typeof isNewTamguSystem === 'function' && isNewTamguSystem(String(s.학년), examYear);
  const commonName = cat => (newSys ? (cat === 'science' ? '과학' : '사회') : '');
  return studentExploreEntries(s).map(e => {
    const g = exploreEntryGrade(e, 'target');
    return { ...e, 과목: e.과목 || commonName(e.분류), 등급: g === null ? '' : g };
  });
}

function currentExamInfo() {
  const ctx = window.__lastEbsiExam || {};
  const examText = ctx.examText || '';
  const month = (typeof extractMonthFromExamText === 'function' && extractMonthFromExamText(examText)) || '';
  const dayMatch = examText.match(/\d{1,2}\s*\.\s*(\d{1,2})/);
  const grades = [...new Set((parsedData || []).map(s => String(s.학년)).filter(Boolean))];
  return {
    year: ctx.year || String(new Date().getFullYear()),
    month,
    day: dayMatch ? String(Number(dayMatch[1])) : '',
    grade: ctx.gradeVal || (grades.length === 1 ? grades[0] : ''),
    isSat: /모의평가|수능/.test(examText)
  };
}

// ======================= 1. HWPX 결과 분석 보고서 =======================

// 앱의 현재 분석 결과를 보고서 표에 들어갈 값으로 정리한다 (화면에 보이는 값과 같은 함수로 계산)
function buildHwpxReportData(opts) {
  const T = typeof getCompareTargetData === 'function' ? getCompareTargetData() : parsedData;
  const C = typeof getCompareCompareData === 'function' ? getCompareCompareData() : [];
  const includeCompare = !!opts.includeCompare && C.length > 0;
  // 전체 분석 표(1~8)는 업로드한 파일 전체, 비교 표는 비교 탭의 학년 필터를 적용한 데이터로 계산한다
  // (화면의 '전체 성적 분석'·'비교 성적 분석'과 같은 기준)
  const P = parsedData;
  const distP = subj => getGradeDistByCut(P, subj, ...cutsForSide(subj, 'target'), 'target');
  const g12P = subj => get12GradeByCut(P, subj, ...cutsForSide(subj, 'target'), 'target');
  const stat = (data, subj, type, k) => getSubjectStat(data, subj, type, k);

  const hasAny = rec => !!rec && ['원점수', '표준점수', '등급'].some(f => rec[f] !== undefined && String(rec[f]).trim() !== '');
  const N = P.length;
  const takers = subj => P.filter(s => hasAny(s[subj])).length;
  const pct = (n, d) => (d ? (n / d * 100) : 0);

  const cutVal = (arr, i) => (arr && arr[i] !== undefined && arr[i] !== '' && Number(arr[i]) > 0) ? String(arr[i]) : '-';

  // 성적 상위자 (국어+수학+탐구 표준점수 합)
  const examYear = currentExamInfo().year;
  const ranked = P.map(s => {
    const kor = numOrBlank(s.국어?.표준점수);
    const math = numOrBlank(s.수학?.표준점수);
    const exps = exploreEntriesOf(s, examYear);
    const expSum = exps.reduce((a, e) => a + (Number(numOrBlank(e.표준점수)) || 0), 0);
    return {
      s, kor, math, exps,
      sum: (Number(kor) || 0) + (Number(math) || 0) + expSum,
      soc: exps.find(e => e.분류 === 'social'),
      sci: exps.find(e => e.분류 === 'science')
    };
  }).filter(x => x.kor !== '' || x.math !== '').sort((a, b) => b.sum - a.sum);
  let prevSum = null, prevRank = 0;
  ranked.forEach((x, i) => { x.rank = (x.sum === prevSum) ? prevRank : i + 1; prevSum = x.sum; prevRank = x.rank; });
  const top20 = ranked.slice(0, 20).map((x, i) => ({
    order: i + 1,
    name: x.s.이름 || '',
    sum: x.sum,
    rank: x.rank,
    kor: x.kor, korGrade: subjectGrade(x.s, '국어'),
    math: x.math, mathGrade: subjectGrade(x.s, '수학'),
    engGrade: subjectGrade(x.s, '영어'),
    hisGrade: subjectGrade(x.s, '한국사'),
    socGrade: x.soc ? x.soc.등급 : '', soc: x.soc ? numOrBlank(x.soc.표준점수) : '',
    sciGrade: x.sci ? x.sci.등급 : '', sci: x.sci ? numOrBlank(x.sci.표준점수) : ''
  }));

  const statKeys = ['avg', 'top10', 'top20', 'top30'];
  const f2 = v => (v === '-' || v === '' || v === undefined || v === null) ? '-' : Number(v).toFixed(2);

  return {
    includeCompare,
    title: opts.title,
    intro: opts.intro,
    dept: opts.dept,
    N,
    targetLabel: String(opts.targetLabel),
    compareLabel: String(opts.compareLabel),
    takers: ['한국사', '국어', '수학', '영어'].map(subj => { const n = takers(subj); return { n, pct: pct(n, N) }; }),
    stdCuts: [0, 1, 2].map(i => ({
      kor: cutVal(gradeCuts.target.std.korean, i), math: cutVal(gradeCuts.target.std.math, i),
      korC: cutVal(gradeCuts.compare.std.korean, i), mathC: cutVal(gradeCuts.compare.std.math, i)
    })),
    stats: ['표준점수', '백분위'].reduce((o, type) => {
      o[type] = statKeys.map(k => ({
        kor: f2(stat(P, '국어', type, k)), math: f2(stat(P, '수학', type, k)),
        korT: f2(stat(T, '국어', type, k)), mathT: f2(stat(T, '수학', type, k)),
        korC: f2(stat(C, '국어', type, k)), mathC: f2(stat(C, '수학', type, k))
      }));
      return o;
    }, {}),
    dist: ['국어', '수학', '영어'].map(subj => ({
      t: distP(subj),
      tc: compareTabDist('target', subj),
      c: includeCompare ? compareTabDist('compare', subj) : null
    })),
    g12: ['국어', '수학', '영어'].map(subj => ({
      t: g12P(subj),
      tc: compareTab12('target', subj),
      c: includeCompare ? compareTab12('compare', subj) : null
    })),
    distExplore: ['사회탐구', '과학탐구'].map(subj => distP(subj)),
    g12Explore: ['사회탐구', '과학탐구'].map(subj => g12P(subj)),
    top20
  };
}

// HWPX 본문(section0.xml)에 값을 채워 넣는다. DOMParser/XMLSerializer를 인자로 받아
// 브라우저와 테스트(Node) 양쪽에서 같은 코드로 동작하게 했다.
function fillHwpxSection(xml, d, Parser, Serializer) {
  const decl = (xml.match(/^<\?xml[^?]*\?>/) || [''])[0];
  const doc = new Parser().parseFromString(xml, 'application/xml');
  const all = (el, name) => Array.from(el.getElementsByTagNameNS(HP_NS, name));
  const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name);
  const ownText = p => kids(p, 'run').map(r => kids(r, 't').map(t => t.textContent).join('')).join('');

  // 문단의 글자를 통째로 바꾼다 (첫 글자 조각의 글자 모양을 유지, '\n'은 줄바꿈)
  function setParaText(p, text) {
    const runs = kids(p, 'run');
    let target = null;
    for (const r of runs) { const t = kids(r, 't')[0]; if (t) { target = t; break; } }
    if (!target) {
      let run = runs[0];
      if (!run) {
        run = doc.createElementNS(HP_NS, 'hp:run');
        run.setAttribute('charPrIDRef', '0');
        p.insertBefore(run, p.firstChild);
      }
      target = doc.createElementNS(HP_NS, 'hp:t');
      run.appendChild(target);
    }
    runs.forEach(r => kids(r, 't').forEach(t => { if (t !== target) r.removeChild(t); }));
    while (target.firstChild) target.removeChild(target.firstChild);
    String(text === undefined || text === null ? '' : text).split('\n').forEach((part, i) => {
      if (i > 0) target.appendChild(doc.createElementNS(HP_NS, 'hp:lineBreak'));
      if (part) target.appendChild(doc.createTextNode(part));
    });
    // 줄 배치 캐시는 지워서 한글이 새 글자 길이에 맞춰 다시 배치하게 한다
    kids(p, 'linesegarray').forEach(n => p.removeChild(n));
  }

  const tables = all(doc.documentElement, 'tbl');
  const cellMaps = tables.map(tbl => {
    const map = {};
    all(tbl, 'tc').forEach(tc => {
      const a = all(tc, 'cellAddr')[0];
      if (a) map[a.getAttribute('rowAddr') + ',' + a.getAttribute('colAddr')] = tc;
    });
    return map;
  });
  // 셀 값 쓰기: 칸 안의 문단 수에 맞춰 차례로 쓴다 (대각선으로 나뉜 비교 칸 = 문단 2개: 대상, 비교)
  function setCell(ti, r, c, values) {
    const tc = cellMaps[ti] && cellMaps[ti][r + ',' + c];
    if (!tc) return;
    const sub = all(tc, 'subList')[0];
    const paras = sub ? kids(sub, 'p') : [];
    const vals = Array.isArray(values) ? values : [values];
    if (paras.length === 1 && vals.length > 1) { setParaText(paras[0], vals.join(' / ')); return; }
    paras.forEach((p, i) => setParaText(p, i < vals.length ? vals[i] : ''));
  }
  const pair = (a, b) => (d.includeCompare ? [a, b] : [a]);
  const s2 = v => (v === undefined || v === null || v === '') ? '' : String(v);

  // T0 성적 제공자 현황
  setCell(0, 1, 1, String(d.N));
  setCell(0, 1, 2, String(d.N));
  // T1 영역별 응시자 현황
  d.takers.forEach((t, i) => {
    setCell(1, 1, i + 1, `${t.n}\n(${t.pct.toFixed(2)})`);
    setCell(1, 2, i + 1, `${t.n} (${Math.round(t.pct)})`);
  });
  // T2 / T3 등급 구분 표준점수 (1~3등급)
  d.stdCuts.forEach((row, i) => {
    setCell(2, i + 1, 1, row.kor); setCell(2, i + 1, 2, row.math);
    setCell(3, i + 1, 1, pair(row.kor, row.korC)); setCell(3, i + 1, 2, pair(row.math, row.mathC));
  });
  // T4 표준점수 통계 / T5 비교(표준점수) / T6 비교(백분위)
  d.stats['표준점수'].forEach((row, i) => {
    setCell(4, i + 1, 1, row.kor); setCell(4, i + 1, 2, row.math);
    setCell(5, i + 1, 1, pair(row.korT ?? row.kor, row.korC)); setCell(5, i + 1, 2, pair(row.mathT ?? row.math, row.mathC));
  });
  d.stats['백분위'].forEach((row, i) => {
    setCell(6, i + 1, 1, pair(row.korT ?? row.kor, row.korC)); setCell(6, i + 1, 2, pair(row.mathT ?? row.math, row.mathC));
  });
  // T7 국어/수학/영어 등급 인원 / T8 비교
  d.dist.forEach((x, si) => {
    const col = 1 + si * 2;
    const tc = x.tc || x.t; // 비교 표의 대상 값 (비교 탭 학년 필터 적용)
    for (let g = 0; g < 9; g++) {
      setCell(7, g + 2, col, String(x.t.dist[g]));
      setCell(7, g + 2, col + 1, String(x.t.ratio[g]));
      setCell(8, g + 2, col, pair(String(tc.dist[g]), x.c ? String(x.c.dist[g]) : ''));
      setCell(8, g + 2, col + 1, pair(String(tc.ratio[g]), x.c ? String(x.c.ratio[g]) : ''));
    }
    setCell(7, 11, col, String(x.t.total)); setCell(7, 11, col + 1, '100');
    setCell(8, 11, col, pair(String(tc.total), x.c ? String(x.c.total) : ''));
  });
  // T9 1·2등급 비율 / T10 비교
  d.g12.forEach((x, si) => {
    setCell(9, 1, si + 1, `${x.t.cnt} / ${x.t.ratio}`);
    const tc = x.tc || x.t;
    setCell(10, 1, si + 1, pair(`${tc.cnt} / ${tc.ratio}`, x.c ? `${x.c.cnt} / ${x.c.ratio}` : ''));
  });
  // T11 탐구 등급 인원 / T12 탐구 1·2등급 비율
  d.distExplore.forEach((x, si) => {
    const col = 1 + si * 2;
    for (let g = 0; g < 9; g++) {
      setCell(11, g + 2, col, String(x.dist[g]));
      setCell(11, g + 2, col + 1, String(x.ratio[g]));
    }
    setCell(11, 11, col, String(x.total)); setCell(11, 11, col + 1, '100');
  });
  d.g12Explore.forEach((x, si) => {
    setCell(12, 1, si + 1, `${x.cnt} / ${x.ratio}`);
    setCell(12, 2, si + 1, `${x.cnt} / ${x.ratio}`);
  });
  // T13 성적 상위자 20명 (출신중학교 칸은 입력 자료에 없어 비워둔다)
  for (let i = 0; i < 20; i++) {
    const x = d.top20[i];
    const r = i + 2;
    const vals = x
      ? [x.order, x.name, '', x.sum, x.rank, x.kor, x.korGrade, x.math, x.mathGrade, x.engGrade, x.hisGrade, x.socGrade, x.soc, x.sciGrade, x.sci]
      : Array(15).fill('');
    vals.forEach((v, c) => setCell(13, r, c, s2(v)));
  }

  // 표 밖의 글자들
  const paras = all(doc.documentElement, 'p');
  const titleP = paras.find(p => /결과\s*분석/.test(ownText(p)) && /학력평가|모의평가/.test(ownText(p)));
  if (titleP && d.title) setParaText(titleP, d.title);
  const introP = paras.find(p => ownText(p).trim().startsWith('본 자료는'));
  if (introP && d.intro) setParaText(introP, d.intro);
  const deptP = paras.find(p => ownText(p).includes('자료 분석'));
  if (deptP && d.dept) setParaText(deptP, `※ 자료 분석: ${d.dept}`);
  // "재학생 N명", "(2026 / 2025)" 같은 짧은 문구는 글자 조각 단위로 바꿔 글자 모양을 그대로 둔다
  all(doc.documentElement, 't').forEach(t => {
    Array.from(t.childNodes).forEach(n => {
      if (n.nodeType !== 3) return;
      let v = n.nodeValue;
      v = v.replace(/재학생\s*\d+\s*명/g, `재학생 ${d.N}명`);
      v = v.replace(/\(\s*\d{4}\s*\/\s*\d{4}\s*\)/g, `(${d.targetLabel} / ${d.compareLabel})`);
      if (v !== n.nodeValue) n.nodeValue = v;
    });
  });

  // 비교 자료가 없으면 비교 절(3-1, 4-1, 4-2, 5-1, 6-1)을 통째로 뺀다
  if (!d.includeCompare) {
    const top = kids(doc.documentElement, 'p');
    const headingOf = p => { const m = ownText(p).trim().match(/^(\d+(?:-\d+)?)\.\s/); return m ? m[1] : null; };
    const compareIds = new Set(['3-1', '4-1', '4-2', '5-1', '6-1']);
    let removing = false;
    top.forEach((p, i) => {
      if (i === 0) return; // 첫 문단은 문서 설정(secPr)을 담고 있어 절대 지우지 않는다
      const h = headingOf(p);
      if (h) removing = compareIds.has(h);
      if (removing) p.parentNode.removeChild(p);
    });
  }

  const body = new Serializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>\s*/, '');
  return decl + body;
}

async function exportHwpxReport(opts) {
  if (typeof JSZip === 'undefined') throw new Error('압축 라이브러리(JSZip)를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  const data = buildHwpxReportData(opts);
  const buf = await loadTemplateArrayBuffer(HWPX_TEMPLATE_PATH, '결과 보고서(HWPX)');
  const zip = await JSZip.loadAsync(buf);
  const sectionPath = 'Contents/section0.xml';
  const xml = await zip.file(sectionPath).async('string');
  // mimetype 항목은 원본대로 압축하지 않은 채 맨 앞에 남는다 (HWPX 규칙)
  const blob = await rebuildZip(zip, { [sectionPath]: fillHwpxSection(xml, data, DOMParser, XMLSerializer) }, 'application/hwp+zip');
  downloadBlob(blob, `${(opts.title || '결과 분석').replace(/[\\/:*?"<>|]/g, '_')}.hwpx`);
}

// ======================= 2. 대교협 분석자료 XLSX =======================

// 대교협 서식의 '코드표' 시트 과목명 표기 (공백·가운뎃점·로마숫자까지 서식과 똑같이 써야 인식된다)
const DAEGYO_SUBJECT_NAMES = [
  '국어', '언어와 매체', '화법과 작문', '수학', '확률과 통계', '미적분', '기하',
  '한국 지리', '윤리와 사상', '생활과 윤리', '사회·문화', '경제', '세계사', '동아시아사', '세계 지리', '사회', '정치와 법',
  '물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ', '생명 과학Ⅰ', '생명 과학Ⅱ', '지구 과학Ⅰ', '지구 과학Ⅱ', '과학',
  '농업 기초 기술', '공업 일반', '상업 경제', '수산·해운 산업 기초', '인간 발달', '성공적인 직업생활',
  '독일어Ⅰ', '프랑스어Ⅰ', '스페인어Ⅰ', '중국어Ⅰ', '일본어Ⅰ', '러시아어Ⅰ', '아랍어Ⅰ', '베트남어Ⅰ', '한문Ⅰ'
];
function daegyoSubjectName(name) {
  if (!name) return '';
  const norm = s => String(s).replace(/\s+/g, '').replace(/[·∙ㆍ·]/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II');
  const target = norm(name);
  return DAEGYO_SUBJECT_NAMES.find(n => norm(n) === target) || name;
}

// '저장' 시트 한 줄(A~AF)에 들어갈 값들
function buildDaegyoRows(schoolYear) {
  const examYear = currentExamInfo().year;
  const sorted = (parsedData || []).slice().sort((a, b) =>
    (Number(a.학년) - Number(b.학년)) || (Number(a.반) - Number(b.반)) || (Number(a.번호) - Number(b.번호)));
  return sorted.map(s => {
    const exps = exploreEntriesOf(s, examYear);
    const e1 = exps[0] || {}, e2 = exps[1] || {};
    const hasScore = rec => !!rec && ['원점수', '표준점수'].some(f => String(rec[f] || '').trim() !== '');
    return {
      A: numOrBlank(schoolYear), B: numOrBlank(s.학년), C: numOrBlank(s.반), D: numOrBlank(s.번호), E: s.이름 || '',
      // 한국사 (원점수는 [영역별 기준] 성적표·CSV처럼 파일에 있을 때만 들어간다)
      F: numOrBlank(s.한국사?.원점수), G: subjectGrade(s, '한국사'),
      // 국어
      H: hasScore(s.국어) ? daegyoSubjectName(s.국어.과목 || '국어') : '',
      I: numOrBlank(s.국어?.원점수), J: numOrBlank(s.국어?.표준점수), K: numOrBlank(s.국어?.백분위),
      L: hasScore(s.국어) ? subjectGrade(s, '국어') : '',
      // 수학
      M: hasScore(s.수학) ? daegyoSubjectName(s.수학.과목 || '수학') : '',
      N: numOrBlank(s.수학?.원점수), O: numOrBlank(s.수학?.표준점수), P: numOrBlank(s.수학?.백분위),
      Q: hasScore(s.수학) ? subjectGrade(s, '수학') : '',
      // 영어 (원점수는 파일에 있을 때만)
      R: numOrBlank(s.영어?.원점수), S: subjectGrade(s, '영어'),
      // 탐구1 / 탐구2
      T: daegyoSubjectName(e1.과목), U: numOrBlank(e1.원점수), V: numOrBlank(e1.표준점수), W: numOrBlank(e1.백분위), X: numOrBlank(e1.등급),
      Y: daegyoSubjectName(e2.과목), Z: numOrBlank(e2.원점수), AA: numOrBlank(e2.표준점수), AB: numOrBlank(e2.백분위), AC: numOrBlank(e2.등급),
      // 제2외국어 ([영역별 기준] 성적표에만 있음)
      AD: s.제2외국어 ? daegyoSubjectName(s.제2외국어.과목) : '',
      AE: s.제2외국어 ? numOrBlank(s.제2외국어.원점수) : '',
      AF: s.제2외국어 ? numOrBlank(s.제2외국어.등급) : ''
    };
  });
}

// '저장' 시트 XML에서 데이터 칸만 바꾼다. 나머지 글자는 한 글자도 건드리지 않도록
// 문서 전체를 다시 쓰지 않고, 비어 있는 셀 태그(<c r="A4" s="19"/>)만 값이 든 셀로 교체한다.
function fillDaegyoSheetXml(xml, rows, startRow) {
  const first = startRow || 4;
  const byRow = new Map(rows.map((r, i) => [first + i, r]));
  const isBlank = v => v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v));
  const cellXml = (ref, attrs, v) => {
    const a = attrs.replace(/\s+t="[^"]*"/, '');
    return (typeof v === 'number')
      ? `<c r="${ref}"${a}><v>${v}</v></c>`
      : `<c r="${ref}"${a} t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`;
  };
  let written = 0;
  const writtenRows = new Set();
  let out = '';
  let last = 0;
  const rowOpen = /<row r="(\d+)"[^>]*?(\/?)>/g;
  let m;
  while ((m = rowOpen.exec(xml))) {
    if (m[2] === '/') continue; // 빈 줄(자식 없음)
    const rn = Number(m[1]);
    const bodyStart = m.index + m[0].length;
    const bodyEnd = xml.indexOf('</row>', bodyStart);
    if (bodyEnd < 0) break;
    const vals = byRow.get(rn);
    if (vals) {
      const body = xml.slice(bodyStart, bodyEnd).replace(/<c r="([A-Z]+)(\d+)"([^>]*?)\/>/g, (whole, col, n, attrs) => {
        const v = vals[col];
        if (isBlank(v)) return whole;
        written++;
        writtenRows.add(rn);
        return cellXml(col + n, attrs, v);
      });
      out += xml.slice(last, bodyStart) + body;
      last = bodyEnd;
    }
    rowOpen.lastIndex = bodyEnd;
  }
  out += xml.slice(last);
  return { xml: out, written, rowsWritten: writtenRows.size };
}

// 시트 이름으로 워크시트 파일 경로를 찾는다 (workbook.xml·rels는 읽기만 한다)
async function findSheetPath(zip, sheetName) {
  const wb = await zip.file('xl/workbook.xml').async('string');
  const sheetTag = (wb.match(new RegExp(`<sheet [^>]*name="${sheetName}"[^>]*/>`)) || [])[0];
  const rid = sheetTag && (sheetTag.match(/r:id="([^"]+)"/) || [])[1];
  if (!rid) throw new Error(`서식에서 '${sheetName}' 시트를 찾지 못했습니다.`);
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relTag = (rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*/>`)) || [])[0];
  const target = relTag && (relTag.match(/Target="([^"]+)"/) || [])[1];
  if (!target) throw new Error(`'${sheetName}' 시트 파일 위치를 찾지 못했습니다.`);
  return target.startsWith('/') ? target.slice(1) : 'xl/' + target;
}

async function exportDaegyoXlsx(opts) {
  if (typeof JSZip === 'undefined') throw new Error('압축 라이브러리(JSZip)를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  const rows = buildDaegyoRows(opts.schoolYear);
  if (!rows.length) throw new Error('내보낼 학생 데이터가 없습니다. 먼저 성적 파일을 업로드해주세요.');
  const buf = await loadTemplateArrayBuffer(DAEGYO_TEMPLATE_PATH, '대교협 분석자료(XLSX)');
  const zip = await JSZip.loadAsync(buf);
  const sheetPath = await findSheetPath(zip, '저장');
  const xml = await zip.file(sheetPath).async('string');
  const result = fillDaegyoSheetXml(xml, rows, 4);
  const blob = await rebuildZip(zip, { [sheetPath]: result.xml }, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const grades = [...new Set(rows.map(r => r.B).filter(v => v !== ''))].join('_');
  downloadBlob(blob, `대교협_분석자료_${opts.schoolYear}학년도${grades ? '_' + grades + '학년' : ''}.xlsx`);
  return { students: rows.length, rowsWritten: result.rowsWritten };
}

// ======================= 내보내기 대화상자 =======================

function closeExportDialog() {
  document.getElementById('exportDialog')?.remove();
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'none';
}

function openExportDialog(kind) {
  if (!parsedData || !parsedData.length) {
    showMessage('먼저 성적 파일을 업로드해주세요.');
    return;
  }
  closeExportDialog();
  const info = currentExamInfo();
  const hasCompare = typeof getCompareCompareData === 'function' && getCompareCompareData().length > 0;
  const remembered = key => { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } };
  const esc = s => xmlEscape(s || '');
  const dlg = document.createElement('div');
  dlg.id = 'exportDialog';
  dlg.className = 'modal-card export-dialog';
  dlg.style.display = 'block';

  if (kind === 'hwpx') {
    const examName = info.isSat ? '모의평가' : '전국연합학력평가';
    const title = `${info.year}학년도 ${info.month ? info.month + '월 ' : ''}${examName} 결과 분석`;
    const agency = remembered('export.agency') || '○○교육청';
    const cYear = gradeCuts.compare.year || '';
    const cMonth = (window.__lastEbsiCompareExam && extractMonthFromExamText(window.__lastEbsiCompareExam.examText)) || info.month;
    const compareNote = hasCompare && cYear ? ` (비교 분석: ${info.year} ${info.month}평 vs. ${cYear} ${cMonth}평)` : '';
    const dateText = info.month ? `${info.year}년 ${info.month}월${info.day ? ' ' + info.day + '일' : ''}` : `${info.year}년`;
    const intro = `본 자료는 ${dateText} ${agency}에서 제공한 ${info.year}학년도 ${info.month ? info.month + '월 ' : ''}${info.grade ? '고' + info.grade + ' ' : ''}${examName} 채점결과를 바탕으로 작성하였으며 내부 자료로만 활용하는 것을 원칙으로 합니다.${compareNote}`;
    const dept = remembered('export.dept') || (info.grade ? `${info.grade}학년부` : '');
    dlg.innerHTML = `
      <h3>결과 분석 보고서 내보내기 (HWPX)</h3>
      <label class="export-field">제목<input id="expTitle" type="text" value="${esc(title)}"></label>
      <label class="export-field">안내문<textarea id="expIntro" rows="4">${esc(intro)}</textarea></label>
      <label class="export-field">자료 분석 부서<input id="expDept" type="text" value="${esc(dept)}"></label>
      <label class="export-check"><input id="expCompare" type="checkbox" ${hasCompare ? 'checked' : 'disabled'}>
        비교 분석 포함 ${hasCompare ? '' : '<span class="export-hint">(비교 파일을 먼저 올려야 합니다)</span>'}</label>
      <p class="export-hint">안내문의 교육청 이름은 직접 확인해 고쳐주세요. 성적 상위자 표의 출신 중학교 칸은 입력 자료에 없어 비워둡니다.</p>
      <div class="btn-row export-actions">
        <button type="button" class="action-btn-secondary" onclick="closeExportDialog()">취소</button>
        <button type="button" class="action-btn" id="expRun">내보내기</button>
      </div>`;
  } else {
    // 대교협 서식 안내: "학년도는 1, 2, 3학년 모두 (올해 입시) 학년도로 입력" — 시험 연도가 아니라
    // 지금 준비하는 입시 학년도(올해+1)가 기본값이다 (작년 시험 파일을 내보내도 같은 학년도)
    const defaultYear = new Date().getFullYear() + 1;
    dlg.innerHTML = `
      <h3>대교협 분석자료 내보내기 (XLSX)</h3>
      <label class="export-field">학년도<input id="expSchoolYear" type="number" min="2000" max="2100" value="${defaultYear}"></label>
      <p class="export-hint">서식 안내에 따라 1·2·3학년 모두 같은 학년도(올해 입시 학년도)로 입력합니다.</p>
      <p class="export-hint">'저장' 시트에 학생 ${parsedData.length}명의 자료를 채웁니다. ${window.uploadedReportFormat === 'area'
        ? '영역별 기준 성적표라 원점수·백분위·등급과 제2외국어까지 공식 값으로 채웁니다.'
        : '영어·한국사 원점수와 제2외국어는 파일에 없으면 비워둡니다.'}</p>
      <div class="btn-row export-actions">
        <button type="button" class="action-btn-secondary" onclick="closeExportDialog()">취소</button>
        <button type="button" class="action-btn" id="expRun">내보내기</button>
      </div>`;
  }

  document.body.appendChild(dlg);
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'block';

  document.getElementById('expRun').onclick = async () => {
    try {
      showLoading();
      if (kind === 'hwpx') {
        const opts = {
          title: document.getElementById('expTitle').value.trim(),
          intro: document.getElementById('expIntro').value.trim(),
          dept: document.getElementById('expDept').value.trim(),
          includeCompare: document.getElementById('expCompare').checked,
          targetLabel: (typeof getTargetYear === 'function' ? getTargetYear() : '') || '대상',
          compareLabel: gradeCuts.compare.year || '비교'
        };
        try {
          localStorage.setItem('export.dept', opts.dept);
          const agency = (opts.intro.match(/\s(\S+교육청)에서/) || [])[1];
          if (agency && agency !== '○○교육청') localStorage.setItem('export.agency', agency);
        } catch (e) { /* 저장 실패는 무시 */ }
        closeExportDialog();
        await exportHwpxReport(opts);
        showToast('결과 분석 보고서(HWPX)를 내보냈습니다.');
      } else {
        const schoolYear = document.getElementById('expSchoolYear').value.trim();
        if (!/^\d{4}$/.test(schoolYear)) { hideLoading(); showMessage('학년도를 4자리 숫자로 입력해주세요.'); return; }
        closeExportDialog();
        const r = await exportDaegyoXlsx({ schoolYear });
        if (r.students > r.rowsWritten) {
          showMessage(`서식의 입력 칸이 부족해 ${r.students}명 중 ${r.rowsWritten}명만 채웠습니다.`);
        } else {
          showToast(`대교협 분석자료(XLSX)를 내보냈습니다. (${r.rowsWritten}명)`);
        }
      }
    } catch (e) {
      console.error(e);
      showMessage('내보내기 중 오류가 발생했습니다.\n' + (e?.message || e));
    } finally {
      hideLoading();
    }
  };
}

// Node(테스트)에서 불러올 수 있도록
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fillHwpxSection, fillDaegyoSheetXml, daegyoSubjectName, rebuildZip };
}
