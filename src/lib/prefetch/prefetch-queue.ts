/**
 * @ai-file prefetch
 * @ai-description Priority queue for prefetch operations
 * @ai-dependencies none (standalone)
 * @ai-features
 * - High/low priority queues (high = user clicks, low = background prefetch)
 * - Deduplication (won't add already queued/processing/completed items)
 * - Processing loop that runs until stopped
 * - Statistics for monitoring
 */

export type Priority = 'high' | 'low';

export interface QueueStats {
  highPriority: number;
  lowPriority: number;
  processing: number;
  completed: number;
  currentItem: string | null;
}

type FetchFunction = (mbid: string) => Promise<void>;

/**
 * Priority queue for prefetch operations
 * Manages ordering and deduplication of release group fetches
 */
class PrefetchQueue {
  private highQueue: string[] = [];
  private lowQueue: string[] = [];
  private processing: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private isRunning = false;
  private currentItem: string | null = null;

  /**
   * Add item to queue with specified priority
   * @returns true if added, false if already queued/processing/completed
   */
  add(mbid: string, priority: Priority = 'low'): boolean {
    // Skip if already queued, processing, or completed
    if (this.has(mbid)) {
      return false;
    }

    if (priority === 'high') {
      this.highQueue.push(mbid);
    } else {
      this.lowQueue.push(mbid);
    }

    return true;
  }

  /**
   * Check if item exists anywhere in queue system
   */
  has(mbid: string): boolean {
    return (
      this.highQueue.includes(mbid) ||
      this.lowQueue.includes(mbid) ||
      this.processing.has(mbid) ||
      this.completed.has(mbid)
    );
  }

  /**
   * Get next item to process (high priority first)
   */
  private getNext(): string | null {
    if (this.highQueue.length > 0) {
      return this.highQueue.shift()!;
    }
    if (this.lowQueue.length > 0) {
      return this.lowQueue.shift()!;
    }
    return null;
  }

  /**
   * Start processing queue with provided fetch function
   * Runs until stopped, processing items one at a time
   */
  async start(fetchFn: FetchFunction): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    while (this.isRunning) {
      const mbid = this.getNext();

      if (!mbid) {
        // Empty queue - wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      this.processing.add(mbid);
      this.currentItem = mbid;

      try {
        await fetchFn(mbid);
        this.completed.add(mbid);
      } catch (error) {
        console.error(`Failed to prefetch ${mbid}:`, error);
        // Don't add to completed - can be retried if added again
      } finally {
        this.processing.delete(mbid);
        this.currentItem = null;
      }
    }
  }

  /**
   * Stop processing queue
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return {
      highPriority: this.highQueue.length,
      lowPriority: this.lowQueue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      currentItem: this.currentItem,
    };
  }

  /**
   * Check if item is currently being processed
   */
  isProcessing(mbid: string): boolean {
    return this.processing.has(mbid);
  }

  /**
   * Clear pending items from queues (does not clear completed set)
   */
  clear(): void {
    this.highQueue = [];
    this.lowQueue = [];
    // Don't clear completed - that's the "already cached" memory
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForPrefetch = globalThis as unknown as { prefetchQueue: PrefetchQueue };
export const prefetchQueue = globalForPrefetch.prefetchQueue ?? (globalForPrefetch.prefetchQueue = new PrefetchQueue());
