import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createDrawing, getDrawingsForSymbol } from './drawingTools';
import {
  anchorToPoint,
  coordinateToAnchor,
  formatMeasureLabel,
  getPointerPoint
} from './drawingGeometry';
import {
  formatAutoFibonacciLevel,
  getAutoFibonacciModel
} from './autoFibonacci';
import { getAutoTrendlines } from './autoTrendlines';
import { getChartPatternOverlayItems } from './chartPatternOverlay';
import { getHeatmapOverlayBounds, getHeatmapOverlayItems } from './heatmapOverlay';
import { getChartTime } from './chartDataTransform';
import { getDrawingOverlayClassName } from './drawingOverlayState';
import './DrawingOverlay.css';

const twoAnchorTools = new Set(['trend', 'segment', 'extended', 'arrow', 'measure', 'ellipse', 'fibonacci', 'fibTimeZones', 'priceRange', 'dateRange']);
const priceSnapTools = new Set(['trend', 'segment', 'extended', 'channel', 'pitchfork', 'horizontal', 'arrow', 'measure', 'fibonacci', 'fibExtension', 'priceRange']);
const timeSnapTools = new Set(['trend', 'segment', 'extended', 'channel', 'pitchfork', 'vertical', 'arrow', 'measure', 'fibonacci', 'fibExtension', 'fibTimeZones', 'dateRange']);
const fibonacciLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const fibonacciExtensionLevels = [0.618, 1, 1.272, 1.618, 2.618, 4.236];
const fibonacciTimeZoneLevels = [0, 1, 2, 3, 5, 8, 13, 21];
const drawingStyleStorageKey = 'trendspider.chartDrawingStyles.v1';
const drawingPalette = ['#4ee093', '#4ea1ff', '#ff6670', '#ffb84d', '#d9fff0', '#b36bff'];
const drawingWidths = [1, 2, 3, 4];
const timeframeOrder = ['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'];
const visibilityOptions = [
  { label: 'This timeframe only', value: 'current' },
  { label: 'This and lower timeframes', value: 'currentAndLower' },
  { label: 'All timeframes', value: 'all' }
];

const getStrokeDasharray = drawing => (drawing.style?.dash === 'dashed' ? '5 5' : undefined);
const getDrawingColor = drawing => drawing.style?.color || '#4ee093';
const isDrawingLocked = drawing => drawing.style?.locked === true;
const shouldShowDrawingForPeriod = (drawing, currentPeriod) => {
  const visibleOn = drawing.style?.visibleOn || 'currentAndLower';
  const sourcePeriod = drawing.style?.sourcePeriod || currentPeriod || 'daily';
  if (visibleOn === 'all') return true;
  if (visibleOn === 'current') return sourcePeriod === currentPeriod;

  const sourceIndex = timeframeOrder.indexOf(sourcePeriod);
  const currentIndex = timeframeOrder.indexOf(currentPeriod);
  if (sourceIndex < 0 || currentIndex < 0) return true;
  return currentIndex <= sourceIndex;
};

const readStoredDrawingStyles = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(drawingStyleStorageKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const persistStoredDrawingStyles = stylesByTool => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(drawingStyleStorageKey, JSON.stringify(stylesByTool));
  } catch {
    // Drawing style memory is optional.
  }
};

const getLinePoints = (drawing, chart, series) => {
  const points = drawing.anchors
    .map(anchor => anchorToPoint({ anchor, chart, series }))
    .filter(Boolean);
  return points.length >= 2 ? points : null;
};

const getTrendRayLine = (start, end, width) => {
  if (!Number.isFinite(width) || width <= 0 || Math.abs(end.x - start.x) < 1) {
    return { start, end };
  }

  const slope = (end.y - start.y) / (end.x - start.x);
  const projectedX = width;
  return {
    start,
    end: { x: projectedX, y: start.y + (projectedX - start.x) * slope }
  };
};

const getExtendedLine = (start, end, width) => {
  if (!Number.isFinite(width) || width <= 0 || Math.abs(end.x - start.x) < 1) {
    return { start, end };
  }

  const slope = (end.y - start.y) / (end.x - start.x);
  return {
    start: { x: 0, y: start.y - start.x * slope },
    end: { x: width, y: start.y + (width - start.x) * slope }
  };
};

const getChannelGeometry = (start, end, offsetPoint, width) => {
  if (!start || !end || !offsetPoint) return null;
  const base = getTrendRayLine(start, end, width);
  const dx = end.x - start.x;
  const slope = Math.abs(dx) < 1 ? 0 : (end.y - start.y) / dx;
  const baseYAtOffsetX = start.y + (offsetPoint.x - start.x) * slope;
  const offset = offsetPoint.y - baseYAtOffsetX;
  const parallel = {
    start: { x: base.start.x, y: base.start.y + offset },
    end: { x: base.end.x, y: base.end.y + offset }
  };
  const median = {
    start: { x: base.start.x, y: base.start.y + offset / 2 },
    end: { x: base.end.x, y: base.end.y + offset / 2 }
  };
  const polygonPoints = [
    `${base.start.x},${base.start.y}`,
    `${base.end.x},${base.end.y}`,
    `${parallel.end.x},${parallel.end.y}`,
    `${parallel.start.x},${parallel.start.y}`
  ].join(' ');

  return { base, parallel, median, polygonPoints };
};

const getRayThroughPoints = (start, through, width) => {
  if (!start || !through) return null;
  if (!Number.isFinite(width) || width <= 0 || Math.abs(through.x - start.x) < 1) {
    return { start, end: through };
  }
  const slope = (through.y - start.y) / (through.x - start.x);
  const projectedX = through.x >= start.x ? width : 0;
  return {
    start,
    end: { x: projectedX, y: start.y + (projectedX - start.x) * slope }
  };
};

const getParallelRayThroughPoint = (baseStart, baseEnd, throughPoint, width) => {
  if (!baseStart || !baseEnd || !throughPoint) return null;
  if (!Number.isFinite(width) || width <= 0 || Math.abs(baseEnd.x - baseStart.x) < 1) {
    return { start: throughPoint, end: { x: throughPoint.x + (baseEnd.x - baseStart.x), y: throughPoint.y + (baseEnd.y - baseStart.y) } };
  }
  const slope = (baseEnd.y - baseStart.y) / (baseEnd.x - baseStart.x);
  const projectedX = baseEnd.x >= baseStart.x ? width : 0;
  return {
    start: throughPoint,
    end: { x: projectedX, y: throughPoint.y + (projectedX - throughPoint.x) * slope }
  };
};

const getPitchforkGeometry = (handle, sideA, sideB, width) => {
  if (!handle || !sideA || !sideB) return null;
  const midpoint = {
    x: (sideA.x + sideB.x) / 2,
    y: (sideA.y + sideB.y) / 2
  };
  const median = getRayThroughPoints(handle, midpoint, width);
  if (!median) return null;
  return {
    midpoint,
    median,
    sideA: getParallelRayThroughPoint(handle, midpoint, sideA, width),
    sideB: getParallelRayThroughPoint(handle, midpoint, sideB, width)
  };
};

const getPointDistance = (a, b) => {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const formatPriceRangeLabel = (start, end) => {
  const startPrice = Number(start?.price);
  const endPrice = Number(end?.price);
  if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice) || startPrice === 0) return '';
  const delta = endPrice - startPrice;
  const percent = (delta / startPrice) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
};

const formatDateRangeLabel = (start, end, data = []) => {
  const startTime = Number(start?.time);
  const endTime = Number(end?.time);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return '';
  const minTime = Math.min(startTime, endTime);
  const maxTime = Math.max(startTime, endTime);
  const bars = data.filter(row => {
    try {
      const time = getChartTime(row);
      return time >= minTime && time <= maxTime;
    } catch {
      return false;
    }
  }).length;
  const days = Math.abs(maxTime - minTime) / 86400;
  return `${bars} bars · ${days.toFixed(days >= 10 ? 0 : 1)}D`;
};

const getFibTimeZoneLines = (start, end, chart) => {
  if (!start || !end || !chart) return [];
  const interval = end.time - start.time;
  if (!Number.isFinite(interval) || interval === 0) return [];

  return fibonacciTimeZoneLevels
    .map(level => {
      const time = start.time + interval * level;
      const x = chart.timeScale().timeToCoordinate(time);
      return Number.isFinite(x) ? { level, time, x } : null;
    })
    .filter(Boolean);
};

const getSinglePoint = (drawing, chart, series) =>
  anchorToPoint({ anchor: drawing.anchors[0], chart, series });

const getRectangle = (drawing, chart, series) => {
  const points = getLinePoints(drawing, chart, series);
  if (!points) return null;
  const [start, end] = points;
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
};

