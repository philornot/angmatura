import {describe, expect, it} from 'vitest';
import {computeCoverRadius, pickMobileAxis} from './themeTransition';

describe('computeCoverRadius', () => {
    it('reaches the farthest corner when the origin is near the top-left', () => {
        const radius = computeCoverRadius(10, 10, 400, 300);
        expect(radius).toBeCloseTo(Math.hypot(390, 290));
    });

    it('reaches the farthest corner when the origin is near the bottom-right', () => {
        const radius = computeCoverRadius(390, 290, 400, 300);
        expect(radius).toBeCloseTo(Math.hypot(390, 290));
    });

    it('is symmetric for an origin at the exact centre', () => {
        const radius = computeCoverRadius(200, 150, 400, 300);
        expect(radius).toBeCloseTo(Math.hypot(200, 150));
    });

    it('still returns a sensible radius for an origin outside the viewport', () => {
        // e.g. a toggle button sitting right at the edge of the screen
        const radius = computeCoverRadius(-20, -20, 400, 300);
        expect(radius).toBeCloseTo(Math.hypot(420, 320));
    });

    it('never returns a negative radius for a zero-size viewport', () => {
        expect(computeCoverRadius(0, 0, 0, 0)).toBe(0);
    });
});

describe('pickMobileAxis', () => {
    it('picks horizontal for random values below 0.5', () => {
        expect(pickMobileAxis(() => 0)).toBe('horizontal');
        expect(pickMobileAxis(() => 0.49)).toBe('horizontal');
    });

    it('picks vertical for random values 0.5 and above', () => {
        expect(pickMobileAxis(() => 0.5)).toBe('vertical');
        expect(pickMobileAxis(() => 0.99)).toBe('vertical');
    });

    it('only ever returns one of the two known axes', () => {
        const seeds = [0, 0.1, 0.25, 0.4999, 0.5, 0.75, 0.999];
        for (const seed of seeds) {
            expect(['horizontal', 'vertical']).toContain(pickMobileAxis(() => seed));
        }
    });

    it('defaults to Math.random when no source is given, so repeated calls can differ', () => {
        // Not deterministic by nature (that's the point), but every result
        // must still be a valid axis.
        const result = pickMobileAxis();
        expect(['horizontal', 'vertical']).toContain(result);
    });
});
