declare module 'stl-reader' {
    class StlReader {
        read(fileData: ArrayBuffer): { vertices: Float32Array } | null;
    }
    export = StlReader;
}
