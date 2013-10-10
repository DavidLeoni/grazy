/// <reference path="../../stovis/test/js/d3-tests.ts" />
var Greeter = (function () {
    function Greeter(element) {
        this.element = element;
    }
    Greeter.prototype.start = function () {
        //d3Tests.testPieChart();
        d3Tests.stickyEditor();
    };
    return Greeter;
})();

window.onload = function () {
    var el = document.getElementById('content');
    var greeter = new Greeter(el);
    greeter.start();
};
