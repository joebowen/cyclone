G21 ; Set units to mm
G90 ; Set absolute distance mode
G54 ; Use G54 coordinate system
S12000 ; Set spindle speed in rpm
M3 ; Start spindle
M10 ; Start dust collection

G0 Z100
G0 Y0 X0
G92 A0

G1 F200

G0 Y50.8
G1 Z26
G1 Y127
G1 Z50

G0 Y50.8 A90
G1 Z26
G1 Y127
G1 Z50

G0 Y50.8 A180
G1 Z26
G1 Y127
G1 Z50

G0 Y50.8 A270
G1 Z26
G1 Y127
G1 Z50

G0 Z100

G0 Y0 A0
G1 Z26
G1 A360
G1 Z50

G0 Y1140 A0
G1 Z26
G1 A360
G1 Z50

M11 ; Stop dust collection
M5 ; Stop spindle
M30 ; Stop program