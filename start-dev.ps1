Write-Host "🚀 Starting Construction Expense Tracker..." -ForegroundColor Green

# Kill any existing React processes
Write-Host "Stopping any existing development servers..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -eq 'node'} | Stop-Process -Force

# Wait a moment for processes to fully stop
Start-Sleep 2

# Check if port 3000 is free
$portCheck = netstat -ano | findstr :3000
if ($portCheck) {
    Write-Host "Port 3000 is still in use. Attempting to free it..." -ForegroundColor Yellow
    Start-Sleep 3
}

Write-Host "Starting development server on port 3000..." -ForegroundColor Green
npm start 