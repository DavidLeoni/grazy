var makeVar_1 = function (context, varName) {
    if (context[varName]) {
        return context[varName];
    }
    else {
        var handler = {
            get: function (target, name) {
                return name;
            }
        };
        var ret = new Proxy({}, handler);
        ret["@type"] = "Var";
        context[varName] = ret;
        return ret;
    }
};
var Var = function (name) {
    this.name = name;
};
var makeVar = function (name) {
    var Z = {};
    Z["@type"] = "Var";
    Z.restVar = false;
    Z.name = name;
    Z[Symbol.iterator] = function () {
        var isDone = false;
        return {
            next: function () {
                var ret = {
                    done: isDone,
                    value: Z
                };
                Z["@restVar"] = true;
                isDone = !isDone;
                return ret;
            }
        };
    };
    return Z;
};
var Grazy = {};
Grazy.matchStack = [];
var isVar = function (v) { return v && v["@type"] === "Var"; };
var PatternErr = function (err, patternNum) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    this.err = err;
    this.patternNum = patternNum;
    this.args = args;
    console.error(args);
};
var match = function (args) {
    var patterns = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        patterns[_i - 1] = arguments[_i];
    }
    var ctx = {};
    Grazy.matchStack.push(ctx);
    var isPattern = true;
    var p = null;
    var e = null;
    var patternCount = 0;
    for (var _a = 0; _a < args.length; _a++) {
        var arg = args[_a];
        for (var _b = 0; _b < patterns.length; _b++) {
            var ps = patterns[_b];
            if (patternCount % 2 === 0) {
                p = ps;
                continue;
            }
            else {
                e = ps;
                if (Array.isArray(p)) {
                    if (!Array.isArray(arg)) {
                        return new PatternErr(new Error(), patternCount, "found array in pattern ", patternCount, "but not in argument ", arg);
                    }
                }
                patternCount += 1;
            }
        }
    }
    Grazy.matchStack.pop();
};
var Person = function () {
};
var _ = makeVar("any");
var X = makeVar("X");
var Y = makeVar("Y");
var XS = makeVar("XS");
match([1, 2], [[], X], 4);
var mres = match([1, 2], [X, Y], [X, X], _, 3);
console.log("mres = ", mres);
var myf = function (a, b) {
    return match(arguments, [X], [X, X], _, 3);
};
//# sourceMappingURL=pattern-test-3.js.map