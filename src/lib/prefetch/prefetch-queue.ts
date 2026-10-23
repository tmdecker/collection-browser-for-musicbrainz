/**
 * @ai-file prefetch
 * @ai-description Priority queue for prefetch operations
 * @ai-dependencies none (standalone)
 * @ai-features
 * - High/low priority queues (high = user clicks, low = background prefetch)
 * - Deduplication (won't add already queued/processing items)
 * - Processing loop that runs until the queue is empty
 * - Callers decide what needs fetching (via the cache), so expired items can be queued again
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
  private completedCount = 0; // For progress display only, not for deduplication
  private isRunning = false;
  private currentItem: string | null = null;

  /**
   * Add item to queue with specified priority
   * @returns true if added, false if already queued or processing
   */
  add(mbid: string, priority: Priority = 'low'): boolean {
    // Skip if already queued or processing
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
      this.processing.has(mbid)
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
   * Processes items one at a time and stops when the queue is empty (instead of polling forever);
   * the next add() is followed by another start() call
   */
  async start(fetchFn: FetchFunction): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    while (this.isRunning) {
      const mbid = this.getNext();

      if (!mbid) {
        break;
      }

      this.processing.add(mbid);
      this.currentItem = mbid;

      try {
        await fetchFn(mbid);
        this.completedCount++;
      } catch (error) {
        console.error(`Failed to prefetch ${mbid}:`, error);
        // Not cached, so the next prefetch for this collection queues it again
      } finally {
        this.processing.delete(mbid);
        this.currentItem = null;
      }
    }

    this.isRunning = false;
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
      completed: this.completedCount,
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
   * Clear pending items from queues
   */
  clear(): void {
    this.highQueue = [];
    this.lowQueue = [];
  }
}

// Singleton instance - persisted across Next.js module re-evaluations
const globalForPrefetch = globalThis as unknown as { prefetchQueue: PrefetchQueue };
export const prefetchQueue = globalForPrefetch.prefetchQueue ?? (globalForPrefetch.prefetchQueue = new PrefetchQueue());
