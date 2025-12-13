import { describe, it, expect } from 'vitest';
import { CleanupScheduler } from '../cleanup-scheduler';

describe('Import Test', () => {
  it('should import CleanupScheduler', () => {
    const scheduler = new CleanupScheduler();
    expect(scheduler).toBeDefined();
  });
});