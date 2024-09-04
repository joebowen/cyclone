#!/bin/bash

# Plan G-code for different wind and sand examples
npm run cli -- plan -o build/test_wind.nc examples/test.wind
npm run cli -- plan -o build/test_sand.nc examples/test.sand
npm run cli -- plan -o build/test_shrink.nc examples/test.shrink
npm run cli -- plan -o build/test_geodesic.nc examples/test_geodesic.wind

# Plot the wind example
npm run cli -- plot -o build/test_wind.png build/test_wind.nc

# Generate CNC G-code for foam milling (rough and finish passes)
npm run cli -- plan -o build/test_cnc_foam.nc examples/test_foam.mill