const getEllipse = (drawing, chart, series) => {
  const rect = getRectangle(drawing, chart, series);
  if (!rect) return null;
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    rx: rect.width / 2,
    ry: rect.height / 2
  };
};

const getDrawingPoints = (drawing, chart, series) => {
  if (drawing.type === 'horizontal' || drawing.type === 'vertical' || drawing.type === 'text' || drawing.type === 'callout') {
    return [getSinglePoint(drawing, chart, series)].filter(Boolean);
  }

  return drawing.anchors
    .map(anchor => anchorToPoint({ anchor, chart, series }))
    .filter(Boolean);
};

const DrawingHandle = ({ point, onPointerDown }) => (
  <circle
    className="drawing-anchor-handle"
    cx={point.x}
    cy={point.y}
    r="5"
    onPointerDown={onPointerDown}
  />
);

const formatAutoFibPrice = price => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) return '';
  if (Math.abs(numeric) >= 1000) return numeric.toFixed(0);
  if (Math.abs(numeric) >= 100) return numeric.toFixed(2);
  return numeric.toFixed(3);
};

const AutoFibonacciShape = ({ chart, model, overlayHeight, overlayWidth, series }) => {
  if (!model || !chart || !series) return null;

  const startPoint = anchorToPoint({ anchor: model.start, chart, series });
  const endPoint = anchorToPoint({ anchor: model.end, chart, series });
  if (!startPoint || !endPoint) return null;

  const x1 = Math.min(startPoint.x, endPoint.x);
  const x2 = Math.max(Math.max(startPoint.x, endPoint.x), overlayWidth - 112);
  const labelX = Math.max(8, Math.min(x1 + 6, overlayWidth - 112));
  const analysisX = chart.timeScale().timeToCoordinate(model.analysis?.time);
  const levelPoints = model.levels
    .map(item => ({
      ...item,
      y: series.priceToCoordinate(item.price)
    }))
    .filter(item => Number.isFinite(item.y));
  const fillTop = levelPoints.find(item => item.level === 0.382);
  const fillBottom = levelPoints.find(item => item.level === 0.618);

  return (
    <g className={`auto-fib auto-fib-${model.direction}`}>
      {Number.isFinite(analysisX) && Number.isFinite(overlayHeight) && (
        <g className="auto-fib-truth-line">
          <title>Truth in Analysis</title>
          <line x1={analysisX} y1={0} x2={analysisX} y2={overlayHeight} />
          <text x={Math.min(analysisX + 6, Math.max(8, overlayWidth - 92))} y={Math.max(14, overlayHeight - 8)}>
            Truth in Analysis
          </text>
        </g>
      )}
      {fillTop && fillBottom && (
        <rect
          className="auto-fib-value-zone"
          x={x1}
          y={Math.min(fillTop.y, fillBottom.y)}
          width={Math.max(1, x2 - x1)}
          height={Math.abs(fillBottom.y - fillTop.y)}
        />
      )}
      {levelPoints.map(item => (
        <g className="auto-fib-level" key={item.level}>
          <line
            style={{
              stroke: item.color,
              strokeWidth: item.thickness || 1
            }}
            x1={x1}
            y1={item.y}
            x2={x2}
            y2={item.y}
          />
          <text
            style={{ fill: item.color }}
            x={labelX}
            y={item.y - 4}
          >
            {formatAutoFibonacciLevel(item.level)} [{formatAutoFibPrice(item.price)}]
          </text>
        </g>
      ))}
      <line
        className="auto-fib-anchor-line"
        x1={startPoint.x}
        y1={startPoint.y}
        x2={endPoint.x}
        y2={endPoint.y}
      />
      <circle className="auto-fib-anchor" cx={startPoint.x} cy={startPoint.y} r="3.5" />
      <circle className="auto-fib-anchor" cx={endPoint.x} cy={endPoint.y} r="3.5" />
    </g>
  );
};

const chartPatternColor = {
  bullish: '#4ee093',
  bearish: '#ff6b7a',
  neutral: '#ffb84d'
};

const chartPatternLineClass = kind => (
  kind === 'target'
    ? 'chart-pattern-line chart-pattern-target'
    : kind === 'neckline'
      ? 'chart-pattern-line chart-pattern-neckline'
      : 'chart-pattern-line'
);

const ChartPatternShape = ({ chart, pattern, series }) => {
  if (!pattern?.lines?.length || !chart || !series) return null;

  const color = chartPatternColor[pattern.signal] || chartPatternColor.neutral;
  const lineGroups = pattern.lines.map((line, lineIndex) => {
    const linePoints = Array.isArray(line?.points) ? line.points : [];
    const points = linePoints
      .map(anchor => anchorToPoint({ anchor, chart, series }))
      .filter(Boolean);
    if (points.length < 2) return null;
    const pointList = points.map(point => `${point.x},${point.y}`).join(' ');
    return (
      <polyline
        className={chartPatternLineClass(line.kind)}
        key={`${pattern.type}-${line.kind}-${lineIndex}`}
        points={pointList}
        style={{ stroke: color }}
      />
    );
  }).filter(Boolean);
  if (!lineGroups.length) return null;

  const labelLine = pattern.lines.find(line => line.kind === 'outline') || pattern.lines[0];
  const labelAnchor = labelLine?.points?.[labelLine.points.length - 1];
  const labelPoint = labelAnchor ? anchorToPoint({ anchor: labelAnchor, chart, series }) : null;

  return (
    <g className={`chart-pattern-overlay chart-pattern-${pattern.signal || 'neutral'}`}>
      {lineGroups}
      {labelPoint && (
          <g className="chart-pattern-label" transform={`translate(${labelPoint.x + 8}, ${labelPoint.y - 18})`}>
          <rect width={Math.max(74, String(pattern.label || pattern.name || pattern.type || '').length * 6.5 + 18)} height="22" rx="3" />
          <text x="8" y="15">{pattern.label || pattern.name || pattern.type || 'Chart Pattern'}</text>
        </g>
      )}
    </g>
  );
};

const autoTrendColor = {
  resistance: '#4ee093',
  stale: '#ff6670',
  support: '#4ea1ff'
};

const getAutoTrendAnalysisKey = ({ settings, symbol, symbolType, period }) => {
  if (!settings?.enabled) return '';
  return [
    symbolType || 'stock',
    symbol || '',
    period || '',
    settings.analysisType || 'standard',
    settings.drawingInput || 'wick',
    settings.islands || 'respect',
    settings.quality || 'relevant',
    settings.algorithmVersion || 'legacy',
    settings.appliedAt || 'legacy'
  ].join('|');
};

const AutoTrendlineShape = ({ chart, line, plotWidth, series }) => {
  if (!chart || !line || !series) return null;

  const startX = chart.timeScale().timeToCoordinate(line.start.time);
  const endX = chart.timeScale().timeToCoordinate(line.end.time);
  const startY = series.priceToCoordinate(line.start.price);
  const endY = series.priceToCoordinate(line.end.price);
  if (![startX, endX, startY, endY].every(Number.isFinite) || Math.abs(endX - startX) < 1) return null;

  const slope = (endY - startY) / (endX - startX);
  const projectedX = Math.max(0, plotWidth - 1);
  const projectedY = startY + slope * (projectedX - startX);
  const color = line.color || (line.status === 'stale' ? autoTrendColor.stale : autoTrendColor[line.side]);

  return (
    <g className={`auto-trendline auto-trendline-${line.side} auto-trendline-${line.status}`}>
      <line
        className="auto-trendline-line"
        style={{ stroke: color }}
        x1={startX}
        y1={startY}
        x2={projectedX}
        y2={projectedY}
      />
    </g>
  );
};

