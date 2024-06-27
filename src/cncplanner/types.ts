/**
 * Whole machining definition
 */

export interface IMachiningParameters {
    initialDiameter: number;
    targetDiameter: number;
    toolDiameter: number;
    toolEngagement: number;
    feedRate: number;
    spindleSpeed: number;
    cutLength: number;
    stepDown: number;
    safeHeight: number;
}