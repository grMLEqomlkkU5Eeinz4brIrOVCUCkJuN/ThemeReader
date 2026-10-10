import {DEFAULT_THEME} from '../../../src/defaults';
import {THEME_PALETTES, getThemePalette} from '../../../src/generators/palettes';
import type {ThemePalette} from '../../../src/generators/palettes';
import {modifyBackgroundColor, modifyForegroundColor} from '../../../src/inject/dynamic-theme/modify-colors';
import {parseColorWithCache, parseToHSLWithCache, type RGBA} from '../../../src/utils/color';
import type {Theme} from '../../../src/definitions';

function luminance(hex: string): number {
    const {r, g, b} = parseColorWithCache(hex)!;
    const [R, G, B] = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// Colors go through HSL and back, so allow a couple of units of rounding.
function expectSameColor(actual: string, expected: string) {
    const a = parseColorWithCache(actual)!;
    const e = parseColorWithCache(expected)!;
    expect(Math.abs(a.r - e.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.g - e.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.b - e.b)).toBeLessThanOrEqual(2);
}

function lightnessOf(hex: string): number {
    return parseToHSLWithCache(hex)!.l;
}

function grey(v: number): RGBA {
    return {r: v, g: v, b: v};
}

function darkTheme(palette: string): Theme {
    return {...DEFAULT_THEME, mode: 1, palette};
}

const tokyo = getThemePalette('tokyo-night')!;

describe('palette definitions', () => {
    it.each(THEME_PALETTES.map((p) => [p.name, p] as const))('%s keeps background layers ordered', (_name, palette: ThemePalette) => {
        const {sunken, base, raised, overlay} = palette.background;
        const lightnesses = [sunken, base, raised, overlay].map(lightnessOf);
        for (let i = 1; i < lightnesses.length; i++) {
            expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
        }
    });

    it.each(THEME_PALETTES.map((p) => [p.name, p] as const))('%s keeps text emphasis ordered', (_name, palette: ThemePalette) => {
        const {muted, secondary, primary, strong} = palette.text;
        const lightnesses = [muted, secondary, primary, strong].map(lightnessOf);
        for (let i = 1; i < lightnesses.length; i++) {
            expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
        }
    });

    it.each(THEME_PALETTES.map((p) => [p.name, p] as const))('%s has readable body text', (_name, palette: ThemePalette) => {
        expect(contrast(palette.text.primary, palette.background.base)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.text.secondary, palette.background.base)).toBeGreaterThanOrEqual(4.5);
    });

    it('resolves ids and rejects unknown ones', () => {
        expect(getThemePalette('tokyo-night')?.name).toBe('Tokyo Night');
        expect(getThemePalette('')).toBeNull();
        expect(getThemePalette('missing')).toBeNull();
    });
});

describe('palette color mapping', () => {
    it('maps a plain white page to the palette base', () => {
        const result = modifyBackgroundColor(grey(255), darkTheme('tokyo-night'), false);
        expectSameColor(result, tokyo.background.base);
    });

    it('maps pure black to the sunken layer', () => {
        const result = modifyBackgroundColor(grey(0), darkTheme('tokyo-night'), false);
        expectSameColor(result, tokyo.background.sunken);
    });

    it('keeps background lightness non-decreasing as originals get lighter', () => {
        const theme = darkTheme('tokyo-night');
        let previous = -1;
        for (let v = 0; v <= 127; v += 8) {
            const l = lightnessOf(modifyBackgroundColor(grey(v), theme, false));
            expect(l).toBeGreaterThanOrEqual(previous);
            previous = l;
        }
    });

    it('keeps distinct layers for a dark site with a blue-tinted background', () => {
        // GitHub-style layers: page, card, hover. They must stay distinct and ordered.
        const theme = darkTheme('tokyo-night');
        const page = lightnessOf(modifyBackgroundColor(parseColorWithCache('#0d1117')!, theme, false));
        const card = lightnessOf(modifyBackgroundColor(parseColorWithCache('#161b22')!, theme, false));
        const hover = lightnessOf(modifyBackgroundColor(parseColorWithCache('#21262d')!, theme, false));
        expect(page).toBeLessThan(card);
        expect(card).toBeLessThan(hover);
    });

    it('maps the strongest text to strong and mid-gray text to muted', () => {
        const theme = darkTheme('tokyo-night');
        expectSameColor(modifyForegroundColor(grey(0), theme, false), tokyo.text.strong);
        expectSameColor(modifyForegroundColor(grey(255), theme, false), tokyo.text.strong);
        expectSameColor(modifyForegroundColor(grey(128), theme, false), tokyo.text.muted);
    });

    it('keeps text emphasis non-decreasing as originals move away from mid-gray', () => {
        const theme = darkTheme('tokyo-night');
        let previous = -1;
        for (let v = 128; v >= 0; v -= 8) {
            const l = lightnessOf(modifyForegroundColor(grey(v), theme, false));
            expect(l).toBeGreaterThanOrEqual(previous);
            previous = l;
        }
    });

    it('keeps chromatic text hue', () => {
        const red = modifyForegroundColor({r: 255, g: 0, b: 0}, darkTheme('tokyo-night'), false);
        const hue = parseToHSLWithCache(red)!.h;
        expect(Math.min(hue, 360 - hue)).toBeLessThan(10);
    });

    it('ignores the palette for light schemes', () => {
        const withPalette = {...DEFAULT_THEME, mode: 0, palette: 'tokyo-night'};
        const without = {...DEFAULT_THEME, mode: 0, palette: ''};
        expect(modifyBackgroundColor(grey(255), withPalette, false)).toBe(modifyBackgroundColor(grey(255), without, false));
        expect(modifyForegroundColor(grey(0), withPalette, false)).toBe(modifyForegroundColor(grey(0), without, false));
    });

    it('treats an unknown palette id as no palette', () => {
        const unknown = modifyBackgroundColor(grey(255), darkTheme('missing'), false);
        const none = modifyBackgroundColor(grey(255), darkTheme(''), false);
        expect(unknown).toBe(none);
    });
});
