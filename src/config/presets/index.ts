import { DisplayConfig } from '../types';
import { DEFAULT_PRESET } from './default';
import { SCIENTIFIC_PRESET } from './scientific';
import { DARK_PRESET } from './dark';
import { PRESENTATION_PRESET } from './presentation';
import { MINIMAL_PRESET } from './minimal';

export const BUILTIN_PRESETS: DisplayConfig[] = [
  DEFAULT_PRESET,
  SCIENTIFIC_PRESET,
  DARK_PRESET,
  PRESENTATION_PRESET,
  MINIMAL_PRESET
];

export {
  DEFAULT_PRESET,
  SCIENTIFIC_PRESET,
  DARK_PRESET,
  PRESENTATION_PRESET,
  MINIMAL_PRESET
};
