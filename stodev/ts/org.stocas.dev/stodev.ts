/// <reference path="../../../stovis/ts/org.stocas.vis/stovis.ts" />



declare var stodev: StoDev;

class StoDev {

    private static singleton: StoDev;

    element: HTMLElement;
    span: HTMLElement;
    timerToken: number;
    editor: stovis.Editor;

    

    // if I make it private getSingleton complains, why??
    constructor(element: HTMLElement) {
        console.log("Creating StoDev...");
        this.element = element;        
        this.editor = stovis.addEditor(this.element);
        console.log("Done creating StoDev.");
    }
      

    static getSingleton(element: HTMLElement): StoDev {
        if (!StoDev.singleton) {
            StoDev.singleton = new StoDev(element);            
        } 
        return StoDev.singleton;
        
    }

}

window.onload = () => {
    var el = document.getElementById('content');
    stodev = StoDev.getSingleton(el);   
};