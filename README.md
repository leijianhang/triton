# Market Analysis Platform

A chart-first technical analysis app for A-shares, US stocks, and Hong Kong stocks.

## Features

- Search and select A-share, US stock, and Hong Kong stock symbols
- External market data for symbol lists, search, and K-line data
- Multi-timeframe charting with lazy-loaded historical bars
- Drawing tools, indicators, candle patterns, chart patterns, auto Fibonacci, trend overlays, heatmap, and GoNoGo
- Watchlists, scanner tools, strategy views, alerts, and timing panels

## Data

The runtime market data flow uses external market endpoints through `backend/src/services/externalMarketService.js`.

## Run

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Backend defaults to `http://localhost:3001`. Frontend is served by Vite.

