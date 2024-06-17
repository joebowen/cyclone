/**
 *  Helpers types
 */

export type AtLeastOne<T, U = {[K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export const AxisLookup: Record<keyof TCoordinateAxes, string> = {
    [ECoordinateAxes.CARRIAGE]: 'Y',
    [ECoordinateAxes.MANDREL]: 'A',
    [ECoordinateAxes.DELIVERY_HEAD]: 'X',
    [ECoordinateAxes.IN_OUT]: 'Z'
}

export const enum ECoordinateAxes {
    CARRIAGE = 'carriage',
    MANDREL = 'mandrel',
    DELIVERY_HEAD = 'deliveryHead',
    IN_OUT = 'inOut'
}

export type TCoordinateAxes = Record<ECoordinateAxes, number>;

export type TCoordinate = AtLeastOne<TCoordinateAxes>;
