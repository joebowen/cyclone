import type { ILayerParameters, TSkipLayer } from './planner_types';
import { WinderMachine } from '../machine';
import { ECoordinateAxes } from '../global_types';

export function planSkipLayer(machine: WinderMachine, layerParameters: ILayerParameters<TSkipLayer>): void {
    machine.move({
        [ECoordinateAxes.CARRIAGE]: 0,
        [ECoordinateAxes.MANDREL]: layerParameters.parameters.mandrelRotation,
        [ECoordinateAxes.DELIVERY_HEAD]: 0
    });

    machine.setPosition({
        [ECoordinateAxes.MANDREL]: 0,
    });
}
