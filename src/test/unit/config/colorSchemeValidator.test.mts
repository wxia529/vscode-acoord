import { expect } from 'chai';
import { ColorSchemeValidator } from '../../../config/colorSchemeValidator.js';
import type { WireColorScheme } from '../../../shared/protocol.js';

describe('ColorSchemeValidator', () => {
  let validator: ColorSchemeValidator;

  beforeEach(() => {
    validator = new ColorSchemeValidator();
  });

  describe('validate', () => {
    it('should accept valid color scheme with all required fields', () => {
      const scheme: WireColorScheme = {
        id: 'scheme-test-1',
        name: 'Test Scheme',
        colors: {
          C: '#000000',
          O: '#FF0000',
          H: '#FFFFFF',
        },
      };
      const result = validator.validate(scheme);
      expect(result.valid).to.be.true;
      expect(result.errors).to.deep.equal([]);
    });

    it('should accept valid color scheme with description', () => {
      const scheme: WireColorScheme = {
        id: 'scheme-test-2',
        name: 'Test Scheme',
        description: 'A test color scheme',
        colors: { C: '#000000' },
      };
      const result = validator.validate(scheme);
      expect(result.valid).to.be.true;
    });

    it('should reject scheme with missing id', () => {
      const scheme = {
        name: 'Test Scheme',
        colors: { C: '#000000' },
      } as unknown as WireColorScheme;
      const result = validator.validate(scheme);
      expect(result.valid).to.be.false;
      expect(result.errors.join(' ')).to.include('id');
    });

    it('should reject scheme with missing name', () => {
      const scheme = {
        id: 'scheme-test',
        colors: { C: '#000000' },
      } as unknown as WireColorScheme;
      const result = validator.validate(scheme);
      expect(result.valid).to.be.false;
      expect(result.errors.join(' ')).to.include('name');
    });

    it('should reject scheme with empty name', () => {
      const scheme: WireColorScheme = {
        id: 'scheme-test',
        name: '',
        colors: { C: '#000000' },
      };
      const result = validator.validate(scheme);
      expect(result.valid).to.be.false;
      expect(result.errors.join(' ')).to.include('name');
    });

    it('should reject scheme with missing colors', () => {
      const scheme = {
        id: 'scheme-test',
        name: 'Test',
      } as unknown as WireColorScheme;
      const result = validator.validate(scheme);
      expect(result.valid).to.be.false;
      expect(result.errors.join(' ')).to.include('colors');
    });

    it('should accept scheme with empty colors (valid but useless)', () => {
      const scheme: WireColorScheme = {
        id: 'scheme-test',
        name: 'Test',
        colors: {},
      };
      const result = validator.validate(scheme);
      expect(result.valid).to.be.true;
    });
  });

  describe('validateColors', () => {
    it('should return empty array for valid colors', () => {
      const colors = { C: '#000000', O: '#FF0000', H: '#FFFFFF' };
      const errors = validator.validateColors(colors);
      expect(errors).to.deep.equal([]);
    });

    it('should report invalid element symbol', () => {
      const colors = { '123': '#000000' };
      const errors = validator.validateColors(colors);
      expect(errors.length).to.be.greaterThan(0);
      expect(errors.join(' ')).to.include('element symbol');
    });

    it('should report invalid color format', () => {
      const colors = { C: 'notacolor' };
      const errors = validator.validateColors(colors);
      expect(errors.length).to.be.greaterThan(0);
      expect(errors.join(' ')).to.include('Invalid color');
    });
  });

  describe('normalizeColor', () => {
    it('should accept valid hex color uppercase', () => {
      expect(validator.normalizeColor('#FF0000')).to.equal('#FF0000');
      expect(validator.normalizeColor('#00FF00')).to.equal('#00FF00');
      expect(validator.normalizeColor('#0000FF')).to.equal('#0000FF');
    });

    it('should accept valid hex color lowercase', () => {
      expect(validator.normalizeColor('#ff0000')).to.equal('#FF0000');
      expect(validator.normalizeColor('#00ff00')).to.equal('#00FF00');
    });

    it('should accept mixed case hex color', () => {
      expect(validator.normalizeColor('#Ff00Aa')).to.equal('#FF00AA');
    });

    it('should accept #RGB shorthand', () => {
      expect(validator.normalizeColor('#F00')).to.equal('#FF0000');
      expect(validator.normalizeColor('#0F0')).to.equal('#00FF00');
      expect(validator.normalizeColor('#00F')).to.equal('#0000FF');
    });

    it('should accept rgb() format', () => {
      expect(validator.normalizeColor('rgb(255, 0, 0)')).to.equal('#FF0000');
      expect(validator.normalizeColor('rgb(0,255,0)')).to.equal('#00FF00');
      expect(validator.normalizeColor('rgb( 0 , 0 , 255 )')).to.equal('#0000FF');
    });

    it('should reject color without hash', () => {
      expect(validator.normalizeColor('FF0000')).to.be.null;
    });

    it('should reject color with invalid characters', () => {
      expect(validator.normalizeColor('#GG0000')).to.be.null;
      expect(validator.normalizeColor('#FF000G')).to.be.null;
    });

    it('should reject color with wrong length', () => {
      expect(validator.normalizeColor('#F000')).to.be.null;
      expect(validator.normalizeColor('#FF000000')).to.be.null;
      expect(validator.normalizeColor('#')).to.be.null;
    });

    it('should reject rgb with out-of-range values', () => {
      expect(validator.normalizeColor('rgb(256, 0, 0)')).to.be.null;
      expect(validator.normalizeColor('rgb(0, -1, 0)')).to.be.null;
    });

    it('should reject non-string values', () => {
      expect(validator.normalizeColor(null as unknown as string)).to.be.null;
      expect(validator.normalizeColor(undefined as unknown as string)).to.be.null;
      expect(validator.normalizeColor(123 as unknown as string)).to.be.null;
    });
  });

  describe('validateHexColor', () => {
    it('should return true for valid hex colors', () => {
      expect(validator.validateHexColor('#FF0000')).to.be.true;
      expect(validator.validateHexColor('#ff0000')).to.be.true;
      expect(validator.validateHexColor('#F00')).to.be.true;
    });

    it('should return false for invalid hex colors', () => {
      expect(validator.validateHexColor('FF0000')).to.be.false;
      expect(validator.validateHexColor('#GG0000')).to.be.false;
      expect(validator.validateHexColor('notacolor')).to.be.false;
    });
  });

  describe('parseColor', () => {
    it('should parse hex colors', () => {
      expect(validator.parseColor('#FF0000')).to.equal('#FF0000');
    });

    it('should parse rgb colors', () => {
      expect(validator.parseColor('rgb(255, 0, 0)')).to.equal('#FF0000');
    });

    it('should return null for invalid colors', () => {
      expect(validator.parseColor('invalid')).to.be.null;
    });
  });
});
