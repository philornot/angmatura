import {describe, expect, it} from 'vitest';
import {computeCoverRadius} from './themeTransition';

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