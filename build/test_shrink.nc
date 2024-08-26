; Parameters {"mandrel":{"diameter":60,"globalToolOffset":10,"safeToolOffset":20,"windLength":300},"tow":{"width":5,"thickness":0.5}}
G0 Z50
G0 Y0 X0
G92 A0
G1 F8000
; Layer 1 of 1: hoop
; Parameters {"windType":"hoop","layerToolOffset":5,"terminal":true}
G1 Z45
G1 Y0 A180 X0
G1 X-4.763642
G1 Y300 A21780
G1 A21960 X0
G0 Z50