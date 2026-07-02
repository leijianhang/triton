# Project Summary

This project is a chart-first market analysis platform for A-shares, US stocks, and Hong Kong stocks.

## Current Data Flow

- Symbol lists: external market service
- Symbol search: external market service
- K-line data: external market service
- Patterns and indicators: calculated from the loaded chart data

Runtime market data is read through the external market service.

## Main Endpoints

```http
GET /api/market/:type/list
GET /api/market/:type/search
GET /api/market/:type/kline/:symbol
POST /api/pattern/candle
POST /api/pattern/chart
POST /api/pattern/all
```

Supported market types: `stock`, `us`, `hk`.
