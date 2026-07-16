export class TimeoutError extends Error {}

/**
 * Races a promise against a timer. If the timer wins, the original promise keeps running in
 * the background (JS has no real cancellation for arbitrary promises) but is no longer awaited
 * — callers should treat the operation as failed and move on. A no-op catch is attached to the
 * original promise so a late rejection after the race has settled doesn't surface as an
 * unhandled rejection.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  promise.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
