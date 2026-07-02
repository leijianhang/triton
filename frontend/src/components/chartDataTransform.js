const intradayPattern = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

export function normalizeChartTime(value) {
  if (typeof value === 'number') return value > 100000000000 ? Math.floor(value / 1000) : value;

  const raw = String(value || '').trim();
  if (!raw) throw new Error('Invalid chart time: empty value');

  const isoLike = intradayPattern.test(raw) ? `${raw.replace(' ', 'T')}+08:00` : raw;
  const timestamp = Date.parse(isoLike);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid chart time: ${raw}`);
  }

  return Math.floor(timestamp / 1000);
}

export function toCandleData(data) {
  return data.map(item => ({
    time: normalizeChartTime(item.time),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }));
}

export function toHeikinAshiData(data) {
  let previousOpen = null;
  let previousClose = null;

  return data.map(item => {
    const open = Number(item.open);
    const high = Number(item.high);
    const low = Number(item.low);
    const close = Number(item.close);
    const heikinClose = (open + high + low + close) / 4;
    const heikinOpen = previousOpen === null || previousClose === null
      ? (open + close) / 2
      : (previousOpen + previousClose) / 2;
    const heikinHigh = Math.max(high, heikinOpen, heikinClose);
    const heikinLow = Math.min(low, heikinOpen, heikinClose);

    previousOpen = heikinOpen;
    previousClose = heikinClose;

    return {
      time: normalizeChartTime(item.time),
      open: heikinOpen,
      high: heikinHigh,
      low: heikinLow,
      close: heikinClose,
    };
  });
}

export function toLineData(data) {
  return data.map(item => ({
    time: normalizeChartTime(item.time),
    value: item.close,
  }));
}

export function toVolumeData(data) {
  return data.map(item => ({
    time: normalizeChartTime(item.time),
    value: item.volume,
    color: item.close >= item.open ? '#ef535080' : '#26a69a80',
  }));
}

export function getChartTime(row) {
  return normalizeChartTime(row.time);
}

export function normalizeKlineRows(rows) {
  const byTime = new Map();

  (rows || []).forEach(row => {
    try {
      byTime.set(getChartTime(row), row);
    } catch {
      // Ignore rows the charting library cannot render.
    }
  });

  return Array.from(byTime.entries())
    .sort(([leftTime], [rightTime]) => leftTime - rightTime)
    .map(([, row]) => row);
}
