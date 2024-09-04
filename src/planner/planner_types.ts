/**
 * General parameters
 */

export interface IMandrelParameters {
    diameter: number;
    windLength: number;
    polyline: [number, number][];
    globalToolOffset?: number;
    safeToolOffset?: number;
}


export interface ITowParameters {
    width: number;
    thickness: number;
}

/**
 * Layer-specific parameters
 */

export const enum ELayerType {
    HOOP = 'hoop',
    HELICAL = 'helical',
    SKIP = 'skip',
    GEODESIC = 'geodesic',
    MILLING = 'milling'
}

export type THoopLayer = {
    windType: ELayerType.HOOP;
    terminal: boolean; // Is this a one-way hoop layer, or are there other layers afterwards?
    layerToolOffset: number; // Layer Tool offset in the In/Out direction in addition to the the globalToolOffset
    lockDegrees: number;
};

export type TMachiningParameters = {
    windType: ELayerType.MILLING;
    layerToolOffset: number; // Layer Tool offset in the In/Out direction in addition to the the globalToolOffset
    initialDiameter: number;   // The initial diameter of the workpiece
    targetDiameter: number;    // The target diameter after milling
    toolDiameter: number;      // The diameter of the milling tool
    toolEngagement: number;    // The percentage of the tool diameter engaged in the rough cut
    feedRate: number;          // The feed rate for roughing (mm/min)
    spindleSpeed: number;      // The speed of the spindle (RPM)
    cutLength: number;         // The length of the cut in the carriage direction
    maxRoughStepDown: number;  // The max depth of cut for rough passes
    safeHeight: number;        // The height to which the tool retracts for safe movement
    finishingStepDown?: number; // The depth of cut for the finishing pass (optional)
    finishingFeedRate?: number; // The feed rate for the finishing pass (optional)
    finishingToolEngagement?: number; // The percentage of the tool diameter engaged in the finishing cut (optional)
};

export type THelicalLayer = {
    windType: ELayerType.HELICAL;
    windAngle: number; // The complement of the angle between the mandrel axis and the wound tow
    patternNumber: number; // The number of "start positions", evenly spaced around the mandrel
    skipIndex: number; // The increment applied when deciding the next start position
    lockDegrees: number; // The number of degrees that the mandrel rotates through at the ends of each circuit
    leadInMM: number; // The portion of the pass on each end during which the delivery head rotates into place
    leadOutDegrees: number; // The portion of each lock that the delivery head rotates back to level during
    skipInitialNearLock: boolean | undefined; // For sequences of multiple helical layers, skip the extra near lock
    layerToolOffset?: number; // Layer Tool offset in the In/Out direction in addition to the the globalToolOffset
}

export type TSkipLayer = {
    windType: ELayerType.SKIP;
    mandrelRotation: number;
    layerToolOffset?: number; // Layer Tool offset in the In/Out direction in addition to the the globalToolOffset
}

export type TGeodesicLayer = {
    windType: ELayerType.GEODESIC;
    numPoints: number;
    numTurns: number;
    layerToolOffset?: number; // Layer Tool offset in the In/Out direction in addition to the the globalToolOffset
}

export type TLayerParameters = THoopLayer | THelicalLayer | TSkipLayer | TGeodesicLayer | TMachiningParameters;

export interface ILayerParameters<TLayerSpecificParameters extends TLayerParameters> {
    parameters: TLayerSpecificParameters;
    mandrelParameters: IMandrelParameters;
    towParameters: ITowParameters;
}

/**
 * Whole wind definition
 */

export interface IWindParameters {
    layers: TLayerParameters[];
    mandrelParameters: IMandrelParameters;
    towParameters: ITowParameters;
    defaultFeedRate: number;
    headerGcode: [string];
    footerGcode: [string];
}
