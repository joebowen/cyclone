###############################################################################
# Makefile for generating various example outputs using npm's CLI.
#
# Usage:
#   make all                Build all tests
#   make test_wind          Build wind test
#   make test_sand          Build sand test
#   make test_shrink        Build shrink test
#   make test_geodesic      Build geodesic test
#   make test_cnc_foam      Build foam milling test
#   make plot_wind          Plot the wind result (depends on test_wind)
#   make clean              Remove all generated artifacts
###############################################################################

# List of all build targets
.PHONY: all test_wind test_sand test_shrink test_geodesic test_cnc_foam plot_wind clean

all: test_wind test_shrink
	@echo "All requested targets have been built."

###############################################################################
# Individual build targets
###############################################################################

test_wind:
	@echo "Building Wind test..."
	mkdir -p build
	npm run cli -- plan -o build/test_wind.nc examples/test.wind
	python plot_path.py build/test_wind.nc --fiber-width 1 --total-time 240 --output build/video/wind.mp4

test_sand:
	@echo "Building Sand test..."
	mkdir -p build
	npm run cli -- plan -o build/test_sand.nc examples/test.sand
	python plot_path.py build/test_sand.nc --fiber-width 1 --total-time 90 --output build/video/sand.mp4

test_shrink:
	@echo "Building Shrink test..."
	mkdir -p build
	npm run cli -- plan -o build/test_shrink.nc examples/test.shrink
	python plot_path.py build/test_shrink.nc --fiber-width 1 --total-time 30 --output build/video/shrink.mp4

test_geodesic:
	@echo "Building Geodesic test..."
	mkdir -p build
	npm run cli -- plan -o build/test_geodesic.nc examples/test_geodesic.wind
	python plot_path.py build/test_geodesic.nc --fiber-width 1 --total-time 240 --output build/video/geodesic.mp4 --stl-file examples/tank.stl

test_nose_cone:
	@echo "Building Geodesic Nose Cone test..."
	mkdir -p build
	npm run cli -- plan -o build/test_geodesic_nose_cone.nc examples/test_geodesic_nose_cone.wind
	python plot_path.py build/test_geodesic_nose_cone.nc --fiber-width 1 --total-time 240 --output build/video/geodesic_nose_cone.mp4 --stl-file examples/nose_cone.stl

test_hex_rocket:
	@echo "Building Hex Rocket test..."
	mkdir -p build
	npm run cli -- plan -o build/test_hex_rocket.nc examples/test_geodesic_hex_rocket.wind
	python plot_path.py build/test_hex_rocket.nc --fiber-width 1 --total-time 240 --output build/video/hex_rocket.mp4 --stl-file examples/hex_rocket.stl

test_cnc_foam:
	@echo "Building CNC Foam test..."
	mkdir -p build
	npm run cli -- plan -o build/test_cnc_foam.nc examples/test_foam.mill

###############################################################################
# Plotting target (example)
###############################################################################

plot_wind: test_wind
	@echo "Plotting Wind test result..."
	npm run cli -- plot -o build/test_wind.png build/test_wind.nc

###############################################################################
# Clean target
###############################################################################

clean:
	@echo "Cleaning build artifacts..."
	rm -rf build
