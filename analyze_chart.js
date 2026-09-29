// Chart.js 라이브러리 사용을 위한 그래프 기능
class AnalysisChart {
  constructor() {
    this.charts = {};
  }

  // a) 점수 분포 그래프 (히스토그램 + 기준선)
  createScoreDistribution(containerId, data, subject, scoreType) {
    const ctx = document.getElementById(containerId).getContext('2d');
    const scores = data.map(s => toScore(s[subject]?.[scoreType])).filter(n => !isNaN(n));
    if (!scores.length) return;
    scores.sort((a, b) => a - b);
    const min = scores[0];
    const max = scores[scores.length - 1];
    const binCount = 12;
    const binWidth = Math.max(1, Math.ceil((max - min + 1) / binCount));
    const bins = [];
    const labels = [];
    for (let i = 0; i < binCount; i++) {
      const start = min + i * binWidth;
      const end = Math.min(max, start + binWidth - 1);
      labels.push(`${start}~${end}`);
      bins.push({ start, end, count: 0 });
    }
    scores.forEach(v => {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      bins[idx].count++;
    });
    const counts = bins.map(b => b.count);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const topX = p => { const c = Math.ceil(scores.length * p); return scores.slice(-c).reduce((a, b) => a + b, 0) / c; };
    const posToLabel = v => labels[Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / binWidth)))]

    this.charts[containerId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: '인원(명)', data: counts, backgroundColor: 'rgba(59, 130, 246, 0.75)', hoverBackgroundColor: 'rgba(37, 99, 235, 1)', borderRadius: 2 }] },
      options: {
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: {
          tooltip: { callbacks: { label: (ctx) => `빈도: ${ctx.raw}` } },
          annotation: {
            annotations: {
              avgLine: { type: 'line', xMin: posToLabel(avg), xMax: posToLabel(avg), borderColor: 'red', label: { content: '평균', enabled: true, rotation: 90 } },
              top10: { type: 'line', xMin: posToLabel(topX(0.1)), xMax: posToLabel(topX(0.1)), borderColor: 'green', label: { content: '상위10%', enabled: true, rotation: 90 } },
              top20: { type: 'line', xMin: posToLabel(topX(0.2)), xMax: posToLabel(topX(0.2)), borderColor: 'orange', label: { content: '상위20%', enabled: true, rotation: 90 } },
              top30: { type: 'line', xMin: posToLabel(topX(0.3)), xMax: posToLabel(topX(0.3)), borderColor: 'purple', label: { content: '상위30%', enabled: true, rotation: 90 } },
            }
          }
        }
      }
    });
  }

  // b,c) 등급별 막대 그래프
  createGradePieChart(containerId, gradeData, subject) {
    const ctx = document.getElementById(containerId).getContext('2d');
    const labels = ['1등급', '2등급', '3등급', '4등급', '5등급', '6등급', '7등급', '8등급', '9등급'];
    const ratios = gradeData.ratio.map(v => Number(v));
    this.charts[containerId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: '비율(%)', data: ratios, backgroundColor: 'rgba(37,99,235,0.8)' }] },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const i = ctx.dataIndex; return `${labels[i]}: ${gradeData.dist[i]}명 (${gradeData.ratio[i]}%)`;
              }
            }
          }
        }
      }
    });
  }

  // d) 연도별 누적 막대 그래프
  createComparisonBarChart(containerId, targetData, compareData, subject) {
    const ctx = document.getElementById(containerId).getContext('2d');

    this.charts[containerId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1등급', '2등급', '3등급', '4등급', '5등급', '6등급', '7등급', '8등급', '9등급'],
        datasets: [{
          label: '대상 (현재)',
          data: targetData.ratio,
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 2
        }, {
          label: '비교 (이전)',
          data: compareData.ratio,
          backgroundColor: 'rgba(239, 68, 68, 0.35)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 2,
          borderDash: [5, 3]
        }]
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const grade = context.dataIndex + 1;
                const isTarget = context.datasetIndex === 0;
                const data = isTarget ? targetData : compareData;
                return `${context.dataset.label} ${grade}등급: ${data.dist[context.dataIndex]}명 (${context.raw}%)`;
              }
            }
          },
          legend: {
            labels: { font: { weight: 'bold' } }
          }
        }
      }
    });
  }

  // e) 1,2등급 비율 막대 그래프
  createGrade12ComparisonChart(containerId, targetData, compareData) {
    const ctx = document.getElementById(containerId).getContext('2d');

    this.charts[containerId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['국어', '수학', '영어'],
        datasets: [{
          label: '대상년도',
          data: [targetData.korean.ratio, targetData.math.ratio, targetData.english.ratio],
          backgroundColor: 'rgba(37, 99, 235, 0.8)'
        }, {
          label: '비교년도',
          data: [compareData.korean.ratio, compareData.math.ratio, compareData.english.ratio],
          backgroundColor: 'rgba(239, 68, 68, 0.8)'
        }]
      }
    });
  }

  destroyChart(containerId) {
    if (this.charts[containerId]) {
      this.charts[containerId].destroy();
      delete this.charts[containerId];
    }
  }
}

