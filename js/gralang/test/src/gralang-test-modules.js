define(["require", "exports"], function (require, exports) {
    var A;
    (function (A) {
    })(A || (A = {}));
    var B;
    (function (B) {
    })(B || (B = {}));
    function testAB() {
        var a = A;
        var b = B;
        // doesn't work a = b;
        // doesn't work a.Z
        b = a;
    }
    var C;
    (function (C) {
        var _impl = D;
        function setImplementation(implementation) {
            _impl = implementation;
        }
        C.setImplementation = setImplementation;
        function Z() {
            return _impl.Z();
        }
        C.Z = Z;
        ;
        C.WS = _impl.WS;
        /**
         * Mmm, what about submodule?
         */
        var YS;
        (function (YS) {
        })(YS = C.YS || (C.YS = {}));
    })(C || (C = {}));
    var D;
    (function (D) {
        var _impl = D;
        /**
         * Need to replicate it to respect typing
         */
        function setImplementation(implementation) {
            _impl = implementation;
        }
        D.setImplementation = setImplementation;
        /**
         * With underscore so doesn't clash with function Z()
         */
        var _Z = (function () {
            function _Z() {
            }
            _Z.prototype.f = function () {
                return "";
            };
            return _Z;
        })();
        function Z() {
            return new _Z();
        }
        D.Z = Z;
        ;
        var _WS = (function () {
            function _WS() {
            }
            _WS.prototype.print = function (s) {
                console.log(s);
            };
            return _WS;
        })();
        D.WS = new _WS();
        /**
         * Mmm, what about submodule?
         */
        var YS;
        (function (YS) {
            function pri(s) {
                console.log(s);
            }
            YS.pri = pri;
        })(YS = D.YS || (D.YS = {}));
        var X = (function () {
            function X() {
                return new X();
            }
            X.prototype.f = function () {
                return "a";
            };
            X.of = function () {
                return new X();
            };
            ;
            return X;
        })();
        D.X = X;
        var _V = (function () {
            function _V() {
            }
            _V.prototype.f = function () {
                return "ciao";
            };
            return _V;
        })();
        function V() {
            return new _V();
        }
        D.V = V;
    })(D || (D = {}));
    function testCD() {
        // c will be the namespace
        var c = C;
        // d will be the implementation
        var d = D;
        // this is what happens on import
        c = d; // this is fundamental to prove D respects all requirements of C, if not Typescript will complain.
        // let's try it out:
        var z = c.Z();
        c.WS.print("hello");
        var v = c.V();
        console.log(v.f());
        // note it is also possible to do the other way around (probably not useful):
        d = c;
    }
    exports.default = {};
});
//# sourceMappingURL=gralang-test-modules.js.map