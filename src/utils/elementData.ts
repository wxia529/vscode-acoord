/**
 * Element data including atomic properties
 * Note: Color schemes are defined separately in src/config/presets/color-schemes/
 */
export interface ElementInfo {
  symbol: string;
  atomicNumber: number;
  atomicMass: number;
  covalentRadius: number;
  vdwRadius: number;
}

export const ELEMENT_DATA: Record<string, ElementInfo> = {
  H: { symbol: 'H', atomicNumber: 1, atomicMass: 1.008, covalentRadius: 0.31, vdwRadius: 1.2 },
  He: { symbol: 'He', atomicNumber: 2, atomicMass: 4.0026, covalentRadius: 0.28, vdwRadius: 1.4 },
  Li: { symbol: 'Li', atomicNumber: 3, atomicMass: 6.94, covalentRadius: 1.28, vdwRadius: 1.82 },
  Be: { symbol: 'Be', atomicNumber: 4, atomicMass: 9.0122, covalentRadius: 0.96, vdwRadius: 1.53 },
  B: { symbol: 'B', atomicNumber: 5, atomicMass: 10.81, covalentRadius: 0.84, vdwRadius: 1.92 },
  C: { symbol: 'C', atomicNumber: 6, atomicMass: 12.011, covalentRadius: 0.76, vdwRadius: 1.7 },
  N: { symbol: 'N', atomicNumber: 7, atomicMass: 14.007, covalentRadius: 0.71, vdwRadius: 1.55 },
  O: { symbol: 'O', atomicNumber: 8, atomicMass: 15.999, covalentRadius: 0.66, vdwRadius: 1.52 },
  F: { symbol: 'F', atomicNumber: 9, atomicMass: 18.998, covalentRadius: 0.57, vdwRadius: 1.47 },
  Ne: { symbol: 'Ne', atomicNumber: 10, atomicMass: 20.18, covalentRadius: 0.58, vdwRadius: 1.54 },
  Na: { symbol: 'Na', atomicNumber: 11, atomicMass: 22.99, covalentRadius: 1.66, vdwRadius: 2.27 },
  Mg: { symbol: 'Mg', atomicNumber: 12, atomicMass: 24.305, covalentRadius: 1.41, vdwRadius: 1.73 },
  Al: { symbol: 'Al', atomicNumber: 13, atomicMass: 26.982, covalentRadius: 1.21, vdwRadius: 1.84 },
  Si: { symbol: 'Si', atomicNumber: 14, atomicMass: 28.086, covalentRadius: 1.11, vdwRadius: 2.1 },
  P: { symbol: 'P', atomicNumber: 15, atomicMass: 30.974, covalentRadius: 1.07, vdwRadius: 1.8 },
  S: { symbol: 'S', atomicNumber: 16, atomicMass: 32.06, covalentRadius: 1.05, vdwRadius: 1.8 },
  Cl: { symbol: 'Cl', atomicNumber: 17, atomicMass: 35.45, covalentRadius: 1.02, vdwRadius: 1.75 },
  Ar: { symbol: 'Ar', atomicNumber: 18, atomicMass: 39.948, covalentRadius: 1.06, vdwRadius: 1.88 },
  K: { symbol: 'K', atomicNumber: 19, atomicMass: 39.0983, covalentRadius: 2.03, vdwRadius: 2.75 },
  Ca: { symbol: 'Ca', atomicNumber: 20, atomicMass: 40.078, covalentRadius: 1.76, vdwRadius: 2.31 },
  Sc: { symbol: 'Sc', atomicNumber: 21, atomicMass: 44.9559, covalentRadius: 1.7, vdwRadius: 2.3 },
  Ti: { symbol: 'Ti', atomicNumber: 22, atomicMass: 47.867, covalentRadius: 1.6, vdwRadius: 2.15 },
  V: { symbol: 'V', atomicNumber: 23, atomicMass: 50.9415, covalentRadius: 1.53, vdwRadius: 2.05 },
  Cr: { symbol: 'Cr', atomicNumber: 24, atomicMass: 51.9961, covalentRadius: 1.39, vdwRadius: 2.05 },
  Mn: { symbol: 'Mn', atomicNumber: 25, atomicMass: 54.938, covalentRadius: 1.39, vdwRadius: 2.05 },
  Fe: { symbol: 'Fe', atomicNumber: 26, atomicMass: 55.845, covalentRadius: 1.32, vdwRadius: 2.0 },
  Co: { symbol: 'Co', atomicNumber: 27, atomicMass: 58.9332, covalentRadius: 1.26, vdwRadius: 2.0 },
  Ni: { symbol: 'Ni', atomicNumber: 28, atomicMass: 58.6934, covalentRadius: 1.24, vdwRadius: 2.0 },
  Cu: { symbol: 'Cu', atomicNumber: 29, atomicMass: 63.546, covalentRadius: 1.32, vdwRadius: 1.4 },
  Zn: { symbol: 'Zn', atomicNumber: 30, atomicMass: 65.38, covalentRadius: 1.24, vdwRadius: 1.39 },
  Ga: { symbol: 'Ga', atomicNumber: 31, atomicMass: 69.723, covalentRadius: 1.22, vdwRadius: 1.87 },
  Ge: { symbol: 'Ge', atomicNumber: 32, atomicMass: 72.63, covalentRadius: 1.2, vdwRadius: 2.11 },
  As: { symbol: 'As', atomicNumber: 33, atomicMass: 74.9216, covalentRadius: 1.19, vdwRadius: 1.85 },
  Se: { symbol: 'Se', atomicNumber: 34, atomicMass: 78.971, covalentRadius: 1.2, vdwRadius: 1.9 },
  Br: { symbol: 'Br', atomicNumber: 35, atomicMass: 79.904, covalentRadius: 1.2, vdwRadius: 1.85 },
  Kr: { symbol: 'Kr', atomicNumber: 36, atomicMass: 83.798, covalentRadius: 1.16, vdwRadius: 2.02 },
  Rb: { symbol: 'Rb', atomicNumber: 37, atomicMass: 85.4678, covalentRadius: 2.2, vdwRadius: 3.03 },
  Sr: { symbol: 'Sr', atomicNumber: 38, atomicMass: 87.62, covalentRadius: 1.95, vdwRadius: 2.49 },
  Y: { symbol: 'Y', atomicNumber: 39, atomicMass: 88.9058, covalentRadius: 1.9, vdwRadius: 2.4 },
  Zr: { symbol: 'Zr', atomicNumber: 40, atomicMass: 91.224, covalentRadius: 1.75, vdwRadius: 2.3 },
  Nb: { symbol: 'Nb', atomicNumber: 41, atomicMass: 92.9064, covalentRadius: 1.64, vdwRadius: 2.15 },
  Mo: { symbol: 'Mo', atomicNumber: 42, atomicMass: 95.95, covalentRadius: 1.54, vdwRadius: 2.1 },
  Tc: { symbol: 'Tc', atomicNumber: 43, atomicMass: 98, covalentRadius: 1.47, vdwRadius: 2.05 },
  Ru: { symbol: 'Ru', atomicNumber: 44, atomicMass: 101.07, covalentRadius: 1.46, vdwRadius: 2.05 },
  Rh: { symbol: 'Rh', atomicNumber: 45, atomicMass: 102.9055, covalentRadius: 1.42, vdwRadius: 2.0 },
  Pd: { symbol: 'Pd', atomicNumber: 46, atomicMass: 106.42, covalentRadius: 1.39, vdwRadius: 2.05 },
  Ag: { symbol: 'Ag', atomicNumber: 47, atomicMass: 107.8682, covalentRadius: 1.45, vdwRadius: 2.1 },
  Cd: { symbol: 'Cd', atomicNumber: 48, atomicMass: 112.414, covalentRadius: 1.44, vdwRadius: 2.18 },
  In: { symbol: 'In', atomicNumber: 49, atomicMass: 114.818, covalentRadius: 1.42, vdwRadius: 1.93 },
  Sn: { symbol: 'Sn', atomicNumber: 50, atomicMass: 118.71, covalentRadius: 1.39, vdwRadius: 2.17 },
  Sb: { symbol: 'Sb', atomicNumber: 51, atomicMass: 121.76, covalentRadius: 1.39, vdwRadius: 2.06 },
  Te: { symbol: 'Te', atomicNumber: 52, atomicMass: 127.6, covalentRadius: 1.38, vdwRadius: 2.06 },
  I: { symbol: 'I', atomicNumber: 53, atomicMass: 126.904, covalentRadius: 1.39, vdwRadius: 1.98 },
  Xe: { symbol: 'Xe', atomicNumber: 54, atomicMass: 131.293, covalentRadius: 1.4, vdwRadius: 2.16 },
  Cs: { symbol: 'Cs', atomicNumber: 55, atomicMass: 132.9055, covalentRadius: 2.44, vdwRadius: 3.43 },
  Ba: { symbol: 'Ba', atomicNumber: 56, atomicMass: 137.327, covalentRadius: 2.15, vdwRadius: 2.68 },
  La: { symbol: 'La', atomicNumber: 57, atomicMass: 138.9055, covalentRadius: 2.07, vdwRadius: 2.5 },
  Ce: { symbol: 'Ce', atomicNumber: 58, atomicMass: 140.116, covalentRadius: 2.04, vdwRadius: 2.48 },
  Pr: { symbol: 'Pr', atomicNumber: 59, atomicMass: 140.9077, covalentRadius: 2.03, vdwRadius: 2.47 },
  Nd: { symbol: 'Nd', atomicNumber: 60, atomicMass: 144.242, covalentRadius: 2.01, vdwRadius: 2.45 },
  Pm: { symbol: 'Pm', atomicNumber: 61, atomicMass: 145, covalentRadius: 1.99, vdwRadius: 2.43 },
  Sm: { symbol: 'Sm', atomicNumber: 62, atomicMass: 150.36, covalentRadius: 1.98, vdwRadius: 2.42 },
  Eu: { symbol: 'Eu', atomicNumber: 63, atomicMass: 151.964, covalentRadius: 1.98, vdwRadius: 2.4 },
  Gd: { symbol: 'Gd', atomicNumber: 64, atomicMass: 157.25, covalentRadius: 1.96, vdwRadius: 2.38 },
  Tb: { symbol: 'Tb', atomicNumber: 65, atomicMass: 158.9254, covalentRadius: 1.94, vdwRadius: 2.37 },
  Dy: { symbol: 'Dy', atomicNumber: 66, atomicMass: 162.5, covalentRadius: 1.92, vdwRadius: 2.35 },
  Ho: { symbol: 'Ho', atomicNumber: 67, atomicMass: 164.9303, covalentRadius: 1.92, vdwRadius: 2.33 },
  Er: { symbol: 'Er', atomicNumber: 68, atomicMass: 167.259, covalentRadius: 1.89, vdwRadius: 2.32 },
  Tm: { symbol: 'Tm', atomicNumber: 69, atomicMass: 168.9342, covalentRadius: 1.9, vdwRadius: 2.3 },
  Yb: { symbol: 'Yb', atomicNumber: 70, atomicMass: 173.045, covalentRadius: 1.87, vdwRadius: 2.28 },
  Lu: { symbol: 'Lu', atomicNumber: 71, atomicMass: 174.9668, covalentRadius: 1.87, vdwRadius: 2.27 },
  Hf: { symbol: 'Hf', atomicNumber: 72, atomicMass: 178.49, covalentRadius: 1.75, vdwRadius: 2.25 },
  Ta: { symbol: 'Ta', atomicNumber: 73, atomicMass: 180.9479, covalentRadius: 1.7, vdwRadius: 2.2 },
  W: { symbol: 'W', atomicNumber: 74, atomicMass: 183.84, covalentRadius: 1.62, vdwRadius: 2.1 },
  Re: { symbol: 'Re', atomicNumber: 75, atomicMass: 186.207, covalentRadius: 1.51, vdwRadius: 2.05 },
  Os: { symbol: 'Os', atomicNumber: 76, atomicMass: 190.23, covalentRadius: 1.44, vdwRadius: 2.0 },
  Ir: { symbol: 'Ir', atomicNumber: 77, atomicMass: 192.217, covalentRadius: 1.41, vdwRadius: 2.0 },
  Pt: { symbol: 'Pt', atomicNumber: 78, atomicMass: 195.084, covalentRadius: 1.36, vdwRadius: 2.05 },
  Au: { symbol: 'Au', atomicNumber: 79, atomicMass: 196.9666, covalentRadius: 1.36, vdwRadius: 2.1 },
  Hg: { symbol: 'Hg', atomicNumber: 80, atomicMass: 200.592, covalentRadius: 1.32, vdwRadius: 2.05 },
  Tl: { symbol: 'Tl', atomicNumber: 81, atomicMass: 204.38, covalentRadius: 1.45, vdwRadius: 1.96 },
  Pb: { symbol: 'Pb', atomicNumber: 82, atomicMass: 207.2, covalentRadius: 1.46, vdwRadius: 2.02 },
  Bi: { symbol: 'Bi', atomicNumber: 83, atomicMass: 208.9804, covalentRadius: 1.48, vdwRadius: 2.07 },
  Po: { symbol: 'Po', atomicNumber: 84, atomicMass: 209, covalentRadius: 1.4, vdwRadius: 1.97 },
  At: { symbol: 'At', atomicNumber: 85, atomicMass: 210, covalentRadius: 1.5, vdwRadius: 2.02 },
  Rn: { symbol: 'Rn', atomicNumber: 86, atomicMass: 222, covalentRadius: 1.5, vdwRadius: 2.2 },
  Fr: { symbol: 'Fr', atomicNumber: 87, atomicMass: 223, covalentRadius: 2.6, vdwRadius: 3.48 },
  Ra: { symbol: 'Ra', atomicNumber: 88, atomicMass: 226, covalentRadius: 2.21, vdwRadius: 2.83 },
  Ac: { symbol: 'Ac', atomicNumber: 89, atomicMass: 227, covalentRadius: 2.15, vdwRadius: 2.6 },
  Th: { symbol: 'Th', atomicNumber: 90, atomicMass: 232.0377, covalentRadius: 2.06, vdwRadius: 2.4 },
  Pa: { symbol: 'Pa', atomicNumber: 91, atomicMass: 231.0359, covalentRadius: 2.0, vdwRadius: 2.4 },
  U: { symbol: 'U', atomicNumber: 92, atomicMass: 238.0289, covalentRadius: 1.96, vdwRadius: 2.4 },
  Np: { symbol: 'Np', atomicNumber: 93, atomicMass: 237, covalentRadius: 1.9, vdwRadius: 2.4 },
  Pu: { symbol: 'Pu', atomicNumber: 94, atomicMass: 244, covalentRadius: 1.87, vdwRadius: 2.4 },
  Am: { symbol: 'Am', atomicNumber: 95, atomicMass: 243, covalentRadius: 1.8, vdwRadius: 2.4 },
  Cm: { symbol: 'Cm', atomicNumber: 96, atomicMass: 247, covalentRadius: 1.69, vdwRadius: 2.4 },
  Bk: { symbol: 'Bk', atomicNumber: 97, atomicMass: 247, covalentRadius: 1.68, vdwRadius: 2.4 },
  Cf: { symbol: 'Cf', atomicNumber: 98, atomicMass: 251, covalentRadius: 1.68, vdwRadius: 2.4 },
  Es: { symbol: 'Es', atomicNumber: 99, atomicMass: 252, covalentRadius: 1.65, vdwRadius: 2.4 },
  Fm: { symbol: 'Fm', atomicNumber: 100, atomicMass: 257, covalentRadius: 1.67, vdwRadius: 2.4 },
  Md: { symbol: 'Md', atomicNumber: 101, atomicMass: 258, covalentRadius: 1.73, vdwRadius: 2.4 },
  No: { symbol: 'No', atomicNumber: 102, atomicMass: 259, covalentRadius: 1.76, vdwRadius: 2.4 },
  Lr: { symbol: 'Lr', atomicNumber: 103, atomicMass: 266, covalentRadius: 1.61, vdwRadius: 2.4 },
  Rf: { symbol: 'Rf', atomicNumber: 104, atomicMass: 267, covalentRadius: 1.57, vdwRadius: 2.4 },
  Db: { symbol: 'Db', atomicNumber: 105, atomicMass: 270, covalentRadius: 1.49, vdwRadius: 2.4 },
  Sg: { symbol: 'Sg', atomicNumber: 106, atomicMass: 271, covalentRadius: 1.43, vdwRadius: 2.4 },
  Bh: { symbol: 'Bh', atomicNumber: 107, atomicMass: 270, covalentRadius: 1.41, vdwRadius: 2.4 },
  Hs: { symbol: 'Hs', atomicNumber: 108, atomicMass: 277, covalentRadius: 1.34, vdwRadius: 2.4 },
  Mt: { symbol: 'Mt', atomicNumber: 109, atomicMass: 278, covalentRadius: 1.29, vdwRadius: 2.4 },
  Ds: { symbol: 'Ds', atomicNumber: 110, atomicMass: 281, covalentRadius: 1.28, vdwRadius: 2.4 },
  Rg: { symbol: 'Rg', atomicNumber: 111, atomicMass: 282, covalentRadius: 1.21, vdwRadius: 2.4 },
  Cn: { symbol: 'Cn', atomicNumber: 112, atomicMass: 285, covalentRadius: 1.22, vdwRadius: 2.4 },
  Nh: { symbol: 'Nh', atomicNumber: 113, atomicMass: 286, covalentRadius: 1.36, vdwRadius: 2.4 },
  Fl: { symbol: 'Fl', atomicNumber: 114, atomicMass: 289, covalentRadius: 1.43, vdwRadius: 2.4 },
  Mc: { symbol: 'Mc', atomicNumber: 115, atomicMass: 290, covalentRadius: 1.62, vdwRadius: 2.4 },
  Lv: { symbol: 'Lv', atomicNumber: 116, atomicMass: 293, covalentRadius: 1.75, vdwRadius: 2.4 },
  Ts: { symbol: 'Ts', atomicNumber: 117, atomicMass: 294, covalentRadius: 1.65, vdwRadius: 2.4 },
  Og: { symbol: 'Og', atomicNumber: 118, atomicMass: 294, covalentRadius: 1.57, vdwRadius: 2.4 },
};

