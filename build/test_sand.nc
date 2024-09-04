; Parameters {"mandrel":{"diameter":130,"globalToolOffset":0,"safeToolOffset":10,"windLength":250},"tow":{"width":3,"thickness":0.5}}
G0 Z75
G0 Y0 X0
G92 A0
G1 F100
; Layer 1 of 2: hoop
; Parameters {"windType":"hoop","layerToolOffset":0,"terminal":false,"lockDegrees":180}
G1 Z65
G1 Y0 A180 X0
G1 X-1.321976
G1 Y250 A30180
G1 A30360 X0
G1 X1.321976
G1 Y0 A60360
G1 A60540 X0
G92 Y0 A60 X0
G1 A360
G92 A0
; Layer 2 of 2: hoop
; Parameters {"windType":"hoop","layerToolOffset":-0.1,"terminal":true,"lockDegrees":180}
G1 Z64.9
G1 Y0 A180 X0
G1 X-1.321976
G1 Y250 A30180
G1 A30360 X0
G0 Z75