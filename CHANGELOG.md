# Release Notes

## 0.2.7

- Best practices improvements:
  - Output channel is now properly disposed on deactivation
  - Progress notification with cancellable GA4 refresh
  - Safer error handling (typed `unknown`, no `any`)
  - Activation only on language/command (removed `workspaceContains` for faster startup)
  - Command categories "Astro Analytics" in Command Palette
  - Keywords and license in manifest for marketplace
  - Default `astroAnalytics.propertyId` is now empty (must be set in settings)
  - Status bar accessibility information for screen readers
  - Hover markdown no longer trusted when no commands/links are used

## 0.2.6

- Initial release with CodeLens, hover, and status bar GA4 metrics for Astro content
