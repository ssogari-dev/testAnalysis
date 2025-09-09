// Chart.js 라이브러리 사용을 위한 그래프 기능
class AnalysisChart {
    constructor() {
      this.charts = {};
    }
  
    // a) 점수 분포 그래프 (히스토그램 + 기준선)
    createScoreDistribution(containerId, data, subject, scoreType) {
      const ctx = document.getElementById(containerId).getContext('2d');
      const scores = data.map(s => Number(s[subject]?.[scoreType])).filter(n => !isNaN(n));
      if (!scores.length) return;
      scores.sort((a,b) => a-b);
      const min = scores[0];
      const max = scores[scores.length-1];
      const binCount = 12;
      const binWidth = Math.max(1, Math.ceil((max - min + 1) / binCount));
      const bins = [];
      const labels = [];
      for (let i = 0; i < binCount; i++) {
        const start = min + i*binWidth;
        const end = Math.min(max, start + binWidth - 1);
        labels.push(`${start}~${end}`);
        bins.push({ start, end, count: 0 });
      }
      scores.forEach(v => {
        const idx = Math.min(binCount-1, Math.floor((v - min) / binWidth));
        bins[idx].count++;
      });
      const counts = bins.map(b => b.count);
      const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
      const topX = p => { const c=Math.ceil(scores.length*p); return scores.slice(-c).reduce((a,b)=>a+b,0)/c; };
      const posToLabel = v => labels[Math.min(binCount-1, Math.max(0, Math.floor((v - min)/binWidth)))]
  
      this.charts[containerId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: '빈도', data: counts, backgroundColor: 'rgba(37, 99, 235, 0.7)' }] },
        options: {
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          plugins: {
            tooltip: { callbacks: { label: (ctx)=>`빈도: ${ctx.raw}` } },
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
      const labels = ['1등급','2등급','3등급','4등급','5등급','6등급','7등급','8등급','9등급'];
      const ratios = gradeData.ratio.map(v => Number(v));
      this.charts[containerId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: '비율(%)', data: ratios, backgroundColor: 'rgba(37,99,235,0.8)' }] },
        options: {
          scales: { y: { beginAtZero: true, max: 100 } },
          plugins: { tooltip: { callbacks: { label: (ctx)=>{
            const i = ctx.dataIndex; return `${labels[i]}: ${gradeData.dist[i]}명 (${gradeData.ratio[i]}%)`; } } } }
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
            label: '대상년도',
            data: targetData.ratio,
            backgroundColor: 'rgba(37, 99, 235, 0.8)'
          }, {
            label: '비교년도',
            data: compareData.ratio,
            backgroundColor: 'rgba(239, 68, 68, 0.8)'
          }]
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const grade = context.dataIndex + 1;
                  const isTarget = context.datasetIndex === 0;
                  const data = isTarget ? targetData : compareData;
                  return `${context.dataset.label} ${grade}등급: ${data.dist[context.dataIndex]}명 (${context.raw}%)`;
                }
              }
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
AnalysisChart.prototype.createCdfChart = function(containerId, data, subject, scoreType) {
  const ctx = document.getElementById(containerId).getContext('2d');
  const scores = data.map(s => Number(s[subject]?.[scoreType])).filter(n => !isNaN(n)).sort((a,b)=>a-b);
  if (!scores.length) return;
  const n = scores.length;
  const labels = scores;
  const cdf = scores.map((_,i)=> ((i+1)/n*100).toFixed(2));
  const q = p => scores[Math.min(n-1, Math.max(0, Math.floor(p*(n-1))))];
  const q10=q(0.10), q25=q(0.25), q50=q(0.50), q75=q(0.75), q90=q(0.90);
  this.charts[containerId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '누적(%)', data: cdf, borderColor: 'rgba(37,99,235,0.9)', tension: 0.2, pointRadius: 0 }]},
    options: {
      scales: { y: { beginAtZero: true, max: 100 } },
      plugins: {
        annotation: {
          annotations: {
            q10: { type: 'line', xMin: q10, xMax: q10, borderColor: '#9ca3af', label: { content: 'P10', enabled: true, rotation: 90 } },
            q25: { type: 'line', xMin: q25, xMax: q25, borderColor: '#6b7280', label: { content: 'P25', enabled: true, rotation: 90 } },
            q50: { type: 'line', xMin: q50, xMax: q50, borderColor: '#111827', label: { content: 'Median', enabled: true, rotation: 90 } },
            q75: { type: 'line', xMin: q75, xMax: q75, borderColor: '#6b7280', label: { content: 'P75', enabled: true, rotation: 90 } },
            q90: { type: 'line', xMin: q90, xMax: q90, borderColor: '#9ca3af', label: { content: 'P90', enabled: true, rotation: 90 } },
          }
        }
      }
    }
  });
};

// 전역 차트 인스턴스
window.analysisChart = new AnalysisChart();
  