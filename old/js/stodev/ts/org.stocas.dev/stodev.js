/// <reference path="../../../stovis/ts/org.stocas.vis/stovis.ts" />
var stodev;

var StoDev = (function () {
    function StoDev(element) {
        console.log("Creating StoDev...");
        this.element = element;
        this.editor = stovis.addEditor(this.element);
        console.log("Done creating StoDev.");
    }
    StoDev.singleton = function (element) {
        if (!StoDev._singleton) {
            console.log("No StoDev singleton found. Creating a new one...");
            StoDev._singleton = new StoDev(element);
        }
        return StoDev._singleton;
    };
    return StoDev;
})();

window.onload = function () {
    var el = document.getElementById('content');
    stodev = StoDev.singleton(el);
};
//# sourceMappingURL=stodev.js.map
