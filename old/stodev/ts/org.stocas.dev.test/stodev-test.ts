/// <reference path="../../../stovis/ts/org.stocas.vis/physics-2d-constraints-test.ts" />



class Greeter {
    element: HTMLElement;
    span: HTMLElement;
    timerToken: number;

    constructor(element: HTMLElement) {
        this.element = element;        
    } 
     

    start() {
        physics2DConstraintsTest.addEditor(this.element);

    }

}

window.onload = () => {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};