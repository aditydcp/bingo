#!/bin/bash
echo "Starting IDSurvey FIRST Summit Bingo..."

# Start backend
cd "$(dirname "$0")/backend"
npm install --silent
node server.js &
BACKEND_PID=$!
echo "Backend started (PID $BACKEND_PID) on http://localhost:3001"

# Start frontend
cd "$(dirname "$0")/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID) on http://localhost:3000"

echo ""
echo "🎯 Bingo app running!"
echo "   User Bingo:   http://localhost:3000"
echo "   Master Panel: http://localhost:3000/master"
echo "   Admin View:   http://localhost:3000/admin"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
