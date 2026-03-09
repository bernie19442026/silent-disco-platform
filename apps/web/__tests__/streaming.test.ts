import { buildDefaultEndpoints, ReconnectScheduler } from '../lib/streaming';

describe('buildDefaultEndpoints', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, NEXT_PUBLIC_STREAMING_BASE_URL: 'http://localhost:8000' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns at least 2 endpoints per channel', () => {
    const endpoints = buildDefaultEndpoints('channel1');
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
  });

  test('includes ogg endpoint', () => {
    const endpoints = buildDefaultEndpoints('channel1');
    const ogg = endpoints.find((e) => e.format === 'ogg');
    expect(ogg).toBeDefined();
  });

  test('includes hls endpoint', () => {
    const endpoints = buildDefaultEndpoints('channel1');
    const hls = endpoints.find((e) => e.format === 'hls');
    expect(hls).toBeDefined();
  });

  test('endpoints have required fields', () => {
    const endpoints = buildDefaultEndpoints('channel2');
    for (const ep of endpoints) {
      expect(typeof ep.url).toBe('string');
      expect(typeof ep.priority).toBe('number');
      expect(typeof ep.bitrate).toBe('number');
      expect(typeof ep.format).toBe('string');
    }
  });

  test('lower priority number = higher priority', () => {
    const endpoints = buildDefaultEndpoints('channel1');
    const sorted = [...endpoints].sort((a, b) => a.priority - b.priority);
    expect(sorted[0].priority).toBeLessThan(sorted[sorted.length - 1].priority);
  });
});

describe('ReconnectScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('schedules callback at 1000ms on first attempt', () => {
    const scheduler = new ReconnectScheduler();
    const fn = jest.fn();
    scheduler.schedule(fn);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('doubles delay on subsequent attempts (exponential backoff)', () => {
    const scheduler = new ReconnectScheduler();
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const fn3 = jest.fn();

    // First call: fires at 1000ms
    scheduler.schedule(fn1);
    jest.advanceTimersByTime(1000);
    expect(fn1).toHaveBeenCalledTimes(1);

    // Second call: fires at 2000ms
    scheduler.schedule(fn2);
    jest.advanceTimersByTime(1999);
    expect(fn2).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn2).toHaveBeenCalledTimes(1);

    // Third call: fires at 4000ms
    scheduler.schedule(fn3);
    jest.advanceTimersByTime(3999);
    expect(fn3).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn3).toHaveBeenCalledTimes(1);
  });

  test('caps delay at 30000ms', () => {
    const scheduler = new ReconnectScheduler();
    // Advance through the backoff table: [1000, 2000, 4000, 8000, 15000, 30000]
    const delays = [1000, 2000, 4000, 8000, 15000, 30000];
    for (const delay of delays) {
      const fn = jest.fn();
      scheduler.schedule(fn);
      jest.advanceTimersByTime(delay);
      expect(fn).toHaveBeenCalledTimes(1);
    }
    // Additional calls should still cap at 30000ms
    const fn = jest.fn();
    scheduler.schedule(fn);
    jest.advanceTimersByTime(29999);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('reset brings delay back to 1000ms', () => {
    const scheduler = new ReconnectScheduler();
    // Advance a few attempts
    for (let i = 0; i < 3; i++) {
      const fn = jest.fn();
      scheduler.schedule(fn);
      jest.runAllTimers();
    }
    // Reset
    scheduler.reset();
    // Should now fire at 1000ms again
    const fn = jest.fn();
    scheduler.schedule(fn);
    jest.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('attemptCount increments on each schedule call', () => {
    const scheduler = new ReconnectScheduler();
    expect(scheduler.attemptCount).toBe(0);
    scheduler.schedule(jest.fn());
    expect(scheduler.attemptCount).toBe(1);
    scheduler.schedule(jest.fn());
    expect(scheduler.attemptCount).toBe(2);
  });

  test('reset sets attemptCount back to 0', () => {
    const scheduler = new ReconnectScheduler();
    scheduler.schedule(jest.fn());
    scheduler.schedule(jest.fn());
    scheduler.reset();
    expect(scheduler.attemptCount).toBe(0);
  });
});
