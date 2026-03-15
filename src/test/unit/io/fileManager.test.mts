import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FileManager } from '../../../io/fileManager.js';

describe('FileManager', () => {
  describe('getFileExtension', () => {
    const getFileExtension = (filePath: string) => {
      return (FileManager as any).getFileExtension(filePath) as string;
    };

    it('should return extension for normal files', () => {
      assert.strictEqual(getFileExtension('water.cif'), 'cif');
      assert.strictEqual(getFileExtension('test.xyz'), 'xyz');
      assert.strictEqual(getFileExtension('structure.pdb'), 'pdb');
      assert.strictEqual(getFileExtension('file.stru'), 'stru');
      assert.strictEqual(getFileExtension('data.cell'), 'cell');
    });

    it('should handle files with STRU in name but different extension', () => {
      assert.strictEqual(getFileExtension('STRU_NOW.cif'), 'cif');
      assert.strictEqual(getFileExtension('STRU_test.cell'), 'cell');
      assert.strictEqual(getFileExtension('my_STRu.xyz'), 'xyz');
    });

    it('should handle files with POSCAR in name but different extension', () => {
      assert.strictEqual(getFileExtension('POSCAR.vasp'), 'vasp');
      assert.strictEqual(getFileExtension('CONTCAR.xyz'), 'xyz');
      assert.strictEqual(getFileExtension('POSCAR_test.cif'), 'cif');
    });

    it('should handle files with XDATCAR in name but different extension', () => {
      assert.strictEqual(getFileExtension('XDATCAR_test.xyz'), 'xyz');
      assert.strictEqual(getFileExtension('XDATCAR.backup.cif'), 'cif');
    });

    it('should handle files with OUTCAR in name but different extension', () => {
      assert.strictEqual(getFileExtension('OUTCAR_test.log'), 'log');
      assert.strictEqual(getFileExtension('OUTCAR.bak.xyz'), 'xyz');
    });

    it('should handle special filenames without extension', () => {
      assert.strictEqual(getFileExtension('POSCAR'), 'poscar');
      assert.strictEqual(getFileExtension('CONTCAR'), 'poscar');
      assert.strictEqual(getFileExtension('XDATCAR'), 'xdatcar');
      assert.strictEqual(getFileExtension('OUTCAR'), 'outcar');
      assert.strictEqual(getFileExtension('STRU'), 'stru');
      assert.strictEqual(getFileExtension('STRU_123'), 'stru');
    });

    it('should handle case variations', () => {
      assert.strictEqual(getFileExtension('poscar'), 'poscar');
      assert.strictEqual(getFileExtension('XdatCar'), 'xdatcar');
      assert.strictEqual(getFileExtension('outcar'), 'outcar');
      assert.strictEqual(getFileExtension('Stru'), 'stru');
    });

    it('should handle files with path separators', () => {
      assert.strictEqual(getFileExtension('/path/to/file.cif'), 'cif');
      assert.strictEqual(getFileExtension('C:\\Users\\test\\POSCAR'), 'poscar');
      assert.strictEqual(getFileExtension('/home/user/STRU_NOW.cif'), 'cif');
    });

    it('should handle files with multiple dots', () => {
      assert.strictEqual(getFileExtension('file.name.cif'), 'cif');
      assert.strictEqual(getFileExtension('test.POSCAR.vasp'), 'vasp');
      assert.strictEqual(getFileExtension('data.STRU.cell'), 'cell');
    });

    it('should return empty string for files without extension', () => {
      assert.strictEqual(getFileExtension('README'), '');
      assert.strictEqual(getFileExtension('Makefile'), '');
      assert.strictEqual(getFileExtension('unknown'), '');
    });
  });

  describe('resolveFormat', () => {
    it('should resolve file path to format', () => {
      assert.strictEqual(FileManager.resolveFormat('water.cif'), 'cif');
      assert.strictEqual(FileManager.resolveFormat('test.xyz'), 'xyz');
      assert.strictEqual(FileManager.resolveFormat('STRU.cell'), 'cell');
    });

    it('should use fallback for unknown formats', () => {
      assert.strictEqual(FileManager.resolveFormat('unknown.xyz'), 'xyz');
      assert.strictEqual(FileManager.resolveFormat('', 'cif'), 'cif');
    });
  });
});
