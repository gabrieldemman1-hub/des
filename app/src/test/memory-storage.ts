/** A Storage implementation for tests, optionally failing on reads or writes. */
export class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  private readonly fail: { read?: boolean; write?: boolean };

  constructor(initial: Record<string, string> = {}, fail: { read?: boolean; write?: boolean } = {}) {
    this.fail = fail;
    for (const [key, value] of Object.entries(initial)) this.items.set(key, value);
  }

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    if (this.fail.read) throw new DOMException('Storage is disabled', 'SecurityError');
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.fail.write) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.items.set(key, String(value));
  }

  /** Test helper: the parsed JSON stored under `key`. */
  json(key: string): unknown {
    const raw = this.items.get(key);
    return raw === undefined ? undefined : JSON.parse(raw);
  }
}
