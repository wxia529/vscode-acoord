import * as assert from 'assert';
import { XDATCARParser } from '../io/parsers/xdatcarParser';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('XDATCAR direct configuration frames parse correctly', () => {
		const parser = new XDATCARParser();
		const content = [
			'test system',
			'1.0',
			'1 0 0',
			'0 1 0',
			'0 0 1',
			'H',
			'2',
			'Direct configuration=     1',
			'0.00000000 0.00000000 0.00000000',
			'0.50000000 0.50000000 0.50000000',
			'Direct configuration=     2',
			'0.10000000 0.00000000 0.00000000',
			'0.60000000 0.50000000 0.50000000',
		].join('\n');

		const frames = parser.parseTrajectory(content);
		assert.strictEqual(frames.length, 2);
		assert.strictEqual(frames[0].atoms.length, 2);
		assert.ok(Math.abs(frames[1].atoms[0].x - 0.1) < 1e-8);
	});
});
