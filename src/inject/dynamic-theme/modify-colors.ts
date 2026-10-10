import {extendThemeCacheKeys, getBackgroundPoles, getTextPoles, modifyBgColorExtended, modifyFgColorExtended, modifyLightSchemeColorExtended} from '@plus/utils/theme';
import type {Theme} from '../../definitions';
import {getThemePalette} from '../../generators/palettes';
import type {ThemePalette} from '../../generators/palettes';
import {applyColorMatrix, createFilterMatrix} from '../../generators/utils/matrix';
import {getRegisteredColor, registerColor} from '../../inject/dynamic-theme/palette';
import type {RGBA, HSLA} from '../../utils/color';
import {parseToHSLWithCache, rgbToHSL, hslToRGB, rgbToString, rgbToHexString} from '../../utils/color';
import {scale} from '../../utils/math';


type HSLModifyFunction = ((hsl: HSLA) => HSLA) | ((hsl: HSLA, pole: HSLA) => HSLA) | ((hsl: HSLA, pole: HSLA, anotherPole: HSLA) => HSLA);

declare const __PLUS__: boolean;

// Palettes only describe the dark scheme, so light schemes ignore them.
function getActivePalette(theme: Theme): ThemePalette | null {
    return theme.mode === 1 ? getThemePalette(theme.palette) : null;
}

function getBgPole(theme: Theme) {
    const palette = getActivePalette(theme);
    if (palette) {
        return palette.background.base;
    }
    const isDarkScheme = theme.mode === 1;
    const prop: keyof Theme = isDarkScheme ? 'darkSchemeBackgroundColor' : 'lightSchemeBackgroundColor';
    return theme[prop];
}

function getFgPole(theme: Theme) {
    const palette = getActivePalette(theme);
    if (palette) {
        return palette.text.primary;
    }
    const isDarkScheme = theme.mode === 1;
    const prop: keyof Theme = isDarkScheme ? 'darkSchemeTextColor' : 'lightSchemeTextColor';
    return theme[prop];
}

const colorModificationCache = new Map<HSLModifyFunction, Map<string, string>>();

export function clearColorModificationCache(): void {
    colorModificationCache.clear();
}

const rgbCacheKeys: Array<keyof RGBA> = ['r', 'g', 'b', 'a'];

export const themeCacheKeys: Array<keyof Theme> = [
    'mode',
    'brightness',
    'contrast',
    'grayscale',
    'sepia',
    'darkSchemeBackgroundColor',
    'darkSchemeTextColor',
    'lightSchemeBackgroundColor',
    'lightSchemeTextColor',
    'palette',
];
extendThemeCacheKeys(themeCacheKeys);

function getCacheId(rgb: RGBA, theme: Theme, poleA?: string, poleB?: string): string {
    let resultId = '';
    rgbCacheKeys.forEach((key) => {
        resultId += `${rgb[key]};`;
    });
    themeCacheKeys.forEach((key) => {
        resultId += `${theme[key]};`;
    });
    resultId += `${poleA};${poleB}`;
    return resultId;
}

function modifyColorWithCache(rgb: RGBA, theme: Theme, modifyHSL: HSLModifyFunction, poleColor?: string, anotherPoleColor?: string): string {
    let fnCache: Map<string, string>;
    if (colorModificationCache.has(modifyHSL)) {
        fnCache = colorModificationCache.get(modifyHSL)!;
    } else {
        fnCache = new Map();
        colorModificationCache.set(modifyHSL, fnCache);
    }
    const id = getCacheId(rgb, theme, poleColor, anotherPoleColor);
    if (fnCache.has(id)) {
        return fnCache.get(id)!;
    }

    const hsl = rgbToHSL(rgb);
    const pole = poleColor == null ? null : parseToHSLWithCache(poleColor);
    const anotherPole = anotherPoleColor == null ? null : parseToHSLWithCache(anotherPoleColor);
    const modified = modifyHSL(hsl, pole!, anotherPole!);
    const {r, g, b, a} = hslToRGB(modified);
    const matrix = createFilterMatrix({...theme, mode: 0});
    const [rf, gf, bf] = applyColorMatrix([r, g, b], matrix);

    const color = (a === 1 ?
        rgbToHexString({r: rf, g: gf, b: bf}) :
        rgbToString({r: rf, g: gf, b: bf, a}));

    fnCache.set(id, color);
    return color;
}

