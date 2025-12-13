import { formatDate } from '@angular/common';

/**
 * Utility functions for formatting dates
 * Handles UTC date strings from SQLite and Unix timestamps
 * Uses browser's locale settings while ensuring 24-hour format
 */
export class DateUtils {
  private static cachedLocale: string | null = null;
  private static cachedTimezone: string | null = null;
  private static initialized = false;

  /**
   * Gets the browser's locale or falls back to 'en-US'
   * Normalizes language-only codes (e.g., 'en' -> 'en-US') based on timezone
   */
  private static getBrowserLocale(): string {
    if (DateUtils.cachedLocale) {
      return DateUtils.cachedLocale;
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
      let locale = navigator.language;

      // If locale is just a language code (e.g., 'en'), try to infer region from timezone
      if (locale.length === 2 || !locale.includes('-')) {
        const timezone = DateUtils.getBrowserTimezone();
        locale = DateUtils.normalizeLocale(locale, timezone);
      }

      DateUtils.cachedLocale = locale;

      // Log only once on first initialization
      if (!DateUtils.initialized) {
        const timezone = DateUtils.getBrowserTimezone();
        const timezoneOffset = new Date().getTimezoneOffset();
        console.log('[DateUtils] Browser locale:', navigator.language, '-> normalized:', locale);
        console.log('[DateUtils] Browser timezone:', timezone);
        console.log(
          '[DateUtils] Timezone offset (minutes):',
          timezoneOffset,
          `(UTC${timezoneOffset <= 0 ? '+' : ''}${-timezoneOffset / 60})`
        );
        DateUtils.initialized = true;
      }

      return locale;
    }

    DateUtils.cachedLocale = 'en-US';
    console.log('[DateUtils] Navigator not available, using fallback locale: en-US');
    return 'en-US'; // Fallback to en-US if navigator is not available
  }

  /**
   * Normalizes a language code to include a region based on timezone
   */
  private static normalizeLocale(locale: string, timezone: string): string {
    // Common timezone to locale region mappings
    const timezoneToRegion: Record<string, string> = {
      'Europe/Zagreb': 'HR',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Australia/Sydney': 'AU',
    };

    // Try to get region from timezone
    if (timezone && timezoneToRegion[timezone]) {
      return `${locale}-${timezoneToRegion[timezone]}`;
    }

    // Fallback: use common defaults
    const languageDefaults: Record<string, string> = {
      en: 'US',
      de: 'DE',
      fr: 'FR',
      es: 'ES',
      it: 'IT',
      pt: 'PT',
      nl: 'NL',
      pl: 'PL',
      ru: 'RU',
      ja: 'JP',
      zh: 'CN',
      ko: 'KR',
    };

    const lang = locale.toLowerCase().split('-')[0];
    if (languageDefaults[lang]) {
      return `${locale}-${languageDefaults[lang]}`;
    }

    // Last resort: return as-is or add generic region
    return locale.length === 2 ? `${locale}-${locale.toUpperCase()}` : locale;
  }

  /**
   * Gets the browser's timezone using Intl API (preferred) or falls back to offset
   */
  private static getBrowserTimezone(): string {
    if (DateUtils.cachedTimezone) {
      return DateUtils.cachedTimezone;
    }

    try {
      // Preferred method: IANA timezone name (e.g., "America/New_York", "Europe/London")
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone) {
          DateUtils.cachedTimezone = timezone;
          return timezone;
        }
      }
    } catch (e) {
      console.warn('[DateUtils] Failed to get timezone via Intl API:', e);
    }

    // Fallback: Calculate timezone offset
    const offset = new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset <= 0 ? '+' : '-';
    DateUtils.cachedTimezone = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
    return DateUtils.cachedTimezone;
  }

  /**
   * Formats a UTC date string (from SQLite) to local timezone using browser's locale
   * Ensures 24-hour format regardless of locale preferences
   * @param dateString UTC date string without timezone info (e.g., "2025-12-13 14:25:00")
   * @returns Formatted date string respecting browser locale but in 24-hour format
   */
  static formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    // SQLite stores dates as UTC strings without timezone info
    // Parse as UTC and convert to local timezone
    const date = new Date(dateString + ' UTC');
    if (isNaN(date.getTime())) {
      // Fallback: try parsing as-is
      const fallbackDate = new Date(dateString);
      if (isNaN(fallbackDate.getTime())) return '-';
      return DateUtils.formatDateWithLocale(fallbackDate);
    }
    return DateUtils.formatDateWithLocale(date);
  }

  /**
   * Formats a Unix timestamp (seconds since epoch) to local timezone using browser's locale
   * Ensures 24-hour format regardless of locale preferences
   * @param timestamp Unix timestamp in seconds
   * @returns Formatted date string respecting browser locale but in 24-hour format
   */
  static formatUnixTimestamp(timestamp: number | null | undefined): string {
    if (!timestamp) return '-';
    // Unix timestamp is stored in seconds, convert to milliseconds
    const date = new Date(timestamp * 1000);
    return DateUtils.formatDateWithLocale(date);
  }

  /**
   * Internal helper to format a Date object using browser locale with 24-hour format
   */
  private static formatDateWithLocale(date: Date): string {
    const locale = DateUtils.getBrowserLocale();
    // Use Angular's formatDate with browser locale
    // Format: date part respects locale, time part uses 24-hour format
    // We'll use 'short' format and then convert time to 24-hour if needed
    const formatted = formatDate(date, 'short', locale);

    // Check if the formatted string contains AM/PM (12-hour format)
    // Support multiple formats: "3:42:07 PM", "3:42 PM", "15:42:07" (already 24-hour)
    // Regex matches: optional seconds, space, AM/PM
    const amPmRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i;
    const match = formatted.match(amPmRegex);

    if (match) {
      const [, hour, minute, second, period] = match;
      let hour24 = parseInt(hour, 10);

      if (period.toUpperCase() === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (period.toUpperCase() === 'AM' && hour24 === 12) {
        hour24 = 0;
      }

      // Replace the time portion with 24-hour format
      // Include seconds if they were present in the original format
      const timeStr = second
        ? `${hour24.toString().padStart(2, '0')}:${minute}:${second}`
        : `${hour24.toString().padStart(2, '0')}:${minute}`;

      return formatted.replace(amPmRegex, timeStr);
    }

    // Already in 24-hour format or no time component
    return formatted;
  }
}
