/// <reference path="../../../stovis/ts/org.stocas.vis/stovis.ts" />



var stodev: StoDev;
 
class StoDev {

    private static _singleton: StoDev;

    element: HTMLElement;
    span: HTMLElement;
    timerToken: number;
    editor: stovis.Editor;
     
    
    constructor(element: HTMLElement) {
        console.log("Creating StoDev...");
        this.element = element;        
        this.editor = stovis.addEditor(this.element);
        console.log("Done creating StoDev.");
    }
      

    static singleton(element: HTMLElement): StoDev {
        if (!StoDev._singleton) {
            console.log("No StoDev singleton found. Creating a new one...");
            StoDev._singleton = new StoDev(element);            
        } 
        return StoDev._singleton;
        
    }

}

window.onload = () => {
    var el = document.getElementById('content');
    stodev = StoDev.singleton(el);   
};