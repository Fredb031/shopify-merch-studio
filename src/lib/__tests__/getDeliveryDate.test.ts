import { describe, it, expect } from 'vitest';
import { getDeliveryDate, getDeliveryDateRaw } from '../getDeliveryDate';

/**
 * getDeliveryDate is the one source of truth for the "Estimated
 * delivery: <date>" string the marketing surfaces quote. The pin
 * matrix below covers the four corners of the rules:
 *
 *   1. Pre-cutoff weekday        — start day-1 today, 5 business days
 *   2. Post-cutoff weekday       — +1 extra day (production tomorrow)
 *   3. Saturday                  — treated as past-cutoff (no work)
 *   4. Sunday                    — same as Saturday
 *   5. Friday-pre-cutoff vs Friday-post-cutoff vs Saturday — Friday at
 *      4pm and Saturday/Sunday-anytime should land on the SAME ETA
 *      (they're all "Monday is the first production day")
 *
 * Times are anchored in America/Toronto by constructing the Date from
 * an explicit ISO offset (-04:00 EDT in May, -05:00 EST in January).
 * This sidesteps the host machine's DST settings; all assertions read
 * the same hour regardless of CI runner timezone.
 */

// May 2025 reference week: 2025-05-12 = Monday, 2025-05-16 = Friday,
// 2025-05-17 = Saturday, 2025-05-18 = Sunday. May is EDT so the
// Toronto offset is -04:00.
const monday14h = new Date('2025-05-12T14:00:00-04:00');
const monday16h = new Date('2025-05-12T16:00:00-04:00');
const friday14h = new Date('2025-05-16T14:30:00-04:00');
const friday16h = new Date('2025-05-16T16:00:00-04:00');
const saturday  = new Date('2025-05-17T10:00:00-04:00');
const sunday    = new Date('2025-05-18T10:00:00-04:00');

describe('getDeliveryDateRaw — business-day arithmetic', () => {
  it('Monday 14h pre-cutoff → +5 business days = next Monday', () => {
    const eta = getDeliveryDateRaw({ from: monday14h });
    // 12 May Mon + 5 biz days (Tue Wed Thu Fri Mon) = Mon 19 May.
    expect(eta.getUTCDate()).toBe(19);
    expect(eta.getUTCMonth()).toBe(4); // May (0-indexed)
  });

  it('Monday 16h post-cutoff → +6 business days = Tuesday', () => {
    const eta = getDeliveryDateRaw({ from: monday16h });
    expect(eta.getUTCDate()).toBe(20);
    expect(eta.getUTCMonth()).toBe(4);
  });

  it('Friday 14h30 pre-cutoff → +5 business days = next Friday', () => {
    const eta = getDeliveryDateRaw({ from: friday14h });
    // 16 May Fri + 5 biz days (Mon Tue Wed Thu Fri) = Fri 23 May.
    expect(eta.getUTCDate()).toBe(23);
  });

  it('Friday 16h post-cutoff → +6 business days = Monday', () => {
    const eta = getDeliveryDateRaw({ from: friday16h });
    // Fri after-cutoff + 6 biz days = Mon 26 May.
    expect(eta.getUTCDate()).toBe(26);
  });

  it('Saturday is treated as past-cutoff — same ETA as Friday-post-cutoff', () => {
    const sat = getDeliveryDateRaw({ from: saturday });
    const friPost = getDeliveryDateRaw({ from: friday16h });
    expect(sat.getUTCDate()).toBe(friPost.getUTCDate());
  });

  it('Sunday is treated as past-cutoff — same ETA as Friday-post-cutoff', () => {
    const sun = getDeliveryDateRaw({ from: sunday });
    const friPost = getDeliveryDateRaw({ from: friday16h });
    expect(sun.getUTCDate()).toBe(friPost.getUTCDate());
  });

  it('respects a custom cutoffHour', () => {
    // Same Monday 14h, but tighten the cutoff to 12h — now 14h is
    // post-cutoff and we expect the +6 path.
    const tight = getDeliveryDateRaw({ from: monday14h, cutoffHour: 12 });
    const lax   = getDeliveryDateRaw({ from: monday14h, cutoffHour: 18 });
    expect(tight.getUTCDate()).toBe(20); // +6 → Tuesday
    expect(lax.getUTCDate()).toBe(19);   // +5 → Monday
  });
});

describe('getDeliveryDate — formatted string output', () => {
  it('renders fr-CA weekday + day + month for the default lang', () => {
    const out = getDeliveryDate({ from: monday14h });
    // fr-CA "long" weekday + day + month: "lundi 19 mai".
    expect(out).toMatch(/lundi/);
    expect(out).toMatch(/19/);
    expect(out).toMatch(/mai/);
  });

  it('renders en-CA weekday + day + month when lang=en', () => {
    const out = getDeliveryDate({ from: monday14h, lang: 'en' });
    // en-CA "long" weekday + day + month: "Monday, May 19".
    expect(out).toMatch(/Monday/);
    expect(out).toMatch(/19/);
    expect(out).toMatch(/May/);
  });

  it('does not throw for an undefined opts arg (defaults applied)', () => {
    expect(() => getDeliveryDate()).not.toThrow();
    expect(() => getDeliveryDateRaw()).not.toThrow();
  });
});
