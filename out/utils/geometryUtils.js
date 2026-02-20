"use strict";
/**
 * 3D geometry utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.distance = distance;
exports.dotProduct = dotProduct;
exports.crossProduct = crossProduct;
exports.magnitude = magnitude;
exports.normalize = normalize;
exports.angle = angle;
exports.centroid = centroid;
/**
 * Calculate distance between two 3D points
 */
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
/**
 * Calculate dot product of two vectors
 */
function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}
/**
 * Calculate cross product of two vectors
 */
function crossProduct(v1, v2) {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x,
    };
}
/**
 * Calculate magnitude of a vector
 */
function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
/**
 * Normalize a vector
 */
function normalize(v) {
    const mag = magnitude(v);
    if (mag === 0)
        return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}
/**
 * Calculate angle between two vectors (in radians)
 */
function angle(v1, v2) {
    const n1 = magnitude(v1);
    const n2 = magnitude(v2);
    if (n1 === 0 || n2 === 0)
        return 0;
    const dot = dotProduct(v1, v2);
    return Math.acos(dot / (n1 * n2));
}
/**
 * Calculate centroid of multiple points
 */
function centroid(points) {
    if (points.length === 0)
        return { x: 0, y: 0, z: 0 };
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
    return {
        x: sum.x / points.length,
        y: sum.y / points.length,
        z: sum.z / points.length,
    };
}
//# sourceMappingURL=geometryUtils.js.map