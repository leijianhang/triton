# Trading Terminal Redesign

## Goal

Redesign the current A-share, US stock, and Hong Kong stock analysis app into a professional chart-first trading terminal inspired by common TrendSpider-style workflows, without copying TrendSpider branding, proprietary text, icons, or pixel-level UI.

The selected direction is "Chart-First + bottom scanner/timing panel".

## Layout

- Top bar: product identity, current symbol, timeframe, indicator shortcuts, alert/scanner entry points.
- Left rail: compact drawing and analysis tool icons.
- Main workspace: primary candlestick chart receives the most screen area.
- Right rail: watchlist and alert status panels.
- Bottom dock: scanner, timing signals, and strategy results.

## Key Panels

- Scanner: ranks symbols by conditions such as trendline breakout, volume expansion, and moving-average alignment.
- Timing Signals: shows multi-timeframe status such as daily trend, intraday momentum, pullback confirmation, and an overall score.
- Strategy Results: summarizes strategy pass/fail status, risk/reward, and warning conditions.
- Watchlist: keeps tracked A-share, US stock, and Hong Kong stock symbols visible without shrinking the chart too much.
- Alerts: displays triggered, waiting, and inactive alert states.

## Visual Direction

- Dark professional terminal with restrained green/blue/orange accents.
- Dense but readable controls, suitable for repeated market analysis.
- No landing page, hero section, decorative illustration, or marketing layout.
- Original product naming and labels, no TrendSpider brand assets.

## Implementation Scope

- Refactor the main React shell in `frontend/src/App.jsx`.
- Add or update layout-focused components for top bar, left rail, right rail, and bottom dock.
- Keep the existing chart, search, indicators, store, and backend APIs working.
- Use local scanner/timing/strategy rows for this pass, wired as UI state rather than backend data.
- Preserve responsive usability by stacking side/bottom panels on smaller screens.

## Verification

- `npm run build` in `frontend`.
- Browser check at `http://localhost:3000`: app renders, search/select still loads a chart, and bottom scanner/timing panels are visible.
