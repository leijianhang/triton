/**
 * 图表形态识别服务
 * 识别经典的图表形态（Chart Patterns）
 */

/**
 * 寻找局部高点和低点
 * @param {Array} data - K线数据
 * @param {number} window - 窗口大小
 */
const findPivotPoints = (data, window = 5) => {
  const highs = [];
  const lows = [];

  for (let i = window; i < data.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= window; j++) {
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
        isHigh = false;
      }
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) {
      highs.push({ index: i, price: data[i].high, time: data[i].time });
    }
    if (isLow) {
      lows.push({ index: i, price: data[i].low, time: data[i].time });
    }
  }

  return { highs, lows };
};

/**
 * 识别头肩顶 (Head and Shoulders Top)
 * 特征：左肩 < 头部 > 右肩，颈线支撑
 */
export const detectHeadAndShouldersTop = (data, window = 5) => {
  const { highs } = findPivotPoints(data, window);
  const patterns = [];

  for (let i = 2; i < highs.length; i++) {
    const leftShoulder = highs[i - 2];
    const head = highs[i - 1];
    const rightShoulder = highs[i];

    // 头部高于两肩
    const headHigher = head.price > leftShoulder.price && head.price > rightShoulder.price;

    // 两肩高度相近（误差10%）
    const shouldersSymmetric = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.1;

    // 形态跨度合理（20-60根K线）
    const span = rightShoulder.index - leftShoulder.index;
    const validSpan = span >= 20 && span <= 60;

    if (headHigher && shouldersSymmetric && validSpan) {
      // 计算颈线（连接两个肩部之间的低点）
      const necklineStart = leftShoulder.index;
      const necklineEnd = rightShoulder.index;

      let necklinePrice = Infinity;
      for (let j = necklineStart; j <= necklineEnd; j++) {
        if (data[j].low < necklinePrice) {
          necklinePrice = data[j].low;
        }
      }

      patterns.push({
        type: 'head_and_shoulders_top',
        signal: 'bearish',
        name: '头肩顶',
        confidence: 0.8,
        leftShoulder,
        head,
        rightShoulder,
        neckline: necklinePrice,
        target: necklinePrice - (head.price - necklinePrice) // 目标价位
      });
    }
  }

  return patterns;
};

/**
 * 识别头肩底 (Head and Shoulders Bottom / Inverse Head and Shoulders)
 */
export const detectHeadAndShouldersBottom = (data, window = 5) => {
  const { lows } = findPivotPoints(data, window);
  const patterns = [];

  for (let i = 2; i < lows.length; i++) {
    const leftShoulder = lows[i - 2];
    const head = lows[i - 1];
    const rightShoulder = lows[i];

    // 头部低于两肩
    const headLower = head.price < leftShoulder.price && head.price < rightShoulder.price;

    // 两肩高度相近
    const shouldersSymmetric = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.1;

    const span = rightShoulder.index - leftShoulder.index;
    const validSpan = span >= 20 && span <= 60;

    if (headLower && shouldersSymmetric && validSpan) {
      const necklineStart = leftShoulder.index;
      const necklineEnd = rightShoulder.index;

      let necklinePrice = -Infinity;
      for (let j = necklineStart; j <= necklineEnd; j++) {
        if (data[j].high > necklinePrice) {
          necklinePrice = data[j].high;
        }
      }

      patterns.push({
        type: 'head_and_shoulders_bottom',
        signal: 'bullish',
        name: '头肩底',
        confidence: 0.8,
        leftShoulder,
        head,
        rightShoulder,
        neckline: necklinePrice,
        target: necklinePrice + (necklinePrice - head.price)
      });
    }
  }

  return patterns;
};

/**
 * 识别双顶 (Double Top)
 */
