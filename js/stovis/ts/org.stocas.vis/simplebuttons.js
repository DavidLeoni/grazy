/*{# Copyright (c) 2013 Turbulenz Limited #}*/
/// <reference path="../../js/biz.turbulenz/jslib-modular/turbulenz.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/servicedatatypes.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/services.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/aabbtree.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/jsengine_base.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/jsengine.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/fontmanager.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/utilities.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/tzdraw2d.d.ts" />
/// <reference path="../../js/biz.turbulenz/jslib-modular/physics2d.d.ts" />
/// <reference path="htmlcontrols.ts" />
;

;

var SimpleButtonManager = (function () {
    function SimpleButtonManager() {
    }
    SimpleButtonManager.loopButtons = function (callback) {
        var buttons = SimpleButtonManager.buttons;
        var id;
        for (id in buttons) {
            if (buttons.hasOwnProperty(id)) {
                var button = buttons[id];
                callback(button);
            }
        }
    };

    SimpleButtonManager.checkOverlap = function (x, y, button) {
        return (x >= button.left && x <= button.right && y >= button.top && y <= button.bottom);
    };

    SimpleButtonManager.init = function (inputDevice) {
        var _this = this;
        var onMouseUp = function (mouseButton, x, y) {
            SimpleButtonManager.loopButtons(function (button) {
                if (_this.checkOverlap(x, y, button)) {
                    button.callback();
                }
            });
        };
        inputDevice.addEventListener('mouseup', onMouseUp);

        var onMouseOver = function (x, y) {
            var mouseX = x;
            var mouseY = y;
            SimpleButtonManager.loopButtons(function (button) {
                button.hovering = _this.checkOverlap(x, y, button);
            });
        };
        inputDevice.addEventListener('mouseover', onMouseOver);
    };

    SimpleButtonManager.addButton = function (params) {
        var button = {
            id: params.id,
            left: params.left,
            top: params.top,
            right: params.right,
            bottom: params.bottom,
            callback: params.callback,
            hovering: null
        };

        button.hovering = this.checkOverlap(this.mouseX, this.mouseY, button);

        SimpleButtonManager.buttons[button.id] = button;
    };

    SimpleButtonManager.clearButtons = function () {
        SimpleButtonManager.buttons = {};
    };
    SimpleButtonManager.buttons = {};
    return SimpleButtonManager;
})();
//# sourceMappingURL=simplebuttons.js.map
