/// <reference path="../../../stovis/ts/org.stocas.vis/stovis.ts" />

var StoDev = (function () {
    // if I make it private getSingleton complains, why??
    function StoDev(element) {
        console.log("Creating StoDev...");
        this.element = element;
        this.editor = stovis.addEditor(this.element);
        console.log("Done creating StoDev.");
    }
    StoDev.getSingleton = function (element) {
        if (!StoDev.singleton) {
            StoDev.singleton = new StoDev(element);
        }
        return StoDev.singleton;
    };
    return StoDev;
})();

window.onload = function () {
    var el = document.getElementById('content');
    stodev = StoDev.getSingleton(el);
};
//# sourceMappingURL=stodev.js.map
