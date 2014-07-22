interface IPoint {
    getDist(): number;
}
declare module Shapes {
    class Point implements IPoint {
        public x: number;
        public y: number;
        constructor(x: number, y: number);
        public getDist(): number;
        static origin: Point;
    }
}
declare var p: IPoint;
declare var dist: number;
