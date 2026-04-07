interface RuntimeCacheEntry<T> {
  createdAt: number;
  value: T;
}

const runtimeCache = new Map<string, RuntimeCacheEntry<unknown>>();

export function getRuntimeCacheValue<T>(key: string, ttlMs: number) {
  const cached = runtimeCache.get(key) as RuntimeCacheEntry<T> | undefined;

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.createdAt > ttlMs) {
    runtimeCache.delete(key);
    return null;
  }

  return cached.value;
}

export function setRuntimeCacheValue<T>(key: string, value: T) {
  runtimeCache.set(key, {
    createdAt: Date.now(),
    value,
  } satisfies RuntimeCacheEntry<T>);

  return value;
}

export function deleteRuntimeCacheValue(key: string) {
  runtimeCache.delete(key);
}
