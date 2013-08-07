var Var = (function () {
    function Var(label) {
        this.label = label;
    }
    Var.prototype.subst = function (x, y) {
        if (x === y) {
            return x;
        } else {
            return y;
        }
    };
    return Var;
})();

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
    return Lambda;
})();

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
