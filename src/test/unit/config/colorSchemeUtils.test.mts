import { expect } from 'chai';
import { Atom } from '../../../models/atom.js';
import { getColorForElement, validateHexColor, parseColor } from '../../../config/colorSchemeUtils.js';
import type { ColorScheme } from '../../../shared/protocol.js';
import type { WireDisplaySettings } from '../../../shared/protocol.js';

type DisplaySettings = Required<WireDisplaySettings>;

function createAtom(element: string, color?: string): Atom {
  return new Atom(element, 0, 0, 0, `atom_${element}_1`, color ? { color } : undefined);
}

function createColorScheme(colors: Record<string, string>): ColorScheme {
  return {
    id: 'scheme-test',
    name: 'Test Scheme',
    colors,
    isPreset: false,
    isReadOnly: false,
    version: 1,
    schemaVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createDisplaySettings(overrides: Partial<WireDisplaySettings> = {}): DisplaySettings {
  return {
    showAxes: true,
    backgroundColor: '#0d1015',
    unitCellColor: '#FF6600',
    unitCellThickness: 1,
    unitCellLineStyle: 'solid',
    currentRadiusByElement: {},
    manualScale: 1,
    autoScaleEnabled: false,
    currentRadiusScale: 1,
    bondThicknessScale: 1,
    viewZoom: 1,
    scaleAtomsWithLattice: false,
    projectionMode: 'orthographic',
    lightingEnabled: true,
    ambientIntensity: 0.5,
    ambientColor: '#ffffff',
    shininess: 50,
    keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
    fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
    rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
    currentColorScheme: 'preset-jmol-default',
    currentColorByElement: {},
    ...overrides,
  };
}

describe('colorSchemeUtils', () => {
  describe('getColorForElement', () => {
    let settings: DisplaySettings;
    let colorScheme: ColorScheme;

    beforeEach(() => {
      settings = createDisplaySettings();
      colorScheme = createColorScheme({});
    });

    it('should return atom.color when set (highest priority)', () => {
      const atom = createAtom('C', '#FF0000');
      settings = createDisplaySettings({ currentColorByElement: { C: '#00FF00' } });
      colorScheme = createColorScheme({ C: '#0000FF' });
      
      const color = getColorForElement(atom, 'C', settings, colorScheme);
      expect(color).to.equal('#FF0000');
    });

    it('should return settings.currentColorByElement when atom.color is not set', () => {
      const atom = createAtom('C');
      settings = createDisplaySettings({ currentColorByElement: { C: '#00FF00' } });
      colorScheme = createColorScheme({ C: '#0000FF' });
      
      const color = getColorForElement(atom, 'C', settings, colorScheme);
      expect(color).to.equal('#00FF00');
    });

    it('should return colorScheme.colors when atom.color and settings are not set', () => {
      const atom = createAtom('C');
      settings = createDisplaySettings({ currentColorByElement: {} });
      colorScheme = createColorScheme({ C: '#0000FF' });
      
      const color = getColorForElement(atom, 'C', settings, colorScheme);
      expect(color).to.equal('#0000FF');
    });

    it('should return fallback color when no color is set', () => {
      const atom = createAtom('C');
      settings = createDisplaySettings({ currentColorByElement: {} });
      colorScheme = createColorScheme({});
      
      const color = getColorForElement(atom, 'C', settings, colorScheme);
      expect(color).to.equal('#C0C0C0');
    });

    it('should return default fallback for unknown element', () => {
      const atom = createAtom('Xx');
      settings = createDisplaySettings({ currentColorByElement: {} });
      colorScheme = createColorScheme({});
      
      const color = getColorForElement(atom, 'Xx', settings, colorScheme);
      expect(color).to.equal('#C0C0C0');
    });

    it('should handle null colorScheme', () => {
      const atom = createAtom('C');
      settings = createDisplaySettings({ currentColorByElement: {} });
      
      const color = getColorForElement(atom, 'C', settings, null);
      expect(color).to.equal('#C0C0C0');
    });

    it('should handle empty settings', () => {
      const atom = createAtom('C');
      settings = createDisplaySettings();
      
      const color = getColorForElement(atom, 'C', settings, null);
      expect(color).to.equal('#C0C0C0');
    });
  });

  describe('validateHexColor', () => {
    it('should return true for valid 6-digit hex colors', () => {
      expect(validateHexColor('#FF0000')).to.be.true;
      expect(validateHexColor('#00FF00')).to.be.true;
      expect(validateHexColor('#0000FF')).to.be.true;
      expect(validateHexColor('#000000')).to.be.true;
      expect(validateHexColor('#FFFFFF')).to.be.true;
    });

    it('should accept lowercase hex colors', () => {
      expect(validateHexColor('#ff0000')).to.be.true;
      expect(validateHexColor('#aabbcc')).to.be.true;
    });

    it('should accept mixed case hex colors', () => {
      expect(validateHexColor('#Ff00Aa')).to.be.true;
    });

    it('should return false for invalid formats', () => {
      expect(validateHexColor('FF0000')).to.be.false;
      expect(validateHexColor('#GG0000')).to.be.false;
      expect(validateHexColor('#F00')).to.be.false;
      expect(validateHexColor('#FF000000')).to.be.false;
      expect(validateHexColor('')).to.be.false;
      expect(validateHexColor('#')).to.be.false;
    });
  });

  describe('parseColor', () => {
    it('should parse valid 6-digit hex colors', () => {
      expect(parseColor('#FF0000')).to.equal('#FF0000');
      expect(parseColor('#00FF00')).to.equal('#00FF00');
      expect(parseColor('#0000FF')).to.equal('#0000FF');
    });

    it('should normalize lowercase hex to uppercase', () => {
      expect(parseColor('#ff0000')).to.equal('#FF0000');
      expect(parseColor('#aabbcc')).to.equal('#AABBCC');
    });

    it('should parse #RGB shorthand', () => {
      expect(parseColor('#F00')).to.equal('#FF0000');
      expect(parseColor('#0F0')).to.equal('#00FF00');
      expect(parseColor('#00F')).to.equal('#0000FF');
      expect(parseColor('#ABC')).to.equal('#AABBCC');
    });

    it('should parse rgb() format', () => {
      expect(parseColor('rgb(255, 0, 0)')).to.equal('#FF0000');
      expect(parseColor('rgb(0,255,0)')).to.equal('#00FF00');
      expect(parseColor('rgb( 0 , 0 , 255 )')).to.equal('#0000FF');
      expect(parseColor('rgb(170, 187, 204)')).to.equal('#AABBCC');
    });

    it('should return null for invalid formats', () => {
      expect(parseColor('FF0000')).to.be.null;
      expect(parseColor('#GG0000')).to.be.null;
      expect(parseColor('notacolor')).to.be.null;
      expect(parseColor('')).to.be.null;
      expect(parseColor('rgb(256, 0, 0)')).to.be.null;
      expect(parseColor('rgb(-1, 0, 0)')).to.be.null;
    });

    it('should handle non-string input', () => {
      expect(parseColor(null as unknown as string)).to.be.null;
      expect(parseColor(undefined as unknown as string)).to.be.null;
      expect(parseColor(123 as unknown as string)).to.be.null;
    });

    it('should trim whitespace', () => {
      expect(parseColor('  #FF0000  ')).to.equal('#FF0000');
      expect(parseColor('  rgb(255, 0, 0)  ')).to.equal('#FF0000');
    });
  });
});
