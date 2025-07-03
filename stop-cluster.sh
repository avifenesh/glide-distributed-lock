#!/bin/bash
# Stop script for Valkey cluster

set -e

echo "🛑 Stopping Valkey cluster..."

CLUSTER_DIR="/home/ubuntu/valkey-cluster"

# Stop all Valkey nodes
for i in {1..6}; do
    port=$((6999 + i))
    pidfile="$CLUSTER_DIR/node$i/valkey-$port.pid"
    
    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "   ✅ Stopped node $i (port $port, PID $pid)"
        else
            echo "   ⚠️  Node $i (port $port) was not running"
        fi
        rm -f "$pidfile"
    else
        echo "   ⚠️  No PID file found for node $i (port $port)"
    fi
done

echo "✅ Valkey cluster stopped"
