import { WinderMachine } from '../machine';
import { ILayerParameters, TGeodesicLayer } from './planner_types';
import { ECoordinateAxes } from '../global_types';
import { radToDeg } from './helpers';
import * as fs from 'fs';

/**
 * Calculates the geodesic path based on the 3D coordinates.
 * @param {number[]} X - X-coordinates.
 * @param {number[]} Y - Y-coordinates.
 * @param {number[]} Z - Z-coordinates.
 * @param {number} numTurns - Number of turns for the geodesic path.
 * @returns {number[][]} - The geodesic path as an array of [x, y, z] points.
 */
function calculateGeodesicPath(X: number[], Y: number[], Z: number[], numTurns: number): number[][] {
    const geodesicPath: number[][] = [];
    const numPoints = X.length; // Number of points on the geodesic path

    // Calculate the length of the polyline (height of the cone)
    const height = Y[Y.length - 1] - Y[0];

    // Parametric equations for a helical geodesic path on a cone
    for (let i = 0; i < numPoints; i++) {
        const y = Y[0] + (i / (numPoints - 1)) * height;
        const radius = interpolateRadius(X, Y, Z, y);
        const theta = 2 * Math.PI * numTurns * (i / numPoints);
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        geodesicPath.push([x, y, z]);
    }

    return geodesicPath;
}

// Export the geodesic path to a JSON file
function exportGeodesicPath(geodesicPath: number[][]): void {
    fs.writeFileSync('geodesic_path.json', JSON.stringify(geodesicPath, null, 2));
}

// Update the planGeodesicWind function
export function planGeodesicWind(machine: WinderMachine, layerParameters: ILayerParameters<TGeodesicLayer>): void {
    const numPoints = layerParameters.parameters.numPoints; // Number of points for smoother geodesic path
    const numTurns = layerParameters.parameters.numTurns; // Number of turns for the geodesic path

    // Log the received layer parameters for debugging
    console.log('Received Layer Parameters:', layerParameters);

    // Use the provided polyline from the layer parameters
    const polyline = layerParameters.mandrelParameters.polyline;

    // Log the polyline to verify it was passed correctly
    console.log('Received Polyline:', polyline);

    // Revolve the polyline to create a 3D shape
    const [X, Y, Z] = revolve2DTo3D(polyline, numPoints);

    console.log('Revolved 3D Coordinates:', { X, Y, Z });

    // Example geodesic winding path calculation
    const geodesicPath = calculateGeodesicPath(X, Y, Z, numTurns);

    console.log('Geodesic Path:', geodesicPath);

    // Export the geodesic path to a JSON file
    exportGeodesicPath(geodesicPath);

    // Plot and plan the geodesic winding
    for (let i = 0; i < geodesicPath.length; i++) {
        const tangent = calculateTangentVector(geodesicPath, i);
        const normal = calculateNormalVector(geodesicPath[i][0], geodesicPath[i][1], geodesicPath[i][2], X, Y, Z);
        const windAngleVector = calculateWindAngleVector(tangent, normal);

        // Calculate the mandrel rotation angle based on the number of turns
        const mandrelRotation = (i / (numPoints - 1)) * numTurns * 360;

        machine.move({
            [ECoordinateAxes.CARRIAGE]: geodesicPath[i][1],                             // Carriage-axis movement
            [ECoordinateAxes.MANDREL]: mandrelRotation,                                 // Mandrel-axis rotation
            [ECoordinateAxes.IN_OUT]: interpolateRadius(X, Y, Z, geodesicPath[i][1]),   // In/Out-axis delivery head in/out movement
            [ECoordinateAxes.DELIVERY_HEAD]: windAngleVector[1]                         // Delivery head rotation
        });
    }
    machine.zeroAxes(geodesicPath[geodesicPath.length - 1][1]);
}

function interpolateRadius(X: number[], Y: number[], Z: number[], y: number): number {
    if (y <= Y[0]) {
        return Math.sqrt(X[0] ** 2 + Z[0] ** 2);
    }

    if (y >= Y[Y.length - 1]) {
        return Math.sqrt(X[X.length - 1] ** 2 + Z[X.length - 1] ** 2);
    }

    for (let i = 0; i < Y.length - 1; i++) {
        if (Y[i] <= y && y <= Y[i + 1]) {
            const t = (y - Y[i]) / (Y[i + 1] - Y[i]);
            const radius = Math.sqrt(X[i] ** 2 + Z[i] ** 2);
            const nextRadius = Math.sqrt(X[i + 1] ** 2 + Z[i + 1] ** 2);
            const interpolatedRadius = radius + t * (nextRadius - radius);
            return interpolatedRadius;
        }
    }

    console.error('Failed to interpolate radius: y =', y);
    return NaN;
}

