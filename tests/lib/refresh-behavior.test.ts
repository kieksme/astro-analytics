import { describe, it, expect } from 'vitest';
import {
  shouldRefreshOnStartup,
  shouldRefreshOnConfigChange,
  type ConfigurationChangeEventLike,
} from '../../src/lib/refresh-behavior';

describe('shouldRefreshOnStartup', () => {
  it('returns true when propertyId is a non-empty string', () => {
    expect(shouldRefreshOnStartup('123456')).toBe(true);
    expect(shouldRefreshOnStartup('G-XXXXXXXX')).toBe(true);
  });

  it('returns false when propertyId is undefined', () => {
    expect(shouldRefreshOnStartup(undefined)).toBe(false);
  });

  it('returns false when propertyId is empty string', () => {
    expect(shouldRefreshOnStartup('')).toBe(false);
  });

  it('returns false when propertyId is only whitespace', () => {
    expect(shouldRefreshOnStartup('   ')).toBe(false);
  });

  it('returns true when propertyId has leading/trailing spaces but content', () => {
    expect(shouldRefreshOnStartup('  G-XXX  ')).toBe(true);
  });
});

describe('shouldRefreshOnConfigChange', () => {
  function makeEvent(affectedSection: string): ConfigurationChangeEventLike {
    return {
      affectsConfiguration(section: string) {
        return section === affectedSection;
      },
    };
  }

  it('returns true when event affects astroAnalytics section', () => {
    const e = makeEvent('astroAnalytics');
    expect(shouldRefreshOnConfigChange('astroAnalytics', e)).toBe(true);
  });

  it('returns false when event affects a different section', () => {
    const e = makeEvent('editor');
    expect(shouldRefreshOnConfigChange('astroAnalytics', e)).toBe(false);
  });

  it('returns false when event affects subsection of astroAnalytics but section check is exact', () => {
    // affectsConfiguration('astroAnalytics') is true for any astroAnalytics.* change
    const e = {
      affectsConfiguration(section: string) {
        return section === 'astroAnalytics' || section.startsWith('astroAnalytics.');
      },
    };
    expect(shouldRefreshOnConfigChange('astroAnalytics', e)).toBe(true);
  });

  it('returns true for section that matches', () => {
    const e = makeEvent('astroAnalytics');
    expect(shouldRefreshOnConfigChange('astroAnalytics', e)).toBe(true);
  });
});
