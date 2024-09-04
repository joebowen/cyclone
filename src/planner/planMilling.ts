import { WinderMachine } from '../machine';
import { ECoordinateAxes, EMoveTypes } from '../global_types';
import type { TMachiningParameters } from './planner_types';

export function planMilling(machine: WinderMachine, millingParameters: TMachiningParameters): void {
    const {
        initialDiameter,
        targetDiameter,
        maxRoughStepDown,
        finishingStepDown,
        finishingFeedRate,
        finishingToolEngagement,
        toolDiameter,
        toolEngagement,
        feedRate,
        spindleSpeed,
        cutLength,
        safeHeight
    } = millingParameters;

    const steps = calcSteps(initialDiameter, targetDiameter, maxRoughStepDown, finishingStepDown);

    // Print out the steps for testing
    console.log('Milling Steps:', steps);

    moveToStartPosition(machine, safeHeight);

    executePasses(machine, steps, cutLength, safeHeight, feedRate, finishingFeedRate, toolDiameter, toolEngagement, finishingToolEngagement);
}

function calcSteps(initialDiameter: number, targetDiameter: number, maxRoughingStepDown: number, finishingStepDown?: number): number[] {
    const steps = [];
    const finishingStartDiameter = targetDiameter + (finishingStepDown ? 2 * finishingStepDown : 0);
    const totalRoughingReduction = (initialDiameter - finishingStartDiameter) / 2;
    const numRoughingPasses = Math.ceil(totalRoughingReduction / maxRoughingStepDown);
    const actualRoughingStepDown = totalRoughingReduction / numRoughingPasses;

    // Calculate roughing steps
    for (let i = 1; i <= numRoughingPasses; i++) {
        steps.push((initialDiameter / 2) - (actualRoughingStepDown * i));
    }

    // Ensure the last roughing step reaches the finishing start diameter
    if (steps[steps.length - 1] !== finishingStartDiameter / 2) {
        steps.push(finishingStartDiameter / 2);
    }

    // Add finishing steps if provided
    if (finishingStepDown) {
        let currentStep = finishingStartDiameter / 2;
        while (currentStep - finishingStepDown > targetDiameter / 2) {
            currentStep -= finishingStepDown;
            steps.push(currentStep);
        }
        // Ensure the final step reaches the target diameter
        steps.push(targetDiameter / 2);
    }

    return steps;
}

function executePasses(
    machine: WinderMachine,
    steps: number[],
    cutLength: number,
    safeHeight: number,
    roughFeedRate: number,
    finishingFeedRate: number | undefined,
    toolDiameter: number,
    roughToolEngagement: number,
    finishingToolEngagement: number | undefined
): void {
    steps.forEach((step, index) => {
        const isFinishingPass = finishingFeedRate !== undefined && index >= steps.length - 1;

        const feedRate = isFinishingPass ? finishingFeedRate! : roughFeedRate;
        const toolEngagement = isFinishingPass ? finishingToolEngagement! : roughToolEngagement;

        const stepOver = toolDiameter * toolEngagement;
        const mandrelRotatations = Math.ceil(cutLength / stepOver);
        const farMandrelPositionDegrees = 360 + (mandrelRotatations * 360);

        machine.setFeedRate(feedRate);

        machine.move({ [ECoordinateAxes.IN_OUT]: step }, EMoveTypes.LINEAR);
        machine.move({ [ECoordinateAxes.MANDREL]: 360 }, EMoveTypes.LINEAR);

        machine.move({
            [ECoordinateAxes.CARRIAGE]: cutLength,
            [ECoordinateAxes.MANDREL]: farMandrelPositionDegrees
        });

        machine.move({ [ECoordinateAxes.MANDREL]: farMandrelPositionDegrees + 360 }, EMoveTypes.LINEAR);

        moveToStartPosition(machine, safeHeight);
    });
}

function moveToSafeHeight(machine: WinderMachine, safeHeight: number): void {
    machine.move({ [ECoordinateAxes.IN_OUT]: safeHeight }, EMoveTypes.RAPID);
}

function moveToStartPosition(machine: WinderMachine, safeHeight: number): void {
    moveToSafeHeight(machine, safeHeight);
    machine.move({ [ECoordinateAxes.CARRIAGE]: 0 }, EMoveTypes.RAPID);
    machine.setPosition({ [ECoordinateAxes.MANDREL]: 0 });
}
