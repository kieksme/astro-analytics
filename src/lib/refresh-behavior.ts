/**
 * Pure helpers for when to run analytics refresh. Extracted for unit testing.
 */

/** Returns true if refresh should run on extension startup (GA4 is configured). */
export function shouldRefreshOnStartup(propertyId: string | undefined): boolean {
  return !!propertyId?.trim();
}

/** Configuration change event shape used by the extension. */
export interface ConfigurationChangeEventLike {
  affectsConfiguration(section: string): boolean;
}

/** Returns true if refresh should run after a configuration change (astroAnalytics section changed). */
export function shouldRefreshOnConfigChange(
  section: string,
  event: ConfigurationChangeEventLike
): boolean {
  return event.affectsConfiguration(section);
}
