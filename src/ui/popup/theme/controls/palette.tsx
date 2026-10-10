import {m} from 'malevic';

import {THEME_PALETTES} from '../../../../generators/palettes';
import {DropDown} from '../../../controls';

import ThemeControl from './theme-control';

interface PaletteDropDownProps {
    selected: string;
    onChange: (id: string) => void;
}

export default function PaletteDropDown(props: PaletteDropDownProps) {
    const options = [
        {id: '', content: 'None'},
        ...THEME_PALETTES.map((palette) => ({id: palette.id, content: palette.name})),
    ];

    return (
        <ThemeControl label="Palette">
            <DropDown
                selected={props.selected}
                options={options}
                onChange={props.onChange}
            />
        </ThemeControl>
    );
}
