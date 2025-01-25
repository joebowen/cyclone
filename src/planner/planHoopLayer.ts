import type { ILayerParameters, THoopLayer } from './planner_types';
import { WinderMachine } from '../machine';
import { ECoordinateAxes, EMoveTypes } from '../global_types';
import { radToDeg } from './helpers';

export function planHoopLayer(machine: WinderMachine, layerParameters: ILayerParameters<THoopLayer>): void {
    const lockDegrees = layerParameters.parameters.lockDegrees;
    const windAngle = 90 - radToDeg(Math.atan(layerParameters.mandrelParameters.diameter / layerParameters.towParameters.width));
    const mandrelRotatations = layerParameters.mandrelParameters.windLength / layerParameters.towParameters.width;
    const farMandrelPositionDegrees = lockDegrees + (mandrelRotatations * 360);
    const farLockPositionDegrees = farMandrelPositionDegrees + lockDegrees;
    const nearMandrelPositionDegrees = farLockPositionDegrees + (mandrelRotatations * 360);
    const nearLockPositionDegrees = nearMandrelPositionDegrees + lockDegrees;

    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: lockDegrees + machine.getLastPosition()[ECoordinateAxes.MANDREL],
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });

    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: -windAngle
    });

    machine.move({
        [ECoordinateAxes.CARRIAGE]: layerParameters.mandrelParameters.windLength,
        [ECoordinateAxes.MANDREL]: farMandrelPositionDegrees
    });

    machine.move({
        [ECoordinateAxes.MANDREL]: farLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });

    if (layerParameters.parameters.terminal) {
        return;
    }

    machine.move({
        [ECoordinateAxes.DELIVERY_HEAD]: windAngle,
    });

    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: nearMandrelPositionDegrees
    });

    machine.move({
        [ECoordinateAxes.MANDREL]: nearLockPositionDegrees,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });
    // machine.zeroAxes(nearLockPositionDegrees);
}
