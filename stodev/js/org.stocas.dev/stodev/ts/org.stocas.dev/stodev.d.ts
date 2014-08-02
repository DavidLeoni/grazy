/// <reference path="../../../stovis/ts/org.stocas.vis/stovis.d.ts" />
declare var stodev: StoDev;
declare class StoDev {
    private static singleton;
    public element: HTMLElement;
    public span: HTMLElement;
    public timerToken: number;
    public editor: stovis.Editor;
    constructor(element: HTMLElement);
    static getSingleton(element: HTMLElement): StoDev;
}