// f) 누적분포(CDF) 라인 차트 + 분위수 라인
AnalysisChart.prototype.createCdfChart = function (containerId, data, subject, scoreType) {
  this.destroyChart(containerId);
  const ctx = document.getElementById(containerId)?.getContext('2d');
  if (!ctx) return;

  const scores = data.map(s => toScore(s[subject]?.[scoreType])).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (!scores.length) return;
  const n = scores.length;

  // 고유 점수 추출 및 오름차순 정렬 (X축 라벨)
  const uniqueScores = [...new Set(scores)].sort((a, b) => a - b);
  const labels = uniqueScores;

  // 각 고유 점수별 누적 빈도 계산
  const cdfPoints = [];
  let cumulativeCount = 0;
  let scoreIndex = 0;

  for (const us of uniqueScores) {
    while (scoreIndex < n && scores[scoreIndex] <= us) {
      cumulativeCount++;
      scoreIndex++;
    }
    cdfPoints.push({ x: us, y: Number((cumulativeCount / n * 100).toFixed(2)) });
  }

  // 분위수 계산
  const q = p => scores[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  const q10 = q(0.10), q25 = q(0.25), q50 = q(0.50), q75 = q(0.75), q90 = q(0.90);

  this.charts[containerId] = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{ label: '누적 비율(%)', data: cdfPoints, borderColor: 'rgba(37,99,235,0.9)', backgroundColor: 'rgba(37,99,235,0.15)', fill: true, tension: 0.1, pointRadius: 0, pointHoverRadius: 5 }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'linear', title: { display: true, text: scoreType }, min: Math.max(0, uniqueScores[0] - 10), max: Math.ceil(uniqueScores[uniqueScores.length - 1] / 10) * 10 },
        y: { beginAtZero: true, max: 100, title: { display: true, text: '누적 학생 비율(%)' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (ctx) { return `${ctx.parsed.x}점 이하: ${ctx.parsed.y}%`; }
          }
        },
        annotation: {
          annotations: {
            q10: { type: 'line', scaleID: 'x', value: q10, borderColor: '#9ca3af', borderDash: [4, 4], label: { content: 'P10', display: true, position: 'start' } },
            q25: { type: 'line', scaleID: 'x', value: q25, borderColor: '#6b7280', borderDash: [4, 4], label: { content: 'P25', display: true, position: 'start' } },
            q50: { type: 'line', scaleID: 'x', value: q50, borderColor: '#111827', borderWidth: 2, label: { content: 'Median', display: true, position: 'start' } },
            q75: { type: 'line', scaleID: 'x', value: q75, borderColor: '#6b7280', borderDash: [4, 4], label: { content: 'P75', display: true, position: 'start' } },
            q90: { type: 'line', scaleID: 'x', value: q90, borderColor: '#ef4444', borderDash: [4, 4], label: { content: 'P90', display: true, position: 'start' } },
          }
        }
      }
    }
  });
};

