#!/bin/bash

# Helper to ensure a Docker container is running
ensure_container() {
    local name=$1
    local run_cmd=$2

    if [ "$(sudo docker ps -q -f name=^/${name}$)" ]; then
        echo "$name is already running."
    elif [ "$(sudo docker ps -aq -f name=^/${name}$)" ]; then
        echo "Starting $name container..."
        sudo docker start "$name" > /dev/null
    else
        echo "Creating and starting $name container..."
        eval "$run_cmd" > /dev/null
    fi
}

# Start MongoDB
echo "Starting MongoDB..."
sudo systemctl start mongod 2>/dev/null || echo "MongoDB system service check passed/skipped."

# Start Redis (BullMQ queue & caching)
echo "Starting Redis..."
ensure_container "codearena-redis" "sudo docker run -d --name codearena-redis -p 6379:6379 redis"

# Start Piston (Code Execution sandbox)
echo "Starting Piston sandbox..."
ensure_container "codearena-piston" "sudo docker run -d --name codearena-piston --privileged -p 2000:2000 ohmygodvt95/piston"

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
echo "Redis: Running (Port 6379)"
echo "Piston: Running (Port 2000)"
echo "Press Ctrl+C to stop the applications."
echo "========================================="

# Keep the script running
wait

