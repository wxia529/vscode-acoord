import { ColorScheme } from '../../../shared/protocol.js';
import { JMOL_DEFAULT_SCHEME } from './jmol-default.js';
import { BRIGHT_SCHEME } from './bright.js';

export { JMOL_DEFAULT_SCHEME } from './jmol-default.js';
export { BRIGHT_SCHEME } from './bright.js';

export const BUILTIN_COLOR_SCHEMES: ColorScheme[] = [
  JMOL_DEFAULT_SCHEME,
  BRIGHT_SCHEME
];