const HeatmapOverlayShape = ({ chart, data, overlayWidth, series, snapshotKey, type }) => {
  const clipId = React.useId().replace(/:/g, '');
  const [snapshot, setSnapshot] = useState(null);
  const tailSignature = useMemo(() => {
    if (!Array.isArray(data) || !data.length) return 'empty';
    const tail = data.at(-1);
    let tailTime = 'unknown';
    try {
      tailTime = getChartTime(tail);
    } catch {
      tailTime = 'unknown';
    }
    return [tailTime, tail?.open, tail?.high, tail?.low, tail?.close].join(':');
  }, [data]);
  const effectiveSnapshotKey = `${snapshotKey || 'heatmap'}:${tailSignature}`;

  useEffect(() => {
    setSnapshot(current => {
      if (!type || type === 'none') return null;
      if (current?.key === effectiveSnapshotKey && current.type === type) return current;
      if (!Array.isArray(data) || data.length < 2) return null;

      return {
        key: effectiveSnapshotKey,
        type,
        data,
        bounds: getHeatmapOverlayBounds(data),
        items: getHeatmapOverlayItems({ data, type })
      };
    });
  }, [data, effectiveSnapshotKey, type]);

  if (!chart || !series || !snapshot?.data?.length || !snapshot.items?.length || !type || type === 'none') return null;
  const items = snapshot.items;
  const snapshotData = snapshot.data;
  if (!items.length) return null;

  const barXs = snapshotData.map(row => {
    try {
      return chart.timeScale().timeToCoordinate(getChartTime(row));
    } catch {
      return null;
    }
  }).filter(Number.isFinite);
  const minX = barXs.length ? Math.max(0, Math.min(...barXs) - 12) : 0;
  const maxX = barXs.length ? Math.min(overlayWidth, Math.max(...barXs) + 12) : overlayWidth;
  const bounds = snapshot.bounds;
  const boundsX1 = bounds ? chart.timeScale().timeToCoordinate(bounds.startTime) : null;
  const boundsX2 = bounds ? chart.timeScale().timeToCoordinate(bounds.endTime) : null;
  const boundsTopY = bounds ? series.priceToCoordinate(bounds.maxPrice) : null;
  const boundsBottomY = bounds ? series.priceToCoordinate(bounds.minPrice) : null;
  const clipRect = [boundsX1, boundsX2, boundsTopY, boundsBottomY].every(Number.isFinite)
    ? {
      x: Math.min(boundsX1, boundsX2),
      y: Math.min(boundsTopY, boundsBottomY),
      width: Math.abs(boundsX2 - boundsX1),
      height: Math.abs(boundsBottomY - boundsTopY)
    }
    : null;

  return (
    <>
      {clipRect && (
        <defs>
          <clipPath id={clipId}>
            <rect
              height={clipRect.height}
              width={clipRect.width}
              x={clipRect.x}
              y={clipRect.y}
            />
          </clipPath>
        </defs>
      )}
      <g
        className={`heatmap-overlay heatmap-overlay-${type}`}
        clipPath={clipRect ? `url(#${clipId})` : undefined}
      >
        {items.map((item, index) => {
        if (item.type === 'srPattern') {
          const x1 = chart.timeScale().timeToCoordinate(item.startTime);
          const x2 = chart.timeScale().timeToCoordinate(item.endTime);
          const topY = series.priceToCoordinate(item.maxPrice);
          const bottomY = series.priceToCoordinate(item.minPrice);
          if (![x1, x2, topY, bottomY].every(Number.isFinite)) return null;
          const left = Math.min(x1, x2);
          const right = Math.max(x1, x2);
          const top = Math.min(topY, bottomY);
          const bottom = Math.max(topY, bottomY);
          const patternId = `${clipId}-sr-pattern-${index}`;
          const path = `M ${left} ${bottom} L ${left} ${top} L ${right} ${top} L ${right} ${bottom} Z`;

          return (
            <g className={`heatmap-pattern heatmap-pattern-${item.mode || 'depth'}`} key={`sr-pattern-${item.mode || 'depth'}-${index}`}>
              <defs>
                <pattern
                  height="100%"
                  id={patternId}
                  patternUnits="objectBoundingBox"
                  preserveAspectRatio="none"
                  viewBox="0 0 1 1"
                  width="100%"
                >
                  {item.bands.map((band, bandIndex) => (
                    <rect
                      fill="#ff0000"
                      height={band.height}
                      key={`${band.x}-${band.y}-${bandIndex}`}
                      style={{
                        opacity: item.mode === 'classic'
                          ? 0.05 + band.weight * 0.7
                          : 0.04 + band.weight * 0.86
                      }}
                      width={band.width}
                      x={band.x}
                      y={band.y}
                    />
                  ))}
                </pattern>
              </defs>
              <path d={path} fill={`url(#${patternId})`} stroke="none" />
            </g>
          );
        }

        if (item.type === 'srCell' || item.type === 'depthCell') {
          const x1 = chart.timeScale().timeToCoordinate(item.startTime);
          const x2 = chart.timeScale().timeToCoordinate(item.endTime);
          const topY = series.priceToCoordinate(item.price + item.heightPrice / 2);
          const bottomY = series.priceToCoordinate(item.price - item.heightPrice / 2);
          if (![x1, x2, topY, bottomY].every(Number.isFinite)) return null;
          const x = Math.max(0, Math.min(x1, x2) - 1);
          const y = Math.min(topY, bottomY);
          const width = Math.max(10, Math.abs(x2 - x1) + 2);
          const height = Math.max(4, Math.abs(bottomY - topY));

          return (
            <rect
              className={`heatmap-sr-cell heatmap-${item.mode || 'depth'}-cell`}
              height={height}
              key={`sr-cell-${item.mode || 'depth'}-${item.startTime}-${item.price}-${index}`}
              rx="1"
              style={{
                opacity: item.mode === 'classic'
                  ? 0.04 + item.weight * 0.26
                  : 0.02 + item.weight * 0.78
              }}
              width={width}
              x={x}
              y={y}
            />
          );
        }

        if (item.type === 'trend') {
          const x1 = chart.timeScale().timeToCoordinate(item.startTime);
          const x2 = chart.timeScale().timeToCoordinate(item.endTime);
          const y1 = series.priceToCoordinate(item.startPrice);
          const y2 = series.priceToCoordinate(item.endPrice);
          if (![x1, x2, y1, y2].every(Number.isFinite)) return null;
          return (
            <g
              className={`heatmap-trend-band heatmap-${item.tone}`}
              key={`trend-${item.startTime}-${item.endTime}-${index}`}
              style={{ opacity: 0.2 + item.weight * 0.28 }}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <line className="heatmap-trend-core" x1={x1} y1={y1} x2={x2} y2={y2} />
            </g>
          );
        }

        const centerY = series.priceToCoordinate(item.price);
        const topY = series.priceToCoordinate(item.price + item.heightPrice / 2);
        const bottomY = series.priceToCoordinate(item.price - item.heightPrice / 2);
        if (![centerY, topY, bottomY].every(Number.isFinite)) return null;
        const heatHeight = Math.min(18, Math.max(6, Math.abs(bottomY - topY)));
        const coreHeight = Math.max(2, Math.min(5, heatHeight * 0.34));
        const y = centerY - heatHeight / 2;
        const itemStartX = item.startTime
          ? chart.timeScale().timeToCoordinate(item.startTime)
          : null;
        const startX = Number.isFinite(itemStartX) ? Math.max(0, itemStartX) : minX;
        const levelEndX = maxX;
        const depthWidth = Math.max(92, Math.min(maxX - minX, 92 + item.weight * 260));
        const x = item.type === 'depth'
          ? Math.max(minX, maxX - depthWidth)
          : startX;
        const width = item.type === 'depth'
          ? depthWidth
          : Math.max(72, levelEndX - x);

        return (
          <g
            className={`heatmap-band heatmap-${item.tone} heatmap-${item.side || 'level'}`}
            key={`${item.type}-${item.price}-${index}`}
            style={{ opacity: 0.32 + item.weight * 0.48 }}
          >
            <rect className="heatmap-glow" x={x} y={y} width={width} height={heatHeight} rx="1" />
            <rect className="heatmap-core" x={x} y={centerY - coreHeight / 2} width={width} height={coreHeight} rx="1" />
            <line x1={x} y1={centerY} x2={x + width} y2={centerY} />
          </g>
        );
        })}
      </g>
    </>
  );
};

