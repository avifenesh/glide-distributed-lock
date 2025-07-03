import { DistributedLock, createValkeyClusterClient } from "./distributed-lock";

/**
 * Example usage of the Distributed Lock implementation
 */
async function example() {
    console.log("🔒 Distributed Lock Example");
    
    // 1. Create a Valkey cluster client
    const client = await createValkeyClusterClient([
        { host: "localhost", port: 7000 },
        { host: "localhost", port: 7001 },
        { host: "localhost", port: 7002 },
        { host: "localhost", port: 7003 },
        { host: "localhost", port: 7004 },
        { host: "localhost", port: 7005 }
    ]);

    console.log("✅ Connected to Valkey cluster");

    // 2. Create a distributed lock instance
    const lock = new DistributedLock(client);
    console.log(`🆔 Client ID: ${lock.getClientId()}`);

    try {
        // Example 1: Safe set operation
        console.log("\n📝 Example 1: Safe set operation");
        const success = await lock.safeSet("user:123", JSON.stringify({
            name: "John Doe",
            email: "john@example.com"
        }), 3600); // 1 hour TTL

        console.log(`Set operation: ${success ? "✅ SUCCESS" : "❌ FAILED"}`);

        // Example 2: Manual lock/unlock
        console.log("\n🔐 Example 2: Manual lock/unlock");
        const lockAcquired = await lock.acquireLock("critical_section");
        if (lockAcquired) {
            console.log("✅ Lock acquired for critical_section");
            
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("⚙️  Performed critical work");
            
            const released = await lock.releaseLock("critical_section");
            console.log(`Lock released: ${released ? "✅ SUCCESS" : "❌ FAILED"}`);
        } else {
            console.log("❌ Could not acquire lock");
        }

        // Example 3: Using withLock helper
        console.log("\n🔄 Example 3: Using withLock helper");
        const result = await lock.withLock("database_migration", async () => {
            console.log("⚙️  Running database migration...");
            await new Promise(resolve => setTimeout(resolve, 500));
            return "Migration completed successfully";
        });

        console.log(`Migration result: ${result || "❌ Could not acquire lock"}`);

        // Example 4: Concurrent access simulation
        console.log("\n🏁 Example 4: Concurrent access simulation");
        const promises = [
            lock.safeSet("counter", "1"),
            lock.safeSet("counter", "2"),
            lock.safeSet("counter", "3")
        ];

        const results = await Promise.all(promises);
        const successCount = results.filter(Boolean).length;
        console.log(`Concurrent operations: ${successCount} succeeded out of ${results.length}`);

        // Check final value
        const finalValue = await client.get("counter");
        console.log(`Final counter value: ${finalValue}`);

    } finally {
        client.close();
        console.log("\n🔌 Client closed");
    }
}

// Run the example
if (require.main === module) {
    example().catch(console.error);
}

export { example };
