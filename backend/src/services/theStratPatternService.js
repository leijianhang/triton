const THE_STRAT_PATTERNS = [
  { sequence: ['1', '2D'], type: '1-2D', name: '1-2D Inside Break', signal: 'bearish', family: 'inside-break' },
  { sequence: ['1', '2U'], type: '1-2U', name: '1-2U Inside Break', signal: 'bullish', family: 'inside-break' },
  { sequence: ['1', '2U', '2D'], type: '1-2U-2D', name: '1-2U-2D Inside Reversal', signal: 'bearish', family: 'reversal' },
  { sequence: ['1', '2D', '2U'], type: '1-2D-2U', name: '1-2D-2U Reversal', signal: 'bullish', family: 'reversal' },
  { sequence: ['1', '3', '1', '2D'], type: '1-3-1-2D', name: '1-3-1-2D Volatility Expansion', signal: 'bearish', family: 'expansion' },
  { sequence: ['1', '3', '1', '2U'], type: '1-3-1-2U', name: '1-3-1-2U Volatility Expansion', signal: 'bullish', family: 'expansion' },
  { sequence: ['2D', '1', '2D'], type: '2D-1-2D', name: '2D-1-2D Measured Move Reversal', signal: 'bearish', family: 'measured-move' },
  { sequence: ['2D', '1', '2U'], type: '2D-1-2U', name: '2D-1-2U Reversal', signal: 'bullish', family: 'reversal' },
  { sequence: ['2U', '1', '2D'], type: '2U-1-2D', name: '2U-1-2D Reversal', signal: 'bearish', family: 'reversal' },
  { sequence: ['2U', '1', '2U'], type: '2U-1-2U', name: '2U-1-2U Measured Move Reversal', signal: 'bullish', family: 'measured-move' },
  { sequence: ['2D', '2D'], type: '2D-2D', name: '2D-2D Continuation', signal: 'bearish', family: 'continuation' },
  { sequence: ['2U', '2U'], type: '2U-2U', name: '2U-2U Continuation', signal: 'bullish', family: 'continuation' },
  { sequence: ['2D', '2U'], type: '2D-2U', name: '2D-2U Reversal', signal: 'bullish', family: 'reversal' },
  { sequence: ['2U', '2D'], type: '2U-2D', name: '2U-2D Reversal', signal: 'bearish', family: 'reversal' },
  { sequence: ['2D', '2U'], type: '2D-2U-hammer', name: '2D-2U Hammer Reversal', signal: 'bullish', family: 'hammer-reversal', requires: 'hammer' },
  { sequence: ['2U', '2D'], type: '2U-2D-shooting-star', name: '2U-2D Shooting Star Reversal', signal: 'bearish', family: 'shooting-star-reversal', requires: 'shooting-star' },
  { sequence: ['2D', '2D'], type: '2D-2D-shooting-star', name: '2D-2D Shooting Star Momentum Continuation', signal: 'bearish', family: 'momentum-continuation', requires: 'shooting-star' },
  { sequence: ['2U', '2U'], type: '2U-2U-hammer', name: '2U-2U Hammer Momentum Continuation', signal: 'bullish', family: 'momentum-continuation', requires: 'hammer' },
  { sequence: ['3', '2D'], type: '3-2D', name: '3-2D Range Expansion Continuation', signal: 'bearish', family: 'range-expansion' },
  { sequence: ['3', '2U'], type: '3-2U', name: '3-2U Range Expansion Continuation', signal: 'bullish', family: 'range-expansion' },
  { sequence: ['3', '2U', '2D'], type: '3-2U-2D', name: '3-2U-2D Broadening Reversal', signal: 'bearish', family: 'broadening-reversal' },
  { sequence: ['3', '2D', '2U'], type: '3-2D-2U', name: '3-2D-2U Broadening Reversal', signal: 'bullish', family: 'broadening-reversal' }
];

const getRange = candle => Math.max(candle.high - candle.low, 0);
const getBody = candle => Math.abs(candle.close - candle.open);
const isHammerLike = candle => {
  const range = getRange(candle);
  if (range === 0) return false;
  const body = getBody(candle);
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  return body <= range * 0.35 && lowerShadow >= body * 1.8 && upperShadow <= range * 0.25;
};
const isShootingStarLike = candle => {
  const range = getRange(candle);
  if (range === 0) return false;
  const body = getBody(candle);
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  return body <= range * 0.35 && upperShadow >= body * 1.8 && lowerShadow <= range * 0.25;
};

export const classifyTheStratBar = (candle, previousCandle) => {
  if (!candle || !previousCandle) return null;

  const takesHigh = candle.high > previousCandle.high;
  const takesLow = candle.low < previousCandle.low;

  if (takesHigh && takesLow) return '3';
  if (!takesHigh && !takesLow) return '1';
  if (takesHigh) return '2U';
  if (takesLow) return '2D';
  return null;
};

const matchesSequence = (scenarios, sequence) => {
  if (scenarios.length < sequence.length) return false;
  const start = scenarios.length - sequence.length;
  return sequence.every((scenario, index) => scenarios[start + index] === scenario);
};

const passesCandleRequirement = (pattern, candle) => {
  if (pattern.requires === 'hammer') return isHammerLike(candle);
  if (pattern.requires === 'shooting-star') return isShootingStarLike(candle);
  return true;
};

export const scanTheStratPatterns = (data = []) => {
  const results = [];
  const scenarios = [];

  for (let i = 1; i < data.length; i += 1) {
    const candle = data[i];
    const scenario = classifyTheStratBar(candle, data[i - 1]);
    scenarios.push(scenario);

    const matchedPatterns = THE_STRAT_PATTERNS
      .filter(pattern => matchesSequence(scenarios, pattern.sequence))
      .filter(pattern => passesCandleRequirement(pattern, candle));

    matchedPatterns.forEach(pattern => {
      results.push({
        index: i,
        time: candle.time,
        scenario,
        sequence: pattern.sequence,
        pattern: {
          type: pattern.type,
          name: pattern.name,
          signal: pattern.signal,
          family: pattern.family,
          group: 'TheStrat'
        }
      });
    });
  }

  return results;
};