export const detectDoubleTop = (data, window = 5) => {
  const { highs } = findPivotPoints(data, window);
  const patterns = [];

  for (let i = 1; i < highs.length; i++) {
    const firstTop = highs[i - 1];
    const secondTop = highs[i];

    // 两个顶部价格相近（误差5%）
    const topsSymmetric = Math.abs(firstTop.price - secondTop.price) / firstTop.price < 0.05;

    // 形态跨度合理
    const span = secondTop.index - firstTop.index;
    const validSpan = span >= 10 && span <= 40;

    if (topsSymmetric && validSpan) {
      // 找到两顶之间的最低点作为颈线
      let necklinePrice = Infinity;
      for (let j = firstTop.index; j <= secondTop.index; j++) {
        if (data[j].low < necklinePrice) {
          necklinePrice = data[j].low;
        }
      }

      // 颈线应该明显低于顶部（至少3%）
      const validNeckline = (firstTop.price - necklinePrice) / firstTop.price > 0.03;

      if (validNeckline) {
        patterns.push({
          type: 'double_top',
          signal: 'bearish',
          name: '双顶',
          confidence: 0.75,
          firstTop,
          secondTop,
          neckline: necklinePrice,
          target: necklinePrice - (firstTop.price - necklinePrice)
        });
      }
    }
  }

  return patterns;
};

/**
 * 识别双底 (Double Bottom)
 */
export const detectDoubleBottom = (data, window = 5) => {
  const { lows } = findPivotPoints(data, window);
  const patterns = [];

  for (let i = 1; i < lows.length; i++) {
    const firstBottom = lows[i - 1];
    const secondBottom = lows[i];

    const bottomsSymmetric = Math.abs(firstBottom.price - secondBottom.price) / firstBottom.price < 0.05;

    const span = secondBottom.index - firstBottom.index;
    const validSpan = span >= 10 && span <= 40;

    if (bottomsSymmetric && validSpan) {
      let necklinePrice = -Infinity;
      for (let j = firstBottom.index; j <= secondBottom.index; j++) {
        if (data[j].high > necklinePrice) {
          necklinePrice = data[j].high;
        }
      }

      const validNeckline = (necklinePrice - firstBottom.price) / firstBottom.price > 0.03;

      if (validNeckline) {
        patterns.push({
          type: 'double_bottom',
          signal: 'bullish',
          name: '双底',
          confidence: 0.75,
          firstBottom,
          secondBottom,
          neckline: necklinePrice,
          target: necklinePrice + (necklinePrice - firstBottom.price)
        });
      }
    }
  }

  return patterns;
};

/**
 * 识别上升三角形 (Ascending Triangle)
 */
export const detectAscendingTriangle = (data, window = 5) => {
  const { highs, lows } = findPivotPoints(data, window);
  const patterns = [];

  // 需要至少3个高点和3个低点
  if (highs.length < 3 || lows.length < 3) return patterns;

  for (let i = 2; i < highs.length; i++) {
    const recentHighs = highs.slice(i - 2, i + 1);

    // 高点水平（误差3%）
    const highsFlat = recentHighs.every(h =>
      Math.abs(h.price - recentHighs[0].price) / recentHighs[0].price < 0.03
    );

    if (highsFlat) {
      // 找到对应的低点
      const startIndex = recentHighs[0].index;
      const endIndex = recentHighs[2].index;
      const relevantLows = lows.filter(l => l.index >= startIndex && l.index <= endIndex);

      if (relevantLows.length >= 2) {
        // 检查低点是否上升
        const lowsRising = relevantLows.every((low, idx) =>
          idx === 0 || low.price > relevantLows[idx - 1].price
        );

        if (lowsRising) {
          patterns.push({
            type: 'ascending_triangle',
            signal: 'bullish',
            name: '上升三角形',
            confidence: 0.7,
            resistance: recentHighs[0].price,
            support: relevantLows,
            breakoutTarget: recentHighs[0].price + (recentHighs[0].price - relevantLows[0].price)
          });
        }
      }
    }
  }

  return patterns;
};

/**
 * 识别下降三角形 (Descending Triangle)
 */
