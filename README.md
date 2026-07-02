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

## API

```http
GET /api/market/:type/list?limit=10
GET /api/market/:type/search?keyword=AAPL&limit=12
GET /api/market/:type/kline/:symbol?period=daily&limit=200&before=2025-01-01
```

Supported `type` values:

- `stock`
- `us`
- `hk`

`/api/stock/*` remains as an A-share alias and uses the same external market service.
