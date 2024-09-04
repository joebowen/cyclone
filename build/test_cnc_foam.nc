; Parameters {"mandrel":{"diameter":176,"globalToolOffset":0,"safeToolOffset":20,"windLength":500},"tow":{"width":5,"thickness":0.5}}
G21 ; Set units to mm
G90 ; Set absolute distance mode
G54 ; Use G54 coordinate system
S12000 ; Set spindle speed in rpm
M3 ; Start spindle
M10 ; Start dust collection
G1 F1500
G0 Z108
G0 Y0 X0
G92 A0
G1 F8000
; Layer 1 of 1: milling
; Parameters {"windType":"milling","layerToolOffset":0,"initialDiameter":176,"targetDiameter":60,"toolDiameter":6.35,"toolEngagement":0.8,"feedRate":1500,"spindleSpeed":12000,"cutLength":1830,"maxRoughStepDown":15,"safeHeight":95,"finishingStepDown":1,"finishingFeedRate":1000,"finishingToolEngagement":0.3}
G0 Z95
G0 Y0
G92 A0
G1 F1500
G1 Z73.75
G1 A360
G1 Y1830 A130320
G1 A130680
G0 Z95
G0 Y0
G92 A0
G1 F1500
G1 Z59.5
G1 A360
G1 Y1830 A130320
G1 A130680
G0 Z95
G0 Y0
G92 A0
G1 F1500
G1 Z45.25
G1 A360
G1 Y1830 A130320
G1 A130680
G0 Z95
G0 Y0
G92 A0
G1 F1500
G1 Z31
G1 A360
G1 Y1830 A130320
G1 A130680
G0 Z95
G0 Y0
G92 A0
G1 F1000
G1 Z30
G1 A360
G1 Y1830 A346320
G1 A346680
G0 Z95
G0 Y0
G92 A0
G0 Z108
M11 ; Stop dust collection
M5 ; Stop spindle
M30 ; Stop program