function noopHSL(hsl: HSLA): HSLA {
    return hsl;
}

export function modifyColor(rgb: RGBA, theme: Theme): string {
    return modifyColorWithCache(rgb, theme, noopHSL);
}

function modifyAndRegisterColor(
    type: 'background' | 'text' | 'border',
    rgb: RGBA,
    theme: Theme,
    modifier: (rgb: RGBA, theme: Theme) => string,
) {
    const registered = getRegisteredColor(type, rgb);
    if (registered) {
        return registered;
    }
    const value = modifier(rgb, theme);
    return registerColor(type, rgb, value);
}

function modifyLightSchemeColor(rgb: RGBA, theme: Theme): string {
    const poleBg = getBgPole(theme);
    const poleFg = getFgPole(theme);
    return modifyColorWithCache(rgb, theme, modifyLightModeHSL, poleFg, poleBg);
}

function modifyLightModeHSL({h, s, l, a}: HSLA, poleFg: HSLA, poleBg: HSLA): HSLA {
    const isDark = l < 0.5;
    let isNeutral: boolean;
    if (isDark) {
        isNeutral = l < 0.2 || s < 0.12;
    } else {
        const isBlue = h > 200 && h < 280;
        isNeutral = s < 0.24 || (l > 0.8 && isBlue);
    }

    let hx = h;
    let sx = s;
    if (isNeutral) {
        if (isDark) {
            hx = poleFg.h;
            sx = poleFg.s;
        } else {
            hx = poleBg.h;
            sx = poleBg.s;
        }
    }

    const lx = scale(l, 0, 1, poleFg.l, poleBg.l);

    return {h: hx, s: sx, l: lx, a};
}

const MAX_BG_LIGHTNESS = 0.4;

function isNeutralBackground({h, s, l}: HSLA): boolean {
    const isBlue = h > 200 && h < 280;
    return s < 0.12 || (l > 0.8 && isBlue);
}

function modifyBgHSL({h, s, l, a}: HSLA, pole: HSLA): HSLA {
    const isDark = l < 0.5;
    const isNeutral = isNeutralBackground({h, s, l, a});
    if (isDark) {
        const lx = scale(l, 0, 0.5, 0, MAX_BG_LIGHTNESS);
        if (isNeutral) {
            const hx = pole.h;
            const sx = pole.s;
            return {h: hx, s: sx, l: lx, a};
        }
        return {h, s, l: lx, a};
    }

    let lx = scale(l, 0.5, 1, MAX_BG_LIGHTNESS, pole.l);

    if (isNeutral) {
        const hx = pole.h;
        const sx = pole.s;
        return {h: hx, s: sx, l: lx, a};
    }

    let hx = h;
    const isYellow = h > 60 && h < 180;
    if (isYellow) {
        const isCloserToGreen = h > 120;
        if (isCloserToGreen) {
            hx = scale(h, 120, 180, 135, 180);
        } else {
            hx = scale(h, 60, 120, 60, 105);
        }
    }

    // Lower the lightness, if the resulting
    // hue is in lower yellow spectrum.
    if (hx > 40 && hx < 80) {
        lx *= 0.75;
    }

    return {h: hx, s, l: lx, a};
}

function lerpHSL(from: HSLA, to: HSLA, t: number): HSLA {
    return {
        h: from.h + (to.h - from.h) * t,
        s: from.s + (to.s - from.s) * t,
        l: from.l + (to.l - from.l) * t,
        a: from.a,
    };
}

// Stops must be sorted by lightness, ascending.
function sampleByLightness(stops: HSLA[], l: number): HSLA {
    if (l <= stops[0].l) {
        return stops[0];
    }
    const last = stops[stops.length - 1];
    if (l >= last.l) {
        return last;
    }
    for (let i = 0; i < stops.length - 1; i++) {
        if (l <= stops[i + 1].l) {
            const t = (l - stops[i].l) / (stops[i + 1].l - stops[i].l);
            return lerpHSL(stops[i], stops[i + 1], t);
        }
    }
    return last;
}

