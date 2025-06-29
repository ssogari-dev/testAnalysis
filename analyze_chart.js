// Chart.js 라이브러리 사용을 위한 그래프 기능
class AnalysisChart {
    constructor() {
      this.charts = {};
    }
  
    // a) 점수 분포 그래프 (산점도 + 평균선)
    createScoreDistribution(containerId, data, subject, scoreType) {
      const ctx = document.getElementById(containerId).getContext('2d');
      const scores = data.map(s => Number(s[subject]?.[scoreType])).filter(n => !isNaN(n));
      scores.sort((a,b) => b-a);
      
      const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
      const top10 = scores.slice(0,Math.ceil(scores.length*0.1)).reduce((a,b)=>a+b,0)/Math.ceil(scores.length*0.1);
      const top20 = scores.slice(0,Math.ceil(scores.length*0.2)).reduce((a,b)=>a+b,0)/Math.ceil(scores.length*0.2);
      const top30 = scores.slice(0,Math.ceil(scores.length*0.3)).reduce((a,b)=>a+b,0)/Math.ceil(scores.length*0.3);
  
      this.charts[containerId] = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '학생 점수',
            data: scores.map((score, idx) => ({x: idx, y: score})),
            backgroundColor: 'rgba(37, 99, 235, 0.6)'
          }]
        },
        options: {
          plugins: {
            annotation: {
              annotations: {
                avgLine: { type: 'line', yMin: avg, yMax: avg, borderColor: 'red', label: { content: '전체 평균', enabled: true } },
                top10Line: { type: 'line', yMin: top10, yMax: top10, borderColor: 'green', label: { content: '상위 10%', enabled: true } },
                top20Line: { type: 'line', yMin: top20, yMax: top20, borderColor: 'orange', label: { content: '상위 20%', enabled: true } },
                top30Line: { type: 'line', yMin: top30, yMax: top30, borderColor: 'purple', label: { content: '상위 30%', enabled: true } }
              }
            }
          }
        }
      });
    }
  
    // b,c) 등급별 원형 그래프
    createGradePieChart(containerId, gradeData, subject) {
      const ctx = document.getElementById(containerId).getContext('2d');
      const labels = ['1등급', '2등급', '3등급', '4등급', '5등급', '6등급', '7등급', '8등급', '9등급'];
      
      this.charts[containerId] = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: gradeData.dist,
            backgroundColor: [
              '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
              '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
            ]
          }]
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const count = context.raw;
                  const percentage = gradeData.ratio[context.dataIndex];
                  return `${context.label}: ${count}명 (${percentage}%)`;
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
  
  // 전역 차트 인스턴스
  window.analysisChart = new AnalysisChart();
  