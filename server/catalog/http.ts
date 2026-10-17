export class CatalogError extends Error {
  readonly retry_after: number | undefined;

  constructor(message: string, readonly status: number, options: ErrorOptions & { retry_after?: number } = {}) {
    super(message, options);
    this.name = 'CatalogError';
    this.retry_after = options.retry_after;
  }
}

export type RequestPriority = 'interactive' | 'background';
export type Options = {
  fetch?: typeof fetch;
  user_agent?: string;
  request_interval_ms?: number;
  signal?: AbortSignal;
};

type Cooldown = { until: number; error: CatalogError };
type QueuedRequest = {
  url: URL;
  priority: RequestPriority;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};
const ATTEMPTS = 3;
const TIMEOUT_MS = 15_000;
const BUDGET_MS = 45_000;
const BACKOFF_MS = 5000;

function retry_delay(header: string | null, minimum: number): number {
  if (!header?.trim()) return minimum;
  const seconds = Number(header);
  const until = Number.isFinite(seconds) && seconds >= 0 ? Date.now() + seconds * 1000 : Date.parse(header);
  return Number.isFinite(until) ? Math.max(minimum, until - Date.now()) : minimum;
}

export class Http {
  private readonly queue: QueuedRequest[] = [];
  private active = false;
  private next_request = 0;
  private cooldown: Cooldown | undefined;
  private readonly fetcher: typeof fetch;
  private readonly interval: number;
  private readonly user_agent: string;
  private readonly signal: AbortSignal | undefined;

  constructor(options: Options) {
    this.fetcher = options.fetch ?? fetch;
    this.signal = options.signal;
    this.interval = options.request_interval_ms ?? 1000;
    this.user_agent = options.user_agent ?? 'Watchit/0.1 (self-hosted Cinemeta catalog)';
  }

  get<T>(endpoint: string, priority: RequestPriority = 'background'): Promise<T> {
    const url = new URL(endpoint);
    const request = new Promise<T>((resolve, reject) => {
      this.queue.push({
        url,
        priority,
        resolve: value => resolve(value as T),
        reject,
      });
      this.pump();
    });
    return request;
  }

  private pump() {
    if (this.active || !this.queue.length) return;
    const index = this.queue.findIndex(request => request.priority === 'interactive');
    const request = this.queue.splice(index < 0 ? 0 : index, 1)[0]!;
    this.active = true;
    void this.request<unknown>(request.url, Date.now() + BUDGET_MS)
      .then(request.resolve, request.reject)
      .finally(() => {
        this.active = false;
        this.pump();
      });
  }

  private unavailable(): CatalogError {
    if (!this.cooldown) return new CatalogError('Cinemeta request timed out while queued.', 503);
    return new CatalogError(this.cooldown.error.message, 503, {
      cause: this.cooldown.error,
      retry_after: Math.max(0, Math.ceil((this.cooldown.until - Date.now()) / 1000)),
    });
  }

  private async request<T>(url: URL, deadline: number): Promise<T> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      this.signal?.throwIfAborted();
      const wait = Math.max(0, this.next_request - Date.now(), (this.cooldown?.until ?? 0) - Date.now());
      if (Date.now() + wait >= deadline) throw this.unavailable();
      if (wait > 0) await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(this.signal?.reason); };
        const timer = setTimeout(() => { this.signal?.removeEventListener('abort', abort); resolve(); }, wait);
        this.signal?.addEventListener('abort', abort, { once: true });
      });
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw this.unavailable();
      this.cooldown = undefined;

      try {
        const response = await this.fetcher(url, {
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': this.user_agent },
          signal: AbortSignal.any([AbortSignal.timeout(Math.min(TIMEOUT_MS, remaining)), ...(this.signal ? [this.signal] : [])]),
        });
        if (response.ok) return await response.json() as T;
        await response.body?.cancel().catch(() => {});
        const error = new CatalogError(`Cinemeta request failed (HTTP ${response.status}).`, response.status);
        if (![429, 502, 503, 504].includes(response.status)) throw error;
        this.cooldown = {
          until: Date.now() + retry_delay(response.headers.get('retry-after'), BACKOFF_MS * 2 ** attempt),
          error,
        };
      } catch (error) {
        this.signal?.throwIfAborted();
        if (error instanceof CatalogError) throw error;
        const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
        this.cooldown = {
          until: Date.now() + BACKOFF_MS * 2 ** attempt,
          error: new CatalogError(`Cinemeta request failed: ${cause instanceof Error ? cause.message : 'connection unavailable'}.`, 503, { cause: error }),
        };
      } finally {
        this.next_request = Date.now() + this.interval;
      }
    }
    throw this.unavailable();
  }
}
