import { ColorScheme } from '../../../shared/protocol.js';
import { JMOL_COLOR_SCHEME } from './jmol-color.js';
import { BRIGHT_SCHEME } from './bright.js';

export { JMOL_COLOR_SCHEME } from './jmol-color.js';
export { BRIGHT_SCHEME } from './bright.js';

export const BUILTIN_COLOR_SCHEMES: ColorScheme[] = [
  BRIGHT_SCHEME,
  JMOL_COLOR_SCHEME
];