export const detectDescendingTriangle = (data, window = 5) => {
  const { highs, lows } = findPivotPoints(data, window);
  const patterns = [];

  if (highs.length < 3 || lows.length < 3) return patterns;

  for (let i = 2; i < lows.length; i++) {
    const recentLows = lows.slice(i - 2, i + 1);

    // 低点水平
    const lowsFlat = recentLows.every(l =>
      Math.abs(l.price - recentLows[0].price) / recentLows[0].price < 0.03
    );

    if (lowsFlat) {
      const startIndex = recentLows[0].index;
      const endIndex = recentLows[2].index;
      const relevantHighs = highs.filter(h => h.index >= startIndex && h.index <= endIndex);

      if (relevantHighs.length >= 2) {
        // 检查高点是否下降
        const highsFalling = relevantHighs.every((high, idx) =>
          idx === 0 || high.price < relevantHighs[idx - 1].price
        );

        if (highsFalling) {
          patterns.push({
            type: 'descending_triangle',
            signal: 'bearish',
            name: '下降三角形',
            confidence: 0.7,
            support: recentLows[0].price,
            resistance: relevantHighs,
            breakoutTarget: recentLows[0].price - (relevantHighs[0].price - recentLows[0].price)
          });
        }
      }
    }
  }

  return patterns;
};

/**
 * 识别对称三角形 (Symmetrical Triangle)
 */
export const detectSymmetricalTriangle = (data, window = 5) => {
  const { highs, lows } = findPivotPoints(data, window);
  const patterns = [];

  if (highs.length < 3 || lows.length < 3) return patterns;

  for (let i = 2; i < Math.min(highs.length, lows.length); i++) {
    const recentHighs = highs.slice(i - 2, i + 1);
    const recentLows = lows.slice(i - 2, i + 1);

    // 高点下降
    const highsFalling = recentHighs.every((high, idx) =>
      idx === 0 || high.price < recentHighs[idx - 1].price
    );

    // 低点上升
    const lowsRising = recentLows.every((low, idx) =>
      idx === 0 || low.price > recentLows[idx - 1].price
    );

    if (highsFalling && lowsRising) {
      patterns.push({
        type: 'symmetrical_triangle',
        signal: 'neutral',
        name: '对称三角形',
        confidence: 0.65,
        highs: recentHighs,
        lows: recentLows,
        apex: (recentHighs[2].price + recentLows[2].price) / 2
      });
    }
  }

  return patterns;
};

/**
 * 识别旗形 (Flag)
 */
export const detectFlag = (data, window = 3) => {
  const patterns = [];

  for (let i = 20; i < data.length - 10; i++) {
    // 寻找强劲的趋势（旗杆）
    const poleStart = i - 20;
    const poleEnd = i;
    const poleMove = data[poleEnd].close - data[poleStart].close;
    const polePercent = Math.abs(poleMove) / data[poleStart].close;

    // 旗杆至少5%的移动
    if (polePercent < 0.05) continue;

    const isBullish = poleMove > 0;

    // 检查旗形整理（小幅回调）
    const flagData = data.slice(poleEnd, poleEnd + 10);
    const flagMove = flagData[flagData.length - 1].close - flagData[0].close;
    const flagPercent = Math.abs(flagMove) / flagData[0].close;

    // 旗形回调小于旗杆的50%
    const validFlag = flagPercent < polePercent * 0.5;

    // 旗形方向与趋势相反
    const counterTrend = (isBullish && flagMove < 0) || (!isBullish && flagMove > 0);

    if (validFlag && counterTrend) {
      patterns.push({
        type: isBullish ? 'bull_flag' : 'bear_flag',
        signal: isBullish ? 'bullish' : 'bearish',
        name: isBullish ? '看涨旗形' : '看跌旗形',
        confidence: 0.7,
        poleStart: poleStart,
        poleEnd: poleEnd,
        flagEnd: poleEnd + 10,
        target: data[poleEnd].close + poleMove
      });
    }
  }

  return patterns;
};

/**
 * 扫描所有图表形态
 * @param {Array} data - K线数据
 * @returns {Array} 识别到的形态列表
 */
const getPercentChange = (first, last) => {
  const firstPrice = Number(first?.price);
  const lastPrice = Number(last?.price);
  if (!Number.isFinite(firstPrice) || !Number.isFinite(lastPrice) || firstPrice === 0) return 0;
  return (lastPrice - firstPrice) / firstPrice;
};

