export const timeframeOptions = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '30m', value: '30min' },
  { label: '1h', value: '60min' },
  { label: 'D', value: 'daily' },
  { label: 'W', value: 'weekly' },
  { label: 'M', value: 'monthly' }
];

export const chartStyleOptions = [
  { label: 'Candles', value: 'candles' },
  { label: 'Heikin Ashi', value: 'heikinAshi' },
  { label: 'Bars', value: 'bars' },
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' }
];

const findOption = (options, value, fallback) =>
  options.find(item => item.value === value) || fallback;

export const getTimeframeOption = value =>
  findOption(timeframeOptions, value, timeframeOptions.find(item => item.value === 'daily'));

export const getChartStyleOption = value =>
  findOption(chartStyleOptions, value, chartStyleOptions[0]);
