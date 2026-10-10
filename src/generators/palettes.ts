import type {Theme} from '../definitions';

// Semantic palettes for the dynamic theme's dark scheme.
//
// Each palette names its colors by the role they play on a page, not by hue.
// The dynamic theme uses the roles to keep the page hierarchy intact:
// - background layers keep their order: sunken < base < raised < overlay
// - text keeps its emphasis order: muted < secondary < primary < strong
// Lightness must increase along each list. The unit tests enforce this.
export interface ThemePalette {
    id: string;
    name: string;
    background: {
        // Inset areas such as code blocks and input tracks.
        sunken: string;
        // Page background.
        base: string;
        // Cards, sidebars and inputs.
        raised: string;
        // Menus, popovers, hover and selection.
        overlay: string;
    };
    text: {
        // Comments, captions and placeholders.
        muted: string;
        // Metadata and labels.
        secondary: string;
        // Body text.
        primary: string;
        // Headings and emphasized text.
        strong: string;
    };
}

// Values marked "extrapolated" are not part of the upstream scheme.
// They fill a role the scheme does not define, so the layer order holds.
export const THEME_PALETTES: ThemePalette[] = [
    {
        id: 'tokyo-night',
        name: 'Tokyo Night',
        background: {
            sunken: '#16161e',
            base: '#1a1b26',
            raised: '#292e42',
            overlay: '#414868',
        },
        text: {
            muted: '#565f89',
            secondary: '#a9b1d6',
            primary: '#c0caf5',
            strong: '#e6ebff', // extrapolated
        },
    },
    {
        id: 'tokyo-night-storm',
        name: 'Tokyo Night Storm',
        background: {
            sunken: '#1f2335',
            base: '#24283b',
            raised: '#292e42',
            overlay: '#414868',
        },
        text: {
            muted: '#565f89',
            secondary: '#a9b1d6',
            primary: '#c0caf5',
            strong: '#e6ebff', // extrapolated
        },
    },
    {
        id: 'tokyo-night-moon',
        name: 'Tokyo Night Moon',
        background: {
            sunken: '#1e2030',
            base: '#222436',
            raised: '#2f334d',
            overlay: '#444a73',
        },
        text: {
            muted: '#636da6',
            secondary: '#828bb8',
            primary: '#c8d3f5',
            strong: '#e8eeff', // extrapolated
        },
    },
    {
        id: 'dracula',
        name: 'Dracula',
        background: {
            sunken: '#21222c',
            base: '#282a36',
            raised: '#44475a',
            overlay: '#565a72', // extrapolated
        },
        text: {
            muted: '#6272a4',
            secondary: '#bfbfb8', // extrapolated
            primary: '#f8f8f2',
            strong: '#ffffff', // extrapolated
        },
    },
    {
        id: 'nord',
        name: 'Nord',
        background: {
            sunken: '#272c36', // extrapolated
            base: '#2e3440',
            raised: '#3b4252',
            overlay: '#4c566a',
        },
        text: {
            muted: '#6b7a94', // extrapolated
            secondary: '#d8dee9',
            primary: '#e5e9f0',
            strong: '#eceff4',
        },
    },
];

export function getThemePalette(id: string): ThemePalette | null {
    return THEME_PALETTES.find((palette) => palette.id === id) ?? null;
}

// Theme fields to apply when a palette is picked. The dark background and text
// colors are set to the palette's anchors so the color pickers show the result.
// An unknown id clears the palette.
export function getPaletteThemeValues(id: string): Partial<Theme> {
    const palette = getThemePalette(id);
    if (!palette) {
        return {palette: ''};
    }
    return {
        palette: palette.id,
        darkSchemeBackgroundColor: palette.background.base,
        darkSchemeTextColor: palette.text.primary,
        darkColorScheme: 'Default',
    };
}
