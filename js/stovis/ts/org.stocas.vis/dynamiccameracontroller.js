// Copyright (c) 2010-2011 Turbulenz Limited
/*global VMath: false */
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/turbulenz.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/vmath.d.ts" />
/// <reference path="../../js/biz.turbulenz/0.27/jslib-modular/jsengine_base.d.ts" />
//
// DynamicCameraController
//
var DynamicCameraController = (function () {
    function DynamicCameraController() {
        this.version = 1;
        this.transformTypes = {
            linear: 0
        };
        this.cameraType = {
            fixed: 0,
            rail: 1,
            chase: 2
        };
    }
    DynamicCameraController.prototype.setRate = function (rate) {
        this.rate = rate;
    };

    DynamicCameraController.prototype.setChaseRate = function (rate) {
        this.chaseRate = rate;
    };

    DynamicCameraController.prototype.setTracking = function (isTracking) {
        this.isTracking = isTracking;
    };

    // TODO: are these args really optional?
    DynamicCameraController.prototype.setCameraTargetPos = function (pos, time, delta) {
        // Ignore previous camera move if a new position is set
        var md = this.md;
        var p0 = pos[0];
        var p1 = pos[1];
        var p2 = pos[2];

        this.camTargetPos = md.v3Build(p0, p1, p2);

        this.currentTime = time;
        this.startTime = time;
        this.endTime = this.currentTime + delta;
    };

    DynamicCameraController.prototype.setTrackTarget = function (pos) {
        var md = this.md;
        var p0 = pos[0];
        var p1 = pos[1];
        var p2 = pos[2];

        this.trackCurPos = md.v3Build(p0, p1, p2);
    };

    DynamicCameraController.prototype.setCameraMode = function (mode) {
        var fixedMode = this.cameraType.fixed;
        var railMode = this.cameraType.rail;
        var chaseMode = this.cameraType.chase;
        var camCurPos = this.md.m43Pos(this.camera.matrix);

        switch (mode) {
            case fixedMode:
                this.setCameraTargetPos(camCurPos);
                this.curMode = mode;
                return true;
            case railMode:
                this.curMode = mode;
                return true;
            case chaseMode:
                this.curMode = mode;
                return true;
            default:
                // Not a recognised mode
                return false;
        }
    };

    DynamicCameraController.prototype.snapCameraToTarget = function () {
        var md = this.md;
        md.m43SetPos(this.camera.matrix, this.camTargetPos);
    };

    DynamicCameraController.prototype.isCameraAtTarget = function () {
        var md = this.md;
        return md.v3Equal(md.m43Pos(this.camera.matrix), this.camTargetPos);
    };

    DynamicCameraController.prototype.getLookAtMatrix = function () {
        var md = this.md;
        var up = this.camCurUp;
        var currentPos = md.m43Pos(this.camera.matrix);

        var v3Normalize = md.v3Normalize;
        var v3Cross = md.v3Cross;
        var zaxis = md.v3Sub(currentPos, this.trackCurPos);
        v3Normalize.call(md, zaxis, zaxis);
        var xaxis = v3Cross.call(md, v3Normalize.call(md, up, up), zaxis);
        v3Normalize.call(md, xaxis, xaxis);
        var yaxis = v3Cross.call(md, zaxis, xaxis);

        return md.m43Build(xaxis, yaxis, zaxis, currentPos);
    };

    DynamicCameraController.prototype.transform = function (delta) {
        // Delta already takes into account rate
        var md = this.md;
        var m43Pos = md.m43Pos;
        var v3Normalize = md.v3Normalize;
        var v3ScalarMul = md.v3ScalarMul;
        var v3Add = md.v3Add;
        var v3Lerp = md.v3Lerp;

        var camTargetPos = this.camTargetPos;
        var camCurPos = m43Pos.call(md, this.camera.matrix);
        var posResult = this.camTargetPos;

        if (this.curMode === this.cameraType.rail && this.transformMode === this.transformTypes.linear) {
            posResult = v3Lerp.call(md, camCurPos, camTargetPos, delta);
        }

        if (this.curMode === this.cameraType.chase && this.transformMode === this.transformTypes.linear) {
            var camTar2ChaseTar = md.v3Sub(this.trackCurPos, this.camTargetPos, camTar2ChaseTar);
            var chaseTar2CamCur = md.v3Sub(camCurPos, this.trackCurPos, chaseTar2CamCur);
            var dist = md.v3Length(camTar2ChaseTar);

            v3Normalize.call(md, chaseTar2CamCur, chaseTar2CamCur);

            chaseTar2CamCur = v3ScalarMul.call(md, chaseTar2CamCur, dist);
            var target = v3Add.call(md, this.trackCurPos, chaseTar2CamCur);
            target = v3Lerp.call(md, target, this.camTargetPos, this.chaseRate * delta);

            posResult = v3Lerp.call(md, camCurPos, target, delta);
        }

        md.m43SetPos(this.camera.matrix, posResult);
    };

    DynamicCameraController.prototype.rotate = function () {
        this.camera.matrix = this.getLookAtMatrix();
    };

    DynamicCameraController.prototype.update = function (delta) {
        var updateMatrix = false;
        var fixedMode = this.cameraType.fixed;
        var railMode = this.cameraType.rail;
        var chaseMode = this.cameraType.chase;
        var transformDelta = 0.0;

        this.currentTime += delta * this.rate;

        // If delta is small enough we keep the current transform
        if (delta > VMath.precision) {
            if (!this.isCameraAtTarget()) {
                updateMatrix = true;
                switch (this.curMode) {
                    case fixedMode:
                        this.snapCameraToTarget();
                        break;
                    case railMode:
                        if (this.currentTime < this.endTime) {
                            transformDelta = (this.currentTime - this.startTime) / (this.endTime - this.startTime);
                            this.transform(transformDelta);
                        } else {
                            // Set the matrix to the final transform
                            this.snapCameraToTarget();
                        }
                        break;
                    case chaseMode:
                        if (this.currentTime < this.endTime) {
                            transformDelta = (this.currentTime - this.startTime) / (this.endTime - this.startTime);
                            this.transform(transformDelta);
                        } else {
                            // Set the matrix to the final transform
                            this.snapCameraToTarget();
                        }
                        break;
                }
            }

            if (this.isTracking) {
                updateMatrix = true;
                this.rotate();
            }
        }

        if (updateMatrix) {
            this.camera.updateViewMatrix();
        }
    };

    // Constructor function
    DynamicCameraController.create = function (camera, gd) {
        var c = new DynamicCameraController();

        c.gd = gd;
        c.md = camera.md;
        c.camera = camera;
        c.curMode = c.cameraType.fixed;
        c.camTargetPos = c.md.m43Pos(camera.matrix);
        c.transformMode = c.transformTypes.linear;
        c.rate = 1;
        c.chaseRate = 1;
        c.currentTime = 0.0;
        c.startTime = 0.0;
        c.endTime = 0.0;

        // Up is Y axis up by default
        c.camCurUp = c.md.v3Build(0, 1, 0);

        // Look at center
        c.trackCurPos = c.md.v3BuildZero();
        c.isTracking = false;

        return c;
    };
    return DynamicCameraController;
})();
//# sourceMappingURL=dynamiccameracontroller.js.map
