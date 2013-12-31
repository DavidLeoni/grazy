/// <reference path="../../stovis/js/stovis.ts" />
var Greeter = (function () {
    function Greeter(element) {
        this.element = element;
    }
    Greeter.prototype.start = function () {
        stovis.addEditor(this.element);
    };
    return Greeter;
})();

window.onload = function () {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};
