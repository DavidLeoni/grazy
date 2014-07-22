declare class DebugConstraint {
    public drawSliderConstraintLimits: (constraint: any, scale: any) => void;
    public drawHingeConstraintLimits: (constraint: any, scale: any) => void;
    public drawP2PConstraintLimits: (constraint: any, scale: any) => void;
    public drawConeTwistConstraintLimits: (constraint: any, scale: any) => void;
    public draw6DOFConstraintLimits: (constraint: any, scale: any) => void;
    static create(graphicsDevice: any, technique: any, mathsDevice: any, camera: any): DebugConstraint;
}