const getLineDeviation = points => {
  if (!Array.isArray(points) || points.length < 2) return Infinity;
  const first = points[0];
  const last = points[points.length - 1];
  const indexSpan = last.index - first.index;
  if (!indexSpan) return Infinity;
  const slope = (last.price - first.price) / indexSpan;

  return Math.max(...points.map(point => {
    const expected = first.price + slope * (point.index - first.index);
    return Math.abs(point.price - expected) / Math.max(Math.abs(point.price), 1);
  }));
};

const getPatternTarget = (resistance, support, direction = 'up') => {
  const lastResistance = resistance.at(-1)?.price;
  const lastSupport = support.at(-1)?.price;
  if (!Number.isFinite(lastResistance) || !Number.isFinite(lastSupport)) return undefined;
  const height = Math.abs(lastResistance - lastSupport);
  return direction === 'down' ? lastSupport - height : lastResistance + height;
};

const isLowDeviation = points => getLineDeviation(points) < 0.035;

const pushBoundaryPattern = (patterns, { type, signal, name, confidence, resistance, support, targetDirection }) => {
  patterns.push({
    type,
    signal,
    name,
    confidence,
    resistance,
    support,
    target: getPatternTarget(resistance, support, targetDirection)
  });
};

export const detectChannelsAndWedges = (data, window = 5) => {
  const { highs, lows } = findPivotPoints(data, window);
  const patterns = [];
  const seen = new Set();

  if (highs.length < 3 || lows.length < 3) return patterns;

  for (let i = 2; i < highs.length; i++) {
    const resistance = highs.slice(i - 2, i + 1);
    const support = lows.filter(low => low.index >= resistance[0].index && low.index <= resistance[2].index).slice(-3);
    if (support.length < 2 || !isLowDeviation(resistance) || !isLowDeviation(support)) continue;

    const span = resistance.at(-1).index - resistance[0].index;
    if (span < 18 || span > 90) continue;

    const highChange = getPercentChange(resistance[0], resistance.at(-1));
    const lowChange = getPercentChange(support[0], support.at(-1));
    const rangeStart = resistance[0].price - support[0].price;
    const rangeEnd = resistance.at(-1).price - support.at(-1).price;
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart <= 0 || rangeEnd <= 0) continue;

    const slopeGap = Math.abs(highChange - lowChange);
    const key = `${resistance[0].index}-${resistance.at(-1).index}-${support[0].index}-${support.at(-1).index}`;
    if (seen.has(key)) continue;

    if (Math.abs(highChange) < 0.04 && Math.abs(lowChange) < 0.04) {
      seen.add(key);
      pushBoundaryPattern(patterns, {
        type: 'horizontal_channel',
        signal: 'neutral',
        name: 'Channel, Horizontal',
        confidence: 0.68,
        resistance,
        support,
        targetDirection: 'up'
      });
    } else if (highChange > 0.03 && lowChange > 0.03 && slopeGap < 0.08) {
      seen.add(key);
      pushBoundaryPattern(patterns, {
        type: 'ascending_channel',
        signal: 'neutral',
        name: 'Channel, Ascending',
        confidence: 0.68,
        resistance,
        support,
        targetDirection: 'up'
      });
    } else if (highChange < -0.03 && lowChange < -0.03 && slopeGap < 0.08) {
      seen.add(key);
      pushBoundaryPattern(patterns, {
        type: 'descending_channel',
        signal: 'neutral',
        name: 'Channel, Descending',
        confidence: 0.68,
        resistance,
        support,
        targetDirection: 'down'
      });
    }

    const rangeNarrows = rangeEnd < rangeStart * 0.78;
    if (rangeNarrows && highChange > 0.015 && lowChange > highChange * 1.2) {
      seen.add(`${key}-rising-wedge`);
      pushBoundaryPattern(patterns, {
        type: 'rising_wedge',
        signal: 'bearish',
        name: 'Wedge, Rising',
        confidence: 0.66,
        resistance,
        support,
        targetDirection: 'down'
      });
    }
    if (rangeNarrows && lowChange < -0.015 && highChange < lowChange * 1.2) {
      seen.add(`${key}-falling-wedge`);
      pushBoundaryPattern(patterns, {
        type: 'falling_wedge',
        signal: 'bullish',
        name: 'Wedge, Falling',
        confidence: 0.66,
        resistance,
        support,
        targetDirection: 'up'
      });
    }
  }

  return patterns;
};

