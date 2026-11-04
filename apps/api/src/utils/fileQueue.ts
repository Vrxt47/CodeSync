/**
 * In-memory per-file operation queue.
 *
 * Provides supplementary request ordering protection on a single API instance:
 * ensures operations targeting the same fileId (such as in-flight saves, reads,
 * and compensating restores) execute sequentially in FIFO order without racing
 * in the Node.js event loop.
 *
 * ARCHITECTURAL NOTE:
 * This queue is an in-process optimization and supplementary ordering guard.
 * Database conditional updates (optimistic concurrency via `version` in PostgreSQL)
 * remain the authoritative, cluster-safe concurrency guarantee across multiple
 * backend processes or instances.
 */
class FileOperationQueue {
  private queues = new Map<string, Promise<unknown>>();

  /**
   * Enqueues an asynchronous task for a specific fileId.
   * Tasks for different fileIds execute concurrently.
   * Tasks for the same fileId execute strictly sequentially.
   */
  public enqueue<T>(fileId: string, task: () => Promise<T>): Promise<T> {
    const prevPromise = this.queues.get(fileId) || Promise.resolve();

    // Execute task sequentially after previous queue item settles
    const nextPromise = prevPromise.then(async () => {
      return task();
    });

    // Maintain a safe, error-swallowing tail in the queue map to prevent unhandled rejections
    const queueTail = nextPromise
      .catch(() => {})
      .finally(() => {
        if (this.queues.get(fileId) === queueTail) {
          this.queues.delete(fileId);
        }
      });

    this.queues.set(fileId, queueTail);

    return nextPromise;
  }
}

export const fileQueue = new FileOperationQueue();
