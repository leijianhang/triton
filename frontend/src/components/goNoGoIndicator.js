export const GO_NO_GO_COLORS = {
  strongGo: '#0068ff',
  weakGo: '#00b7c7',
  neutral: '#f0a500',
  weakNoGo: '#e85b9e',
  strongNoGo: '#7a2e8e'
};

const toFiniteNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const calculateEmaValues = (values, period) => {
  const result = Array(values.length).fill(null);
  if (values.length < period) return result;

  const seed = values.slice(0, period);
  if (seed.some(value => value === null)) return result;

  const multiplier = 2 / (period + 1);
  let ema = seed.reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = ema;

  for (let index = period; index < values.length; index += 1) {
    if (values[index] === null) continue;
    ema = (values[index] - ema) * multiplier + ema;
    result[index] = ema;
  }

  return result;
};

const calculateRsiValues = (values, period = 14) => {
  const result = Array(values.length).fill(null);

  for (let index = period; index < values.length; index += 1) {
    let gains = 0;
    let losses = 0;

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const current = values[cursor];
      const previous = values[cursor - 1];
      if (current === null || previous === null) {
        gains = null;
        break;
      }

      const change = current - previous;
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }

    if (gains === null) continue;
    result[index] = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  }

  return result;
};

const calculateDirectionalDifference = (data, period = 14) => {
  const result = Array(data.length).fill(null);

  for (let index = period; index < data.length; index += 1) {
    let positive = 0;
    let negative = 0;

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const currentHigh = toFiniteNumber(data[cursor]?.high);
      const currentLow = toFiniteNumber(data[cursor]?.low);
      const previousHigh = toFiniteNumber(data[cursor - 1]?.high);
      const previousLow = toFiniteNumber(data[cursor - 1]?.low);
      if ([currentHigh, currentLow, previousHigh, previousLow].some(value => value === null)) {
        positive = null;
        break;
      }

      const upMove = currentHigh - previousHigh;
      const downMove = previousLow - currentLow;
      positive += upMove > downMove && upMove > 0 ? upMove : 0;
      negative += downMove > upMove && downMove > 0 ? downMove : 0;
    }

    if (positive !== null) result[index] = positive - negative;
  }

  return result;
};

const vote = (left, right, neutralBand = 0) => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  if (left > right + neutralBand) return 1;
  if (left < right - neutralBand) return -1;
  return 0;
};

const getStateForScore = score => {
  if (score >= 4) return 'strongGo';
  if (score >= 1) return 'weakGo';
  if (score <= -4) return 'strongNoGo';
  if (score <= -1) return 'weakNoGo';
  return 'neutral';
};

export const calculateGoNoGoStates = (data = []) => {
  if (!Array.isArray(data)) return [];

  const closes = data.map(item => toFiniteNumber(item?.close));
  const fastEma = calculateEmaValues(closes, 8);
  const slowEma = calculateEmaValues(closes, 21);
  const signalEma = calculateEmaValues(closes, 34);
  const rsi = calculateRsiValues(closes);
  const directionalDifference = calculateDirectionalDifference(data);

  return data.map((item, index) => {
    const score = [
      vote(closes[index], fastEma[index]),
      vote(fastEma[index], slowEma[index]),
      vote(slowEma[index], slowEma[index - 3]),
      vote(slowEma[index], signalEma[index]),
      vote(rsi[index], 50, 5),
      vote(directionalDifference[index], 0)
    ].reduce((sum, value) => sum + value, 0);
    const state = getStateForScore(score);

    return {
      color: GO_NO_GO_COLORS[state],
      score,
      state,
      time: item?.time
    };
  });
};

export const applyGoNoGoColors = (data = [], candlestick = true) => {
  const states = calculateGoNoGoStates(data);

  return data.map((item, index) => {
    const color = states[index]?.color || GO_NO_GO_COLORS.neutral;
    if (!candlestick) return { ...item, color };

    return {
      ...item,
      borderColor: color,
      color,
      wickColor: color
    };
  });
};
