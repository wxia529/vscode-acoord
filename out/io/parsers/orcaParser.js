"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORCAParser = void 0;
const structure_1 = require("../../models/structure");
const atom_1 = require("../../models/atom");
const elementData_1 = require("../../utils/elementData");
/**
 * ORCA input file parser (.inp)
 * Minimal support: * xyz charge mult ... *
 * Lattice data (if any) is ignored.
 */
class ORCAParser {
    parse(content) {
        const lines = content.split(/\r?\n/);
        const startIndex = lines.findIndex((line) => /^\*\s*xyz\b/i.test(line.trim()));
        if (startIndex < 0) {
            throw new Error('Invalid ORCA input: missing "* xyz" block');
        }
        const structure = new structure_1.Structure('Imported ORCA');
        for (let i = startIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                continue;
            }
            if (line.startsWith('*')) {
                break;
            }
            const parts = line.split(/\s+/);
            if (parts.length < 4) {
                continue;
            }
            const element = (0, elementData_1.parseElement)(parts[0]);
            if (!element) {
                continue;
            }
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                continue;
            }
            structure.addAtom(new atom_1.Atom(element, x, y, z));
        }
        return structure;
    }
    serialize(structure) {
        const lines = [];
        lines.push('! B3LYP D3 def2-SVP');
        lines.push('%maxcore     8192');
        lines.push('%pal nprocs   8 end');
        lines.push('* xyz 0 1');
        for (const atom of structure.atoms) {
            lines.push(`${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`);
        }
        lines.push('*');
        return lines.join('\n');
    }
}
exports.ORCAParser = ORCAParser;
//# sourceMappingURL=orcaParser.js.map