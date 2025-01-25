import { WinderMachine } from '../machine';
import { ILayerParameters, TGeodesicLayer } from './planner_types';
import { ECoordinateAxes } from '../global_types';
import * as fs from 'fs';
const DxfParser = require('dxf-parser');
import * as THREE from 'three';
const StlReader = require('stl-reader');

/**
 * Calculate a geodesic path on an arbitrary shape.
 *
 * @param {number[]} X - Array of X coordinates of points on the surface.
 * @param {number[]} Y - Array of Y coordinates of points on the surface.
 * @param {number[]} Z - Array of Z coordinates of points on the surface.
 * @param {number} numTurns - Number of complete turns the path should make around the shape.
 * @returns {number[][]} - Array of [x, y, z] coordinates representing the geodesic path.
 */
function calculateGeodesicPath(X: number[], Y: number[], Z: number[], numTurns: number): number[][] {
    const geodesicPath: number[][] = [];
    const numPoints = X.length;

    if (numPoints < 2) {
        console.error('Insufficient number of points to calculate the geodesic path.');
        return geodesicPath;
    }

    let currentY = Y[0];
    let currentRadius = Math.sqrt(X[0] ** 2 + Z[0] ** 2);
    const totalHeight = Y[Y.length - 1] - Y[0];
    const baseStepSize = totalHeight / (numPoints - 1); // Default step size for height

    geodesicPath.push([X[0], currentY, Z[0]]);

    // Calculate the geodesic path
    for (let i = 1; i < numPoints; i++) {
        const ds = baseStepSize; // Arc length step
        const nextRadius = interpolateRadius(X, Y, Z, currentY + ds);
        const dr = nextRadius - currentRadius;

        let dy;
        if (Math.abs(dr) > 1e-6) { // Region 1: Changing Radius
            dy = Math.sqrt(ds * ds - dr * dr); // Ensure ds^2 = dr^2 + dy^2
        } else { // Region 2: Constant Radius
            dy = ds; // Simple step in height when radius is constant
        }

        currentY += ds;
        if (isNaN(currentY)) {
            console.error(`currentY became NaN after incrementing by ds = ${ds}`);
            break;
        }
        currentRadius = nextRadius;

        const theta = 2 * Math.PI * numTurns * (i / (numPoints - 1));
        const x = currentRadius * Math.cos(theta);
        const z = currentRadius * Math.sin(theta);

        geodesicPath.push([x, currentY, z]);
    }

    return geodesicPath;
}

/**
 * Interpolates the radius at a given Y value based on the input points.
 *
 * @param {number[]} X - Array of X coordinates of points on the surface.
 * @param {number[]} Y - Array of Y coordinates of points on the surface.
 * @param {number[]} Z - Array of Z coordinates of points on the surface.
 * @param {number} y - The Y coordinate at which to interpolate the radius.
 * @returns {number} - The interpolated radius at the given Y coordinate.
 */
function interpolateRadius(X: number[], Y: number[], Z: number[], y: number): number {
    if (isNaN(y)) {
        throw new Error(`Invalid y value: ${y}`);
    }

    if (y <= Y[0]) {
        return Y[0];
    }

    if (y >= Y[Y.length - 1]) {
        return Y[Y.length - 1];
    }

    for (let i = 0; i < Y.length - 1; i++) {
        if (Y[i] <= y && y <= Y[i + 1]) {
            const t = (y - Y[i]) / (Y[i + 1] - Y[i]);
            const radius = Math.sqrt(X[i] ** 2 + Z[i] ** 2);
            const nextRadius = Math.sqrt(X[i + 1] ** 2 + Z[i + 1] ** 2);
            return radius + t * (nextRadius - radius);
        }
    }

    throw new Error(`Failed to interpolate radius for y = ${y}`);
}

// Export the geodesic path to a JSON file
function exportGeodesicPath(geodesicPath: number[][]): void {
    fs.writeFileSync('geodesic_path.json', JSON.stringify(geodesicPath, null, 2));
}

