# Distributed Lock for Valkey Cluster

A robust, production-ready distributed lock implementation for Valkey cluster using TypeScript. This library provides thread-safe distributed locking with automatic deadlock prevention and cluster-aware routing.

## Features

- 🔒 **Atomic Operations**: Lock acquisition and release are atomic using Lua scripts
- ⏰ **Automatic Expiration**: Locks automatically expire to prevent deadlocks
- 🎯 **Cluster-Aware**: Optimized routing for Valkey cluster deployments
- 🛡️ **Ownership Verification**: Only lock owners can release their locks
- 🚀 **High Performance**: Minimal overhead with efficient Lua script execution
- 📝 **TypeScript Support**: Full type safety and IDE support

## Installation

```bash
npm install @valkey/valkey-glide
```

## Quick Start

```typescript
import { DistributedLock, createValkeyClusterClient } from "./distributed-lock";

async function main() {
    // Connect to Valkey cluster
    const client = await createValkeyClusterClient([
        { host: "localhost", port: 7000 },
        { host: "localhost", port: 7001 },
        { host: "localhost", port: 7002 }
    ]);

    // Create lock instance
    const lock = new DistributedLock(client);

    // Safe set operation with lock protection
    const success = await lock.safeSet("user:123", "John Doe", 3600);
    console.log(`Operation ${success ? "succeeded" : "failed"}`);

    await client.close();
}
```

## API Reference

### `DistributedLock`

#### Constructor

```typescript
new DistributedLock(client: GlideClusterClient, lockTtlSeconds?: number)
```

- `client`: Valkey cluster client instance
- `lockTtlSeconds`: Lock expiration time in seconds (default: 10)

#### Methods

##### `safeSet(key: string, value: string, ttl?: number | "*"): Promise<boolean>`

Safely set a key-value pair with distributed lock protection.

```typescript
const success = await lock.safeSet("user:123", "data", 3600);
```

##### `acquireLock(key: string): Promise<boolean>`

Manually acquire a lock for a given key.

```typescript
const acquired = await lock.acquireLock("critical_section");
if (acquired) {
    // Do critical work
    await lock.releaseLock("critical_section");
}
```

##### `releaseLock(key: string): Promise<boolean>`

Release a lock (only if owned by this client).

```typescript
const released = await lock.releaseLock("critical_section");
```

##### `withLock<T>(key: string, fn: () => Promise<T>): Promise<T | null>`

Execute a function with exclusive lock protection.

```typescript
const result = await lock.withLock("database_migration", async () => {
    // Critical work here
    return "completed";
});
```

##### `getClientId(): string`

Get the unique client identifier for this lock instance.

```typescript
const clientId = lock.getClientId();
```

## Usage Examples

### Example 1: Basic Lock Usage

```typescript
import { DistributedLock, createValkeyClusterClient } from "./distributed-lock";

const client = await createValkeyClusterClient([
    { host: "localhost", port: 7000 }
]);

const lock = new DistributedLock(client);

// Acquire lock, do work, release lock
const acquired = await lock.acquireLock("resource_1");
if (acquired) {
    console.log("Lock acquired, doing critical work...");
    // Perform critical operations
    await lock.releaseLock("resource_1");
}
```

### Example 2: Safe Operations

```typescript
// This automatically handles lock acquisition and release
const success = await lock.safeSet("config:app", JSON.stringify({
    setting1: "value1",
    setting2: "value2"
}), 7200); // 2 hours TTL

if (success) {
    console.log("Configuration updated successfully");
}
```

### Example 3: Function Execution with Lock

```typescript
const result = await lock.withLock("user_counter", async () => {
    // Get current count
    const current = await client.get("counter") || "0";
    const newValue = (parseInt(current) + 1).toString();
    
    // Set new count
    await client.set("counter", newValue);
    return newValue;
});

if (result) {
    console.log(`New counter value: ${result}`);
} else {
    console.log("Could not acquire lock");
}
```

### Example 4: Concurrent Access Protection

```typescript
// Multiple operations attempting to update the same resource
const operations = [
    lock.safeSet("shared_resource", "operation_1"),
    lock.safeSet("shared_resource", "operation_2"),
    lock.safeSet("shared_resource", "operation_3")
];

const results = await Promise.all(operations);
const successCount = results.filter(Boolean).length;
console.log(`${successCount} operations succeeded`);
```

## Architecture

### Lock Keys

Locks use the pattern `lock:{key}` to avoid conflicts with your application data.

### Atomic Release

Lock release uses a Lua script to ensure atomicity:

```lua
if redis.call("get", ARGV[1]) == ARGV[2] then 
    return redis.call("del", ARGV[1]) 
else 
    return 0 
end
```

This ensures only the lock owner can release the lock.

### Cluster Routing

Operations are automatically routed to the appropriate cluster nodes:
- Lock operations target the primary node for the lock key
- Read operations can use replica preference for better performance

## Best Practices

1. **Keep Lock Duration Short**: Use the shortest possible lock duration for your use case
2. **Handle Lock Acquisition Failures**: Always check if lock acquisition succeeded
3. **Use `withLock` for Simple Cases**: It automatically handles cleanup
4. **Monitor Lock Contention**: High contention may indicate design issues
5. **Set Appropriate TTL**: Balance between deadlock prevention and operation time

## Error Handling

```typescript
try {
    const success = await lock.safeSet("key", "value");
    if (!success) {
        console.log("Could not acquire lock - another operation in progress");
        // Handle lock contention
    }
} catch (error) {
    console.error("Lock operation failed:", error);
    // Handle connection or other errors
}
```

## Testing

Run the example to test the implementation:

```bash
npm run build && node dist/example.js
```

## Requirements

- Valkey cluster (6+ nodes recommended for production)
- Node.js 16+
- TypeScript 4.5+

## License

Apache 2.0 License - see LICENSE file for details.
