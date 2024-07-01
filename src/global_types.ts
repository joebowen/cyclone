/**
 *  Helper types
 */

// This type ensures that at least one property is present in the object
export type AtLeastOne<T, U = {[K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

// Axis lookup for converting coordinate axes to G-code axes
export const AxisLookup: Record<keyof TCoordinateAxes, string> = {
    [ECoordinateAxes.CARRIAGE]: 'Y',
    [ECoordinateAxes.MANDREL]: 'A',
    [ECoordinateAxes.DELIVERY_HEAD]: 'X',
    [ECoordinateAxes.IN_OUT]: 'Z'
};

// Enum for movement types
export const enum EMoveTypes {
    RAPID = 'rapid',
    LINEAR = 'linear'
}

// Lookup for converting move types to G-code commands
export const MoveLookup: Record<EMoveTypes, string> = {
    [EMoveTypes.RAPID]: 'G0',
    [EMoveTypes.LINEAR]: 'G1'
};

// Type for move types, mapping movement types to their corresponding G-code command numbers
export type TMoveTypes = Record<EMoveTypes, string>;

// Enum for coordinate axes
export const enum ECoordinateAxes {
    CARRIAGE = 'carriage',
    MANDREL = 'mandrel',
    DELIVERY_HEAD = 'deliveryHead',
    IN_OUT = 'inOut'
}

// Type for coordinate axes, mapping axes to their corresponding values
export type TCoordinateAxes = Record<ECoordinateAxes, number>;

// Type for coordinate, ensuring at least one axis is specified
export type TCoordinate = AtLeastOne<TCoordinateAxes>;

// Type for G-code commands
export type TCommand = keyof typeof MoveLookup;
