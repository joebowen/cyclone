import { IWindParameters, ILayerParameters, TGeodesicLayer, THelicalLayer, THoopLayer, TSkipLayer, ELayerType } from './planner_types';
import { ECoordinateAxes, AxisLookup, EMoveTypes } from '../global_types';
import { WinderMachine } from '../machine';
import { planGeodesicWind } from './planGeodesicWind';
import { planHelicalLayer } from './planHelicalLayer';
import { planHoopLayer } from './planHoopLayer';
import { planSkipLayer } from './planSkipLayer';

export function planWind(windingParameters: IWindParameters): string[] {
    const machine = new WinderMachine(windingParameters.mandrelParameters.diameter);

    const headerParameters = {
        mandrel: windingParameters.mandrelParameters,
        tow: windingParameters.towParameters
    };

    machine.insertComment(`Parameters ${JSON.stringify(headerParameters)}`);

    const safeInOutPosition = (windingParameters.mandrelParameters.diameter / 2) + windingParameters.mandrelParameters.safeToolOffset;
    const globalInOutPosition = (windingParameters.mandrelParameters.diameter / 2) + windingParameters.mandrelParameters.globalToolOffset;

    machine.move({ [ECoordinateAxes.IN_OUT]: safeInOutPosition }, EMoveTypes.RAPID);
    machine.addRawGCode(`G0 ${AxisLookup[ECoordinateAxes.CARRIAGE]}0 ${AxisLookup[ECoordinateAxes.DELIVERY_HEAD]}0`);

    machine.setPosition({
        [ECoordinateAxes.MANDREL]: 0
    });

    machine.setFeedRate(windingParameters.defaultFeedRate);

    let encounteredTerminalLayer = false;
    let layerIndex = 0;
    let cumulativeTimeS = 0;
    let cumulativeTowUseM = 0;

    for (const layer of windingParameters.layers) {
        if (encounteredTerminalLayer) {
            console.warn('WARNING: Attempting to plan a layer after a terminal layer, aborting...');
            break;
        }

        const layerComment = `Layer ${layerIndex + 1} of ${windingParameters.layers.length}: ${layer.windType}`;
        console.log(layerComment);
        machine.insertComment(layerComment);

        machine.insertComment(`Parameters ${JSON.stringify(layer)}`);

        const layerToolOffset = layer.layerToolOffset ?? 0;

        const layerInOutPosition = globalInOutPosition + layerToolOffset;
        machine.move({ [ECoordinateAxes.IN_OUT]: layerInOutPosition }, EMoveTypes.LINEAR);

        switch(layer.windType) {
            case ELayerType.HOOP:
                planHoopLayer(machine, {
                    parameters: layer as THoopLayer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                encounteredTerminalLayer = encounteredTerminalLayer || (layer as THoopLayer).terminal;
                break;

            case ELayerType.HELICAL:
                planHelicalLayer(machine, {
                    parameters: layer as THelicalLayer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;

            case ELayerType.SKIP:
                planSkipLayer(machine, {
                    parameters: layer as TSkipLayer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;

            case ELayerType.GEODESIC:
                planGeodesicWind(machine, {
                    parameters: layer as TGeodesicLayer,
                    mandrelParameters: windingParameters.mandrelParameters,
                    towParameters: windingParameters.towParameters
                });
                break;
        }

        layerIndex += 1;

        console.log(`Layer time estimate: ${machine.getGCodeTimeS() - cumulativeTimeS} seconds`);
        console.log(`Layer tow required: ${machine.getTowLengthM() - cumulativeTowUseM} meters`);

        cumulativeTimeS = machine.getGCodeTimeS();
        cumulativeTowUseM = machine.getTowLengthM();

        console.log('-'.repeat(80));
    }

    machine.move({ [ECoordinateAxes.IN_OUT]: safeInOutPosition }, EMoveTypes.RAPID);

    console.log(`\nTotal time estimate: ${cumulativeTimeS} seconds`);
    console.log(`Total tow required: ${cumulativeTowUseM} meters\n`);

    return machine.getGCode();
}
