/// <reference path="../../../stovis/test/js/physics-2d-constraints-test.ts" />
var Greeter = (function () {
    function Greeter(element) {
        this.element = element;
    }
    Greeter.prototype.start = function () {
        physics2DConstraintsTest.addEditor(this.element);
    };
    return Greeter;
})();

window.onload = function () {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};
