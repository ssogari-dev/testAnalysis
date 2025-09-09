// XLSX 파싱 전용 Web Worker
// 외부 라이브러리 로드
importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

self.onmessage = function(e) {
  const { arrayBuffer } = e.data || {};
  try {
    if (!arrayBuffer) throw new Error('No data');
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    self.postMessage({ ok: true, rows });
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || String(err) });
  }
};