// Stops are spread evenly over [0, 1].
function sampleByPosition(stops: HSLA[], position: number): HSLA {
    const scaled = Math.min(1, Math.max(0, position)) * (stops.length - 1);
    const i = Math.min(Math.floor(scaled), stops.length - 2);
    return lerpHSL(stops[i], stops[i + 1], scaled - i);
}

// Originals darker than this are spread across the whole palette ramp.
const PALETTE_DARK_LAYER_RANGE = 0.25;

// Background layers include blue-tinted darks such as GitHub's #0d1117,
// so the palette takes over anything that is not strongly saturated.
function isPaletteLayer({s}: HSLA): boolean {
    return s < 0.3;
}

function createPaletteBgModifier(palette: ThemePalette): HSLModifyFunction {
    const {sunken, base, raised, overlay} = palette.background;
    const stops = [sunken, base, raised, overlay].map((color) => parseToHSLWithCache(color)!);
    return (hsl: HSLA, pole: HSLA): HSLA => {
        if (!isPaletteLayer(hsl)) {
            // Saturated backgrounds keep their hue, so brand colors survive.
            return modifyBgHSL(hsl, pole);
        }
        if (hsl.l < 0.5) {
            // Dark originals keep their order across the palette, so the
            // body, cards and hover states stay distinct instead of clamping.
            const position = hsl.l / PALETTE_DARK_LAYER_RANGE;
            return {...sampleByPosition(stops, position), a: hsl.a};
        }
        // Light originals are mapped by lightness, so a white page becomes the base.
        const modified = modifyBgHSL(hsl, pole);
        return {...sampleByLightness(stops, modified.l), a: hsl.a};
    };
}

function isNeutralForeground({s, l}: HSLA): boolean {
    return l < 0.2 || s < 0.24;
}

// Text on dark sites is often lightly tinted (GitHub uses a blue-gray),
// so the palette takes over text that is not strongly saturated.
function isPaletteText({s, l}: HSLA): boolean {
    return l < 0.2 || s < 0.4;
}

function createPaletteFgModifier(palette: ThemePalette): HSLModifyFunction {
    const {muted, secondary, primary, strong} = palette.text;
    const stops = [muted, secondary, primary, strong].map((color) => parseToHSLWithCache(color)!);
    return (hsl: HSLA, pole: HSLA): HSLA => {
        if (!isPaletteText(hsl)) {
            return modifyFgHSL(hsl, pole);
        }
        // Emphasis is the distance from mid-gray. Black or white text
        // (headings, body) gets the strongest role, and mid-gray text
        // (captions, placeholders) gets the most muted one.
        const emphasis = Math.abs(hsl.l - 0.5) * 2;
        return {...sampleByPosition(stops, emphasis), a: hsl.a};
    };
}

// Modifier functions must keep their identity so the color cache can key on them.
const paletteModifiers = new Map<string, {bg: HSLModifyFunction; fg: HSLModifyFunction}>();

function getPaletteModifiers(palette: ThemePalette) {
    let modifiers = paletteModifiers.get(palette.id);
    if (!modifiers) {
        modifiers = {bg: createPaletteBgModifier(palette), fg: createPaletteFgModifier(palette)};
        paletteModifiers.set(palette.id, modifiers);
    }
    return modifiers;
}

function _modifyBackgroundColor(rgb: RGBA, theme: Theme) {
    const palette = getActivePalette(theme);
    if (palette) {
        return modifyColorWithCache(rgb, theme, getPaletteModifiers(palette).bg, getBgPole(theme));
    }
    if (theme.mode === 0) {
        if (__PLUS__) {
            const poles = getBackgroundPoles(theme);
            return modifyColorWithCache(rgb, theme, modifyLightSchemeColorExtended, poles[0], poles[1]);
        }
        return modifyLightSchemeColor(rgb, theme);
    }
    if (__PLUS__) {
        const poles = getBackgroundPoles(theme);
        return modifyColorWithCache(rgb, theme, modifyBgColorExtended, poles[0], poles[1]);
    }
    const pole = getBgPole(theme);
    return modifyColorWithCache(rgb, theme, modifyBgHSL, pole);
}

