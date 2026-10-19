const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` up to `attempts` times with exponential backoff (500 ms, 1 s, 2 s…); rethrows the last error. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(baseMs * 2 ** i);
    }
  }
  throw lastError;
}
