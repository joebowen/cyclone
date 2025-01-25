import type { ILayerParameters, THelicalLayer } from './planner_types';
import { WinderMachine } from '../machine';
import { ECoordinateAxes } from '../global_types';
import { degToRad, radToDeg } from '../helpers';

export function planHelicalLayer(machine: WinderMachine, layerParameters: ILayerParameters<THelicalLayer>): void {
    const deliveryHeadPassStartAngle = -10;

    const leadOutDegrees = layerParameters.parameters.leadOutDegrees;
    const windLeadInMM = layerParameters.parameters.leadInMM;
    const lockDegrees = layerParameters.parameters.lockDegrees;
    const deliveryHeadAngleDegrees = -1 * (90 - layerParameters.parameters.windAngle);
    const mandrelCircumference = Math.PI * layerParameters.mandrelParameters.diameter;
    const towArcLength = layerParameters.towParameters.width / Math.cos(degToRad(layerParameters.parameters.windAngle));
    const numCircuits = Math.ceil(mandrelCircumference / towArcLength);
    const patternStepDegrees = 360 * (1 / numCircuits);
    const passRotationMM = layerParameters.mandrelParameters.windLength * Math.tan(degToRad(layerParameters.parameters.windAngle));
    const passRotationDegrees = 360 * (passRotationMM / mandrelCircumference);
    const passDegreesPerMM = passRotationDegrees / layerParameters.mandrelParameters.windLength;
    const patternNumber = layerParameters.parameters.patternNumber;
    const numberOfPatterns = numCircuits / layerParameters.parameters.patternNumber;
    const leadInDegrees = passDegreesPerMM * windLeadInMM;
    const mainPassDegrees = passDegreesPerMM * (layerParameters.mandrelParameters.windLength - windLeadInMM);
    const passParameters = [
        {
            deliveryHeadSign: 1,
            leadInEndMM: windLeadInMM,
            fullPassEndMM: layerParameters.mandrelParameters.windLength,
        },
        {
            deliveryHeadSign: -1,
            leadInEndMM: layerParameters.mandrelParameters.windLength - windLeadInMM,
            fullPassEndMM: 0,
        }
    ];

    console.log(`Doing helical wind, ${numCircuits} circuits`);
    if (numCircuits % layerParameters.parameters.patternNumber !== 0) {
        console.warn(`Circuit number of ${numCircuits} not divisible by pattern number of ${layerParameters.parameters.patternNumber}`);
        return;
    }

    let mandrelPositionDegrees = machine.getLastPosition()[ECoordinateAxes.MANDREL];

    if (typeof layerParameters.parameters.skipInitialNearLock === 'undefined' || !layerParameters.parameters.skipInitialNearLock) {
        mandrelPositionDegrees += lockDegrees
        machine.move({
            [ECoordinateAxes.CARRIAGE]: 0,
            [ECoordinateAxes.MANDREL]: lockDegrees,
            [ECoordinateAxes.DELIVERY_HEAD]: 0
        });
        machine.setPosition({
            [ECoordinateAxes.MANDREL]: 0,
        });
    }

    for (let patternIndex = 0; patternIndex < numberOfPatterns; patternIndex++) {
        for (let inPatternIndex = 0; inPatternIndex < patternNumber; inPatternIndex++) {
            machine.insertComment(`\tPattern: ${patternIndex + 1}/${numberOfPatterns} Circuit: ${inPatternIndex + 1}/${patternNumber}`);

            for (let passParams of passParameters) {
                machine.move({
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: 0
                });

                machine.move({
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                });

                mandrelPositionDegrees += leadInDegrees;
                machine.move({
                    [ECoordinateAxes.CARRIAGE]: passParams.leadInEndMM,
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadAngleDegrees,
                });

                mandrelPositionDegrees += mainPassDegrees;
                machine.move({
                    [ECoordinateAxes.CARRIAGE]: passParams.fullPassEndMM,
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees
                });

                mandrelPositionDegrees += leadOutDegrees;
                machine.move({
                    [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
                    [ECoordinateAxes.DELIVERY_HEAD]: passParams.deliveryHeadSign * deliveryHeadPassStartAngle,
                });

                mandrelPositionDegrees += lockDegrees - leadOutDegrees - (passRotationDegrees % 360);
            }

            mandrelPositionDegrees += patternStepDegrees * numCircuits / layerParameters.parameters.patternNumber;
        }

        mandrelPositionDegrees += patternStepDegrees;
    }

    mandrelPositionDegrees += lockDegrees;
    machine.move({
        [ECoordinateAxes.MANDREL]: mandrelPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0,
    });

    // machine.zeroAxes(mandrelPositionDegrees);
}
