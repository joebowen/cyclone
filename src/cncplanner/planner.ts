import { WinderMachine } from '../machine';
import { ECoordinateAxes, AxisLookup, TCommand, EMoveTypes } from '../global_types';
import { IMachiningParameters } from './types';

export class CNCMachine extends WinderMachine {
    constructor(public parameters: IMachiningParameters) {
        super(parameters.initialDiameter);  // Assuming the constructor takes the diameter
    }

    public generateGCode(): string[] {
        const { initialDiameter, targetDiameter, toolDiameter, toolEngagement, feedRate, spindleSpeed, cutLength, stepDown, safeHeight } = this.parameters;

        const stepOver = toolDiameter * toolEngagement;
        const passes = Math.floor((initialDiameter - targetDiameter) / (2 * stepDown));
        const rotations = Math.ceil(cutLength / stepOver);

        this.addRawGCode(`G21 ; Set units to mm`);
        this.addRawGCode(`G90 ; Set absolute distance mode`);
        this.addRawGCode(`G54 ; Use G54 coordinate system`);
        this.addRawGCode(`S${spindleSpeed} ; Set spindle speed in rpm`);
        this.addRawGCode(`M3 ; Start spindle`);
        this.addRawGCode(`M10 ; Start dust collection`);
        this.setFeedRate(feedRate);

        this.move({ [ECoordinateAxes.IN_OUT]: safeHeight }, EMoveTypes.RAPID);
        this.move({ [ECoordinateAxes.CARRIAGE]: 0, [ECoordinateAxes.MANDREL]: 0 }, EMoveTypes.RAPID);

        for (let passNum = 0; passNum < passes; passNum++) {
            const inOutPosition = (initialDiameter / 2) - (stepDown * (passNum + 1));
            this.move({ [ECoordinateAxes.IN_OUT]: inOutPosition }, EMoveTypes.LINEAR);

            this.move({ [ECoordinateAxes.MANDREL]: 360 }, EMoveTypes.LINEAR);

            for (let rotation = 0; rotation < rotations; rotation++) {
                const mandrelDegrees = (rotation + 1) * 360;
                const carriagePos = (rotation + 1) * stepOver;
                this.move({ [ECoordinateAxes.MANDREL]: mandrelDegrees, [ECoordinateAxes.CARRIAGE]: carriagePos }, EMoveTypes.LINEAR);
            }

            this.move({ [ECoordinateAxes.MANDREL]: (rotations + 1) * 360 }, EMoveTypes.LINEAR);

            this.move({ [ECoordinateAxes.IN_OUT]: safeHeight }, EMoveTypes.RAPID);  // Lift the tool to safe height before moving carriage
            this.move({ [ECoordinateAxes.CARRIAGE]: 0 }, EMoveTypes.RAPID);
            this.setPosition({ [ECoordinateAxes.MANDREL]: 0 });
        }

        const inOutPosition = targetDiameter / 2;
        this.move({ [ECoordinateAxes.IN_OUT]: inOutPosition }, EMoveTypes.LINEAR);

        for (let rotation = 0; rotation < rotations; rotation++) {
            const mandrelDegrees = (rotation + 1) * 360;
            const carriagePos = (rotation + 1) * stepOver;
            this.move({ [ECoordinateAxes.MANDREL]: mandrelDegrees, [ECoordinateAxes.CARRIAGE]: carriagePos }, EMoveTypes.LINEAR);
        }

        this.move({ [ECoordinateAxes.IN_OUT]: safeHeight }, EMoveTypes.RAPID);  // Lift the tool to safe height before moving carriage
        this.move({ [ECoordinateAxes.CARRIAGE]: 0 }, EMoveTypes.RAPID);
        this.setPosition({ [ECoordinateAxes.MANDREL]: 0 });

        this.move({ [ECoordinateAxes.IN_OUT]: safeHeight }, EMoveTypes.RAPID);
        this.move({ [ECoordinateAxes.CARRIAGE]: 0, [ECoordinateAxes.MANDREL]: 0 }, EMoveTypes.RAPID);

        this.addRawGCode(`M11 ; Stop dust collection`);
        this.addRawGCode(`M5 ; Stop spindle`);
        this.addRawGCode(`M30 ; Stop program`);

        return this.getGCode();
    }
}
