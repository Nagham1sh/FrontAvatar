/**
 * Minimal promise wrapper around IndexedDB (no extra dependency).
 * Each store uses out-of-line keys: put(key, value).
 */
const connections = new Map<string, Promise<IDBDatabase>>();

function openDatabase(name: string, stores: readonly string[]): Promise<IDBDatabase> {
  const cached = connections.get(name);
  if (cached) return cached;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(name, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`Could not open ${name}`));
    request.onblocked = () => reject(new Error(`Opening ${name} was blocked by another tab.`));
  });

  opening.catch(() => connections.delete(name));
  connections.set(name, opening);
  return opening;
}

export class KeyValueStore<T> {
  private readonly dbName: string;
  private readonly storeName: string;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async run<R>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<R>,
  ): Promise<R> {
    const db = await openDatabase(this.dbName, [this.storeName]);

    return new Promise<R>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const request = action(tx.objectStore(this.storeName));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  async get(key: string): Promise<T | undefined> {
    return (await this.run('readonly', (s) => s.get(key))) as T | undefined;
  }

  async getAll(): Promise<T[]> {
    return (await this.run('readonly', (s) => s.getAll())) as T[];
  }

  async put(key: string, value: T): Promise<void> {
    await this.run('readwrite', (s) => s.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
