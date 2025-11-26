/**
 * @ai-file utility
 * @ai-description Performance monitoring utility for lazy loading implementation
 * @ai-features DOM tracking, memory monitoring, dev-only metrics
 */

// Singleton for tracking lazy loading performance metrics
class LazyLoadMonitor {
  private static instance: LazyLoadMonitor;
  private visibleElementsCount: number = 0;
  private totalElements: number = 0;
  private lastReportTime: number = 0;
  private memoryReadings: number[] = [];
  private domNodeReadings: number[] = [];
  private isEnabled: boolean = false;

  private constructor() {
    // Only enable monitoring in development mode
    this.isEnabled = process.env.NODE_ENV === 'development';
    this.lastReportTime = performance.now();
  }

  public static getInstance(): LazyLoadMonitor {
    if (!LazyLoadMonitor.instance) {
      LazyLoadMonitor.instance = new LazyLoadMonitor();
    }
    return LazyLoadMonitor.instance;
  }

  // Set the total number of elements in the collection
  public setTotalElements(count: number): void {
    if (!this.isEnabled) return;
    
    this.totalElements = count;
    console.log(`🔍 Lazy loading initialized for ${count} total elements`);
  }

  // Track when an element becomes visible
  public trackElementVisible(): void {
    if (!this.isEnabled) return;
    
    this.visibleElementsCount++;
    
    // Report on progress periodically
    const now = performance.now();
    if (now - this.lastReportTime > 2000) {
      this.reportCurrentState();
      this.lastReportTime = now;
    }
  }

  // Report current performance metrics
  public reportCurrentState(): void {
    if (!this.isEnabled) return;
    
    // Calculate percentage loaded
    const percentLoaded = this.totalElements > 0 
      ? Math.round((this.visibleElementsCount / this.totalElements) * 100) 
      : 0;
    
    // Count DOM nodes (only on client side)
    const domNodes = typeof window !== 'undefined' ? document.querySelectorAll('*').length : 0;
    this.domNodeReadings.push(domNodes);
    
    console.log(`🔍 Lazy loading progress: ${this.visibleElementsCount}/${this.totalElements} (${percentLoaded}%) elements visible`);
    console.log(`🔍 Current DOM node count: ${domNodes}`);
    
    // Report memory usage if available
    if (window.performance && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      const heapSizeMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
      this.memoryReadings.push(heapSizeMB);
      
      console.log(`🔍 Current memory usage: ${heapSizeMB} MB`);
    }
  }

  // Generate a summary report of performance
  public generateSummaryReport(): void {
    if (!this.isEnabled || this.domNodeReadings.length === 0) return;
    
    const avgDomNodes = Math.round(
      this.domNodeReadings.reduce((sum, val) => sum + val, 0) / this.domNodeReadings.length
    );
    
    const minDomNodes = Math.min(...this.domNodeReadings);
    const maxDomNodes = Math.max(...this.domNodeReadings);
    
    console.log('📊 LAZY LOADING PERFORMANCE SUMMARY 📊');
    console.log(`DOM Nodes: avg=${avgDomNodes}, min=${minDomNodes}, max=${maxDomNodes}`);
    
    if (this.memoryReadings.length > 0) {
      const avgMemory = Math.round(
        this.memoryReadings.reduce((sum, val) => sum + val, 0) / this.memoryReadings.length
      );
      
      const minMemory = Math.min(...this.memoryReadings);
      const maxMemory = Math.max(...this.memoryReadings);
      
      console.log(`Memory Usage (MB): avg=${avgMemory}, min=${minMemory}, max=${maxMemory}`);
    }
    
    console.log(`Elements loaded: ${this.visibleElementsCount}/${this.totalElements}`);
  }

  // Reset monitoring state (e.g., when applying filters)
  public reset(): void {
    if (!this.isEnabled) return;
    
    // Generate final report before resetting
    this.generateSummaryReport();
    
    // Reset counters
    this.visibleElementsCount = 0;
    this.memoryReadings = [];
    this.domNodeReadings = [];
    this.lastReportTime = performance.now();
  }
}

export default LazyLoadMonitor.getInstance();
