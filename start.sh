#!/bin/bash

echo "========================================"
echo "  Market Analysis Platform - Start"
echo "========================================"
echo ""

echo "[1/3] Checking dependencies..."
cd backend || exit 1
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

cd ../frontend || exit 1
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

cd ..

echo ""
echo "[2/3] Starting backend..."
cd backend || exit 1
npm run dev &
BACKEND_PID=$!

cd ..
sleep 3

echo ""
echo "[3/3] Starting frontend..."
cd frontend || exit 1
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "========================================"
echo "  Services started"
echo "========================================"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: Vite dev server output"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
