#!/bin/bash
# Utility script with useful Docker commands for managing the LLM Bot

# Build and start the containers in detached mode
start() {
  echo "Building and starting LLM Bot in detached mode..."
  docker-compose up -d --build
  echo "LLM Bot is now running in the background."
}

# Stop the containers
stop() {
  echo "Stopping LLM Bot..."
  docker-compose down
  echo "LLM Bot has been stopped."
}

# View logs
logs() {
  echo "Showing logs (Ctrl+C to exit)..."
  docker-compose logs -f
}

# Restart the containers
restart() {
  echo "Restarting LLM Bot..."
  docker-compose restart
  echo "LLM Bot has been restarted."
}

# Check the status of the containers
status() {
  echo "Checking status of LLM Bot..."
  docker-compose ps
}

# Show container resource usage
stats() {
  echo "Showing resource usage (Ctrl+C to exit)..."
  docker stats llm-bot
}

# Execute a command in the container
exec_cmd() {
  if [ -z "$1" ]; then
    echo "Starting interactive shell in the container..."
    docker-compose exec llm-bot /bin/sh
  else
    echo "Executing command: $1"
    docker-compose exec llm-bot $1
  fi
}

# Update the containers (pull changes and rebuild)
update() {
  echo "Updating LLM Bot..."
  
  # Check if there are uncommitted changes
  if [[ -n $(git status --porcelain) ]]; then
    echo "Warning: You have uncommitted changes. Commit or stash them before updating."
    exit 1
  fi
  
  # Pull the latest changes
  git pull
  
  # Check if .env file exists, create from example if it doesn't
  if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "Please edit .env file with your configuration."
    exit 1
  fi
  
  # Rebuild and restart containers
  docker-compose down
  docker-compose up -d --build
  
  echo "LLM Bot has been updated and restarted."
}

# Show help
show_help() {
  echo "LLM Bot Docker Management Script"
  echo ""
  echo "Usage: ./docker-commands.sh [command]"
  echo ""
  echo "Commands:"
  echo "  start    - Build and start the containers in detached mode"
  echo "  stop     - Stop the containers"
  echo "  logs     - View container logs"
  echo "  restart  - Restart the containers"
  echo "  status   - Check the status of the containers"
  echo "  stats    - Show container resource usage"
  echo "  exec     - Execute a command in the container or start a shell"
  echo "  update   - Update the containers (pull changes and rebuild)"
  echo "  help     - Show this help message"
}

# Main script logic
case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  logs)
    logs
    ;;
  restart)
    restart
    ;;
  status)
    status
    ;;
  stats)
    stats
    ;;
  exec)
    exec_cmd "$2"
    ;;
  update)
    update
    ;;
  help|*)
    show_help
    ;;
esac

exit 0