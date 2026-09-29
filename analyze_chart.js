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

// 전역 차트 인스턴스
window.analysisChart = new AnalysisChart();
