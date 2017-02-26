define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * The reference gralang implementation
     */
    var _Trial = (function () {
        function _Trial(s) {
            this._s = s;
        }
        _Trial.prototype.sing = function () {
            return this._s;
        };
        return _Trial;
    }());
    function Trial(z) {
        if (z) {
            return new _Trial(z);
        }
        else {
            return new _Trial("bah");
        }
    }
    exports.Trial = Trial;
    var Trials;
    (function (Trials) {
        function println(s) {
            console.log(s);
        }
        Trials.println = println;
        ;
    })(Trials = exports.Trials || (exports.Trials = {}));
});
//# sourceMappingURL=test-modules-3-impl.js.map