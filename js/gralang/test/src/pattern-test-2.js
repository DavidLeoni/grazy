var W = Symbol();
var Z = {};
Z[Symbol.iterator] = function () {
    return {
        next: function () {
            return {
                done: true,
                value: 3
            };
        }
    };
};
var WS = function () { };
WS[Symbol.iterator] = Z[Symbol.iterator];
/* generator currently not supported by typescript
    WS[Symbol.iterator] = function* () {
    yield new WS();
}; */
WS.prototype.toString = function () { return "bla WS"; };
var _a = [1, 2], a = _a[0], b = _a[1];
var v = [1, 2];
var myg = function () {
    var vs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        vs[_i - 0] = arguments[_i];
    }
    console.log(vs);
};
myg(1, 2, 3);
myg.apply(void 0, [1, 2]); // nothing to output
myg.apply(void 0, v);
myg.apply(void 0, [1, 2]); // 1 2
myg.apply(void 0, W); // a b
myg([X].concat(WS));
console.log(WS);
//# sourceMappingURL=pattern-test-2.js.map