export function modifyBackgroundColor(rgb: RGBA, theme: Theme, shouldRegisterColorVariable = true): string {
    if (!shouldRegisterColorVariable) {
        return _modifyBackgroundColor(rgb, theme);
    }
    return modifyAndRegisterColor('background', rgb, theme, _modifyBackgroundColor);
}

const MIN_FG_LIGHTNESS = 0.55;

function modifyBlueFgHue(hue: number): number {
    return scale(hue, 205, 245, 205, 220);
}

function modifyFgHSL({h, s, l, a}: HSLA, pole: HSLA): HSLA {
    const isLight = l > 0.5;
    const isNeutral = isNeutralForeground({h, s, l, a});
    const isBlue = !isNeutral && h > 205 && h < 245;
    if (isLight) {
        const lx = scale(l, 0.5, 1, MIN_FG_LIGHTNESS, pole.l);
        if (isNeutral) {
            const hx = pole.h;
            const sx = pole.s;
            return {h: hx, s: sx, l: lx, a};
        }
        let hx = h;
        if (isBlue) {
            hx = modifyBlueFgHue(h);
        }
        return {h: hx, s, l: lx, a};
    }

    if (isNeutral) {
        const hx = pole.h;
        const sx = pole.s;
        const lx = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS);
        return {h: hx, s: sx, l: lx, a};
    }

    let hx = h;
    let lx: number;
    if (isBlue) {
        hx = modifyBlueFgHue(h);
        lx = scale(l, 0, 0.5, pole.l, Math.min(1, MIN_FG_LIGHTNESS + 0.05));
    } else {
        lx = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS);
    }

    return {h: hx, s, l: lx, a};
}

function _modifyForegroundColor(rgb: RGBA, theme: Theme) {
    const palette = getActivePalette(theme);
    if (palette) {
        return modifyColorWithCache(rgb, theme, getPaletteModifiers(palette).fg, getFgPole(theme));
    }
    if (theme.mode === 0) {
        if (__PLUS__) {
            const poles = getTextPoles(theme);
            return modifyColorWithCache(rgb, theme, modifyLightSchemeColorExtended, poles[0], poles[1]);
        }
        return modifyLightSchemeColor(rgb, theme);
    }
    if (__PLUS__) {
        const poles = getTextPoles(theme);
        return modifyColorWithCache(rgb, theme, modifyFgColorExtended, poles[0], poles[1]);
    }
    const pole = getFgPole(theme);
    return modifyColorWithCache(rgb, theme, modifyFgHSL, pole);
}

export function modifyForegroundColor(rgb: RGBA, theme: Theme, shouldRegisterColorVariable = true): string {
    if (!shouldRegisterColorVariable) {
        return _modifyForegroundColor(rgb, theme);
    }
    return modifyAndRegisterColor('text', rgb, theme, _modifyForegroundColor);
}

function modifyBorderHSL({h, s, l, a}: HSLA, poleFg: HSLA, poleBg: HSLA): HSLA {
    const isDark = l < 0.5;
    const isNeutral = l < 0.2 || s < 0.24;

    let hx = h;
    let sx = s;

    if (isNeutral) {
        if (isDark) {
            hx = poleFg.h;
            sx = poleFg.s;
        } else {
            hx = poleBg.h;
            sx = poleBg.s;
        }
    }

    const lx = scale(l, 0, 1, 0.5, 0.2);

    return {h: hx, s: sx, l: lx, a};
}

function _modifyBorderColor(rgb: RGBA, theme: Theme) {
    if (theme.mode === 0) {
        return modifyLightSchemeColor(rgb, theme);
    }
    const poleFg = getFgPole(theme);
    const poleBg = getBgPole(theme);
    return modifyColorWithCache(rgb, theme, modifyBorderHSL, poleFg, poleBg);
}

export function modifyBorderColor(rgb: RGBA, theme: Theme, shouldRegisterColorVariable = true): string {
    if (!shouldRegisterColorVariable) {
        return _modifyBorderColor(rgb, theme);
    }
    return modifyAndRegisterColor('border', rgb, theme, _modifyBorderColor);
}

export function modifyShadowColor(rgb: RGBA, theme: Theme): string {
    return modifyBackgroundColor(rgb, theme);
}

export function modifyGradientColor(rgb: RGBA, theme: Theme): string {
    return modifyBackgroundColor(rgb, theme);
}
