import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDigest } from './use-digest';

// Mock useFavorites
vi.mock('./use-favorites', () => ({
  useFavorites: () => ({
    favoriteIds: new Set<string>(),
    loading: false,
  }),
}));

// Mock supabase with chainable query builder
const createMockQuery = (resolvedValue: { data: unknown[]; error: null }) => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    in: vi.fn().mockReturnThis(),
  };
  return mockQuery;
};

let mockQuery: ReturnType<typeof createMockQuery>;

vi.mock('./supabase', () => ({
  supabase: {
    from: () => mockQuery,
  },
}));

describe('useDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = createMockQuery({ data: [], error: null });
  });

  it('should not fetch data when period is null', async () => {
    const { result } = renderHook(() => useDigest(null));

    // Should return loading state with empty data
    expect(result.current.loading).toBe(true);
    expect(result.current.videos).toEqual([]);
    expect(result.current.videosBySource).toEqual([]);
    expect(result.current.totalCount).toBe(0);

    // Wait a bit to ensure no fetch was triggered
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should NOT have called supabase select when period is null
    expect(mockQuery.select).not.toHaveBeenCalled();
  });

  it('should fetch data when period is "day"', async () => {
    const { result } = renderHook(() => useDigest('day'));

    await waitFor(() => {
      expect(mockQuery.select).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should fetch data when period is "week"', async () => {
    const { result } = renderHook(() => useDigest('week'));

    await waitFor(() => {
      expect(mockQuery.select).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should use correct cutoff date for day period (1 day ago)', async () => {
    renderHook(() => useDigest('day'));

    await waitFor(() => {
      expect(mockQuery.gte).toHaveBeenCalled();
    });

    // Verify the cutoff date is approximately 1 day ago (yesterday at midnight)
    const call = mockQuery.gte.mock.calls[0];
    expect(call[0]).toBe('published_at');

    const cutoffDate = new Date(call[1]);
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(0, 0, 0, 0);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Should be within 1 second of yesterday midnight
    expect(Math.abs(cutoffDate.getTime() - oneDayAgo.getTime())).toBeLessThan(1000);
  });

  it('should use correct cutoff date for week period (7 days ago)', async () => {
    renderHook(() => useDigest('week'));

    await waitFor(() => {
      expect(mockQuery.gte).toHaveBeenCalled();
    });

    // Verify the cutoff date is approximately 7 days ago
    const call = mockQuery.gte.mock.calls[0];
    expect(call[0]).toBe('published_at');

    const cutoffDate = new Date(call[1]);
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Should be within 1 second of 7 days ago midnight
    expect(Math.abs(cutoffDate.getTime() - sevenDaysAgo.getTime())).toBeLessThan(1000);
  });
});

describe('Home page tab sync with digest data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = createMockQuery({ data: [], error: null });
  });

  it('should only fetch with correct period when period changes from null to day', async () => {
    // This simulates the home page behavior where:
    // 1. period starts as null (waiting for stats)
    // 2. stats determine there are daily videos
    // 3. period is set to 'day'
    // 4. only then should digest be fetched with 'day' cutoff

    let period: 'day' | 'week' | null = null;

    const { rerender } = renderHook(
      ({ p }) => useDigest(p),
      { initialProps: { p: period } }
    );

    // Wait a bit - no fetch should happen when period is null
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockQuery.select).not.toHaveBeenCalled();

    // Simulate stats loading complete and setting period to 'day'
    period = 'day';
    rerender({ p: period });

    await waitFor(() => {
      expect(mockQuery.select).toHaveBeenCalled();
    });

    // Verify the cutoff is for 'day' (1 day ago), not 'week' (7 days ago)
    const cutoffDate = new Date(mockQuery.gte.mock.calls[0][1]);
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(0, 0, 0, 0);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Should be within 1 second of yesterday midnight (day cutoff)
    expect(Math.abs(cutoffDate.getTime() - oneDayAgo.getTime())).toBeLessThan(1000);
  });

  it('should clear videos when period changes', async () => {
    // Mock week videos
    const weekVideos = [
      {
        id: 'video-1',
        title: 'Week Video',
        description: null,
        thumbnail_url: 'thumb.jpg',
        duration_seconds: 100,
        published_at: '2024-01-01',
        summary: null,
        view_count: 100,
        source_id: 'source-1',
        source: { id: 'source-1', name: 'Test Source', thumbnail_url: null },
      },
    ];

    mockQuery = createMockQuery({ data: weekVideos, error: null });

    let period: 'day' | 'week' | null = 'week';

    const { result, rerender } = renderHook(
      ({ p }) => useDigest(p),
      { initialProps: { p: period } }
    );

    // Wait for week data to load
    await waitFor(() => {
      expect(result.current.videos.length).toBe(1);
    });

    // Now switch to day - videos should be cleared immediately
    mockQuery = createMockQuery({ data: [], error: null });
    period = 'day';
    rerender({ p: period });

    // The useEffect that clears videos runs synchronously on period change
    // Videos should be cleared (loading state)
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // After fetch completes with empty day data
    await waitFor(() => {
      expect(result.current.videos.length).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });
});