const DrawingShape = ({
  chartData,
  drawing,
  chart,
  deleteDrawing,
  onAnchorDragStart,
  onContextMenu,
  onDoubleClick,
  onTextEdit,
  onMoveStart,
  overlayWidth,
  series,
  selected,
  onSelect
}) => {
  const common = {
    className: selected ? 'drawing-shape selected' : 'drawing-shape',
    stroke: getDrawingColor(drawing),
    strokeWidth: drawing.style?.width || 2,
    strokeDasharray: getStrokeDasharray(drawing),
    onPointerDown: (event) => {
      event.stopPropagation();
      if (event.button === 2) {
        event.preventDefault();
        onSelect?.(drawing.id);
        onContextMenu?.(event, drawing);
        return;
      }
      if (event.shiftKey) {
        deleteDrawing?.(drawing.id);
        return;
      }
      onSelect?.(drawing.id);
      if (isDrawingLocked(drawing)) return;
      onMoveStart?.(event, drawing);
    },
    onContextMenu: (event) => {
      event.preventDefault();
      event.stopPropagation();
      onContextMenu?.(event, drawing);
    },
    onDoubleClick: (event) => {
      event.stopPropagation();
      onDoubleClick?.(event, drawing);
    }
  };
  const anchorPoints = getDrawingPoints(drawing, chart, series);
  const labelText = drawing.style?.label || '';
  const labelPoint = anchorPoints[anchorPoints.length - 1] || anchorPoints[0];
  const handles = selected && !isDrawingLocked(drawing) ? anchorPoints.map((point, index) => (
    <DrawingHandle
      key={`${drawing.id}-${index}`}
      point={point}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect?.(drawing.id);
        onAnchorDragStart?.(event, drawing, index);
      }}
    />
  )) : null;
  const alertMarker = drawing.style?.alertEnabled && labelPoint ? (
    <g className="drawing-alert-marker" transform={`translate(${labelPoint.x + 10}, ${labelPoint.y - 10})`}>
      <circle r="5" />
      <path d="M-2,-1 L0,-3 L2,-1 M0,-3 L0,2" />
    </g>
  ) : null;
  const customLabel = labelText && labelPoint ? (
    <text className="drawing-label custom-drawing-label" x={labelPoint.x + 10} y={labelPoint.y + 16}>
      {labelText}
    </text>
  ) : null;

  if (['trend', 'segment', 'extended', 'arrow', 'measure'].includes(drawing.type)) {
    const points = getLinePoints(drawing, chart, series);
    if (!points) return null;
    const [anchorStart, anchorEnd] = points;
    const line = drawing.type === 'trend'
      ? getTrendRayLine(anchorStart, anchorEnd, overlayWidth)
      : drawing.type === 'extended'
        ? getExtendedLine(anchorStart, anchorEnd, overlayWidth)
        : { start: anchorStart, end: anchorEnd };
    const { start, end } = line;
    const markerEnd = drawing.type === 'arrow' ? 'url(#drawing-arrow)' : undefined;

    return (
      <g>
        <line {...common} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd={markerEnd} />
        <line className="drawing-hit-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
        {drawing.type === 'measure' && (
          <text className="drawing-label" x={(start.x + end.x) / 2 + 8} y={(start.y + end.y) / 2 - 8}>
            {formatMeasureLabel(drawing.anchors[0], drawing.anchors[1])}
          </text>
        )}
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'channel') {
    const points = getLinePoints(drawing, chart, series);
    if (!points || points.length < 3) return null;
    const [anchorStart, anchorEnd, offsetPoint] = points;
    const channel = getChannelGeometry(anchorStart, anchorEnd, offsetPoint, overlayWidth);
    if (!channel) return null;

    return (
      <g>
        <polygon className="drawing-channel-fill" points={channel.polygonPoints} fill={getDrawingColor(drawing)} />
        {[channel.base, channel.parallel, channel.median].map((line, index) => (
          <g key={index}>
            <line
              {...common}
              className={index === 2 ? `${common.className} drawing-channel-median` : common.className}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
            />
            <line className="drawing-hit-line" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
          </g>
        ))}
        {handles}
      </g>
    );
  }

  if (drawing.type === 'pitchfork') {
    const points = getLinePoints(drawing, chart, series);
    if (!points || points.length < 3) return null;
    const [handle, sideA, sideB] = points;
    const pitchfork = getPitchforkGeometry(handle, sideA, sideB, overlayWidth);
    if (!pitchfork) return null;

    return (
      <g>
        {[pitchfork.sideA, pitchfork.median, pitchfork.sideB].filter(Boolean).map((line, index) => (
          <g key={index}>
            <line
              {...common}
              className={index === 1 ? `${common.className} drawing-channel-median` : common.className}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
            />
            <line className="drawing-hit-line" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
          </g>
        ))}
        <line className="drawing-fib-guide" x1={sideA.x} y1={sideA.y} x2={sideB.x} y2={sideB.y} />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'horizontal') {
    const point = getSinglePoint(drawing, chart, series);
    if (!point) return null;

    return (
      <g>
        <line {...common} x1={0} y1={point.y} x2="100%" y2={point.y} />
        <line className="drawing-hit-line" x1={0} y1={point.y} x2="100%" y2={point.y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'vertical') {
    const point = getSinglePoint(drawing, chart, series);
    if (!point) return null;

    return (
      <g>
        <line {...common} x1={point.x} y1={0} x2={point.x} y2="100%" />
        <line className="drawing-hit-line" x1={point.x} y1={0} x2={point.x} y2="100%" onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'rectangle') {
    const rect = getRectangle(drawing, chart, series);
    if (!rect) return null;

    return (
      <g>
        <rect
          {...common}
          {...rect}
          fill={`${getDrawingColor(drawing)}18`}
        />
        <rect
          className="drawing-hit-rect"
          {...rect}
          onContextMenu={common.onContextMenu}
          onDoubleClick={common.onDoubleClick}
          onPointerDown={common.onPointerDown}
        />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'ellipse') {
    const ellipse = getEllipse(drawing, chart, series);
    if (!ellipse) return null;

    return (
      <g>
        <ellipse
          {...common}
          {...ellipse}
          fill={`${getDrawingColor(drawing)}14`}
        />
        <ellipse
          className="drawing-hit-ellipse"
          {...ellipse}
          onContextMenu={common.onContextMenu}
          onDoubleClick={common.onDoubleClick}
          onPointerDown={common.onPointerDown}
        />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'fibonacci') {
    const points = getLinePoints(drawing, chart, series);
    if (!points) return null;
    const [start, end] = points;
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const height = end.y - start.y;
    const fillMid = drawing.style?.fillMid !== false;

    return (
      <g>
        {fibonacciLevels.map(level => {
          const y = start.y + height * level;
          const label = `${(level * 100).toFixed(level === 0 || level === 1 ? 0 : 1)}%`;
          return (
            <g key={level}>
              <line
                {...common}
                className={selected ? 'drawing-shape selected fibonacci-level' : 'drawing-shape fibonacci-level'}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
              />
              <line className="drawing-hit-line" x1={x1} y1={y} x2={x2} y2={y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
              <text className="drawing-label fibonacci-label" x={x2 + 6} y={y - 4}>
                {label}
              </text>
            </g>
          );
        })}
        {fillMid && (
          <rect
            className="drawing-fib-fill"
            x={x1}
            y={Math.min(start.y + height * 0.382, start.y + height * 0.618)}
            width={Math.max(1, x2 - x1)}
            height={Math.abs(height * (0.618 - 0.382))}
            fill={getDrawingColor(drawing)}
          />
        )}
        <line className="drawing-fib-guide" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'fibExtension') {
    const points = getLinePoints(drawing, chart, series);
    if (!points || points.length < 3) return null;
    const [start, end, extensionStart] = points;
    const x1 = Math.min(start.x, end.x, extensionStart.x);
    const x2 = Math.max(start.x, end.x, extensionStart.x) + 80;
    const height = end.y - start.y;

    return (
      <g>
        {fibonacciExtensionLevels.map(level => {
          const y = extensionStart.y + height * level;
          const label = `${(level * 100).toFixed(level >= 1 ? 1 : 1)}%`;
          return (
            <g key={level}>
              <line
                {...common}
                className={selected ? 'drawing-shape selected fibonacci-level' : 'drawing-shape fibonacci-level'}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
              />
              <line className="drawing-hit-line" x1={x1} y1={y} x2={x2} y2={y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
              <text className="drawing-label fibonacci-label" x={x2 + 6} y={y - 4}>
                {label}
              </text>
            </g>
          );
        })}
        <polyline
          className="drawing-fib-guide"
          points={`${start.x},${start.y} ${end.x},${end.y} ${extensionStart.x},${extensionStart.y}`}
        />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'fibTimeZones') {
    const anchorPoints = getLinePoints(drawing, chart, series);
    if (!anchorPoints) return null;
    const zones = getFibTimeZoneLines(drawing.anchors[0], drawing.anchors[1], chart);
    if (!zones.length) return null;

    return (
      <g>
        {zones.map(zone => (
          <g key={zone.level}>
            <line
              {...common}
              className={selected ? 'drawing-shape selected fibonacci-level' : 'drawing-shape fibonacci-level'}
              x1={zone.x}
              y1={0}
              x2={zone.x}
              y2="100%"
            />
            <line className="drawing-hit-line" x1={zone.x} y1={0} x2={zone.x} y2="100%" onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
            <text className="drawing-label fibonacci-label" x={zone.x + 5} y={14}>
              {zone.level}
            </text>
          </g>
        ))}
        <line className="drawing-fib-guide" x1={anchorPoints[0].x} y1={anchorPoints[0].y} x2={anchorPoints[1].x} y2={anchorPoints[1].y} />
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'priceRange') {
    const points = getLinePoints(drawing, chart, series);
    if (!points) return null;
    const [start, end] = points;
    const x = Math.max(0, Math.min(start.x, end.x) - 18);
    const y1 = start.y;
    const y2 = end.y;
    const label = formatPriceRangeLabel(drawing.anchors[0], drawing.anchors[1]);

    return (
      <g>
        <line {...common} x1={x} y1={y1} x2={x} y2={y2} />
        <line className="drawing-hit-line" x1={x} y1={y1} x2={x} y2={y2} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
        <line className="drawing-range-cap" x1={x - 10} y1={y1} x2={x + 10} y2={y1} />
        <line className="drawing-range-cap" x1={x - 10} y1={y2} x2={x + 10} y2={y2} />
        <text className="drawing-label range-label" x={x + 12} y={(y1 + y2) / 2 - 4}>
          {label}
        </text>
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'dateRange') {
    const points = getLinePoints(drawing, chart, series);
    if (!points) return null;
    const [start, end] = points;
    const y = Math.max(start.y, end.y) + 22;
    const x1 = start.x;
    const x2 = end.x;
    const label = formatDateRangeLabel(drawing.anchors[0], drawing.anchors[1], chartData);

    return (
      <g>
        <line {...common} x1={x1} y1={y} x2={x2} y2={y} />
        <line className="drawing-hit-line" x1={x1} y1={y} x2={x2} y2={y} onContextMenu={common.onContextMenu} onDoubleClick={common.onDoubleClick} onPointerDown={common.onPointerDown} />
        <line className="drawing-range-cap" x1={x1} y1={y - 10} x2={x1} y2={y + 10} />
        <line className="drawing-range-cap" x1={x2} y1={y - 10} x2={x2} y2={y + 10} />
        <text className="drawing-label range-label" x={(x1 + x2) / 2 + 8} y={y - 8}>
          {label}
        </text>
        {handles}
        {alertMarker}
        {customLabel}
      </g>
    );
  }

  if (drawing.type === 'text' || drawing.type === 'callout') {
    const point = getSinglePoint(drawing, chart, series);
    if (!point) return null;
    const text = drawing.text || (drawing.type === 'callout' ? 'Callout' : 'Note');
    const lineWidth = Math.min(180, Math.max(56, text.length * 7 + 18));

    if (drawing.type === 'callout') {
      return (
        <g>
          <path
            className={selected ? 'drawing-callout selected' : 'drawing-callout'}
            d={`M${point.x + 8},${point.y - 34} h${lineWidth} v30 h-34 l-12,14 l4,-14 h-8 z`}
            fill={`${getDrawingColor(drawing)}1f`}
            stroke={getDrawingColor(drawing)}
            strokeDasharray={getStrokeDasharray(drawing)}
            strokeWidth={drawing.style?.width || 2}
            onContextMenu={common.onContextMenu}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onTextEdit?.(drawing, point);
            }}
            onPointerDown={common.onPointerDown}
          />
          <text
            className={selected ? 'drawing-text selected' : 'drawing-text'}
            x={point.x + 18}
            y={point.y - 14}
            fill={getDrawingColor(drawing)}
            onContextMenu={common.onContextMenu}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onTextEdit?.(drawing, point);
            }}
            onPointerDown={common.onPointerDown}
          >
            {text}
          </text>
          {handles}
          {alertMarker}
        </g>
      );
    }

    return (
      <g>
        <text
          {...common}
          className={selected ? 'drawing-text selected' : 'drawing-text'}
          x={point.x + 6}
          y={point.y - 6}
          fill={getDrawingColor(drawing)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onTextEdit?.(drawing, point);
          }}
        >
          {text}
        </text>
        {handles}
        {alertMarker}
      </g>
    );
  }

  return null;
};

const DrawingOverlay = ({
  activeDrawingTool,
  addDrawing,
  autoFibonacciEnabled = false,
  autoTrendSettings = { enabled: false, quality: 'relevant' },
  chartRef,
  data,
  deleteDrawing,
  drawingsBySymbol,
  heatmapEnabled = false,
  heatmapType = 'horizontal',
  paneRef,
  patterns,
  period,
  selectedDrawingId,
  selectDrawing,
  seriesRef,
  symbol,
  symbolType,
  updateDrawing
}) => {
  const overlayRef = useRef(null);
  const contextMenuRef = useRef(null);
  const textEditorRef = useRef(null);
  const draftStartRef = useRef(null);
  const draftSecondRef = useRef(null);
  const draftPointerRef = useRef(null);
  const dragStateRef = useRef(null);
  const autoTrendCacheRef = useRef({ key: '', lines: [] });
  const autoTrendClipId = React.useId().replace(/:/g, '');
  const lastStyleByToolRef = useRef(readStoredDrawingStyles());
  const [draftPoint, setDraftPoint] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [renderTick, setRenderTick] = useState(0);
  const chart = chartRef.current;
  const series = seriesRef.current;
  const activeSymbol = useMemo(() => ({ symbol, symbolType }), [symbol, symbolType]);
  const drawings = getDrawingsForSymbol(drawingsBySymbol, activeSymbol)
    .filter(drawing => shouldShowDrawingForPeriod(drawing, period));
  const isDrawingTool = activeDrawingTool && activeDrawingTool !== 'select';

  useEffect(() => {
    if (!chart) return undefined;
    const rerender = () => {
      const rect = paneRef.current?.getBoundingClientRect();
      if (rect) setOverlaySize({ width: rect.width, height: rect.height });
      setRenderTick(tick => tick + 1);
    };
    rerender();
    chart.timeScale().subscribeVisibleLogicalRangeChange(rerender);
    window.addEventListener('resize', rerender);

    const resizeObserver = typeof ResizeObserver !== 'undefined' && paneRef.current
      ? new ResizeObserver(rerender)
      : null;
    resizeObserver?.observe(paneRef.current);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rerender);
      window.removeEventListener('resize', rerender);
      resizeObserver?.disconnect();
    };
  }, [chart, paneRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && textEditor) {
        closeTextEditor();
        return;
      }

      if (event.key === 'Escape' && contextMenu) {
        setContextMenu(null);
        return;
      }

      if (event.key === 'Escape' && draftStartRef.current) {
        draftStartRef.current = null;
        draftSecondRef.current = null;
        draftPointerRef.current = null;
        setDraftPoint(null);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        deleteDrawing?.(selectedDrawingId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu, deleteDrawing, selectedDrawingId, textEditor]);

  useEffect(() => {
    if (!contextMenu && !textEditor) return undefined;

    const isInsideFloatingControl = (event) => {
      const target = event.target;
      return Boolean(
        contextMenuRef.current?.contains(target)
        || textEditorRef.current?.contains(target)
      );
    };

    const closeFloatingControls = (event) => {
      if (isInsideFloatingControl(event)) return;
      setContextMenu(null);
      if (textEditor) commitTextEditor();
    };

    window.addEventListener('pointerdown', closeFloatingControls, true);
    window.addEventListener('wheel', closeFloatingControls, true);
    window.addEventListener('blur', closeFloatingControls);

    return () => {
      window.removeEventListener('pointerdown', closeFloatingControls, true);
      window.removeEventListener('wheel', closeFloatingControls, true);
      window.removeEventListener('blur', closeFloatingControls);
    };
  }, [contextMenu, textEditor]);

  useEffect(() => {
    draftStartRef.current = null;
    draftSecondRef.current = null;
    draftPointerRef.current = null;
    setDraftPoint(null);
  }, [activeDrawingTool, symbol, symbolType]);

  if (!symbol || !chart || !series || !data?.length) return null;

  const plotWidth = Math.max(
    0,
    Math.min(overlaySize.width, Number(chart.timeScale().width?.()) || overlaySize.width)
  );

  const getAnchorFromEvent = (event) => {
    const point = getPointerPoint(event, overlayRef.current);
    if (!point) return null;
    const rawAnchor = coordinateToAnchor({ point, chart, series });
    if (!rawAnchor || event.altKey) return rawAnchor;

    const shouldSnapPrice = priceSnapTools.has(activeDrawingTool);
    const shouldSnapTime = timeSnapTools.has(activeDrawingTool);
    if (!shouldSnapPrice && !shouldSnapTime) return rawAnchor;

    const snapCandidates = data
      .map(bar => {
        try {
          const time = getChartTime(bar);
          const x = chart.timeScale().timeToCoordinate(time);
          if (!Number.isFinite(x)) return null;
          return { bar, time, x };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (!snapCandidates.length) return rawAnchor;

    const nearestTime = snapCandidates.reduce((best, candidate) => (
      Math.abs(candidate.x - point.x) < Math.abs(best.x - point.x) ? candidate : best
    ), snapCandidates[0]);
    const snappedTime = shouldSnapTime && Math.abs(nearestTime.x - point.x) <= 14
      ? nearestTime.time
      : rawAnchor.time;
    const priceBar = shouldSnapTime && snappedTime === nearestTime.time
      ? nearestTime.bar
      : snapCandidates.reduce((best, candidate) => (
        Math.abs(candidate.x - point.x) < Math.abs(best.x - point.x) ? candidate : best
      ), snapCandidates[0]).bar;
    const priceCandidates = ['high', 'low', 'open', 'close']
      .map(key => Number(priceBar?.[key]))
      .filter(Number.isFinite)
      .map(price => ({
        price,
        y: series.priceToCoordinate(price)
      }))
      .filter(candidate => Number.isFinite(candidate.y));
    const nearestPrice = priceCandidates.reduce((best, candidate) => {
      if (!best) return candidate;
      return Math.abs(candidate.y - point.y) < Math.abs(best.y - point.y) ? candidate : best;
    }, null);
    const snappedPrice = shouldSnapPrice && nearestPrice && Math.abs(nearestPrice.y - point.y) <= 14
      ? nearestPrice.price
      : rawAnchor.price;

    return {
      time: snappedTime,
      price: snappedPrice
    };
  };

  const beginDrag = (event, drawing, mode, anchorIndex = null) => {
    if (!drawing?.anchors?.length) return;
    const pointerAnchor = getAnchorFromEvent(event);
    if (!pointerAnchor) return;
    setContextMenu(null);

    let activeDrawing = drawing;
    if (event.ctrlKey && mode === 'move') {
      activeDrawing = createDrawing({
        tool: drawing.type,
        symbol,
        symbolType,
        anchors: drawing.anchors,
        text: drawing.text,
        style: drawing.style
      });
      addDrawing?.(activeDrawing);
    }

    event.currentTarget?.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      anchorIndex,
      drawingId: activeDrawing.id,
      mode,
      originalAnchors: activeDrawing.anchors.map(anchor => ({ ...anchor })),
      pointerAnchor
    };
  };

  const rememberToolStyle = (tool, style) => {
    if (!tool || !style) return;
    const next = {
      ...lastStyleByToolRef.current,
      [tool]: {
        ...(lastStyleByToolRef.current[tool] || {}),
        ...style
      }
    };
    lastStyleByToolRef.current = next;
    persistStoredDrawingStyles(next);
  };

  const updateDrawingStyle = (drawing, stylePatch) => {
    updateDrawing?.(drawing.id, {
      style: {
        ...(drawing.style || {}),
        ...stylePatch
      }
    });
    rememberToolStyle(drawing.type, stylePatch);
    setContextMenu(menu => menu?.drawing?.id === drawing.id
      ? { ...menu, drawing: { ...menu.drawing, style: { ...(menu.drawing.style || {}), ...stylePatch } } }
      : menu
    );
  };

  const toggleDrawingLock = (drawing) => {
    updateDrawingStyle(drawing, { locked: !isDrawingLocked(drawing) });
  };

  const toggleDrawingAlert = (drawing) => {
    updateDrawingStyle(drawing, { alertEnabled: !drawing.style?.alertEnabled });
  };

  const openTextEditor = ({ anchor, drawing = null, point, tool = 'text' }) => {
    setContextMenu(null);
    setTextEditor({
      anchor,
      drawingId: drawing?.id || null,
      point,
      text: drawing?.text || (tool === 'callout' ? 'Callout' : 'Note'),
      tool
    });
  };

  const closeTextEditor = () => setTextEditor(null);

  const commitTextEditor = () => {
    if (!textEditor) return;
    const text = textEditor.text.trim() || (textEditor.tool === 'callout' ? 'Callout' : 'Note');

    if (textEditor.drawingId) {
      updateDrawing?.(textEditor.drawingId, { text });
      setTextEditor(null);
      return;
    }

    finishDrawing(textEditor.tool, [textEditor.anchor], text);
    setTextEditor(null);
  };

  const cloneDrawing = (drawing) => {
    const offsetAnchors = drawing.anchors.map(anchor => ({
      time: anchor.time,
      price: anchor.price * 1.002
    }));
    const clone = createDrawing({
      tool: drawing.type,
      symbol,
      symbolType,
      anchors: offsetAnchors,
      text: drawing.text,
      style: drawing.style
    });
    addDrawing?.(clone);
    setContextMenu(null);
  };

  const updateDrag = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const currentAnchor = getAnchorFromEvent(event);
    if (!currentAnchor) return;

    let nextAnchors;
    if (dragState.mode === 'anchor') {
      nextAnchors = dragState.originalAnchors.map((anchor, index) =>
        index === dragState.anchorIndex ? currentAnchor : anchor
      );
    } else {
      const timeDelta = currentAnchor.time - dragState.pointerAnchor.time;
      const priceDelta = currentAnchor.price - dragState.pointerAnchor.price;
      nextAnchors = dragState.originalAnchors.map(anchor => ({
        time: anchor.time + timeDelta,
        price: anchor.price + priceDelta
      }));
    }

    updateDrawing?.(dragState.drawingId, { anchors: nextAnchors });
  };

  const finishDrawing = (tool, anchors, text = '') => {
    if (!anchors.every(Boolean)) return;
    const drawing = createDrawing({
      tool,
      symbol,
      symbolType,
      anchors,
      text,
      style: {
        visibleOn: 'currentAndLower',
        displayAllWorkspaces: true,
        sourcePeriod: period,
        ...(lastStyleByToolRef.current[tool] || {})
      }
    });
    addDrawing?.(drawing);
    draftStartRef.current = null;
    draftSecondRef.current = null;
    draftPointerRef.current = null;
    setDraftPoint(null);
  };

  const handlePointerDown = (event) => {
    setContextMenu(null);
    if (dragStateRef.current) return;

    if (!isDrawingTool) {
      selectDrawing?.(null);
      return;
    }

    const anchor = getAnchorFromEvent(event);
    if (!anchor) return;
    const point = getPointerPoint(event, overlayRef.current);

    if (activeDrawingTool === 'horizontal' || activeDrawingTool === 'vertical') {
      finishDrawing(activeDrawingTool, [anchor]);
      return;
    }

    if (activeDrawingTool === 'text' || activeDrawingTool === 'callout') {
      openTextEditor({
        anchor,
        point,
        tool: activeDrawingTool
      });
      return;
    }

    if (activeDrawingTool === 'channel' || activeDrawingTool === 'pitchfork') {
      if (!draftStartRef.current) {
        draftStartRef.current = anchor;
        draftPointerRef.current = { point, startedNewDraft: true };
        setDraftPoint(point);
        return;
      }

      if (!draftSecondRef.current) {
        draftSecondRef.current = anchor;
        draftPointerRef.current = { point, startedNewDraft: false };
        setDraftPoint(point);
        return;
      }

      finishDrawing(activeDrawingTool, [draftStartRef.current, draftSecondRef.current, anchor]);
      return;
    }

    if (activeDrawingTool === 'fibExtension') {
      if (!draftStartRef.current) {
        draftStartRef.current = anchor;
        draftPointerRef.current = { point, startedNewDraft: true };
        setDraftPoint(point);
        return;
      }

      if (!draftSecondRef.current) {
        draftSecondRef.current = anchor;
        draftPointerRef.current = { point, startedNewDraft: false };
        setDraftPoint(point);
        return;
      }

      finishDrawing('fibExtension', [draftStartRef.current, draftSecondRef.current, anchor]);
      return;
    }

    draftPointerRef.current = {
      point,
      startedNewDraft: !draftStartRef.current
    };

    if (!draftStartRef.current) {
      draftStartRef.current = anchor;
    }
    setDraftPoint(point);
  };

  const handlePointerMove = (event) => {
    if (dragStateRef.current) {
      updateDrag(event);
      return;
    }
    if (!draftStartRef.current) return;
    setDraftPoint(getPointerPoint(event, overlayRef.current));
  };

  const handlePointerUp = (event) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      return;
    }
    if (!draftStartRef.current) return;
    const endAnchor = getAnchorFromEvent(event);
    const tool = activeDrawingTool;
    const pointerStart = draftPointerRef.current;
    const pointerEnd = getPointerPoint(event, overlayRef.current);
    const movedEnoughToFinish = getPointDistance(pointerStart?.point, pointerEnd) > 4;

    if (tool === 'rectangle' || tool === 'ellipse') {
      if (!movedEnoughToFinish) {
        draftStartRef.current = null;
        draftSecondRef.current = null;
        draftPointerRef.current = null;
        setDraftPoint(null);
        return;
      }

      finishDrawing(tool, [draftStartRef.current, endAnchor]);
      return;
    }

    if (twoAnchorTools.has(tool)) {
      if (pointerStart?.startedNewDraft && !movedEnoughToFinish) {
        draftPointerRef.current = null;
        setDraftPoint(pointerEnd);
        return;
      }

      finishDrawing(tool, [draftStartRef.current, endAnchor]);
    }
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const draftStartPoint = draftStartRef.current
    ? anchorToPoint({ anchor: draftStartRef.current, chart, series })
    : null;
  const draftSecondPoint = draftSecondRef.current
    ? anchorToPoint({ anchor: draftSecondRef.current, chart, series })
    : null;
  const draftTrendPoints = draftStartPoint && draftPoint && activeDrawingTool === 'trend'
    ? getTrendRayLine(draftStartPoint, draftPoint, plotWidth)
    : null;
  const draftExtendedPoints = draftStartPoint && draftPoint && activeDrawingTool === 'extended'
    ? getExtendedLine(draftStartPoint, draftPoint, plotWidth)
    : null;
  const draftChannel = activeDrawingTool === 'channel' && draftStartPoint && draftPoint
    ? (draftSecondPoint
      ? getChannelGeometry(draftStartPoint, draftSecondPoint, draftPoint, plotWidth)
      : { base: getTrendRayLine(draftStartPoint, draftPoint, plotWidth), parallel: null, median: null })
    : null;
  const draftPitchfork = activeDrawingTool === 'pitchfork' && draftStartPoint && draftPoint
    ? (draftSecondPoint
      ? getPitchforkGeometry(draftStartPoint, draftSecondPoint, draftPoint, plotWidth)
      : { median: getRayThroughPoints(draftStartPoint, draftPoint, plotWidth), sideA: null, sideB: null })
    : null;
  const draftBox = draftStartPoint && draftPoint && ['rectangle', 'ellipse'].includes(activeDrawingTool)
    ? {
      x: Math.min(draftStartPoint.x, draftPoint.x),
      y: Math.min(draftStartPoint.y, draftPoint.y),
      width: Math.abs(draftPoint.x - draftStartPoint.x),
      height: Math.abs(draftPoint.y - draftStartPoint.y)
    }
    : null;
  const draftFib = draftStartPoint && draftPoint && activeDrawingTool === 'fibonacci'
    ? {
      x1: Math.min(draftStartPoint.x, draftPoint.x),
      x2: Math.max(draftStartPoint.x, draftPoint.x),
      height: draftPoint.y - draftStartPoint.y
    }
    : null;
  const draftFibExtension = activeDrawingTool === 'fibExtension' && draftStartPoint && draftPoint
    ? (draftSecondPoint
      ? {
        x1: Math.min(draftStartPoint.x, draftSecondPoint.x, draftPoint.x),
        x2: Math.max(draftStartPoint.x, draftSecondPoint.x, draftPoint.x) + 80,
        height: draftSecondPoint.y - draftStartPoint.y,
        originY: draftPoint.y
      }
      : null)
    : null;
  const draftFibTimeZones = draftStartRef.current && activeDrawingTool === 'fibTimeZones'
    ? (() => {
      const draftEndAnchor = draftSecondRef.current || (draftPoint ? coordinateToAnchor({ point: draftPoint, chart, series }) : null);
      return getFibTimeZoneLines(draftStartRef.current, draftEndAnchor, chart);
    })()
    : null;
  const draftPriceRange = draftStartPoint && draftPoint && activeDrawingTool === 'priceRange'
    ? {
      x: Math.max(0, Math.min(draftStartPoint.x, draftPoint.x) - 18),
      y1: draftStartPoint.y,
      y2: draftPoint.y
    }
    : null;
  const draftDateRange = draftStartPoint && draftPoint && activeDrawingTool === 'dateRange'
    ? {
      x1: draftStartPoint.x,
      x2: draftPoint.x,
      y: Math.max(draftStartPoint.y, draftPoint.y) + 22
    }
    : null;
  const contextMenuSize = contextMenu?.mode === 'properties'
    ? { width: 220, height: 420 }
    : { width: 210, height: 222 };
  const autoFibonacciModel = autoFibonacciEnabled
    ? getAutoFibonacciModel(data, chart.timeScale().getVisibleLogicalRange?.())
    : null;
  const autoTrendAnalysisKey = getAutoTrendAnalysisKey({
    period,
    settings: autoTrendSettings,
    symbol,
    symbolType
  });
  if (!autoTrendAnalysisKey) {
    autoTrendCacheRef.current = { key: '', lines: [] };
  } else if (
    autoTrendCacheRef.current.key !== autoTrendAnalysisKey
    && Array.isArray(data)
    && data.length >= 12
  ) {
    autoTrendCacheRef.current = {
      key: autoTrendAnalysisKey,
      lines: getAutoTrendlines(data, { ...autoTrendSettings, period })
    };
  }
  const autoTrendlines = autoTrendAnalysisKey ? autoTrendCacheRef.current.lines : [];
  const chartPatternOverlayItems = getChartPatternOverlayItems(patterns, data);
  const resolvedHeatmapType = heatmapEnabled ? heatmapType : 'none';

  return (
    <svg
      ref={overlayRef}
      className={getDrawingOverlayClassName(activeDrawingTool)}
      data-render-tick={renderTick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      <defs>
        <marker id="drawing-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path d="M0,0 L8,4 L0,8 Z" fill="#4ee093" />
        </marker>
        <clipPath id={autoTrendClipId}>
          <rect height={overlaySize.height} width={plotWidth} x="0" y="0" />
        </clipPath>
      </defs>
      <AutoFibonacciShape
        chart={chart}
        model={autoFibonacciModel}
        overlayHeight={overlaySize.height}
        overlayWidth={overlaySize.width}
        series={series}
      />
      <HeatmapOverlayShape
        chart={chart}
        data={data}
        overlayWidth={overlaySize.width}
        series={series}
        snapshotKey={`${symbolType || 'stock'}:${symbol || ''}:${period || ''}`}
        type={resolvedHeatmapType}
      />
      <g clipPath={`url(#${autoTrendClipId})`}>
        {autoTrendlines.map(line => (
          <AutoTrendlineShape
            chart={chart}
            key={line.id}
            line={line}
            plotWidth={plotWidth}
            series={series}
          />
        ))}
      </g>
      {chartPatternOverlayItems.map((pattern, index) => (
        <ChartPatternShape
          chart={chart}
          key={`${pattern.type}-${pattern.time || index}`}
          pattern={pattern}
          series={series}
        />
      ))}
      <g clipPath={`url(#${autoTrendClipId})`}>
        {drawings.map(drawing => (
          <DrawingShape
            chartData={data}
            chart={chart}
            deleteDrawing={deleteDrawing}
            drawing={drawing}
            key={drawing.id}
            onAnchorDragStart={(event, item, anchorIndex) => beginDrag(event, item, 'anchor', anchorIndex)}
            onContextMenu={(event, item) => {
              const point = getPointerPoint(event, overlayRef.current);
              if (!point) return;
              selectDrawing?.(item.id);
              setContextMenu({ drawing: item, mode: 'actions', x: point.x, y: point.y });
            }}
            onDoubleClick={(event, item) => {
              const point = getPointerPoint(event, overlayRef.current);
              if (!point) return;
              selectDrawing?.(item.id);
              setContextMenu({ drawing: item, mode: 'properties', x: point.x, y: point.y });
            }}
            onTextEdit={(item, point) => openTextEditor({
              anchor: item.anchors[0],
              drawing: item,
              point,
              tool: item.type
            })}
            onMoveStart={(event, item) => beginDrag(event, item, 'move')}
            overlayWidth={plotWidth}
            selected={selectedDrawingId === drawing.id}
            series={series}
            onSelect={selectDrawing}
          />
        ))}
      </g>
      {contextMenu && (
        <foreignObject
          className="drawing-context-menu-container"
          x={Math.min(contextMenu.x, Math.max(0, overlaySize.width - contextMenuSize.width))}
          y={Math.min(contextMenu.y, Math.max(0, overlaySize.height - contextMenuSize.height))}
          width={contextMenuSize.width}
          height={contextMenuSize.height}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div
            ref={contextMenuRef}
            className={`drawing-context-menu ${contextMenu.mode === 'properties' ? 'properties-mode' : 'actions-mode'}`}
            xmlns="http://www.w3.org/1999/xhtml"
          >
            <div className="drawing-context-menu-title">
              <span>{contextMenu.drawing.type}</span>
              {isDrawingLocked(contextMenu.drawing) && <b>Locked</b>}
            </div>
            {contextMenu.mode === 'properties' ? (
              <>
                <button
                  className="drawing-context-back"
                  type="button"
                  onClick={() => setContextMenu(menu => ({ ...menu, mode: 'actions' }))}
                >
                  Back
                </button>
                <div className="drawing-context-section swatches">
                  {drawingPalette.map(color => (
                    <button
                      aria-label={`Set color ${color}`}
                      className={getDrawingColor(contextMenu.drawing).toLowerCase() === color.toLowerCase() ? 'active' : ''}
                      key={color}
                      style={{ '--swatch-color': color }}
                      type="button"
                      onClick={() => updateDrawingStyle(contextMenu.drawing, { color })}
                    />
                  ))}
                </div>
                <div className="drawing-context-section width-options">
                  {drawingWidths.map(width => (
                    <button
                      className={(contextMenu.drawing.style?.width || 2) === width ? 'active' : ''}
                      key={width}
                      type="button"
                      onClick={() => updateDrawingStyle(contextMenu.drawing, { width })}
                    >
                      <span style={{ height: `${width}px` }} />
                    </button>
                  ))}
                </div>
                <label className="drawing-property-row">
                  <span>Label</span>
                  <input
                    type="text"
                    value={contextMenu.drawing.style?.label || ''}
                    onChange={(event) => updateDrawingStyle(contextMenu.drawing, { label: event.target.value })}
                  />
                </label>
                <label className="drawing-property-row">
                  <span>Visible On</span>
                  <select
                    value={contextMenu.drawing.style?.visibleOn || 'currentAndLower'}
                    onChange={(event) => updateDrawingStyle(contextMenu.drawing, {
                      visibleOn: event.target.value,
                      sourcePeriod: contextMenu.drawing.style?.sourcePeriod || period
                    })}
                  >
                    {visibilityOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="drawing-toggle-row">
                  <input
                    checked={contextMenu.drawing.style?.displayAllWorkspaces !== false}
                    type="checkbox"
                    onChange={(event) => updateDrawingStyle(contextMenu.drawing, {
                      displayAllWorkspaces: event.target.checked
                    })}
                  />
                  <span>Display in all workspaces</span>
                </label>
                <button type="button" onClick={() => updateDrawingStyle(contextMenu.drawing, {
                  dash: contextMenu.drawing.style?.dash === 'dashed' ? 'solid' : 'dashed'
                })}>
                  {contextMenu.drawing.style?.dash === 'dashed' ? 'Solid line' : 'Dashed line'}
                </button>
                {['fibonacci', 'fibExtension'].includes(contextMenu.drawing.type) && (
                  <button type="button" onClick={() => updateDrawingStyle(contextMenu.drawing, {
                    fillMid: contextMenu.drawing.style?.fillMid === false
                  })}>
                    {contextMenu.drawing.style?.fillMid === false ? 'Show Fib fill' : 'Hide Fib fill'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setContextMenu(menu => ({ ...menu, mode: 'properties' }))}>
                  Properties
                </button>
                <button type="button" onClick={() => toggleDrawingLock(contextMenu.drawing)}>
                  {isDrawingLocked(contextMenu.drawing) ? 'Unlock annotation' : 'Lock annotation'}
                </button>
                <button type="button" onClick={() => toggleDrawingAlert(contextMenu.drawing)}>
                  {contextMenu.drawing.style?.alertEnabled ? 'Remove alert' : 'Create alert'}
                </button>
                <button type="button" onClick={() => cloneDrawing(contextMenu.drawing)}>
                  Clone annotation
                </button>
                <button type="button" onClick={() => {
                  deleteDrawing?.(contextMenu.drawing.id);
                  setContextMenu(null);
                }}>
                  Remove annotation
                </button>
              </>
            )}
          </div>
        </foreignObject>
      )}
      {textEditor && (
        <foreignObject
          className="drawing-text-editor-container"
          x={Math.min(textEditor.point.x + 8, Math.max(0, overlaySize.width - 190))}
          y={Math.max(0, textEditor.point.y - (textEditor.tool === 'callout' ? 46 : 32))}
          width="190"
          height="42"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <form
            ref={textEditorRef}
            className="drawing-text-editor"
            xmlns="http://www.w3.org/1999/xhtml"
            onSubmit={(event) => {
              event.preventDefault();
              commitTextEditor();
            }}
          >
            <input
              autoFocus
              value={textEditor.text}
              onBlur={commitTextEditor}
              onChange={(event) => setTextEditor(editor => ({ ...editor, text: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeTextEditor();
                }
              }}
            />
          </form>
        </foreignObject>
      )}
      {draftTrendPoints && (
        <line
          className="drawing-draft-line"
          x1={draftTrendPoints.start.x}
          y1={draftTrendPoints.start.y}
          x2={draftTrendPoints.end.x}
          y2={draftTrendPoints.end.y}
        />
      )}
      {draftExtendedPoints && (
        <line
          className="drawing-draft-line"
          x1={draftExtendedPoints.start.x}
          y1={draftExtendedPoints.start.y}
          x2={draftExtendedPoints.end.x}
          y2={draftExtendedPoints.end.y}
        />
      )}
      {draftChannel && [draftChannel.base, draftChannel.parallel, draftChannel.median].filter(Boolean).map((line, index) => (
        <line
          className="drawing-draft-line"
          key={index}
          x1={line.start.x}
          y1={line.start.y}
          x2={line.end.x}
          y2={line.end.y}
        />
      ))}
      {draftPitchfork && [draftPitchfork.sideA, draftPitchfork.median, draftPitchfork.sideB].filter(Boolean).map((line, index) => (
        <line
          className="drawing-draft-line"
          key={index}
          x1={line.start.x}
          y1={line.start.y}
          x2={line.end.x}
          y2={line.end.y}
        />
      ))}
      {draftBox && activeDrawingTool === 'rectangle' && (
        <rect
          className="drawing-draft-rect"
          {...draftBox}
        />
      )}
      {draftBox && activeDrawingTool === 'ellipse' && (
        <ellipse
          className="drawing-draft-rect"
          cx={draftBox.x + draftBox.width / 2}
          cy={draftBox.y + draftBox.height / 2}
          rx={draftBox.width / 2}
          ry={draftBox.height / 2}
        />
      )}
      {draftFib && fibonacciLevels.map(level => (
        <line
          className="drawing-draft-line"
          key={level}
          x1={draftFib.x1}
          y1={draftStartPoint.y + draftFib.height * level}
          x2={draftFib.x2}
          y2={draftStartPoint.y + draftFib.height * level}
        />
      ))}
      {draftFibExtension && fibonacciExtensionLevels.map(level => (
        <line
          className="drawing-draft-line"
          key={level}
          x1={draftFibExtension.x1}
          y1={draftFibExtension.originY + draftFibExtension.height * level}
          x2={draftFibExtension.x2}
          y2={draftFibExtension.originY + draftFibExtension.height * level}
        />
      ))}
      {draftFibTimeZones && draftFibTimeZones.map(zone => (
        <line
          className="drawing-draft-line"
          key={zone.level}
          x1={zone.x}
          y1={0}
          x2={zone.x}
          y2="100%"
        />
      ))}
      {draftPriceRange && (
        <>
          <line className="drawing-draft-line" x1={draftPriceRange.x} y1={draftPriceRange.y1} x2={draftPriceRange.x} y2={draftPriceRange.y2} />
          <line className="drawing-draft-line" x1={draftPriceRange.x - 10} y1={draftPriceRange.y1} x2={draftPriceRange.x + 10} y2={draftPriceRange.y1} />
          <line className="drawing-draft-line" x1={draftPriceRange.x - 10} y1={draftPriceRange.y2} x2={draftPriceRange.x + 10} y2={draftPriceRange.y2} />
        </>
      )}
      {draftDateRange && (
        <>
          <line className="drawing-draft-line" x1={draftDateRange.x1} y1={draftDateRange.y} x2={draftDateRange.x2} y2={draftDateRange.y} />
          <line className="drawing-draft-line" x1={draftDateRange.x1} y1={draftDateRange.y - 10} x2={draftDateRange.x1} y2={draftDateRange.y + 10} />
          <line className="drawing-draft-line" x1={draftDateRange.x2} y1={draftDateRange.y - 10} x2={draftDateRange.x2} y2={draftDateRange.y + 10} />
        </>
      )}
      {draftStartPoint && draftPoint && !draftTrendPoints && !draftExtendedPoints && !draftChannel && !draftPitchfork && !draftBox && !draftFib && !draftFibExtension && !draftFibTimeZones && !draftPriceRange && !draftDateRange && (
        <line
          className="drawing-draft-line"
          x1={draftStartPoint.x}
          y1={draftStartPoint.y}
          x2={draftPoint.x}
          y2={draftPoint.y}
        />
      )}
    </svg>
  );
};

export default DrawingOverlay;
