#!/bin/bash
# Setup script for Valkey cluster (6 nodes: 3 masters + 3 replicas)

set -e

echo "🚀 Setting up Valkey cluster..."

# Check if valkey-server is installed
if ! command -v valkey-server &> /dev/null; then
    echo "❌ valkey-server not found. Please install Valkey first."
    echo "Installation instructions: https://valkey.io/download/"
    exit 1
fi

echo "✅ Valkey found: $(which valkey-server)"

# Create cluster directory structure
CLUSTER_DIR="/home/ubuntu/valkey-cluster"
echo "📁 Creating cluster directory: $CLUSTER_DIR"

mkdir -p "$CLUSTER_DIR"/{node1,node2,node3,node4,node5,node6}

# Create configuration files for each node
for i in {1..6}; do
    port=$((6999 + i))
    cat > "$CLUSTER_DIR/node$i/valkey.conf" << EOF
port $port
cluster-enabled yes
cluster-config-file nodes-$port.conf
cluster-node-timeout 5000
appendonly yes
appendfilename "appendonly-$port.aof"
cluster-announce-ip 127.0.0.1
cluster-announce-port $port
bind 127.0.0.1
daemonize yes
logfile $CLUSTER_DIR/node$i/valkey-$port.log
dir $CLUSTER_DIR/node$i/
pidfile $CLUSTER_DIR/node$i/valkey-$port.pid
EOF
done

echo "📝 Configuration files created for ports 7000-7005"

# Start all Valkey nodes
echo "🔥 Starting Valkey nodes..."
for i in {1..6}; do
    port=$((6999 + i))
    valkey-server "$CLUSTER_DIR/node$i/valkey.conf"
    echo "   ✅ Node $i started on port $port"
done

# Wait a moment for nodes to start
sleep 2

# Create the cluster
echo "🔗 Creating cluster..."
valkey-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 --cluster-replicas 1 --cluster-yes

# Verify cluster status
echo "🔍 Verifying cluster status..."
valkey-cli -c -p 7000 cluster nodes

echo ""
echo "✅ Valkey cluster setup complete!"
echo "   🔹 6 nodes running on ports 7000-7005"
echo "   🔹 3 masters + 3 replicas"
echo "   🔹 Ready for distributed lock testing"
echo ""
echo "📋 Useful commands:"
echo "   Check cluster status: valkey-cli -c -p 7000 cluster info"
echo "   Connect to cluster:   valkey-cli -c -p 7000"
echo "   Stop cluster:         ./stop-cluster.sh"