export const DEFAULT_NUMERICAL_ORBITALS: Record<string, string> = {
  Ag: 'Ag_gga_7au_100Ry_4s2p2d1f.orb',
  Al: 'Al_gga_7au_100Ry_4s4p1d.orb',
  Ar: 'Ar_gga_7au_100Ry_2s2p1d.orb',
  As: 'As_gga_7au_100Ry_2s2p1d.orb',
  Au: 'Au_gga_7au_100Ry_4s2p2d1f.orb',
  Ba: 'Ba_gga_10au_100Ry_4s2p2d1f.orb',
  Be: 'Be_gga_7au_100Ry_4s1p.orb',
  B: 'B_gga_8au_100Ry_2s2p1d.orb',
  Bi: 'Bi_gga_7au_100Ry_2s2p2d1f.orb',
  Br: 'Br_gga_7au_100Ry_2s2p1d.orb',
  C: 'C_gga_7au_100Ry_2s2p1d.orb',
  Ca: 'Ca_gga_9au_100Ry_4s2p1d.orb',
  Cd: 'Cd_gga_7au_100Ry_4s2p2d1f.orb',
  Cl: 'Cl_gga_7au_100Ry_2s2p1d.orb',
  Co: 'Co_gga_8au_100Ry_4s2p2d1f.orb',
  Cr: 'Cr_gga_8au_100Ry_4s2p2d1f.orb',
  Cs: 'Cs_gga_10au_100Ry_4s2p1d.orb',
  Cu: 'Cu_gga_8au_100Ry_4s2p2d1f.orb',
  F: 'F_gga_7au_100Ry_2s2p1d.orb',
  Fe: 'Fe_gga_8au_100Ry_4s2p2d1f.orb',
  Ga: 'Ga_gga_8au_100Ry_2s2p2d1f.orb',
  Ge: 'Ge_gga_8au_100Ry_2s2p2d1f.orb',
  H: 'H_gga_6au_100Ry_2s1p.orb',
  He: 'He_gga_6au_100Ry_2s1p.orb',
  Hf: 'Hf_gga_7au_100Ry_4s2p2d2f1g.orb',
  Hg: 'Hg_gga_9au_100Ry_4s2p2d1f.orb',
  I: 'I_gga_7au_100Ry_2s2p2d1f.orb',
  In: 'In_gga_7au_100Ry_2s2p2d1f.orb',
  Ir: 'Ir_gga_7au_100Ry_4s2p2d1f.orb',
  K: 'K_gga_9au_100Ry_4s2p1d.orb',
  Kr: 'Kr_gga_7au_100Ry_2s2p1d.orb',
  Li: 'Li_gga_7au_100Ry_4s1p.orb',
  Mg: 'Mg_gga_8au_100Ry_4s2p1d.orb',
  Mn: 'Mn_gga_8au_100Ry_4s2p2d1f.orb',
  Mo: 'Mo_gga_7au_100Ry_4s2p2d1f.orb',
  N: 'N_gga_7au_100Ry_2s2p1d.orb',
  Na: 'Na_gga_8au_100Ry_4s2p1d.orb',
  Nb: 'Nb_gga_8au_100Ry_4s2p2d1f.orb',
  Ne: 'Ne_gga_6au_100Ry_2s2p1d.orb',
  Ni: 'Ni_gga_8au_100Ry_4s2p2d1f.orb',
  O: 'O_gga_7au_100Ry_2s2p1d.orb',
  Os: 'Os_gga_7au_100Ry_4s2p2d1f.orb',
  P: 'P_gga_7au_100Ry_2s2p1d.orb',
  Pb: 'Pb_gga_7au_100Ry_2s2p2d1f.orb',
  Pd: 'Pd_gga_7au_100Ry_4s2p2d1f.orb',
  Pt: 'Pt_gga_7au_100Ry_4s2p2d1f.orb',
  Rb: 'Rb_gga_10au_100Ry_4s2p1d.orb',
  Re: 'Re_gga_7au_100Ry_4s2p2d1f.orb',
  Rh: 'Rh_gga_7au_100Ry_4s2p2d1f.orb',
  Ru: 'Ru_gga_7au_100Ry_4s2p2d1f.orb',
  S: 'S_gga_7au_100Ry_2s2p1d.orb',
  Sb: 'Sb_gga_7au_100Ry_2s2p2d1f.orb',
  Sc: 'Sc_gga_8au_100Ry_4s2p2d1f.orb',
  Se: 'Se_gga_8au_100Ry_2s2p1d.orb',
  Si: 'Si_gga_7au_100Ry_2s2p1d.orb',
  Sn: 'Sn_gga_7au_100Ry_2s2p2d1f.orb',
  Sr: 'Sr_gga_9au_100Ry_4s2p1d.orb',
  Ta: 'Ta_gga_8au_100Ry_4s2p2d2f1g.orb',
  Tc: 'Tc_gga_7au_100Ry_4s2p2d1f.orb',
  Te: 'Te_gga_7au_100Ry_2s2p2d1f.orb',
  Ti: 'Ti_gga_8au_100Ry_4s2p2d1f.orb',
  Tl: 'Tl_gga_7au_100Ry_2s2p2d1f.orb',
  V: 'V_gga_8au_100Ry_4s2p2d1f.orb',
  W: 'W_gga_8au_100Ry_4s2p2d2f1g.orb',
  Xe: 'Xe_gga_8au_100Ry_2s2p2d1f.orb',
  Y: 'Y_gga_8au_100Ry_4s2p2d1f.orb',
  Zn: 'Zn_gga_8au_100Ry_4s2p2d1f.orb',
  Zr: 'Zr_gga_8au_100Ry_4s2p2d1f.orb',
};

