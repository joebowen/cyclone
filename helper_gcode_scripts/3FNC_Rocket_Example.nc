G21 ; Set units to mm
G90 ; Set absolute distance mode
G54 ; Use G54 coordinate system
S12000 ; Set spindle speed in rpm
M3 ; Start spindle
M10 ; Start dust collection

G0 Z100
G0 Y0 X0
G92 A0

G1 F1500

G0 Y125.4
G1 Z35
G1 Y277.8
G1 Z50

G0 Y125.4 A120
G1 Z35
G1 Y277.8
G1 Z50

G0 Y125.4 A240
G1 Z35
G1 Y277.8
G1 Z50

G0 Z100
G0 Y0 A360

G0 Y100 A0
G1 Z35
G1 A360
G1 Z50

G0 Y1250 A0
G1 Z35
G1 A360
G1 Z50

M11 ; Stop dust collection
M5 ; Stop spindle
M30 ; Stop program