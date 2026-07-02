# Architecture

## Backend

- `backend/src/index.js`: Express app entry
- `backend/src/routes/market.js`: A-share, US stock, and Hong Kong stock market routes
- `backend/src/controllers/marketController.js`: market route handlers
- `backend/src/services/externalMarketService.js`: external market list, search, and K-line retrieval
- `backend/src/routes/stock.js`: A-share alias routes backed by the same external market service
- `backend/src/routes/pattern.js`: pattern scanning routes

The backend does not include database connections.

## Frontend

- `frontend/src/services/api.js`: market and pattern API clients
- `frontend/src/data/liveMarketData.js`: market item normalization and fallback handling
- `frontend/src/data/marketCatalog.js`: static fallback symbols only
- `frontend/src/store/chartStore.js`: current symbol, chart state, watchlists, drawings, indicators, and pattern state
- `frontend/src/App.jsx`: workspace orchestration and chart data loading
- `frontend/src/components/KlineChart.jsx`: chart rendering

Supported asset types are `stock`, `us`, and `hk`.
