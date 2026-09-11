#!/bin/bash

# Start MongoDB
echo "Starting MongoDB..."
sudo systemctl start mongod
# Note: If mongod is not set up as a systemctl service, you might need to run `mongod` manually in a separate terminal.

# Start Backend
echo "Starting Backend..."
(cd backend && npm run dev) &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Cleanup function to kill processes when script is stopped
cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Services stopped."
    exit 0
}

# Trap Ctrl+C (SIGINT) and termination signals
trap cleanup SIGINT SIGTERM

echo "========================================="
echo "All services have been started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop the applications."
echo "========================================="

# Keep the script running
wait
