"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ELEMENT_DATA = void 0;
exports.getElementInfo = getElementInfo;
exports.getElementSymbols = getElementSymbols;
exports.parseElement = parseElement;
const DEFAULT_COLOR = '#C0C0C0';
exports.ELEMENT_DATA = {
    H: { symbol: 'H', atomicNumber: 1, atomicMass: 1.008, covalentRadius: 0.31, vdwRadius: 1.2, color: '#FFFFFF' },
    He: { symbol: 'He', atomicNumber: 2, atomicMass: 4.0026, covalentRadius: 0.28, vdwRadius: 1.4, color: DEFAULT_COLOR },
    Li: { symbol: 'Li', atomicNumber: 3, atomicMass: 6.94, covalentRadius: 1.28, vdwRadius: 1.82, color: DEFAULT_COLOR },
    Be: { symbol: 'Be', atomicNumber: 4, atomicMass: 9.0122, covalentRadius: 0.96, vdwRadius: 1.53, color: DEFAULT_COLOR },
    B: { symbol: 'B', atomicNumber: 5, atomicMass: 10.81, covalentRadius: 0.84, vdwRadius: 1.92, color: DEFAULT_COLOR },
    C: { symbol: 'C', atomicNumber: 6, atomicMass: 12.011, covalentRadius: 0.76, vdwRadius: 1.7, color: '#909090' },
    N: { symbol: 'N', atomicNumber: 7, atomicMass: 14.007, covalentRadius: 0.71, vdwRadius: 1.55, color: '#3050F8' },
    O: { symbol: 'O', atomicNumber: 8, atomicMass: 15.999, covalentRadius: 0.66, vdwRadius: 1.52, color: '#FF0D0D' },
    F: { symbol: 'F', atomicNumber: 9, atomicMass: 18.998, covalentRadius: 0.57, vdwRadius: 1.47, color: '#90E050' },
    Ne: { symbol: 'Ne', atomicNumber: 10, atomicMass: 20.18, covalentRadius: 0.58, vdwRadius: 1.54, color: DEFAULT_COLOR },
    Na: { symbol: 'Na', atomicNumber: 11, atomicMass: 22.99, covalentRadius: 1.66, vdwRadius: 2.27, color: '#AB5CF2' },
    Mg: { symbol: 'Mg', atomicNumber: 12, atomicMass: 24.305, covalentRadius: 1.41, vdwRadius: 1.73, color: '#61B236' },
    Al: { symbol: 'Al', atomicNumber: 13, atomicMass: 26.982, covalentRadius: 1.21, vdwRadius: 1.84, color: '#BFA6A6' },
    Si: { symbol: 'Si', atomicNumber: 14, atomicMass: 28.086, covalentRadius: 1.11, vdwRadius: 2.1, color: '#F0C8A0' },
    P: { symbol: 'P', atomicNumber: 15, atomicMass: 30.974, covalentRadius: 1.07, vdwRadius: 1.8, color: '#FF8000' },
    S: { symbol: 'S', atomicNumber: 16, atomicMass: 32.06, covalentRadius: 1.05, vdwRadius: 1.8, color: '#FFFF30' },
    Cl: { symbol: 'Cl', atomicNumber: 17, atomicMass: 35.45, covalentRadius: 1.02, vdwRadius: 1.75, color: '#1FF01F' },
    Ar: { symbol: 'Ar', atomicNumber: 18, atomicMass: 39.948, covalentRadius: 1.06, vdwRadius: 1.88, color: DEFAULT_COLOR },
    K: { symbol: 'K', atomicNumber: 19, atomicMass: 39.0983, covalentRadius: 2.03, vdwRadius: 2.75, color: DEFAULT_COLOR },
    Ca: { symbol: 'Ca', atomicNumber: 20, atomicMass: 40.078, covalentRadius: 1.76, vdwRadius: 2.31, color: DEFAULT_COLOR },
    Sc: { symbol: 'Sc', atomicNumber: 21, atomicMass: 44.9559, covalentRadius: 1.7, vdwRadius: 2.3, color: DEFAULT_COLOR },
    Ti: { symbol: 'Ti', atomicNumber: 22, atomicMass: 47.867, covalentRadius: 1.6, vdwRadius: 2.15, color: DEFAULT_COLOR },
    V: { symbol: 'V', atomicNumber: 23, atomicMass: 50.9415, covalentRadius: 1.53, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Cr: { symbol: 'Cr', atomicNumber: 24, atomicMass: 51.9961, covalentRadius: 1.39, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Mn: { symbol: 'Mn', atomicNumber: 25, atomicMass: 54.938, covalentRadius: 1.39, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Fe: { symbol: 'Fe', atomicNumber: 26, atomicMass: 55.845, covalentRadius: 1.32, vdwRadius: 2.0, color: '#E06633' },
    Co: { symbol: 'Co', atomicNumber: 27, atomicMass: 58.9332, covalentRadius: 1.26, vdwRadius: 2.0, color: DEFAULT_COLOR },
    Ni: { symbol: 'Ni', atomicNumber: 28, atomicMass: 58.6934, covalentRadius: 1.24, vdwRadius: 2.0, color: DEFAULT_COLOR },
    Cu: { symbol: 'Cu', atomicNumber: 29, atomicMass: 63.546, covalentRadius: 1.32, vdwRadius: 1.4, color: '#C88033' },
    Zn: { symbol: 'Zn', atomicNumber: 30, atomicMass: 65.38, covalentRadius: 1.24, vdwRadius: 1.39, color: '#7CB8FF' },
    Ga: { symbol: 'Ga', atomicNumber: 31, atomicMass: 69.723, covalentRadius: 1.22, vdwRadius: 1.87, color: DEFAULT_COLOR },
    Ge: { symbol: 'Ge', atomicNumber: 32, atomicMass: 72.63, covalentRadius: 1.2, vdwRadius: 2.11, color: DEFAULT_COLOR },
    As: { symbol: 'As', atomicNumber: 33, atomicMass: 74.9216, covalentRadius: 1.19, vdwRadius: 1.85, color: DEFAULT_COLOR },
    Se: { symbol: 'Se', atomicNumber: 34, atomicMass: 78.971, covalentRadius: 1.2, vdwRadius: 1.9, color: DEFAULT_COLOR },
    Br: { symbol: 'Br', atomicNumber: 35, atomicMass: 79.904, covalentRadius: 1.2, vdwRadius: 1.85, color: '#A62929' },
    Kr: { symbol: 'Kr', atomicNumber: 36, atomicMass: 83.798, covalentRadius: 1.16, vdwRadius: 2.02, color: DEFAULT_COLOR },
    Rb: { symbol: 'Rb', atomicNumber: 37, atomicMass: 85.4678, covalentRadius: 2.2, vdwRadius: 3.03, color: DEFAULT_COLOR },
    Sr: { symbol: 'Sr', atomicNumber: 38, atomicMass: 87.62, covalentRadius: 1.95, vdwRadius: 2.49, color: DEFAULT_COLOR },
    Y: { symbol: 'Y', atomicNumber: 39, atomicMass: 88.9058, covalentRadius: 1.9, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Zr: { symbol: 'Zr', atomicNumber: 40, atomicMass: 91.224, covalentRadius: 1.75, vdwRadius: 2.3, color: DEFAULT_COLOR },
    Nb: { symbol: 'Nb', atomicNumber: 41, atomicMass: 92.9064, covalentRadius: 1.64, vdwRadius: 2.15, color: DEFAULT_COLOR },
    Mo: { symbol: 'Mo', atomicNumber: 42, atomicMass: 95.95, covalentRadius: 1.54, vdwRadius: 2.1, color: DEFAULT_COLOR },
    Tc: { symbol: 'Tc', atomicNumber: 43, atomicMass: 98, covalentRadius: 1.47, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Ru: { symbol: 'Ru', atomicNumber: 44, atomicMass: 101.07, covalentRadius: 1.46, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Rh: { symbol: 'Rh', atomicNumber: 45, atomicMass: 102.9055, covalentRadius: 1.42, vdwRadius: 2.0, color: DEFAULT_COLOR },
    Pd: { symbol: 'Pd', atomicNumber: 46, atomicMass: 106.42, covalentRadius: 1.39, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Ag: { symbol: 'Ag', atomicNumber: 47, atomicMass: 107.8682, covalentRadius: 1.45, vdwRadius: 2.1, color: DEFAULT_COLOR },
    Cd: { symbol: 'Cd', atomicNumber: 48, atomicMass: 112.414, covalentRadius: 1.44, vdwRadius: 2.18, color: DEFAULT_COLOR },
    In: { symbol: 'In', atomicNumber: 49, atomicMass: 114.818, covalentRadius: 1.42, vdwRadius: 1.93, color: DEFAULT_COLOR },
    Sn: { symbol: 'Sn', atomicNumber: 50, atomicMass: 118.71, covalentRadius: 1.39, vdwRadius: 2.17, color: DEFAULT_COLOR },
    Sb: { symbol: 'Sb', atomicNumber: 51, atomicMass: 121.76, covalentRadius: 1.39, vdwRadius: 2.06, color: DEFAULT_COLOR },
    Te: { symbol: 'Te', atomicNumber: 52, atomicMass: 127.6, covalentRadius: 1.38, vdwRadius: 2.06, color: DEFAULT_COLOR },
    I: { symbol: 'I', atomicNumber: 53, atomicMass: 126.904, covalentRadius: 1.39, vdwRadius: 1.98, color: '#940094' },
    Xe: { symbol: 'Xe', atomicNumber: 54, atomicMass: 131.293, covalentRadius: 1.4, vdwRadius: 2.16, color: DEFAULT_COLOR },
    Cs: { symbol: 'Cs', atomicNumber: 55, atomicMass: 132.9055, covalentRadius: 2.44, vdwRadius: 3.43, color: DEFAULT_COLOR },
    Ba: { symbol: 'Ba', atomicNumber: 56, atomicMass: 137.327, covalentRadius: 2.15, vdwRadius: 2.68, color: DEFAULT_COLOR },
    La: { symbol: 'La', atomicNumber: 57, atomicMass: 138.9055, covalentRadius: 2.07, vdwRadius: 2.5, color: DEFAULT_COLOR },
    Ce: { symbol: 'Ce', atomicNumber: 58, atomicMass: 140.116, covalentRadius: 2.04, vdwRadius: 2.48, color: DEFAULT_COLOR },
    Pr: { symbol: 'Pr', atomicNumber: 59, atomicMass: 140.9077, covalentRadius: 2.03, vdwRadius: 2.47, color: DEFAULT_COLOR },
    Nd: { symbol: 'Nd', atomicNumber: 60, atomicMass: 144.242, covalentRadius: 2.01, vdwRadius: 2.45, color: DEFAULT_COLOR },
    Pm: { symbol: 'Pm', atomicNumber: 61, atomicMass: 145, covalentRadius: 1.99, vdwRadius: 2.43, color: DEFAULT_COLOR },
    Sm: { symbol: 'Sm', atomicNumber: 62, atomicMass: 150.36, covalentRadius: 1.98, vdwRadius: 2.42, color: DEFAULT_COLOR },
    Eu: { symbol: 'Eu', atomicNumber: 63, atomicMass: 151.964, covalentRadius: 1.98, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Gd: { symbol: 'Gd', atomicNumber: 64, atomicMass: 157.25, covalentRadius: 1.96, vdwRadius: 2.38, color: DEFAULT_COLOR },
    Tb: { symbol: 'Tb', atomicNumber: 65, atomicMass: 158.9254, covalentRadius: 1.94, vdwRadius: 2.37, color: DEFAULT_COLOR },
    Dy: { symbol: 'Dy', atomicNumber: 66, atomicMass: 162.5, covalentRadius: 1.92, vdwRadius: 2.35, color: DEFAULT_COLOR },
    Ho: { symbol: 'Ho', atomicNumber: 67, atomicMass: 164.9303, covalentRadius: 1.92, vdwRadius: 2.33, color: DEFAULT_COLOR },
    Er: { symbol: 'Er', atomicNumber: 68, atomicMass: 167.259, covalentRadius: 1.89, vdwRadius: 2.32, color: DEFAULT_COLOR },
    Tm: { symbol: 'Tm', atomicNumber: 69, atomicMass: 168.9342, covalentRadius: 1.9, vdwRadius: 2.3, color: DEFAULT_COLOR },
    Yb: { symbol: 'Yb', atomicNumber: 70, atomicMass: 173.045, covalentRadius: 1.87, vdwRadius: 2.28, color: DEFAULT_COLOR },
    Lu: { symbol: 'Lu', atomicNumber: 71, atomicMass: 174.9668, covalentRadius: 1.87, vdwRadius: 2.27, color: DEFAULT_COLOR },
    Hf: { symbol: 'Hf', atomicNumber: 72, atomicMass: 178.49, covalentRadius: 1.75, vdwRadius: 2.25, color: DEFAULT_COLOR },
    Ta: { symbol: 'Ta', atomicNumber: 73, atomicMass: 180.9479, covalentRadius: 1.7, vdwRadius: 2.2, color: DEFAULT_COLOR },
    W: { symbol: 'W', atomicNumber: 74, atomicMass: 183.84, covalentRadius: 1.62, vdwRadius: 2.1, color: DEFAULT_COLOR },
    Re: { symbol: 'Re', atomicNumber: 75, atomicMass: 186.207, covalentRadius: 1.51, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Os: { symbol: 'Os', atomicNumber: 76, atomicMass: 190.23, covalentRadius: 1.44, vdwRadius: 2.0, color: DEFAULT_COLOR },
    Ir: { symbol: 'Ir', atomicNumber: 77, atomicMass: 192.217, covalentRadius: 1.41, vdwRadius: 2.0, color: DEFAULT_COLOR },
    Pt: { symbol: 'Pt', atomicNumber: 78, atomicMass: 195.084, covalentRadius: 1.36, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Au: { symbol: 'Au', atomicNumber: 79, atomicMass: 196.9666, covalentRadius: 1.36, vdwRadius: 2.1, color: DEFAULT_COLOR },
    Hg: { symbol: 'Hg', atomicNumber: 80, atomicMass: 200.592, covalentRadius: 1.32, vdwRadius: 2.05, color: DEFAULT_COLOR },
    Tl: { symbol: 'Tl', atomicNumber: 81, atomicMass: 204.38, covalentRadius: 1.45, vdwRadius: 1.96, color: DEFAULT_COLOR },
    Pb: { symbol: 'Pb', atomicNumber: 82, atomicMass: 207.2, covalentRadius: 1.46, vdwRadius: 2.02, color: DEFAULT_COLOR },
    Bi: { symbol: 'Bi', atomicNumber: 83, atomicMass: 208.9804, covalentRadius: 1.48, vdwRadius: 2.07, color: DEFAULT_COLOR },
    Po: { symbol: 'Po', atomicNumber: 84, atomicMass: 209, covalentRadius: 1.4, vdwRadius: 1.97, color: DEFAULT_COLOR },
    At: { symbol: 'At', atomicNumber: 85, atomicMass: 210, covalentRadius: 1.5, vdwRadius: 2.02, color: DEFAULT_COLOR },
    Rn: { symbol: 'Rn', atomicNumber: 86, atomicMass: 222, covalentRadius: 1.5, vdwRadius: 2.2, color: DEFAULT_COLOR },
    Fr: { symbol: 'Fr', atomicNumber: 87, atomicMass: 223, covalentRadius: 2.6, vdwRadius: 3.48, color: DEFAULT_COLOR },
    Ra: { symbol: 'Ra', atomicNumber: 88, atomicMass: 226, covalentRadius: 2.21, vdwRadius: 2.83, color: DEFAULT_COLOR },
    Ac: { symbol: 'Ac', atomicNumber: 89, atomicMass: 227, covalentRadius: 2.15, vdwRadius: 2.6, color: DEFAULT_COLOR },
    Th: { symbol: 'Th', atomicNumber: 90, atomicMass: 232.0377, covalentRadius: 2.06, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Pa: { symbol: 'Pa', atomicNumber: 91, atomicMass: 231.0359, covalentRadius: 2.0, vdwRadius: 2.4, color: DEFAULT_COLOR },
    U: { symbol: 'U', atomicNumber: 92, atomicMass: 238.0289, covalentRadius: 1.96, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Np: { symbol: 'Np', atomicNumber: 93, atomicMass: 237, covalentRadius: 1.9, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Pu: { symbol: 'Pu', atomicNumber: 94, atomicMass: 244, covalentRadius: 1.87, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Am: { symbol: 'Am', atomicNumber: 95, atomicMass: 243, covalentRadius: 1.8, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Cm: { symbol: 'Cm', atomicNumber: 96, atomicMass: 247, covalentRadius: 1.69, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Bk: { symbol: 'Bk', atomicNumber: 97, atomicMass: 247, covalentRadius: 1.68, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Cf: { symbol: 'Cf', atomicNumber: 98, atomicMass: 251, covalentRadius: 1.68, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Es: { symbol: 'Es', atomicNumber: 99, atomicMass: 252, covalentRadius: 1.65, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Fm: { symbol: 'Fm', atomicNumber: 100, atomicMass: 257, covalentRadius: 1.67, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Md: { symbol: 'Md', atomicNumber: 101, atomicMass: 258, covalentRadius: 1.73, vdwRadius: 2.4, color: DEFAULT_COLOR },
    No: { symbol: 'No', atomicNumber: 102, atomicMass: 259, covalentRadius: 1.76, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Lr: { symbol: 'Lr', atomicNumber: 103, atomicMass: 266, covalentRadius: 1.61, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Rf: { symbol: 'Rf', atomicNumber: 104, atomicMass: 267, covalentRadius: 1.57, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Db: { symbol: 'Db', atomicNumber: 105, atomicMass: 270, covalentRadius: 1.49, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Sg: { symbol: 'Sg', atomicNumber: 106, atomicMass: 271, covalentRadius: 1.43, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Bh: { symbol: 'Bh', atomicNumber: 107, atomicMass: 270, covalentRadius: 1.41, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Hs: { symbol: 'Hs', atomicNumber: 108, atomicMass: 277, covalentRadius: 1.34, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Mt: { symbol: 'Mt', atomicNumber: 109, atomicMass: 278, covalentRadius: 1.29, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Ds: { symbol: 'Ds', atomicNumber: 110, atomicMass: 281, covalentRadius: 1.28, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Rg: { symbol: 'Rg', atomicNumber: 111, atomicMass: 282, covalentRadius: 1.21, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Cn: { symbol: 'Cn', atomicNumber: 112, atomicMass: 285, covalentRadius: 1.22, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Nh: { symbol: 'Nh', atomicNumber: 113, atomicMass: 286, covalentRadius: 1.36, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Fl: { symbol: 'Fl', atomicNumber: 114, atomicMass: 289, covalentRadius: 1.43, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Mc: { symbol: 'Mc', atomicNumber: 115, atomicMass: 290, covalentRadius: 1.62, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Lv: { symbol: 'Lv', atomicNumber: 116, atomicMass: 293, covalentRadius: 1.75, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Ts: { symbol: 'Ts', atomicNumber: 117, atomicMass: 294, covalentRadius: 1.65, vdwRadius: 2.4, color: DEFAULT_COLOR },
    Og: { symbol: 'Og', atomicNumber: 118, atomicMass: 294, covalentRadius: 1.57, vdwRadius: 2.4, color: DEFAULT_COLOR },
};
/**
 * Get element info by symbol
 */
function getElementInfo(symbol) {
    return exports.ELEMENT_DATA[symbol];
}
/**
 * Get all valid element symbols
 */
function getElementSymbols() {
    return Object.keys(exports.ELEMENT_DATA);
}
/**
 * Parse element symbol from string (case-insensitive)
 */
function parseElement(input) {
    const normalized = input.trim();
    if (exports.ELEMENT_DATA[normalized]) {
        return normalized;
    }
    const title = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
    return exports.ELEMENT_DATA[title] ? title : undefined;
}
//# sourceMappingURL=elementData.js.map