// 표준점수 분포 비교 (대상 vs 비교 겹침 히스토그램)
AnalysisChart.prototype.createStdScoreComparisonChart = function (containerId, targetData, compareData, subject) {
  this.destroyChart(containerId);
  const ctx = document.getElementById(containerId)?.getContext('2d');
  if (!ctx) return;

  const getScores = (data) => data.map(s => toScore(s[subject]?.표준점수)).filter(v => !isNaN(v));
  const targetScores = getScores(targetData);
  const compareScores = getScores(compareData);

  if (!targetScores.length && !compareScores.length) return;

  // 히스토그램 구간 (10점 단위)
  const allScores = [...targetScores, ...compareScores];
  const minScore = Math.floor(Math.min(...allScores) / 10) * 10;
  const maxScore = Math.ceil(Math.max(...allScores) / 10) * 10;
  const bins = [];
  for (let i = minScore; i < maxScore; i += 5) bins.push(i);

  const histogram = (scores) => {
    const counts = new Array(bins.length).fill(0);
    scores.forEach(s => {
      for (let i = 0; i < bins.length; i++) {
        if (s >= bins[i] && (i === bins.length - 1 || s < bins[i] + 5)) {
          counts[i]++;
          break;
        }
      }
    });
    return counts;
  };

  const targetHist = histogram(targetScores);
  const compareHist = histogram(compareScores);

  this.charts[containerId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins.map(b => `${b}~${b + 4}`),
      datasets: [{
        label: '대상 (올해)',
        data: targetHist,
        backgroundColor: 'rgba(37, 99, 235, 0.6)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1
      }, {
        label: '비교 (이전)',
        data: compareHist,
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        borderDash: [4, 2]
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: `${subject} 표준점수 분포 비교` },
        legend: { labels: { font: { weight: 'bold' } } }
      },
      scales: {
        x: { title: { display: true, text: '표준점수' } },
        y: { title: { display: true, text: '인원(명)' }, beginAtZero: true }
      }
    }
  });
};

// -------------------------------------------------------------------------------------
// 신규 심화 성적 분석 전용 차트 함수 5종 추가
// -------------------------------------------------------------------------------------

// 1. 과목 간 상관관계 산점도 (Scatter Plot) - 학급별 다중 데이터셋 범례 필터링
AnalysisChart.prototype.createAdvScatterChart = function (containerId, data) {
  this.destroyChart(containerId);
  const ctx = document.getElementById(containerId)?.getContext('2d');
  if (!ctx || !data || !data.length) return;

  // 반별로 데이터 분류
  const classDataMap = {};
  data.forEach(s => {
    const k = Number(s['국어']?.표준점수 ?? NaN);
    const m = Number(s['수학']?.표준점수 ?? NaN);
    const cls = s.반;
    if (cls && !isNaN(k) && !isNaN(m) && k > 0 && m > 0) {
      if (!classDataMap[cls]) classDataMap[cls] = [];
      classDataMap[cls].push({ x: k, y: m, student: `${cls}반 ${s.번호}번 ${s.이름}` });
    }
  });

  const classes = Object.keys(classDataMap).sort((a,b) => parseInt(a) - parseInt(b));
  
  // 색상 팔레트 (Distinct colors for classes up to 15 classes safely)
  const colors = [
    'rgba(239, 68, 68, 0.7)',   // Red
    'rgba(59, 130, 246, 0.7)',  // Blue
    'rgba(16, 185, 129, 0.7)',  // Green
    'rgba(245, 158, 11, 0.7)',  // Yellow
    'rgba(139, 92, 246, 0.7)',  // Purple
    'rgba(236, 72, 153, 0.7)',  // Pink
    'rgba(20, 184, 166, 0.7)',  // Teal
    'rgba(249, 115, 22, 0.7)',  // Orange
    'rgba(99, 102, 241, 0.7)',  // Indigo
    'rgba(132, 204, 22, 0.7)',  // Lime
    'rgba(168, 85, 247, 0.7)',  // Fuchsia
    'rgba(14, 165, 233, 0.7)'   // Sky
  ];

  const datasets = classes.map((cls, idx) => {
    const color = colors[idx % colors.length];
    return {
      label: `${cls}반`,
      data: classDataMap[cls],
      backgroundColor: color,
      borderColor: color.replace('0.7', '1'),
      pointRadius: 4,
      pointHoverRadius: 6
    };
  });

  this.charts[containerId] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    options: {
      plugins: {
        title: { display: false },
        legend: {
          display: true,
          position: 'top',
          labels: { font: { weight: 'bold', size: 12 }, usePointStyle: true, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const p = ctx.raw;
              return `${p.student} (국어 표점: ${p.x}, 수학 표점: ${p.y})`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: '국어 표준점수' } },
        y: { title: { display: true, text: '수학 표준점수' } }
      }
    }
  });
};

