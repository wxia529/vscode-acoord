/**
 * Represents a crystallographic unit cell
 */
export class UnitCell {
  a: number; // angstroms
  b: number;
  c: number;
  alpha: number; // degrees
  beta: number;
  gamma: number;

  constructor(
    a: number = 1.0,
    b: number = 1.0,
    c: number = 1.0,
    alpha: number = 90.0,
    beta: number = 90.0,
    gamma: number = 90.0
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;
  }

  /**
   * Get lattice parameters
   */
  getParameters(): [number, number, number, number, number, number] {
    return [this.a, this.b, this.c, this.alpha, this.beta, this.gamma];
  }

  /**
   * Get volume in cubic angstroms
   * Formula: V = a·b·c · sqrt(1 - cos²α - cos²β - cos²γ + 2·cosα·cosβ·cosγ)
   */
  getVolume(): number {
    const alphaRad = (this.alpha * Math.PI) / 180;
    const betaRad = (this.beta * Math.PI) / 180;
    const gammaRad = (this.gamma * Math.PI) / 180;

    const ca = Math.cos(alphaRad);
    const cb = Math.cos(betaRad);
    const cg = Math.cos(gammaRad);

    return (
      this.a *
      this.b *
      this.c *
      Math.sqrt(1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg)
    );
  }

  /**
   * Get lattice vectors
   */
  getLatticeVectors(): number[][] {
    const alphaRad = (this.alpha * Math.PI) / 180;
    const betaRad = (this.beta * Math.PI) / 180;
    const gammaRad = (this.gamma * Math.PI) / 180;

    const ca = Math.cos(alphaRad);
    const cb = Math.cos(betaRad);
    const cg = Math.cos(gammaRad);

    const a_vec = [this.a, 0, 0];
    const b_vec = [
      this.b * Math.cos(gammaRad),
      this.b * Math.sin(gammaRad),
      0,
    ];

    const c_x =
      this.c * Math.cos(betaRad);
    const c_y =
      (this.c *
        (Math.cos(alphaRad) - Math.cos(betaRad) * Math.cos(gammaRad))) /
      Math.sin(gammaRad);
    const c_z_sq = this.c * this.c - c_x * c_x - c_y * c_y;

    if (c_z_sq < 0 || c_z_sq !== c_z_sq) {
      throw new Error(
        `Invalid unit cell parameters: lattice vector c has imaginary component. ` +
        `Check that angles are valid (not 0°, 180°, or outside 0-180° range).`
      );
    }

    const c_z = Math.sqrt(c_z_sq);

    const c_vec = [c_x, c_y, c_z];

    return [a_vec, b_vec, c_vec];
  }

  /**
   * Convert cartesian coordinates to fractional coordinates
   */
  cartesianToFractional(x: number, y: number, z: number): [number, number, number] {
    const [aVec, bVec, cVec] = this.getLatticeVectors();
    const m00 = aVec[0], m01 = bVec[0], m02 = cVec[0];
    const m10 = aVec[1], m11 = bVec[1], m12 = cVec[1];
    const m20 = aVec[2], m21 = bVec[2], m22 = cVec[2];

    const det =
      m00 * (m11 * m22 - m12 * m21) -
      m01 * (m10 * m22 - m12 * m20) +
      m02 * (m10 * m21 - m11 * m20);

    if (Math.abs(det) < 1e-12) {
      return [x, y, z];
    }

    const inv00 = (m11 * m22 - m12 * m21) / det;
    const inv01 = (m02 * m21 - m01 * m22) / det;
    const inv02 = (m01 * m12 - m02 * m11) / det;
    const inv10 = (m12 * m20 - m10 * m22) / det;
    const inv11 = (m00 * m22 - m02 * m20) / det;
    const inv12 = (m02 * m10 - m00 * m12) / det;
    const inv20 = (m10 * m21 - m11 * m20) / det;
    const inv21 = (m01 * m20 - m00 * m21) / det;
    const inv22 = (m00 * m11 - m01 * m10) / det;

    const fx = inv00 * x + inv01 * y + inv02 * z;
    const fy = inv10 * x + inv11 * y + inv12 * z;
    const fz = inv20 * x + inv21 * y + inv22 * z;
    return [fx, fy, fz];
  }

  /**
   * Convert fractional coordinates to cartesian coordinates
   */
  fractionalToCartesian(fx: number, fy: number, fz: number): [number, number, number] {
    const [aVec, bVec, cVec] = this.getLatticeVectors();
    const x = fx * aVec[0] + fy * bVec[0] + fz * cVec[0];
    const y = fx * aVec[1] + fy * bVec[1] + fz * cVec[1];
    const z = fx * aVec[2] + fy * bVec[2] + fz * cVec[2];
    return [x, y, z];
  }

  /**
   * Construct a UnitCell from three lattice vectors.
   * Each vector is [x, y, z] in Angstroms.
   * This is the canonical way to build a UnitCell from parsed data and
   * eliminates the duplicate `unitCellFromVectors` helpers scattered across parsers.
   */
  static fromVectors(vectors: number[][]): UnitCell {
    const [a, b, c] = vectors;
    const cellA = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    const cellB = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
    const cellC = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);

    const cosAlpha = (b[0] * c[0] + b[1] * c[1] + b[2] * c[2]) / (cellB * cellC);
    const cosBeta  = (a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) / (cellA * cellC);
    const cosGamma = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (cellA * cellB);

    const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha))) * (180 / Math.PI);
    const beta  = Math.acos(Math.max(-1, Math.min(1, cosBeta)))  * (180 / Math.PI);
    const gamma = Math.acos(Math.max(-1, Math.min(1, cosGamma))) * (180 / Math.PI);

    return new UnitCell(cellA, cellB, cellC, alpha, beta, gamma);
  }

  /**
   * Clone this unit cell
   */
  clone(): UnitCell {
    return new UnitCell(
      this.a,
      this.b,
      this.c,
      this.alpha,
      this.beta,
      this.gamma
    );
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      a: this.a,
      b: this.b,
      c: this.c,
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
    };
  }
}
