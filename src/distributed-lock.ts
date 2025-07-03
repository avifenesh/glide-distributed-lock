import {
    GlideClusterClient,
    Script,
    TimeUnit,
} from "@valkey/valkey-glide";
import { randomBytes } from "crypto";

/**
 * Distributed Lock Implementation for Valkey Cluster
 * 
 * This module provides a thread-safe distributed lock mechanism using Valkey cluster.
 * Features:
 * - Atomic lock acquisition and release
 * - Automatic lock expiration to prevent deadlocks
 * - Cluster-aware routing for optimal performance
 * - Safe operations with proper error handling
 */

// Default lock TTL in seconds - prevents deadlocks if client crashes
const DEFAULT_LOCK_TTL_SECONDS = 10;

// Lua script for atomic lock release - ensures only lock owner can release
const releaseLockScript = new Script(
    `if server.call("get", ARGV[1]) == ARGV[2] then return redis.call("del", ARGV[1]) else return 0 end`
);

/**
 * Generates a unique client identifier for this instance
 */
const generateClientId = (): string => randomBytes(16).toString("hex");

/**
 * Distributed Lock class for Valkey Cluster
 */
export class DistributedLock {
    private client: GlideClusterClient;
    private clientId: string;
    private lockTtlSeconds: number;

    constructor(client: GlideClusterClient, lockTtlSeconds: number = DEFAULT_LOCK_TTL_SECONDS) {
        this.client = client;
        this.clientId = generateClientId();
        this.lockTtlSeconds = lockTtlSeconds;
    }

    /**
     * Get the unique client ID for this lock instance
     */
    getClientId(): string {
        return this.clientId;
    }

    /**
     * Safely set a key-value pair with distributed lock protection
     * @param key - The key to set
     * @param value - The value to set
     * @param ttl - Time to live in seconds, or "*" for no expiry
     * @returns Promise<boolean> - true if operation succeeded, false if lock couldn't be acquired
     */
    async safeSet(key: string, value: string, ttl: number | "*" = "*"): Promise<boolean> {
        const lockKey = `lock:${key}`;

        // 1. Attempt to acquire the lock - automatically routes to primary
        const lockAcquired = await this.client.set(
            lockKey,
            this.clientId,
            {
                expiry: { type: TimeUnit.Seconds, count: this.lockTtlSeconds },
                conditionalSet: "onlyIfDoesNotExist",
            }
        );

        if (!lockAcquired) {
            return false; // Could not acquire lock
        }

        let success = false;
        try {
            // 2. Perform the main operation
            if (ttl === "*") {
                await this.client.set(key, value);
            } else {
                await this.client.set(key, value, {
                    expiry: { type: TimeUnit.Seconds, count: ttl },
                });
            }
            success = true;
        } finally {
            // 3. Atomically release the lock
            await this.client.invokeScriptWithRoute(releaseLockScript, {
                args: [lockKey, this.clientId],
                route: {
                    type: "primarySlotKey",
                    key: lockKey,
                }
            });
        }

        return success;
    }

    /**
     * Acquire a lock for a given key
     * @param key - The key to lock
     * @returns Promise<boolean> - true if lock was acquired, false otherwise
     */
    async acquireLock(key: string): Promise<boolean> {
        const lockKey = `lock:${key}`;
        
        const lockAcquired = await this.client.set(
            lockKey,
            this.clientId,
            {
                expiry: { type: TimeUnit.Seconds, count: this.lockTtlSeconds },
                conditionalSet: "onlyIfDoesNotExist",
            }
        );

        return !!lockAcquired;
    }

    /**
     * Release a lock for a given key (only if owned by this client)
     * @param key - The key to unlock
     * @returns Promise<boolean> - true if lock was released, false if not owned by this client
     */
    async releaseLock(key: string): Promise<boolean> {
        const lockKey = `lock:${key}`;
        
        const result = await this.client.invokeScriptWithRoute(releaseLockScript, {
            args: [lockKey, this.clientId],
            route: {
                type: "primarySlotKey",
                key: lockKey,
            }
        });

        return result === 1;
    }

    /**
     * Execute a function with exclusive lock protection
     * @param key - The key to lock
     * @param fn - The function to execute while holding the lock
     * @returns Promise<T | null> - The result of the function, or null if lock couldn't be acquired
     */
    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
        const lockAcquired = await this.acquireLock(key);
        if (!lockAcquired) {
            return null;
        }

        try {
            return await fn();
        } finally {
            await this.releaseLock(key);
        }
    }
}

/**
 * Helper function to create a Valkey cluster client with common configuration
 */
export async function createValkeyClusterClient(addresses: Array<{host: string, port: number}>): Promise<GlideClusterClient> {
    return await GlideClusterClient.createClient({
        addresses,
        readFrom: 'preferReplica',
    });
}

export { DEFAULT_LOCK_TTL_SECONDS };
