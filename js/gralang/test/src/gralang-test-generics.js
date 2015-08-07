var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var AC = (function () {
    function AC() {
    }
    AC.prototype.f = function () { return null; };
    ;
    return AC;
})();
/**
 * Without fields or functions, strange assignments can happen!
 */
function testA() {
    var a1;
    var a2;
    a1 = a2;
    var ai1;
    var ai2;
    // cannot ai1 = ai2;
    var ac1;
    var ac2;
    // cannot ac1 = ac2;
}
var B = (function () {
    function B() {
    }
    B.prototype.f = function () {
        return null;
    };
    ;
    return B;
})();
var Z = (function (_super) {
    __extends(Z, _super);
    function Z() {
        _super.apply(this, arguments);
    }
    return Z;
})(B);
/**
 * B has field, we can't do it:
 */
function testB() {
    var b1 = new B();
    var b2 = new B();
    console.log(b1.data);
    //b1 = b2;		
}
/* cannot do this:
class C extends B<string> {
    f() : number{
        return null;
    };
} */
var E = (function (_super) {
    __extends(E, _super);
    function E() {
        _super.apply(this, arguments);
    }
    return E;
})(B);
var D = (function () {
    function D() {
    }
    return D;
})();
function testD() {
    // doesn't work: let d1 : D<C>;
}
var WithPropertyImpl = (function () {
    function WithPropertyImpl() {
    }
    Object.defineProperty(WithPropertyImpl.prototype, "prop", {
        /**
         * Need to implement at least the getter:
         */
        get: function () {
            return 3;
        },
        enumerable: true,
        configurable: true
    });
    return WithPropertyImpl;
})();
function testWithProperty() {
    // can't do it (of course!) let wp1 : WithProperty = new WithProperty();	
    var wp2 = new WithPropertyImpl();
}
//# sourceMappingURL=gralang-test-generics.js.map