function calculateNormalVector(x: number, y: number, z: number, X: number[], Y: number[], Z: number[]): [number, number, number] {
    const epsilon = 1e-7;

    const interpolateValue = (axis: number[], y: number): number => {
        if (y <= Y[0]) return axis[0];
        if (y >= Y[Y.length - 1]) return axis[axis.length - 1];

        for (let i = 0; i < Y.length - 1; i++) {
            if (Y[i] <= y && y <= Y[i + 1]) {
                const t = (y - Y[i]) / (Y[i + 1] - Y[i]);
                return axis[i] + t * (axis[i + 1] - axis[i]);
            }
        }
        return NaN;
    };

    const interpolateDerivative = (axis: number[], y: number): number => {
        return (interpolateValue(axis, y + epsilon) - interpolateValue(axis, y - epsilon)) / (2 * epsilon);
    };

    const dx_dy = interpolateDerivative(X, y);
    const dy_dy = interpolateDerivative(Y, y);
    const dz_dy = interpolateDerivative(Z, y);

    const normalX = -dx_dy;
    const normalY = dy_dy;
    const normalZ = -dz_dy;
    const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2 + normalZ ** 2);

    return [normalX / magnitude, normalY / magnitude, normalZ / magnitude];
}

function calculateTangentVector(path: number[][], i: number): [number, number, number] {
    let tangent: [number, number, number];

    if (i === 0) {
        tangent = [
            path[i + 1][0] - path[i][0],
            path[i + 1][1] - path[i][1],
            path[i + 1][2] - path[i][2]
        ];
    } else if (i === path.length - 1) {
        tangent = [
            path[i][0] - path[i - 1][0],
            path[i][1] - path[i - 1][1],
            path[i][2] - path[i - 1][2]
        ];
    } else {
        tangent = [
            (path[i + 1][0] - path[i - 1][0]) / 2,
            (path[i + 1][1] - path[i - 1][1]) / 2,
            (path[i + 1][2] - path[i - 1][2]) / 2
        ];
    }

    const magnitude = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
    return [tangent[0] / magnitude, tangent[1] / magnitude, tangent[2] / magnitude];
}

function calculateWindAngleVector(tangent: [number, number, number], normal: [number, number, number]): [number, number, number] {
    const dotProduct = tangent[0] * normal[0] + tangent[1] * normal[1] + tangent[2] * normal[2];
    const magnitudeTangent = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
    const magnitudeNormal = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    const cosAngle = dotProduct / (magnitudeTangent * magnitudeNormal);
    const angle = Math.acos(cosAngle);
    const windAngleVector = [
        tangent[1] * normal[2] - tangent[2] * normal[1],
        tangent[2] * normal[0] - tangent[0] * normal[2],
        tangent[0] * normal[1] - tangent[1] * normal[0]
    ];
    const windAngleMagnitude = Math.sqrt(windAngleVector[0] ** 2 + windAngleVector[1] ** 2 + windAngleVector[2] ** 2);
    return [
        (windAngleVector[0] / windAngleMagnitude) * angle,
        (windAngleVector[1] / windAngleMagnitude) * angle,
        (windAngleVector[2] / windAngleMagnitude) * angle
    ];
}

/**
 * Revolves a 2D polyline around the Y-axis to create 3D coordinates.
 * @param {Array<[number, number]>} polyline - The 2D polyline points.
 * @param {number} numPoints - Number of points for the revolution.
 * @returns {[number[], number[], number[]]} - Arrays of X, Y, and Z coordinates.
 */
function revolve2DTo3D(polyline: [number, number][], numPoints: number): [number[], number[], number[]] {
    const X: number[] = [];
    const Y: number[] = [];
    const Z: number[] = [];

    const theta = Array.from(Array(numPoints).keys()).map(i => 2 * Math.PI * i / numPoints);

    console.log('Theta:', theta);

    polyline.forEach(([x, y]) => {
        theta.forEach(t => {
            X.push(x * Math.cos(t)); // X-coordinate revolved
            Y.push(y); // Y-coordinate remains the same
            Z.push(x * Math.sin(t)); // Z-coordinate revolved
        });
    });

    return [X, Y, Z];
}

/**
 * Exports the 3D coordinates to a JSON file.
 * @param {number[]} X - X-coordinates.
 * @param {number[]} Y - Y-coordinates.
 * @param {number[]} Z - Z-coordinates.
 */
function exportCoordinates(X: number[], Y: number[], Z: number[]): void {
    const coordinates = { X, Y, Z };
    fs.writeFileSync('coordinates.json', JSON.stringify(coordinates, null, 2));
}
