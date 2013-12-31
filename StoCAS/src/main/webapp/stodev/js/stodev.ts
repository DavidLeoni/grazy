/// <reference path="../../stovis/js/stovis.ts" />



class Greeter {
    element: HTMLElement;
    span: HTMLElement;
    timerToken: number;

    constructor(element: HTMLElement) {
        this.element = element;        
    }
     

    start() {
        stovis.addEditor(this.element);

 

    }

}

window.onload = () => {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};