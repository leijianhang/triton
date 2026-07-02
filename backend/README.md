# Market Analysis Backend

Backend service for A-share, US stock, and Hong Kong stock chart data.

## Features

- External market symbol list and search for A-shares, US stocks, and Hong Kong stocks
- External market K-line data
- Pattern scanning endpoints
- In-memory request caching
- REST API

## Setup

```bash
npm install
npm run dev
```

The service runs at `http://localhost:3001` by default.

## API

### Market Data

```http
GET /api/market/:type/list?limit=10
GET /api/market/:type/search?keyword=AAPL&limit=12
GET /api/market/:type/kline/:symbol?period=daily&limit=200&before=2025-01-01
```

Supported `type` values:

- `stock`: A-shares
- `us`: US stocks
- `hk`: Hong Kong stocks

The legacy `/api/stock/*` routes are kept as A-share aliases and also use the external market service.

### Patterns

```http
POST /api/pattern/candle
POST /api/pattern/chart
POST /api/pattern/all
```

## Configuration

`config/backend-config.json` only contains the HTTP port. There are no database connections in the backend runtime.
