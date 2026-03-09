import { getAllChannels, getChannel, updateChannel, recordAnalytics, getListenerCounts } from '../lib/channelStore';

describe('ChannelStore', () => {
  beforeEach(() => {
    // Reset global store
    (globalThis as Record<string, unknown>).__channelStore = undefined;
    (globalThis as Record<string, unknown>).__listenerCounts = undefined;
    (globalThis as Record<string, unknown>).__analyticsStore = undefined;
  });

  test('getAllChannels returns 4 channels', () => {
    const channels = getAllChannels();
    expect(channels).toHaveLength(4);
  });

  test('default channels have correct ids and slugs', () => {
    const channels = getAllChannels();
    expect(channels[0].id).toBe(1);
    expect(channels[0].slug).toBe('channel1');
    expect(channels[1].id).toBe(2);
    expect(channels[1].slug).toBe('channel2');
    expect(channels[3].id).toBe(4);
    expect(channels[3].slug).toBe('channel4');
  });

  test('getChannel returns the correct channel', () => {
    const ch = getChannel(1);
    expect(ch).toBeDefined();
    expect(ch?.slug).toBe('channel1');
    expect(ch?.name).toBe('Main Stage');
  });

  test('getChannel returns undefined for nonexistent id', () => {
    const ch = getChannel(99);
    expect(ch).toBeUndefined();
  });

  test('updateChannel updates name', () => {
    const updated = updateChannel(1, { name: 'Updated Name' });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Updated Name');

    const ch = getChannel(1);
    expect(ch?.name).toBe('Updated Name');
  });

  test('updateChannel updates status', () => {
    updateChannel(2, { status: 'offline' });
    const ch = getChannel(2);
    expect(ch?.status).toBe('offline');
  });

  test('updateChannel returns null for nonexistent id', () => {
    const result = updateChannel(99, { name: 'Ghost' });
    expect(result).toBeNull();
  });

  test('updateChannel does not modify id', () => {
    const updated = updateChannel(3, { name: 'New Name' });
    expect(updated?.id).toBe(3);
  });
});

describe('Analytics', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__analyticsStore = undefined;
    (globalThis as Record<string, unknown>).__listenerCounts = undefined;
  });

  test('recordAnalytics join increments listener count', () => {
    recordAnalytics({ channelId: 1, action: 'join', sessionId: 'sess1', timestamp: new Date().toISOString() });
    const counts = getListenerCounts();
    expect(counts[1]).toBe(1);
  });

  test('recordAnalytics leave decrements listener count', () => {
    recordAnalytics({ channelId: 1, action: 'join', sessionId: 'sess1', timestamp: new Date().toISOString() });
    recordAnalytics({ channelId: 1, action: 'leave', sessionId: 'sess1', timestamp: new Date().toISOString() });
    const counts = getListenerCounts();
    expect(counts[1]).toBe(0);
  });

  test('listener count never goes below 0', () => {
    recordAnalytics({ channelId: 1, action: 'leave', sessionId: 'sess1', timestamp: new Date().toISOString() });
    const counts = getListenerCounts();
    expect(counts[1]).toBe(0);
  });

  test('multiple sessions tracked independently per channel', () => {
    recordAnalytics({ channelId: 1, action: 'join', sessionId: 'a', timestamp: new Date().toISOString() });
    recordAnalytics({ channelId: 1, action: 'join', sessionId: 'b', timestamp: new Date().toISOString() });
    recordAnalytics({ channelId: 2, action: 'join', sessionId: 'c', timestamp: new Date().toISOString() });
    const counts = getListenerCounts();
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(1);
    expect(counts[3]).toBe(0);
  });
});