/**
 * Get element info by symbol
 */
export function getElementInfo(symbol: string): ElementInfo | undefined {
  return ELEMENT_DATA[symbol];
}

/**
 * Get all valid element symbols
 */
export function getElementSymbols(): string[] {
  return Object.keys(ELEMENT_DATA);
}

/**
 * Parse element symbol from string (case-insensitive)
 */
export function parseElement(input: string): string | undefined {
  const normalized = input.trim();
  if (ELEMENT_DATA[normalized]) {
    return normalized;
  }
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ELEMENT_DATA[title] ? title : undefined;
}

const DEFAULT_RADIUS = 1.0;

/**
 * Visual radius scale factor applied to covalent radii for default atom sizes.
 * 
 * Covalent radii represent physical bond lengths, but for visualization we need
 * smaller values to show atoms as distinct spheres with visible gaps between them.
 * A scale of 0.35 provides good visual separation while maintaining relative sizes.
 * 
 * This factor is ONLY applied when generating default radii for atoms that don't
 * have user-specified values (e.g., when parsing XYZ/POSCAR files, or when .acoord
 * file omits the radius field). User-specified radii (from .acoord or setAtomRadius)
 * are used directly without additional scaling.
 * 
 * Related: DisplaySettings.currentRadiusScale allows additional user-controlled scaling
 * when applying display settings to atoms.
 */
const VISUAL_RADIUS_SCALE = 0.35;

/**
 * Get the default visual radius for an element.
 * 
 * Returns the covalent radius scaled by VISUAL_RADIUS_SCALE for visualization.
 * This provides a good default for atoms without user-specified radii.
 * 
 * Note: This is used when parsing formats that don't support radius (XYZ, POSCAR, etc.)
 * or when .acoord files omit the radius field. For .acoord files with explicit radii,
 * those values are used directly (see acoordParser.ts).
 * 
 * @param element - Element symbol (e.g., "C", "H", "O")
 * @returns Default visual radius in Angstroms, scaled for display
 */
export function getDefaultAtomRadius(element: string): number {
  const info = ELEMENT_DATA[element];
  if (info?.covalentRadius) {
    return Math.max(info.covalentRadius * VISUAL_RADIUS_SCALE, 0.1);
  }
  return DEFAULT_RADIUS * VISUAL_RADIUS_SCALE;
}
