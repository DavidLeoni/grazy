var StoCAS;
(function (StoCAS) {
    var StoError = (function () {
        function StoError(message) {
            this.message = "StoCAS error: " + message;
        }
        StoError.prototype.getCode = function () {
            return this.code;
        };
        return StoError;
    })();
    StoCAS.StoError = StoError;

    var Var = (function () {
        function Var(label) {
            this.label = label;
        }
        /**
        x <- y
        */
        Var.prototype.subst = function (x, y) {
            if (x === y) {
                return x;
            } else {
                return y;
            }
        };

        Var.prototype.toList = function () {
            return list();
        };
        return Var;
    })();
    StoCAS.Var = Var;

    StoCAS.nil = new Nil();

    function list() {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            args[_i] = arguments[_i + 0];
        }
    }
    StoCAS.list = list;

    var Cons = (function () {
        function Cons(el, body) {
            this._head = el;
            this._next = body;
        }
        Cons.prototype.next = function () {
            return this._next;
        };

        Cons.prototype.head = function () {
            return this._head;
        };
        return Cons;
    })();
    StoCAS.Cons = Cons;

    var Nil = (function () {
        function Nil() {
        }
        /**
        [1,2].slice(2,2) returns [] . I will be less forgiving.
        */
        Nil.prototype.next = function () {
            throw new StoError("Called next() on an empty list");
        };

        /**
        [].pop() returns undefined . I will be less forgiving.
        */
        Nil.prototype.head = function () {
            throw new StoError("Called head() on an empty list");
        };
        return Nil;
    })();
    StoCAS.Nil = Nil;

    var Lambda = (function () {
        function Lambda() {
        }
        Lambda.prototype.Lambda = function (v, body) {
            this.v = v;
            this.body = body;
        };

        Lambda.prototype.subst = function (x, y) {
            if (this.v === x) {
                return this;
            } else {
                return new Lambda(this.v, new Apply(new Lambda(x, this.body), y));
            }
        };

        Lambda.prototype.toList = function () {
            return;
        };
        return Lambda;
    })();
    StoCAS.Lambda = Lambda;

    function substapp(x, y, body) {
        return new Apply(new Lambda(x, body), y);
    }

    var Apply = (function () {
        function Apply() {
        }
        Apply.prototype.constructor = function (f, arg) {
            this.f = f;
            this.arg = arg;
        };
        Apply.prototype.exec = function () {
            if (this.f instanceof Var) {
                return new Apply(this.f, this.arg.exec());
            }

            if (this.f instanceof Apply) {
                return new Apply(this.f.exec(), this.arg);
            }

            return;
        };
        Apply.prototype.subst = function (x, y) {
            return new Apply(new Lambda(x, this.f), new Lambda());
        };
        return Apply;
    })();

    var NotTerminating = (function () {
        function NotTerminating() {
        }
        return NotTerminating;
    })();
    StoCAS.NotTerminating = NotTerminating;
})(StoCAS || (StoCAS = {}));