export const detectCupAndHandle = (data) => {
  const patterns = [];
  const minSpan = 45;
  const maxSpan = Math.min(140, data.length);

  for (let span = minSpan; span <= maxSpan; span += 5) {
    const start = data.length - span;
    if (start < 0) continue;
    const windowData = data.slice(start, start + span);
    const firstThird = Math.floor(span * 0.35);
    const middleStart = Math.floor(span * 0.25);
    const middleEnd = Math.floor(span * 0.7);
    const rightStart = Math.floor(span * 0.55);
    const handleStart = Math.floor(span * 0.72);

    const leftSlice = windowData.slice(0, firstThird);
    const middleSlice = windowData.slice(middleStart, middleEnd);
    const rightSlice = windowData.slice(rightStart, handleStart);
    const handleSlice = windowData.slice(handleStart);
    if (!leftSlice.length || !middleSlice.length || !rightSlice.length || handleSlice.length < 4) continue;

    const leftRimOffset = leftSlice.reduce((best, bar, index) => bar.high > leftSlice[best].high ? index : best, 0);
    const cupLowOffset = middleSlice.reduce((best, bar, index) => bar.low < middleSlice[best].low ? index : best, 0) + middleStart;
    const rightRimOffset = rightSlice.reduce((best, bar, index) => bar.high > rightSlice[best].high ? index : best, 0) + rightStart;
    const handleLowOffset = handleSlice.reduce((best, bar, index) => bar.low < handleSlice[best].low ? index : best, 0) + handleStart;

    const leftRim = { index: start + leftRimOffset, price: data[start + leftRimOffset].high, time: data[start + leftRimOffset].time };
    const cupLow = { index: start + cupLowOffset, price: data[start + cupLowOffset].low, time: data[start + cupLowOffset].time };
    const rightRim = { index: start + rightRimOffset, price: data[start + rightRimOffset].high, time: data[start + rightRimOffset].time };
    const handleEnd = { index: start + handleLowOffset, price: data[start + handleLowOffset].low, time: data[start + handleLowOffset].time };

    if (!(leftRim.index < cupLow.index && cupLow.index < rightRim.index && rightRim.index < handleEnd.index)) continue;

    const rimsAligned = Math.abs(leftRim.price - rightRim.price) / Math.max(leftRim.price, 1) < 0.08;
    const cupDepth = (Math.min(leftRim.price, rightRim.price) - cupLow.price) / Math.max(leftRim.price, 1);
    const handleDepth = (rightRim.price - handleEnd.price) / Math.max(rightRim.price, 1);
    const validHandle = handleDepth > 0.015 && handleDepth < Math.max(cupDepth * 0.55, 0.025);

    if (rimsAligned && cupDepth > 0.08 && cupDepth < 0.45 && validHandle) {
      const neckline = Math.max(leftRim.price, rightRim.price);
      patterns.push({
        type: 'cup_and_handle',
        signal: 'bullish',
        name: 'Cup and Handle',
        confidence: 0.64,
        leftRim,
        cupLow,
        rightRim,
        handleEnd,
        neckline,
        target: neckline + (neckline - cupLow.price)
      });
      break;
    }
  }

  return patterns;
};

export const scanChartPatterns = (data) => {
  const patterns = [];

  // 头肩形态
  patterns.push(...detectHeadAndShouldersTop(data));
  patterns.push(...detectHeadAndShouldersBottom(data));

  // 双顶双底
  patterns.push(...detectDoubleTop(data));
  patterns.push(...detectDoubleBottom(data));

  // 三角形
  patterns.push(...detectAscendingTriangle(data));
  patterns.push(...detectDescendingTriangle(data));
  patterns.push(...detectSymmetricalTriangle(data));

  // TrendSpider Chart Patterns
  patterns.push(...detectChannelsAndWedges(data));
  patterns.push(...detectCupAndHandle(data));

  return patterns;
};