// Update the planGeodesicWind function
export function planGeodesicWind(machine: WinderMachine, layerParameters: ILayerParameters<TGeodesicLayer>): void {
    const numPoints = layerParameters.parameters.numPoints;
    const numTurns = layerParameters.parameters.numTurns;
    const lockDegrees = layerParameters.parameters.lockDegrees || 0;
    const leadInMM = layerParameters.parameters.leadInMM || 0;
    const leadInDegrees = layerParameters.parameters.leadInDegrees || 0;
    const leadOutMM = layerParameters.parameters.leadOutMM || 0;
    const leadOutDegrees = layerParameters.parameters.leadOutDegrees || 0;
    const numLoops = layerParameters.parameters.numLoops || 1;
    const globalToolOffset = layerParameters.mandrelParameters.globalToolOffset;
    const safeToolOffset = layerParameters.mandrelParameters.safeToolOffset;
    const layerToolOffset = layerParameters.parameters.layerToolOffset || 0;

    const dxfFilePath = layerParameters.mandrelParameters.dxfFilePath || '';
    const stlFilePath = layerParameters.mandrelParameters.stlFilePath || '';

    console.log('Received Layer Parameters:', layerParameters);
    console.log(`lockDegrees: ${lockDegrees}, leadInMM: ${leadInMM}, leadOutDegrees: ${leadOutDegrees}`);

    let vertices: THREE.Vector3[] = [];

    let X: number[] = [];
    let Y: number[] = [];
    let Z: number[] = [];

    if (dxfFilePath !== '') {
        console.log('Processing DXF file:', dxfFilePath);
        const vertices_backup = extractPointsFromDXF(dxfFilePath);
        [X, Y, Z] = revolve2DTo3D(vertices_backup, numPoints);
    } else if (stlFilePath !== '') {
        console.log('Processing STL file:', stlFilePath);
        vertices = extractPointsFromSTL(stlFilePath);
        [X, Y, Z] = verticesToCoordinates(vertices);
    } else {
        throw new Error('No valid file path provided for DXF or STL.');
    }

    console.log('3D Coordinates:', X, Y, Z);

    // Export the coordinates path to a JSON file
    exportCoordinates(X, Y, Z);

    // Example geodesic winding path calculation
    const geodesicPath = calculateGeodesicPath(X, Y, Z, numTurns);

    console.log('Geodesic Path:', geodesicPath);

    // Export the geodesic path to a JSON file
    exportGeodesicPath(geodesicPath);

    // Lead-In Winding
    let cumulativeMandrelRotation = machine.getLastPosition()[ECoordinateAxes.MANDREL];

    for (let loop = 0; loop < numLoops; loop++) {
        console.log(`Loop ${loop + 1} of ${numLoops}`);

        cumulativeMandrelRotation += leadInDegrees;
        machine.move({
            [ECoordinateAxes.MANDREL]: cumulativeMandrelRotation,
            [ECoordinateAxes.DELIVERY_HEAD]: 0,
            [ECoordinateAxes.IN_OUT]: interpolateRadius(X, Y, Z, geodesicPath[1][1]) + globalToolOffset + layerToolOffset
        });

        // Main Geodesic Winding
        for (let i = 1; i < geodesicPath.length - 1; i++) {
            const tangent = calculateTangentVector(geodesicPath, i);
            cumulativeMandrelRotation += (1 / geodesicPath.length) * numTurns * 360;
            machine.move({
                [ECoordinateAxes.CARRIAGE]: geodesicPath[i][1],
                [ECoordinateAxes.MANDREL]: cumulativeMandrelRotation,
                [ECoordinateAxes.IN_OUT]: interpolateRadius(X, Y, Z, geodesicPath[i][1]) + globalToolOffset + layerToolOffset,
                [ECoordinateAxes.DELIVERY_HEAD]: -radToDeg(tangent[1])
            });
        }

        // Lead-Out Winding
        cumulativeMandrelRotation += leadOutDegrees;
        machine.move({
            [ECoordinateAxes.MANDREL]: cumulativeMandrelRotation,
            [ECoordinateAxes.DELIVERY_HEAD]: 0
        });

        // Reverse Geodesic Winding
        for (let i = geodesicPath.length - 2; i >= 1; i--) {
            const tangent = calculateTangentVector(geodesicPath, i);
            cumulativeMandrelRotation += (1 / geodesicPath.length) * numTurns * 360;
            machine.move({
                [ECoordinateAxes.CARRIAGE]: geodesicPath[i][1],
                [ECoordinateAxes.MANDREL]: cumulativeMandrelRotation,
                [ECoordinateAxes.IN_OUT]: interpolateRadius(X, Y, Z, geodesicPath[i][1]) + globalToolOffset + layerToolOffset,
                [ECoordinateAxes.DELIVERY_HEAD]: radToDeg(tangent[1])
            });
        }
    }

    // Lead-Out Winding
    cumulativeMandrelRotation += leadOutDegrees;
    machine.move({
        [ECoordinateAxes.MANDREL]: cumulativeMandrelRotation,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });

    // machine.zeroAxes(geodesicPath[geodesicPath.length - 1][1]);
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

    polyline.forEach(([y, x]) => {
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

function verticesToCoordinates(vertices: THREE.Vector3[]): [number[], number[], number[]] {
    const X: number[] = [];
    const Y: number[] = [];
    const Z: number[] = [];

    vertices.forEach(vertex => {
        X.push(vertex.x);
        Y.push(vertex.y);
        Z.push(vertex.z);
    });

    // Combine the coordinates into a single array for sorting
    const combined = X.map((x, i) => ({ x, y: Y[i], z: Z[i] }));

    // Sort by Y first, then by X
    combined.sort((a, b) => a.y - b.y || a.x - b.x);

    // Unpack the sorted coordinates back into separate arrays
    const sortedX = combined.map(coord => coord.x);
    const sortedY = combined.map(coord => coord.y);
    const sortedZ = combined.map(coord => coord.z);

    // Interpolation and reduction logic
    const reduceFactor = 0.01; // Example factor to reduce the number of elements
    const interpolate = (array: number[], factor: number): number[] => {
        const newArray: number[] = [];
        const step = 1 / factor;
        for (let i = 0; i < array.length - 1; i += step) {
            const lowerIndex = Math.floor(i);
            const upperIndex = Math.ceil(i);
            const t = i - lowerIndex;
            const interpolatedValue = (1 - t) * array[lowerIndex] + t * array[upperIndex];
            newArray.push(interpolatedValue);
        }
        return newArray;
    };

    const interpolatedX = interpolate(sortedX, reduceFactor);
    const interpolatedY = interpolate(sortedY, reduceFactor);
    const interpolatedZ = interpolate(sortedZ, reduceFactor);

    return [interpolatedX, interpolatedY, interpolatedZ];
}

function extractPointsFromSTL(stlFilePath: string): THREE.Vector3[] {
    const data = fs.readFileSync(stlFilePath);
    const reader = new StlReader();
    const stlData = reader.read(data.buffer);
    const vertices: THREE.Vector3[] = [];

    if (stlData && stlData.vertices) {
        for (let i = 0; i < stlData.vertices.length; i += 3) {
            vertices.push(new THREE.Vector3(stlData.vertices[i], stlData.vertices[i + 1], stlData.vertices[i + 2]));
        }
    }

    return vertices;
}

function radToDeg(rad: number): number {
    return rad * 180 / Math.PI;
}

function extractPointsFromDXF(filePath: string): [number, number][] {
    const parser = new DxfParser();
    const data = fs.readFileSync(filePath, 'utf8');
    const dxf = parser.parseSync(data);
    const points: [number, number][] = [];

    dxf.entities.forEach((entity: any) => {
        if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            console.log('Polyline Entity:', entity);
            entity.vertices.forEach((vertex: any) => {
                points.push([vertex.x, vertex.y]);
            });
        } else if (entity.type === 'LINE') {
            console.log('Line Entity:', entity);
            points.push([entity.vertices[0].x, entity.vertices[0].y]);
            points.push([entity.vertices[1].x, entity.vertices[1].y]);
        } else if (entity.type === 'ARC') {
            console.log('Arc Entity:', entity);
            const { center, radius, startAngle, endAngle } = entity;
            const angleIncrement = (endAngle - startAngle) / 10; // Adjust the number of points as needed
            for (let angle = startAngle; angle <= endAngle; angle += angleIncrement) {
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                points.push([x, y]);
            }
        }
    });

    console.log('Unsorted points:', points);

    // Sort points by y-coordinate, then by x-coordinate
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    console.log('Sorted points:', points);

    // Remove entries with the same x value
    const uniquePoints = points.filter((point, index) => {
        return index === 0 || point[0] !== points[index - 1][0];
    });

    console.log('Filtered unique points:', uniquePoints);

    console.log('Filtered unique points:', uniquePoints.slice(uniquePoints.length - 10, uniquePoints.length - 1));

    return uniquePoints;
}