// 2. 학급별 평균 성취도 편차 비교 (Diverging Grouped Bar Chart)
AnalysisChart.prototype.createAdvDivergingBarChart = function (containerId, data) {
  this.destroyChart(containerId);
  const ctx = document.getElementById(containerId)?.getContext('2d');
  if (!ctx || !data || !data.length) return;

  const classGroups = {};
  let kSum = 0, kCnt = 0;
  let mSum = 0, mCnt = 0;

  data.forEach(s => {
    const cls = s.반;
    if (!cls) return;
    if (!classGroups[cls]) classGroups[cls] = { kSum: 0, kCnt: 0, mSum: 0, mCnt: 0 };

    const kScore = Number(s['국어']?.표준점수 ?? NaN);
    const mScore = Number(s['수학']?.표준점수 ?? NaN);

    if (!isNaN(kScore) && kScore > 0) {
      classGroups[cls].kSum += kScore; classGroups[cls].kCnt++;
      kSum += kScore; kCnt++;
    }
    if (!isNaN(mScore) && mScore > 0) {
      classGroups[cls].mSum += mScore; classGroups[cls].mCnt++;
      mSum += mScore; mCnt++;
    }
  });

  const kAvg = kCnt > 0 ? kSum / kCnt : NaN;
  const mAvg = mCnt > 0 ? mSum / mCnt : NaN;

  const classes = Object.keys(classGroups).sort((a, b) => parseInt(a) - parseInt(b));
  if (!classes.length) return;

  const labels = classes.map(c => `${c}반`);
  const kDiffData = classes.map(c => {
    const p = classGroups[c];
    return p.kCnt > 0 ? parseFloat((p.kSum / p.kCnt - kAvg).toFixed(2)) : 0;
  });
  const mDiffData = classes.map(c => {
    const p = classGroups[c];
    return p.mCnt > 0 ? parseFloat((p.mSum / p.mCnt - mAvg).toFixed(2)) : 0;
  });

  this.charts[containerId] = new Chart(ctx, {
    type: 'bar',
    plugins: [window.ChartDataLabels], // Global datalabels plugin instance is window.ChartDataLabels or ChartDataLabels depending on spec
    data: {
      labels: labels,
      datasets: [
        {
          label: '국어 표점 편차',
          data: kDiffData,
          backgroundColor: kDiffData.map(d => d >= 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.3)'),
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        },
        {
          label: '수학 표점 편차',
          data: mDiffData,
          backgroundColor: mDiffData.map(d => d >= 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)'),
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          title: { display: true, text: '평균 편차 (표준점수)' },
          grid: { color: (ctx) => ctx.tick.value === 0 ? '#111827' : '#e5e7eb', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1 }
        }
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}점` } },
        datalabels: {
          color: '#4b5563',
          font: { size: 10, weight: 'bold' },
          formatter: (value) => value > 0 ? `+${value}` : value,
          anchor: (context) => context.dataset.data[context.dataIndex] >= 0 ? 'end' : 'start',
          align: (context) => context.dataset.data[context.dataIndex] >= 0 ? 'right' : 'left',
          offset: 4
        }
      }
    }
  });
};

// 4. 학급별 성적 밀집도 히트맵 (HTML Table)
AnalysisChart.prototype.renderAdvHeatmap = function (container, data) {
  const processClassCount = (subjectName, colorRatioFunc) => {
    const classCount = {};
    data.forEach(s => {
      const cls = s.반;
      // 파일에 등급 칸이 없는 경우가 많아(표준점수 성적표·XLSX), 다른 화면과 같은 규칙으로 등급을 매긴다
      const grade = (typeof studentGradeFor === 'function')
        ? (studentGradeFor(s, subjectName, 'target') ?? NaN)
        : Number(s[subjectName]?.등급 ?? NaN);
      if (cls && !isNaN(grade) && grade >= 1 && grade <= 9) {
        if (!classCount[cls]) classCount[cls] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, total: 0 };
        classCount[cls][grade]++;
        classCount[cls].total++;
      }
    });

    const classes = Object.keys(classCount).sort((a, b) => parseInt(a) - parseInt(b));
    if (!classes.length) return '';

    let html = `<table class="stats-table" style="text-align:center; font-size:0.85rem; border-collapse: collapse; min-width: 500px;">
    <thead><tr><th style="background:#f3f4f6;">반 \\ ${subjectName} 등급</th>`;
    for (let i = 1; i <= 9; i++) html += `<th>${i}등급</th>`;
    html += `</tr></thead><tbody>`;

    classes.forEach(cls => {
      html += `<tr><td style="font-weight:bold; background:#f9fafb;">${cls}반</td>`;
      for (let i = 1; i <= 9; i++) {
        const cnt = classCount[cls][i];
        const ratio = classCount[cls].total > 0 ? (cnt / classCount[cls].total) : 0;
        const alpha = Math.min(1, Math.max(0, ratio * 2.5));
        const bgColor = colorRatioFunc(alpha);
        const fgColor = alpha > 0.5 ? '#fff' : '#111827';
        html += `<td style="background-color: ${bgColor}; color: ${fgColor};" title="${cls}반 ${subjectName} ${i}등급: ${cnt}명">${cnt > 0 ? cnt : ''}</td>`;
      }
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    return html;
  };

  const korHtml = processClassCount('국어', (alpha) => `rgba(239, 68, 68, ${alpha})`); // 붉은색
  const mathHtml = processClassCount('수학', (alpha) => `rgba(59, 130, 246, ${alpha})`); // 푸른색

  if (!korHtml && !mathHtml) {
    container.innerHTML = '<p style="color:#666;">등급 데이터나 반별 정보가 부족합니다.</p>';
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div><h5 style="margin: 0 0 10px 0;">🔴 국어 밀집도</h5>${korHtml}</div>
      <div><h5 style="margin: 0 0 10px 0;">🔵 수학 밀집도</h5>${mathHtml}</div>
    </div>
  `;
};

// 5. 학급별 상자 수염/범위 차트 (Floating Bar Chart)
AnalysisChart.prototype.createAdvBoxplotChart = function (containerId, data) {
  this.destroyChart(containerId);
  const ctx = document.getElementById(containerId)?.getContext('2d');
  if (!ctx || !data || !data.length) return;

  const classData = {};
  data.forEach(s => {
    const cls = s.반;
    // CSV 내 합산 점수가 없을 수 있으므로 국어/수학 표점 동적 합산
    const kScore = Number(s['국어']?.표준점수 ?? 0);
    const mScore = Number(s['수학']?.표준점수 ?? 0);
    let sumScore = kScore + mScore;

    if (sumScore === 0) {
      sumScore = Number(s.sum || 0); // 실패 시 기존 sum 폴백 시도
    }

    if (cls && !isNaN(sumScore) && sumScore > 0) {
      if (!classData[cls]) classData[cls] = [];
      classData[cls].push(sumScore);
    }
  });

  const classes = Object.keys(classData).sort((a, b) => parseInt(a) - parseInt(b));
  if (!classes.length) return;

  const q1q3Data = [];
  const minMaxData = [];
  const medians = [];

  classes.forEach(cls => {
    const scores = classData[cls].sort((a, b) => a - b);
    const n = scores.length;
    minMaxData.push([scores[0], scores[n - 1]]);
    q1q3Data.push([scores[Math.floor(n * 0.25)], scores[Math.floor(n * 0.75)]]);
    medians.push(scores[Math.floor(n * 0.5)]);
  });

  this.charts[containerId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: classes.map(c => `${c}반`),
      datasets: [
        {
          type: 'line',
          label: '중앙값(Median)',
          data: medians,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          borderWidth: 2,
          pointRadius: 4,
          fill: false,
        },
        {
          label: '주요 분포 (상위 25% ~ 75%)',
          data: q1q3Data,
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          barPercentage: 0.5,
        },
        {
          label: '전체 범위 (최저점 ~ 최고점)',
          data: minMaxData,
          backgroundColor: 'rgba(156, 163, 175, 0.3)',
          grouped: false, // 겹치게 그림
          barPercentage: 0.1,
        }
      ]
    },
    options: {
      scales: {
        y: { title: { display: true, text: '평균 학업 성취 지표 (국수 표점합)' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.datasetIndex === 0) return `중앙값: ${ctx.raw}점`;
              if (ctx.datasetIndex === 1) return `분포(Q1-Q3): ${ctx.raw[0]}점 ~ ${ctx.raw[1]}점`;
              if (ctx.datasetIndex === 2) return `범위(Min-Max): ${ctx.raw[0]}점 ~ ${ctx.raw[1]}점`;
            }
          }
        }
      }
    }
  });
};

// 전역 차트 인스턴스
window.analysisChart = new AnalysisChart();
