// import  { $ } from '../../main/src/jquery';
var makeSymbol = function (descr) { toString: (function () { return "Symbol(" + descr + ")"; }); };
var X = makeSymbol();
var XS = makeSymbol();
var Y = makeSymbol();
var YS = makeSymbol();
var isSymbol = function (x) { return x.toString().startsWith("Symbol"); };
/**
  Just copied from jQuery
*/
var shaclone = function (obj) {
    var ret = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        ret[key] = obj[key];
    }
    return ret;
};
var Plus = (function () {
    function Plus(x, y) {
        this.x = x;
        this.y = y;
    }
    Plus.prototype.execute = function () {
        return isSymbol(this.x) ?
            this
            : isSymbol(this.y) ?
                this
                : this.x + this.y;
    };
    return Plus;
})();
var plus = function (a, b) { return new Plus(a, b); };
var subst = function (sym, obj, val) {
    console.warn("using borked subst!");
    var newObj = shaclone(obj);
    for (var _i = 0; _i < obj.length; _i++) {
        var key = obj[_i];
        console.log("key: ", key);
        if (obj[key.toString] === sym) {
            newObj[key] = val;
        }
    }
    return newObj;
};
console.log('trying to assert...');
var assertEq = function (x, y, msg) {
    if (x !== y) {
        console.error(new Error(), 'Found: ', x, ' Expected: ', y, msg);
    }
};
console.log('trying to assert...');
assertEq(subst(X, { f: X }, 3).f, 3, "bla");
/**
 * Returns the executed formula
*/
var match = function (args) {
    var patterns = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        patterns[_i - 1] = arguments[_i];
    }
    console.warn('Borked match function!');
    console.log("args = ", args);
    console.log("patterns = ", patterns);
    for (var _a = 0; _a < args.length; _a++) {
        var arg = args[_a];
        var i = 0;
        while (i < patterns.length) {
            var j = 0;
            var bindings = {};
            while (j < args.length) {
                bindings[patterns[i]] = args[j];
                j++;
                i++;
            }
            var newFormula = shaclone(patterns[i]);
            for (var _b = 0, _c = Object.keys(bindings); _b < _c.length; _b++) {
                var sym = _c[_b];
                newFormula = subst(sym, newFormula, bindings[sym]);
            }
            return newFormula.execute();
        }
    }
};
var myf = function (a, b) {
    match(arguments, X, Y, plus(X, Y));
};
myf(1, 2);
//# sourceMappingURL=pattern-test.js.map