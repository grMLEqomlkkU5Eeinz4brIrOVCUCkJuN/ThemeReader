import {m} from 'malevic';

import type {Theme} from '../../../../definitions';
import {THEME_PALETTES, getPaletteThemeValues} from '../../../../generators/palettes';
import type {ParsedColorSchemeConfig} from '../../../../utils/colorscheme-parser';
import {DropDown} from '../../../controls';

interface ColorSettingsProps {
    theme: Theme;
    colorSchemes: ParsedColorSchemeConfig;
    onChange: (config: Partial<Theme>) => void;
}

export default function ColorSettings({theme, colorSchemes, onChange}: ColorSettingsProps) {
    const paletteOptions = [
        {id: '', content: 'None'},
        ...THEME_PALETTES.map((palette) => ({id: palette.id, content: palette.name})),
    ];

    const schemeOptions = Object.keys(colorSchemes.dark)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({id: name, content: name}));

    function onSchemeChange(name: string) {
        const scheme = colorSchemes.dark[name];
        onChange({
            palette: '',
            darkColorScheme: name,
            darkSchemeBackgroundColor: scheme.backgroundColor,
            darkSchemeTextColor: scheme.textColor,
        });
    }

    return (
        <div class="color-settings">
            <div class="color-settings__item">
                <DropDown
                    selected={theme.palette}
                    options={paletteOptions}
                    onChange={(id: string) => onChange(getPaletteThemeValues(id))}
                />
                <label class="color-settings__label">Palette</label>
            </div>
            <div class="color-settings__item">
                <DropDown
                    selected={theme.darkColorScheme}
                    options={schemeOptions}
                    onChange={onSchemeChange}
                />
                <label class="color-settings__label">Color scheme</label>
            </div>
        </div>
    );
}
