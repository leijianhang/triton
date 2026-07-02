@echo off
echo ========================================
echo   Market Analysis Platform - Start
echo ========================================
echo.

echo [1/3] Checking dependencies...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

cd ..\frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

cd ..

echo.
echo [2/3] Starting backend...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   Services started
echo ========================================
echo   Backend:  http://localhost:3001
echo   Frontend: Vite dev server output
echo ========================================
echo.
pause
