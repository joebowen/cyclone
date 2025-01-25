; Parameters {"mandrel":{"diameter":60,"globalToolOffset":50,"safeToolOffset":100,"windLength":1300},"tow":{"width":10,"thickness":0.5}}
G0 Z130
G0 Y0 X0
G92 A0
G1 F5000
; Layer 1 of 1: hoop
; Parameters {"windType":"hoop","layerToolOffset":0,"terminal":true,"lockDegrees":1080}
G1 Z80
G1 Y0 A1080 X0
G1 X-9.462322
G1 Y1300 A47880
G1 A48960 X0
G0 Z130