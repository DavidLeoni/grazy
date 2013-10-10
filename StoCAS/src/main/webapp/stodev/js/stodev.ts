/// <reference path="../../stovis/test/js/d3-tests.ts" />



class Greeter {
    element: HTMLElement;
    span: HTMLElement;
    timerToken: number;

    constructor(element: HTMLElement) {
        this.element = element;        
    }
     

    start() {
        //d3Tests.testPieChart();        
        d3Tests.stickyEditor();
    }

}

window.onload = () => {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};