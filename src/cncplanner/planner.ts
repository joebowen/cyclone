import { WinderMachine } from '../planner/machine';
import { ECoordinateAxes, AxisLookup } from '../types';

interface IMachiningParameters {
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

export class CNCMachine extends WinderMachine {
    constructor(public parameters: IMachiningParameters) {
        super(parameters.initialDiameter);  // Assuming the constructor takes the diameter
    }

    public generateGCode(): string[] {
        const { initialDiameter, targetDiameter, toolDiameter, toolEngagement, feedRate, spindleSpeed, cutLength, stepDown, safeHeight } = this.parameters;

        const stepOver = toolDiameter * toolEngagement;
        const passes = Math.ceil((initialDiameter - targetDiameter) / (2 * stepDown));
        const rotations = Math.ceil(cutLength / stepOver);

        this.addRawGCode(`G21 ; Set units to mm`);
        this.addRawGCode(`G90 ; Set absolute distance mode`);
        this.addRawGCode(`G54 ; Use G54 coordinate system`);
        this.addRawGCode(`S${spindleSpeed} ; Set spindle speed in rpm`);
        this.addRawGCode(`M3 ; Start spindle`);
        this.addRawGCode(`M8 ; Start dust collection`);

        this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.IN_OUT]}${safeHeight}`);
        this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.CARRIAGE]}0 ${AxisLookup[ECoordinateAxes.MANDREL]}0`);

        for (let passNum = 0; passNum < passes; passNum++) {
            const inOutPosition = (initialDiameter / 2) - (stepDown * (passNum + 1));
            this.addRawGCode(`G01 ${AxisLookup[ECoordinateAxes.IN_OUT]}${inOutPosition}`);

            for (let rotation = 0; rotation < rotations; rotation++) {
                const mandrelDegrees = (rotation + 1) * 360;
                const carriagePos = (rotation + 1) * stepOver;
                this.addRawGCode(`G01 ${AxisLookup[ECoordinateAxes.MANDREL]}${mandrelDegrees} ${AxisLookup[ECoordinateAxes.CARRIAGE]}${carriagePos} F${feedRate}`);
            }

            this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.IN_OUT]}${safeHeight}`);  // Lift the tool to safe height before moving carriage
            this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.MANDREL]}0 ${AxisLookup[ECoordinateAxes.CARRIAGE]}0`);
        }

        this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.IN_OUT]}${safeHeight}`);
        this.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.CARRIAGE]}0 ${AxisLookup[ECoordinateAxes.MANDREL]}0`);


        this.addRawGCode(`M9 ; Stop dust collection`);
        this.addRawGCode(`M5 ; Stop spindle`);
        this.addRawGCode(`M30 ; Stop program`);

        return this.getGCode();
    }
}
