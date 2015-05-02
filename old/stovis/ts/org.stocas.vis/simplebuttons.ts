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

interface SimpleButtonParams
{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    callback: { (): void; };
    hoverCallback?: { (): void; };
};

interface SimpleButton
{
    id: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    callback: { (): void; };
    hoverCallback?: { (): void; };
    hovering: boolean;
};

class SimpleButtonManager
{
    static buttons : {
        [id: string]: SimpleButton;
    } = {};

    static mouseX: number;
    static mouseY: number;

    static loopButtons(callback)
    {
        var buttons = SimpleButtonManager.buttons;
        var id;
        for (id in buttons)
        {
            if (buttons.hasOwnProperty(id))
            {
                var button = buttons[id];
                callback(button);
            }
        }
    }

    static checkOverlap(x, y, button)
    {
        return (x >= button.left && x <= button.right &&
                y >= button.top && y <= button.bottom);
    }

    static init(inputDevice: InputDevice)
    {
        var onMouseUp = (mouseButton: number, x: number, y: number) =>
        {
            SimpleButtonManager.loopButtons((button: SimpleButton) => {
                if (this.checkOverlap(x, y, button))
                {
                    button.callback();
                }
            });
        };
        inputDevice.addEventListener('mouseup', onMouseUp);

        var onMouseOver = (x: number, y: number) =>
        {
            var mouseX = x;
            var mouseY = y;
            SimpleButtonManager.loopButtons((button: SimpleButton) => {
                button.hovering = this.checkOverlap(x, y, button);
            });
        };
        inputDevice.addEventListener('mouseover', onMouseOver);
    }

    static addButton(params: SimpleButtonParams)
    {
        var button: SimpleButton = {
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
    }

    static clearButtons()
    {
        SimpleButtonManager.buttons = {};
    }
}
