// Copyright (c) 2009-2012 Turbulenz Limited
/*global TurbulenzEngine: false*/
;

;

;

;

;

var AnimationMath = {
    quatPosscalefromm43: function quatPosscalefromm43Fn(matrix, mathDevice) {
        var v3Length = mathDevice.v3Length;
        var v3ScalarMul = mathDevice.v3ScalarMul;
        var v3Build = mathDevice.v3Build;

        var right = mathDevice.m43Right(matrix);
        var up = mathDevice.m43Up(matrix);
        var at = mathDevice.m43At(matrix);

        var sx = v3Length.call(mathDevice, right);
        var sy = v3Length.call(mathDevice, up);
        var sz = v3Length.call(mathDevice, at);
        var det = mathDevice.m43Determinant(matrix);

        var scale = v3Build.call(mathDevice, sx, sy, sz);
        var unitScale = v3Build.call(mathDevice, 1, 1, 1);

        if (!mathDevice.v3Equal(scale, unitScale) || det < 0) {
            if (det < 0) {
                sx *= -1;
                scale = v3Build.call(mathDevice, sx, sy, sz);
            }

            mathDevice.m43SetRight(matrix, v3ScalarMul.call(mathDevice, right, 1 / sx));
            mathDevice.m43SetUp(matrix, v3ScalarMul.call(mathDevice, up, 1 / sy));
            mathDevice.m43SetAt(matrix, v3ScalarMul.call(mathDevice, at, 1 / sz));
        } else {
            scale = unitScale;
        }

        var quat = mathDevice.quatFromM43(matrix);
        var pos = mathDevice.m43Pos(matrix);

        var result = {
            rotation: quat,
            translation: pos,
            scale: scale
        };

        return result;
    }
};

var AnimationChannels = {
    copy: function animationChannelsCopyFn(channels) {
        var channelCopy = {};
        var c;
        for (c in channels) {
            if (channels.hasOwnProperty(c)) {
                channelCopy[c] = true;
            }
        }

        return channelCopy;
    },
    union: function animationChannelsUnionFn(channelsA, channelsB) {
        var channelUnion = {};
        var c;
        for (c in channelsA) {
            if (channelsA.hasOwnProperty(c)) {
                channelUnion[c] = true;
            }
        }
        for (c in channelsB) {
            if (channelsB.hasOwnProperty(c)) {
                channelUnion[c] = true;
            }
        }

        return channelUnion;
    },
    add: function animationChannelsAddFn(channels, newChannels) {
        var c;
        for (c in newChannels) {
            if (newChannels.hasOwnProperty(c)) {
                channels[c] = true;
            }
        }
    }
};

var Animation = {
    minKeyframeDelta: 0.0001,
    standardGetJointWorldTransform: function StandardGetJointWorldTransformFn(controller, jointId, mathDevice, asMatrix) {
        var quatMulTranslate = mathDevice.quatMulTranslate;
        var m43FromRTS = mathDevice.m43FromRTS;
        var m43FromRT = mathDevice.m43FromRT;
        var quatCopy = mathDevice.quatCopy;
        var v3Copy = mathDevice.v3Copy;
        var output = controller.output;
        var hasScale = controller.outputChannels.scale;
        var joint = output[jointId];
        var hierarchyParents = controller.getHierarchy().parents;
        var parentIndex = hierarchyParents[jointId];
        var parentJoint;
        if (hasScale) {
            var m43Mul = mathDevice.m43Mul;
            var parentMatrix;
            var matrix = m43FromRTS.call(mathDevice, joint.rotation, joint.translation, joint.scale);
            while (parentIndex !== -1) {
                parentJoint = output[parentIndex];
                parentMatrix = m43FromRTS.call(mathDevice, parentJoint.rotation, parentJoint.translation, parentJoint.scale, parentMatrix);

                matrix = m43Mul.call(mathDevice, matrix, parentMatrix, matrix);

                parentIndex = hierarchyParents[parentIndex];
            }
            if (asMatrix) {
                return matrix;
            } else {
                // TODO: add to mathdevice
                var result = AnimationMath.quatPosscalefromm43(matrix, mathDevice);
                return {
                    rotation: result.rotation,
                    translation: result.translation
                };
            }
        } else {
            var rotation = quatCopy.call(mathDevice, joint.rotation);
            var translation = v3Copy.call(mathDevice, joint.translation);
            while (parentIndex !== -1) {
                parentJoint = output[parentIndex];

                quatMulTranslate.call(mathDevice, parentJoint.rotation, parentJoint.translation, rotation, translation, rotation, translation);

                parentIndex = hierarchyParents[parentIndex];
            }

            if (asMatrix) {
                return m43FromRT.call(mathDevice, rotation, translation);
            } else {
                return { rotation: rotation, translation: translation };
            }
        }
    }
};

//
// InterpolatorController
//
var InterpolatorController = (function () {
    function InterpolatorController() {
    }
    InterpolatorController.prototype.addTime = function (delta) {
        this.currentTime += delta * this.rate;
        this.dirty = true;
        this.dirtyBounds = true;

        // deal with looping animations, we do this during addTime to ensure callbacks
        // are fired if someone doesn't call update
        var anim = this.currentAnim;
        var animLength = anim.length;

        while (this.currentTime > animLength) {
            var numNodes = this.hierarchy.numNodes;
            var index;

            for (index = 0; index < numNodes; index += 1) {
                this.translationEndFrames[index] = 0;
                this.rotationEndFrames[index] = 0;
                this.scaleEndFrames[index] = 0;
            }

            if (this.onUpdateCallback) {
                // call the update callback as though we're at the end of the animation
                var tempTime = this.currentTime;
                this.currentTime = animLength;
                this.onUpdateCallback(this);
                if (this.currentTime === animLength) {
                    // Only restore the old time if the update callback didn't change it
                    this.currentTime = tempTime;
                } else if (this.currentTime < animLength) {
                    // If the update callback reset the animation to a valid state don't continue
                    return;
                }
            }

            if (this.looping) {
                if (this.onLoopCallback) {
                    if (!this.onLoopCallback(this)) {
                        return;
                    }
                }
                this.currentTime -= animLength;
            } else {
                if (this.onFinishedCallback) {
                    if (!this.onFinishedCallback(this)) {
                        return;
                    }
                }
                this.currentTime = animLength;
            }
        }

        if (this.onUpdateCallback) {
            this.onUpdateCallback(this);
        }
    };

    InterpolatorController.prototype.update = function () {
        var mathDevice = this.mathDevice;

        var anim = this.currentAnim;
        var nodeData = anim.nodeData;
        var numJoints = this.hierarchy.numNodes;
        var outputArray = this.output;

        var animHasScale = anim.channels.scale;

        var defaultScale;
        if (animHasScale) {
            defaultScale = mathDevice.v3Build(1, 1, 1);
        }

        var scratchPad = InterpolatorController.prototype.scratchPad;
        var v1 = scratchPad.v1;
        var v2 = scratchPad.v2;
        var q1 = scratchPad.q1;
        var q2 = scratchPad.q2;
        var delta, j;

        for (j = 0; j < numJoints; j += 1) {
            var data = nodeData[j];
            var jointChannels = data.channels;
            var jointHasScale = jointChannels ? jointChannels.scale : animHasScale;
            var hasScale = jointHasScale || animHasScale;
            var jointKeys = data.keyframes;
            var jointBase = data.baseframe;
            var baseQuat, basePos, baseScale;
            var jointOutput = outputArray[j];

            if (jointBase) {
                baseQuat = jointBase.rotation;
                basePos = jointBase.translation;
                baseScale = jointBase.scale;

                /*jshint bitwise: false*/
                jointHasScale = jointHasScale || (baseScale !== undefined);
                /*jshint bitwise: true*/
            }

            if (!jointKeys) {
                // Completely non animated joint so copy the base
                jointOutput.rotation = mathDevice.quatCopy(baseQuat, jointOutput.rotation);
                jointOutput.translation = mathDevice.v3Copy(basePos, jointOutput.translation);
                if (hasScale) {
                    if (jointHasScale) {
                        jointOutput.scale = mathDevice.v3Copy(baseScale, jointOutput.scale);
                    } else {
                        jointOutput.scale = mathDevice.v3Copy(defaultScale, jointOutput.scale);
                    }
                }
            } else {
                // Find the pair of keys wrapping current time
                var offset = 0;
                var stride = 0;
                var offsetMinusStride = 0;
                var endFrameOffset = 0;
                var channels = data.channels;
                if (channels.rotation) {
                    stride = channels.rotation.stride;
                    offset = channels.rotation.offset;
                    endFrameOffset = offset + (channels.rotation.count - 1) * stride;

                    if (this.currentTime <= jointKeys[offset]) {
                        jointOutput.rotation = mathDevice.quatBuild(jointKeys[offset + 1], jointKeys[offset + 2], jointKeys[offset + 3], jointKeys[offset + 4], jointOutput.rotation);
                    } else if (this.currentTime >= jointKeys[endFrameOffset]) {
                        jointOutput.rotation = mathDevice.quatBuild(jointKeys[endFrameOffset + 1], jointKeys[endFrameOffset + 2], jointKeys[endFrameOffset + 3], jointKeys[endFrameOffset + 4], jointOutput.rotation);
                    } else {
                        offset = this.rotationEndFrames[j] || offset;

                        while (this.currentTime > jointKeys[offset]) {
                            offset += stride;
                        }

                        this.rotationEndFrames[j] = offset;
                        offsetMinusStride = offset - stride;

                        delta = (this.currentTime - jointKeys[offsetMinusStride]) / (jointKeys[offset] - jointKeys[offsetMinusStride]);

                        q1[0] = jointKeys[offsetMinusStride + 1];
                        q1[1] = jointKeys[offsetMinusStride + 2];
                        q1[2] = jointKeys[offsetMinusStride + 3];
                        q1[3] = jointKeys[offsetMinusStride + 4];

                        q2[0] = jointKeys[offset + 1];
                        q2[1] = jointKeys[offset + 2];
                        q2[2] = jointKeys[offset + 3];
                        q2[3] = jointKeys[offset + 4];

                        jointOutput.rotation = mathDevice.quatSlerp(q1, q2, delta, jointOutput.rotation);
                    }
                } else {
                    jointOutput.rotation = mathDevice.quatCopy(baseQuat, jointOutput.rotation);
                }

                if (channels.translation) {
                    stride = channels.translation.stride;
                    offset = channels.translation.offset;

                    endFrameOffset = offset + (channels.translation.count - 1) * stride;

                    if (this.currentTime <= jointKeys[offset]) {
                        jointOutput.translation = mathDevice.v3Build(jointKeys[offset + 1], jointKeys[offset + 2], jointKeys[offset + 3], jointOutput.translation);
                    } else if (this.currentTime >= jointKeys[endFrameOffset]) {
                        jointOutput.translation = mathDevice.v3Build(jointKeys[endFrameOffset + 1], jointKeys[endFrameOffset + 2], jointKeys[endFrameOffset + 3], jointOutput.translation);
                    } else {
                        offset = this.translationEndFrames[j] || offset;

                        while (this.currentTime > jointKeys[offset]) {
                            offset += stride;
                        }

                        this.translationEndFrames[j] = offset;
                        offsetMinusStride = offset - stride;

                        delta = (this.currentTime - jointKeys[offsetMinusStride]) / (jointKeys[offset] - jointKeys[offsetMinusStride]);

                        v1[0] = jointKeys[offsetMinusStride + 1];
                        v1[1] = jointKeys[offsetMinusStride + 2];
                        v1[2] = jointKeys[offsetMinusStride + 3];

                        v2[0] = jointKeys[offset + 1];
                        v2[1] = jointKeys[offset + 2];
                        v2[2] = jointKeys[offset + 3];

                        jointOutput.translation = mathDevice.v3Lerp(v1, v2, delta, jointOutput.translation);
                    }
                } else {
                    jointOutput.translation = mathDevice.v3Copy(basePos, jointOutput.translation);
                }

                if (channels.scale) {
                    stride = channels.scale.stride;
                    offset = channels.scale.offset;

                    endFrameOffset = offset + (channels.scale.count - 1) * stride;

                    if (this.currentTime <= jointKeys[offset]) {
                        jointOutput.scale = mathDevice.v3Build(jointKeys[offset + 1], jointKeys[offset + 2], jointKeys[offset + 3], jointOutput.scale);
                    } else if (this.currentTime >= jointKeys[endFrameOffset]) {
                        jointOutput.scale = mathDevice.v3Build(jointKeys[endFrameOffset + 1], jointKeys[endFrameOffset + 2], jointKeys[endFrameOffset + 3], jointOutput.scale);
                    } else {
                        offset = this.scaleEndFrames[j] || offset;

                        while (this.currentTime > jointKeys[offset]) {
                            offset += stride;
                        }

                        this.scaleEndFrames[j] = offset;
                        offsetMinusStride = offset - stride;

                        delta = (this.currentTime - jointKeys[offsetMinusStride]) / (jointKeys[offset] - jointKeys[offsetMinusStride]);

                        v1[0] = jointKeys[offsetMinusStride + 1];
                        v1[1] = jointKeys[offsetMinusStride + 2];
                        v1[2] = jointKeys[offsetMinusStride + 3];

                        v2[0] = jointKeys[offset + 1];
                        v2[1] = jointKeys[offset + 2];
                        v2[2] = jointKeys[offset + 3];

                        jointOutput.scale = mathDevice.v3Lerp(v1, v2, delta, jointOutput.scale);
                    }
                } else {
                    if (hasScale) {
                        if (jointHasScale) {
                            jointOutput.scale = mathDevice.v3Copy(baseScale, jointOutput.scale);
                        } else {
                            jointOutput.scale = mathDevice.v3Copy(defaultScale, jointOutput.scale);
                        }
                    }
                }
            }
        }

        this.dirty = false;

        if (this.dirtyBounds) {
            this.updateBounds();
        }
    };

    InterpolatorController.prototype.updateBounds = function () {
        if (!this.dirtyBounds) {
            return;
        }

        this.dirtyBounds = false;

        var currentTime = this.currentTime;
        var anim = this.currentAnim;
        var mathDevice = this.mathDevice;
        var ibounds = this.bounds;

        // work out the offset in the frame list and the delta between frame pairs
        var bounds = anim.bounds;
        var numFrames = bounds.length;
        if (currentTime > bounds[numFrames - 1].time) {
            // copy the end bounds
            var endBounds = bounds[numFrames - 1];
            ibounds.center = mathDevice.v3Copy(endBounds.center, ibounds.center);
            ibounds.halfExtent = mathDevice.v3Copy(endBounds.halfExtent, ibounds.halfExtent);
            return;
        }

        if (currentTime < bounds[0].time) {
            // copy the start bounds
            var startBounds = bounds[0];
            ibounds.center = mathDevice.v3Copy(startBounds.center, ibounds.center);
            ibounds.halfExtent = mathDevice.v3Copy(startBounds.halfExtent, ibounds.halfExtent);
            return;
        }

        var endBound = 1;
        while (currentTime > bounds[endBound].time) {
            endBound += 1;
        }

        var startBound = (endBound - 1);
        var boundsStart = bounds[startBound];
        var boundsEnd = bounds[endBound];
        var startTime = boundsStart.time;
        var endTime = boundsEnd.time;
        var delta = (currentTime - startTime) / (endTime - startTime);

        // If delta is close to the limits we just copy the bounds
        var minKeyframeDelta = Animation.minKeyframeDelta;
        if (delta < minKeyframeDelta) {
            // copy the bounds
            ibounds.center = mathDevice.v3Copy(boundsStart.center, ibounds.center);
            ibounds.halfExtent = mathDevice.v3Copy(boundsStart.halfExtent, ibounds.halfExtent);
        } else if ((1.0 - delta) < minKeyframeDelta) {
            // copy the bounds
            ibounds.center = mathDevice.v3Copy(boundsEnd.center, ibounds.center);
            ibounds.halfExtent = mathDevice.v3Copy(boundsEnd.halfExtent, ibounds.halfExtent);
        } else {
            // accumulate the bounds as average of the center position and max of the extent
            // plus the half distance between the centers
            var centerSum = mathDevice.v3Add(boundsStart.center, boundsEnd.center, ibounds.center);
            var newCenter = mathDevice.v3ScalarMul(centerSum, 0.5, centerSum);
            ibounds.center = newCenter;

            var newExtent = mathDevice.v3Max(boundsStart.halfExtent, boundsEnd.halfExtent, ibounds.halfExtent);
            var centerOffset = mathDevice.v3Sub(boundsStart.center, newCenter, this.scratchPad.v1);
            centerOffset = mathDevice.v3Abs(centerOffset, centerOffset);
            ibounds.halfExtent = mathDevice.v3Add(newExtent, centerOffset, newExtent);
        }
    };

    InterpolatorController.prototype._updateBoundsNoop = function () {
        this.dirtyBounds = false;
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    InterpolatorController.prototype.getJointTransform = function (jointId) {
        var mathDevice = this.mathDevice;
        var m43FromRTS = mathDevice.m43FromRTS;
        var m43FromRT = mathDevice.m43FromRT;
        var quatSlerp = mathDevice.quatSlerp;
        var v3Lerp = mathDevice.v3Lerp;

        var anim = this.currentAnim;
        var animHasScale = anim.channels.scale;
        if (this.dirty) {
            var nodeData = anim.nodeData;

            var jointKeys = nodeData[jointId].keyframes;
            var jointBase = nodeData[jointId].jointBase;

            var jointChannels = nodeData[jointId].channels;
            var jointHasScale = jointChannels ? jointChannels.scale : animHasScale;
            var hasScale = jointHasScale || animHasScale;

            var baseQuat, basePos, baseScale;
            if (jointBase) {
                baseQuat = jointBase.rotation;
                basePos = jointBase.translation;
                baseScale = jointBase.scale;
            }

            if (!jointKeys) {
                if (hasScale) {
                    return m43FromRTS.call(mathDevice, baseQuat, basePos, baseScale || mathDevice.v3Build(1, 1, 1));
                } else {
                    return m43FromRT.call(mathDevice, baseQuat, basePos);
                }
            } else {
                // Find the pair of keys wrapping current time
                var endFrame = 1;
                while (this.currentTime > jointKeys[endFrame].time) {
                    endFrame += 1;
                }
                var startFrame = endFrame - 1;
                var startTime = jointKeys[startFrame].time;
                var endTime = jointKeys[endFrame].time;
                var delta = (this.currentTime - startTime) / (endTime - startTime);

                if (delta < Animation.minKeyframeDelta) {
                    var thisKey = jointKeys[startFrame];
                    if (hasScale) {
                        return m43FromRTS.call(mathDevice, thisKey.rotation || baseQuat, thisKey.translation || basePos, thisKey.scale || baseScale || mathDevice.v3Build(1, 1, 1));
                    } else {
                        return m43FromRT.call(mathDevice, thisKey.rotation || baseQuat, thisKey.translation || basePos);
                    }
                } else {
                    // For each joint slerp between the quats and return the quat pos result
                    var k1 = jointKeys[startFrame];
                    var k2 = jointKeys[endFrame];

                    var q1 = k1.rotation || baseQuat;
                    var q2 = k2.rotation || baseQuat;
                    var rotation = quatSlerp.call(mathDevice, q1, q2, delta);

                    var pos1 = k1.translation || basePos;
                    var pos2 = k2.translation || basePos;
                    var translation = v3Lerp.call(mathDevice, pos1, pos2, delta);

                    if (hasScale) {
                        var scale;
                        if (jointHasScale) {
                            var s1 = k1.scale || baseScale;
                            var s2 = k2.scale || baseScale;

                            scale = v3Lerp.call(mathDevice, s1, s2, delta);
                        } else {
                            scale = mathDevice.v3Build(1, 1, 1);
                        }
                        return m43FromRTS.call(mathDevice, rotation, translation, scale);
                    } else {
                        return m43FromRT.call(mathDevice, rotation, translation);
                    }
                }
            }
        } else {
            var jointOutput = this.output[jointId];
            if (animHasScale) {
                return m43FromRTS.call(mathDevice, jointOutput.rotation, jointOutput.translation, jointOutput.scale);
            } else {
                return m43FromRT.call(mathDevice, jointOutput.rotation, jointOutput.translation);
            }
        }
    };

    InterpolatorController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        if (this.dirty) {
            // May as well do a full update since we're accessing the output randomly
            this.update();
        }

        return Animation.standardGetJointWorldTransform(this, jointId, this.mathDevice, asMatrix);
    };

    InterpolatorController.prototype.setAnimation = function (animation, looping) {
        this.currentAnim = animation;
        this.currentTime = 0.0;
        var index;
        var numNodes = this.hierarchy.numNodes;

        if (!this.translationEndFrames || this.translationEndFrames.length !== numNodes) {
            this.translationEndFrames = new Uint32Array(numNodes);
            this.rotationEndFrames = new Uint32Array(numNodes);
            this.scaleEndFrames = new Uint32Array(numNodes);
        } else {
            for (index = 0; index < numNodes; index += 1) {
                this.translationEndFrames[index] = 0;
                this.rotationEndFrames[index] = 0;
                this.scaleEndFrames[index] = 0;
            }
        }

        this.dirty = true;
        this.dirtyBounds = true;
        if (looping) {
            this.looping = true;
        } else {
            this.looping = false;
        }

        this.outputChannels = AnimationChannels.copy(animation.channels);

        // Check if we need to update bounds
        var bounds = animation.bounds;
        var numFrames = bounds.length;
        debug.assert(0 < numFrames);
        var centerStart = bounds[0].center;
        var halfExtentStart = bounds[0].halfExtent;
        var n;
        for (n = 1; n < numFrames; n += 1) {
            var frame = bounds[n];
            var center = frame.center;
            var halfExtent = frame.halfExtent;
            if (centerStart[0] !== center[0] || centerStart[1] !== center[1] || centerStart[2] !== center[2] || halfExtentStart[0] !== halfExtent[0] || halfExtentStart[1] !== halfExtent[1] || halfExtentStart[2] !== halfExtent[2]) {
                break;
            }
        }
        if (n < numFrames) {
            this.updateBounds = InterpolatorController.prototype.updateBounds;
        } else {
            this.updateBounds = InterpolatorController.prototype._updateBoundsNoop;

            var ibounds = this.bounds;
            var mathDevice = this.mathDevice;
            ibounds.center = mathDevice.v3Copy(centerStart, ibounds.center);
            ibounds.halfExtent = mathDevice.v3Copy(halfExtentStart, ibounds.halfExtent);
        }
    };

    InterpolatorController.prototype.setTime = function (time) {
        this.currentTime = time;
        this.dirty = true;
        this.dirtyBounds = true;
        var numNodes = this.hierarchy.numNodes;
        var index;

        for (index = 0; index < numNodes; index += 1) {
            this.translationEndFrames[index] = 0;
            this.rotationEndFrames[index] = 0;
            this.scaleEndFrames[index] = 0;
        }
    };

    InterpolatorController.prototype.setRate = function (rate) {
        this.rate = rate;
    };

    InterpolatorController.prototype.getHierarchy = function () {
        return this.hierarchy;
    };

    InterpolatorController.create = // Constructor function
    function (hierarchy) {
        var i = new InterpolatorController();
        i.hierarchy = hierarchy;

        var md = TurbulenzEngine.getMathDevice();
        i.mathDevice = md;
        i.bounds = { center: md.v3BuildZero(), halfExtent: md.v3BuildZero() };

        var output = [];
        i.output = output;
        i.outputChannels = {};
        var numJoints = hierarchy.numNodes;
        for (var j = 0; j < numJoints; j += 1) {
            output[j] = {};
        }
        i.rate = 1.0;
        i.currentTime = 0.0;
        i.looping = false;
        i.dirty = true;
        i.dirtyBounds = true;

        if (!InterpolatorController.prototype.scratchPad) {
            InterpolatorController.prototype.scratchPad = {
                v1: md.v3BuildZero(),
                v2: md.v3BuildZero(),
                q1: md.quatBuild(0, 0, 0, 1),
                q2: md.quatBuild(0, 0, 0, 1)
            };
        }

        return i;
    };
    InterpolatorController.version = 1;
    return InterpolatorController;
})();
InterpolatorController.prototype.scratchV3 = null;

// This controller works off a base interpolator and copies all it's output data
// but allows a list of controllers and nodes to overload the output
// Note it only overloads the output quat pos and not any bounds etc
var OverloadedNodeController = (function () {
    function OverloadedNodeController() {
    }
    OverloadedNodeController.prototype.addTime = function (delta) {
        this.dirty = true;
        this.dirtyBounds = true;

        this.baseController.addTime(delta);
    };

    OverloadedNodeController.prototype.update = function () {
        this.baseController.update();

        var nodeOverloads = this.nodeOverloads;
        var numOverloads = nodeOverloads.length;
        var output = this.output;
        for (var o = 0; o < numOverloads; o += 1) {
            var overload = nodeOverloads[o];
            var overloadSource = overload.sourceController;
            if (overloadSource.dirty) {
                overloadSource.update();
            }
            output[overload.overloadIndex] = overloadSource.getJointWorldTransform(overload.sourceIndex);
            if (this.outputChannels.scale && !overloadSource.outputChannels.scale) {
                output[overload.overloadIndex].scale = this.mathDevice.v3Build(1, 1, 1);
            }
        }

        this.dirty = false;

        if (this.dirtyBounds) {
            this.baseController.updateBounds();
            this.dirtyBounds = false;
        }
    };

    OverloadedNodeController.prototype.updateBounds = function () {
        if (this.dirtyBounds) {
            this.baseController.updateBounds();
            this.dirtyBounds = false;
        }
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    OverloadedNodeController.prototype.getJointTransform = function (jointId) {
        // TODO: check if the jointId is overloaded and return the correct one
        return this.baseController.getJointTransform(jointId);
    };

    OverloadedNodeController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        // TODO: check if the jointId is overloaded and return the correct one
        return this.baseController.getJointWorldTransform(jointId, asMatrix);
    };

    OverloadedNodeController.prototype.getHierarchy = function () {
        return this.baseController.getHierarchy();
    };

    OverloadedNodeController.prototype.addOverload = function (sourceController, sourceIndex, overloadIndex) {
        // TODO: should ensure the dest overload index is unique in the list
        AnimationChannels.add(this.outputChannels, sourceController.outputChannels);
        this.nodeOverloads.push({
            sourceController: sourceController,
            sourceIndex: sourceIndex,
            overloadIndex: overloadIndex
        });
    };

    OverloadedNodeController.create = // Constructor function
    function (baseController) {
        var c = new OverloadedNodeController();
        c.baseController = baseController;
        c.bounds = baseController.bounds;
        c.output = baseController.output;
        c.outputChannels = {};
        c.nodeOverloads = [];
        c.dirty = true;
        c.dirtyBounds = true;

        c.mathDevice = TurbulenzEngine.getMathDevice();

        return c;
    };
    OverloadedNodeController.version = 1;
    return OverloadedNodeController;
})();

var ReferenceController = (function () {
    function ReferenceController() {
    }
    ReferenceController.create = // Constructor function
    function (baseController) {
        /*jshint proto:true*/
        var c = new ReferenceController();

        /*jshint nomen: false*/
        /*jshint proto: true*/
        c.__proto__ = baseController;

        /*jshint proto: false*/
        /*jshint nomen: true*/
        var setReferenceController = function setReferenceControllerFn(controller) {
            var referenceSource = this.referenceSource;
            delete this.referenceSource;
            delete this.setReferenceController;
            for (var p in this) {
                if (this.hasOwnProperty(p)) {
                    referenceSource[p] = this[p];
                    delete this[p];
                }
            }

            /*jshint nomen: false*/
            /*jshint proto: true*/
            this.__proto__ = controller;

            /*jshint proto: false*/
            /*jshint nomen: true*/
            this.referenceSource = controller;
            this.setReferenceController = setReferenceController;
        };

        c.referenceSource = baseController;
        c.setReferenceController = setReferenceController;

        /*jshint proto:false*/
        return c;
    };
    return ReferenceController;
})();

// The TransitionController interpolates between the fixed state of
// input controllers across a period of time
var TransitionController = (function () {
    function TransitionController() {
    }
    TransitionController.prototype.addTime = function (delta) {
        this.dirty = true;

        // Note we don't dirty the bounds since we simply use the merged bounds of fixed states
        this.transitionTime += delta;

        while (this.transitionTime > this.transitionLength) {
            if (this.onFinishedTransitionCallback) {
                if (!this.onFinishedTransitionCallback(this)) {
                    return;
                }
            }
            this.transitionTime = this.transitionLength;
        }

        if (this.onUpdateCallback) {
            this.onUpdateCallback(this);
        }
    };

    TransitionController.prototype.update = function () {
        var mathDevice = this.mathDevice;
        var quatSlerp = mathDevice.quatSlerp;
        var v3Lerp = mathDevice.v3Lerp;
        var v3Copy = mathDevice.v3Copy;

        this.startController.update();
        this.endController.update();

        var output = this.output;
        var outputChannels = this.outputChannels;
        var outputScale = outputChannels.scale;
        var scaleOnStart = this.startController.outputChannels.scale;
        var scaleOnEnd = this.endController.outputChannels.scale;

        var startOutput = this.startController.output;
        var endOutput = this.endController.output;
        var delta = this.transitionTime / this.transitionLength;

        // For each joint slerp between the quats and return the quat pos result
        var numJoints = this.startController.getHierarchy().numNodes;
        for (var j = 0; j < numJoints; j += 1) {
            if (!output[j]) {
                output[j] = {};
            }
            var j1 = startOutput[j];
            var j2 = endOutput[j];

            output[j].rotation = quatSlerp.call(mathDevice, j1.rotation, j2.rotation, delta, output[j].rotation);
            output[j].translation = v3Lerp.call(mathDevice, j1.translation, j2.translation, delta, output[j].translation);

            if (outputScale) {
                if (scaleOnStart) {
                    if (scaleOnEnd) {
                        output[j].scale = v3Lerp.call(mathDevice, j1.scale, j2.scale, delta, output[j].scale);
                    } else {
                        output[j].scale = v3Copy.call(mathDevice, j1.scale, output[j].scale);
                    }
                } else if (scaleOnEnd) {
                    output[j].scale = v3Copy.call(mathDevice, j2.scale, output[j].scale);
                }
            }
        }

        this.dirty = false;

        if (this.dirtyBounds) {
            this.updateBounds();
        }
    };

    TransitionController.prototype.updateBounds = function () {
        var startController = this.startController;
        var endController = this.endController;
        if (startController.dirtyBounds) {
            startController.updateBounds();
        }
        if (endController.dirtyBounds) {
            endController.updateBounds();
        }

        // accumulate the bounds as average of the center position and max of the extent
        // plus the half distance between the centers
        var boundsStart = startController.bounds;
        var boundsEnd = endController.bounds;

        var mathDevice = this.mathDevice;
        var v3Add = mathDevice.v3Add;

        var centerSum = v3Add.call(mathDevice, boundsStart.center, boundsEnd.center);
        var newCenter = mathDevice.v3ScalarMul(centerSum, 0.5, centerSum);
        this.bounds.center = newCenter;
        var newExtent = mathDevice.v3Max(boundsStart.halfExtent, boundsEnd.halfExtent);

        // Calc the largest extent for all axis
        var max = Math.max;
        var maxExt = max(newExtent[0], max(newExtent[1], newExtent[2]));
        newExtent = mathDevice.v3Build(maxExt, maxExt, maxExt);

        var centerOffset = mathDevice.v3Sub(boundsStart.center, newCenter);
        centerOffset = mathDevice.v3Abs(centerOffset, centerOffset);
        this.bounds.halfExtent = v3Add.call(mathDevice, newExtent, centerOffset, newExtent);

        this.dirtyBounds = false;
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    TransitionController.prototype.getJointTransform = function (jointId) {
        if (this.dirty) {
            // Note this is not necessarily the most efficient solution, we only need one joint
            this.update();
        }

        var output = this.output;
        var jointOutput = output[jointId];
        return jointOutput;
    };

    TransitionController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        if (this.dirty) {
            // May as well do a full update since we're accessing the output randomly
            this.update();
        }

        return Animation.standardGetJointWorldTransform(this, jointId, this.mathDevice, asMatrix);
    };

    TransitionController.prototype.setStartController = function (controller) {
        this.startController = controller;
        this.outputChannels = AnimationChannels.union(this.startController.outputChannels, this.endController.outputChannels);
        this.dirty = true;
        this.dirtyBounds = true;
    };

    TransitionController.prototype.setEndController = function (controller) {
        this.endController = controller;
        this.outputChannels = AnimationChannels.union(this.startController.outputChannels, this.endController.outputChannels);
        this.dirty = true;
        this.dirtyBounds = true;
    };

    TransitionController.prototype.setTransitionLength = function (length) {
        this.transitionLength = length;
        this.dirty = true;
        this.dirtyBounds = true;
    };

    TransitionController.prototype.setTime = function (time) {
        this.transitionTime = time;
        this.dirty = true;
        this.dirtyBounds = true;
    };

    TransitionController.prototype.setRate = function (rate) {
        this.rate = rate;
    };

    TransitionController.prototype.getHierarchy = function () {
        // Return the start controller, they should match anyway
        return this.startController.getHierarchy();
    };

    TransitionController.create = // Constructor function
    function (startController, endController, length) {
        var c = new TransitionController();

        var md = TurbulenzEngine.getMathDevice();
        c.mathDevice = md;
        c.bounds = { center: md.v3BuildZero(), halfExtent: md.v3BuildZero() };

        c.startController = startController;
        c.endController = endController;
        c.outputChannels = AnimationChannels.union(startController.outputChannels, endController.outputChannels);
        c.output = [];
        c.transitionTime = 0;
        c.transitionLength = length;
        c.dirty = true;
        c.dirtyBounds = true;

        return c;
    };
    TransitionController.version = 1;
    return TransitionController;
})();

// The BlendController blends between the animating state of input controllers given a user specified delta
var BlendController = (function () {
    function BlendController() {
    }
    BlendController.prototype.addTime = function (delta) {
        this.dirty = true;
        this.dirtyBounds = true;

        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            var controller = controllers[i];
            controller.addTime(delta);
        }
    };

    BlendController.prototype.update = function () {
        var mathDevice = this.mathDevice;
        var quatSlerp = mathDevice.quatSlerp;
        var v3Lerp = mathDevice.v3Lerp;
        var v3Copy = mathDevice.v3Copy;

        // Decide the pair of controllers we'll blend between and the delta
        var controllers = this.controllers;
        var numControllers = controllers.length;
        var deltaStep = 1 / (numControllers - 1);
        var first = Math.floor(this.blendDelta / deltaStep);
        var last = Math.min(first + 1, numControllers - 1);
        var delta = (this.blendDelta - (first * deltaStep)) / deltaStep;

        var startController = controllers[first];
        var endController = controllers[last];

        startController.update();
        endController.update();

        var output = this.output;
        var outputChannels = this.outputChannels;
        var outputScale = outputChannels.scale;
        var scaleOnStart = startController.outputChannels.scale;
        var scaleOnEnd = endController.outputChannels.scale;

        var startOutput = startController.output;
        var endOutput = endController.output;

        // For each joint slerp between the quats and return the quat pos result
        var numJoints = startController.getHierarchy().numNodes;
        for (var j = 0; j < numJoints; j += 1) {
            if (!output[j]) {
                output[j] = {};
            }
            var j1 = startOutput[j];
            var j2 = endOutput[j];

            output[j].rotation = quatSlerp.call(mathDevice, j1.rotation, j2.rotation, delta, output[j].rotation);
            output[j].translation = v3Lerp.call(mathDevice, j1.translation, j2.translation, delta, output[j].translation);

            if (outputScale) {
                if (scaleOnStart) {
                    if (scaleOnEnd) {
                        output[j].scale = v3Lerp.call(mathDevice, j1.scale, j2.scale, delta, output[j].scale);
                    } else {
                        output[j].scale = v3Copy.call(mathDevice, j1.scale, output[j].scale);
                    }
                } else if (scaleOnEnd) {
                    output[j].scale = v3Copy.call(mathDevice, j2.scale, output[j].scale);
                }
            }
        }

        this.dirty = false;

        if (this.dirtyBounds) {
            this.updateBounds();
        }
    };

    BlendController.prototype.updateBounds = function () {
        // Decide the pair of controllers we'll blend between and update and merge their bounds
        var controllers = this.controllers;
        var numControllers = controllers.length;
        var deltaStep = 1 / (numControllers - 1);
        var first = Math.floor(this.blendDelta / deltaStep);
        var last = Math.min(first + 1, numControllers - 1);

        var startController = controllers[first];
        var endController = controllers[last];

        if (startController.dirtyBounds) {
            startController.updateBounds();
        }
        if (endController.dirtyBounds) {
            endController.updateBounds();
        }

        // accumulate the bounds as average of the center position and max of the extent
        // plus the half distance between the centers
        var boundsStart = startController.bounds;
        var boundsEnd = endController.bounds;

        var mathDevice = this.mathDevice;
        var v3Add = mathDevice.v3Add;

        var centerSum = v3Add.call(mathDevice, boundsStart.center, boundsEnd.center);
        var newCenter = mathDevice.v3ScalarMul(centerSum, 0.5, centerSum);
        this.bounds.center = newCenter;
        var newExtent = mathDevice.v3Max(boundsStart.halfExtent, boundsEnd.halfExtent);
        var centerOffset = mathDevice.v3Sub(boundsStart.center, newCenter);
        centerOffset = mathDevice.v3Abs(centerOffset, centerOffset);
        this.bounds.halfExtent = v3Add.call(mathDevice, newExtent, centerOffset, newExtent);

        this.dirtyBounds = false;
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    BlendController.prototype.getJointTransform = function (jointId) {
        if (this.dirty) {
            // Note this is not necessarily the most efficient solution, we only need one joint
            this.update();
        }

        return this.output[jointId];
    };

    BlendController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        if (this.dirty) {
            // May as well do a full update since we're accessing the output randomly
            this.update();
        }

        return Animation.standardGetJointWorldTransform(this, jointId, this.mathDevice, asMatrix);
    };

    BlendController.prototype.setBlendDelta = function (delta) {
        this.blendDelta = (0 < delta ? delta : 0);
        this.dirty = true;
        this.dirtyBounds = true;
    };

    BlendController.prototype.setTime = function (time) {
        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            var controller = controllers[i];
            controller.setTime(time);
        }
        this.dirty = true;
        this.dirtyBounds = true;
    };

    BlendController.prototype.setRate = function (rate) {
        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            controllers[i].setRate(rate);
        }
    };

    BlendController.prototype.getHierarchy = function () {
        // Return the first controller since they should all match
        return this.controllers[0].getHierarchy();
    };

    BlendController.create = // Constructor function
    function (controllers) {
        var c = new BlendController();
        c.outputChannels = {};
        c.controllers = [];
        var numControllers = controllers.length;
        c.controllers.length = numControllers;
        for (var i = 0; i < numControllers; i += 1) {
            var inputController = controllers[i];
            c.controllers[i] = inputController;

            debug.assert(inputController.getHierarchy().numNodes === c.getHierarchy().numNodes, "All controllers to a blend controller must have the same number of joints");

            AnimationChannels.add(c.outputChannels, inputController.outputChannels);
        }

        var md = TurbulenzEngine.getMathDevice();
        c.mathDevice = md;
        c.bounds = { center: md.v3BuildZero(), halfExtent: md.v3BuildZero() };

        c.output = [];
        c.blendDelta = 0;
        c.dirty = true;
        c.dirtyBounds = true;

        return c;
    };
    BlendController.version = 1;
    return BlendController;
})();

// The MaskController takes joints from various controllers based on a per joint mask
var MaskController = (function () {
    function MaskController() {
    }
    MaskController.prototype.addTime = function (delta) {
        this.dirty = true;
        this.dirtyBounds = true;

        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            var controller = controllers[i];
            controller.addTime(delta);
        }
    };

    MaskController.prototype.update = function () {
        var output = this.output;
        var outputChannels = this.outputChannels;
        var outputScale = outputChannels.scale;

        var mathDevice = this.mathDevice;
        var controllers = this.controllers;
        var numControllers = controllers.length;
        var masks = this.masks;
        for (var i = 0; i < numControllers; i += 1) {
            var controller = controllers[i];
            controller.update();
            var controllerOutput = controller.output;
            var controllerHasScale = controller.outputChannels.scale;
            var createScale = outputScale && !controllerHasScale;
            var mask = masks[i];

            // For each joint copy over if the mask is set
            var numJoints = controller.getHierarchy().numNodes;
            for (var j = 0; j < numJoints; j += 1) {
                if (!output[j]) {
                    output[j] = {};
                }
                if (mask[j]) {
                    output[j].rotation = mathDevice.quatCopy(controllerOutput[j].rotation, output[j].rotation);
                    output[j].translation = mathDevice.v3Copy(controllerOutput[j].translation, output[j].translation);
                    if (createScale) {
                        output[j].scale = mathDevice.v3BuildOne(output[j].scale);
                    } else if (outputScale) {
                        output[j].scale = mathDevice.v3Copy(controllerOutput[j].scale, output[j].scale);
                    }
                }
            }
        }

        this.dirty = false;

        if (this.dirtyBounds) {
            this.updateBounds();
        }
    };

    MaskController.prototype.updateBounds = function () {
        // Update and merge the bounds of all the controllers
        var controllers = this.controllers;
        var numControllers = controllers.length;

        if (numControllers) {
            for (var c = 0; c < numControllers; c += 1) {
                controllers[c].updateBounds();
            }

            var bounds0 = controllers[0].bounds;
            var bounds = { center: bounds0.center, halfExtent: bounds0.halfExtent };

            var mathDevice = this.mathDevice;
            var v3Add = mathDevice.v3Add;
            var v3ScalarMul = mathDevice.v3ScalarMul;
            var v3Max = mathDevice.v3Max;
            var v3Sub = mathDevice.v3Sub;
            var v3Abs = mathDevice.v3Abs;

            for (c = 1; c < numControllers; c += 1) {
                var controller = controllers[c];
                var cBounds = controller.bounds;

                var centerSum = v3Add.call(mathDevice, bounds.center, cBounds.center);
                var newCenter = v3ScalarMul.call(mathDevice, centerSum, 0.5, centerSum);
                bounds.center = newCenter;
                var newExtent = v3Max.call(mathDevice, bounds.halfExtent, cBounds.halfExtent);
                var centerOffset = v3Sub.call(mathDevice, bounds.center, newCenter);
                centerOffset = v3Abs.call(mathDevice, centerOffset, centerOffset);
                bounds.halfExtent = v3Add.call(mathDevice, newExtent, centerOffset, newExtent);
            }

            this.bounds = bounds;
        }

        this.dirtyBounds = false;
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    MaskController.prototype.getJointTransform = function (jointId) {
        if (this.dirty) {
            // Note this is not necessarily the most efficient solution, we only need one joint
            this.update();
        }

        return this.output[jointId];
    };

    MaskController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        if (this.dirty) {
            // May as well do a full update since we're accessing the output randomly
            this.update();
        }

        return Animation.standardGetJointWorldTransform(this, jointId, this.mathDevice, asMatrix);
    };

    MaskController.prototype.setTime = function (time) {
        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            var controller = controllers[i];
            controller.setTime(time);
        }
        this.dirty = true;
        this.dirtyBounds = true;
    };

    MaskController.prototype.setRate = function (rate) {
        var controllers = this.controllers;
        var numControllers = controllers.length;
        for (var i = 0; i < numControllers; i += 1) {
            controllers[i].setRate(rate);
        }
    };

    MaskController.prototype.setMask = function (controllerIndex, maskJoints, maskArray) {
        var controller = this.controllers[controllerIndex];
        var hierarchy = controller.getHierarchy();
        var hierarchyNames = hierarchy.names;
        var hierarchyParents = hierarchy.parents;
        var numJoints = hierarchy.numNodes;

        var j;
        var mask;
        if (maskArray) {
            mask = maskArray.slice();
        } else {
            mask = [];
            for (j = 0; j < numJoints; j += 1) {
                mask[j] = false;
            }
        }
        this.masks[controllerIndex] = mask;

        // Build a dictionary of joint indices
        var jointDict = {};
        for (j = 0; j < numJoints; j += 1) {
            jointDict[hierarchyNames[j]] = j;
        }

        var hasParent = function hasParentFn(joint, parent) {
            while (joint !== -1) {
                if (joint === parent) {
                    return true;
                }
                joint = hierarchyParents[joint];
            }
            return false;
        };

        // Process the maskJoints string which is of the form
        // " *origin *hips -*waist "
        var maskList = maskJoints.split(" ");
        var numElements = maskList.length;
        for (var e = 0; e < numElements; e += 1) {
            var setValue = true;
            var maskStr = maskList[e];
            if (maskStr !== "") {
                if (maskStr[0] === "-") {
                    setValue = false;
                    maskStr = maskStr.slice(1);
                }
                if (maskStr[0] === "*") {
                    maskStr = maskStr.slice(1);
                    var rootIndex = jointDict[maskStr];
                    for (j = 0; j < numJoints; j += 1) {
                        if (j === rootIndex || hasParent(j, rootIndex)) {
                            mask[j] = setValue;
                        }
                    }
                } else {
                    mask[jointDict[maskStr]] = setValue;
                }
            }
        }
    };

    MaskController.prototype.getHierarchy = function () {
        // Return the first controller since they should all match
        return this.controllers[0].getHierarchy();
    };

    MaskController.create = // Constructor function
    function (controllers) {
        var c = new MaskController();
        c.outputChannels = {};
        c.controllers = [];
        c.masks = [];
        var numControllers = controllers.length;
        c.controllers.length = numControllers;
        for (var i = 0; i < numControllers; i += 1) {
            var inputController = controllers[i];
            c.controllers[i] = inputController;

            debug.assert(inputController.getHierarchy().numNodes === c.getHierarchy().numNodes, "All controllers to a mask controller must have the same number of joints");

            AnimationChannels.add(c.outputChannels, inputController.outputChannels);
        }

        var md = TurbulenzEngine.getMathDevice();
        c.mathDevice = md;
        c.bounds = { center: md.v3BuildZero(), halfExtent: md.v3BuildZero() };

        c.output = [];
        c.dirty = true;
        c.dirtyBounds = true;

        return c;
    };
    MaskController.version = 1;
    return MaskController;
})();

// The PoseController allows the user to set a fixed set of joint transforms to pose a hierarchy
var PoseController = (function () {
    function PoseController() {
    }
    // Controller Base End
    PoseController.prototype.addTime = function (delta) {
    };

    PoseController.prototype.update = function () {
    };

    PoseController.prototype.updateBounds = function () {
        if (this.dirtyBounds) {
            // First generate ltms for the pose
            var md = this.mathDevice;
            var m43Mul = md.m43Mul;
            var m43Copy = md.m43Copy;
            var m43FromRTS = md.m43FromRTS;
            var m43FromRT = md.m43FromRT;
            var m43Pos = md.m43Pos;

            var output = this.output;
            var numJoints = this.hierarchy.numNodes;
            var parents = this.hierarchy.parents;
            var ltms = [];
            var jointMatrix;
            for (var j = 0; j < numJoints; j += 1) {
                if (output[j].scale) {
                    jointMatrix = m43FromRTS.call(md, output[j].rotation, output[j].translation, output[j].scale, jointMatrix);
                } else {
                    jointMatrix = m43FromRT.call(md, output[j].rotation, output[j].translation, jointMatrix);
                }

                var parent = parents[j];
                if (parent !== -1) {
                    ltms[j] = m43Mul.call(md, jointMatrix, ltms[parent], ltms[j]);
                } else {
                    ltms[j] = m43Copy.call(md, jointMatrix, ltms[j]);
                }
            }

            // Now add all the positions to a bbox
            var maxNumber = Number.MAX_VALUE;
            var min = md.v3Build(maxNumber, maxNumber, maxNumber);
            var max = md.v3Build(-maxNumber, -maxNumber, -maxNumber);
            for (j = 0; j < numJoints; j += 1) {
                jointMatrix = ltms[j];
                var pos = m43Pos.call(md, jointMatrix);
                min = md.v3Min(min, pos);
                max = md.v3Max(max, pos);
            }

            // Now set the bounds
            this.bounds.center = md.v3ScalarMul(md.v3Add(min, max), 0.5);
            this.bounds.halfExtent = md.v3ScalarMul(md.v3Sub(max, min), 0.5);
        }

        this.dirtyBounds = false;
    };

    // Note this is purely a transform for the given joint and doesn't include parent transforms
    PoseController.prototype.getJointTransform = function (jointId) {
        var output = this.output;
        return output[jointId];
    };

    PoseController.prototype.getJointWorldTransform = function (jointId, asMatrix) {
        return Animation.standardGetJointWorldTransform(this, jointId, this.mathDevice, asMatrix);
    };

    PoseController.prototype.setTime = function (time) {
    };

    PoseController.prototype.setRate = function (rate) {
    };

    PoseController.prototype.setOutputChannels = function (channels) {
        this.outputChannels = channels;
    };

    PoseController.prototype.setJointPose = function (jointIndex, rotation, translation, scale) {
        // TODO: should I clone the math structures
        this.output[jointIndex].rotation = rotation;
        this.output[jointIndex].translation = translation;
        this.output[jointIndex].scale = scale;
        this.dirtyBounds = true;
    };

    PoseController.prototype.getHierarchy = function () {
        // Return the first controller since they should all match
        return this.hierarchy;
    };

    PoseController.create = // Constructor function
    function (hierarchy) {
        var mathDevice = TurbulenzEngine.getMathDevice();

        var c = new PoseController();
        c.hierarchy = hierarchy;

        var md = TurbulenzEngine.getMathDevice();
        c.mathDevice = md;
        c.bounds = { center: md.v3BuildZero(), halfExtent: md.v3BuildZero() };

        var output = [];
        c.output = output;
        c.outputChannels = {};

        // Initialize the output based on the hierarchy joint count
        var identityQuat = mathDevice.quatBuild(0, 0, 0, 1);
        var identityPos = mathDevice.v3BuildZero();
        var identityScale = mathDevice.v3BuildOne();
        var numJoints = hierarchy.numNodes;
        for (var j = 0; j < numJoints; j += 1) {
            output[j] = { rotation: identityQuat, translation: identityPos, scale: identityScale };
        }
        c.dirtyBounds = true;

        return c;
    };
    PoseController.version = 1;
    return PoseController;
})();

//
// NodeTransformController
//
var NodeTransformController = (function () {
    function NodeTransformController() {
    }
    NodeTransformController.prototype.addTime = function (delta) {
        this.inputController.addTime(delta);
        this.dirty = true;
    };

    NodeTransformController.prototype.setInputController = function (input) {
        this.inputController = input;
        this.dirty = true;
    };

    NodeTransformController.prototype.setHierarchy = function (hierarchy, fromNode) {
        var matchJointHierarchy = function matchJointHierarchyFn(rootIndex, rootNode, nodesMap, numJoints, jointNames, jointParents) {
            nodesMap[rootIndex] = rootNode;

            var nextIndex = rootIndex + 1;
            while (nextIndex < numJoints) {
                var nextJointParent = jointParents[nextIndex];
                var nextJointName = jointNames[nextIndex];
                if (nextJointParent !== rootIndex) {
                    // nextJoint doesn't have me as a parent so we must be going back up the hierarchy
                    return nextIndex;
                } else {
                    var foundChild = false;
                    var jointNode;
                    if (rootNode) {
                        // Try and find a node matching the joint name
                        var jointName = nextJointName;
                        var children = rootNode.children;
                        if (children) {
                            var numChildren = children.length;
                            for (var c = 0; c < numChildren; c += 1) {
                                var child = rootNode.children[c];
                                if (child.name === jointName) {
                                    foundChild = true;
                                    nextIndex = matchJointHierarchy(nextIndex, child, nodesMap, numJoints, jointNames, jointParents);
                                }
                            }
                        }
                    }

                    if (!foundChild) {
                        nextIndex = matchJointHierarchy(nextIndex, jointNode, nodesMap, numJoints, jointNames, jointParents);
                    }
                }
            }

            return nextIndex;
        };

        this.hierarchy = hierarchy;
        this.dirty = true;

        var jointNames = hierarchy.names;
        var jointParents = hierarchy.parents;
        var numJoints = hierarchy.numNodes;
        for (var j = 0; j < numJoints; j += 1) {
            var parentIndex = jointParents[j];
            if (parentIndex === -1) {
                var rootNode = null;

                if (fromNode && fromNode.name === jointNames[j]) {
                    rootNode = fromNode;
                } else {
                    rootNode = this.scene.findNode(jointNames[j]);
                }

                if (rootNode) {
                    j = matchJointHierarchy(j, rootNode, this.nodesMap, numJoints, jointNames, jointParents);

                    // matchJointHierarchy returns the next joint to process but the loop will step to the node after
                    j -= 1;
                }
            }
        }
    };

    NodeTransformController.prototype.setScene = function (scene) {
        this.scene = scene;
        this.setHierarchy(this.hierarchy);
    };

    NodeTransformController.prototype.update = function () {
        if (!this.dirty && !this.inputController.dirty) {
            return;
        }

        if (this.inputController.dirty) {
            this.inputController.update();
        }

        var mathDevice = this.mathDevice;

        // convert the input interpolator quat pos data into skinning matrices
        var node;
        var m43FromRTS = mathDevice.m43FromRTS;
        var m43FromQuatPos = mathDevice.m43FromQuatPos;
        var quatPosBuild = mathDevice.quatPosBuild;

        var interpOut = this.inputController.output;
        var interpChannels = this.inputController.outputChannels;
        var hasScale = interpChannels.scale;
        var hierarchy = this.hierarchy;
        var nodesMap = this.nodesMap;
        var ltms = this.ltms;
        var numJoints = hierarchy.numNodes;

        var jointMatrix, quatPos;

        for (var j = 0; j < numJoints; j += 1) {
            var interpVal = interpOut[j];

            if (hasScale) {
                jointMatrix = m43FromRTS.call(mathDevice, interpVal.rotation, interpVal.translation, interpVal.scale, jointMatrix);
            } else {
                quatPos = quatPosBuild.call(mathDevice, interpVal.rotation, interpVal.translation, quatPos);
                jointMatrix = m43FromQuatPos.call(mathDevice, quatPos, ltms[j]);
            }

            node = nodesMap[j];
            if (node) {
                node.setLocalTransform(jointMatrix);
            }
        }

        this.dirty = false;
    };

    NodeTransformController.create = // Constructor function
    function (hierarchy, scene) {
        var c = new NodeTransformController();

        var numNodes = hierarchy.numNodes;
        c.dirty = true;
        c.ltms = [];
        c.ltms.length = numNodes;
        c.nodesMap = [];
        c.nodesMap.length = numNodes;
        c.scene = scene;
        c.setHierarchy(hierarchy);

        c.mathDevice = TurbulenzEngine.getMathDevice();

        return c;
    };
    NodeTransformController.version = 1;
    return NodeTransformController;
})();

//
// SkinController
//
var SkinController = (function () {
    function SkinController() {
    }
    SkinController.prototype.setInputController = function (input) {
        this.inputController = input;
        this.dirty = true;
    };

    SkinController.prototype.setSkeleton = function (skeleton) {
        this.skeleton = skeleton;
        this.dirty = true;

        // Update the size of our buffers
        var newNumBones = skeleton.numNodes;
        this.ltms.length = newNumBones;
        this.output.length = newNumBones;
    };

    SkinController.prototype.update = function () {
        if (!this.dirty && !this.inputController.dirty) {
            return;
        }

        if (this.inputController.dirty) {
            this.inputController.update();
        }

        // convert the input interpolator quat pos data into skinning matrices
        var md = this.md;
        var interpOut = this.inputController.output;
        var interpChannels = this.inputController.outputChannels;
        var hasScale = interpChannels.scale;
        var invBoneLTMs = this.skeleton.invBoneLTMs;
        var jointParents = this.skeleton.parents;
        var ltms = this.ltms;
        var output = this.output;
        var numBones = this.skeleton.numNodes;
        for (var b = 0; b < numBones; b += 1) {
            var interpVal = interpOut[b];
            var boneMatrix;
            if (hasScale) {
                boneMatrix = md.m43FromRTS(interpVal.rotation, interpVal.translation, interpVal.scale, ltms[b]);
            } else {
                boneMatrix = md.m43FromRT(interpVal.rotation, interpVal.translation, ltms[b]);
            }
            var parentIndex = jointParents[b];
            if (parentIndex !== -1) {
                boneMatrix = md.m43Mul(boneMatrix, ltms[parentIndex], ltms[b]);
            }
            ltms[b] = boneMatrix;
            output[b] = md.m43MulTranspose(invBoneLTMs[b], boneMatrix, output[b]);
        }
        this.dirty = false;
    };

    SkinController.create = // Constructor function
    function (md) {
        var c = new SkinController();

        c.md = md;
        c.dirty = true;
        c.ltms = [];
        c.output = [];

        return c;
    };
    SkinController.version = 1;
    return SkinController;
})();

//
// GPUSkinController
//
var GPUSkinController = (function () {
    function GPUSkinController() {
    }
    GPUSkinController.prototype.setInputController = function (input) {
        this.inputController = input;
        this.dirty = true;
    };

    GPUSkinController.prototype.setSkeleton = function (skeleton) {
        var oldNumBones = -1;
        if (this.skeleton) {
            oldNumBones = this.skeleton.numNodes;
        }
        this.skeleton = skeleton;
        this.dirty = true;

        // Update the size of our buffers
        var newNumBones = skeleton.numNodes;
        if (oldNumBones !== newNumBones) {
            this.ltms.length = newNumBones;
            var size = this.bufferSize || (newNumBones * 12);
            this.output = this.gd.createTechniqueParameterBuffer({
                numFloats: size,
                dynamic: true
            });
        }
    };

    GPUSkinController.prototype.update = function () {
        if (!this.dirty && !this.inputController.dirty) {
            return;
        }

        if (this.inputController.dirty) {
            this.inputController.update();
        }

        // convert the input interpolator quat pos data into skinning matrices
        var output = this.output;
        var md = this.md;
        var interpOut = this.inputController.output;
        var interpChannels = this.inputController.outputChannels;
        var hasScale = interpChannels.scale;
        var invBoneLTMs = this.skeleton.invBoneLTMs;
        var jointParents = this.skeleton.parents;
        var ltms = this.ltms;
        var outputMat = this.outputMat;
        var convertedquatPos = this.convertedquatPos;
        var numBones = this.skeleton.numNodes;
        var offset = 0;
        var ltm;
        for (var b = 0; b < numBones; b += 1) {
            var interpVal = interpOut[b];
            var parentIndex = jointParents[b];

            if (parentIndex !== -1) {
                if (hasScale) {
                    convertedquatPos = md.m43FromRTS(interpVal.rotation, interpVal.translation, interpVal.scale, convertedquatPos);
                } else {
                    convertedquatPos = md.m43FromRT(interpVal.rotation, interpVal.translation, convertedquatPos);
                }
                ltms[b] = ltm = md.m43Mul(convertedquatPos, ltms[parentIndex], ltms[b]);
            } else {
                if (hasScale) {
                    ltms[b] = ltm = md.m43FromRTS(interpVal.rotation, interpVal.translation, interpVal.scale, ltms[b]);
                } else {
                    ltms[b] = ltm = md.m43FromRT(interpVal.rotation, interpVal.translation, ltms[b]);
                }
            }

            outputMat = md.m43MulTranspose(invBoneLTMs[b], ltm, outputMat);
            output.setData(outputMat, offset, 12);
            offset += 12;
        }

        this.dirty = false;
    };

    GPUSkinController.setDefaultBufferSize = function (size) {
        GPUSkinController.prototype.defaultBufferSize = size;
    };

    GPUSkinController.create = // Constructor function
    function (gd, md, bufferSize) {
        var c = new GPUSkinController();

        c.md = md;
        c.gd = gd;
        c.dirty = true;
        c.ltms = [];
        c.outputMat = md.m34BuildIdentity();
        c.convertedquatPos = md.m43BuildIdentity();
        c.bufferSize = bufferSize || GPUSkinController.prototype.defaultBufferSize;

        return c;
    };
    GPUSkinController.version = 1;
    return GPUSkinController;
})();

GPUSkinController.prototype.defaultBufferSize = undefined;

//
// SkinnedNode
//
// TODO: Extends SceneNode?
var SkinnedNode = (function () {
    function SkinnedNode() {
    }
    SkinnedNode.prototype.addTime = function (delta) {
        this.input.addTime(delta);
        this.skinController.dirty = true;
    };

    SkinnedNode.prototype.update = function (updateSkinController) {
        // update the skin controller
        var skinController = this.skinController;
        if (updateSkinController) {
            skinController.update();
        } else {
            if (this.input.dirtyBounds) {
                this.input.updateBounds();
            }
        }

        function setNodeHierarchyBoneMatricesAndBoundsFn(node, extents, skinController) {
            var isFullySkinned = (!node.lightInstances || node.lightInstances.length === 0);

            var renderables = node.renderables;
            if (renderables) {
                var numRenderables = renderables.length;
                for (var i = 0; i < numRenderables; i += 1) {
                    var renderable = renderables[i];
                    if (renderable.isSkinned()) {
                        renderable.skinController = skinController;
                        renderable.addCustomWorldExtents(extents);
                    } else {
                        isFullySkinned = false;
                    }
                }
            }

            var children = node.children;
            if (children) {
                var numChildren = children.length;
                for (var c = 0; c < numChildren; c += 1) {
                    var childSkinned = setNodeHierarchyBoneMatricesAndBoundsFn(children[c], extents, skinController);
                    if (!childSkinned) {
                        isFullySkinned = false;
                    }
                }
            }

            if (isFullySkinned) {
                node.addCustomWorldExtents(extents);
            } else {
                if (node.getCustomWorldExtents()) {
                    node.removeCustomWorldExtents();
                }
            }

            return isFullySkinned;
        }

        // calculate the bounds in world space
        var bounds = skinController.inputController.bounds;
        var extents = this.scratchExtents;
        var matrix = this.node.getWorldTransform();
        var c0 = bounds.center[0];
        var c1 = bounds.center[1];
        var c2 = bounds.center[2];
        var h0 = bounds.halfExtent[0];
        var h1 = bounds.halfExtent[1];
        var h2 = bounds.halfExtent[2];
        if (matrix) {
            var abs = Math.abs;

            var m0 = matrix[0];
            var m1 = matrix[1];
            var m2 = matrix[2];
            var m3 = matrix[3];
            var m4 = matrix[4];
            var m5 = matrix[5];
            var m6 = matrix[6];
            var m7 = matrix[7];
            var m8 = matrix[8];

            var ct0, ct1, ct2;
            if (c0 !== 0 || c1 !== 0 || c2 !== 0) {
                ct0 = (m0 * c0 + m3 * c1 + m6 * c2 + matrix[9]);
                ct1 = (m1 * c0 + m4 * c1 + m7 * c2 + matrix[10]);
                ct2 = (m2 * c0 + m5 * c1 + m8 * c2 + matrix[11]);
            } else {
                ct0 = matrix[9];
                ct1 = matrix[10];
                ct2 = matrix[11];
            }

            var ht0 = (abs(m0) * h0 + abs(m3) * h1 + abs(m6) * h2);
            var ht1 = (abs(m1) * h0 + abs(m4) * h1 + abs(m7) * h2);
            var ht2 = (abs(m2) * h0 + abs(m5) * h1 + abs(m8) * h2);

            extents[0] = (ct0 - ht0);
            extents[1] = (ct1 - ht1);
            extents[2] = (ct2 - ht2);
            extents[3] = (ct0 + ht0);
            extents[4] = (ct1 + ht1);
            extents[5] = (ct2 + ht2);
        } else {
            extents[0] = (c0 - h0);
            extents[1] = (c1 - h1);
            extents[2] = (c2 - h2);
            extents[3] = (c0 + h0);
            extents[4] = (c1 + h1);
            extents[5] = (c2 + h2);
        }

        setNodeHierarchyBoneMatricesAndBoundsFn(this.node, extents, skinController);
    };

    SkinnedNode.prototype.getJointIndex = function (jointName) {
        var jointNames = this.skinController.skeleton.names;
        var numBones = this.skinController.skeleton.numNodes;
        var jointIndex = -1;
        for (var b = 0; b < numBones; b += 1) {
            if (jointNames[b] === jointName) {
                jointIndex = b;
                break;
            }
        }
        return jointIndex;
    };

    SkinnedNode.prototype.getJointLTM = function (jointIndex, dst) {
        if (this.input.dirty) {
            this.input.update();
        }

        // convert the input quat pos data into skinning matrices
        var md = this.md;
        var m43FromRT = md.m43FromRT;
        var m43FromRTS = md.m43FromRTS;
        var m43Mul = md.m43Mul;
        var interpOut = this.input.output;
        var interpChannels = this.input.outputChannels;
        var hasScale = interpChannels.scale;

        var jointParents = this.skinController.skeleton.parents;

        var boneMatrix;
        if (hasScale) {
            boneMatrix = m43FromRTS.call(md, interpOut[jointIndex].rotation, interpOut[jointIndex].translation, interpOut[jointIndex].scale, dst);
        } else {
            boneMatrix = m43FromRT.call(md, interpOut[jointIndex].rotation, interpOut[jointIndex].translation, dst);
        }

        var parentMatrix = this.scratchM43;

        while (jointParents[jointIndex] !== -1) {
            jointIndex = jointParents[jointIndex];
            if (hasScale) {
                parentMatrix = m43FromRTS.call(md, interpOut[jointIndex].rotation, interpOut[jointIndex].translation, interpOut[jointIndex].scale, parentMatrix);
            } else {
                parentMatrix = m43FromRT.call(md, interpOut[jointIndex].rotation, interpOut[jointIndex].translation, parentMatrix);
            }
            boneMatrix = m43Mul.call(md, boneMatrix, parentMatrix, boneMatrix);
        }
        return boneMatrix;
    };

    SkinnedNode.prototype.setInputController = function (controller) {
        this.input = controller;
        this.skinController.setInputController(controller);
        this.skinController.dirty = true;
    };

    SkinnedNode.prototype.getSkeleton = function () {
        return this.skinController.skeleton;
    };

    SkinnedNode.create = // Constructor function
    function (gd, md, node, skeleton, inputController, bufferSize) {
        var sn = new SkinnedNode();

        sn.md = md;
        sn.input = inputController;
        if (gd) {
            sn.skinController = GPUSkinController.create(gd, md, bufferSize);
        } else {
            sn.skinController = SkinController.create(md);
        }

        if (sn.input) {
            sn.skinController.setInputController(sn.input);
        }
        sn.skinController.setSkeleton(skeleton);
        sn.node = node;

        if (sn.scratchM43 === null) {
            SkinnedNode.prototype.scratchM43 = md.m43BuildIdentity();
        }

        if (sn.scratchExtents === null) {
            SkinnedNode.prototype.scratchExtents = md.aabbBuildEmpty();
        }

        return sn;
    };
    SkinnedNode.version = 1;
    return SkinnedNode;
})();

SkinnedNode.prototype.scratchM43 = null;
SkinnedNode.prototype.scratchExtents = null;
// Copyright (c) 2010-2012 Turbulenz Limited
;

var AnimationManager = (function () {
    function AnimationManager() {
    }
    // Methods
    AnimationManager.prototype.loadFile = function (path, callback) {
        debug.abort("abstract method");
    };
    AnimationManager.prototype.loadData = function (data, prefix) {
        debug.abort("abstract method");
    };
    AnimationManager.prototype.get = function (name) {
        debug.abort("abstract method");
        return null;
    };
    AnimationManager.prototype.remove = function (name) {
        debug.abort("abstract method");
    };
    AnimationManager.prototype.nodeHasSkeleton = function (node) {
        debug.abort("abstract method");
        return null;
    };
    AnimationManager.prototype.getAll = function () {
        debug.abort("abstract method");
        return null;
    };
    AnimationManager.prototype.setPathRemapping = function (prm, assetUrl) {
        debug.abort("abstract method");
    };

    AnimationManager.create = function (errorCallback, log) {
        if (!errorCallback) {
            errorCallback = function (msg) {
            };
        }

        var animations = {};
        var pathRemapping = null;
        var pathPrefix = "";

        var loadAnimationData = function loadAnimationDataFn(data, prefix) {
            var fileAnimations = data.animations;
            var a;
            for (a in fileAnimations) {
                if (fileAnimations.hasOwnProperty(a)) {
                    var name = prefix ? prefix + a : a;
                    if (animations[name]) {
                        fileAnimations[a] = animations[name];
                        continue;
                    }
                    var anim = fileAnimations[a];

                    var numNodes = anim.numNodes;
                    var nodeDataArray = anim.nodeData;
                    var n;
                    for (n = 0; n < numNodes; n += 1) {
                        var nodeData = nodeDataArray[n];
                        var baseframe = nodeData.baseframe;

                        if (baseframe) {
                            if (baseframe.rotation) {
                                baseframe.rotation = this.mathDevice.quatBuild(baseframe.rotation[0], baseframe.rotation[1], baseframe.rotation[2], baseframe.rotation[3]);
                            }
                            if (baseframe.translation) {
                                baseframe.translation = this.mathDevice.v3Build(baseframe.translation[0], baseframe.translation[1], baseframe.translation[2]);
                            }
                            if (baseframe.scale) {
                                baseframe.scale = this.mathDevice.v3Build(baseframe.scale[0], baseframe.scale[1], baseframe.scale[2]);
                            }
                        }

                        var keyframes = nodeData.keyframes;

                        if (keyframes && keyframes[0].hasOwnProperty('time')) {
                            var numKeys = keyframes.length;
                            var k, keyframe;
                            var channels = {};
                            var channel, value, values, index;
                            var i;
                            nodeData.channels = channels;

                            for (k = 0; k < numKeys; k += 1) {
                                keyframe = keyframes[k];
                                for (value in keyframe) {
                                    if (keyframe.hasOwnProperty(value) && value !== "time") {
                                        channel = channels[value];
                                        if (!channel) {
                                            channel = {
                                                count: 0,
                                                offset: 0,
                                                stride: keyframe[value].length + 1
                                            };
                                            channels[value] = channel;
                                            channel.firstKey = k;
                                        }
                                        channel.lastKey = k;
                                        channel.count += 1;
                                    }
                                }
                            }

                            var numberOfValues = 0;
                            for (value in channels) {
                                if (channels.hasOwnProperty(value)) {
                                    channel = channels[value];

                                    channel.count = 1 + channel.lastKey - channel.firstKey;
                                    if (channel.firstKey) {
                                        channel.count += 1;
                                    }
                                    if (channel.lastKey !== numKeys - 1) {
                                        channel.count += 1;
                                    }
                                    channel.offset = numberOfValues;
                                    channel.writeIndex = numberOfValues;
                                    numberOfValues += channel.stride * channel.count;
                                }
                            }

                            var keyframeArray = null;
                            if (numberOfValues) {
                                keyframeArray = new Float32Array(numberOfValues);
                            }

                            for (value in channels) {
                                if (channels.hasOwnProperty(value)) {
                                    channel = channels[value];
                                    if (channel.firstKey) {
                                        keyframeArray[channel.writeIndex] = keyframes[channel.firstKey - 1].time;
                                        values = baseframe[value];
                                        for (i = 0; i < channel.stride - 1; i += 1) {
                                            keyframeArray[channel.writeIndex + 1 + i] = values[i];
                                        }
                                        channel.writeIndex += channel.stride;
                                    }

                                    if (channel.lastKey !== numKeys - 1) {
                                        index = channel.offset + (channel.count - 1) * channel.stride;
                                        keyframeArray[index] = keyframes[channel.lastKey + 1].time;
                                        values = baseframe[value];
                                        for (i = 0; i < channel.stride - 1; i += 1) {
                                            keyframeArray[index + 1 + i] = values[i];
                                        }
                                    }
                                }
                            }

                            for (k = 0; k < numKeys; k += 1) {
                                keyframe = keyframes[k];

                                for (value in channels) {
                                    if (channels.hasOwnProperty(value)) {
                                        channel = channels[value];
                                        if (k >= channel.firstKey && k <= channel.lastKey) {
                                            if (keyframe[value]) {
                                                values = keyframe[value];
                                            } else {
                                                values = baseframe[value];
                                            }

                                            keyframeArray[channel.writeIndex] = keyframe.time;

                                            for (i = 0; i < channel.stride - 1; i += 1) {
                                                keyframeArray[channel.writeIndex + 1 + i] = values[i];
                                            }

                                            channel.writeIndex += channel.stride;
                                        }
                                    }
                                }
                            }

                            for (value in channels) {
                                if (channels.hasOwnProperty(value)) {
                                    delete channel.writeIndex;
                                }
                            }

                            nodeData.keyframes = keyframeArray;
                        } else if (keyframes) {
                            nodeData.keyframes = new Float32Array(keyframes);
                        }
                    }

                    var bounds = anim.bounds;
                    var numFrames = bounds.length;
                    var f;
                    for (f = 0; f < numFrames; f += 1) {
                        var bound = bounds[f];
                        bound.center = this.mathDevice.v3Build(bound.center[0], bound.center[1], bound.center[2]);
                        bound.halfExtent = this.mathDevice.v3Build(bound.halfExtent[0], bound.halfExtent[1], bound.halfExtent[2]);
                    }

                    animations[name] = anim;
                }
            }
        };

        var loadAnimationFile = function loadAnimationFileFn(path, onload) {
        };

        var getAnimation = function getAnimationFn(name) {
            var animation = animations[name];
            return animation;
        };

        var removeAnimation = function removeAnimationFn(name) {
            if (typeof animations[name] !== 'undefined') {
                delete animations[name];
            }
        };

        var nodeHasSkeleton = function nodeHasSkeletonFn(node) {
            var renderables = node.renderables;
            if (renderables) {
                var skeleton;
                var numRenderables = renderables.length;
                var r;
                for (r = 0; r < numRenderables; r += 1) {
                    if (renderables[r].geometry) {
                        skeleton = renderables[r].geometry.skeleton;
                        if (skeleton) {
                            return skeleton;
                        }
                    }
                }
            }

            var children = node.children;
            if (children) {
                var numChildren = children.length;
                var c;
                for (c = 0; c < numChildren; c += 1) {
                    var childSkel = nodeHasSkeleton(children[c]);
                    if (childSkel) {
                        return childSkel;
                    }
                }
            }
            return undefined;
        };

        var animationManager = new AnimationManager();
        animationManager.mathDevice = TurbulenzEngine.getMathDevice();

        if (log) {
            animationManager.loadFile = function loadAnimationFileLogFn(path, callback) {
                log.innerHTML += "AnimationManager.loadFile:&nbsp;'" + path + "'";
                return loadAnimationFile(path, callback);
            };

            animationManager.loadData = function loadAnimationDataLogFn(data, prefix) {
                log.innerHTML += "AnimationManager.loadData";
                return loadAnimationData(data, prefix);
            };

            animationManager.get = function getAnimationLogFn(name) {
                log.innerHTML += "AnimationManager.get:&nbsp;'" + name + "'";
                return getAnimation(name);
            };

            animationManager.remove = function removeAnimationLogFn(name) {
                log.innerHTML += "AnimationManager.remove:&nbsp;'" + name + "'";
                removeAnimation(name);
            };
        } else {
            animationManager.loadFile = loadAnimationFile;
            animationManager.loadData = loadAnimationData;
            animationManager.get = getAnimation;
            animationManager.remove = removeAnimation;
            animationManager.nodeHasSkeleton = nodeHasSkeleton;
        }

        animationManager.getAll = function getAllAnimationsFn() {
            return animations;
        };

        animationManager.setPathRemapping = function setPathRemappingFn(prm, assetUrl) {
            pathRemapping = prm;
            pathPrefix = assetUrl;
        };

        return animationManager;
    };
    AnimationManager.version = 1;
    return AnimationManager;
})();
// Copyright (c) 2009-2013 Turbulenz Limited
;

;

var DefaultRendering = (function () {
    function DefaultRendering() {
    }
    DefaultRendering.prototype.updateShader = function (/* sm */ ) {
    };

    DefaultRendering.prototype.sortRenderablesAndLights = function (camera, scene) {
        var opaque = DefaultRendering.passIndex.opaque;
        var decal = DefaultRendering.passIndex.decal;
        var transparent = DefaultRendering.passIndex.transparent;

        var passes = this.passes;
        var opaquePass = passes[opaque];
        var decalPass = passes[decal];
        var transparentPass = passes[transparent];

        var numOpaque = 0;
        var numDecal = 0;
        var numTransparent = 0;

        var drawParametersArray;
        var numDrawParameters;
        var drawParameters;
        var drawParametersIndex;

        var visibleRenderables = scene.getCurrentVisibleRenderables();
        var numVisibleRenderables = visibleRenderables.length;
        if (numVisibleRenderables > 0) {
            var renderable, pass, passIndex;
            var n = 0;
            do {
                renderable = visibleRenderables[n];

                if (!renderable.renderUpdate) {
                    var effect = renderable.sharedMaterial.effect;
                    if (effect.prepare) {
                        effect.prepare(renderable);
                    }
                }

                renderable.renderUpdate(camera);

                drawParametersArray = renderable.drawParameters;
                numDrawParameters = drawParametersArray.length;
                for (drawParametersIndex = 0; drawParametersIndex < numDrawParameters; drawParametersIndex += 1) {
                    drawParameters = drawParametersArray[drawParametersIndex];
                    passIndex = drawParameters.userData.passIndex;
                    if (passIndex === opaque) {
                        opaquePass[numOpaque] = drawParameters;
                        numOpaque += 1;
                    } else if (passIndex === transparent) {
                        if (renderable.sharedMaterial.meta.far) {
                            drawParameters.sortKey = 1.e38;
                        } else {
                            drawParameters.sortKey = renderable.distance;
                        }

                        transparentPass[numTransparent] = drawParameters;
                        numTransparent += 1;
                    } else if (passIndex === decal) {
                        decalPass[numDecal] = drawParameters;
                        numDecal += 1;
                    }
                }

                // this renderer does not care about lights
                n += 1;
            } while(n < numVisibleRenderables);
        }

        opaquePass.length = numOpaque;
        decalPass.length = numDecal;
        transparentPass.length = numTransparent;
    };

    DefaultRendering.prototype.update = function (gd, camera, scene, currentTime) {
        scene.updateVisibleNodes(camera);

        this.sortRenderablesAndLights(camera, scene);

        var matrix = camera.matrix;
        if (matrix[9] !== this.eyePosition[0] || matrix[10] !== this.eyePosition[1] || matrix[11] !== this.eyePosition[2]) {
            this.eyePositionUpdated = true;
            this.eyePosition[0] = matrix[9];
            this.eyePosition[1] = matrix[10];
            this.eyePosition[2] = matrix[11];
        } else {
            this.eyePositionUpdated = false;
        }
        this.globalTechniqueParameters['time'] = currentTime;
        this.camera = camera;
        this.scene = scene;
    };

    DefaultRendering.prototype.updateBuffers = function (/* gd, deviceWidth, deviceHeight */ ) {
        return true;
    };

    DefaultRendering.prototype.draw = function (gd, clearColor, drawDecalsFn, drawTransparentFn, drawDebugFn) {
        gd.clear(clearColor, 1.0, 0);

        if (this.wireframe) {
            this.scene.drawWireframe(gd, this.sm, this.camera, this.wireframeInfo);

            if (drawDecalsFn) {
                drawDecalsFn();
            }

            if (drawTransparentFn) {
                drawTransparentFn();
            }
        } else {
            var globalTechniqueParametersArray = this.globalTechniqueParametersArray;
            var passes = this.passes;

            gd.drawArray(passes[DefaultRendering.passIndex.opaque], globalTechniqueParametersArray, -1);

            gd.drawArray(passes[DefaultRendering.passIndex.decal], globalTechniqueParametersArray, -1);

            if (drawDecalsFn) {
                drawDecalsFn();
            }

            gd.drawArray(passes[DefaultRendering.passIndex.transparent], globalTechniqueParametersArray, 1);

            if (drawTransparentFn) {
                drawTransparentFn();
            }
        }

        if (drawDebugFn) {
            drawDebugFn();
        }

        this.lightPositionUpdated = false;
    };

    DefaultRendering.prototype.setGlobalLightPosition = function (pos) {
        this.lightPositionUpdated = true;
        this.lightPosition[0] = pos[0];
        this.lightPosition[1] = pos[1];
        this.lightPosition[2] = pos[2];
    };

    DefaultRendering.prototype.setGlobalLightColor = function (color) {
        this.globalTechniqueParameters['lightColor'] = color;
    };

    DefaultRendering.prototype.setAmbientColor = function (color) {
        this.globalTechniqueParameters['ambientColor'] = color;
    };

    DefaultRendering.prototype.setDefaultTexture = function (tex) {
        this.globalTechniqueParameters['diffuse'] = tex;
    };

    DefaultRendering.prototype.setWireframe = function (wireframeEnabled, wireframeInfo) {
        this.wireframeInfo = wireframeInfo;
        this.wireframe = wireframeEnabled;
    };

    DefaultRendering.prototype.getDefaultSkinBufferSize = function () {
        return this.defaultSkinBufferSize;
    };

    DefaultRendering.prototype.destroy = function () {
        delete this.globalTechniqueParametersArray;
        delete this.globalTechniqueParameters;
        delete this.lightPosition;
        delete this.eyePosition;
        delete this.passes;
    };

    DefaultRendering.defaultPrepareFn = //
    // defaultPrepareFn
    //
    function (geometryInstance) {
        var drawParameters = TurbulenzEngine.getGraphicsDevice().createDrawParameters();
        drawParameters.userData = {};
        geometryInstance.drawParameters = [drawParameters];
        geometryInstance.prepareDrawParameters(drawParameters);

        var sharedMaterial = geometryInstance.sharedMaterial;
        var techniqueParameters = geometryInstance.techniqueParameters;

        if (!sharedMaterial.techniqueParameters.uvTransform && !techniqueParameters.uvTransform) {
            techniqueParameters.uvTransform = DefaultRendering.identityUVTransform;
        }

        // NOTE: the way this functions is called, 'this' is an
        // EffectPrepareObject.
        drawParameters.technique = (this).technique;

        drawParameters.setTechniqueParameters(0, sharedMaterial.techniqueParameters);
        drawParameters.setTechniqueParameters(1, techniqueParameters);

        if (sharedMaterial.meta.decal) {
            drawParameters.userData.passIndex = DefaultRendering.passIndex.decal;
        } else if (sharedMaterial.meta.transparent) {
            drawParameters.userData.passIndex = DefaultRendering.passIndex.transparent;
        } else {
            drawParameters.userData.passIndex = DefaultRendering.passIndex.opaque;
        }

        var node = geometryInstance.node;
        if (!node.rendererInfo) {
            var md = TurbulenzEngine.getMathDevice();
            node.rendererInfo = {
                id: DefaultRendering.nextRenderinfoID,
                frameVisible: -1,
                worldUpdate: -1,
                worldViewProjection: md.m44BuildIdentity(),
                worldInverse: md.m43BuildIdentity(),
                eyePosition: md.v3BuildZero(),
                lightPosition: md.v3BuildZero()
            };
            DefaultRendering.nextRenderinfoID += 1;
        }

        // do this once instead of for every update
        var rendererInfo = node.rendererInfo;
        techniqueParameters.worldViewProjection = rendererInfo.worldViewProjection;
        techniqueParameters.lightPosition = rendererInfo.lightPosition;

        var techniqueName = (this).technique.name;
        if (techniqueName.indexOf("flat") === -1 && techniqueName.indexOf("lambert") === -1) {
            techniqueParameters.eyePosition = rendererInfo.eyePosition;
        }

        var skinController = geometryInstance.skinController;
        if (skinController) {
            techniqueParameters.skinBones = skinController.output;
            if (skinController.index === undefined) {
                skinController.index = DefaultRendering.nextSkinID;
                DefaultRendering.nextSkinID += 1;
            }
            drawParameters.sortKey = -renderingCommonSortKeyFn((this).techniqueIndex, skinController.index, sharedMaterial.meta.materialIndex);
        } else {
            drawParameters.sortKey = renderingCommonSortKeyFn((this).techniqueIndex, sharedMaterial.meta.materialIndex, rendererInfo.id);
        }

        geometryInstance.renderUpdate = (this).update;
    };

    DefaultRendering.create = //
    // Constructor function
    //
    function (gd, md, shaderManager, effectsManager) {
        var dr = new DefaultRendering();

        dr.md = md;
        dr.sm = shaderManager;

        dr.lightPositionUpdated = true;
        dr.lightPosition = md.v3Build(1000.0, 1000.0, 0.0);
        dr.eyePositionUpdated = true;
        dr.eyePosition = md.v3BuildZero();

        dr.globalTechniqueParameters = gd.createTechniqueParameters({
            lightColor: md.v3BuildOne(),
            ambientColor: md.v3Build(0.2, 0.2, 0.3),
            time: 0.0
        });
        dr.globalTechniqueParametersArray = [dr.globalTechniqueParameters];

        dr.passes = [[], [], []];

        var onShaderLoaded = function onShaderLoadedFn(shader) {
            var skinBones = shader.getParameter("skinBones");
            dr.defaultSkinBufferSize = skinBones.rows * skinBones.columns;
        };

        shaderManager.load("shaders/defaultrendering.cgfx", onShaderLoaded);
        shaderManager.load("shaders/debug.cgfx");

        // Update effects
        var updateNodeRendererInfo = function updateNodeRendererInfoFn(node, rendererInfo, camera) {
            var lightPositionUpdated = dr.lightPositionUpdated;
            var eyePositionUpdated = dr.eyePositionUpdated;
            var matrix = node.world;
            if (rendererInfo.worldUpdate !== node.worldUpdate) {
                rendererInfo.worldUpdate = node.worldUpdate;
                lightPositionUpdated = true;
                eyePositionUpdated = true;
                rendererInfo.worldInverse = md.m43Inverse(matrix, rendererInfo.worldInverse);
            }
            if (lightPositionUpdated) {
                rendererInfo.lightPosition = md.m43TransformPoint(rendererInfo.worldInverse, dr.lightPosition, rendererInfo.lightPosition);
            }
            if (eyePositionUpdated) {
                rendererInfo.eyePosition = md.m43TransformPoint(rendererInfo.worldInverse, dr.eyePosition, rendererInfo.eyePosition);
            }
            rendererInfo.worldViewProjection = md.m43MulM44(matrix, camera.viewProjectionMatrix, rendererInfo.worldViewProjection);
        };

        var defaultUpdate = function defaultUpdateFn(camera) {
            var node = this.node;
            var rendererInfo = node.rendererInfo;
            if (rendererInfo.frameVisible !== node.frameVisible) {
                rendererInfo.frameVisible = node.frameVisible;
                updateNodeRendererInfo(node, rendererInfo, camera);
            }
        };

        var defaultSkinnedUpdate = function defaultSkinnedUpdateFn(camera) {
            var node = this.node;
            var rendererInfo = node.rendererInfo;
            if (rendererInfo.frameVisible !== node.frameVisible) {
                rendererInfo.frameVisible = node.frameVisible;
                updateNodeRendererInfo(node, rendererInfo, camera);
            }

            var skinController = this.skinController;
            if (skinController) {
                skinController.update();
            }
        };

        var debugUpdate = function debugUpdateFn(camera) {
            var matrix = this.node.world;
            var techniqueParameters = this.techniqueParameters;
            techniqueParameters.worldViewProjection = md.m43MulM44(matrix, camera.viewProjectionMatrix, techniqueParameters.worldViewProjection);
            techniqueParameters.worldInverseTranspose = md.m33InverseTranspose(matrix, techniqueParameters.worldInverseTranspose);
        };

        var debugSkinnedUpdate = function debugSkinnedUpdateFn(camera) {
            var matrix = this.node.world;
            var techniqueParameters = this.techniqueParameters;
            techniqueParameters.worldViewProjection = md.m43MulM44(matrix, camera.viewProjectionMatrix, techniqueParameters.worldViewProjection);
            techniqueParameters.worldInverseTranspose = md.m33InverseTranspose(matrix, techniqueParameters.worldInverseTranspose);

            var skinController = this.skinController;
            if (skinController) {
                skinController.update();
            }
        };

        var defaultEnvUpdate = function defaultEnvUpdateFn(camera) {
            var node = this.node;
            var rendererInfo = node.rendererInfo;
            if (rendererInfo.frameVisible !== node.frameVisible) {
                rendererInfo.frameVisible = node.frameVisible;
                updateNodeRendererInfo(node, rendererInfo, camera);
            }
            if (rendererInfo.worldUpdateEnv !== node.worldUpdate) {
                rendererInfo.worldUpdateEnv = node.worldUpdate;
                var matrix = node.world;
                rendererInfo.worldInverseTranspose = md.m33InverseTranspose(matrix, rendererInfo.worldInverseTranspose);
            }

            var techniqueParameters = this.techniqueParameters;
            techniqueParameters.worldInverseTranspose = rendererInfo.worldInverseTranspose;
        };

        var defaultEnvSkinnedUpdate = function defaultEnvSkinnedUpdateFn(camera) {
            defaultEnvUpdate.call(this, camera);

            var skinController = this.skinController;
            if (skinController) {
                skinController.update();
            }
        };

        // Prepare
        var debugLinesPrepare = function debugLinesPrepareFn(geometryInstance) {
            DefaultRendering.defaultPrepareFn.call(this, geometryInstance);
            var techniqueParameters = geometryInstance.techniqueParameters;
            techniqueParameters.constantColor = geometryInstance.sharedMaterial.meta.constantColor;
        };

        var defaultPrepare = function defaultPrepareFn(geometryInstance) {
            DefaultRendering.defaultPrepareFn.call(this, geometryInstance);

            //For untextured objects we need to choose a technique that uses materialColor instead.
            var techniqueParameters = geometryInstance.sharedMaterial.techniqueParameters;
            var diffuse = techniqueParameters.diffuse;
            if (diffuse === undefined) {
                if (!techniqueParameters.materialColor) {
                    techniqueParameters.materialColor = md.v4BuildOne();
                }
            } else if (diffuse.length === 4) {
                techniqueParameters.materialColor = md.v4Build.apply(md, diffuse);
                diffuse = techniqueParameters.diffuse_map;
                techniqueParameters.diffuse = diffuse;
            }
            if (!diffuse) {
                var shader = shaderManager.get("shaders/defaultrendering.cgfx");
                if (geometryInstance.geometryType === "skinned") {
                    geometryInstance.drawParameters[0].technique = shader.getTechnique("flat_skinned");
                } else {
                    geometryInstance.drawParameters[0].technique = shader.getTechnique("flat");
                }
            }
        };

        var noDiffusePrepare = function noDiffusePrepareFn(geometryInstance) {
            DefaultRendering.defaultPrepareFn.call(this, geometryInstance);

            //For untextured objects we need to choose a technique that uses materialColor instead.
            var techniqueParameters = geometryInstance.sharedMaterial.techniqueParameters;
            var diffuse = techniqueParameters.diffuse;
            if (diffuse === undefined) {
                if (!techniqueParameters.materialColor) {
                    techniqueParameters.materialColor = md.v4BuildOne();
                }
            } else if (diffuse.length === 4) {
                techniqueParameters.materialColor = md.v4Build.apply(md, diffuse);
                techniqueParameters.diffuse = undefined;
            }
        };

        var loadTechniques = function loadTechniquesFn(shaderManager) {
            var that = this;

            var callback = function shaderLoadedCallbackFn(shader) {
                that.shader = shader;
                that.technique = shader.getTechnique(that.techniqueName);
                that.techniqueIndex = that.technique.id;
            };
            shaderManager.load(this.shaderName, callback);
        };

        dr.defaultPrepareFn = defaultPrepare;
        dr.defaultUpdateFn = defaultUpdate;
        dr.defaultSkinnedUpdateFn = defaultSkinnedUpdate;
        dr.loadTechniquesFn = loadTechniques;

        var effect;
        var effectTypeData;
        var skinned = "skinned";
        var rigid = "rigid";

        // Register the effects
        //
        // constant
        //
        effect = Effect.create("constant");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "flat",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "flat_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // constant_nocull
        //
        effect = Effect.create("constant_nocull");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "flat_nocull",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "flat_skinned_nocull",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // lambert
        //
        effect = Effect.create("lambert");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "lambert",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "lambert_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // blinn
        //
        effect = Effect.create("blinn");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blinn",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blinn_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // blinn_nocull
        //
        effect = Effect.create("blinn_nocull");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blinn_nocull",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blinn_skinned_nocull",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // phong
        //
        effect = Effect.create("phong");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "phong",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "phong_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // debug_lines_constant
        //
        effect = Effect.create("debug_lines_constant");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: debugLinesPrepare,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_lines_constant",
            update: debugUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // debug_normals
        //
        effect = Effect.create("debug_normals");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_normals",
            update: debugUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_normals_skinned",
            update: debugSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // debug_tangents
        //
        effect = Effect.create("debug_tangents");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_tangents",
            update: debugUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_tangents_skinned",
            update: debugSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // debug_binormals
        //
        effect = Effect.create("debug_binormals");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_binormals",
            update: debugUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: DefaultRendering.defaultPrepareFn,
            shaderName: "shaders/debug.cgfx",
            techniqueName: "debug_binormals_skinned",
            update: debugSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap
        //
        effect = Effect.create("normalmap");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap_specularmap
        //
        effect = Effect.create("normalmap_specularmap");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap_specularmap_alphamap
        //
        effect = Effect.create("normalmap_specularmap_alphamap");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_alphamap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // normalmap_alphatest
        //
        effect = Effect.create("normalmap_alphatest");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_alphatest",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_alphatest_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap_specularmap_alphatest
        //
        effect = Effect.create("normalmap_specularmap_alphatest");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_alphatest",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_alphatest_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap_glowmap
        //
        effect = Effect.create("normalmap_glowmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_glowmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_glowmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // normalmap_specularmap_glowmap
        //
        effect = Effect.create("normalmap_specularmap_glowmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_glowmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "normalmap_specularmap_glowmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap
        //
        effect = Effect.create("rxgb_normalmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap_specularmap
        //
        effect = Effect.create("rxgb_normalmap_specularmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap_alphatest
        //
        effect = Effect.create("rxgb_normalmap_alphatest");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_alphatest",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_alphatest_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap_specularmap_alphatest
        //
        effect = Effect.create("rxgb_normalmap_specularmap_alphatest");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap_alphatest",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap_alphatest_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap_glowmap
        //
        effect = Effect.create("rxgb_normalmap_glowmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_glowmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_glowmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // rxgb_normalmap_specularmap_glowmap
        //
        effect = Effect.create("rxgb_normalmap_specularmap_glowmap");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap_glowmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "rxgb_normalmap_specularmap_glowmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // add
        //
        effect = Effect.create("add");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "add",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "add_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // add_particle
        //
        effect = Effect.create("add_particle");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "add_particle",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // blend
        //
        effect = Effect.create("blend");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blend",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blend_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // blend_particle
        //
        effect = Effect.create("blend_particle");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "blend_particle",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // translucent
        //
        effect = Effect.create("translucent");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "translucent",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "translucent_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // translucent_particle
        //
        effect = Effect.create("translucent_particle");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "translucent_particle",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // filter
        //
        effect = Effect.create("filter");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "filter",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "filter_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // invfilter
        //
        effect = Effect.create("invfilter");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "invfilter",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // invfilter_particle
        //
        effect = Effect.create("invfilter_particle");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "invfilter_particle",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // glass
        //
        effect = Effect.create("glass");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "glass",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // glass_env
        //
        effect = Effect.create("glass_env");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "glass_env",
            update: defaultEnvUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // modulate2
        //
        effect = Effect.create("modulate2");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "modulate2",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "modulate2_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // skybox
        //
        effect = Effect.create("skybox");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "skybox",
            update: defaultEnvUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        //
        // env
        //
        effect = Effect.create("env");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "env",
            update: defaultEnvUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "env_skinned",
            update: defaultEnvSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // flare
        //
        effect = Effect.create("flare");
        effectsManager.add(effect);
        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "add",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectsManager.map("default", "blinn");

        //
        // glowmap
        //
        effect = Effect.create("glowmap");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "glowmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        effectTypeData = {
            prepare: noDiffusePrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "glowmap_skinned",
            update: defaultSkinnedUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(skinned, effectTypeData);

        //
        // lightmap
        //
        effect = Effect.create("lightmap");
        effectsManager.add(effect);

        effectTypeData = {
            prepare: defaultPrepare,
            shaderName: "shaders/defaultrendering.cgfx",
            techniqueName: "lightmap",
            update: defaultUpdate,
            loadTechniques: loadTechniques
        };
        effectTypeData.loadTechniques(shaderManager);
        effect.add(rigid, effectTypeData);

        return dr;
    };
    DefaultRendering.version = 1;

    DefaultRendering.numPasses = 3;
    DefaultRendering.passIndex = {
        opaque: 0,
        decal: 1,
        transparent: 2
    };

    DefaultRendering.nextRenderinfoID = 0;
    DefaultRendering.nextSkinID = 0;

    DefaultRendering.identityUVTransform = new Float32Array([1, 0, 0, 1, 0, 0]);
    return DefaultRendering;
})();
// Copyright (c) 2009-2013 Turbulenz Limited
var LoadingScreen = (function () {
    function LoadingScreen() {
    }
    LoadingScreen.prototype.setProgress = function (progress) {
        this.progress = progress;
    };

    LoadingScreen.prototype.setTexture = function (texture) {
        this.textureMaterial['diffuse'] = texture;
        this.textureWidthHalf = (texture.width * 0.5);
        this.textureHeightHalf = (texture.height * 0.5);
    };

    LoadingScreen.prototype.loadAndSetTexture = function (graphicsDevice, requestHandler, mappingTable, name) {
        var that = this;
        if (mappingTable) {
            var urlMapping = mappingTable.urlMapping;
            var assetPrefix = mappingTable.assetPrefix;
            requestHandler.request({
                src: ((urlMapping && urlMapping[name]) || (assetPrefix + name)),
                requestFn: function textureRequestFn(src, onload) {
                    return graphicsDevice.createTexture({
                        src: src,
                        mipmaps: false,
                        onload: onload
                    });
                },
                onload: function (t) {
                    if (t) {
                        that.setTexture(t);
                    }
                }
            });
        }
    };

    LoadingScreen.prototype.render = function (backgroundAlpha, textureAlpha) {
        var gd = this.gd;
        var screenWidth = gd.width;
        var screenHeight = gd.height;

        if ((screenWidth === 0) || (screenHeight === 0)) {
            return;
        }

        var writer;
        var primitive = gd.PRIMITIVE_TRIANGLE_STRIP;

        var backgroundMaterial;

        if (0 < backgroundAlpha) {
            // TODO: Cache this.backgroundColor here, rather than below
            this.backgroundColor[3] = backgroundAlpha;

            if (backgroundAlpha >= 1) {
                gd.clear(this.backgroundColor);
            } else {
                gd.setTechnique(this.backgroundTechnique);

                var backgroundColor = this.backgroundColor;
                backgroundMaterial = this.backgroundMaterial;

                backgroundMaterial['color'] = backgroundColor;
                gd.setTechniqueParameters(backgroundMaterial);

                writer = gd.beginDraw(primitive, 4, this.posVertexFormats, this.posSemantics);
                if (writer) {
                    writer(-1, -1);
                    writer(1, -1);
                    writer(-1, 1);
                    writer(1, 1);

                    gd.endDraw(writer);
                    writer = null;
                }
            }
        }

        var centerx = 0;
        var centery = 0;
        var left = 0;
        var right = 0;
        var top = 0;
        var bottom = 0;

        var assetTracker = this.assetTracker;
        var progress = (assetTracker && assetTracker.getLoadingProgress()) || this.progress;

        var xScale = 2 / screenWidth;
        var yScale = -2 / screenHeight;

        if ((progress !== null) && (backgroundAlpha > 0)) {
            if (progress < 0) {
                progress = 0;
            } else if (progress > 1) {
                progress = 1;
            }

            backgroundMaterial = this.backgroundMaterial;
            var barBackgroundColor = this.barBackgroundColor;

            barBackgroundColor[3] = backgroundAlpha;

            var barColor = this.barColor;
            barColor[3] = backgroundAlpha;

            centerx = this.barCenter.x * screenWidth;
            centery = this.barCenter.y * screenHeight;
            var barBackgroundWidth = this.barBackgroundWidth;
            var halfBarHeight = 0.5 * this.barBackgroundHeight;
            var barBorderSize = this.barBorderSize;

            gd.setTechnique(this.backgroundTechnique);

            backgroundMaterial['color'] = barBackgroundColor;
            gd.setTechniqueParameters(backgroundMaterial);

            writer = gd.beginDraw(primitive, 4, this.posVertexFormats, this.posSemantics);
            if (writer) {
                left = centerx - (0.5 * barBackgroundWidth);
                right = left + barBackgroundWidth;
                top = (centery - halfBarHeight);
                bottom = (centery + halfBarHeight);

                writer((left * xScale) - 1, (top * yScale) + 1);
                writer((right * xScale) - 1, (top * yScale) + 1);
                writer((left * xScale) - 1, (bottom * yScale) + 1);
                writer((right * xScale) - 1, (bottom * yScale) + 1);

                gd.endDraw(writer);
                writer = null;
            }

            backgroundMaterial['color'] = barColor;
            gd.setTechniqueParameters(backgroundMaterial);

            writer = gd.beginDraw(primitive, 4, this.posVertexFormats, this.posSemantics);

            if (writer) {
                left = left + barBorderSize;
                right = left + ((barBackgroundWidth - (2 * barBorderSize)) * progress);
                top = top + barBorderSize;
                bottom = bottom - barBorderSize;

                writer((left * xScale) - 1, (top * yScale) + 1);
                writer((right * xScale) - 1, (top * yScale) + 1);
                writer((left * xScale) - 1, (bottom * yScale) + 1);
                writer((right * xScale) - 1, (bottom * yScale) + 1);

                gd.endDraw(writer);
                writer = null;
            }
        }

        var textureWidthHalf = this.textureWidthHalf;
        var textureHeightHalf = this.textureHeightHalf;

        if (0 < textureWidthHalf && 0 < textureAlpha) {
            var textureMaterial = this.textureMaterial;

            gd.setTechnique(this.textureTechnique);

            var clipSpace = this.clipSpace;
            clipSpace[0] = xScale;
            clipSpace[1] = yScale;

            textureMaterial['clipSpace'] = clipSpace;
            textureMaterial['alpha'] = textureAlpha;
            gd.setTechniqueParameters(textureMaterial);

            writer = gd.beginDraw(primitive, 4, this.textureVertexFormats, this.textureSemantics);
            if (writer) {
                centerx = (screenWidth * 0.5);
                centery = (screenHeight * 0.5);

                left = (centerx - textureWidthHalf);
                right = (centerx + textureWidthHalf);
                top = (centery - textureHeightHalf);
                bottom = (centery + textureHeightHalf);
                writer(left, top, 0, 0);
                writer(right, top, 1, 0);
                writer(left, bottom, 0, 1);
                writer(right, bottom, 1, 1);
                gd.endDraw(writer);
                writer = null;
            }
        }
    };

    LoadingScreen.create = function (gd, md, parameters) {
        var f = new LoadingScreen();

        f.gd = gd;

        f.backgroundColor = md.v4Build(0.231, 0.231, 0.231, 1.0);
        f.backgroundTechnique = null;
        f.backgroundMaterial = gd.createTechniqueParameters();

        f.posVertexFormats = [gd.VERTEXFORMAT_FLOAT2];
        f.posSemantics = gd.createSemantics(['POSITION']);

        f.clipSpace = md.v4Build(1.0, 1.0, -1.0, 1.0);

        f.textureWidthHalf = 0;
        f.textureHeightHalf = 0;
        f.textureTechnique = null;
        f.textureMaterial = gd.createTechniqueParameters();
        f.textureVertexFormats = [gd.VERTEXFORMAT_FLOAT2, gd.VERTEXFORMAT_FLOAT2];
        f.textureSemantics = gd.createSemantics(['POSITION', 'TEXCOORD0']);

        if (parameters) {
            f.barBackgroundColor = md.v4BuildZero();
            f.barColor = md.v4BuildOne();
            f.barCenter = { x: 0.5, y: 0.75 };
            f.barBorderSize = 4;
            f.barBackgroundWidth = 544;
            f.barBackgroundHeight = 32;
            f.assetTracker = null;
            f.progress = null;

            if (parameters.backgroundColor) {
                f.backgroundColor = parameters.backgroundColor;
            }

            if (parameters.barBackgroundColor) {
                f.barBackgroundColor = parameters.barBackgroundColor;
            }

            if (parameters.barColor) {
                f.barColor = parameters.barColor;
            }

            if (parameters.barCenter) {
                var percentage;

                percentage = parameters.barCenter.x;
                f.barCenter.x = (percentage > 1.0) ? 1.0 : ((percentage < 0.0) ? 0.0 : percentage);

                percentage = parameters.barCenter.y;
                f.barCenter.y = (percentage > 1.0) ? 1.0 : ((percentage < 0.0) ? 0.0 : percentage);
            }

            if (parameters.barBorderSize) {
                f.barBorderSize = parameters.barBorderSize;
            }

            if (parameters.barBackgroundWidth) {
                f.barBackgroundWidth = parameters.barBackgroundWidth;
            }

            if (parameters.barBackgroundHeight) {
                f.barBackgroundHeight = parameters.barBackgroundHeight;
            }

            if (parameters.assetTracker) {
                f.assetTracker = parameters.assetTracker;
            }

            if (parameters.progress) {
                f.progress = parameters.progress;
            }
        }

        var shaderParams = {
            "version": 1,
            "name": "loadingscreen.cgfx",
            "samplers": {
                "diffuse": {
                    "MinFilter": 9729,
                    "MagFilter": 9729,
                    "WrapS": 33071,
                    "WrapT": 33071
                }
            },
            "parameters": {
                "color": {
                    "type": "float",
                    "columns": 4
                },
                "clipSpace": {
                    "type": "float",
                    "columns": 4
                },
                "alpha": {
                    "type": "float"
                },
                "diffuse": {
                    "type": "sampler2D"
                }
            },
            "techniques": {
                "background": [
                    {
                        "parameters": ["color"],
                        "semantics": ["POSITION"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": true,
                            "BlendFunc": [770, 771]
                        },
                        "programs": ["vp_background", "fp_background"]
                    }
                ],
                "texture": [
                    {
                        "parameters": ["clipSpace", "alpha", "diffuse"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": true,
                            "BlendFunc": [770, 771]
                        },
                        "programs": ["vp_texture", "fp_texture"]
                    }
                ]
            },
            "programs": {
                "fp_texture": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nfloat _TMP0;float _TMP1;float _TMP12;uniform float alpha;uniform sampler2D diffuse;void main()\n{vec4 _textureColor;_textureColor=texture2D(diffuse,tz_TexCoord[0].xy);_TMP1=min(1.0,alpha);_TMP12=max(0.0,_TMP1);_TMP0=_TMP12*_TMP12*(3.0-2.0*_TMP12);_textureColor.w=_textureColor.w*_TMP0;gl_FragColor=_textureColor;}"
                },
                "vp_texture": {
                    "type": "vertex",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];attribute vec4 ATTR0;attribute vec4 ATTR8;\nvec4 _OutPosition1;vec2 _OutUV1;uniform vec4 clipSpace;void main()\n{_OutPosition1.xy=ATTR0.xy*clipSpace.xy+clipSpace.zw;_OutPosition1.zw=ATTR0.zw;_OutUV1=ATTR8.xy;tz_TexCoord[0].xy=ATTR8.xy;gl_Position=_OutPosition1;}"
                },
                "fp_background": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvec4 _ret_0;float _TMP0;float _TMP1;float _TMP11;uniform vec4 color;void main()\n{_TMP1=min(1.0,color.w);_TMP11=max(0.0,_TMP1);_TMP0=_TMP11*_TMP11*(3.0-2.0*_TMP11);_ret_0=vec4(color.x,color.y,color.z,_TMP0);gl_FragColor=_ret_0;}"
                },
                "vp_background": {
                    "type": "vertex",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nattribute vec4 ATTR0;\nvoid main()\n{gl_Position=ATTR0;}"
                }
            }
        };

        var shader = gd.createShader(shaderParams);
        if (shader) {
            f.backgroundTechnique = shader.getTechnique("background");
            f.textureTechnique = shader.getTechnique("texture");
            return f;
        }

        return null;
    };
    LoadingScreen.version = 1;
    return LoadingScreen;
})();
// Copyright (c) 2009-2013 Turbulenz Limited
/*global Utilities: false*/
"use strict";
;

//
// Effect
//
var Effect = (function () {
    function Effect() {
    }
    Effect.create = function (name) {
        var effect = new Effect();

        effect.name = name;
        effect.geometryType = {};
        effect.numMaterials = 0;
        effect.materialsMap = {};

        return effect;
    };

    Effect.prototype.hashMaterial = function (material) {
        var texturesNames = material.texturesNames;
        var hashArray = [];
        var numTextures = 0;
        for (var p in texturesNames) {
            if (texturesNames.hasOwnProperty(p)) {
                hashArray[numTextures] = texturesNames[p];
                numTextures += 1;
            }
        }
        if (1 < numTextures) {
            hashArray.sort();
            return hashArray.join(',');
        } else {
            return hashArray[0];
        }
    };

    Effect.prototype.prepareMaterial = function (material) {
        var hash = this.hashMaterial(material);
        var index = this.materialsMap[hash];
        if (index === undefined) {
            index = this.numMaterials;
            this.numMaterials += 1;
            this.materialsMap[hash] = index;
        }
        material.meta.materialIndex = index;
        material.effect = this;
    };

    Effect.prototype.add = function (geometryType, prepareObject) {
        this.geometryType[geometryType] = prepareObject;
    };

    Effect.prototype.remove = function (geometryType) {
        delete this.geometryType[geometryType];
    };

    Effect.prototype.get = function (geometryType) {
        return this.geometryType[geometryType];
    };

    Effect.prototype.prepare = function (renderable) {
        var prepareObject = this.geometryType[renderable.geometryType];
        if (prepareObject) {
            prepareObject.prepare(renderable);
        } else {
            debug.abort("Unsupported or missing geometryType");
        }
    };
    Effect.version = 1;
    return Effect;
})();

//
// EffectManager
//
var EffectManager = (function () {
    function EffectManager() {
    }
    EffectManager.create = function () {
        var effectManager = new EffectManager();
        effectManager.effects = {};
        return effectManager;
    };

    EffectManager.prototype.add = function (effect) {
        debug.assert(this.effects[effect.name] === undefined);
        this.effects[effect.name] = effect;
    };

    EffectManager.prototype.remove = function (name) {
        delete this.effects[name];
    };

    EffectManager.prototype.map = function (destination, source) {
        this.effects[destination] = this.effects[source];
    };

    EffectManager.prototype.get = function (name) {
        var effect = this.effects[name];
        if (!effect) {
            return this.effects["default"];
        }
        return effect;
    };
    EffectManager.version = 1;
    return EffectManager;
})();
// Copyright (c) 2010-2012 Turbulenz Limited
/*global Reference: false */
//
// Material
//
var Material = (function () {
    function Material() {
    }
    Material.create = function (graphicsDevice) {
        var newMaterial = new Material();
        newMaterial.reference = Reference.create(newMaterial);
        newMaterial.techniqueParameters = graphicsDevice.createTechniqueParameters();
        newMaterial.meta = {};

        newMaterial.onTextureChanged = function materialOnTextureChangedFn(textureInstance) {
            var textureInstanceTexture = textureInstance.texture;
            var material = newMaterial;
            var materialTechniqueParameters = material.techniqueParameters;
            var materialTextureInstances = material.textureInstances;

            for (var p in materialTextureInstances) {
                if (materialTextureInstances.hasOwnProperty(p)) {
                    if (materialTextureInstances[p] === textureInstance) {
                        materialTechniqueParameters[p] = textureInstanceTexture;
                    }
                }
            }
        };

        return newMaterial;
    };

    Material.prototype.getName = function () {
        return this.name;
    };

    Material.prototype.setName = function (name) {
        this.name = name;
    };

    Material.prototype.clone = function (graphicsDevice) {
        var newMaterial = Material.create(graphicsDevice);

        if (this.effect) {
            newMaterial.effect = this.effect;
        }

        if (this.effectName) {
            newMaterial.effectName = this.effectName;
        }

        // Copy meta
        var oldMeta = this.meta;
        var newMeta = newMaterial.meta;
        var p;
        for (p in oldMeta) {
            if (oldMeta.hasOwnProperty(p)) {
                newMeta[p] = oldMeta[p];
            }
        }

        // Copy technique parameters
        var oldTechniqueParameters = this.techniqueParameters;
        var newTechniqueParameters = newMaterial.techniqueParameters;
        for (p in oldTechniqueParameters) {
            if (oldTechniqueParameters.hasOwnProperty(p)) {
                newTechniqueParameters[p] = oldTechniqueParameters[p];
            }
        }

        // Copy texture names
        var oldTextureNames = this.texturesNames;
        if (oldTextureNames) {
            var newTextureNames = newMaterial.texturesNames;
            if (!newTextureNames) {
                newMaterial.texturesNames = newTextureNames = {};
            }

            for (p in oldTextureNames) {
                if (oldTextureNames.hasOwnProperty(p)) {
                    newTextureNames[p] = oldTextureNames[p];
                }
            }
        }

        // Copy texture instances
        var oldTextureInstances = this.textureInstances;
        if (oldTextureInstances) {
            var newTextureInstances = newMaterial.textureInstances;
            if (!newTextureInstances) {
                newMaterial.textureInstances = newTextureInstances = {};
            }

            for (p in oldTextureInstances) {
                if (oldTextureInstances.hasOwnProperty(p)) {
                    var textureInstance = oldTextureInstances[p];
                    newTextureInstances[p] = textureInstance;
                    textureInstance.subscribeTextureChanged(newMaterial.onTextureChanged);
                    textureInstance.reference.add();
                }
            }
        }

        return newMaterial;
    };

    Material.prototype.loadTextures = function (textureManager) {
        var materialTextureNames = this.texturesNames;
        for (var p in materialTextureNames) {
            if (materialTextureNames.hasOwnProperty(p)) {
                var textureName = materialTextureNames[p];
                textureManager.load(textureName);
                this.setTextureInstance(p, textureManager.getInstance(textureName));
            }
        }
    };

    Material.prototype.setTextureInstance = function (propertryName, textureInstance) {
        if (!this.textureInstances) {
            this.textureInstances = {};
        }
        var oldInstance = this.textureInstances[propertryName];
        if (oldInstance !== textureInstance) {
            if (oldInstance && oldInstance.unsubscribeTextureChanged) {
                oldInstance.unsubscribeTextureChanged(this.onTextureChanged);
            }
            this.textureInstances[propertryName] = textureInstance;
            this.techniqueParameters[propertryName] = textureInstance.texture;
            textureInstance.subscribeTextureChanged(this.onTextureChanged);
            textureInstance.reference.add();
        }
    };

    Material.prototype.destroy = function () {
        delete this.techniqueParameters;

        var textureInstance;
        var textureInstances = this.textureInstances;
        for (var p in textureInstances) {
            if (textureInstances.hasOwnProperty(p)) {
                textureInstance = textureInstances[p];
                textureInstance.unsubscribeTextureChanged(this.onTextureChanged);
                textureInstance.reference.remove();
            }
        }
        delete this.textureInstances;
        delete this.texturesNames;
    };
    Material.version = 1;
    return Material;
})();
// Copyright (c) 2009-2012 Turbulenz Limited
var Floor = (function () {
    function Floor() {
    }
    Floor.create = // Constructor function
    function (gd, md) {
        var f = new Floor();

        var technique = null;
        var primitive = gd.PRIMITIVE_LINES;
        var vertexFormats = [gd.VERTEXFORMAT_FLOAT2];
        var semantics = gd.createSemantics([gd.SEMANTIC_POSITION]);
        var techniqueParameters = gd.createTechniqueParameters();

        var maxValue = Number.MAX_VALUE;
        var abs = Math.abs;
        var floor = Math.floor;
        var ceil = Math.ceil;

        var frustumMinX = maxValue;
        var frustumMinZ = maxValue;
        var frustumMaxX = -maxValue;
        var frustumMaxZ = -maxValue;

        var addPoint = function addPointFn(px, pz) {
            if (frustumMinX > px) {
                frustumMinX = px;
            }
            if (frustumMinZ > pz) {
                frustumMinZ = pz;
            }
            if (frustumMaxX < px) {
                frustumMaxX = px;
            }
            if (frustumMaxZ < pz) {
                frustumMaxZ = pz;
            }
        };

        var intersect = function intersetFn(s, e) {
            var sy = s[1];
            var ey = e[1];
            var t;
            if (sy > 0.0) {
                if (ey < 0.0) {
                    t = ((-sy) / (ey - sy));
                    addPoint(s[0] + t * (e[0] - s[0]), s[2] + t * (e[2] - s[2]));
                } else if (ey === 0.0) {
                    addPoint(e[0], e[2]);
                }
            } else if (sy < 0.0) {
                if (ey > 0.0) {
                    t = ((-sy) / (ey - sy));
                    addPoint(s[0] + t * (e[0] - s[0]), s[2] + t * (e[2] - s[2]));
                } else if (ey === 0.0) {
                    addPoint(e[0], e[2]);
                }
            } else {
                addPoint(s[0], s[2]);
                if (ey === 0.0) {
                    addPoint(e[0], e[2]);
                }
            }
        };

        f.render = function floorRenderFn(gd, camera) {
            // Calculate intersection with floor
            frustumMinX = maxValue;
            frustumMinZ = maxValue;
            frustumMaxX = -maxValue;
            frustumMaxZ = -maxValue;

            var frustumPoints = camera.getFrustumPoints();
            intersect(frustumPoints[0], frustumPoints[4]);
            intersect(frustumPoints[1], frustumPoints[5]);
            intersect(frustumPoints[2], frustumPoints[6]);
            intersect(frustumPoints[3], frustumPoints[7]);
            intersect(frustumPoints[0], frustumPoints[3]);
            intersect(frustumPoints[1], frustumPoints[2]);
            intersect(frustumPoints[4], frustumPoints[7]);
            intersect(frustumPoints[5], frustumPoints[6]);

            if ((this).numLines > 0 && frustumMinX < frustumMaxX && frustumMinZ < frustumMaxZ) {
                var halfNumLines = ((this).numLines / 2.0);
                var farPlane = camera.farPlane;
                var metersPerLine = floor(floor(2.0 * farPlane) / floor(halfNumLines));
                if (metersPerLine === 0.0) {
                    metersPerLine = 1;
                }

                var cm = camera.matrix;
                var posX = (floor(cm[9] / metersPerLine) * metersPerLine);
                var posZ = (floor(cm[11] / metersPerLine) * metersPerLine);

                var vp = camera.viewProjectionMatrix;
                var vpRight = md.m44Right(vp);
                var vpAt = md.m44At(vp);
                var vpPos = md.m44Pos(vp);

                var worldRight = md.v4ScalarMul(vpRight, farPlane);
                var worldUp = md.m44Up(vp);
                var worldAt = md.v4ScalarMul(vpAt, farPlane);
                var worldPos = md.v4Add3(md.v4ScalarMul(vpRight, posX), md.v4ScalarMul(vpAt, posZ), vpPos);

                techniqueParameters.worldViewProjection = md.m44Build(worldRight, worldUp, worldAt, worldPos, techniqueParameters.worldViewProjection);

                techniqueParameters.color = (this).color;
                techniqueParameters.fadeToColor = (this).fadeToColor;

                gd.setTechnique(technique);

                gd.setTechniqueParameters(techniqueParameters);

                // Try to draw minimum number of lines
                var invMetersPerLine = 1.0 / metersPerLine;
                var invMaxDistance = 1.0 / farPlane;
                var minX = ((floor(frustumMinX * invMetersPerLine) * metersPerLine) - posX) * invMaxDistance;
                var minZ = ((floor(frustumMinZ * invMetersPerLine) * metersPerLine) - posZ) * invMaxDistance;
                var maxX = ((ceil(frustumMaxX * invMetersPerLine) * metersPerLine) - posX) * invMaxDistance;
                var maxZ = ((ceil(frustumMaxZ * invMetersPerLine) * metersPerLine) - posZ) * invMaxDistance;

                var deltaLine = 2.0 / halfNumLines;
                var maxlinesX = (floor(halfNumLines * (abs(maxZ - minZ) / 2.0)) + 1);
                var maxlinesZ = (floor(halfNumLines * (abs(maxX - minX) / 2.0)) + 1);

                var writer;
                var current;
                var n;

                writer = gd.beginDraw(primitive, ((maxlinesX * 2) + (maxlinesZ * 2)), vertexFormats, semantics);
                if (writer) {
                    current = minZ;
                    for (n = 0; n < maxlinesX; n += 1) {
                        writer(minX, current);
                        writer(maxX, current);
                        current += deltaLine;
                    }

                    current = minX;
                    for (n = 0; n < maxlinesZ; n += 1) {
                        writer(current, minZ);
                        writer(current, maxZ);
                        current += deltaLine;
                    }

                    gd.endDraw(writer);

                    writer = null;
                }
            }
        };

        var shaderParameters = {
            "version": 1,
            "name": "floor.cgfx",
            "parameters": {
                "worldViewProjection": {
                    "type": "float",
                    "rows": 4,
                    "columns": 4
                },
                "color": {
                    "type": "float",
                    "columns": 4
                },
                "fadeToColor": {
                    "type": "float",
                    "columns": 4
                }
            },
            "techniques": {
                "floor": [
                    {
                        "parameters": ["worldViewProjection", "color", "fadeToColor"],
                        "semantics": ["POSITION"],
                        "states": {
                            "DepthTestEnable": true,
                            "DepthFunc": 515,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_floor", "fp_floor"]
                    }
                ]
            },
            "programs": {
                "fp_floor": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\nprecision mediump float;precision mediump int;\n#endif\nvec4 _ret_0;float _TMP11;float _a0012;float _TMP15;float _b0020;uniform vec4 color;uniform vec4 fadeToColor;varying vec4 tz_TexCoord[1];void main()\n{_a0012=dot(tz_TexCoord[0].xy,tz_TexCoord[0].xy);_TMP11=1.0/inversesqrt(_a0012);_b0020=min(1.0,_TMP11);_TMP15=max(0.0,_b0020);_ret_0=color+_TMP15*(fadeToColor-color);gl_FragColor=_ret_0;}"
                },
                "vp_floor": {
                    "type": "vertex",
                    "code": "#ifdef GL_ES\nprecision mediump float;precision mediump int;\n#endif\nvarying vec4 tz_TexCoord[1];attribute vec4 ATTR0;\nvec4 _OUTPosition1;vec2 _OUTDistance1;uniform vec4 worldViewProjection[4];void main()\n{_OUTPosition1=ATTR0.xxxx*worldViewProjection[0]+ATTR0.yyyy*worldViewProjection[2]+worldViewProjection[3];_OUTDistance1=ATTR0.xy;tz_TexCoord[0].xy=ATTR0.xy;gl_Position=_OUTPosition1;}"
                }
            }
        };

        var shader = gd.createShader(shaderParameters);
        if (shader) {
            technique = shader.getTechnique(0);
            return f;
        }

        return null;
    };
    Floor.version = 1;
    return Floor;
})();

Floor.prototype.color = [0.1, 0.1, 1.0, 1.0], Floor.prototype.fadeToColor = [0.95, 0.95, 1.0, 1.0], Floor.prototype.numLines = 200;
// Copyright (c) 2010-2013 Turbulenz Limited
;

//
// Geometry
//
var Geometry = (function () {
    function Geometry() {
    }
    Geometry.prototype.destroy = function () {
        if (this.vertexBufferAllocation) {
            this.vertexBufferManager.free(this.vertexBufferAllocation);
            delete this.vertexBufferManager;
            delete this.vertexBufferAllocation;
        }
        if (this.indexBufferAllocation) {
            this.indexBufferManager.free(this.indexBufferAllocation);
            delete this.indexBufferManager;
            delete this.indexBufferAllocation;
        }
        delete this.vertexBuffer;
        delete this.indexBuffer;
        delete this.vertexData;
        delete this.indexData;
        delete this.semantics;
        delete this.first;
        delete this.halfExtents;
        delete this.reference;
        delete this.surfaces;
    };

    Geometry.create = function () {
        var geometry = new Geometry();
        geometry.reference = Reference.create(geometry);
        geometry.surfaces = {};
        geometry.type = "rigid";
        return geometry;
    };
    Geometry.version = 1;
    return Geometry;
})();

//
// GeometryInstance
//
var GeometryInstance = (function () {
    function GeometryInstance() {
    }
    //
    // clone
    //
    GeometryInstance.prototype.clone = function () {
        var newInstance = GeometryInstance.create(this.geometry, this.surface, this.sharedMaterial);

        if (this.disabled) {
            newInstance.disabled = true;
        }

        return newInstance;
    };

    //
    // isSkinned
    //
    GeometryInstance.prototype.isSkinned = function () {
        if (this.geometry.skeleton) {
            return true;
        }
        return false;
    };

    //
    // setNode
    //
    GeometryInstance.prototype.setNode = function (node) {
        if (this.node) {
            if (this.hasCustomWorldExtents()) {
                this.node.renderableWorldExtentsRemoved();
            }
        }

        this.node = node;

        if (this.node) {
            if (this.hasCustomWorldExtents()) {
                this.node.renderableWorldExtentsUpdated(false);
            }
        }
        this.worldExtentsUpdate = -1;
    };

    //
    // getNode
    //
    GeometryInstance.prototype.getNode = function () {
        return this.node;
    };

    //
    // setMaterial
    //
    GeometryInstance.prototype.setMaterial = function (material) {
        material.reference.add();
        this.sharedMaterial.reference.remove();

        this.sharedMaterial = material;

        this.renderUpdate = undefined;
        this.rendererInfo = undefined;
    };

    //
    // getMaterial
    //
    GeometryInstance.prototype.getMaterial = function () {
        return this.sharedMaterial;
    };

    //
    // getWorldExtents
    //
    GeometryInstance.prototype.getWorldExtents = function () {
        //Note: This method is only valid on a clean node.
        var node = this.node;
        if (node.worldUpdate > this.worldExtentsUpdate) {
            this.worldExtentsUpdate = node.worldUpdate;
            this.updateWorldExtents(node.world);
        }
        return this.worldExtents;
    };

    //
    // updateWorldExtents
    //
    GeometryInstance.prototype.updateWorldExtents = function (world) {
        var center = this.center;
        var halfExtents = this.halfExtents;
        var worldExtents = this.worldExtents;

        var m0 = world[0];
        var m1 = world[1];
        var m2 = world[2];
        var m3 = world[3];
        var m4 = world[4];
        var m5 = world[5];
        var m6 = world[6];
        var m7 = world[7];
        var m8 = world[8];

        var ct0 = world[9];
        var ct1 = world[10];
        var ct2 = world[11];
        if (center) {
            var c0 = center[0];
            var c1 = center[1];
            var c2 = center[2];
            ct0 += (m0 * c0 + m3 * c1 + m6 * c2);
            ct1 += (m1 * c0 + m4 * c1 + m7 * c2);
            ct2 += (m2 * c0 + m5 * c1 + m8 * c2);
        }

        var h0 = halfExtents[0];
        var h1 = halfExtents[1];
        var h2 = halfExtents[2];
        var ht0 = ((m0 < 0 ? -m0 : m0) * h0 + (m3 < 0 ? -m3 : m3) * h1 + (m6 < 0 ? -m6 : m6) * h2);
        var ht1 = ((m1 < 0 ? -m1 : m1) * h0 + (m4 < 0 ? -m4 : m4) * h1 + (m7 < 0 ? -m7 : m7) * h2);
        var ht2 = ((m2 < 0 ? -m2 : m2) * h0 + (m5 < 0 ? -m5 : m5) * h1 + (m8 < 0 ? -m8 : m8) * h2);

        worldExtents[0] = (ct0 - ht0);
        worldExtents[1] = (ct1 - ht1);
        worldExtents[2] = (ct2 - ht2);
        worldExtents[3] = (ct0 + ht0);
        worldExtents[4] = (ct1 + ht1);
        worldExtents[5] = (ct2 + ht2);
    };

    //
    // addCustomWorldExtents
    //
    GeometryInstance.prototype.addCustomWorldExtents = function (customWorldExtents) {
        var alreadyHadCustomExtents = (this.worldExtentsUpdate === GeometryInstance.maxUpdateValue);
        var worldExtents = this.worldExtents;
        if (!alreadyHadCustomExtents || customWorldExtents[0] !== worldExtents[0] || customWorldExtents[1] !== worldExtents[1] || customWorldExtents[2] !== worldExtents[2] || customWorldExtents[3] !== worldExtents[3] || customWorldExtents[4] !== worldExtents[4] || customWorldExtents[5] !== worldExtents[5]) {
            this.worldExtentsUpdate = GeometryInstance.maxUpdateValue;
            worldExtents[0] = customWorldExtents[0];
            worldExtents[1] = customWorldExtents[1];
            worldExtents[2] = customWorldExtents[2];
            worldExtents[3] = customWorldExtents[3];
            worldExtents[4] = customWorldExtents[4];
            worldExtents[5] = customWorldExtents[5];
            this.node.renderableWorldExtentsUpdated(alreadyHadCustomExtents);
        }
    };

    //
    // removeCustomWorldExtents
    //
    GeometryInstance.prototype.removeCustomWorldExtents = function () {
        this.worldExtentsUpdate = -1;
        this.node.renderableWorldExtentsRemoved();
    };

    //
    // getCustomWorldExtents
    //
    GeometryInstance.prototype.getCustomWorldExtents = function () {
        if (this.worldExtentsUpdate === GeometryInstance.maxUpdateValue) {
            return this.worldExtents;
        }
        return undefined;
    };

    //
    // hasCustomWorldExtents
    //
    GeometryInstance.prototype.hasCustomWorldExtents = function () {
        return this.worldExtentsUpdate === GeometryInstance.maxUpdateValue;
    };

    //
    // destroy
    //
    GeometryInstance.prototype.destroy = function () {
        if (this.geometry.reference) {
            this.geometry.reference.remove();
        }

        if (this.sharedMaterial.reference) {
            this.sharedMaterial.reference.remove();
        }

        delete this.surface;
        delete this.geometry;
        delete this.sharedMaterial;
        delete this.techniqueParameters;
        delete this.halfExtents;
        delete this.center;
        delete this.worldExtentsUpdate;
        delete this.drawParameters;
        delete this.renderUpdate;
        delete this.rendererInfo;
        delete this.sorting;
    };

    //
    // prepareDrawParameters
    //
    GeometryInstance.prototype.prepareDrawParameters = function (drawParameters) {
        var surface = this.surface;
        var geometry = this.geometry;
        drawParameters.setVertexBuffer(0, geometry.vertexBuffer);
        drawParameters.setSemantics(0, this.semantics);

        drawParameters.primitive = surface.primitive;

        drawParameters.firstIndex = surface.first;

        if (surface.indexBuffer) {
            drawParameters.indexBuffer = surface.indexBuffer;
            drawParameters.count = surface.numIndices;
        } else {
            drawParameters.count = surface.numVertices;
        }
    };

    GeometryInstance.create = //
    // Constructor function
    //
    function (geometry, surface, sharedMaterial) {
        var instance = new GeometryInstance();
        var graphicsDevice = TurbulenzEngine.getGraphicsDevice();

        instance.geometry = geometry;
        instance.geometry.reference.add();
        instance.geometryType = geometry.type;
        instance.surface = surface;
        instance.semantics = geometry.semantics;

        instance.halfExtents = geometry.halfExtents;
        instance.center = geometry.center;

        instance.techniqueParameters = graphicsDevice ? graphicsDevice.createTechniqueParameters() : null;
        instance.sharedMaterial = sharedMaterial;
        if (instance.sharedMaterial) {
            instance.sharedMaterial.reference.add();
        }
        instance.worldExtents = new instance.arrayConstructor(6);
        instance.worldExtentsUpdate = -1;
        instance.worldUpdate = -1;

        instance.node = undefined;
        instance.renderUpdate = undefined;
        instance.rendererInfo = undefined;

        return instance;
    };
    GeometryInstance.version = 1;
    GeometryInstance.maxUpdateValue = Number.MAX_VALUE;
    return GeometryInstance;
})();

// Detect correct typed arrays
((function () {
    GeometryInstance.prototype.arrayConstructor = Array;
    if (typeof Float32Array !== "undefined") {
        var testArray = new Float32Array(4);
        var textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Float32Array]') {
            GeometryInstance.prototype.arrayConstructor = Float32Array;
        }
    }
})());
// Copyright (c) 2010-2012 Turbulenz Limited
/*global TurbulenzEngine: false */
/*global VMath: false */
//
// Light
//
var Light = (function () {
    function Light() {
    }
    //
    // clone
    //
    Light.prototype.clone = function () {
        var clone = new Light();

        clone.name = this.name;
        clone.spot = this.spot;
        clone.ambient = this.ambient;
        clone.point = this.point;
        clone.fog = this.fog;
        clone.global = this.global;
        clone.directional = this.directional;
        clone.color = (this.color && this.color.slice());
        clone.direction = (this.direction && this.direction.slice());
        clone.origin = (this.origin && this.origin.slice());
        clone.frustum = (this.frustum && this.frustum.slice());
        clone.frustumNear = this.frustumNear;
        clone.center = (this.center && this.center.slice());
        clone.halfExtents = (this.halfExtents && this.halfExtents.slice());
        clone.radius = this.radius;
        clone.shadows = this.shadows;
        clone.dynamicshadows = this.dynamicshadows;
        clone.disabled = this.disabled;
        clone.dynamic = this.dynamic;
        clone.techniqueParameters = this.techniqueParameters;

        return clone;
    };

    //
    // isGlobal
    //
    Light.prototype.isGlobal = function () {
        return this.global;
    };

    Light.create = //
    // Light create
    //
    function (params) {
        var light = new Light();

        var mathDevice = TurbulenzEngine.getMathDevice();

        var abs = Math.abs;
        var max = Math.max;

        if (params.name) {
            light.name = params.name;
        }

        light.color = params.color && params.color.length ? params.color : mathDevice.v3BuildOne();

        if (params.directional) {
            light.directional = true;
        } else if (params.spot) {
            light.spot = true;
        } else if (params.ambient) {
            light.ambient = true;
        } else {
            light.point = true;
        }

        light.origin = params.origin;

        var target = params.target;
        if (target || light.spot) {
            if (!target) {
                target = mathDevice.v3Build(0, 0, -(params.radius || 1));
            }

            // "falloff_angle" is the total angle in degrees
            // calculate half angle in radians: angle * 0.5 / 180 * PI
            var angle = (params.falloff_angle || 90) / 360 * Math.PI;
            var tangent = Math.abs(target[2]) * Math.tan(angle);

            var right = params.right || mathDevice.v3Build(tangent, 0, 0);
            var up = params.up || mathDevice.v3Build(0, tangent, 0);
            var end = params.end || target;

            light.frustum = mathDevice.m33Build(right, up, end);
            var d0 = (abs(right[0]) + abs(up[0]));
            var d1 = (abs(right[1]) + abs(up[1]));
            var d2 = (abs(right[2]) + abs(up[2]));
            var e0 = end[0];
            var e1 = end[1];
            var e2 = end[2];
            var c0, c1, c2;
            var start = params.start;
            if (start) {
                target = mathDevice.v3Normalize(target);
                light.frustumNear = (mathDevice.v3Dot(target, start) / mathDevice.v3Dot(target, end));
                c0 = ((e0 + start[0]) * 0.5);
                c1 = ((e1 + start[1]) * 0.5);
                c2 = ((e2 + start[2]) * 0.5);
            } else {
                light.frustumNear = 0;
                c0 = (e0 * 0.5);
                c1 = (e1 * 0.5);
                c2 = (e2 * 0.5);
            }
            light.center = mathDevice.v3Build(c0, c1, c2);
            light.halfExtents = mathDevice.v3Build(max(abs(e0 - d0 - c0), abs(e0 + d0 - c0)), max(abs(e1 - d1 - c1), abs(e1 + d1 - c1)), max(abs(e2 - d2 - c2), abs(e2 + d2 - c2)));
        } else {
            var halfExtents = params.halfExtents;
            if (halfExtents) {
                light.halfExtents = (halfExtents.length && halfExtents) || mathDevice.v3BuildZero();
            } else {
                var radius = params.radius;
                if (radius) {
                    light.radius = radius;
                    light.halfExtents = mathDevice.v3ScalarBuild(radius);
                } else if (!light.ambient) {
                    light.halfExtents = mathDevice.v3ScalarBuild(VMath.FLOAT_MAX);
                }
            }
        }

        light.direction = params.direction;

        if (!params.halfExtents && !params.radius && !params.target) {
            light.global = true;
        }

        if (!light.global && (params.shadows || params.dynamicshadows)) {
            light.shadows = true;

            if (params.dynamicshadows) {
                light.dynamicshadows = true;
            }
        }

        if (params.disabled) {
            light.disabled = true;
        }

        if (params.dynamic) {
            light.dynamic = true;
        }

        var material = params.material;
        if (material) {
            var techniqueParameters = material.techniqueParameters;

            light.techniqueParameters = techniqueParameters;

            var metaMaterial = material.meta;
            if (metaMaterial) {
                var ambient = metaMaterial.ambient;
                if (ambient) {
                    light.ambient = true;
                }

                var fog = metaMaterial.fog;
                if (fog) {
                    light.fog = true;
                }
            }
        }

        return light;
    };
    Light.version = 1;
    return Light;
})();
;

//
// Light Instance
//
var LightInstance = (function () {
    function LightInstance() {
    }
    //
    // setMaterial
    //
    LightInstance.prototype.setMaterial = function (material) {
        // TODO: this is really being set on the light not the instance so
        // we either need to move the materials and meta to the instance or remove this
        // and create Scene.setLightMaterial
        this.light.sharedMaterial = material;

        var meta = material.meta;
        if (material.meta) {
            var ambient = meta.ambient;
            if (ambient) {
                this.light.ambient = true;
            } else {
                if (this.light.ambient) {
                    delete this.light.ambient;
                }
            }

            var fog = meta.fog;
            if (fog) {
                this.light.fog = true;
            } else {
                if (this.light.fog) {
                    delete this.light.fog;
                }
            }
        }
    };

    //
    // setNode
    //
    LightInstance.prototype.setNode = function (node) {
        this.node = node;
        this.worldExtentsUpdate = -1;
    };

    //
    // getNode
    //
    LightInstance.prototype.getNode = function () {
        return this.node;
    };

    //
    // getWorldExtents
    //
    LightInstance.prototype.getWorldExtents = function () {
        //Note: This method is only valid on a clean node.
        var worldExtents = this.worldExtents;
        var node = this.node;
        if (node.worldUpdate !== this.worldExtentsUpdate) {
            //Note: set this.worldExtentsUpdate to -1 if local extents change.
            // If we need custom extents we can set worldExtentsUpdate to some distinct value <0.
            this.worldExtentsUpdate = node.worldUpdate;

            var light = this.light;

            var world = node.world;
            var m0 = world[0];
            var m1 = world[1];
            var m2 = world[2];
            var m3 = world[3];
            var m4 = world[4];
            var m5 = world[5];
            var m6 = world[6];
            var m7 = world[7];
            var m8 = world[8];

            var ct0 = world[9];
            var ct1 = world[10];
            var ct2 = world[11];

            if (light.spot) {
                var minX, minY, minZ, maxX, maxY, maxZ, pX, pY, pZ;
                minX = ct0;
                minY = ct1;
                minZ = ct2;
                maxX = ct0;
                maxY = ct1;
                maxZ = ct2;

                //var transform = md.m33MulM43(light.frustum, world);
                //var p0 = md.m43TransformPoint(transform, md.v3Build(-1, -1, 1));
                //var p1 = md.m43TransformPoint(transform, md.v3Build(1, -1, 1));
                //var p2 = md.m43TransformPoint(transform, md.v3Build(-1, 1, 1));
                //var p3 = md.m43TransformPoint(transform, md.v3Build(1, 1, 1));
                var f = light.frustum;
                var f0 = f[0];
                var f1 = f[1];
                var f2 = f[2];
                var f3 = f[3];
                var f4 = f[4];
                var f5 = f[5];
                var f6 = f[6];
                var f7 = f[7];
                var f8 = f[8];

                ct0 += (m0 * f6 + m3 * f7 + m6 * f8);
                ct1 += (m1 * f6 + m4 * f7 + m7 * f8);
                ct2 += (m2 * f6 + m5 * f7 + m8 * f8);

                var abs = Math.abs;
                var d0 = (abs(m0 * f0 + m3 * f1 + m6 * f2) + abs(m0 * f3 + m3 * f4 + m6 * f5));
                var d1 = (abs(m1 * f0 + m4 * f1 + m7 * f2) + abs(m1 * f3 + m4 * f4 + m7 * f5));
                var d2 = (abs(m2 * f0 + m5 * f1 + m8 * f2) + abs(m2 * f3 + m5 * f4 + m8 * f5));
                pX = (ct0 - d0);
                pY = (ct1 - d1);
                pZ = (ct2 - d2);
                if (minX > pX) {
                    minX = pX;
                }
                if (minY > pY) {
                    minY = pY;
                }
                if (minZ > pZ) {
                    minZ = pZ;
                }

                pX = (ct0 + d0);
                pY = (ct1 + d1);
                pZ = (ct2 + d2);
                if (maxX < pX) {
                    maxX = pX;
                }
                if (maxY < pY) {
                    maxY = pY;
                }
                if (maxZ < pZ) {
                    maxZ = pZ;
                }

                worldExtents[0] = minX;
                worldExtents[1] = minY;
                worldExtents[2] = minZ;
                worldExtents[3] = maxX;
                worldExtents[4] = maxY;
                worldExtents[5] = maxZ;
            } else {
                var center = light.center;
                var halfExtents = light.halfExtents;

                if (center) {
                    var c0 = center[0];
                    var c1 = center[1];
                    var c2 = center[2];
                    ct0 += (m0 * c0 + m3 * c1 + m6 * c2);
                    ct1 += (m1 * c0 + m4 * c1 + m7 * c2);
                    ct2 += (m2 * c0 + m5 * c1 + m8 * c2);
                }

                var h0 = halfExtents[0];
                var h1 = halfExtents[1];
                var h2 = halfExtents[2];
                var ht0 = ((m0 < 0 ? -m0 : m0) * h0 + (m3 < 0 ? -m3 : m3) * h1 + (m6 < 0 ? -m6 : m6) * h2);
                var ht1 = ((m1 < 0 ? -m1 : m1) * h0 + (m4 < 0 ? -m4 : m4) * h1 + (m7 < 0 ? -m7 : m7) * h2);
                var ht2 = ((m2 < 0 ? -m2 : m2) * h0 + (m5 < 0 ? -m5 : m5) * h1 + (m8 < 0 ? -m8 : m8) * h2);

                worldExtents[0] = (ct0 - ht0);
                worldExtents[1] = (ct1 - ht1);
                worldExtents[2] = (ct2 - ht2);
                worldExtents[3] = (ct0 + ht0);
                worldExtents[4] = (ct1 + ht1);
                worldExtents[5] = (ct2 + ht2);
            }
        }
        return worldExtents;
    };

    //
    // clone
    //
    LightInstance.prototype.clone = function () {
        var newInstance = LightInstance.create(this.light);
        return newInstance;
    };

    LightInstance.create = //
    // Constructor function
    //
    function (light) {
        var instance = new LightInstance();

        instance.node = undefined;
        instance.light = light;
        instance.worldExtents = new instance.arrayConstructor(6);
        instance.worldExtentsUpdate = -1;

        return instance;
    };
    LightInstance.version = 1;
    return LightInstance;
})();

// Detect correct typed arrays
((function () {
    LightInstance.prototype.arrayConstructor = Array;
    if (typeof Float32Array !== "undefined") {
        var testArray = new Float32Array(4);
        var textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Float32Array]') {
            LightInstance.prototype.arrayConstructor = Float32Array;
        }
    }
})());
// Copyright (c) 2009-2012 Turbulenz Limited
//
// MouseForces
//
var MouseForces = (function () {
    function MouseForces() {
    }
    MouseForces.prototype.generatePickRay = function (cameraTransform, viewWindowX, viewWindowY, aspectRatio, farPlane) {
        var md = this.md;
        var cam_right = md.m43Right(cameraTransform);
        var cam_up = md.m43Up(cameraTransform);
        var cam_at = md.v3Build(-cameraTransform[6], -cameraTransform[7], -cameraTransform[8]);
        var cam_pos = md.m43Pos(cameraTransform);

        this.X = this.mouseX;
        this.Y = this.mouseY;

        var x = (2.0 * this.X - 1.0) * viewWindowX;
        var y = (2.0 * this.Y - 1.0) * viewWindowY / aspectRatio;

        this.pickRayFrom = cam_pos;

        var direction = md.v3Normalize(md.v3Sub(md.v3Add(cam_at, md.v3ScalarMul(cam_right, x)), md.v3ScalarMul(cam_up, y)));
        this.pickRayTo = md.v3Add(cam_pos, md.v3ScalarMul(direction, farPlane));
    };

    MouseForces.prototype.update = function (dynamicsWorld, camera, force) {
        var md = this.md;
        if (this.grabBody) {
            this.generatePickRay(camera.matrix, 1.0 / camera.recipViewWindowX, 1.0 / camera.recipViewWindowY, camera.aspectRatio, camera.farPlane);

            if (this.pickedBody) {
                //keep it at the same picking distance
                var dir = md.v3Normalize(md.v3Sub(this.pickRayTo, this.pickRayFrom));
                var newPos = md.v3Add(this.pickRayFrom, md.v3ScalarMul(dir, this.oldPickingDist));
                if (this.dragExtentsMin) {
                    // If the user has supplied a bound for the dragging apply it
                    newPos = md.v3Max(newPos, this.dragExtentsMin);
                    newPos = md.v3Min(newPos, this.dragExtentsMax);
                }
                this.pickConstraint.pivotB = newPos;
                this.pickedBody.active = true;
            } else {
                //add a point to point constraint for picking
                var rayHit = dynamicsWorld.rayTest({
                    from: this.pickRayFrom,
                    to: this.pickRayTo,
                    mask: this.pickFilter
                });
                if (rayHit) {
                    var body = rayHit.body;
                    var pickPos = rayHit.hitPoint;

                    body.active = true;

                    this.pickedBody = body;

                    var localPivot = md.m43TransformPoint(md.m43InverseOrthonormal(body.transform), pickPos);

                    this.pickConstraint = this.pd.createPoint2PointConstraint({
                        bodyA: body,
                        pivotA: localPivot,
                        force: force,
                        damping: 0.5,
                        impulseClamp: this.clamp
                    });

                    dynamicsWorld.addConstraint(this.pickConstraint);

                    this.oldPickingDist = md.v3Length(md.v3Sub(pickPos, this.pickRayFrom));
                }
            }
        } else {
            if (this.pickedBody) {
                dynamicsWorld.removeConstraint(this.pickConstraint);
                this.pickConstraint = null;

                this.pickedBody = null;
            }
        }
    };

    MouseForces.create = // Constructor function
    function (gd, id, md, pd, dragExtentsMin, dragExtentsMax) {
        var c = new MouseForces();

        c.md = md;
        c.pd = pd;

        c.pickFilter = pd.FILTER_DYNAMIC;

        c.pickRayFrom = [0, 0, 0];
        c.pickRayTo = [0, 0, 0];

        c.clamp = 0;

        c.pickConstraint = null;
        c.pickedBody = null;

        c.oldPickingDist = 0;

        if (dragExtentsMin && dragExtentsMax) {
            c.dragExtentsMin = dragExtentsMin;
            c.dragExtentsMax = dragExtentsMax;
        }

        c.mouseX = 0.5;
        c.mouseY = 0.5;
        c.mouseZ = 0.0;
        c.X = 0.5;
        c.Y = 0.5;
        c.Z = 0.0;

        c.grabBody = false;

        // Mouse handling
        c.onmousewheel = function onmousewheelFn(delta) {
            c.mouseZ += delta;

            return false;
        };

        c.onmousemove = function onmousemoveFn(deltaX, deltaY) {
            c.mouseX += (deltaX / gd.width);
            c.mouseY += (deltaY / gd.height);

            return false;
        };

        c.onmousedown = function onmousedownFn() {
            c.mouseX = 0.5;
            c.mouseY = 0.5;
            c.mouseZ = 0.0;
            c.grabBody = true;
            return false;
        };

        c.onmouseup = function onmouseupFn() {
            c.mouseX = 0.5;
            c.mouseY = 0.5;
            c.mouseZ = 0.0;

            c.grabBody = false;
            return false;
        };

        id.addEventListener("mousewheel", c.onmousewheel);
        id.addEventListener("mousemove", c.onmousemove);
        id.addEventListener("mousedown", c.onmousedown);
        id.addEventListener("mouseup", c.onmouseup);

        return c;
    };
    MouseForces.version = 1;
    return MouseForces;
})();
// Copyright (c) 2010-2013 Turbulenz Limited
;

//
// physicsmanager
//
var PhysicsManager = (function () {
    function PhysicsManager() {
    }
    //
    // addNode
    //
    PhysicsManager.prototype.addNode = function (sceneNode, physicsObject, origin, triangleArray) {
        var physicsNode = {
            body: physicsObject,
            target: sceneNode
        };

        physicsObject.userData = sceneNode;

        if (origin) {
            physicsNode.origin = origin;
        }

        if (triangleArray) {
            physicsNode.triangleArray = triangleArray;
        }

        if (physicsObject.kinematic) {
            physicsNode.kinematic = true;

            sceneNode.setDynamic();
            sceneNode.kinematic = true;

            this.kinematicPhysicsNodes.push(physicsNode);
        } else if ("mass" in physicsObject) {
            physicsNode.dynamic = true;

            sceneNode.setDynamic();

            this.dynamicPhysicsNodes.push(physicsNode);
        }

        var targetPhysicsNodes = sceneNode.physicsNodes;
        if (targetPhysicsNodes) {
            targetPhysicsNodes.push(physicsNode);
        } else {
            sceneNode.physicsNodes = [physicsNode];
            this.subscribeSceneNode(sceneNode);
        }

        this.physicsNodes.push(physicsNode);

        this.enableHierarchy(sceneNode, true);
    };

    //
    // update
    //
    PhysicsManager.prototype.update = function () {
        var mathsDevice = this.mathsDevice;

        // Dynamic nodes
        var physicsNodes = this.dynamicPhysicsNodes;
        var numPhysicsNodes = physicsNodes.length;
        var physicsNode, body, target, worldMatrix, origin, n;
        if (numPhysicsNodes > 0) {
            for (n = 0; n < numPhysicsNodes; n += 1) {
                physicsNode = physicsNodes[n];
                body = physicsNode.body;
                if (body.active) {
                    target = physicsNode.target;
                    if (target.disabled) {
                        continue;
                    }

                    if (target.parent) {
                        debug.abort("Rigid bodies with parent nodes are unsupported");
                        //Not really possible, since the child can become inactive (frozen) and therefore it will
                        /*var parentWorld = target.parent.getWorldTransform();
                        var inverseParent = mathsDevice.m43Inverse(parentWorld);
                        var newLocal = mathsDevice.m43Mul(worldMatrix, inverseParent);
                        target.setLocalTransform(newLocal);*/
                    } else {
                        worldMatrix = target.getLocalTransform();
                        body.calculateTransform(worldMatrix, physicsNode.origin);
                        target.setLocalTransform(worldMatrix);
                    }
                }
            }
        }

        // Kinematic nodes
        var tempMatrix = this.tempMatrix;
        physicsNodes = this.kinematicPhysicsNodes;
        numPhysicsNodes = physicsNodes.length;
        for (n = 0; n < numPhysicsNodes; n += 1) {
            physicsNode = physicsNodes[n];
            target = physicsNode.target;
            if (target.disabled) {
                continue;
            }

            if (target.worldUpdate !== physicsNode.worldUpdate) {
                physicsNode.worldUpdate = target.worldUpdate;
                worldMatrix = target.getWorldTransform();
                origin = physicsNode.origin;
                if (origin) {
                    // The physics API copies the matrix instead of referencing it
                    // so it is safe to share a temp one
                    physicsNode.body.transform = mathsDevice.m43Offset(worldMatrix, origin, tempMatrix);
                } else {
                    physicsNode.body.transform = worldMatrix;
                }
            }
        }
    };

    //
    // enableNode
    //
    PhysicsManager.prototype.enableNode = function (sceneNode, enabled) {
        var physicsNodes = sceneNode.physicsNodes;

        if (physicsNodes) {
            var dynamicsWorld = this.dynamicsWorld;
            var numPhysicsNodes = physicsNodes.length;
            for (var p = 0; p < numPhysicsNodes; p += 1) {
                var physicsNode = physicsNodes[p];
                var body = physicsNode.body;
                if (body) {
                    if (physicsNode.kinematic) {
                        if (enabled) {
                            dynamicsWorld.addCollisionObject(body);
                        } else {
                            dynamicsWorld.removeCollisionObject(body);
                        }
                    } else if (physicsNode.dynamic) {
                        if (enabled) {
                            dynamicsWorld.addRigidBody(body);
                        } else {
                            dynamicsWorld.removeRigidBody(body);
                        }
                    } else {
                        if (enabled) {
                            dynamicsWorld.addCollisionObject(body);
                        } else {
                            dynamicsWorld.removeCollisionObject(body);
                        }
                    }
                }
            }
        }
    };

    //
    // enableHierarchy
    //
    PhysicsManager.prototype.enableHierarchy = function (sceneNode, enabled) {
        this.enableNode(sceneNode, enabled);

        var children = sceneNode.children;
        if (children) {
            var numChildren = children.length;
            for (var c = 0; c < numChildren; c += 1) {
                this.enableHierarchy(children[c], enabled);
            }
        }
    };

    //
    // deletePhysicsNode
    //
    PhysicsManager.prototype.deletePhysicsNode = function (physicsNode) {
        var physicsNodes = this.physicsNodes;
        var numPhysicsNodes = physicsNodes.length;
        var n;
        for (n = 0; n < numPhysicsNodes; n += 1) {
            if (physicsNodes[n] === physicsNode) {
                physicsNodes.splice(n, 1);
                break;
            }
        }

        physicsNodes = this.dynamicPhysicsNodes;
        numPhysicsNodes = physicsNodes.length;
        for (n = 0; n < numPhysicsNodes; n += 1) {
            if (physicsNodes[n] === physicsNode) {
                physicsNodes.splice(n, 1);
                break;
            }
        }

        physicsNodes = this.kinematicPhysicsNodes;
        numPhysicsNodes = physicsNodes.length;
        for (n = 0; n < numPhysicsNodes; n += 1) {
            if (physicsNodes[n] === physicsNode) {
                physicsNodes.splice(n, 1);
                break;
            }
        }
    };

    //
    // deleteNode
    //
    PhysicsManager.prototype.deleteNode = function (sceneNode) {
        var physicsNodes = sceneNode.physicsNodes;
        if (physicsNodes) {
            var physicsDevice = this.physicsDevice;
            var dynamicsWorld = this.dynamicsWorld;
            if (physicsDevice && dynamicsWorld) {
                var numPhysicsNodes = physicsNodes.length;
                for (var p = 0; p < numPhysicsNodes; p += 1) {
                    var physicsNode = physicsNodes[p];
                    var body = physicsNode.body;
                    if (body) {
                        if (physicsNode.kinematic) {
                            dynamicsWorld.removeCollisionObject(body);
                        } else if (physicsNode.dynamic) {
                            dynamicsWorld.removeRigidBody(body);
                        } else {
                            dynamicsWorld.removeCollisionObject(body);
                        }
                    }
                    this.deletePhysicsNode(physicsNode);
                }

                this.unsubscribeSceneNode(sceneNode);
                delete sceneNode.physicsNodes;
            }
        }
    };

    //
    // deleteHierarchy
    //
    PhysicsManager.prototype.deleteHierarchy = function (sceneNode) {
        this.deleteNode(sceneNode);

        var children = sceneNode.children;
        if (children) {
            var numChildren = children.length;
            for (var c = 0; c < numChildren; c += 1) {
                this.deleteHierarchy(children[c]);
            }
        }
    };

    //
    // calculateHierarchyExtents
    //
    PhysicsManager.prototype.calculateHierarchyExtents = function (sceneNode) {
        var min = Math.min;
        var max = Math.max;
        var maxValue = Number.MAX_VALUE;
        var arrayConstructor = this.arrayConstructor;

        /*jshint newcap: false*/
        var totalExtents = new arrayConstructor(6);

        /*jshint newcap: true*/
        totalExtents[2] = totalExtents[1] = totalExtents[0] = maxValue;
        totalExtents[5] = totalExtents[4] = totalExtents[3] = -maxValue;

        var calculateNodeExtents = function calculateNodeExtentsFn(sceneNode) {
            var physicsNodes = sceneNode.physicsNodes;
            if (physicsNodes) {
                var numPhysicsNodes = physicsNodes.length;

                /*jshint newcap: false*/
                var extents = new arrayConstructor(6);

                for (var p = 0; p < numPhysicsNodes; p += 1) {
                    physicsNodes[p].body.calculateExtents(extents);
                    totalExtents[0] = min(totalExtents[0], extents[0]);
                    totalExtents[1] = min(totalExtents[1], extents[1]);
                    totalExtents[2] = min(totalExtents[2], extents[2]);
                    totalExtents[3] = max(totalExtents[3], extents[3]);
                    totalExtents[4] = max(totalExtents[4], extents[4]);
                    totalExtents[5] = max(totalExtents[5], extents[5]);
                }
            }

            var children = sceneNode.children;
            if (children) {
                var numChildren = children.length;
                for (var n = 0; n < numChildren; n += 1) {
                    calculateNodeExtents(children[n]);
                }
            }
        };

        calculateNodeExtents(sceneNode);

        if (totalExtents[0] >= totalExtents[3]) {
            return undefined;
        }
        return totalExtents;
    };

    //
    // calculateExtents
    //
    PhysicsManager.prototype.calculateExtents = function (sceneNode) {
        var min = Math.min;
        var max = Math.max;
        var maxValue = Number.MAX_VALUE;
        var totalExtents = new this.arrayConstructor(6);
        totalExtents[2] = totalExtents[1] = totalExtents[0] = maxValue;
        totalExtents[5] = totalExtents[4] = totalExtents[3] = -maxValue;

        var physicsNodes = sceneNode.physicsNodes;
        if (physicsNodes) {
            var numPhysicsNodes = physicsNodes.length;
            var extents = new this.arrayConstructor(6);
            for (var p = 0; p < numPhysicsNodes; p += 1) {
                physicsNodes[p].body.calculateExtents(extents);
                totalExtents[0] = min(totalExtents[0], extents[0]);
                totalExtents[1] = min(totalExtents[1], extents[1]);
                totalExtents[2] = min(totalExtents[2], extents[2]);
                totalExtents[3] = max(totalExtents[3], extents[3]);
                totalExtents[4] = max(totalExtents[4], extents[4]);
                totalExtents[5] = max(totalExtents[5], extents[5]);
            }
        }

        if (totalExtents[0] >= totalExtents[3]) {
            return undefined;
        }
        return totalExtents;
    };

    //
    // clear
    //
    PhysicsManager.prototype.clear = function () {
        if (this.physicsNodes) {
            for (var index = 0; index < this.physicsNodes.length; index += 1) {
                this.unsubscribeSceneNode(this.physicsNodes[index].target);
            }
        }
        this.physicsNodes = [];
        this.dynamicPhysicsNodes = [];
        this.kinematicPhysicsNodes = [];
    };

    //
    // loadNodes
    //
    PhysicsManager.prototype.loadNodes = function (loadParams, scene) {
        var sceneData = loadParams.data;
        var collisionMargin = (loadParams.collisionMargin || 0.005);
        var nodesNamePrefix = loadParams.nodesNamePrefix;

        if (!loadParams.append) {
            this.clear();
        }

        if (!this.physicsDevice) {
            return;
        }
        var physicsDevice = this.physicsDevice;
        var dynamicsWorld = this.dynamicsWorld;
        var dynamicFilterFlag = physicsDevice.FILTER_DYNAMIC;
        var kinematicFilterFlag = physicsDevice.FILTER_KINEMATIC;
        var staticFilterFlag = physicsDevice.FILTER_STATIC;
        var characterFilterFlag = physicsDevice.FILTER_CHARACTER;
        var projectileFilterFlag = physicsDevice.FILTER_PROJECTILE;
        var allFilterFlag = physicsDevice.FILTER_ALL;

        var mathsDevice = this.mathsDevice;
        var physicsNodes = this.physicsNodes;
        var dynamicPhysicsNodes = this.dynamicPhysicsNodes;
        var kinematicPhysicsNodes = this.kinematicPhysicsNodes;
        var fileShapes = sceneData.geometries;
        var fileNodes = sceneData.physicsnodes;
        var fileModels = sceneData.physicsmodels;
        var fileMaterials = sceneData.physicsmaterials;
        var shape, origin, triangleArray;
        for (var fn in fileNodes) {
            if (fileNodes.hasOwnProperty(fn)) {
                var fileNode = fileNodes[fn];
                var targetName = fileNode.target;
                if (nodesNamePrefix) {
                    targetName = SceneNode.makePath(nodesNamePrefix, targetName);
                }
                var target = scene.findNode(targetName);
                if (!target) {
                    continue;
                }
                var fileModel = fileModels[fileNode.body];
                if (!fileModel) {
                    continue;
                }
                var physicsMaterial;
                if (fileMaterials) {
                    physicsMaterial = fileMaterials[fileModel.material];
                }
                if (physicsMaterial && (physicsMaterial.nonsolid || physicsMaterial.far)) {
                    continue;
                }
                var kinematic = (fileModel.kinematic || target.kinematic);
                var dynamic = (fileModel.dynamic || target.dynamic);
                var disabled = target.disabled;
                shape = null;
                origin = null;
                triangleArray = null;
                var shapeType = fileModel.shape;
                if (shapeType === "box") {
                    var halfExtents = fileModel.halfExtents || fileModel.halfextents;
                    shape = physicsDevice.createBoxShape({
                        halfExtents: halfExtents,
                        margin: collisionMargin
                    });
                } else if (shapeType === "sphere") {
                    shape = physicsDevice.createSphereShape({
                        radius: fileModel.radius,
                        margin: collisionMargin
                    });
                } else if (shapeType === "cone") {
                    shape = physicsDevice.createConeShape({
                        radius: fileModel.radius,
                        height: fileModel.height,
                        margin: collisionMargin
                    });
                } else if (shapeType === "capsule") {
                    shape = physicsDevice.createCapsuleShape({
                        radius: fileModel.radius,
                        height: fileModel.height,
                        margin: collisionMargin
                    });
                } else if (shapeType === "cylinder") {
                    shape = physicsDevice.createCylinderShape({
                        halfExtents: [fileModel.radius, fileModel.height, fileModel.radius],
                        margin: collisionMargin
                    });
                } else if (shapeType === "convexhull" || shapeType === "mesh") {
                    var geometry = fileShapes[fileModel.geometry];
                    if (geometry) {
                        shape = geometry.physicsShape;
                        if (shape) {
                            origin = geometry.origin;
                        } else {
                            var inputs = geometry.inputs;
                            var inputPosition = inputs.POSITION;
                            var positions = geometry.sources[inputPosition.source];
                            var positionsData = positions.data;
                            var numPositionsValues = positionsData.length;
                            var posMin = positions.min;
                            var posMax = positions.max;
                            var np, pos0, pos1, pos2;
                            var min0, min1, min2, max0, max1, max2;
                            if (posMin && posMax) {
                                var centerPos0 = ((posMax[0] + posMin[0]) * 0.5);
                                var centerPos1 = ((posMax[1] + posMin[1]) * 0.5);
                                var centerPos2 = ((posMax[2] + posMin[2]) * 0.5);
                                if (Math.abs(centerPos0) > 1.e-6 || Math.abs(centerPos1) > 1.e-6 || Math.abs(centerPos2) > 1.e-6) {
                                    var halfPos0 = ((posMax[0] - posMin[0]) * 0.5);
                                    var halfPos1 = ((posMax[1] - posMin[1]) * 0.5);
                                    var halfPos2 = ((posMax[2] - posMin[2]) * 0.5);
                                    min0 = -halfPos0;
                                    min1 = -halfPos1;
                                    min2 = -halfPos2;
                                    max0 = halfPos0;
                                    max1 = halfPos1;
                                    max2 = halfPos2;
                                    var newPositionsData = [];
                                    newPositionsData.length = numPositionsValues;
                                    for (np = 0; np < numPositionsValues; np += 3) {
                                        pos0 = (positionsData[np + 0] - centerPos0);
                                        pos1 = (positionsData[np + 1] - centerPos1);
                                        pos2 = (positionsData[np + 2] - centerPos2);
                                        if (min0 > pos0) {
                                            min0 = pos0;
                                        } else if (max0 < pos0) {
                                            max0 = pos0;
                                        }
                                        if (min1 > pos1) {
                                            min1 = pos1;
                                        } else if (max1 < pos1) {
                                            max1 = pos1;
                                        }
                                        if (min2 > pos2) {
                                            min2 = pos2;
                                        } else if (max2 < pos2) {
                                            max2 = pos2;
                                        }
                                        newPositionsData[np + 0] = pos0;
                                        newPositionsData[np + 1] = pos1;
                                        newPositionsData[np + 2] = pos2;
                                    }
                                    positionsData = newPositionsData;
                                    posMin = [min0, min1, min2];
                                    posMax = [max0, max1, max2];
                                    origin = mathsDevice.v3Build(centerPos0, centerPos1, centerPos2);
                                    geometry.origin = origin;
                                }
                            } else {
                                //TODO: add a warning that with no extents we can't calculate and origin?
                                geometry.origin = [0, 0, 0];
                            }

                            if (positionsData.length === 24) {
                                min0 = posMin[0];
                                min1 = posMin[1];
                                min2 = posMin[2];
                                max0 = posMax[0];
                                max1 = posMax[1];
                                max2 = posMax[2];

                                for (np = 0; np < 24; np += 3) {
                                    pos0 = positionsData[np + 0];
                                    pos1 = positionsData[np + 1];
                                    pos2 = positionsData[np + 2];
                                    if ((pos0 !== min0 && pos0 !== max0) || (pos1 !== min1 && pos1 !== max1) || (pos2 !== min2 && pos2 !== max2)) {
                                        break;
                                    }
                                }

                                if (np >= numPositionsValues) {
                                    shapeType = "box";

                                    shape = physicsDevice.createBoxShape({
                                        halfExtents: [
                                            (max0 - min0) * 0.5,
                                            (max1 - min1) * 0.5,
                                            (max2 - min2) * 0.5
                                        ],
                                        margin: collisionMargin
                                    });
                                }
                            }

                            if (shapeType === "convexhull") {
                                shape = physicsDevice.createConvexHullShape({
                                    points: positionsData,
                                    margin: collisionMargin
                                });
                            } else if (shapeType === "mesh") {
                                var maxOffset = 0;
                                for (var input in inputs) {
                                    if (inputs.hasOwnProperty(input)) {
                                        var fileInput = inputs[input];
                                        var offset = fileInput.offset;
                                        if (offset > maxOffset) {
                                            maxOffset = offset;
                                        }
                                    }
                                }

                                var indices = [];
                                var surfaces = geometry.surfaces;
                                if (!surfaces) {
                                    surfaces = { s: { triangles: geometry.triangles } };
                                }
                                for (var surf in surfaces) {
                                    if (surfaces.hasOwnProperty(surf)) {
                                        var surface = surfaces[surf];

                                        if (maxOffset > 0) {
                                            var triangles = surface.triangles;
                                            if (triangles) {
                                                var indicesPerVertex = (maxOffset + 1);
                                                var numIndices = triangles.length;
                                                var positionsOffset = inputPosition.offset;
                                                for (var v = 0; v < numIndices; v += indicesPerVertex) {
                                                    indices.push(triangles[v + positionsOffset]);
                                                }
                                            }
                                        } else {
                                            var surfIndices = surface.triangles;
                                            if (surfIndices) {
                                                if (indices.length === 0) {
                                                    indices = surfIndices;
                                                } else {
                                                    var numSurfIndices = surfIndices.length;
                                                    for (var i = 0; i < numSurfIndices; i += 1) {
                                                        indices.push(surfIndices[i]);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (indices) {
                                    var triangleArrayParams = {
                                        vertices: positionsData,
                                        indices: indices,
                                        minExtent: posMin,
                                        maxExtent: posMax
                                    };
                                    triangleArray = physicsDevice.createTriangleArray(triangleArrayParams);
                                    if (triangleArray) {
                                        shape = physicsDevice.createTriangleMeshShape({
                                            triangleArray: triangleArray,
                                            margin: collisionMargin
                                        });
                                    }
                                }
                            }
                            geometry.physicsShape = shape;
                        }
                    }
                }

                if (shape) {
                    var transform = target.getWorldTransform();
                    if (origin) {
                        transform = mathsDevice.m43Offset(transform, origin);
                    }

                    // TODO: Declare this as a Physics*Parameters so
                    // we only have to initialize the required entries
                    // at this stage.
                    var params = {
                        shape: shape,
                        transform: transform,
                        friction: undefined,
                        restitution: undefined,
                        group: undefined,
                        mask: undefined,
                        kinematic: undefined,
                        mass: undefined,
                        inertia: undefined,
                        frozen: undefined,
                        linearVelocity: undefined,
                        angularVelocity: undefined
                    };

                    if (physicsMaterial) {
                        if (physicsMaterial.dynamic_friction) {
                            params.friction = physicsMaterial.dynamic_friction;
                        }
                        if (physicsMaterial.restitution) {
                            params.restitution = physicsMaterial.restitution;
                        }
                    }

                    // Check for filters to specify which groups will collide against these objects
                    var collisionFilters = allFilterFlag;
                    if (physicsMaterial) {
                        var materialFilter = physicsMaterial.collisionFilter;
                        if (materialFilter) {
                            collisionFilters = 0;
                            var numFilters = materialFilter.length;
                            for (var f = 0; f < numFilters; f += 1) {
                                var filter = materialFilter[f];
                                if (filter === "ALL") {
                                    collisionFilters += allFilterFlag;
                                } else if (filter === "DYNAMIC") {
                                    collisionFilters += dynamicFilterFlag;
                                } else if (filter === "CHARACTER") {
                                    collisionFilters += characterFilterFlag;
                                } else if (filter === "PROJECTILE") {
                                    collisionFilters += projectileFilterFlag;
                                } else if (filter === "STATIC") {
                                    collisionFilters += staticFilterFlag;
                                } else if (filter === "KINEMATIC") {
                                    collisionFilters += kinematicFilterFlag;
                                }
                            }
                        }
                    }

                    var physicsObject;
                    if (kinematic) {
                        params.group = kinematicFilterFlag;
                        params.mask = collisionFilters;
                        params.kinematic = true;
                        physicsObject = physicsDevice.createCollisionObject(params);
                        if (physicsObject && !disabled) {
                            dynamicsWorld.addCollisionObject(physicsObject);
                        }
                    } else if (dynamic) {
                        params.mass = (fileModel.mass || 1);
                        params.inertia = fileModel.inertia;
                        params.group = dynamicFilterFlag;
                        params.mask = collisionFilters;
                        params.frozen = false;
                        if (fileModel.velocity) {
                            params.linearVelocity = fileModel.velocity;
                        }
                        if (fileModel.angularvelocity) {
                            params.angularVelocity = fileModel.angularvelocity;
                        }
                        physicsObject = physicsDevice.createRigidBody(params);
                        if (physicsObject && !disabled) {
                            dynamicsWorld.addRigidBody(physicsObject);
                        }
                    } else {
                        params.group = staticFilterFlag;
                        params.mask = collisionFilters;
                        physicsObject = physicsDevice.createCollisionObject(params);
                        if (physicsObject && !disabled) {
                            dynamicsWorld.addCollisionObject(physicsObject);
                        }
                    }

                    if (physicsObject) {
                        var physicsNode = {
                            body: physicsObject,
                            target: target
                        };

                        // Make the physics object point back at the target node so we can get to it
                        // from collision tests
                        physicsObject.userData = target;

                        if (origin) {
                            physicsNode.origin = origin;
                        }

                        if (triangleArray) {
                            physicsNode.triangleArray = triangleArray;
                        }

                        if (kinematic) {
                            physicsNode.kinematic = true;
                            target.kinematic = true;
                            target.dynamic = true;
                            kinematicPhysicsNodes.push(physicsNode);
                        } else if (dynamic) {
                            physicsNode.dynamic = true;
                            target.dynamic = true;
                            dynamicPhysicsNodes.push(physicsNode);
                        }

                        physicsNodes.push(physicsNode);

                        var targetPhysicsNodes = target.physicsNodes;
                        if (targetPhysicsNodes) {
                            targetPhysicsNodes.push(physicsNode);
                        } else {
                            target.physicsNodes = [physicsNode];
                            this.subscribeSceneNode(target);
                        }
                    }
                }
            }
        }
    };

    //
    // unsubscribeSceneNode
    //
    PhysicsManager.prototype.unsubscribeSceneNode = function (sceneNode) {
        sceneNode.unsubscribeCloned(this.sceneNodeCloned);
        sceneNode.unsubscribeDestroyed(this.sceneNodeDestroyed);
    };

    //
    // subscribeSceneNode
    //
    PhysicsManager.prototype.subscribeSceneNode = function (sceneNode) {
        sceneNode.subscribeCloned(this.sceneNodeCloned);
        sceneNode.subscribeDestroyed(this.sceneNodeDestroyed);
    };

    //
    // cloneSceneNode
    //
    PhysicsManager.prototype.cloneSceneNode = function (oldSceneNode, newSceneNode) {
        var physicsManager = this;

        var physicsManagerCloneNode = function physicsManagerCloneNodeFn(physicsNode, targetSceneNode) {
            var newPhysicsObject = physicsNode.body.clone();

            var newPhysicsNode = {
                body: newPhysicsObject,
                target: targetSceneNode
            };

            // Make the physics object point back at the target node so we can get to it
            // from collision tests
            newPhysicsObject.userData = targetSceneNode;

            if (physicsNode.origin) {
                newPhysicsNode.origin = physicsNode.origin;
            }

            if (physicsNode.triangleArray) {
                newPhysicsNode.triangleArray = physicsNode.triangleArray;
            }

            if (physicsNode.kinematic) {
                newPhysicsNode.kinematic = true;
                targetSceneNode.kinematic = true;
                targetSceneNode.dynamic = true;
                physicsManager.kinematicPhysicsNodes.push(newPhysicsNode);
                newPhysicsNode.body.transform = targetSceneNode.getWorldTransform();
            } else if (physicsNode.dynamic) {
                newPhysicsNode.dynamic = true;
                targetSceneNode.dynamic = true;
                physicsManager.dynamicPhysicsNodes.push(newPhysicsNode);
                newPhysicsNode.body.transform = targetSceneNode.getWorldTransform();
            }

            physicsManager.physicsNodes.push(newPhysicsNode);

            var targetPhysicsNodes = targetSceneNode.physicsNodes;
            if (targetPhysicsNodes) {
                targetPhysicsNodes.push(newPhysicsNode);
            } else {
                targetSceneNode.physicsNodes = [newPhysicsNode];
                this.subscribeSceneNode(targetSceneNode);
            }
        };

        var physicsNodes = oldSceneNode.physicsNodes;
        if (physicsNodes) {
            var numPhysicsNodes = physicsNodes.length;
            newSceneNode.physicsNodes = [];
            for (var p = 0; p < numPhysicsNodes; p += 1) {
                physicsManagerCloneNode(physicsNodes[p], newSceneNode);
            }
        }
    };

    //
    // Snapshot
    //
    PhysicsManager.prototype.createSnapshot = function () {
        var snapshot = {};

        // We only snapshot dynamic nodes because kinematics are driven externally
        var physicsNodes = this.dynamicPhysicsNodes;
        var numPhysicsNodes = physicsNodes.length;
        if (numPhysicsNodes > 0) {
            var physicsNode, n, body;
            for (n = 0; n < numPhysicsNodes; n += 1) {
                physicsNode = physicsNodes[n];
                body = physicsNode.body;
                snapshot[physicsNode.target.name] = {
                    active: body.active,
                    transform: body.transform,
                    linearVelocity: body.linearVelocity,
                    angularVelocity: body.angularVelocity
                };
            }
        }

        return snapshot;
    };

    PhysicsManager.prototype.restoreSnapshot = function (snapshot) {
        var physicsNodes = this.dynamicPhysicsNodes;
        var numPhysicsNodes = physicsNodes.length;
        if (numPhysicsNodes > 0) {
            var physicsNode, n, body, state;
            for (n = 0; n < numPhysicsNodes; n += 1) {
                physicsNode = physicsNodes[n];
                body = physicsNode.body;
                state = snapshot[physicsNode.target.name];
                if (state) {
                    body.transform = state.transform;
                    body.linearVelocity = state.linearVelocity;
                    body.angularVelocity = state.angularVelocity;
                    body.active = state.active;
                }
            }
        }
    };

    PhysicsManager.create = //
    // Constructor function
    //
    function (mathsDevice, physicsDevice, dynamicsWorld) {
        var physicsManager = new PhysicsManager();

        physicsManager.mathsDevice = mathsDevice;
        physicsManager.physicsDevice = physicsDevice;
        physicsManager.dynamicsWorld = dynamicsWorld;
        physicsManager.clear();

        physicsManager.sceneNodeCloned = function sceneNodeClonedFn(data) {
            physicsManager.cloneSceneNode(data.oldNode, data.newNode);
        };

        physicsManager.sceneNodeDestroyed = function sceneNodeDestroyedFn(data) {
            physicsManager.deleteNode(data.node);
        };

        physicsManager.tempMatrix = mathsDevice.m43BuildIdentity();

        return physicsManager;
    };
    PhysicsManager.version = 1;
    return PhysicsManager;
})();

PhysicsManager.prototype.arrayConstructor = Array;

// Detect correct typed arrays
((function () {
    if (typeof Float32Array !== "undefined") {
        var testArray = new Float32Array(4);
        var textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Float32Array]') {
            PhysicsManager.prototype.arrayConstructor = Float32Array;
        }
    }
})());
// Copyright (c) 2009-2011 Turbulenz Limited
//
// PostEffects
//
var PostEffects = (function () {
    function PostEffects() {
    }
    PostEffects.prototype.updateShader = function (sm) {
        var shader = sm.get("shaders/posteffects.cgfx");
        if (shader !== this.shader) {
            this.shader = shader;
            this.bicolor.technique = shader.getTechnique("bicolor");
            this.copy.technique = shader.getTechnique("copy");
            this.copyFiltered.technique = shader.getTechnique("copyFiltered");
            this.fadein.technique = shader.getTechnique("fadein");
            this.modulate.technique = shader.getTechnique("modulate");
            this.blend.technique = shader.getTechnique("blend");
        }
    };

    PostEffects.prototype.getEffectSetupCB = function (name) {
        var effect = this[name];
        if (effect) {
            if (!effect.callback) {
                effect.callback = function postFXSetupFn(gd, colorTexture) {
                    gd.setTechnique(effect.technique);
                    effect.techniqueParameters[effect.textureName] = colorTexture;
                    gd.setTechniqueParameters(effect.techniqueParameters);
                };
            }
            return effect.callback;
        } else {
            return undefined;
        }
    };

    PostEffects.prototype.destroy = function () {
        for (var p in this) {
            if (this.hasOwnProperty(p)) {
                delete this[p];
            }
        }
    };

    PostEffects.create = // Constructor function
    function (gd, sm) {
        var pe = new PostEffects();

        sm.load("shaders/posteffects.cgfx");

        pe.bicolor = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                color0: [0, 0, 0],
                color1: [1, 1, 1],
                colorTexture: null
            }),
            callback: null,
            textureName: 'colorTexture'
        };

        pe.copy = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                colorTexture: null
            }),
            callback: null,
            textureName: 'colorTexture'
        };

        pe.copyFiltered = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                colorTextureFiltered: null
            }),
            callback: null,
            textureName: 'colorTextureFiltered'
        };

        pe.fadein = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                fadeColor: [0, 0, 0, 0],
                colorTexture: null
            }),
            callback: null,
            textureName: 'colorTexture'
        };

        pe.modulate = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                modulateColor: [1, 1, 1, 1],
                colorTexture: null
            }),
            callback: null,
            textureName: 'colorTexture'
        };

        pe.blend = {
            technique: null,
            techniqueParameters: gd.createTechniqueParameters({
                alpha: 0.5,
                colorTexture: null
            }),
            callback: null,
            textureName: 'colorTexture'
        };

        return pe;
    };
    PostEffects.version = 1;
    return PostEffects;
})();
// Copyright (c) 2010-2011 Turbulenz Limited
/*exported renderingCommonSortKeyFn*/
/*exported renderingCommonCreateRendererInfoFn*/
/*exported renderingCommonAddDrawParameterFastestFn*/
//
// renderingCommonGetTechniqueIndexFn
//
var renderingCommonGetTechniqueIndexFn = function renderingCommonGetTechniqueIndexFnFn(techniqueName) {
    var dataStore = renderingCommonGetTechniqueIndexFn;
    var techniqueIndex = dataStore.techniquesIndexMap[techniqueName];
    if (techniqueIndex === undefined) {
        techniqueIndex = dataStore.numTechniques;
        dataStore.techniquesIndexMap[techniqueName] = techniqueIndex;
        dataStore.numTechniques += 1;
    }
    return techniqueIndex;
};

renderingCommonGetTechniqueIndexFn.techniquesIndexMap = {};
renderingCommonGetTechniqueIndexFn.numTechniques = 0;

//
// renderingCommonSortKeyFn
//
function renderingCommonSortKeyFn(techniqueIndex, materialIndex, nodeIndex) {
    var sortKey = ((techniqueIndex * 0x10000) + (materialIndex % 0x10000));
    if (nodeIndex) {
        sortKey += (1.0 / (1.0 + nodeIndex));
    }
    return sortKey;
}

//
// renderingCommonCreateRendererInfoFn
//
function renderingCommonCreateRendererInfoFn(renderable) {
    var rendererInfo = {
        far: renderable.sharedMaterial.meta.far
    };
    renderable.rendererInfo = rendererInfo;

    var effect = renderable.sharedMaterial.effect;
    if (effect.prepare) {
        effect.prepare(renderable);
    }

    return rendererInfo;
}

//
// renderingCommonAddDrawParameterFastestFn
//
var renderingCommonAddDrawParameterFastestFn = function renderingCommonAddDrawParameterFastestFnFn(drawParameters) {
    var array = this.array;
    array[array.length] = drawParameters;
};
// Copyright (c) 2010-2012 Turbulenz Limited
/*global TurbulenzEngine:false*/
/*global VMath:false*/
;

;

;

//
// ResourceLoader
//
var ResourceLoader = (function () {
    function ResourceLoader() {
    }
    //
    // clear
    //
    ResourceLoader.prototype.clear = function () {
        this.nodesMap = {};
        this.referencesPending = {};
        this.numReferencesPending = 0;
        this.animationsPending = {};
    };

    //
    // endLoading
    //
    ResourceLoader.prototype.endLoading = function (onload) {
        this.referencesPending = {};
        this.animationsPending = {};

        if (onload) {
            onload(this.data);
        }
    };

    ResourceLoader.prototype.resolveShapes = function (loadParams) {
        var copyObject = function copyObjectFn(o) {
            var newObj = {};
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    newObj[p] = o[p];
                }
            }
            return newObj;
        };

        var shapesNamePrefix = loadParams.shapesNamePrefix;

        // we reuse shapesNamePrefix to save adding prefixes for everything
        var skeletonNamePrefix = loadParams.shapesNamePrefix;
        var sceneData = loadParams.data;
        var fileShapes = sceneData.geometries;
        var targetShapes = this.data.geometries;
        if (!targetShapes) {
            targetShapes = {};
            this.data.geometries = targetShapes;
        }

        for (var fileShapeName in fileShapes) {
            if (fileShapes.hasOwnProperty(fileShapeName)) {
                var fileShape = fileShapes[fileShapeName];
                var targetShapeName = (shapesNamePrefix ? (shapesNamePrefix + "-" + fileShapeName) : fileShapeName);

                // Update the skeleton reference
                var fileSkeletonName = fileShape.skeleton;
                if (fileSkeletonName) {
                    // the shape has to be copied if it has a skeleton as the same shape
                    // can be used with multiple skeletons
                    targetShapes[targetShapeName] = copyObject(fileShape);
                    targetShapes[targetShapeName].skeleton = (skeletonNamePrefix ? (skeletonNamePrefix + "-" + fileSkeletonName) : fileSkeletonName);
                } else {
                    targetShapes[targetShapeName] = fileShape;
                }
            }
        }
    };

    ResourceLoader.prototype.resolveSkeletons = function (loadParams) {
        // we reuse shapesNamePrefix to save adding prefixes for everything
        var skeletonNamePrefix = loadParams.shapesNamePrefix;
        var sceneData = loadParams.data;
        var fileSkeletons = sceneData.skeletons;
        var targetSkeletons = this.data.skeletons;
        if (!targetSkeletons) {
            targetSkeletons = {};
            this.data.skeletons = targetSkeletons;
        }

        for (var fileSkeletonName in fileSkeletons) {
            if (fileSkeletons.hasOwnProperty(fileSkeletonName)) {
                var fileSkeleton = fileSkeletons[fileSkeletonName];
                var targetSkeletonName = (skeletonNamePrefix ? (skeletonNamePrefix + "-" + fileSkeletonName) : fileSkeletonName);
                targetSkeletons[targetSkeletonName] = fileSkeleton;
            }
        }
    };

    //
    // Resolve animations
    //
    ResourceLoader.prototype.resolveAnimations = function (loadParams) {
        var sceneData = loadParams.data;

        var fileAnims = sceneData.animations;
        if (!fileAnims) {
            return;
        }

        var currentLoader = this;
        var anims = currentLoader.data.animations;
        if (!anims) {
            anims = {};
            currentLoader.data.animations = anims;
        }

        var postLoadReference = function postLoadReferenceFn(sceneText) {
            if (sceneText) {
                var sceneData = JSON.parse(sceneText);
                var animations = sceneData.animations;
                for (var anim in animations) {
                    if (animations.hasOwnProperty(anim)) {
                        anims[anim] = animations[anim];
                    }
                }
            }

            //Utilities.log("resolved ref for " + anim + " count now " + (currentLoader.numReferencesPending-1));
            currentLoader.numReferencesPending -= 1;
            if (currentLoader.numReferencesPending <= 0) {
                currentLoader.endLoading(loadParams.onload);
            }
        };

        // Import animations
        var requestOwner = (loadParams.request ? loadParams : TurbulenzEngine);
        for (var a in fileAnims) {
            if (fileAnims.hasOwnProperty(a)) {
                var reference = fileAnims[a].reference;
                if (reference) {
                    if (!this.animationsPending[a]) {
                        this.animationsPending[a] = true;
                        this.numReferencesPending += 1;

                        //Utilities.log("adding ref for " + a + " count now " + this.numReferencesPending);
                        delete fileAnims[a].reference;

                        loadParams.requestHandler.request({
                            src: reference,
                            requestOwner: requestOwner,
                            onload: postLoadReference
                        });
                    }
                } else {
                    anims[a] = fileAnims[a];
                }
            }
        }
    };

    //
    // resolveNodes
    //
    ResourceLoader.prototype.resolveNodes = function (loadParams) {
        var sceneData = loadParams.data;

        var references = this.referencesPending;
        var numReferences = 0;
        var nodesMap = this.nodesMap;

        var currentLoader = this;

        var nodesNamePrefix = loadParams.nodesNamePrefix;
        var shapesNamePrefix = loadParams.shapesNamePrefix;

        var requestOwner = (loadParams.request ? loadParams : TurbulenzEngine);

        var copyObject = function copyObjectFn(o) {
            var newObj = {};
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    newObj[p] = o[p];
                }
            }
            return newObj;
        };

        var resolveNode = function resolveNodeFn(fileNode, nodeName, parentNodePath) {
            // We're changing a node which may be referenced multiple
            // times so take a copy
            var node = (copyObject(fileNode));
            var nodePath = parentNodePath ? (parentNodePath + "/" + nodeName) : nodeName;

            var reference = node.reference;
            if (reference) {
                //Utilities.log("Reference resolve for " + nodePath);
                var internalReferenceIndex = reference.indexOf("#");
                if (internalReferenceIndex === -1) {
                    var referenceParameters = references[reference];
                    if (!referenceParameters || referenceParameters.length === 0 || !node.inplace) {
                        numReferences += 1;

                        //Utilities.log("adding ref for " + nodePath + " numrefs now " + numReferences);
                        var sceneParameters = copyObject(loadParams);
                        sceneParameters.append = true;
                        if (node.inplace) {
                            sceneParameters.nodesNamePrefix = parentNodePath;
                            sceneParameters.shapesNamePrefix = null;
                            sceneParameters.parentNode = null;
                        } else {
                            sceneParameters.nodesNamePrefix = nodePath;
                            sceneParameters.shapesNamePrefix = reference;
                            sceneParameters.parentNode = node;
                        }
                        if (node.skin) {
                            sceneParameters.skin = node.skin;
                        }

                        if (!referenceParameters || referenceParameters.length === 0) {
                            referenceParameters = [sceneParameters];
                            references[reference] = referenceParameters;

                            var loadReference = function (sceneText) {
                                var numInstances = referenceParameters.length;
                                var sceneData;
                                if (sceneText) {
                                    sceneData = JSON.parse(sceneText);
                                } else {
                                    // Make sure we can call scene
                                    // load to correctly deal with
                                    // reference counts when a
                                    // reference is missing
                                    sceneData = {};
                                }
                                var params;
                                for (var n = 0; n < numInstances; n += 1) {
                                    params = referenceParameters[n];
                                    params.data = sceneData;
                                    params.isReference = true;
                                    currentLoader.resolve(params);
                                }
                                referenceParameters.length = 0;
                            };

                            loadParams.requestHandler.request({
                                src: reference,
                                requestOwner: requestOwner,
                                onload: loadReference
                            });
                        } else {
                            referenceParameters.push(sceneParameters);
                        }
                    }
                }
                delete node.reference;
                delete node.inplace;
            }

            var geometryinstances = node.geometryinstances;
            if (shapesNamePrefix && geometryinstances) {
                // Need to deep copy the geometry instances dictionary because we're prefixing the names
                node.geometryinstances = {};
                for (var gi in geometryinstances) {
                    if (geometryinstances.hasOwnProperty(gi)) {
                        node.geometryinstances[gi] = copyObject(geometryinstances[gi]);
                        var geometryInstance = node.geometryinstances[gi];

                        //Utilities.log("prefixing " + geometryInstance.geometry + " with " + shapesNamePrefix);
                        geometryInstance.geometry = shapesNamePrefix + "-" + geometryInstance.geometry;
                    }
                }
            }

            var fileChildren = fileNode.nodes;
            if (fileChildren) {
                node.nodes = {};
                for (var c in fileChildren) {
                    if (fileChildren.hasOwnProperty(c)) {
                        var childPath = nodePath + "/" + c;
                        if (!nodesMap[childPath]) {
                            node.nodes[c] = resolveNode(fileChildren[c], c, nodePath);
                            nodesMap[childPath] = node.nodes[c];
                        }
                    }
                }
            }

            return node;
        };

        var fileNodes = sceneData.nodes;
        var parentNode = loadParams.parentNode;
        for (var fn in fileNodes) {
            if (fileNodes.hasOwnProperty(fn) && fileNodes[fn]) {
                var nodeName = fn;
                var fileNode = resolveNode(fileNodes[fn], nodeName, nodesNamePrefix);
                var nodePath = (nodesNamePrefix ? (nodesNamePrefix + "/" + fn) : fn);
                var overloadedNode = nodesMap[nodePath];

                if (overloadedNode) {
                    //Utilities.log("Overloaded node '" + nodePath + "'");
                    var overloadedMatrix = overloadedNode.matrix;
                    if (overloadedMatrix && fileNode.matrix) {
                        overloadedNode.matrix = VMath.m43Mul(fileNode.matrix, overloadedMatrix);
                        overloadedMatrix = null;
                    }

                    var overloadedChildren = overloadedNode.nodes;
                    if (overloadedChildren && fileNode.nodes) {
                        for (var c in fileNode.nodes) {
                            if (fileNode.nodes.hasOwnProperty(c)) {
                                overloadedChildren[c] = fileNode.nodes[c];
                            }
                        }
                    } else if (fileNode.nodes) {
                        overloadedNode.nodes = fileNode.nodes;
                    }

                    for (var on in fileNode) {
                        if (fileNode.hasOwnProperty(on)) {
                            overloadedNode[on] = fileNode[on];
                        }
                    }
                    fileNode = overloadedNode;
                } else {
                    if (loadParams.isReference && parentNode) {
                        if (!parentNode.nodes) {
                            parentNode.nodes = {};
                        }
                        parentNode.nodes[fn] = fileNode;
                    } else {
                        this.data.nodes[fn] = fileNode;
                    }

                    nodesMap[nodePath] = fileNode;
                }
            }
        }

        this.numReferencesPending += numReferences;
        //Utilities.log("total refs now " + this.numReferencesPending);
    };

    //
    // loadPhysicsNodes
    //
    ResourceLoader.prototype.resolvePhysicsNodes = function (loadParams) {
        var sceneData = loadParams.data;
        var nodesNamePrefix = loadParams.nodesNamePrefix;
        var shapesNamePrefix = loadParams.shapesNamePrefix;

        function begetFn(o) {
            var F = function () {
            };
            F.prototype = o;
            return new F();
        }

        var fileModels = sceneData.physicsmodels;
        var targetFileModels = this.data.physicsmodels;
        if (!targetFileModels) {
            targetFileModels = {};
            this.data.physicsmodels = targetFileModels;
        }

        for (var fm in fileModels) {
            if (fileModels.hasOwnProperty(fm)) {
                var fileModel = fileModels[fm];

                if (shapesNamePrefix) {
                    var newModelName = shapesNamePrefix ? shapesNamePrefix + "-" + fm : fm;

                    var model = begetFn(fileModel);
                    targetFileModels[newModelName] = model;

                    var geometry = model.geometry;
                    if (geometry) {
                        model.geometry = shapesNamePrefix ? shapesNamePrefix + "-" + geometry : geometry;
                    }
                } else {
                    targetFileModels[fm] = fileModel;
                }
            }
        }

        var fileNodes = sceneData.physicsnodes;
        var targetFileNodes = this.data.physicsnodes;
        if (!targetFileNodes) {
            targetFileNodes = {};
            this.data.physicsnodes = targetFileNodes;
        }

        for (var fn in fileNodes) {
            if (fileNodes.hasOwnProperty(fn)) {
                var fileNode = fileNodes[fn];

                if (nodesNamePrefix || shapesNamePrefix) {
                    var targetName = fileNode.target;
                    targetName = nodesNamePrefix ? (nodesNamePrefix + "/" + targetName) : targetName;

                    var node = begetFn(fileNode);
                    node.target = targetName;

                    node.body = shapesNamePrefix ? shapesNamePrefix + "-" + fileNode.body : fileNode.body;

                    var newNodeName = nodesNamePrefix ? (nodesNamePrefix + "/" + fn) : fn;
                    targetFileNodes[newNodeName] = node;
                } else {
                    targetFileNodes[fn] = fileNode;
                }
            }
        }
    };

    //
    // loadAreas
    //
    ResourceLoader.prototype.resolveAreas = function (loadParams) {
        var sceneData = loadParams.data;

        var fileAreas = sceneData.areas;
        if (!fileAreas) {
            return;
        }

        var numFileAreas = fileAreas.length;
        if (numFileAreas <= 0) {
            return;
        }

        var targetAreas = this.data.areas;
        if (!targetAreas) {
            targetAreas = [];
            this.data.areas = targetAreas;
        }

        var nodesNamePrefix = loadParams.nodesNamePrefix;

        for (var fa = 0; fa < numFileAreas; fa += 1) {
            var fileArea = fileAreas[fa];

            if (nodesNamePrefix) {
                var targetName = fileArea.target;
                fileArea.target = (nodesNamePrefix + "/" + targetName);
            }
            targetAreas.push(fileArea);
        }
    };

    //
    // resolve
    //
    ResourceLoader.prototype.resolve = function (loadParams) {
        if (!loadParams.append) {
            this.data = { nodes: {} };
        }

        // Start by simply copying any dictionaries which we don't special case
        var appendData = loadParams.data;
        for (var d in appendData) {
            if (d !== "nodes" && d !== "skeletons" && d !== "geometries" && d !== "animations" && d !== "areas" && d !== "physicsnodes" && d !== "physicsmodels") {
                if (appendData.hasOwnProperty(d)) {
                    var dict = appendData[d];
                    var targetDict = this.data[d];
                    if (!targetDict) {
                        this.data[d] = dict;
                    } else {
                        for (var e in dict) {
                            if (dict.hasOwnProperty(e) && !targetDict[e]) {
                                targetDict[e] = dict[e];
                            }
                        }
                    }
                }
            }
        }

        this.resolveShapes(loadParams);

        this.resolveSkeletons(loadParams);

        this.resolveAnimations(loadParams);

        this.resolveNodes(loadParams);

        this.resolvePhysicsNodes(loadParams);

        this.resolveAreas(loadParams);

        if (loadParams.isReference) {
            this.numReferencesPending -= 1;
            //Utilities.log("loaded ref now " + this.numReferencesPending);
        }

        if (this.numReferencesPending <= 0) {
            this.endLoading(loadParams.onload);
        }
    };

    //
    // load
    //
    ResourceLoader.prototype.load = function (assetPath, loadParams) {
        var loader = this;
        var dataReceived = function dataReceivedFn(text) {
            var sceneData = {};
            if (text) {
                sceneData = JSON.parse(text);
            }

            loadParams.data = sceneData;
            loadParams.append = false;
            loader.resolve(loadParams);
        };

        loadParams.requestHandler.request({
            src: assetPath,
            requestOwner: loadParams.request ? loadParams : TurbulenzEngine,
            onload: dataReceived
        });
    };

    ResourceLoader.create = // Constructor function
    function () {
        var rl = new ResourceLoader();
        rl.clear();

        rl.skeletonNames = {};

        return rl;
    };
    ResourceLoader.version = 1;
    return ResourceLoader;
})();
// Copyright (c) 2009-2013 Turbulenz Limited
/*global AABBTree*/
/*global Material*/
/*global SceneNode*/
/*global Geometry*/
/*global GeometryInstance*/
/*global Light*/
/*global LightInstance*/
/*global Utilities*/
/*global VertexBufferManager*/
/*global IndexBufferManager*/
/*global alert*/
/*global Uint16Array*/
/*global Uint32Array*/
/*global Float32Array*/
;

;

;

;

//
// Scene
//
var Scene = (function () {
    // Scene
    function Scene(mathDevice, staticSpatialMap, dynamicSpatialMap) {
        this.md = mathDevice;
        this.staticSpatialMap = (staticSpatialMap || AABBTree.create(true));
        this.dynamicSpatialMap = (dynamicSpatialMap || AABBTree.create());

        this.clear();

        var scene = this;
        this.onGeometryDestroyed = function sceneOnGeometryDestroyedFn(geometry) {
            geometry.reference.unsubscribeDestroyed(scene.onGeometryDestroyed);
            delete scene.shapes[geometry.name];
        };

        this.onMaterialDestroyed = function sceneOnMaterialDestroyedFn(material) {
            material.reference.unsubscribeDestroyed(scene.onMaterialDestroyed);
            delete scene.materials[material.name];
        };
    }
    //
    // findNode
    //
    Scene.prototype.findNode = function (nodePath) {
        //simple case of root node
        var result = this.rootNodesMap[nodePath];
        if (result) {
            return result;
        }

        //else find node in turn
        var names = nodePath.split("/");
        var rootName = names[0];
        result = this.rootNodesMap[rootName];

        for (var depth = 1; result && depth < names.length; depth += 1) {
            result = result.findChild(names[depth]);
        }
        return result;
    };

    //
    // addRootNode
    //
    Scene.prototype.addRootNode = function (rootNode) {
        // Add the root to the top level nodes list and update the scene hierarchys
        var name = rootNode.name;

        debug.assert(name, "Root nodes must be named");
        debug.assert(!rootNode.scene, "Root node already in a scene");
        debug.assert(!this.rootNodesMap[name], "Root node with the same name exits in the scene");

        rootNode.scene = this;

        // Ensure node will be added to spatial map on update
        // In the event that there are no dirty flags set.
        rootNode.worldExtentsUpdate = true;

        this.rootNodes.push(rootNode);
        this.rootNodesMap[name] = rootNode;
        this.addRootNodeToUpdate(rootNode, name);
    };

    //
    // removeRootNode
    //
    Scene.prototype.removeRootNode = function (rootNode) {
        var name = rootNode.name;

        debug.assert(rootNode.scene === this, "Root node is not in the scene");
        rootNode.removedFromScene(this);

        var rootNodes = this.rootNodes;
        var index = rootNodes.indexOf(rootNode);
        if (index !== -1) {
            var numRootNodes = (rootNodes.length - 1);
            if (index < numRootNodes) {
                rootNodes[index] = rootNodes[numRootNodes];
            }
            rootNodes.length = numRootNodes;
        }
        delete this.rootNodesMap[name];

        if (this.dirtyRoots[name] === rootNode) {
            delete this.dirtyRoots[name];

            // Can not use indexOf because it will search the whole array instead of just the active range
            var nodesToUpdate = this.nodesToUpdate;
            var numNodesToUpdate = this.numNodesToUpdate;
            for (index = 0; index < numNodesToUpdate; index += 1) {
                if (nodesToUpdate[index] === rootNode) {
                    numNodesToUpdate -= 1;
                    if (index < numNodesToUpdate) {
                        nodesToUpdate[index] = nodesToUpdate[numNodesToUpdate];
                    }
                    nodesToUpdate[numNodesToUpdate] = null;
                    this.numNodesToUpdate = numNodesToUpdate;
                    break;
                }
            }
        }

        delete rootNode.scene;
    };

    //
    // addLight
    //
    Scene.prototype.addLight = function (light) {
        this.lights[light.name] = light;

        if (light.isGlobal()) {
            this.globalLights.push(light);
        }
    };

    //
    // removeLight
    //
    Scene.prototype.removeLight = function (light) {
        delete this.lights[light.name];

        if (light.isGlobal()) {
            var globalLights = this.globalLights;
            var numGlobalLights = globalLights.length;
            for (var index = 0; index < numGlobalLights; index += 1) {
                if (light === globalLights[index]) {
                    globalLights.splice(index, 1);
                    break;
                }
            }
        }
    };

    //
    // getLight
    //
    Scene.prototype.getLight = function (name) {
        return this.lights[name];
    };

    //
    // getGlobalLights
    //
    Scene.prototype.getGlobalLights = function () {
        return this.globalLights;
    };

    //
    // calculateNumNodes
    //
    Scene.prototype.calculateNumNodes = function (nodes) {
        var numNodes = nodes.length;
        var numTotalNodes = numNodes;
        for (var n = 0; n < numNodes; n += 1) {
            var children = nodes[n].children;
            if (children) {
                numTotalNodes += this.calculateNumNodes(children);
            }
        }
        return numTotalNodes;
    };

    //
    // buildPortalPlanes
    //
    Scene.prototype.buildPortalPlanes = function (points, planes, cX, cY, cZ, frustumPlanes) {
        var numPoints = points.length;
        var numFrustumPlanes = frustumPlanes.length;
        var numPlanes = 0;
        var n, np, nnp, p, plane, numVisiblePointsPlane;

        var culledByPlane = [];
        culledByPlane.length = numPoints;
        np = 0;
        do {
            culledByPlane[np] = [];
            np += 1;
        } while(np < numPoints);

        n = 0;
        do {
            plane = frustumPlanes[n];
            var pl0 = plane[0];
            var pl1 = plane[1];
            var pl2 = plane[2];
            var pl3 = plane[3];
            numVisiblePointsPlane = 0;

            np = 0;
            do {
                p = points[np];
                if ((pl0 * p[0] + pl1 * p[1] + pl2 * p[2]) >= pl3) {
                    numVisiblePointsPlane += 1;
                } else {
                    culledByPlane[np][n] = true;
                }
                np += 1;
            } while(np < numPoints);

            if (numVisiblePointsPlane === 0) {
                planes.length = 0;
                return false;
            } else if (numVisiblePointsPlane < numPoints) {
                planes[numPlanes] = plane;
                numPlanes += 1;
            }
            n += 1;
        } while(n < numFrustumPlanes);

        var allPointsVisible = (numPlanes === 0);

        var newPoints = [];
        newPoints.length = numPoints;
        np = 0;
        do {
            p = points[np];
            newPoints[np] = [(p[0] - cX), (p[1] - cY), (p[2] - cZ)];
            np += 1;
        } while(np < numPoints);

        var sqrt = Math.sqrt;
        np = 0;
        do {
            nnp = (np + 1);
            if (nnp >= numPoints) {
                nnp = 0;
            }

            // Skip plane if both points were culled by the same frustum plane
            var culled0 = culledByPlane[np];
            var culled1 = culledByPlane[nnp];
            var maxCulled = (culled0.length < culled1.length ? culled0.length : culled1.length);
            for (n = 0; n < maxCulled; n += 1) {
                if (culled0[n] && culled1[n]) {
                    break;
                }
            }
            if (n < maxCulled) {
                np += 1;
                continue;
            }

            p = newPoints[np];
            var p0X = p[0];
            var p0Y = p[1];
            var p0Z = p[2];

            p = newPoints[nnp];
            var p1X = p[0];
            var p1Y = p[1];
            var p1Z = p[2];

            // n = cross(p0, p1)
            var nX = ((p0Y * p1Z) - (p0Z * p1Y));
            var nY = ((p0Z * p1X) - (p0X * p1Z));
            var nZ = ((p0X * p1Y) - (p0Y * p1X));

            // normalize(n)
            var lnsq = ((nX * nX) + (nY * nY) + (nZ * nZ));
            if (lnsq === 0) {
                planes.length = 0;
                return false;
            }
            var lnrcp = 1.0 / sqrt(lnsq);
            nX *= lnrcp;
            nY *= lnrcp;
            nZ *= lnrcp;

            // d = dot(n, c)
            var d = ((nX * cX) + (nY * cY) + (nZ * cZ));

            planes[numPlanes] = [nX, nY, nZ, d];
            numPlanes += 1;

            np += 1;
        } while(np < numPoints);

        return allPointsVisible;
    };

    //
    // findAreaIndex
    //
    Scene.prototype.findAreaIndex = function (bspNodes, cX, cY, cZ) {
        var numNodes = bspNodes.length;
        var nodeIndex = 0;
        var node, plane;
        do {
            node = bspNodes[nodeIndex];
            plane = node.plane;
            nodeIndex = (((plane[0] * cX) + (plane[1] * cY) + (plane[2] * cZ)) < plane[3] ? node.neg : node.pos);
            if (nodeIndex <= 0) {
                return -(nodeIndex + 1);
            }
        } while(nodeIndex < numNodes);
        return -1;
    };

    //
    // findAreaIndicesAABB
    //
    Scene.prototype.findAreaIndicesAABB = function (bspNodes, n0, n1, n2, p0, p1, p2) {
        var numNodes = bspNodes.length;
        var areaIndices = [];
        var visitedArea = [];
        var stack = [0];
        var numNodesStack = 1;
        var nodeIndex, node, plane, areaIndex;
        do {
            numNodesStack -= 1;
            nodeIndex = stack[numNodesStack];
            do {
                node = bspNodes[nodeIndex];
                plane = node.plane;
                var d0 = plane[0];
                var d1 = plane[1];
                var d2 = plane[2];
                var d3 = plane[3];
                if ((d0 * (d0 < 0 ? n0 : p0) + d1 * (d1 < 0 ? n1 : p1) + d2 * (d2 < 0 ? n2 : p2)) < d3) {
                    nodeIndex = node.neg;
                } else {
                    if ((d0 * (d0 > 0 ? n0 : p0) + d1 * (d1 > 0 ? n1 : p1) + d2 * (d2 > 0 ? n2 : p2)) <= d3) {
                        nodeIndex = node.neg;
                        if (nodeIndex <= 0) {
                            if (nodeIndex < 0) {
                                areaIndex = -(nodeIndex + 1);
                                if (!visitedArea[areaIndex]) {
                                    visitedArea[areaIndex] = true;
                                    areaIndices.push(areaIndex);
                                }
                            }
                        } else {
                            stack[numNodesStack] = nodeIndex;
                            numNodesStack += 1;
                        }
                    }
                    nodeIndex = node.pos;
                }
                if (nodeIndex <= 0) {
                    if (nodeIndex < 0) {
                        areaIndex = -(nodeIndex + 1);
                        if (!visitedArea[areaIndex]) {
                            visitedArea[areaIndex] = true;
                            areaIndices.push(areaIndex);
                        }
                    }
                    break;
                }
            } while(nodeIndex < numNodes);
        } while(0 < numNodesStack);
        return areaIndices;
    };

    //
    // findVisiblePortals
    //
    Scene.prototype.findVisiblePortals = function (areaIndex, cX, cY, cZ) {
        var buildPortalPlanes = this.buildPortalPlanes;
        var visiblePortals = this.visiblePortals;
        var oldNumVisiblePortals = visiblePortals.length;
        var frustumPlanes = this.frustumPlanes;
        var numFrustumPlanes = frustumPlanes.length;
        var queryCounter = this.getQueryCounter();
        var areas = this.areas;
        var portals, numPortals, portal, plane, area, n, portalPlanes, portalItem;
        var numVisiblePortals = 0;

        // Cull portals behind camera
        // (do NOT use nearPlane directly because areaIndex is based on the camera position)
        var nearPlane = this.nearPlane;
        var nearPlane0 = nearPlane[0];
        var nearPlane1 = nearPlane[1];
        var nearPlane2 = nearPlane[2];
        frustumPlanes[numFrustumPlanes] = [nearPlane0, nearPlane1, nearPlane2, ((nearPlane0 * cX) + (nearPlane1 * cY) + (nearPlane2 * cZ))];

        area = areas[areaIndex];
        portals = area.portals;
        numPortals = portals.length;
        for (n = 0; n < numPortals; n += 1) {
            portal = portals[n];
            if (portal.disabled) {
                continue;
            }
            portal.queryCounter = queryCounter;
            plane = portal.plane;
            if (((plane[0] * cX) + (plane[1] * cY) + (plane[2] * cZ)) < plane[3]) {
                if (numVisiblePortals < oldNumVisiblePortals) {
                    portalItem = visiblePortals[numVisiblePortals];
                    portalPlanes = portalItem.planes;
                    portalPlanes.length = 0;
                } else {
                    portalPlanes = [];
                }
                buildPortalPlanes(portal.points, portalPlanes, cX, cY, cZ, frustumPlanes);
                if (0 < portalPlanes.length) {
                    if (numVisiblePortals < oldNumVisiblePortals) {
                        portalItem.portal = portal;
                        portalItem.area = portal.area;
                    } else {
                        visiblePortals[numVisiblePortals] = {
                            portal: portal,
                            planes: portalPlanes,
                            area: portal.area
                        };
                    }
                    numVisiblePortals += 1;
                }
            }
        }

        frustumPlanes.length = numFrustumPlanes;

        if (0 < numVisiblePortals) {
            var numPortalPlanes, nextArea, plane0, plane1, plane2, plane3, planes, allPointsVisible;
            var currentPortalIndex = 0;
            do {
                portalItem = visiblePortals[currentPortalIndex];
                currentPortalIndex += 1;
                portalPlanes = portalItem.planes;
                numPortalPlanes = portalPlanes.length;
                portal = portalItem.portal;
                areaIndex = portalItem.area;

                portalPlanes[numPortalPlanes] = portal.plane;

                area = areas[areaIndex];
                portals = area.portals;
                numPortals = portals.length;
                for (n = 0; n < numPortals; n += 1) {
                    portal = portals[n];
                    nextArea = portal.area;
                    if (nextArea !== areaIndex && portal.queryCounter !== queryCounter && !portal.disabled) {
                        plane = portal.plane;
                        plane0 = plane[0];
                        plane1 = plane[1];
                        plane2 = plane[2];
                        plane3 = plane[3];
                        if (((plane0 * cX) + (plane1 * cY) + (plane2 * cZ)) < plane3) {
                            if (numVisiblePortals < oldNumVisiblePortals) {
                                portalItem = visiblePortals[numVisiblePortals];
                                planes = portalItem.planes;
                                planes.length = 0;
                            } else {
                                planes = [];
                            }
                            allPointsVisible = buildPortalPlanes(portal.points, planes, cX, cY, cZ, portalPlanes);
                            if (0 < planes.length) {
                                if (allPointsVisible) {
                                    portal.queryCounter = queryCounter;
                                }
                                if (numVisiblePortals < oldNumVisiblePortals) {
                                    portalItem.portal = portal;
                                    portalItem.area = nextArea;
                                } else {
                                    visiblePortals[numVisiblePortals] = {
                                        portal: portal,
                                        planes: planes,
                                        area: nextArea
                                    };
                                }
                                numVisiblePortals += 1;
                            }
                        } else {
                            portal.queryCounter = queryCounter;
                        }
                    }
                }

                portalPlanes.length = numPortalPlanes;
            } while(currentPortalIndex < numVisiblePortals);
        }

        if (numVisiblePortals < oldNumVisiblePortals) {
            visiblePortals.length = numVisiblePortals;
        }
    };

    //
    // findVisibleNodes
    //
    Scene.prototype.findVisibleNodes = function (camera, visibleNodes) {
        var numVisibleNodes = visibleNodes.length;
        var frustumPlanes = this.frustumPlanes;
        var useSpatialMaps = true;
        var areas = this.areas;
        if (areas) {
            var cameraMatrix = camera.matrix;
            var cX = cameraMatrix[9];
            var cY = cameraMatrix[10];
            var cZ = cameraMatrix[11];

            var areaIndex = this.findAreaIndex(this.bspNodes, cX, cY, cZ);
            this.cameraAreaIndex = areaIndex;

            if (areaIndex >= 0) {
                camera.getFrustumExtents(this.cameraExtents);
                var cameraMinExtent0 = this.cameraExtents[0];
                var cameraMinExtent1 = this.cameraExtents[1];
                var cameraMinExtent2 = this.cameraExtents[2];
                var cameraMaxExtent0 = this.cameraExtents[3];
                var cameraMaxExtent1 = this.cameraExtents[4];
                var cameraMaxExtent2 = this.cameraExtents[5];

                this.findVisiblePortals(areaIndex, cX, cY, cZ);

                var area, na, nodes, numNodes;
                var numAreas = areas.length;
                for (na = 0; na < numAreas; na += 1) {
                    area = areas[na];
                    nodes = area.nodes;
                    numNodes = area.numStaticNodes;
                    if (nodes.length > numNodes) {
                        nodes.length = numNodes;
                    }
                    area.addedDynamicNodes = false;
                }

                var isInsidePlanesAABB = this.isInsidePlanesAABB;
                var dynamicSpatialMap = this.dynamicSpatialMap;
                var visiblePortals = this.visiblePortals;
                var numVisiblePortals = visiblePortals.length;
                var queryCounter = this.getQueryCounter();
                var n, node, np, portalItem, portalPlanes;

                area = areas[areaIndex];
                nodes = area.nodes;
                area.addedDynamicNodes = true;

                var areaExtent = area.extents;
                var areaMinExtent0 = areaExtent[0];
                var areaMinExtent1 = areaExtent[1];
                var areaMinExtent2 = areaExtent[2];
                var areaMaxExtent0 = areaExtent[3];
                var areaMaxExtent1 = areaExtent[4];
                var areaMaxExtent2 = areaExtent[5];
                var combinedExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(6) : new Array(6));
                combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
                combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
                combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
                combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
                combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
                combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);

                dynamicSpatialMap.getOverlappingNodes(combinedExtents, nodes);

                numNodes = nodes.length;
                for (n = 0; n < numNodes; n += 1) {
                    node = nodes[n];
                    node.queryCounter = queryCounter;
                    if (isInsidePlanesAABB(node.worldExtents, frustumPlanes)) {
                        visibleNodes[numVisibleNodes] = node;
                        numVisibleNodes += 1;
                    }
                }

                for (np = 0; np < numVisiblePortals; np += 1) {
                    portalItem = visiblePortals[np];
                    portalPlanes = portalItem.planes;
                    area = areas[portalItem.area];
                    nodes = area.nodes;

                    if (!area.addedDynamicNodes) {
                        area.addedDynamicNodes = true;
                        areaExtent = area.extents;
                        areaMinExtent0 = areaExtent[0];
                        areaMinExtent1 = areaExtent[1];
                        areaMinExtent2 = areaExtent[2];
                        areaMaxExtent0 = areaExtent[3];
                        areaMaxExtent1 = areaExtent[4];
                        areaMaxExtent2 = areaExtent[5];
                        combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
                        combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
                        combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
                        combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
                        combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
                        combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);
                        dynamicSpatialMap.getOverlappingNodes(combinedExtents, nodes);
                    }

                    numNodes = nodes.length;
                    for (n = 0; n < numNodes; n += 1) {
                        node = nodes[n];
                        if (node.queryCounter !== queryCounter) {
                            if (isInsidePlanesAABB(node.worldExtents, portalPlanes)) {
                                node.queryCounter = queryCounter;
                                visibleNodes[numVisibleNodes] = node;
                                numVisibleNodes += 1;
                            }
                        }
                    }
                }

                useSpatialMaps = false;
            }
        }

        if (useSpatialMaps) {
            numVisibleNodes += this.staticSpatialMap.getVisibleNodes(frustumPlanes, visibleNodes, numVisibleNodes);
            this.dynamicSpatialMap.getVisibleNodes(frustumPlanes, visibleNodes, numVisibleNodes);
        }
    };

    //
    // findVisibleNodesTree
    //
    Scene.prototype.findVisibleNodesTree = function (tree, camera, visibleNodes) {
        var numVisibleNodes = visibleNodes.length;
        var frustumPlanes = this.frustumPlanes;
        var useSpatialMap = true;
        var areas = this.areas;
        if (areas) {
            // Assume scene.update has been called before this function
            var areaIndex = this.cameraAreaIndex;
            if (areaIndex >= 0) {
                //this.findVisiblePortals(areaIndex, cX, cY, cZ);
                //camera.getFrustumExtents(this.cameraExtents);
                var cameraMinExtent0 = this.cameraExtents[0];
                var cameraMinExtent1 = this.cameraExtents[1];
                var cameraMinExtent2 = this.cameraExtents[2];
                var cameraMaxExtent0 = this.cameraExtents[3];
                var cameraMaxExtent1 = this.cameraExtents[4];
                var cameraMaxExtent2 = this.cameraExtents[5];

                var externalNodesStack = this.externalNodesStack;

                var areaExtent;
                var areaMinExtent0, areaMinExtent1, areaMinExtent2;
                var areaMaxExtent0, areaMaxExtent1, areaMaxExtent2;
                var combinedExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(6) : new Array(6));

                var area, na, nodes, numNodes;
                var numAreas = areas.length;
                for (na = 0; na < numAreas; na += 1) {
                    area = areas[na];
                    nodes = area.externalNodes;
                    if (nodes) {
                        nodes.length = 0;
                        externalNodesStack.push(nodes);
                        area.externalNodes = null;
                    }
                }

                var isInsidePlanesAABB = this.isInsidePlanesAABB;
                var findOverlappingAreas = this.findOverlappingAreas;
                var findAreaIndex = this.findAreaIndex;
                var visiblePortals = this.visiblePortals;
                var numVisiblePortals = visiblePortals.length;
                var queryCounter = this.getQueryCounter();
                var bspNodes = this.bspNodes;
                var portalPlanes;
                var n, node, nodeExtents, np, portalItem;
                var cX, cY, cZ, nodeAreaIndex, overlappingAreas, numOverlappingAreas;

                area = areas[areaIndex];
                nodes = area.externalNodes;

                if (!nodes) {
                    if (0 < externalNodesStack.length) {
                        nodes = externalNodesStack.pop();
                    } else {
                        nodes = [];
                    }
                    area.externalNodes = nodes;

                    areaExtent = area.extents;
                    areaMinExtent0 = areaExtent[0];
                    areaMinExtent1 = areaExtent[1];
                    areaMinExtent2 = areaExtent[2];
                    areaMaxExtent0 = areaExtent[3];
                    areaMaxExtent1 = areaExtent[4];
                    areaMaxExtent2 = areaExtent[5];
                    combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
                    combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
                    combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
                    combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
                    combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
                    combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);

                    tree.getOverlappingNodes(combinedExtents, nodes);

                    // Check which ones actually belong to the area
                    numNodes = nodes.length;
                    for (n = 0; n < numNodes; n += 1) {
                        node = nodes[n];
                        nodeExtents = node.worldExtents;
                        cX = (nodeExtents[0] + nodeExtents[3]) * 0.5;
                        cY = (nodeExtents[1] + nodeExtents[4]) * 0.5;
                        cZ = (nodeExtents[2] + nodeExtents[5]) * 0.5;
                        nodeAreaIndex = findAreaIndex(bspNodes, cX, cY, cZ);
                        if (nodeAreaIndex >= 0 && areaIndex !== nodeAreaIndex) {
                            overlappingAreas = findOverlappingAreas.call(this, nodeAreaIndex, nodeExtents, true);
                            numOverlappingAreas = overlappingAreas.length;
                            for (na = 0; na < numOverlappingAreas; na += 1) {
                                if (overlappingAreas[na] === area) {
                                    break;
                                }
                            }
                            if (na >= numOverlappingAreas) {
                                numNodes -= 1;
                                if (n < numNodes) {
                                    nodes[n] = nodes[numNodes];
                                    n -= 1;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                    nodes.length = numNodes;
                }

                numNodes = nodes.length;
                for (n = 0; n < numNodes; n += 1) {
                    node = nodes[n];
                    node.queryCounter = queryCounter;
                    if (isInsidePlanesAABB(node.worldExtents, frustumPlanes)) {
                        visibleNodes[numVisibleNodes] = node;
                        numVisibleNodes += 1;
                    }
                }

                for (np = 0; np < numVisiblePortals; np += 1) {
                    portalItem = visiblePortals[np];
                    portalPlanes = portalItem.planes;
                    areaIndex = portalItem.area;
                    area = areas[areaIndex];
                    nodes = area.externalNodes;

                    if (!nodes) {
                        if (0 < externalNodesStack.length) {
                            nodes = externalNodesStack.pop();
                        } else {
                            nodes = [];
                        }
                        area.externalNodes = nodes;

                        areaExtent = area.extents;
                        areaMinExtent0 = areaExtent[0];
                        areaMinExtent1 = areaExtent[1];
                        areaMinExtent2 = areaExtent[2];
                        areaMaxExtent0 = areaExtent[3];
                        areaMaxExtent1 = areaExtent[4];
                        areaMaxExtent2 = areaExtent[5];
                        combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
                        combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
                        combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
                        combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
                        combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
                        combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);

                        tree.getOverlappingNodes(combinedExtents, nodes);

                        // Check which ones actually belong to the area
                        numNodes = nodes.length;
                        for (n = 0; n < numNodes; n += 1) {
                            node = nodes[n];
                            nodeExtents = node.worldExtents;
                            cX = (nodeExtents[0] + nodeExtents[3]) * 0.5;
                            cY = (nodeExtents[1] + nodeExtents[4]) * 0.5;
                            cZ = (nodeExtents[2] + nodeExtents[5]) * 0.5;
                            nodeAreaIndex = findAreaIndex(bspNodes, cX, cY, cZ);
                            if (nodeAreaIndex >= 0 && areaIndex !== nodeAreaIndex) {
                                overlappingAreas = findOverlappingAreas.call(this, nodeAreaIndex, nodeExtents, true);
                                numOverlappingAreas = overlappingAreas.length;
                                for (na = 0; na < numOverlappingAreas; na += 1) {
                                    if (overlappingAreas[na] === area) {
                                        break;
                                    }
                                }
                                if (na >= numOverlappingAreas) {
                                    numNodes -= 1;
                                    if (n < numNodes) {
                                        nodes[n] = nodes[numNodes];
                                        n -= 1;
                                    } else {
                                        break;
                                    }
                                }
                            }
                        }
                        nodes.length = numNodes;
                    }

                    numNodes = nodes.length;
                    for (n = 0; n < numNodes; n += 1) {
                        node = nodes[n];
                        if (node.queryCounter !== queryCounter) {
                            if (isInsidePlanesAABB(node.worldExtents, portalPlanes)) {
                                node.queryCounter = queryCounter;
                                visibleNodes[numVisibleNodes] = node;
                                numVisibleNodes += 1;
                            }
                        }
                    }
                }

                useSpatialMap = false;
            }
        }

        if (useSpatialMap) {
            tree.getVisibleNodes(frustumPlanes, visibleNodes, numVisibleNodes);
        }
    };

    //
    // buildPortalPlanesNoFrustum
    //
    Scene.prototype.buildPortalPlanesNoFrustum = function (points, cX, cY, cZ) {
        var numPoints = points.length;
        var planes = [];
        var numPlanes = 0;
        var newPoints = [];
        var np, p;

        newPoints.length = numPoints;
        np = 0;
        do {
            p = points[np];
            newPoints[np] = [(p[0] - cX), (p[1] - cY), (p[2] - cZ)];
            np += 1;
        } while(np < numPoints);

        var sqrt = Math.sqrt;
        np = 0;
        do {
            p = newPoints[np];
            var p0X = p[0];
            var p0Y = p[1];
            var p0Z = p[2];

            p = newPoints[((np + 1) < numPoints ? (np + 1) : 0)];
            var p1X = p[0];
            var p1Y = p[1];
            var p1Z = p[2];

            // n = cross(p0, p1)
            var nX = ((p0Y * p1Z) - (p0Z * p1Y));
            var nY = ((p0Z * p1X) - (p0X * p1Z));
            var nZ = ((p0X * p1Y) - (p0Y * p1X));
            var lnsq = ((nX * nX) + (nY * nY) + (nZ * nZ));
            if (lnsq === 0) {
                // TODO: Surely this is wrong?
                return false;
            }
            var lnrcp = 1.0 / sqrt(lnsq);
            nX *= lnrcp;
            nY *= lnrcp;
            nZ *= lnrcp;

            // d = dot(n, c)
            var d = ((nX * cX) + (nY * cY) + (nZ * cZ));

            planes[numPlanes] = [nX, nY, nZ, d];
            numPlanes += 1;

            np += 1;
        } while(np < numPoints);

        return planes;
    };

    //
    // findOverlappingPortals
    //
    Scene.prototype.findOverlappingPortals = function (areaIndex, cX, cY, cZ, extents, overlappingPortals) {
        var portals, numPortals, n, portal, plane, d0, d1, d2, offset, area, portalExtents, planes;
        var buildPortalPlanesNoFrustum = this.buildPortalPlanesNoFrustum;
        var queryCounter = this.getQueryCounter();
        var areas = this.areas;
        var numOverlappingPortals = 0;

        var min0 = extents[0];
        var min1 = extents[1];
        var min2 = extents[2];
        var max0 = extents[3];
        var max1 = extents[4];
        var max2 = extents[5];

        area = areas[areaIndex];
        portals = area.portals;
        numPortals = portals.length;
        for (n = 0; n < numPortals; n += 1) {
            portal = portals[n];
            if (portal.disabled) {
                continue;
            }

            portal.queryCounter = queryCounter;

            portalExtents = portal.extents;
            if (portalExtents[0] < max0 && portalExtents[1] < max1 && portalExtents[2] < max2 && portalExtents[3] > min0 && portalExtents[4] > min1 && portalExtents[5] > min2) {
                plane = portal.plane;
                d0 = plane[0];
                d1 = plane[1];
                d2 = plane[2];
                offset = plane[3];
                if (((d0 * cX) + (d1 * cY) + (d2 * cZ)) < offset && (d0 * (d0 < 0 ? min0 : max0) + d1 * (d1 < 0 ? min1 : max1) + d2 * (d2 < 0 ? min2 : max2)) >= offset) {
                    planes = buildPortalPlanesNoFrustum(portal.points, cX, cY, cZ);
                    if (planes) {
                        overlappingPortals[numOverlappingPortals] = {
                            portal: portal,
                            planes: planes,
                            area: portal.area
                        };
                        numOverlappingPortals += 1;
                    }
                }
            }
        }

        if (0 < numOverlappingPortals) {
            var portalItem, parentPlanes, nextArea;
            var currentPortalIndex = 0;
            do {
                portalItem = overlappingPortals[currentPortalIndex];
                currentPortalIndex += 1;
                parentPlanes = portalItem.planes;
                areaIndex = portalItem.area;
                portal = portalItem.portal;

                area = areas[areaIndex];
                portals = area.portals;
                numPortals = portals.length;
                for (n = 0; n < numPortals; n += 1) {
                    portal = portals[n];
                    nextArea = portal.area;
                    if (nextArea !== areaIndex && portal.queryCounter !== queryCounter && !portal.disabled) {
                        portalExtents = portal.extents;
                        if (portalExtents[0] < max0 && portalExtents[1] < max1 && portalExtents[2] < max2 && portalExtents[3] > min0 && portalExtents[4] > min1 && portalExtents[5] > min2) {
                            plane = portal.plane;
                            d0 = plane[0];
                            d1 = plane[1];
                            d2 = plane[2];
                            offset = plane[3];
                            if (((d0 * cX) + (d1 * cY) + (d2 * cZ)) < offset && (d0 * (d0 < 0 ? min0 : max0) + d1 * (d1 < 0 ? min1 : max1) + d2 * (d2 < 0 ? min2 : max2)) >= offset) {
                                planes = buildPortalPlanesNoFrustum(portal.points, cX, cY, cZ);
                                if (planes) {
                                    portal.queryCounter = queryCounter;
                                    overlappingPortals[numOverlappingPortals] = {
                                        portal: portal,
                                        planes: parentPlanes.concat(planes),
                                        area: nextArea
                                    };
                                    numOverlappingPortals += 1;
                                }
                            } else {
                                portal.queryCounter = queryCounter;
                            }
                        } else {
                            portal.queryCounter = queryCounter;
                        }
                    }
                }
            } while(currentPortalIndex < numOverlappingPortals);
        }
    };

    //
    // findOverlappingNodes
    //
    Scene.prototype.findOverlappingNodes = function (tree, origin, extents, overlappingNodes) {
        var useSpatialMap = true;

        if (this.areas) {
            useSpatialMap = !this._findOverlappingNodesAreas(tree, origin, extents, overlappingNodes);
        }

        if (useSpatialMap) {
            tree.getOverlappingNodes(extents, overlappingNodes);
        }
    };

    //
    // findStaticOverlappingNodes
    //
    Scene.prototype.findStaticOverlappingNodes = function (origin, extents, overlappingNodes) {
        this.findOverlappingNodes(this.staticSpatialMap, origin, extents, overlappingNodes);
    };

    //
    // findDynamicOverlappingNodes
    //
    Scene.prototype.findDynamicOverlappingNodes = function (origin, extents, overlappingNodes) {
        this.findOverlappingNodes(this.dynamicSpatialMap, origin, extents, overlappingNodes);
    };

    //
    // _findOverlappingNodesAreas
    //
    Scene.prototype._findOverlappingNodesAreas = function (tree, origin, extents, overlappingNodes) {
        // Assume scene.update has been called before this function
        var cX = origin[0];
        var cY = origin[1];
        var cZ = origin[2];
        var areaIndex = this.findAreaIndex(this.bspNodes, cX, cY, cZ);
        if (areaIndex < 0) {
            return false;
        }

        var externalNodesStack = this.externalNodesStack;
        var areas = this.areas;

        var na, area, nodes, numNodes;
        var numAreas = areas.length;
        for (na = 0; na < numAreas; na += 1) {
            area = areas[na];
            nodes = area.externalNodes;
            if (nodes) {
                nodes.length = 0;
                externalNodesStack.push(nodes);
                area.externalNodes = null;
            }
        }

        var minExtent0 = extents[0];
        var minExtent1 = extents[1];
        var minExtent2 = extents[2];
        var maxExtent0 = extents[3];
        var maxExtent1 = extents[4];
        var maxExtent2 = extents[5];

        area = areas[areaIndex];
        var areaExtents = area.extents;
        var testMinExtent0 = areaExtents[0];
        var testMinExtent1 = areaExtents[1];
        var testMinExtent2 = areaExtents[2];
        var testMaxExtent0 = areaExtents[3];
        var testMaxExtent1 = areaExtents[4];
        var testMaxExtent2 = areaExtents[5];

        var overlappingPortals = [];
        this.findOverlappingPortals(areaIndex, cX, cY, cZ, extents, overlappingPortals);

        var isInsidePlanesAABB = this.isInsidePlanesAABB;
        var queryCounter = this.getQueryCounter();
        var numOverlappingPortals = overlappingPortals.length;
        var numOverlappingNodes = overlappingNodes.length;
        var portalPlanes;
        var n, node, np, portalItem;

        if (0 < externalNodesStack.length) {
            nodes = externalNodesStack.pop();
        } else {
            nodes = [];
        }
        area.externalNodes = nodes;

        var testExtents = this.testExtents;
        testExtents[0] = (testMinExtent0 > minExtent0 ? testMinExtent0 : minExtent0);
        testExtents[1] = (testMinExtent1 > minExtent1 ? testMinExtent1 : minExtent1);
        testExtents[2] = (testMinExtent2 > minExtent2 ? testMinExtent2 : minExtent2);
        testExtents[3] = (testMaxExtent0 < maxExtent0 ? testMaxExtent0 : maxExtent0);
        testExtents[4] = (testMaxExtent1 < maxExtent1 ? testMaxExtent1 : maxExtent1);
        testExtents[5] = (testMaxExtent2 < maxExtent2 ? testMaxExtent2 : maxExtent2);

        tree.getOverlappingNodes(testExtents, nodes);

        numNodes = nodes.length;
        for (n = 0; n < numNodes; n += 1) {
            node = nodes[n];
            node.queryCounter = queryCounter;
            overlappingNodes[numOverlappingNodes] = node;
            numOverlappingNodes += 1;
        }

        for (np = 0; np < numOverlappingPortals; np += 1) {
            portalItem = overlappingPortals[np];
            portalPlanes = portalItem.planes;
            area = areas[portalItem.area];
            nodes = area.externalNodes;

            if (!nodes) {
                if (0 < externalNodesStack.length) {
                    nodes = externalNodesStack.pop();
                } else {
                    nodes = [];
                }
                area.externalNodes = nodes;
                areaExtents = area.extents;
                testMinExtent0 = areaExtents[0];
                testMinExtent1 = areaExtents[1];
                testMinExtent2 = areaExtents[2];
                testMaxExtent0 = areaExtents[3];
                testMaxExtent1 = areaExtents[4];
                testMaxExtent2 = areaExtents[5];

                testExtents[0] = (testMinExtent0 > minExtent0 ? testMinExtent0 : minExtent0);
                testExtents[1] = (testMinExtent1 > minExtent1 ? testMinExtent1 : minExtent1);
                testExtents[2] = (testMinExtent2 > minExtent2 ? testMinExtent2 : minExtent2);
                testExtents[3] = (testMaxExtent0 < maxExtent0 ? testMaxExtent0 : maxExtent0);
                testExtents[4] = (testMaxExtent1 < maxExtent1 ? testMaxExtent1 : maxExtent1);
                testExtents[5] = (testMaxExtent2 < maxExtent2 ? testMaxExtent2 : maxExtent2);

                tree.getOverlappingNodes(testExtents, nodes);
            }

            numNodes = nodes.length;
            for (n = 0; n < numNodes; n += 1) {
                node = nodes[n];
                if (node.queryCounter !== queryCounter) {
                    if (isInsidePlanesAABB(node.worldExtents, portalPlanes)) {
                        node.queryCounter = queryCounter;
                        overlappingNodes[numOverlappingNodes] = node;
                        numOverlappingNodes += 1;
                    }
                }
            }
        }

        return true;
    };

    //
    // findOverlappingRenderables
    //
    Scene.prototype.findOverlappingRenderables = function (tree, origin, extents, overlappingRenderables) {
        var useSpatialMap = true;

        if (this.areas) {
            useSpatialMap = !this._findOverlappingRenderablesAreas(tree, origin, extents, overlappingRenderables);
        }

        if (useSpatialMap) {
            this._findOverlappingRenderablesNoAreas(tree, extents, overlappingRenderables);
        }
    };

    //
    // findStaticOverlappingRenderables
    //
    Scene.prototype.findStaticOverlappingRenderables = function (origin, extents, overlappingRenderables) {
        this.findOverlappingRenderables(this.staticSpatialMap, origin, extents, overlappingRenderables);
    };

    //
    // findDynamicOverlappingRenderables
    //
    Scene.prototype.findDynamicOverlappingRenderables = function (origin, extents, overlappingRenderables) {
        this.findOverlappingRenderables(this.dynamicSpatialMap, origin, extents, overlappingRenderables);
    };

    //
    // _findOverlappingRenderablesAreas
    //
    Scene.prototype._findOverlappingRenderablesAreas = function (tree, origin, extents, overlappingRenderables) {
        // Assume scene.update has been called before this function
        var cX = origin[0];
        var cY = origin[1];
        var cZ = origin[2];
        var areaIndex = this.findAreaIndex(this.bspNodes, cX, cY, cZ);
        if (areaIndex < 0) {
            return false;
        }

        var numOverlappingRenderables = overlappingRenderables.length;
        var minExtent0 = extents[0];
        var minExtent1 = extents[1];
        var minExtent2 = extents[2];
        var maxExtent0 = extents[3];
        var maxExtent1 = extents[4];
        var maxExtent2 = extents[5];

        var node;
        var numNodes;
        var nodeIndex;
        var renderable;
        var renderables;
        var numRenderables;
        var nodeExtents;
        var renderableIndex;
        var renderableExtents;

        var externalNodesStack = this.externalNodesStack;
        var areas = this.areas;

        var na, area, nodes;
        var numAreas = areas.length;
        for (na = 0; na < numAreas; na += 1) {
            area = areas[na];
            nodes = area.externalNodes;
            if (nodes) {
                nodes.length = 0;
                externalNodesStack.push(nodes);
                area.externalNodes = null;
            }
        }

        area = areas[areaIndex];
        var areaExtents = area.extents;
        var testMinExtent0 = areaExtents[0];
        var testMinExtent1 = areaExtents[1];
        var testMinExtent2 = areaExtents[2];
        var testMaxExtent0 = areaExtents[3];
        var testMaxExtent1 = areaExtents[4];
        var testMaxExtent2 = areaExtents[5];

        var overlappingPortals = [];
        this.findOverlappingPortals(areaIndex, cX, cY, cZ, extents, overlappingPortals);

        var isInsidePlanesAABB = this.isInsidePlanesAABB;
        var isFullyInsidePlanesAABB = this.isFullyInsidePlanesAABB;
        var queryCounter = this.getQueryCounter();
        var numOverlappingPortals = overlappingPortals.length;
        var portalPlanes;
        var n, np, portalItem;
        var allVisible;

        if (0 < externalNodesStack.length) {
            nodes = externalNodesStack.pop();
        } else {
            nodes = [];
        }
        area.externalNodes = nodes;

        var testExtents = this.testExtents;
        testExtents[0] = (testMinExtent0 > minExtent0 ? testMinExtent0 : minExtent0);
        testExtents[1] = (testMinExtent1 > minExtent1 ? testMinExtent1 : minExtent1);
        testExtents[2] = (testMinExtent2 > minExtent2 ? testMinExtent2 : minExtent2);
        testExtents[3] = (testMaxExtent0 < maxExtent0 ? testMaxExtent0 : maxExtent0);
        testExtents[4] = (testMaxExtent1 < maxExtent1 ? testMaxExtent1 : maxExtent1);
        testExtents[5] = (testMaxExtent2 < maxExtent2 ? testMaxExtent2 : maxExtent2);

        tree.getOverlappingNodes(testExtents, nodes);

        numNodes = nodes.length;
        for (nodeIndex = 0; nodeIndex < numNodes; nodeIndex += 1) {
            node = nodes[nodeIndex];
            node.queryCounter = queryCounter;
            renderables = node.renderables;
            if (renderables) {
                numRenderables = renderables.length;
                if (numRenderables === 1) {
                    overlappingRenderables[numOverlappingRenderables] = renderables[0];
                    numOverlappingRenderables += 1;
                } else {
                    // Check if node is fully inside
                    nodeExtents = node.worldExtents;
                    if (nodeExtents[0] >= minExtent0 && nodeExtents[1] >= minExtent1 && nodeExtents[2] >= minExtent2 && nodeExtents[3] <= maxExtent0 && nodeExtents[4] <= maxExtent1 && nodeExtents[5] <= maxExtent2) {
                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                            overlappingRenderables[numOverlappingRenderables] = renderables[renderableIndex];
                            numOverlappingRenderables += 1;
                        }
                    } else {
                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                            renderable = renderables[renderableIndex];
                            renderableExtents = renderable.getWorldExtents();
                            if (renderableExtents[3] >= minExtent0 && renderableExtents[4] >= minExtent1 && renderableExtents[5] >= minExtent2 && renderableExtents[0] <= maxExtent0 && renderableExtents[1] <= maxExtent1 && renderableExtents[2] <= maxExtent2) {
                                overlappingRenderables[numOverlappingRenderables] = renderable;
                                numOverlappingRenderables += 1;
                            }
                        }
                    }
                }
            }
        }

        for (np = 0; np < numOverlappingPortals; np += 1) {
            portalItem = overlappingPortals[np];
            portalPlanes = portalItem.planes;
            area = areas[portalItem.area];
            nodes = area.externalNodes;

            if (!nodes) {
                if (0 < externalNodesStack.length) {
                    nodes = externalNodesStack.pop();
                } else {
                    nodes = [];
                }
                area.externalNodes = nodes;
                areaExtents = area.extents;
                testMinExtent0 = areaExtents[0];
                testMinExtent1 = areaExtents[1];
                testMinExtent2 = areaExtents[2];
                testMaxExtent0 = areaExtents[3];
                testMaxExtent1 = areaExtents[4];
                testMaxExtent2 = areaExtents[5];

                testExtents[0] = (testMinExtent0 > minExtent0 ? testMinExtent0 : minExtent0);
                testExtents[1] = (testMinExtent1 > minExtent1 ? testMinExtent1 : minExtent1);
                testExtents[2] = (testMinExtent2 > minExtent2 ? testMinExtent2 : minExtent2);
                testExtents[3] = (testMaxExtent0 < maxExtent0 ? testMaxExtent0 : maxExtent0);
                testExtents[4] = (testMaxExtent1 < maxExtent1 ? testMaxExtent1 : maxExtent1);
                testExtents[5] = (testMaxExtent2 < maxExtent2 ? testMaxExtent2 : maxExtent2);

                tree.getOverlappingNodes(testExtents, nodes);
            }

            numNodes = nodes.length;
            for (n = 0; n < numNodes; n += 1) {
                node = nodes[n];
                if (node.queryCounter !== queryCounter) {
                    allVisible = true;

                    renderables = node.renderables;
                    if (renderables) {
                        nodeExtents = node.worldExtents;
                        if (isInsidePlanesAABB(nodeExtents, portalPlanes)) {
                            numRenderables = renderables.length;
                            if (numRenderables === 1) {
                                renderable = renderables[0];
                                if (renderable.queryCounter !== queryCounter) {
                                    renderable.queryCounter = queryCounter;
                                    overlappingRenderables[numOverlappingRenderables] = renderable;
                                    numOverlappingRenderables += 1;
                                }
                            } else {
                                if (nodeExtents[0] >= minExtent0 && nodeExtents[1] >= minExtent1 && nodeExtents[2] >= minExtent2 && nodeExtents[3] <= maxExtent0 && nodeExtents[4] <= maxExtent1 && nodeExtents[5] <= maxExtent2) {
                                    if (isFullyInsidePlanesAABB(nodeExtents, portalPlanes)) {
                                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                                            renderable = renderables[renderableIndex];
                                            if (renderable.queryCounter !== queryCounter) {
                                                renderable.queryCounter = queryCounter;
                                                overlappingRenderables[numOverlappingRenderables] = renderable;
                                                numOverlappingRenderables += 1;
                                            }
                                        }
                                    } else {
                                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                                            renderable = renderables[renderableIndex];
                                            if (renderable.queryCounter !== queryCounter) {
                                                if (isInsidePlanesAABB(renderable.getWorldExtents(), portalPlanes)) {
                                                    renderable.queryCounter = queryCounter;
                                                    overlappingRenderables[numOverlappingRenderables] = renderable;
                                                    numOverlappingRenderables += 1;
                                                } else {
                                                    allVisible = false;
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (isFullyInsidePlanesAABB(nodeExtents, portalPlanes)) {
                                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                                            renderable = renderables[renderableIndex];
                                            if (renderable.queryCounter !== queryCounter) {
                                                renderableExtents = renderable.getWorldExtents();
                                                if (renderableExtents[3] >= minExtent0 && renderableExtents[4] >= minExtent1 && renderableExtents[5] >= minExtent2 && renderableExtents[0] <= maxExtent0 && renderableExtents[1] <= maxExtent1 && renderableExtents[2] <= maxExtent2) {
                                                    renderable.queryCounter = queryCounter;
                                                    overlappingRenderables[numOverlappingRenderables] = renderable;
                                                    numOverlappingRenderables += 1;
                                                } else {
                                                    allVisible = false;
                                                }
                                            }
                                        }
                                    } else {
                                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                                            renderable = renderables[renderableIndex];
                                            if (renderable.queryCounter !== queryCounter) {
                                                renderableExtents = renderable.getWorldExtents();
                                                if (renderableExtents[3] >= minExtent0 && renderableExtents[4] >= minExtent1 && renderableExtents[5] >= minExtent2 && renderableExtents[0] <= maxExtent0 && renderableExtents[1] <= maxExtent1 && renderableExtents[2] <= maxExtent2 && isInsidePlanesAABB(renderableExtents, portalPlanes)) {
                                                    renderable.queryCounter = queryCounter;
                                                    overlappingRenderables[numOverlappingRenderables] = renderable;
                                                    numOverlappingRenderables += 1;
                                                } else {
                                                    allVisible = false;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            allVisible = false;
                        }
                    }

                    if (allVisible) {
                        node.queryCounter = queryCounter;
                    }
                }
            }
        }

        return true;
    };

    //
    // _findOverlappingRenderablesNoAreas
    //
    Scene.prototype._findOverlappingRenderablesNoAreas = function (tree, extents, overlappingRenderables) {
        var numOverlappingRenderables = overlappingRenderables.length;
        var minExtent0 = extents[0];
        var minExtent1 = extents[1];
        var minExtent2 = extents[2];
        var maxExtent0 = extents[3];
        var maxExtent1 = extents[4];
        var maxExtent2 = extents[5];

        var overlappingNodes = [];

        var node;
        var numNodes;
        var nodeIndex;
        var renderable;
        var renderables;
        var numRenderables;
        var nodeExtents;
        var renderableIndex;
        var renderableExtents;

        tree.getOverlappingNodes(extents, overlappingNodes);
        numNodes = overlappingNodes.length;
        for (nodeIndex = 0; nodeIndex < numNodes; nodeIndex += 1) {
            node = overlappingNodes[nodeIndex];
            renderables = node.renderables;
            if (renderables) {
                numRenderables = renderables.length;
                if (numRenderables === 1) {
                    overlappingRenderables[numOverlappingRenderables] = renderables[0];
                    numOverlappingRenderables += 1;
                } else {
                    // Check if node is fully inside
                    nodeExtents = node.worldExtents;
                    if (nodeExtents[0] >= minExtent0 && nodeExtents[1] >= minExtent1 && nodeExtents[2] >= minExtent2 && nodeExtents[3] <= maxExtent0 && nodeExtents[4] <= maxExtent1 && nodeExtents[5] <= maxExtent2) {
                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                            overlappingRenderables[numOverlappingRenderables] = renderables[renderableIndex];
                            numOverlappingRenderables += 1;
                        }
                    } else {
                        for (renderableIndex = 0; renderableIndex < numRenderables; renderableIndex += 1) {
                            renderable = renderables[renderableIndex];
                            renderableExtents = renderable.getWorldExtents();
                            if (renderableExtents[3] >= minExtent0 && renderableExtents[4] >= minExtent1 && renderableExtents[5] >= minExtent2 && renderableExtents[0] <= maxExtent0 && renderableExtents[1] <= maxExtent1 && renderableExtents[2] <= maxExtent2) {
                                overlappingRenderables[numOverlappingRenderables] = renderable;
                                numOverlappingRenderables += 1;
                            }
                        }
                    }
                }
            }
        }
    };

    //
    // cloneRootNode
    //
    Scene.prototype.cloneRootNode = function (rootNode, newInstanceName) {
        var newNode = rootNode.clone(newInstanceName);
        this.addRootNode(newNode);
        return newNode;
    };

    //
    // updateVisibleNodes
    //
    Scene.prototype.updateVisibleNodes = function (camera) {
        var useSpatialMap = true;

        if (this.areas) {
            useSpatialMap = !this._updateVisibleNodesAreas(camera);
        }

        if (useSpatialMap) {
            this._updateVisibleNodesNoAreas(camera);
        }

        this.frameIndex += 1;
    };

    //
    // _updateVisibleNodesNoAreas
    //
    Scene.prototype._updateVisibleNodesNoAreas = function (camera) {
        var visibleNodes = this.visibleNodes;
        var numVisibleNodes = 0;

        var visibleRenderables = this.visibleRenderables;
        var numVisibleRenderables = 0;

        var visibleLights = this.visibleLights;
        var numVisibleLights = 0;

        this.extractFrustumPlanes(camera);
        var frustumPlanes = this.frustumPlanes;

        var frameIndex = this.frameIndex;
        var nearPlane = this.nearPlane;
        var d0 = nearPlane[0];
        var d1 = nearPlane[1];
        var d2 = nearPlane[2];
        var offset = nearPlane[3];
        var maxDistance = 0;
        var n, node;

        var isFullyInsidePlanesAABB = this.isFullyInsidePlanesAABB;
        var isInsidePlanesAABB = this.isInsidePlanesAABB;

        var queryVisibleNodes = this.queryVisibleNodes;
        if (!queryVisibleNodes) {
            this.queryVisibleNodes = queryVisibleNodes = [];
        }
        var numQueryVisibleNodes = this.staticSpatialMap.getVisibleNodes(frustumPlanes, queryVisibleNodes, 0);
        numQueryVisibleNodes += this.dynamicSpatialMap.getVisibleNodes(frustumPlanes, queryVisibleNodes, numQueryVisibleNodes);

        for (n = 0; n < numQueryVisibleNodes; n += 1) {
            node = queryVisibleNodes[n];
            if (!node.disabled) {
                var extents = node.worldExtents;
                var distance, renderable, i, lightInstance, l;

                debug.assert(node.frameVisible !== frameIndex);
                node.frameVisible = frameIndex;

                distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                node.distance = distance;

                if (0 < distance) {
                    //This signifies any part of the node is visible, but not necessarily all.
                    visibleNodes[numVisibleNodes] = node;
                    numVisibleNodes += 1;

                    var renderables = node.renderables;
                    var numRenderables = (renderables ? renderables.length : 0);

                    var lights = node.lightInstances;
                    var numLights = (lights ? lights.length : 0);

                    var fullyVisible = (1 < (numLights + numRenderables) ? isFullyInsidePlanesAABB(extents, frustumPlanes) : false);

                    if (renderables) {
                        if (numRenderables === 1 && !lights) {
                            renderable = renderables[0];
                            if (!renderable.disabled) {
                                if (maxDistance < distance) {
                                    maxDistance = distance;
                                }
                                renderable.distance = distance;
                                renderable.frameVisible = frameIndex;
                                visibleRenderables[numVisibleRenderables] = renderable;
                                numVisibleRenderables += 1;
                            }
                        } else {
                            for (i = 0; i < numRenderables; i += 1) {
                                renderable = renderables[i];
                                if (!renderable.disabled) {
                                    extents = renderable.getWorldExtents();
                                    if (fullyVisible || isInsidePlanesAABB(extents, frustumPlanes)) {
                                        distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                                        if (0 < distance) {
                                            if (maxDistance < distance) {
                                                maxDistance = distance;
                                            }
                                            renderable.distance = distance;
                                            renderable.frameVisible = frameIndex;
                                            visibleRenderables[numVisibleRenderables] = renderable;
                                            numVisibleRenderables += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (lights) {
                        if (numLights === 1 && !renderables) {
                            lightInstance = lights[0];
                            if (!lightInstance.disabled && !lightInstance.light.isGlobal()) {
                                lightInstance.distance = distance;
                                lightInstance.frameVisible = frameIndex;
                                visibleLights[numVisibleLights] = lightInstance;
                                numVisibleLights += 1;
                            }
                        } else {
                            for (l = 0; l < numLights; l += 1) {
                                lightInstance = lights[l];
                                if (!lightInstance.disabled && !lightInstance.light.isGlobal()) {
                                    extents = lightInstance.getWorldExtents();
                                    if (fullyVisible || isInsidePlanesAABB(extents, frustumPlanes)) {
                                        distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                                        if (0 < distance) {
                                            lightInstance.distance = distance;
                                            lightInstance.frameVisible = frameIndex;
                                            visibleLights[numVisibleLights] = lightInstance;
                                            numVisibleLights += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        this.maxDistance = (maxDistance + camera.nearPlane);
        if (this.maxDistance < camera.farPlane) {
            this._filterVisibleNodesForCameraBox(camera, numVisibleNodes, numVisibleRenderables, numVisibleLights);
        } else {
            visibleRenderables.length = numVisibleRenderables;
            visibleLights.length = numVisibleLights;
            visibleNodes.length = numVisibleNodes;
        }
    };

    //
    // _updateVisibleNodesAreas
    //
    Scene.prototype._updateVisibleNodesAreas = function (camera) {
        var cameraMatrix = camera.matrix;
        var cX = cameraMatrix[9];
        var cY = cameraMatrix[10];
        var cZ = cameraMatrix[11];

        var areaIndex = this.findAreaIndex(this.bspNodes, cX, cY, cZ);
        this.cameraAreaIndex = areaIndex;

        if (areaIndex < 0) {
            return false;
        }

        var visibleNodes = this.visibleNodes;
        var numVisibleNodes = 0;

        var visibleRenderables = this.visibleRenderables;
        var numVisibleRenderables = 0;

        var visibleLights = this.visibleLights;
        var numVisibleLights = 0;

        this.extractFrustumPlanes(camera);
        var frustumPlanes = this.frustumPlanes;

        var frameIndex = this.frameIndex;
        var nearPlane = this.nearPlane;
        var d0 = nearPlane[0];
        var d1 = nearPlane[1];
        var d2 = nearPlane[2];
        var offset = nearPlane[3];
        var maxDistance = 0;
        var n = 0;
        var node;

        var isFullyInsidePlanesAABB = this.isFullyInsidePlanesAABB;
        var isInsidePlanesAABB = this.isInsidePlanesAABB;

        // findVisibleNodes
        var cameraExtents = this.cameraExtents;

        camera.getFrustumExtents(cameraExtents);

        var cameraMinExtent0 = cameraExtents[0];
        var cameraMinExtent1 = cameraExtents[1];
        var cameraMinExtent2 = cameraExtents[2];
        var cameraMaxExtent0 = cameraExtents[3];
        var cameraMaxExtent1 = cameraExtents[4];
        var cameraMaxExtent2 = cameraExtents[5];

        var areas = this.areas;
        var queryCounter = this.getQueryCounter();

        //
        // sceneProcessVisibleNodeFn helper
        //
        function sceneProcessVisibleNode(node, planes) {
            var extents = node.worldExtents;
            var allVisible = true;
            var distance;

            if (node.frameVisible !== frameIndex) {
                node.frameVisible = frameIndex;

                distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                node.distance = distance;
                if (0 < distance) {
                    //This signifies any part of the node is visible, but not necessarily all.
                    visibleNodes[numVisibleNodes] = node;
                    numVisibleNodes += 1;
                }
            } else {
                distance = node.distance;
            }

            if (0 < distance) {
                var renderable, i, lightInstance, l;
                var renderables = node.renderables;
                var numRenderables = (renderables ? renderables.length : 0);

                var lights = node.lightInstances;
                var numLights = (lights ? lights.length : 0);

                var fullyVisible = (1 < (numLights + numRenderables) ? isFullyInsidePlanesAABB(extents, planes) : false);

                if (renderables) {
                    if (numRenderables === 1 && !lights) {
                        renderable = renderables[0];
                        if (!renderable.disabled && renderable.queryCounter !== queryCounter) {
                            if (maxDistance < distance) {
                                maxDistance = distance;
                            }
                            renderable.distance = distance;
                            renderable.frameVisible = frameIndex;
                            renderable.queryCounter = queryCounter;
                            visibleRenderables[numVisibleRenderables] = renderable;
                            numVisibleRenderables += 1;
                        }
                    } else {
                        for (i = 0; i < numRenderables; i += 1) {
                            renderable = renderables[i];
                            if (!renderable.disabled && renderable.queryCounter !== queryCounter) {
                                extents = renderable.getWorldExtents();
                                if (fullyVisible || isInsidePlanesAABB(extents, planes)) {
                                    distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                                    if (0 < distance) {
                                        if (maxDistance < distance) {
                                            maxDistance = distance;
                                        }
                                        renderable.distance = distance;
                                        renderable.frameVisible = frameIndex;
                                        renderable.queryCounter = queryCounter;
                                        visibleRenderables[numVisibleRenderables] = renderable;
                                        numVisibleRenderables += 1;
                                    } else {
                                        allVisible = false;
                                    }
                                } else {
                                    allVisible = false;
                                }
                            }
                        }
                    }
                }

                if (lights) {
                    if (numLights === 1 && !renderables) {
                        lightInstance = lights[0];
                        if (!lightInstance.disabled && lightInstance.queryCounter !== queryCounter && !lightInstance.light.isGlobal()) {
                            lightInstance.distance = distance;
                            lightInstance.frameVisible = frameIndex;
                            lightInstance.queryCounter = queryCounter;
                            visibleLights[numVisibleLights] = lightInstance;
                            numVisibleLights += 1;
                        }
                    } else {
                        for (l = 0; l < numLights; l += 1) {
                            lightInstance = lights[l];
                            if (!lightInstance.disabled && lightInstance.queryCounter !== queryCounter && !lightInstance.light.isGlobal()) {
                                extents = lightInstance.getWorldExtents();
                                if (fullyVisible || isInsidePlanesAABB(extents, planes)) {
                                    distance = ((d0 * (d0 > 0 ? extents[3] : extents[0])) + (d1 * (d1 > 0 ? extents[4] : extents[1])) + (d2 * (d2 > 0 ? extents[5] : extents[2])) - offset);
                                    if (0 < distance) {
                                        lightInstance.distance = distance;
                                        lightInstance.frameVisible = frameIndex;
                                        lightInstance.queryCounter = queryCounter;
                                        visibleLights[numVisibleLights] = lightInstance;
                                        numVisibleLights += 1;
                                    } else {
                                        allVisible = false;
                                    }
                                } else {
                                    allVisible = false;
                                }
                            }
                        }
                    }
                }
            }

            if (allVisible) {
                node.queryCounter = queryCounter;
            }
        }

        this.findVisiblePortals(areaIndex, cX, cY, cZ);

        var area, na, nodes, numNodes;
        var numAreas = areas.length;
        for (na = 0; na < numAreas; na += 1) {
            area = areas[na];
            nodes = area.nodes;
            numNodes = area.numStaticNodes;
            if (nodes.length > numNodes) {
                nodes.length = numNodes;
            }
            area.addedDynamicNodes = false;
        }

        var dynamicSpatialMap = this.dynamicSpatialMap;
        var visiblePortals = this.visiblePortals;
        var numVisiblePortals = visiblePortals.length;

        var np, portalItem, portalPlanes;

        area = areas[areaIndex];
        nodes = area.nodes;
        area.addedDynamicNodes = true;

        var areaExtent = area.extents;
        var areaMinExtent0 = areaExtent[0];
        var areaMinExtent1 = areaExtent[1];
        var areaMinExtent2 = areaExtent[2];
        var areaMaxExtent0 = areaExtent[3];
        var areaMaxExtent1 = areaExtent[4];
        var areaMaxExtent2 = areaExtent[5];
        var combinedExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(6) : new Array(6));
        combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
        combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
        combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
        combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
        combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
        combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);

        dynamicSpatialMap.getOverlappingNodes(combinedExtents, nodes);

        numNodes = nodes.length;
        for (n = 0; n < numNodes; n += 1) {
            node = nodes[n];
            node.queryCounter = queryCounter;
            if (!node.disabled && isInsidePlanesAABB(node.worldExtents, frustumPlanes)) {
                sceneProcessVisibleNode(node, frustumPlanes);
            }
        }

        for (np = 0; np < numVisiblePortals; np += 1) {
            portalItem = visiblePortals[np];
            portalPlanes = portalItem.planes;
            area = areas[portalItem.area];
            nodes = area.nodes;

            // Frustum tests do return some false positives, check bounding boxes
            areaExtent = area.extents;
            areaMinExtent0 = areaExtent[0];
            areaMinExtent1 = areaExtent[1];
            areaMinExtent2 = areaExtent[2];
            areaMaxExtent0 = areaExtent[3];
            areaMaxExtent1 = areaExtent[4];
            areaMaxExtent2 = areaExtent[5];
            if (cameraMaxExtent0 > areaMinExtent0 && cameraMaxExtent1 > areaMinExtent1 && cameraMaxExtent2 > areaMinExtent2 && areaMaxExtent0 > cameraMinExtent0 && areaMaxExtent1 > cameraMinExtent1 && areaMaxExtent2 > cameraMinExtent2) {
                if (!area.addedDynamicNodes) {
                    area.addedDynamicNodes = true;
                    combinedExtents[0] = (areaMinExtent0 < cameraMinExtent0 ? cameraMinExtent0 : areaMinExtent0);
                    combinedExtents[1] = (areaMinExtent1 < cameraMinExtent1 ? cameraMinExtent1 : areaMinExtent1);
                    combinedExtents[2] = (areaMinExtent2 < cameraMinExtent2 ? cameraMinExtent2 : areaMinExtent2);
                    combinedExtents[3] = (areaMaxExtent0 > cameraMaxExtent0 ? cameraMaxExtent0 : areaMaxExtent0);
                    combinedExtents[4] = (areaMaxExtent1 > cameraMaxExtent1 ? cameraMaxExtent1 : areaMaxExtent1);
                    combinedExtents[5] = (areaMaxExtent2 > cameraMaxExtent2 ? cameraMaxExtent2 : areaMaxExtent2);
                    dynamicSpatialMap.getOverlappingNodes(combinedExtents, nodes);
                }

                numNodes = nodes.length;
                for (n = 0; n < numNodes; n += 1) {
                    node = nodes[n];
                    if (node.queryCounter !== queryCounter) {
                        if (node.disabled) {
                            node.queryCounter = queryCounter;
                        } else if (isInsidePlanesAABB(node.worldExtents, portalPlanes)) {
                            sceneProcessVisibleNode(node, portalPlanes);
                        }
                    }
                }
            }
        }

        this.maxDistance = (maxDistance + camera.nearPlane);
        if (this.maxDistance < camera.farPlane) {
            this._filterVisibleNodesForCameraBox(camera, numVisibleNodes, numVisibleRenderables, numVisibleLights);
        } else {
            visibleRenderables.length = numVisibleRenderables;
            visibleLights.length = numVisibleLights;
            visibleNodes.length = numVisibleNodes;
        }

        return true;
    };

    //
    // _filterVisibleNodesForCameraBox
    //
    Scene.prototype._filterVisibleNodesForCameraBox = function (camera, numVisibleNodes, numVisibleRenderables, numVisibleLights) {
        var visibleNodes = this.visibleNodes;
        var visibleRenderables = this.visibleRenderables;
        var visibleLights = this.visibleLights;

        var oldNumVisibleRenderables = numVisibleRenderables;
        var oldNumVisibleLights = numVisibleLights;

        // The camera extents may be different and some objects could be discarded
        var cameraExtents = this.cameraExtents;

        camera.getFrustumExtents(cameraExtents, this.maxDistance);

        var cameraMinExtent0 = cameraExtents[0];
        var cameraMinExtent1 = cameraExtents[1];
        var cameraMinExtent2 = cameraExtents[2];
        var cameraMaxExtent0 = cameraExtents[3];
        var cameraMaxExtent1 = cameraExtents[4];
        var cameraMaxExtent2 = cameraExtents[5];

        var node, renderable, lightInstance, extents;
        var n = 0;
        while (n < numVisibleRenderables) {
            renderable = visibleRenderables[n];
            extents = renderable.getWorldExtents();
            if (extents[0] > cameraMaxExtent0 || extents[1] > cameraMaxExtent1 || extents[2] > cameraMaxExtent2 || extents[3] < cameraMinExtent0 || extents[4] < cameraMinExtent1 || extents[5] < cameraMinExtent2) {
                renderable.frameVisible -= 1;
                numVisibleRenderables -= 1;
                if (n < numVisibleRenderables) {
                    visibleRenderables[n] = visibleRenderables[numVisibleRenderables];
                } else {
                    break;
                }
            } else {
                n += 1;
            }
        }

        n = 0;
        while (n < numVisibleLights) {
            lightInstance = visibleLights[n];
            extents = lightInstance.getWorldExtents();
            if (extents[0] > cameraMaxExtent0 || extents[1] > cameraMaxExtent1 || extents[2] > cameraMaxExtent2 || extents[3] < cameraMinExtent0 || extents[4] < cameraMinExtent1 || extents[5] < cameraMinExtent2) {
                lightInstance.frameVisible -= 1;
                numVisibleLights -= 1;
                if (n < numVisibleLights) {
                    visibleLights[n] = visibleLights[numVisibleLights];
                } else {
                    break;
                }
            } else {
                n += 1;
            }
        }

        if (oldNumVisibleRenderables !== numVisibleRenderables || oldNumVisibleLights !== numVisibleLights) {
            n = 0;
            while (n < numVisibleNodes) {
                node = visibleNodes[n];
                extents = node.worldExtents;
                if (extents[0] > cameraMaxExtent0 || extents[1] > cameraMaxExtent1 || extents[2] > cameraMaxExtent2 || extents[3] < cameraMinExtent0 || extents[4] < cameraMinExtent1 || extents[5] < cameraMinExtent2) {
                    node.frameVisible -= 1;
                    numVisibleNodes -= 1;
                    if (n < numVisibleNodes) {
                        visibleNodes[n] = visibleNodes[numVisibleNodes];
                    } else {
                        break;
                    }
                } else {
                    n += 1;
                }
            }
        }

        visibleRenderables.length = numVisibleRenderables;
        visibleLights.length = numVisibleLights;
        visibleNodes.length = numVisibleNodes;
    };

    //
    // getCurrentVisibleNodes
    //
    Scene.prototype.getCurrentVisibleNodes = function () {
        return this.visibleNodes;
    };

    //
    // getCurrentVisibleRenderables
    //
    Scene.prototype.getCurrentVisibleRenderables = function () {
        return this.visibleRenderables;
    };

    //
    // getCurrentVisibleLights
    //
    Scene.prototype.getCurrentVisibleLights = function () {
        return this.visibleLights;
    };

    //
    // addRootNodeToUpdate
    //
    Scene.prototype.addRootNodeToUpdate = function (rootNode, name) {
        var dirtyRoots = this.dirtyRoots;
        if (dirtyRoots[name] !== rootNode) {
            dirtyRoots[name] = rootNode;
            var numNodesToUpdate = this.numNodesToUpdate;
            this.nodesToUpdate[numNodesToUpdate] = rootNode;
            this.numNodesToUpdate = (numNodesToUpdate + 1);
        }
    };

    //
    // updateNodes
    //
    Scene.prototype.updateNodes = function () {
        var numNodesToUpdate = this.numNodesToUpdate;
        if (0 < numNodesToUpdate) {
            var nodesToUpdate = this.nodesToUpdate;
            var dirtyRoots = this.dirtyRoots;
            var n;
            for (n = 0; n < numNodesToUpdate; n += 1) {
                dirtyRoots[nodesToUpdate[n].name] = null;
            }

            SceneNode.updateNodes(this.md, this, nodesToUpdate, numNodesToUpdate);

            this.numNodesToUpdate = 0;
        }
    };

    //
    // update
    //
    Scene.prototype.update = function () {
        this.updateNodes();
        this.staticSpatialMap.finalize();
        this.dynamicSpatialMap.finalize();
        this.updateExtents();

        if (this.areas && this.staticNodesChangeCounter !== this.areaInitalizeStaticNodesChangeCounter) {
            //Note this leaves extents of areas as large as they ever got.
            this.initializeAreas();
        }
    };

    //
    // updateExtents
    //
    Scene.prototype.updateExtents = function () {
        var rootStaticExtents = this.staticSpatialMap.getExtents();
        var rootDynamicExtents = this.dynamicSpatialMap.getExtents();
        var sceneExtents = this.extents;

        if (rootStaticExtents) {
            if (rootDynamicExtents) {
                var minStaticX, minStaticY, minStaticZ, maxStaticX, maxStaticY, maxStaticZ;
                var minDynamicX, minDynamicY, minDynamicZ, maxDynamicX, maxDynamicY, maxDynamicZ;

                minStaticX = rootStaticExtents[0];
                minStaticY = rootStaticExtents[1];
                minStaticZ = rootStaticExtents[2];
                maxStaticX = rootStaticExtents[3];
                maxStaticY = rootStaticExtents[4];
                maxStaticZ = rootStaticExtents[5];

                minDynamicX = rootDynamicExtents[0];
                minDynamicY = rootDynamicExtents[1];
                minDynamicZ = rootDynamicExtents[2];
                maxDynamicX = rootDynamicExtents[3];
                maxDynamicY = rootDynamicExtents[4];
                maxDynamicZ = rootDynamicExtents[5];

                sceneExtents[0] = (minStaticX < minDynamicX ? minStaticX : minDynamicX);
                sceneExtents[1] = (minStaticY < minDynamicY ? minStaticY : minDynamicY);
                sceneExtents[2] = (minStaticZ < minDynamicZ ? minStaticZ : minDynamicZ);
                sceneExtents[3] = (maxStaticX > maxDynamicX ? maxStaticX : maxDynamicX);
                sceneExtents[4] = (maxStaticY > maxDynamicY ? maxStaticY : maxDynamicY);
                sceneExtents[5] = (maxStaticZ > maxDynamicZ ? maxStaticZ : maxDynamicZ);
            } else {
                sceneExtents[0] = rootStaticExtents[0];
                sceneExtents[1] = rootStaticExtents[1];
                sceneExtents[2] = rootStaticExtents[2];
                sceneExtents[3] = rootStaticExtents[3];
                sceneExtents[4] = rootStaticExtents[4];
                sceneExtents[5] = rootStaticExtents[5];
            }
        } else {
            if (rootDynamicExtents) {
                sceneExtents[0] = rootDynamicExtents[0];
                sceneExtents[1] = rootDynamicExtents[1];
                sceneExtents[2] = rootDynamicExtents[2];
                sceneExtents[3] = rootDynamicExtents[3];
                sceneExtents[4] = rootDynamicExtents[4];
                sceneExtents[5] = rootDynamicExtents[5];
            } else {
                sceneExtents[0] = 0;
                sceneExtents[1] = 0;
                sceneExtents[2] = 0;
                sceneExtents[3] = 0;
                sceneExtents[4] = 0;
                sceneExtents[5] = 0;
            }
        }
    };

    //
    //  getExtents
    //
    Scene.prototype.getExtents = function () {
        if (0 < this.numNodesToUpdate) {
            this.updateNodes();
            this.staticSpatialMap.finalize();
            this.dynamicSpatialMap.finalize();
            this.updateExtents();
        }
        return this.extents;
    };

    //
    //  loadMaterial
    //
    Scene.prototype.loadMaterial = function (graphicsDevice, textureManager, effectManager, materialName, material) {
        var materials = this.materials;

        if (!materials[materialName]) {
            var effectName = material.effect || "default";
            var newMaterial = this.createMaterial(materialName, material, effectName, null, null, graphicsDevice);
            if (newMaterial) {
                delete newMaterial.effectName;
                var effect = effectManager.get(effectName);
                if (effect) {
                    effect.prepareMaterial(newMaterial);
                }
                newMaterial.loadTextures(textureManager);
                return true;
            }
        }
        return false;
    };

    //
    // hasMaterial
    //
    Scene.prototype.hasMaterial = function (materialName) {
        var material = this.materials[materialName];
        if (material) {
            return true;
        }
        return false;
    };

    //
    // getMaterial
    //
    Scene.prototype.getMaterial = function (materialName) {
        return this.materials[materialName];
    };

    //
    // Draw nodes with same technique, mostly for debugging
    //
    Scene.prototype.drawNodesArray = function (nodes, gd, globalMaterial, technique, renderUpdate) {
        var numNodes = nodes.length;
        if (numNodes > 0) {
            var setTechnique = gd.setTechnique;
            var setTechniqueParameters = gd.setTechniqueParameters;
            var setStream = gd.setStream;
            var setIndexBuffer = gd.setIndexBuffer;
            var drawIndexed = gd.drawIndexed;
            var draw = gd.draw;
            var currentSharedTechniqueParameters = null;
            var currentVertexBuffer = null;
            var currentSemantics = null;
            var node, shape, sharedTechniqueParameters, techniqueParameters, vertexBuffer, semantics, surface, indexBuffer;
            var renderables, renderable, numRenderables, i;
            var n = 0;
            setTechnique.call(gd, technique);
            setTechniqueParameters.call(gd, globalMaterial);
            do {
                node = nodes[n];
                renderables = node.renderables;
                if (renderables) {
                    numRenderables = renderables.length;
                    for (i = 0; i < numRenderables; i += 1) {
                        renderable = renderables[i];

                        renderUpdate.call(renderable);

                        shape = renderable.geometry;
                        vertexBuffer = shape.vertexBuffer;
                        semantics = shape.semantics;
                        surface = renderable.surface;
                        sharedTechniqueParameters = renderable.sharedMaterial.techniqueParameters;
                        techniqueParameters = renderable.techniqueParameters;

                        if (currentSharedTechniqueParameters !== sharedTechniqueParameters) {
                            currentSharedTechniqueParameters = sharedTechniqueParameters;
                            setTechniqueParameters.call(gd, sharedTechniqueParameters, techniqueParameters);
                        } else {
                            setTechniqueParameters.call(gd, techniqueParameters);
                        }

                        if (currentVertexBuffer !== vertexBuffer || currentSemantics !== semantics) {
                            currentVertexBuffer = vertexBuffer;
                            currentSemantics = semantics;
                            setStream.call(gd, vertexBuffer, semantics);
                        }

                        indexBuffer = surface.indexBuffer;
                        if (indexBuffer) {
                            setIndexBuffer.call(gd, indexBuffer);

                            drawIndexed.call(gd, surface.primitive, surface.numIndices, surface.first);
                        } else {
                            //Utilities.log("" + surface.primitive + " ," + surface.numVertices + " ," + surface.first);
                            draw.call(gd, surface.primitive, surface.numVertices, surface.first);
                        }
                    }
                }

                n += 1;
            } while(n < numNodes);
        }
    };

    Scene.prototype.drawVisibleNodes = function (gd, globalTechniqueParameters, technique, renderUpdate) {
        this.drawNodesArray(this.visibleNodes, gd, globalTechniqueParameters, technique, renderUpdate);
    };

    //
    // clearMaterials
    //
    Scene.prototype.clearMaterials = function () {
        var onMaterialDestroyed = this.onMaterialDestroyed;
        var materials = this.materials;
        if (materials) {
            for (var p in materials) {
                if (materials.hasOwnProperty(p)) {
                    materials[p].reference.unsubscribeDestroyed(onMaterialDestroyed);
                }
            }
        }
        this.materials = {};
    };

    //
    // clearShapes
    //
    Scene.prototype.clearShapes = function () {
        var onGeometryDestroyed = this.onGeometryDestroyed;
        var shapes = this.shapes;
        if (shapes) {
            for (var p in shapes) {
                if (shapes.hasOwnProperty(p)) {
                    shapes[p].reference.unsubscribeDestroyed(onGeometryDestroyed);
                }
            }
        }
        this.shapes = {};
    };

    //
    // clearShapesVertexData
    //
    Scene.prototype.clearShapesVertexData = function () {
        var shapes = this.shapes;
        var shape;
        if (shapes) {
            for (var p in shapes) {
                if (shapes.hasOwnProperty(p)) {
                    shape = shapes[p];
                    delete shape.vertexData;
                    delete shape.indexData;
                    var surfaces = shape.surfaces;
                    if (surfaces) {
                        for (var s in surfaces) {
                            if (surfaces.hasOwnProperty(s)) {
                                var surface = surfaces[s];
                                delete surface.vertexData;
                                delete surface.indexData;
                            }
                        }
                    }
                }
            }
        }
    };

    //
    // clearRootNodes
    //
    Scene.prototype.clearRootNodes = function () {
        var rootNodes = this.rootNodes;
        if (rootNodes) {
            var rootLength = rootNodes.length;
            for (var rootIndex = 0; rootIndex < rootLength; rootIndex += 1) {
                rootNodes[rootIndex].destroy();
            }
        }
        this.rootNodes = [];
        this.rootNodesMap = {};
        this.dirtyRoots = {};
        this.nodesToUpdate = [];
        this.numNodesToUpdate = 0;
    };

    //
    // clear
    //
    Scene.prototype.clear = function () {
        this.effects = [];
        this.effectsMap = {};
        this.semantics = {};
        this.lights = {};
        this.globalLights = [];
        this.clearRootNodes();
        this.clearMaterials();
        this.clearShapes();
        this.staticSpatialMap.clear();
        this.dynamicSpatialMap.clear();
        this.frustumPlanes = [];
        this.animations = {};
        this.skeletons = {};
        this.extents = this.md.aabbBuildEmpty();
        this.visibleNodes = [];
        this.visibleRenderables = [];
        this.visibleLights = [];
        this.cameraAreaIndex = -1;
        this.cameraExtents = this.md.aabbBuildEmpty();
        this.visiblePortals = [];
        this.frameIndex = 0;
        this.queryCounter = 0;
        this.staticNodesChangeCounter = 0;
        this.testExtents = this.md.aabbBuildEmpty();
        this.externalNodesStack = [];
    };

    //
    // endLoading
    //
    Scene.prototype.endLoading = function (onload) {
        this.initializeNodes();
        this.initializeAreas();
        if (onload) {
            onload(this);
        }
    };

    //
    // initializeNodes
    //
    Scene.prototype.initializeNodes = function () {
        this.updateNodes();
        this.staticSpatialMap.finalize();
        this.updateExtents();
    };

    //
    // addAreaStaticNodes
    //
    Scene.prototype.addAreaStaticNodes = function () {
        var findAreaIndicesAABB = this.findAreaIndicesAABB;
        var findAreaIndex = this.findAreaIndex;
        var scene = this;

        var addAreasNode = function addAreasNodeFn(bspNodes, areas) {
            if (this.dynamic) {
                return;
            }

            if (this.hasRenderables() || (this.hasLightInstances() && this.worldExtents)) {
                var extents = this.worldExtents;
                var min0 = extents[0];
                var min1 = extents[1];
                var min2 = extents[2];
                var max0 = extents[3];
                var max1 = extents[4];
                var max2 = extents[5];
                var area, na;
                var cX, cY, cZ;
                if (!this.hasRenderables() && this.lightInstances.length === 1 && this.lightInstances[0].light.spot) {
                    var world = this.world;
                    cX = world[9];
                    cY = world[10];
                    cZ = world[11];
                } else {
                    cX = (min0 + max0) * 0.5;
                    cY = (min1 + max1) * 0.5;
                    cZ = (min2 + max2) * 0.5;
                }
                var areaIndex = findAreaIndex(bspNodes, cX, cY, cZ);
                if (areaIndex >= 0) {
                    area = areas[areaIndex];
                    area.nodes.push(this);

                    var overlappingAreas = scene.findOverlappingAreas(areaIndex, extents);
                    var numOverlappingAreas = overlappingAreas.length;
                    for (na = 0; na < numOverlappingAreas; na += 1) {
                        overlappingAreas[na].nodes.push(this);
                    }
                } else {
                    var areaFound = false;
                    var areaExtents;
                    for (; ;) {
                        var areaIndices = findAreaIndicesAABB(bspNodes, min0, min1, min2, max0, max1, max2);
                        var numAreaIndices = areaIndices.length;
                        if (0 < numAreaIndices) {
                            // 1st try: only attach to overlapping areas
                            na = 0;
                            do {
                                area = areas[areaIndices[na]];
                                areaExtents = area.extents;
                                if (areaExtents[0] <= max0 && areaExtents[1] <= max1 && areaExtents[2] <= max2 && areaExtents[3] >= min0 && areaExtents[4] >= min1 && areaExtents[5] >= min2) {
                                    area.nodes.push(this);
                                    areaFound = true;
                                }
                                na += 1;
                            } while(na < numAreaIndices);
                            if (!areaFound) {
                                // 2nd try: attach to any areas from bsp query
                                na = 0;
                                do {
                                    areas[areaIndices[na]].nodes.push(this);
                                    na += 1;
                                } while(na < numAreaIndices);
                            }
                            break;
                        } else {
                            // 3nd try: increase bounding box
                            var delta = Math.max((max0 - min0), (max1 - min1), (max2 - min2)) / 20;
                            min0 -= delta;
                            min1 -= delta;
                            min2 -= delta;
                            max0 += delta;
                            max1 += delta;
                            max2 += delta;
                        }
                    }
                }
            }
            var children = this.children;
            if (children) {
                var numChildren = children.length;
                for (var nc = 0; nc < numChildren; nc += 1) {
                    addAreasNode.call(children[nc], bspNodes, areas);
                }
            }
        };

        var rootNodes = this.rootNodes;
        var numRootNodes = rootNodes.length;
        var bspNodes = this.bspNodes;
        var areas = this.areas;
        for (var n = 0; n < numRootNodes; n += 1) {
            addAreasNode.call(rootNodes[n], bspNodes, areas);
        }
    };

    //
    // findOverlappingAreas
    //
    Scene.prototype.findOverlappingAreas = function (startAreaIndex, extents, avoidDisabled) {
        var area, portals, numPortals, n, portal, plane, d0, d1, d2, portalExtents, areaIndex, nextArea;
        var queryCounter = this.getQueryCounter();
        var areas = this.areas;
        var portalsStack = [];
        var numPortalsStack = 0;
        var overlappingAreas = [];
        var numOverlappingAreas = 0;

        var min0 = extents[0];
        var min1 = extents[1];
        var min2 = extents[2];
        var max0 = extents[3];
        var max1 = extents[4];
        var max2 = extents[5];

        area = areas[startAreaIndex];
        area.queryCounter = queryCounter;

        portals = area.portals;
        numPortals = portals.length;
        for (n = 0; n < numPortals; n += 1) {
            portal = portals[n];
            if (avoidDisabled && portal.disabled) {
                continue;
            }
            portal.queryCounter = queryCounter;

            portalExtents = portal.extents;
            if (portalExtents[0] < max0 && portalExtents[1] < max1 && portalExtents[2] < max2 && portalExtents[3] > min0 && portalExtents[4] > min1 && portalExtents[5] > min2) {
                plane = portal.plane;
                d0 = plane[0];
                d1 = plane[1];
                d2 = plane[2];
                if ((d0 * (d0 < 0 ? min0 : max0) + d1 * (d1 < 0 ? min1 : max1) + d2 * (d2 < 0 ? min2 : max2)) >= plane[3]) {
                    portalsStack[numPortalsStack] = portal;
                    numPortalsStack += 1;
                }
            }
        }

        while (0 < numPortalsStack) {
            numPortalsStack -= 1;
            portal = portalsStack[numPortalsStack];

            areaIndex = portal.area;
            area = areas[areaIndex];
            if (area.queryCounter !== queryCounter) {
                area.queryCounter = queryCounter;
                overlappingAreas[numOverlappingAreas] = area;
                numOverlappingAreas += 1;
            }

            portals = area.portals;
            numPortals = portals.length;
            for (n = 0; n < numPortals; n += 1) {
                portal = portals[n];
                if (avoidDisabled && portal.disabled) {
                    continue;
                }
                nextArea = portal.area;
                if (nextArea !== areaIndex && nextArea !== startAreaIndex && portal.queryCounter !== queryCounter) {
                    portal.queryCounter = queryCounter;

                    portalExtents = portal.extents;
                    if (portalExtents[0] < max0 && portalExtents[1] < max1 && portalExtents[2] < max2 && portalExtents[3] > min0 && portalExtents[4] > min1 && portalExtents[5] > min2) {
                        plane = portal.plane;
                        d0 = plane[0];
                        d1 = plane[1];
                        d2 = plane[2];
                        if ((d0 * (d0 < 0 ? min0 : max0) + d1 * (d1 < 0 ? min1 : max1) + d2 * (d2 < 0 ? min2 : max2)) >= plane[3]) {
                            portalsStack[numPortalsStack] = portal;
                            numPortalsStack += 1;
                        }
                    }
                }
            }
        }

        return overlappingAreas;
    };

    //
    // checkAreaDynamicNodes
    //
    Scene.prototype.checkAreaDynamicNodes = function () {
        var findAreaIndicesAABB = this.findAreaIndicesAABB;
        var dynamicSpatialMap = this.dynamicSpatialMap;
        var bspNodes = this.bspNodes;
        var areas = this.areas;

        var checkAreaNode = function checkAreaNodeFn() {
            if (this.dynamic && (this.hasRenderables() || (this.hasLightInstances() && this.worldExtents))) {
                var extents = this.worldExtents;
                var min0 = extents[0];
                var min1 = extents[1];
                var min2 = extents[2];
                var max0 = extents[3];
                var max1 = extents[4];
                var max2 = extents[5];
                var pad = false;
                var areaFound = false;
                var na;
                for (; ;) {
                    var areaIndices = findAreaIndicesAABB(bspNodes, min0, min1, min2, max0, max1, max2);
                    var numAreaIndices = areaIndices.length;
                    if (0 < numAreaIndices) {
                        na = 0;
                        do {
                            var area = areas[areaIndices[na]];
                            var areaExtent = area.extents;
                            if (areaExtent[0] <= max0 && areaExtent[1] <= max1 && areaExtent[2] <= max2 && areaExtent[3] >= min0 && areaExtent[4] >= min1 && areaExtent[5] >= min2) {
                                areaFound = true;
                                break;
                            }
                            na += 1;
                        } while(na < numAreaIndices);
                    }
                    if (areaFound) {
                        break;
                    }
                    var delta = Math.max((max0 - min0), (max1 - min1), (max2 - min2)) / 20;
                    min0 -= delta;
                    min1 -= delta;
                    min2 -= delta;
                    max0 += delta;
                    max1 += delta;
                    max2 += delta;
                    pad = true;
                }
                if (pad) {
                    extents[0] = min0;
                    extents[1] = min1;
                    extents[2] = min2;
                    extents[3] = max0;
                    extents[4] = max1;
                    extents[5] = max2;
                    dynamicSpatialMap.update(this, extents);
                }
            }
            var children = this.children;
            if (children) {
                var numChildren = children.length;
                for (var nc = 0; nc < numChildren; nc += 1) {
                    checkAreaNode.call(children[nc]);
                }
            }
        };

        var rootNodes = this.rootNodes;
        var numRootNodes = rootNodes.length;
        for (var n = 0; n < numRootNodes; n += 1) {
            checkAreaNode.call(rootNodes[n]);
        }
    };

    //
    // initializeAreas
    //
    Scene.prototype.initializeAreas = function () {
        var areas = this.areas;
        if (areas) {
            var numAreas = areas.length;
            var n, area, target, extents, areaExtents;
            for (n = 0; n < numAreas; n += 1) {
                area = areas[n];
                target = area.target;
                area.nodes = [];
                extents = target.calculateHierarchyWorldExtents();
                if (extents) {
                    areaExtents = area.extents;
                    areaExtents[0] = (extents[0] < areaExtents[0] ? extents[0] : areaExtents[0]);
                    areaExtents[1] = (extents[1] < areaExtents[1] ? extents[1] : areaExtents[1]);
                    areaExtents[2] = (extents[2] < areaExtents[2] ? extents[2] : areaExtents[2]);
                    areaExtents[3] = (extents[3] > areaExtents[3] ? extents[3] : areaExtents[3]);
                    areaExtents[4] = (extents[4] > areaExtents[4] ? extents[4] : areaExtents[4]);
                    areaExtents[5] = (extents[5] > areaExtents[5] ? extents[5] : areaExtents[5]);
                }
            }

            this.addAreaStaticNodes();

            this.checkAreaDynamicNodes();

            for (n = 0; n < numAreas; n += 1) {
                area = areas[n];
                area.numStaticNodes = area.nodes.length;
            }
        }
        this.areaInitalizeStaticNodesChangeCounter = this.staticNodesChangeCounter;
    };

    //
    // createMaterial
    //
    Scene.prototype.createMaterial = function (materialName, fileMaterial, effectName, fileEffects, fileImages, graphicsDevice) {
        var materials = this.materials;

        var material = Material.create(graphicsDevice);
        var param, filename, effectType, p;
        var fileEffectMeta;

        if (fileEffects) {
            var fileEffect = fileEffects[effectName];
            if (fileEffect) {
                var effectParameters = fileEffect.parameters;
                for (p in effectParameters) {
                    if (effectParameters.hasOwnProperty(p)) {
                        param = effectParameters[p];
                        if (typeof param === 'string') {
                            if (fileImages) {
                                filename = fileImages[param] || param;
                            } else {
                                filename = param;
                            }

                            if (!material.texturesNames) {
                                material.texturesNames = {};
                            }
                            material.texturesNames[p] = filename;
                            material.techniqueParameters[p] = null;
                        } else {
                            material.techniqueParameters[p] = param;
                        }
                    }
                }
                effectType = fileEffect.type;
                fileEffectMeta = fileEffect.meta;
            } else {
                effectType = effectName;
            }
        } else {
            effectType = effectName;
        }

        var materialParameters = fileMaterial.parameters;
        for (p in materialParameters) {
            if (materialParameters.hasOwnProperty(p)) {
                param = materialParameters[p];
                if (typeof param === 'string') {
                    if (fileImages) {
                        filename = fileImages[param] || param;
                    } else {
                        filename = param;
                    }

                    if (!material.texturesNames) {
                        material.texturesNames = {};
                    }
                    material.texturesNames[p] = filename;

                    material.techniqueParameters[p] = null;
                } else {
                    material.techniqueParameters[p] = param;
                }
            }
        }

        material.effectName = effectType;

        var fileMaterialMeta = fileMaterial.meta;
        if (fileMaterialMeta) {
            if (fileEffectMeta) {
                for (p in fileEffectMeta) {
                    if (fileEffectMeta.hasOwnProperty(p) && !fileMaterialMeta.hasOwnProperty(p)) {
                        fileMaterialMeta[p] = fileEffectMeta[p];
                    }
                }
            }
            material.meta = fileMaterialMeta;
        } else if (fileEffectMeta) {
            material.meta = fileEffectMeta;
        }

        materials[materialName] = material;
        material.name = materialName;
        material.reference.subscribeDestroyed(this.onMaterialDestroyed);

        return material;
    };

    //
    // loadMaterials
    //
    Scene.prototype.loadMaterials = function (loadParams) {
        var sceneData = loadParams.data;
        var gd = loadParams.graphicsDevice;
        var textureManager = loadParams.textureManager;
        var createMaterial = this.createMaterial;

        if (!loadParams.append) {
            this.effects = [];
            this.effectsMap = {};
            this.clearMaterials();
        }

        // Import materials
        var fileMaterials = sceneData.materials;
        if (fileMaterials) {
            var fileImages = sceneData.images;
            var fileEffects = sceneData.effects;
            var materials = this.materials;
            for (var m in fileMaterials) {
                if (fileMaterials.hasOwnProperty(m) && !materials[m]) {
                    var fileMaterial = fileMaterials[m];
                    var effectName = (fileMaterial.effect || "default");
                    createMaterial.call(this, m, fileMaterial, effectName, fileEffects, fileImages, gd, textureManager);
                }
            }
        }
    };

    //
    // loadSkeletons
    //
    Scene.prototype.loadSkeletons = function (loadParams) {
        var sceneData = loadParams.data;
        var fileSkeletons = sceneData.skeletons;

        var md = this.md;
        var m43Build = md.m43Build;

        var invLTM, bindPose;

        for (var s in fileSkeletons) {
            if (fileSkeletons.hasOwnProperty(s)) {
                var skeleton = fileSkeletons[s];

                var numJoints = skeleton.numNodes;
                var invLTMs = skeleton.invBoneLTMs;
                var bindPoses = skeleton.bindPoses;

                for (var b = 0; b < numJoints; b += 1) {
                    invLTM = invLTMs[b];
                    bindPose = bindPoses[b];

                    invLTMs[b] = m43Build.apply(md, invLTM);
                    bindPoses[b] = m43Build.apply(md, bindPose);
                }

                if (loadParams.skeletonNamePrefix) {
                    s = loadParams.skeletonNamePrefix + s;
                }

                this.skeletons[s] = skeleton;
            }
        }
    };

    //
    // loadShape
    //
    Scene.prototype.loadShape = function (shapeName, fileShapeName, loadParams) {
        var shape = this.shapes[shapeName];

        if (!shape) {
            var cachedSemantics = this.semantics;

            var sceneData = loadParams.data;
            var gd = loadParams.graphicsDevice;
            var keepVertexData = loadParams.keepVertexData;
            var fileShapes = sceneData.geometries;
            var fileShape = fileShapes[fileShapeName];
            var sources = fileShape.sources;
            var inputs = fileShape.inputs;
            var skeletonName = loadParams.skeletonNamePrefix ? loadParams.skeletonNamePrefix + fileShape.skeleton : fileShape.skeleton;

            shape = Geometry.create();

            if (skeletonName) {
                var skeleton = this.skeletons[skeletonName];
                if (skeleton) {
                    shape.skeleton = skeleton;
                    shape.type = "skinned";
                } else {
                    // Failed to load skeleton so just draw bind pose
                    shape.type = "rigid";
                }
            } else {
                shape.type = "rigid";
            }

            if (gd) {
                // First calculate data about the vertex streams
                var offset, stride;
                var destStride;
                var destFormat;
                var maxOffset = 0;
                var vertexSources = [];

                var isUByte4Range = function isUByte4RangeFn(minVal, maxVal) {
                    return (minVal >= 0) && (maxVal <= 255) && (maxVal > 1);
                };

                var areInRange = function areInRangeFn(minVals, maxVals, isRangeFn) {
                    var numVals = minVals.length;
                    if (maxVals.length !== numVals) {
                        return false;
                    }
                    for (var valIdx = 0; valIdx < numVals; valIdx += 1) {
                        if (!isRangeFn(minVals[valIdx], maxVals[valIdx])) {
                            return false;
                        }
                    }
                    return true;
                };

                var formatMap = loadParams.vertexFormatMap || {};

                for (var input in inputs) {
                    if (inputs.hasOwnProperty(input)) {
                        if (gd['SEMANTIC_' + input] === undefined) {
                            debug.log("Unknown semantic: " + input);
                            continue;
                        }

                        var fileInput = inputs[input];
                        offset = fileInput.offset;
                        if (offset > maxOffset) {
                            maxOffset = offset;
                        }
                        var fileSource = sources[fileInput.source];
                        var fileSourceStride = fileSource.stride;

                        // If the caller gave a preferred format, try
                        // to use it.
                        destFormat = formatMap[input];
                        destStride = fileSourceStride;

                        if (destFormat) {
                            if (destFormat.indexOf("4")) {
                                destStride = 4;
                            } else if (destFormat.indexOf("3")) {
                                destStride = 3;
                            } else if (destFormat.indexOf("2")) {
                                destStride = 2;
                            } else if (destFormat.indexOf("1")) {
                                destStride = 1;
                            } else {
                                destFormat = null;
                            }
                        }

                        if (!destFormat) {
                            if (input === "BLENDINDICES" || input === "BLENDINDICES0") {
                                if (fileSourceStride === 4 && areInRange(fileSource.min, fileSource.max, isUByte4Range)) {
                                    destFormat = "UBYTE4";
                                }
                            }
                            // if (input == "NORMAL" || input == "NORMAL0")
                            // {
                            //     if (fileSourceStride == 3)
                            //     {
                            //         Check range is within [-1,1]
                            //         destFormat = "BYTE";
                            //         destFormatNormalized = true;
                            //         destStride = 4;
                            //     }
                            // }
                        }

                        if (!destFormat) {
                            destFormat = "FLOAT" + fileSourceStride;
                        }

                        vertexSources.push({
                            semantic: input,
                            offset: offset,
                            data: fileSource.data,
                            stride: fileSourceStride,
                            destFormat: destFormat,
                            destStride: destStride
                        });
                    }
                }
                var indicesPerVertex = (maxOffset + 1);

                if (0 < maxOffset) {
                    var vertexSourcesCompare = function (vertexSourceA, vertexSourceB) {
                        if (vertexSourceA.offset === vertexSourceB.offset) {
                            var semanticA = vertexSourceA.semantic;
                            if (typeof semanticA === 'string') {
                                semanticA = gd['SEMANTIC_' + semanticA];
                            }
                            var semanticB = vertexSourceB.semantic;
                            if (typeof semanticB === 'string') {
                                semanticB = gd['SEMANTIC_' + semanticB];
                            }
                            return (semanticA - semanticB);
                        } else {
                            return (vertexSourceA.offset - vertexSourceB.offset);
                        }
                    };
                    vertexSources.sort(vertexSourcesCompare);
                }

                var numVertexSources = vertexSources.length;
                var semanticsNames = [];
                var attributes = [];
                var useFloatArray = (this.float32ArrayConstructor ? true : false);
                var numValuesPerVertex = 0;
                var vs, vertexSource;
                for (vs = 0; vs < numVertexSources; vs += 1) {
                    vertexSource = vertexSources[vs];
                    semanticsNames[vs] = vertexSource.semantic;
                    destFormat = vertexSource.destFormat;
                    if (useFloatArray) {
                        if (typeof destFormat === "string") {
                            if (destFormat[0] !== "F") {
                                useFloatArray = false;
                            }
                        } else {
                            if (destFormat !== gd.VERTEXFORMAT_FLOAT1 && destFormat !== gd.VERTEXFORMAT_FLOAT2 && destFormat !== gd.VERTEXFORMAT_FLOAT3 && destFormat !== gd.VERTEXFORMAT_FLOAT4) {
                                useFloatArray = false;
                            }
                        }
                    }
                    attributes[vs] = destFormat;
                    numValuesPerVertex += vertexSource.stride;
                }

                // Now parse the surfaces to work out primitive types and the total vertex count
                var numVertices, totalNumVertices = 0;
                var noSurfaces = false;
                var surfaces = fileShape.surfaces;
                if (!surfaces) {
                    noSurfaces = true;
                    surfaces = {
                        singleSurface: {
                            triangles: fileShape.triangles,
                            lines: fileShape.lines,
                            numPrimitives: fileShape.numPrimitives
                        }
                    };
                }

                var surface;
                var destSurface;
                var faces;
                var s;

                for (s in surfaces) {
                    if (surfaces.hasOwnProperty(s)) {
                        surface = surfaces[s];
                        destSurface = {};
                        shape.surfaces[s] = destSurface;

                        faces = surface.triangles;
                        var primitive, vertexPerPrimitive;
                        if (faces) {
                            primitive = gd.PRIMITIVE_TRIANGLES;
                            vertexPerPrimitive = 3;
                        } else {
                            faces = surface.lines;
                            if (faces) {
                                primitive = gd.PRIMITIVE_LINES;
                                vertexPerPrimitive = 2;
                            }
                        }
                        destSurface.primitive = primitive;
                        destSurface.faces = faces;

                        if (faces) {
                            if (1 < indicesPerVertex) {
                                numVertices = (surface.numPrimitives * vertexPerPrimitive);
                                destSurface.numVertices = numVertices;
                            } else {
                                numVertices = (vertexSources[0].data.length / vertexSources[0].stride);
                                if (numVertices > faces.length) {
                                    numVertices = faces.length;
                                }
                                destSurface.numVertices = numVertices;
                            }
                        }
                    }
                }

                // For cases where > 1-index per vertex we process it to create 1-index per vertex from data
                var updateSingleIndexTables = function updateSingleIndexTablesFn(surface, indicesPerVertex, verticesAsIndexLists, verticesAsIndexListTable) {
                    var faces = surface.faces;
                    var numVerts = faces.length / indicesPerVertex;

                    var singleIndices = new Array(numVerts);
                    var thisVert = new Array(indicesPerVertex);

                    var vertIdx = 0;
                    var srcIdx = 0;
                    var nextSrcIdx = indicesPerVertex;
                    var numUniqueVertIndex = verticesAsIndexLists.length;
                    var numUniqueVertices = ((numUniqueVertIndex / indicesPerVertex) | 0);
                    var n;

                    while (srcIdx < faces.length) {
                        n = 0;
                        do {
                            thisVert[n] = faces[srcIdx];
                            n += 1;
                            srcIdx += 1;
                        } while(srcIdx < nextSrcIdx);

                        var thisVertHash = thisVert.join(",");

                        var thisVertIndex = verticesAsIndexListTable[thisVertHash];
                        if (thisVertIndex === undefined) {
                            // New index - add to tables
                            thisVertIndex = numUniqueVertices;
                            verticesAsIndexListTable[thisVertHash] = thisVertIndex;
                            numUniqueVertices += 1;

                            // Copy indices
                            n = 0;
                            do {
                                verticesAsIndexLists[numUniqueVertIndex] = thisVert[n];
                                numUniqueVertIndex += 1;
                                n += 1;
                            } while(n < indicesPerVertex);
                        }

                        singleIndices[vertIdx] = thisVertIndex;

                        nextSrcIdx += indicesPerVertex;
                        vertIdx += 1;
                    }

                    surface.faces = singleIndices;
                };

                if (indicesPerVertex > 1) {
                    // [ [a,b,c], [d,e,f], ... ]
                    var verticesAsIndexLists = [];
                    var verticesAsIndexListTable = {};

                    var shapeSurfaces = shape.surfaces;
                    for (s in shapeSurfaces) {
                        if (shapeSurfaces.hasOwnProperty(s)) {
                            var shapeSurface = shapeSurfaces[s];
                            updateSingleIndexTables(shapeSurface, indicesPerVertex, verticesAsIndexLists, verticesAsIndexListTable);
                        }
                    }

                    verticesAsIndexListTable = null;

                    // recalc totalNumVertices
                    totalNumVertices = ((verticesAsIndexLists.length / indicesPerVertex) | 0);

                    for (vs = 0; vs < numVertexSources; vs += 1) {
                        vertexSource = vertexSources[vs];
                        var thisSourceOffset = vertexSource.offset;
                        var thisSourceStride = vertexSource.stride;
                        var thisSourceData = vertexSource.data;

                        var newData = new Array(thisSourceStride * totalNumVertices);

                        // For each entry in index list
                        var vertIdx = 0;
                        var vertIdxOffset = thisSourceOffset;
                        while (vertIdx < totalNumVertices) {
                            var newVBIdx = thisSourceStride * vertIdx;
                            var oldVBIdx = thisSourceStride * verticesAsIndexLists[vertIdxOffset];

                            for (var attrIdx = 0; attrIdx < thisSourceStride; attrIdx += 1) {
                                newData[newVBIdx + attrIdx] = thisSourceData[oldVBIdx + attrIdx];
                            }

                            vertIdx += 1;
                            vertIdxOffset += indicesPerVertex;
                        }

                        vertexSource.data = newData;
                        vertexSource.offset = 0;
                    }

                    verticesAsIndexLists.length = 0;
                    verticesAsIndexLists = null;

                    indicesPerVertex = 1;
                }

                debug.assert(indicesPerVertex === 1);

                totalNumVertices = vertexSources[0].data.length / vertexSources[0].stride;

                var vertexBufferManager = (loadParams.vertexBufferManager || this.vertexBufferManager);
                if (!vertexBufferManager) {
                    vertexBufferManager = VertexBufferManager.create(gd);
                    this.vertexBufferManager = vertexBufferManager;
                }

                var indexBufferManager = (loadParams.indexBufferManager || this.indexBufferManager);
                if (!indexBufferManager) {
                    indexBufferManager = IndexBufferManager.create(gd);
                    this.indexBufferManager = indexBufferManager;
                }

                var baseIndex;
                var vertexBuffer = null;
                var vertexBufferAllocation = vertexBufferManager.allocate(totalNumVertices, attributes);
                vertexBuffer = vertexBufferAllocation.vertexBuffer;
                if (!vertexBuffer) {
                    return undefined;
                }

                shape.vertexBuffer = vertexBuffer;
                shape.vertexBufferManager = vertexBufferManager;
                shape.vertexBufferAllocation = vertexBufferAllocation;

                baseIndex = vertexBufferAllocation.baseIndex;

                var indexBufferAllocation;
                var t, index, nextIndex;

                //
                // We no have the simple case of each index maps to one vertex so create one vertex buffer and fill in.
                //
                var vertexData = (useFloatArray ? new this.float32ArrayConstructor(totalNumVertices * numValuesPerVertex) : new Array(totalNumVertices * numValuesPerVertex));
                var vertexDataCount = 0;
                for (t = 0; t < totalNumVertices; t += 1) {
                    vs = 0;
                    do {
                        vertexSource = vertexSources[vs];
                        var sourceData = vertexSource.data;
                        stride = vertexSource.stride;
                        index = t * stride;
                        nextIndex = (index + stride);
                        destStride = vertexSource.destStride;
                        do {
                            vertexData[vertexDataCount] = sourceData[index];
                            vertexDataCount += 1;
                            index += 1;
                        } while(index < nextIndex);

                        while (stride < destStride) {
                            vertexData[vertexDataCount] = 0;
                            vertexDataCount += 1;
                            destStride -= 1;
                        }

                        vs += 1;
                    } while(vs < numVertexSources);
                }
                vertexBuffer.setData(vertexData, baseIndex, totalNumVertices);

                // Count total num indices
                var isSequentialIndices = function isSequentialIndicesFn(indices, numIndices) {
                    var baseIndex = indices[0];
                    var n;
                    for (n = 1; n < numIndices; n += 1) {
                        if (indices[n] !== (baseIndex + n)) {
                            return false;
                        }
                    }
                    return true;
                };

                var totalNumIndices = 0;
                var numIndices;

                for (s in surfaces) {
                    if (surfaces.hasOwnProperty(s)) {
                        destSurface = shape.surfaces[s];
                        faces = destSurface.faces;
                        if (faces) {
                            numIndices = faces.length;
                            if (!isSequentialIndices(faces, numIndices)) {
                                totalNumIndices += numIndices;
                            }
                        }
                    }
                }

                var indexBuffer, indexBufferData, indexBufferBaseIndex, indexBufferOffset, maxIndex;
                if (0 < totalNumIndices) {
                    maxIndex = (baseIndex + totalNumVertices - 1);

                    indexBufferAllocation = indexBufferManager.allocate(totalNumIndices, (maxIndex < 65536 ? 'USHORT' : 'UINT'));
                    indexBuffer = indexBufferAllocation.indexBuffer;
                    if (!indexBuffer) {
                        return undefined;
                    }

                    shape.indexBufferManager = indexBufferManager;
                    shape.indexBufferAllocation = indexBufferAllocation;

                    if (maxIndex < 65536 && this.uint16ArrayConstructor) {
                        indexBufferData = new this.uint16ArrayConstructor(totalNumIndices);
                    } else if (this.uint32ArrayConstructor) {
                        indexBufferData = new this.uint32ArrayConstructor(totalNumIndices);
                    } else {
                        indexBufferData = new Array(totalNumIndices);
                    }

                    indexBufferBaseIndex = indexBufferAllocation.baseIndex;
                    indexBufferOffset = 0;
                }

                for (s in surfaces) {
                    if (surfaces.hasOwnProperty(s)) {
                        destSurface = shape.surfaces[s];

                        faces = destSurface.faces;
                        delete destSurface.faces;

                        if (faces) {
                            // Vertices already de-indexed (1 index per vert)
                            numIndices = faces.length;

                            if (!isSequentialIndices(faces, numIndices)) {
                                destSurface.indexBuffer = indexBuffer;
                                destSurface.numIndices = numIndices;
                                destSurface.first = (indexBufferBaseIndex + indexBufferOffset);
                                destSurface.numVertices = totalNumVertices;

                                if (baseIndex) {
                                    for (t = 0; t < numIndices; t += 1) {
                                        indexBufferData[indexBufferOffset] = (baseIndex + faces[t]);
                                        indexBufferOffset += 1;
                                    }
                                } else {
                                    for (t = 0; t < numIndices; t += 1) {
                                        indexBufferData[indexBufferOffset] = faces[t];
                                        indexBufferOffset += 1;
                                    }
                                }

                                if (keepVertexData) {
                                    if (maxIndex < 65536 && this.uint16ArrayConstructor) {
                                        destSurface.indexData = new this.uint16ArrayConstructor(faces);
                                    } else if (this.uint32ArrayConstructor) {
                                        destSurface.indexData = new this.uint32ArrayConstructor(faces);
                                    } else {
                                        destSurface.indexData = faces;
                                    }
                                }
                            } else {
                                destSurface.first = (baseIndex + faces[0]);
                            }

                            faces = null;

                            if (keepVertexData) {
                                destSurface.vertexData = vertexData;
                            }
                        } else {
                            delete shape.surfaces[s];
                        }
                    }
                }

                if (indexBuffer) {
                    indexBuffer.setData(indexBufferData, indexBufferBaseIndex, totalNumIndices);
                    indexBufferData = null;
                }

                //Utilities.log("Buffers creation time: " + (TurbulenzEngine.time - startTime));
                var semanticsHash = semanticsNames.join();
                var semantics = cachedSemantics[semanticsHash];
                if (!semantics) {
                    semantics = gd.createSemantics(semanticsNames);
                    cachedSemantics[semanticsHash] = semantics;
                }
                shape.semantics = semantics;

                if (noSurfaces) {
                    // TODO: could remove this and always have surfaces
                    surface = shape.surfaces.singleSurface;

                    if (surface) {
                        shape.primitive = surface.primitive;
                        if (keepVertexData) {
                            shape.vertexData = surface.vertexData;
                        }

                        shape.first = surface.first;
                        shape.numVertices = surface.numVertices;

                        if (surface.indexBuffer) {
                            shape.indexBuffer = surface.indexBuffer;
                            shape.numIndices = surface.numIndices;
                            if (keepVertexData) {
                                shape.indexData = surface.indexData;
                            }
                        }
                    }

                    delete shape.surfaces;
                }
            }

            if (inputs.POSITION) {
                var positions = sources[inputs.POSITION.source];
                var minPos = positions.min;
                var maxPos = positions.max;
                if (minPos && maxPos) {
                    var min0 = minPos[0];
                    var min1 = minPos[1];
                    var min2 = minPos[2];
                    var max0 = maxPos[0];
                    var max1 = maxPos[1];
                    var max2 = maxPos[2];

                    var halfExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(3) : new Array(3));
                    shape.halfExtents = halfExtents;
                    if (min0 !== -max0 || min1 !== -max1 || min2 !== -max2) {
                        var center = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(3) : new Array(3));
                        shape.center = center;
                        center[0] = (min0 + max0) * 0.5;
                        center[1] = (min1 + max1) * 0.5;
                        center[2] = (min2 + max2) * 0.5;
                        halfExtents[0] = (max0 - center[0]);
                        halfExtents[1] = (max1 - center[1]);
                        halfExtents[2] = (max2 - center[2]);
                    } else {
                        halfExtents[0] = (max0 - min0) * 0.5;
                        halfExtents[1] = (max1 - min1) * 0.5;
                        halfExtents[2] = (max2 - min2) * 0.5;
                    }
                }
                //else
                //{
                //TODO: add warning that we have no extents information
                //}
            }

            this.shapes[shapeName] = shape;
            shape.name = shapeName;
            shape.reference.subscribeDestroyed(this.onGeometryDestroyed);
        } else {
            throw "Geometry '" + shapeName + "' already exists in the scene";
        }
        return shape;
    };

    Scene.prototype.streamShapes = function (loadParams, postLoadFn) {
        // Firstly build an array listing all the shapes we need to load
        var yieldFn = loadParams.yieldFn;
        var scene = this;
        var shapesNamePrefix = loadParams.shapesNamePrefix;
        var sceneData = loadParams.data;
        var fileShapes = sceneData.geometries;
        var loadCustomShapeFn = loadParams.loadCustomShapeFn;

        var shapesToLoad = [];
        var customShapesToLoad = [];

        for (var fileShapeName in fileShapes) {
            if (fileShapes.hasOwnProperty(fileShapeName)) {
                if (shapesToLoad[fileShapeName] || customShapesToLoad[fileShapeName]) {
                    throw "Multiple geometries named '" + fileShapeName + "'";
                }

                var fileShape = fileShapes[fileShapeName];
                if (fileShape.meta && fileShape.meta.graphics) {
                    if (fileShape.meta.custom) {
                        customShapesToLoad.push(fileShapeName);
                    } else {
                        shapesToLoad.push(fileShapeName);
                    }
                }
            }
        }

        var sceneLoadNextShape = function sceneLoadNextShapeFn() {
            var nextShape = shapesToLoad.pop();

            var shapeName = (shapesNamePrefix ? (shapesNamePrefix + "-" + nextShape) : nextShape);
            scene.loadShape(shapeName, nextShape, loadParams);

            if (shapesToLoad.length) {
                yieldFn(sceneLoadNextShape);
            } else {
                yieldFn(postLoadFn);
            }
        };

        var sceneLoadNextCustomShape = function sceneLoadNextCustomShapeFn() {
            var nextShape = customShapesToLoad.pop();

            var shapeName = (shapesNamePrefix ? (shapesNamePrefix + "-" + nextShape) : nextShape);
            loadCustomShapeFn.call(scene, shapeName, nextShape, loadParams);

            if (customShapesToLoad.length) {
                yieldFn(sceneLoadNextCustomShape);
            } else if (shapesToLoad.length) {
                yieldFn(sceneLoadNextShape);
            } else {
                yieldFn(postLoadFn);
            }
        };

        if (customShapesToLoad.length) {
            yieldFn(sceneLoadNextCustomShape);
        } else if (shapesToLoad.length) {
            yieldFn(sceneLoadNextShape);
        } else {
            yieldFn(postLoadFn);
        }
    };

    //
    // Load lights
    //
    Scene.prototype.loadLights = function (loadParams) {
        var sceneData = loadParams.data;
        var textureManager = loadParams.textureManager;

        if (!loadParams.append) {
            this.lights = {};
            this.globalLights = [];
        }

        var fileLights = sceneData.lights;
        var lights = this.lights;
        var globalLights = this.globalLights;
        var materials = this.materials;
        var beget = Utilities.beget;

        var md = loadParams.mathDevice;
        var v3Build = md.v3Build;

        for (var l in fileLights) {
            if (fileLights.hasOwnProperty(l) && !lights[l]) {
                var fileLight = fileLights[l];

                // convert to create parameters
                var lightParams = beget(fileLight);

                var type = fileLight.type;
                if (type === 'directional') {
                    lightParams.directional = true;
                } else if (type === 'spot') {
                    lightParams.spot = true;
                } else if (type === 'ambient') {
                    lightParams.ambient = true;
                } else {
                    lightParams.point = true;
                }

                // Convert to MathDevice objects
                lightParams.color = fileLight.color && v3Build.apply(md, fileLight.color);

                lightParams.origin = fileLight.origin && v3Build.apply(md, fileLight.origin);
                lightParams.center = fileLight.center && v3Build.apply(md, fileLight.center);
                lightParams.target = fileLight.target && v3Build.apply(md, fileLight.target);
                lightParams.right = fileLight.right && v3Build.apply(md, fileLight.right);
                lightParams.up = fileLight.up && v3Build.apply(md, fileLight.up);
                lightParams.start = fileLight.start && v3Build.apply(md, fileLight.start);
                lightParams.end = fileLight.end && v3Build.apply(md, fileLight.end);
                lightParams.direction = fileLight.direction && v3Build.apply(md, fileLight.direction);

                lightParams.halfExtents = fileLight.halfextents && v3Build.apply(md, fileLight.halfextents);

                var materialName = fileLight.material;
                if (materialName) {
                    var material = materials[materialName];
                    if (material) {
                        lightParams.material = material;

                        if (material.effectName) {
                            delete material.effectName;
                            material.loadTextures(textureManager);
                        }
                    }
                }

                var light = Light.create(lightParams);
                lights[l] = light;
                if (light.isGlobal()) {
                    globalLights.push(light);
                }
            }
        }
    };

    //
    // loadNodes
    //
    Scene.prototype.loadNodes = function (loadParams) {
        var sceneData = loadParams.data;
        var gd = loadParams.graphicsDevice;
        var textureManager = loadParams.textureManager;
        var effectManager = loadParams.effectManager;
        var baseScene = loadParams.baseScene;
        var keepCameras = loadParams.keepCameras;
        var keepLights = loadParams.keepLights;
        var disableNodes = loadParams.disabled;

        if (!loadParams.append) {
            this.clearRootNodes();
            this.staticSpatialMap.clear();
            this.dynamicSpatialMap.clear();
        }

        var loadCustomGeometryInstanceFn = loadParams.loadCustomGeometryInstanceFn;

        var md = this.md;
        var m43Build = md.m43Build;
        var materials = this.materials;
        var lights = this.lights;
        var currentScene = this;

        var baseMaterials;
        if (baseScene) {
            baseMaterials = baseScene.materials;
        }
        var baseMatrix = loadParams.baseMatrix;
        var nodesNamePrefix = loadParams.nodesNamePrefix;
        var shapesNamePrefix = loadParams.shapesNamePrefix;

        var copyNode = function copyNodeFn(nodeName, parentNodePath, baseNode, materialSkin) {
            var nodePath = parentNodePath ? (parentNodePath + "/" + nodeName) : nodeName;

            var node = SceneNode.create({
                name: nodeName,
                local: this.matrix && m43Build.apply(md, this.matrix),
                dynamic: this.dynamic || baseNode.dynamic || loadParams.dynamic
            });

            var effect;

            var customgeometryinstance = this.customgeometryinstances;
            if (customgeometryinstance && loadCustomGeometryInstanceFn) {
                for (var ci in customgeometryinstance) {
                    if (customgeometryinstance.hasOwnProperty(ci)) {
                        var fileCustomGeometryInstance = customgeometryinstance[ci];
                        var customGeometryInstance = loadCustomGeometryInstanceFn.call(currentScene, fileCustomGeometryInstance, loadParams);

                        if (customGeometryInstance) {
                            node.addRenderable(customGeometryInstance);
                        }
                    }
                }
            }

            var geometryinstances = this.geometryinstances;
            if (geometryinstances) {
                for (var gi in geometryinstances) {
                    if (geometryinstances.hasOwnProperty(gi)) {
                        var fileGeometryInstance = geometryinstances[gi];
                        var fileShapeName = fileGeometryInstance.geometry;
                        var shapeName = (shapesNamePrefix ? (shapesNamePrefix + "-" + fileShapeName) : fileShapeName);

                        // If the geometry has already been loaded,
                        // use that, otherwise attempt to load it from
                        // the current set of parameters.
                        var nodeShape = currentScene.shapes[shapeName];
                        if (!nodeShape) {
                            nodeShape = currentScene.loadShape(shapeName, fileShapeName, loadParams);
                        }

                        if (gd) {
                            var sharedMaterialName = fileGeometryInstance.material;
                            if (materialSkin && sceneData.skins) {
                                var skin = sceneData.skins[materialSkin];
                                if (skin) {
                                    var newMaterialName = skin[sharedMaterialName];
                                    if (newMaterialName) {
                                        sharedMaterialName = newMaterialName;
                                    }
                                }
                            }
                            var sharedMaterial = materials[sharedMaterialName];
                            if (!sharedMaterial) {
                                if (baseMaterials) {
                                    sharedMaterial = baseMaterials[sharedMaterialName];
                                }

                                if (!sharedMaterial) {
                                    //Utilities.log("Unknown material '" + sharedMaterialName + "'");
                                    return undefined;
                                }
                                materials[sharedMaterialName] = sharedMaterial;
                                sharedMaterial.name = sharedMaterialName;
                                sharedMaterial.reference.subscribeDestroyed(currentScene.onMaterialDestroyed);
                            }
                            effect = sharedMaterial.effect;
                            if (!effect) {
                                // Load the textures since if the effect is undefined then scene.loadMaterial
                                // has not yet been called for this material
                                sharedMaterial.loadTextures(textureManager);
                                var effectName = sharedMaterial.effectName;
                                delete sharedMaterial.effectName;
                                effect = effectManager.get(effectName);
                                if (effect) {
                                    effect.prepareMaterial(sharedMaterial);
                                }
                            }

                            var surfaces = nodeShape.surfaces;
                            var surface = (surfaces ? surfaces[fileGeometryInstance.surface] : nodeShape);

                            var geometryInstance = GeometryInstance.create(nodeShape, surface, sharedMaterial);
                            node.addRenderable(geometryInstance);

                            if (fileGeometryInstance.disabled) {
                                geometryInstance.disabled = true;
                            }
                        } else {
                            // TODO: TSC complains about this,
                            // apparenty for good reason.
                            node.addRenderable(GeometryInstance.create(nodeShape, null, null));
                        }
                    }
                }
            }

            if (this.camera) {
                if (keepCameras) {
                    node.camera = this.camera;
                }
            }

            // Check for any instances of lights attached to the node
            var fileLightInstances = this.lightinstances;
            if (fileLightInstances && keepLights) {
                for (var li in fileLightInstances) {
                    if (fileLightInstances.hasOwnProperty(li)) {
                        var fileLightInstance = fileLightInstances[li];
                        var light = lights[fileLightInstance.light];
                        if (light && !light.global) {
                            var lightInstance = LightInstance.create(light);
                            node.addLightInstance(lightInstance);
                            if (fileLightInstance.disabled) {
                                lightInstance.disabled = true;
                            }
                        }
                    }
                }
            }

            if (this.reference) {
                alert("Found unresolved node reference during scene loading");
            }

            if (this.kinematic || baseNode.kinematic) {
                node.kinematic = true;
            }

            if ((this.disabled || baseNode.disabled) && (disableNodes !== false)) {
                node.disabled = true;
            }

            var fileChildren = this.nodes;

            if (fileChildren) {
                for (var c in fileChildren) {
                    if (fileChildren.hasOwnProperty(c)) {
                        if (!node.findChild(c)) {
                            var child = copyNode.call(fileChildren[c], c, nodePath, node, this.skin || materialSkin);
                            if (child) {
                                node.addChild(child);
                            }
                        }
                    }
                }
            }

            return node;
        };

        var fileNodes = sceneData.nodes;
        var parentNode = loadParams.parentNode;

        var emptyNode = {};
        for (var fn in fileNodes) {
            if (fileNodes.hasOwnProperty(fn)) {
                var fileNode = fileNodes[fn];
                var nodeName = fn;
                var nodePath = (nodesNamePrefix ? (nodesNamePrefix + "/" + fn) : fn);
                var overloadedNode = currentScene.findNode(nodePath);

                var node = copyNode.call(fileNode, nodeName, nodesNamePrefix, (overloadedNode || parentNode || emptyNode), fileNode.skin || loadParams.materialSkin);
                if (node) {
                    if (parentNode && !overloadedNode) {
                        parentNode.addChild(node);
                    }

                    if (baseMatrix) {
                        if (node.local) {
                            node.setLocalTransform(md.m43Mul(node.getLocalTransform(), baseMatrix));
                        } else {
                            node.setLocalTransform(baseMatrix);
                        }
                    } else {
                        if (!node.local) {
                            node.setLocalTransform(md.m43BuildIdentity());
                        }
                    }

                    if (disableNodes) {
                        node.enableHierarchy(false);
                    }

                    if (overloadedNode) {
                        //Utilities.log("Overloaded node '" + nodePath + "'");
                        var overloadedMatrix = overloadedNode.local;
                        if (overloadedMatrix && node.local) {
                            node.local = md.m43Mul(node.local, overloadedMatrix);
                            overloadedNode.setLocalTransform(node.local);
                            delete node.local;
                        }

                        var overloadedChildren = overloadedNode.children;
                        if (overloadedChildren && node.children) {
                            while (node.children.length) {
                                var child = node.children[0];
                                if (!overloadedNode.findChild(child.name)) {
                                    overloadedNode.addChild(child);
                                }
                                node.removeChild(child);
                            }
                        }

                        for (var on in node) {
                            if (node.hasOwnProperty(on)) {
                                overloadedNode[on] = node[on];
                            }
                        }
                        node = null;
                    } else if (!parentNode) {
                        this.addRootNode(node);
                    }
                }
            }
        }
    };

    //
    // loadAreas
    //
    Scene.prototype.loadAreas = function (loadParams) {
        var sceneData = loadParams.data;

        var fileAreas = sceneData.areas;
        if (!fileAreas) {
            return;
        }

        var numFileAreas = fileAreas.length;
        if (numFileAreas <= 0) {
            return;
        }

        if (!loadParams.append) {
            delete this.areas;
        }

        var areas = this.areas;
        if (!areas) {
            areas = [];
            this.areas = areas;
        }

        var nodesNamePrefix = loadParams.nodesNamePrefix;
        var md = this.md;
        var planeNormalize = this.planeNormalize;
        var baseIndex = areas.length;

        var maxValue = Number.MAX_VALUE;

        for (var fa = 0; fa < numFileAreas; fa += 1) {
            var fileArea = fileAreas[fa];

            var targetName = fileArea.target;
            if (nodesNamePrefix) {
                targetName = (nodesNamePrefix + "/" + targetName);
            }
            var target = this.findNode(targetName);
            if (!target) {
                //Utilities.log("Missing target: " + targetName);
                baseIndex -= 1;
                continue;
            }

            var matrix = target.getWorldTransform();
            var m0 = matrix[0];
            var m1 = matrix[1];
            var m2 = matrix[2];
            var m3 = matrix[3];
            var m4 = matrix[4];
            var m5 = matrix[5];
            var m6 = matrix[6];
            var m7 = matrix[7];
            var m8 = matrix[8];
            var m9 = matrix[9];
            var m10 = matrix[10];
            var m11 = matrix[11];

            var minAreaX = maxValue;
            var minAreaY = maxValue;
            var minAreaZ = maxValue;
            var maxAreaX = -maxValue;
            var maxAreaY = -maxValue;
            var maxAreaZ = -maxValue;

            var filePortals = fileArea.portals;
            var numFilePortals = filePortals.length;
            var portals = [];
            var filePortal, filePoints, points, numPoints, np, filePoint;
            for (var fp = 0; fp < numFilePortals; fp += 1) {
                var minX = maxValue;
                var minY = maxValue;
                var minZ = maxValue;
                var maxX = -maxValue;
                var maxY = -maxValue;
                var maxZ = -maxValue;
                var c0 = 0;
                var c1 = 0;
                var c2 = 0;
                filePortal = filePortals[fp];
                filePoints = filePortal.points;
                numPoints = filePoints.length;
                points = [];
                for (np = 0; np < numPoints; np += 1) {
                    filePoint = filePoints[np];
                    var fp0 = filePoint[0];
                    var fp1 = filePoint[1];
                    var fp2 = filePoint[2];
                    var p0 = (m0 * fp0 + m3 * fp1 + m6 * fp2 + m9);
                    var p1 = (m1 * fp0 + m4 * fp1 + m7 * fp2 + m10);
                    var p2 = (m2 * fp0 + m5 * fp1 + m8 * fp2 + m11);
                    if (p0 < minX) {
                        minX = p0;
                    }
                    if (p1 < minY) {
                        minY = p1;
                    }
                    if (p2 < minZ) {
                        minZ = p2;
                    }
                    if (p0 > maxX) {
                        maxX = p0;
                    }
                    if (p1 > maxY) {
                        maxY = p1;
                    }
                    if (p2 > maxZ) {
                        maxZ = p2;
                    }
                    c0 += p0;
                    c1 += p1;
                    c2 += p2;
                    points.push(md.v3Build(p0, p1, p2));
                }
                if (minX < minAreaX) {
                    minAreaX = minX;
                }
                if (minY < minAreaY) {
                    minAreaY = minY;
                }
                if (minZ < minAreaZ) {
                    minAreaZ = minZ;
                }
                if (maxX > maxAreaX) {
                    maxAreaX = maxX;
                }
                if (maxY > maxAreaY) {
                    maxAreaY = maxY;
                }
                if (maxZ > maxAreaZ) {
                    maxAreaZ = maxZ;
                }
                var normal = md.v3Cross(md.v3Sub(points[1], points[0]), md.v3Sub(points[2], points[0]));

                var portalExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(6) : new Array(6));
                portalExtents[0] = minX;
                portalExtents[1] = minY;
                portalExtents[2] = minZ;
                portalExtents[3] = maxX;
                portalExtents[4] = maxY;
                portalExtents[5] = maxZ;

                var portalOrigin = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(3) : new Array(3));
                portalOrigin[0] = (c0 / numPoints);
                portalOrigin[1] = (c1 / numPoints);
                portalOrigin[2] = (c2 / numPoints);

                var portal = {
                    area: (baseIndex + filePortal.area),
                    points: points,
                    origin: portalOrigin,
                    extents: portalExtents,
                    plane: planeNormalize(normal[0], normal[1], normal[2], md.v3Dot(normal, points[0]))
                };
                portals.push(portal);
            }

            var areaExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(6) : new Array(6));
            areaExtents[0] = minAreaX;
            areaExtents[1] = minAreaY;
            areaExtents[2] = minAreaZ;
            areaExtents[3] = maxAreaX;
            areaExtents[4] = maxAreaY;
            areaExtents[5] = maxAreaZ;

            var area = {
                target: target,
                portals: portals,
                extents: areaExtents,
                externalNodes: null
            };
            areas.push(area);
        }

        // Keep bsp tree
        var ArrayConstructor = (this.float32ArrayConstructor ? this.float32ArrayConstructor : Array);
        var fileBspNodes = sceneData.bspnodes;
        var numBspNodes = fileBspNodes.length;
        var bspNodes = [];
        bspNodes.length = numBspNodes;
        this.bspNodes = bspNodes;
        for (var bn = 0; bn < numBspNodes; bn += 1) {
            var fileBspNode = fileBspNodes[bn];
            var plane = fileBspNode.plane;
            var nodePlane = new ArrayConstructor(4);
            nodePlane[0] = plane[0];
            nodePlane[1] = plane[1];
            nodePlane[2] = plane[2];
            nodePlane[3] = -plane[3];
            bspNodes[bn] = {
                plane: nodePlane,
                pos: fileBspNode.pos,
                neg: fileBspNode.neg
            };
        }
    };

    //
    // load
    //
    Scene.prototype.load = function (loadParams) {
        var scene = this;

        if (!loadParams.append) {
            this.clearShapes();
            this.semantics = {};
        }

        var sceneCompleteLoadStage = function sceneCompleteLoadStageFn() {
            if (loadParams.keepLights) {
                scene.loadLights(loadParams);
            }

            scene.loadNodes(loadParams);

            if (loadParams.physicsManager) {
                loadParams.physicsManager.loadNodes(loadParams, scene);
            }

            scene.loadAreas(loadParams);

            scene.endLoading(loadParams.onload);
        };

        if (loadParams.graphicsDevice) {
            this.loadMaterials(loadParams);
        }

        // Needs to be called before the geometry is loaded by loadNodes or streamShapes
        scene.loadSkeletons(loadParams);

        var yieldFn = loadParams.yieldFn;
        if (yieldFn) {
            var streamNodesStage = function sceneStreamNodesStage() {
                scene.streamShapes(loadParams, sceneCompleteLoadStage);
            };
            yieldFn(streamNodesStage);
        } else {
            sceneCompleteLoadStage();
        }
    };

    Scene.prototype.planeNormalize = function (a, b, c, d, dst) {
        var res = dst;
        if (!res) {
            /*jshint newcap: false*/
            var float32ArrayConstructor = Scene.prototype.float32ArrayConstructor;
            res = (float32ArrayConstructor ? new float32ArrayConstructor(4) : new Array(4));
            /*jshint newcap: true*/
        }

        var lsq = ((a * a) + (b * b) + (c * c));
        if (lsq > 0.0) {
            var lr = 1.0 / Math.sqrt(lsq);
            res[0] = (a * lr);
            res[1] = (b * lr);
            res[2] = (c * lr);
            res[3] = (d * lr);
        } else {
            res[0] = 0;
            res[1] = 0;
            res[2] = 0;
            res[3] = 0;
        }

        return res;
    };

    Scene.prototype.isInsidePlanesAABB = function (extents, planes) {
        var n0 = extents[0];
        var n1 = extents[1];
        var n2 = extents[2];
        var p0 = extents[3];
        var p1 = extents[4];
        var p2 = extents[5];
        var numPlanes = planes.length;
        var n = 0;
        do {
            var plane = planes[n];
            var d0 = plane[0];
            var d1 = plane[1];
            var d2 = plane[2];
            if ((d0 * (d0 < 0 ? n0 : p0) + d1 * (d1 < 0 ? n1 : p1) + d2 * (d2 < 0 ? n2 : p2)) < plane[3]) {
                return false;
            }
            n += 1;
        } while(n < numPlanes);
        return true;
    };

    Scene.prototype.isFullyInsidePlanesAABB = function (extents, planes) {
        var n0 = extents[0];
        var n1 = extents[1];
        var n2 = extents[2];
        var p0 = extents[3];
        var p1 = extents[4];
        var p2 = extents[5];
        var numPlanes = planes.length;
        var n = 0;
        do {
            var plane = planes[n];
            var d0 = plane[0];
            var d1 = plane[1];
            var d2 = plane[2];
            if ((d0 * (d0 > 0 ? n0 : p0) + d1 * (d1 > 0 ? n1 : p1) + d2 * (d2 > 0 ? n2 : p2)) < plane[3]) {
                return false;
            }
            n += 1;
        } while(n < numPlanes);
        return true;
    };

    Scene.prototype.extractFrustumPlanes = function (camera) {
        var planeNormalize = this.planeNormalize;
        var m = camera.viewProjectionMatrix;
        var m0 = m[0];
        var m1 = m[1];
        var m2 = m[2];
        var m3 = m[3];
        var m4 = m[4];
        var m5 = m[5];
        var m6 = m[6];
        var m7 = m[7];
        var m8 = m[8];
        var m9 = m[9];
        var m10 = m[10];
        var m11 = m[11];
        var m12 = m[12];
        var m13 = m[13];
        var m14 = m[14];
        var m15 = m[15];
        var planes = this.frustumPlanes;

        // Negate 'd' here to avoid doing it on the isVisible functions
        planes[0] = planeNormalize((m3 + m0), (m7 + m4), (m11 + m8), -(m15 + m12), planes[0]);
        planes[1] = planeNormalize((m3 - m0), (m7 - m4), (m11 - m8), -(m15 - m12), planes[1]);
        planes[2] = planeNormalize((m3 - m1), (m7 - m5), (m11 - m9), -(m15 - m13), planes[2]);
        planes[3] = planeNormalize((m3 + m1), (m7 + m5), (m11 + m9), -(m15 + m13), planes[3]);

        if (this.areas) {
            if (planes.length > 4) {
                planes.length = 4;
            }
        } else {
            planes[4] = planeNormalize((m3 - m2), (m7 - m6), (m11 - m10), -(m15 - m14), planes[4]);
        }

        this.nearPlane = planeNormalize((m3 + m2), (m7 + m6), (m11 + m10), -(m15 + m14), this.nearPlane);

        return planes;
    };

    //
    // calculateHullScreenExtents
    //
    Scene.prototype.calculateHullScreenExtents = function (polygons, screenExtents) {
        // Sutherland-Hodgman polygon clipping algorithm
        var clipLine = function clipLineFn(va, vb, axis, positive, out) {
            var a = va[axis];
            var b = vb[axis];
            var aw = va[3];
            var bw = vb[3];
            var t = 0.0;
            var bInside = true;
            if (positive) {
                if (a > aw) {
                    if (b <= bw) {
                        if (b < bw) {
                            t = ((aw - a) / ((b - a) - (bw - aw)));
                        }
                    } else {
                        // both out
                        return;
                    }
                } else if (b > bw) {
                    if (a < aw) {
                        t = ((aw - a) / ((b - a) - (bw - aw)));
                    }
                    bInside = false;
                }
            } else {
                if (a < -aw) {
                    if (b >= -bw) {
                        if (b > -bw) {
                            t = ((-aw - a) / ((b - a) + (bw - aw)));
                        }
                    } else {
                        // both out
                        return;
                    }
                } else if (b < -bw) {
                    if (a > -aw) {
                        t = ((-aw - a) / ((b - a) + (bw - aw)));
                    }
                    bInside = false;
                }
            }

            if (t > 0.0) {
                var ax = va[0];
                var ay = va[1];
                var az = va[2];
                var bx = vb[0];
                var by = vb[1];
                var bz = vb[2];
                out.push([
                    (ax + (t * (bx - ax))),
                    (ay + (t * (by - ay))),
                    (az + (t * (bz - az))),
                    (aw + (t * (bw - aw)))
                ]);
            }

            if (bInside) {
                out.push(vb);
            }
        };

        var minX = 1.0;
        var maxX = -1.0;
        var minY = 1.0;
        var maxY = -1.0;

        var numPolygons = polygons.length;
        for (var n = 0; n < numPolygons; n += 1) {
            var points = polygons[n];
            var numPoints, p, a, b, out;
            for (var positive = 0; positive < 2; positive += 1) {
                for (var axis = 0; axis < 3; axis += 1) {
                    numPoints = points.length;
                    if (!numPoints) {
                        break;
                    }
                    out = [];
                    for (p = 0; p < numPoints; p += 1) {
                        if (p < 1) {
                            a = points[numPoints - 1];
                        } else {
                            a = points[p - 1];
                        }
                        b = points[p];
                        clipLine(a, b, axis, positive, out);
                    }
                    points = out;
                }
            }

            numPoints = points.length;
            for (p = 0; p < numPoints; p += 1) {
                a = points[p];
                var ax = a[0];
                var ay = a[1];
                var aw = a[3];
                if (aw === 0) {
                    ax = (ax >= 0 ? 1 : -1);
                    ay = (ay >= 0 ? 1 : -1);
                } else {
                    var rcpa = 1.0 / aw;
                    ax *= rcpa;
                    ay *= rcpa;
                }
                if (minX > ax) {
                    minX = ax;
                }
                if (maxX < ax) {
                    maxX = ax;
                }
                if (minY > ay) {
                    minY = ay;
                }
                if (maxY < ay) {
                    maxY = ay;
                }
            }
        }

        if (minX >= maxX || minY >= maxY) {
            return undefined;
        }

        if (minX < -1.0) {
            minX = -1.0;
        }
        if (maxX > 1.0) {
            maxX = 1.0;
        }
        if (minY < -1.0) {
            minY = -1.0;
        }
        if (maxY > 1.0) {
            maxY = 1.0;
        }

        if (!screenExtents) {
            screenExtents = (this.float32ArrayConstructor ? new this.float32ArrayConstructor(4) : new Array(4));
        }
        screenExtents[0] = minX;
        screenExtents[1] = minY;
        screenExtents[2] = maxX;
        screenExtents[3] = maxY;
        return screenExtents;
    };

    //
    // calculateLightsScreenExtents
    //
    Scene.prototype.calculateLightsScreenExtents = function (camera) {
        var visibleLights = this.visibleLights;
        var numVisibleLights = visibleLights.length;
        if (numVisibleLights > 0) {
            var matrix, transform, halfExtents, center, hx, hy, hz, p0, p1, p2, p3, p4, p5, p6, p7, st, polygons;
            var lightInstance, light, worldViewProjectionMatrix;
            var viewProjectionMatrix = camera.viewProjectionMatrix;
            var calculateHullScreenExtents = this.calculateHullScreenExtents;
            var md = this.md;
            var m44Transform = md.m44Transform;
            var m43MulM44 = md.m43MulM44;
            var v4Build = md.v4Build;
            var spotA = v4Build.call(md, -1, -1, 1, 1);
            var spotB = v4Build.call(md, 1, -1, 1, 1);
            var spotC = v4Build.call(md, -1, 1, 1, 1);
            var spotD = v4Build.call(md, 1, 1, 1, 1);
            var n = 0;
            do {
                lightInstance = visibleLights[n];
                light = lightInstance.light;
                if (light) {
                    if (light.global) {
                        continue;
                    }

                    matrix = lightInstance.node.world;

                    if (light.spot) {
                        transform = md.m33MulM43(light.frustum, matrix, transform);

                        worldViewProjectionMatrix = m43MulM44.call(md, transform, viewProjectionMatrix, worldViewProjectionMatrix);

                        p0 = m44Transform.call(md, worldViewProjectionMatrix, spotA, p0);
                        p1 = m44Transform.call(md, worldViewProjectionMatrix, spotB, p1);
                        p2 = m44Transform.call(md, worldViewProjectionMatrix, spotC, p2);
                        p3 = m44Transform.call(md, worldViewProjectionMatrix, spotD, p3);

                        st = v4Build.call(md, matrix[9], matrix[10], matrix[11], 1, st);
                        st = m44Transform.call(md, viewProjectionMatrix, st, st);

                        polygons = [
                            [st, p0, p1],
                            [st, p1, p3],
                            [st, p2, p0],
                            [st, p3, p2],
                            [p2, p3, p1, p0]
                        ];
                    } else {
                        halfExtents = light.halfExtents;
                        if (!light.fog) {
                            center = light.center;
                            if (center) {
                                matrix = transform = md.m43Offset(matrix, center, transform);
                            }
                        }

                        hx = halfExtents[0];
                        hy = halfExtents[1];
                        hz = halfExtents[2];

                        worldViewProjectionMatrix = m43MulM44.call(md, matrix, viewProjectionMatrix, worldViewProjectionMatrix);

                        p0 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, -hx, -hy, -hz, 1, p0), p0);
                        p1 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, +hx, -hy, -hz, 1, p1), p1);
                        p2 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, +hx, -hy, +hz, 1, p2), p2);
                        p3 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, -hx, -hy, +hz, 1, p3), p3);
                        p4 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, -hx, +hy, -hz, 1, p4), p4);
                        p5 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, +hx, +hy, -hz, 1, p5), p5);
                        p6 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, +hx, +hy, +hz, 1, p6), p6);
                        p7 = m44Transform.call(md, worldViewProjectionMatrix, v4Build.call(md, -hx, +hy, +hz, 1, p7), p7);

                        polygons = [
                            [p3, p2, p1, p0],
                            [p4, p5, p6, p7],
                            [p0, p1, p5, p4],
                            [p7, p6, p2, p3],
                            [p4, p7, p3, p0],
                            [p1, p2, p6, p5]
                        ];
                    }

                    lightInstance.screenExtents = calculateHullScreenExtents(polygons, lightInstance.screenExtents);
                }

                n += 1;
            } while(n < numVisibleLights);
        }
    };

    //
    // destroy
    //
    Scene.prototype.destroy = function () {
        this.clear();
        if (this.vertexBufferManager) {
            this.vertexBufferManager.destroy();
            delete this.vertexBufferManager;
        }
        if (this.indexBufferManager) {
            this.indexBufferManager.destroy();
            delete this.indexBufferManager;
        }
    };

    Scene.prototype.getQueryCounter = function () {
        var queryCounter = this.queryCounter;
        this.queryCounter = (queryCounter + 1);
        return queryCounter;
    };

    Scene.create = // Constructor function
    function (mathDevice, staticSpatialMap, dynamicSpatialMap) {
        return new Scene(mathDevice, staticSpatialMap, dynamicSpatialMap);
    };
    Scene.version = 1;
    return Scene;
})();

// Detect correct typed arrays
((function () {
    var testArray, textDescriptor;
    if (typeof Uint16Array !== "undefined") {
        testArray = new Uint16Array(4);
        textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Uint16Array]') {
            Scene.prototype.uint16ArrayConstructor = Uint16Array;
        }
    }
    if (typeof Uint32Array !== "undefined") {
        testArray = new Uint32Array(4);
        textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Uint32Array]') {
            Scene.prototype.uint32ArrayConstructor = Uint32Array;
        }
    }
    if (typeof Float32Array !== "undefined") {
        testArray = new Float32Array(4);
        textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Float32Array]') {
            Scene.prototype.float32ArrayConstructor = Float32Array;
        }
    }
})());
// Copyright (c) 2010-2013 Turbulenz Limited
/*global TurbulenzEngine: false*/
/*global Utilities: false*/
/*global Observer: false*/
;

//
// SceneNode
//
var SceneNode = (function () {
    //
    // SceneNode
    //
    function SceneNode(params) {
        this.name = params.name;

        var md = this.mathDevice;
        if (!md) {
            md = TurbulenzEngine.getMathDevice();
            SceneNode.prototype.mathDevice = md;
        }

        this.dynamic = params.dynamic || false;
        this.disabled = params.disabled || false;

        this.dirtyWorldExtents = true;
        this.dirtyLocalExtents = true;
        this.worldUpdate = 0;

        var local = params.local;
        if (local) {
            this.local = md.m43Copy(local);
        } else {
            this.local = md.m43BuildIdentity();
        }
        local = this.local;
        this.world = md.m43Copy(local);
    }
    SceneNode.makePath = //
    //SceneNode.makePath
    //
    function (parentPath, childName) {
        return parentPath + "/" + childName;
    };

    SceneNode.invalidSetLocalTransform = //
    //SceneNode.invalidSetLocalTransform
    //
    function () {
        debug.abort("setLocalTransform can not be called on static nodes.");
    };

    //
    //getName
    //
    SceneNode.prototype.getName = function () {
        return this.name;
    };

    //
    //getPath
    //
    SceneNode.prototype.getPath = function () {
        if (this.parent) {
            return SceneNode.makePath(this.parent.getPath(), this.name);
        }
        return this.name;
    };

    //
    //getParent
    //
    SceneNode.prototype.getParent = function () {
        return this.parent;
    };

    //
    //setParentHelper
    //
    SceneNode.prototype.setParentHelper = function (parent) {
        //***Only valid to call from addChild()/removeChild() ***
        this.parent = parent;
        this.notifiedParent = false;
        this.dirtyWorld = false;
        this._setDirtyWorldTransform();
    };

    //
    //addChild
    //
    SceneNode.prototype.addChild = function (child) {
        if (child.parent) {
            child.parent.removeChild(child);
        } else {
            if (child.scene) {
                child.scene.removeRootNode(child);
            }
        }

        if (!this.children) {
            this.children = [];
            this.childNeedsUpdateCount = 0;
        }
        this.children.push(child);
        child.setParentHelper(this);

        if (this.dynamic && !child.dynamic) {
            child.setDynamic();
        }
    };

    //
    //removeChild
    //
    SceneNode.prototype.removeChild = function (child) {
        var children = this.children;
        if (children) {
            if (child.notifiedParent) {
                this.childUpdated();
            }
            var numChildren = children.length;
            for (var n = 0; n < numChildren; n += 1) {
                if (children[n] === child) {
                    var root = this.getRoot();
                    if (root.scene) {
                        child.removedFromScene(root.scene);
                    }
                    children.splice(n, 1);
                    child.setParentHelper(null);
                    return;
                }
            }
        }
        debug.abort("Invalid child");
    };

    //
    //findChild
    //
    SceneNode.prototype.findChild = function (name) {
        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var childIndex = 0; childIndex < numChildren; childIndex += 1) {
                if (children[childIndex].name === name) {
                    return children[childIndex];
                }
            }
        }
        return undefined;
    };

    //
    // clone
    //
    SceneNode.prototype.clone = function (newNodeName) {
        var newNode = SceneNode.create({
            name: newNodeName || this.name,
            local: this.local,
            dynamic: this.dynamic,
            disabled: this.disabled
        });

        // Clone renderables
        var renderables = this.renderables;
        if (renderables) {
            var numRenderables = renderables.length;

            for (var i = 0; i < numRenderables; i += 1) {
                var renderable = renderables[i];
                newNode.addRenderable(renderable.clone());
            }
        }

        // Clone lights
        var lights = this.lights;
        if (lights) {
            var numLights = lights.length;
            for (var l = 0; l < numLights; l += 1) {
                var light = lights[l];
                newNode.addLightInstance(light.clone());
            }
        }

        if (this.clonedObserver) {
            this.clonedObserver.notify({
                oldNode: this,
                newNode: newNode
            });
        }

        var childNodes = this.children;
        if (childNodes) {
            var numChildren = childNodes.length;
            for (var c = 0; c < numChildren; c += 1) {
                newNode.addChild(childNodes[c].clone());
            }
        }

        return newNode;
    };

    //
    //getRoot
    //
    SceneNode.prototype.getRoot = function () {
        var result = this;
        while (result.parent) {
            result = result.parent;
        }
        return result;
    };

    //
    // isInScene
    //
    SceneNode.prototype.isInScene = function () {
        if (this.getRoot().scene) {
            return true;
        }
        return false;
    };

    //
    //removedFromScene
    //
    SceneNode.prototype.removedFromScene = function (scene) {
        if (this.spatialIndex !== undefined) {
            if (this.dynamic) {
                scene.dynamicSpatialMap.remove(this);
            } else {
                scene.staticSpatialMap.remove(this);
                scene.staticNodesChangeCounter += 1;
            }
        }

        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var childIndex = 0; childIndex < numChildren; childIndex += 1) {
                children[childIndex].removedFromScene(scene);
            }
        }
    };

    //
    //setLocalTransform
    //
    SceneNode.prototype.setLocalTransform = function (matrix) {
        if (matrix !== this.local) {
            this.local = this.mathDevice.m43Copy(matrix, this.local);
        }

        if (!this.dirtyWorld) {
            this._setDirtyWorldTransform();
        }
    };

    //
    //getLocalTransform
    //
    SceneNode.prototype.getLocalTransform = function () {
        return this.local;
    };

    //
    //_setDirtyWorldTransform
    //
    SceneNode.prototype._setDirtyWorldTransform = function () {
        //Private function
        //Notify parents
        //inlined updateRequired()
        var parent = this.parent;
        if (parent) {
            if (!this.notifiedParent) {
                this.notifiedParent = true;
                parent.childNeedsUpdate();
            }
        } else {
            //Root nodes
            var scene = this.scene;
            if (scene) {
                scene.addRootNodeToUpdate(this, this.name);
            }
        }

        //Notify children
        var nodes = SceneNode._tempDirtyNodes;
        nodes[0] = this;
        var numRemainingNodes = 1;
        var node, index, child;
        do {
            numRemainingNodes -= 1;
            node = nodes[numRemainingNodes];

            node.dirtyWorld = true;

            if (!node.customWorldExtents && node.localExtents) {
                node.dirtyWorldExtents = true;
            }

            var children = node.children;
            if (children) {
                var numChildren = children.length;

                if (!node.childNeedsUpdateCount) {
                    // Common case of propagating down to clean children
                    node.childNeedsUpdateCount = numChildren;
                    for (index = 0; index < numChildren; index += 1) {
                        child = children[index];
                        child.notifiedParent = true;

                        nodes[numRemainingNodes] = child;
                        numRemainingNodes += 1;
                    }
                } else {
                    for (index = 0; index < numChildren; index += 1) {
                        child = children[index];
                        if (!child.dirtyWorld) {
                            if (!child.notifiedParent) {
                                child.notifiedParent = true;
                                node.childNeedsUpdateCount += 1;
                            }

                            nodes[numRemainingNodes] = child;
                            numRemainingNodes += 1;
                        }
                    }
                }
            }
        } while(0 < numRemainingNodes);
    };

    //
    //getWorldTransform
    //
    SceneNode.prototype.getWorldTransform = function () {
        if (this.dirtyWorld) {
            this.updateWorldTransform();
        }
        return this.world;
    };

    //
    //updateWorldTransform
    //
    SceneNode.prototype.updateWorldTransform = function () {
        if (this.dirtyWorld) {
            this.dirtyWorld = false;
            this.worldUpdate += 1;
            this.checkUpdateRequired();

            var parent = this.parent;
            var local = this.local;
            if (parent) {
                var parentWorld = parent.getWorldTransform();
                if (local) {
                    this.world = this.mathDevice.m43Mul(local, parentWorld, this.world);
                } else {
                    this.world = this.mathDevice.m43Copy(parentWorld, this.world);
                }
            } else {
                this.world = this.mathDevice.m43Copy(local, this.world);
            }
        }
    };

    //
    //setDynamic
    //
    SceneNode.prototype.setDynamic = function () {
        if (!this.dynamic) {
            if (this.spatialIndex !== undefined) {
                var scene = this.getRoot().scene;
                scene.staticSpatialMap.remove(this);
                scene.staticNodesChangeCounter += 1;
                delete this.spatialIndex;
            }
            delete this.setLocalTransform;

            var worldExtents = this.getWorldExtents();
            if (worldExtents) {
                this.getRoot().scene.dynamicSpatialMap.update(this, worldExtents);
            }
            this.dynamic = true;
        }

        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var n = 0; n < numChildren; n += 1) {
                children[n].setDynamic();
            }
        }
    };

    //
    //setStatic
    //
    SceneNode.prototype.setStatic = function () {
        if (this.dynamic) {
            if (this.spatialIndex !== undefined) {
                this.getRoot().scene.dynamicSpatialMap.remove(this);
                delete this.spatialIndex;
            }

            this.setLocalTransform = SceneNode.invalidSetLocalTransform;

            var worldExtents = this.getWorldExtents();
            if (worldExtents) {
                var scene = this.getRoot().scene;
                if (scene) {
                    scene.staticSpatialMap.update(this, worldExtents);
                    scene.staticNodesChangeCounter += 1;
                }
            }

            delete this.dirtyWorldExtents;
            delete this.worldExtentsUpdate;
            delete this.dirtyWorld;
            delete this.notifiedParent;
            delete this.dynamic;
        }

        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var n = 0; n < numChildren; n += 1) {
                children[n].setStatic();
            }
        }
    };

    //
    //setDisabled
    //
    SceneNode.prototype.setDisabled = function (disabled) {
        if (disabled) {
            this.disabled = true;
        } else {
            this.disabled = false;
        }
    };

    //
    //getDisabled
    //
    SceneNode.prototype.getDisabled = function () {
        return this.disabled;
    };

    //
    //enableHierarchy
    //
    SceneNode.prototype.enableHierarchy = function (enabled) {
        this.setDisabled(!enabled);

        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var c = 0; c < numChildren; c += 1) {
                children[c].enableHierarchy(enabled);
            }
        }
    };

    //
    //childUpdated
    //
    SceneNode.prototype.childUpdated = function () {
        //Private function
        //debug.assert(this.childNeedsUpdateCount >= 0, "Child update logic incorrect");
        this.childNeedsUpdateCount -= 1;
        if (this.childNeedsUpdateCount === 0 && this.dirtyWorld === false && this.dirtyWorldExtents === false) {
            if (this.parent) {
                this.parent.childUpdated();
                this.notifiedParent = false;
            }
        }
    };

    //
    //childNeedsUpdate
    //
    SceneNode.prototype.childNeedsUpdate = function () {
        //Private function
        this.updateRequired();
        this.childNeedsUpdateCount += 1;
    };

    //
    //updateRequired
    //
    SceneNode.prototype.updateRequired = function () {
        //Private function
        var parent = this.parent;
        if (parent) {
            if (!this.notifiedParent) {
                this.notifiedParent = true;
                parent.childNeedsUpdate();
            }
        } else {
            //Root nodes
            var scene = this.scene;
            if (scene) {
                scene.addRootNodeToUpdate(this, this.name);
            }
        }
    };

    //
    //checkUpdateRequired
    //
    SceneNode.prototype.checkUpdateRequired = function () {
        if (this.notifiedParent) {
            if (!this.dirtyWorldExtents && !this.dirtyWorld && !this.childNeedsUpdateCount) {
                this.parent.childUpdated();
                this.notifiedParent = false;
            }
        }
    };

    //
    //update
    //
    SceneNode.prototype.update = function (scene) {
        var nodes = SceneNode._tempDirtyNodes;
        nodes[0] = this;
        SceneNode.updateNodes(this.mathDevice, (scene || this.scene), nodes, 1);
    };

    SceneNode.updateNodes = function (mathDevice, scene, nodes, numNodes) {
        var node, parent, index, worldExtents;
        do {
            numNodes -= 1;
            node = nodes[numNodes];

            if (node.dirtyWorld) {
                node.dirtyWorld = false;
                node.worldUpdate += 1;

                parent = node.parent;
                if (parent) {
                    var local = node.local;
                    if (local) {
                        node.world = mathDevice.m43Mul(local, parent.world, node.world);
                    } else {
                        node.world = mathDevice.m43Copy(parent.world, node.world);
                    }
                } else {
                    node.world = mathDevice.m43Copy(node.local, node.world);
                }
            }

            if (node.dirtyWorldExtents) {
                if (node.customWorldExtents) {
                    node.worldExtents = node.customWorldExtents;
                } else {
                    if (node.dirtyLocalExtents) {
                        node.updateLocalExtents();
                    }

                    if (node.numCustomRenderableWorldExtents) {
                        node.updateCustomRenderableWorldExtents();
                    } else if (node.localExtents) {
                        node.recalculateWorldExtents();
                    } else {
                        //no object with size so no extents.
                        delete node.worldExtents;
                    }
                }

                node.dirtyWorldExtents = false;
                node.worldExtentsUpdate = true;
            }

            if (node.worldExtentsUpdate) {
                node.worldExtentsUpdate = false;

                worldExtents = node.worldExtents;
                if (worldExtents) {
                    if (node.dynamic) {
                        scene.dynamicSpatialMap.update(node, worldExtents);
                    } else {
                        scene.staticSpatialMap.update(node, worldExtents);
                        scene.staticNodesChangeCounter += 1;

                        //Remove things that are no longer relevant.
                        node.setLocalTransform = SceneNode.invalidSetLocalTransform;
                        delete node.dirtyWorldExtents;
                        delete node.worldExtentsUpdate;
                        delete node.dirtyWorld;
                        delete node.notifiedParent;
                    }
                } else if (node.spatialIndex !== undefined) {
                    if (node.dynamic) {
                        scene.dynamicSpatialMap.remove(node);
                    } else {
                        scene.staticSpatialMap.remove(node);
                        scene.staticNodesChangeCounter += 1;
                    }
                }
            }

            if (node.childNeedsUpdateCount) {
                node.childNeedsUpdateCount = 0;

                var children = node.children;
                if (children) {
                    var numChildren = children.length;
                    for (index = 0; index < numChildren; index += 1) {
                        var child = children[index];
                        if (child.notifiedParent) {
                            nodes[numNodes] = child;
                            numNodes += 1;
                        }
                    }
                }
            }

            node.notifiedParent = false;
        } while(0 < numNodes);
    };

    //
    //updateLocalExtents
    //
    SceneNode.prototype.updateLocalExtents = function () {
        var localExtents, center, halfExtents;
        var hasExtents = false;
        if (this.customLocalExtents) {
            this.localExtents = this.customLocalExtents;
            hasExtents = true;
        } else {
            var renderables = this.renderables;
            var lights = this.lightInstances;
            if (renderables || lights) {
                var maxValue = Number.MAX_VALUE;
                var minValue = -maxValue;
                var min = Math.min;
                var max = Math.max;
                var h0, h1, h2, c0, c1, c2;

                var localExtents0 = maxValue;
                var localExtents1 = maxValue;
                var localExtents2 = maxValue;
                var localExtents3 = minValue;
                var localExtents4 = minValue;
                var localExtents5 = minValue;

                if (renderables) {
                    var numRenderables = renderables.length;
                    for (var index = 0; index < numRenderables; index += 1) {
                        var renderable = renderables[index];
                        halfExtents = renderable.halfExtents;
                        if (halfExtents && !renderable.hasCustomWorldExtents()) {
                            h0 = halfExtents[0];
                            h1 = halfExtents[1];
                            h2 = halfExtents[2];

                            center = renderable.center;
                            if (center) {
                                c0 = center[0];
                                c1 = center[1];
                                c2 = center[2];

                                localExtents0 = min(localExtents0, (c0 - h0));
                                localExtents1 = min(localExtents1, (c1 - h1));
                                localExtents2 = min(localExtents2, (c2 - h2));

                                localExtents3 = max(localExtents3, (c0 + h0));
                                localExtents4 = max(localExtents4, (c1 + h1));
                                localExtents5 = max(localExtents5, (c2 + h2));
                            } else {
                                localExtents0 = min(localExtents0, -h0);
                                localExtents1 = min(localExtents1, -h1);
                                localExtents2 = min(localExtents2, -h2);

                                localExtents3 = max(localExtents3, +h0);
                                localExtents4 = max(localExtents4, +h1);
                                localExtents5 = max(localExtents5, +h2);
                            }
                        }
                    }
                }

                if (lights) {
                    var numLights = lights.length;
                    for (var lindex = 0; lindex < numLights; lindex += 1) {
                        var light = lights[lindex].light;
                        halfExtents = light.halfExtents;
                        if (halfExtents) {
                            h0 = halfExtents[0];
                            h1 = halfExtents[1];
                            h2 = halfExtents[2];

                            center = light.center;
                            if (center) {
                                c0 = center[0];
                                c1 = center[1];
                                c2 = center[2];

                                localExtents0 = min(localExtents0, (c0 - h0));
                                localExtents1 = min(localExtents1, (c1 - h1));
                                localExtents2 = min(localExtents2, (c2 - h2));

                                localExtents3 = max(localExtents3, (c0 + h0));
                                localExtents4 = max(localExtents4, (c1 + h1));
                                localExtents5 = max(localExtents5, (c2 + h2));
                            } else {
                                localExtents0 = min(localExtents0, -h0);
                                localExtents1 = min(localExtents1, -h1);
                                localExtents2 = min(localExtents2, -h2);

                                localExtents3 = max(localExtents3, +h0);
                                localExtents4 = max(localExtents4, +h1);
                                localExtents5 = max(localExtents5, +h2);
                            }
                        }
                    }
                }

                localExtents = new this.arrayConstructor(6);
                localExtents[0] = localExtents0;
                localExtents[1] = localExtents1;
                localExtents[2] = localExtents2;
                localExtents[3] = localExtents3;
                localExtents[4] = localExtents4;
                localExtents[5] = localExtents5;
                this.localExtents = localExtents;
                hasExtents = true;
            }
        }
        if (hasExtents) {
            localExtents = this.localExtents;

            center = (this.localExtentsCenter || new this.arrayConstructor(3));
            center[0] = (localExtents[3] + localExtents[0]) * 0.5;
            center[1] = (localExtents[4] + localExtents[1]) * 0.5;
            center[2] = (localExtents[5] + localExtents[2]) * 0.5;
            this.localExtentsCenter = center;

            halfExtents = (this.localHalfExtents || new this.arrayConstructor(3));
            halfExtents[0] = (localExtents[3] - center[0]);
            halfExtents[1] = (localExtents[4] - center[1]);
            halfExtents[2] = (localExtents[5] - center[2]);
            this.localHalfExtents = halfExtents;
        } else {
            delete this.localExtents;
            delete this.localExtentsCenter;
            delete this.localHalfExtents;
        }

        this.dirtyLocalExtents = false;
    };

    //
    //getLocalExtents
    //
    SceneNode.prototype.getLocalExtents = function () {
        if (this.dirtyLocalExtents) {
            this.updateLocalExtents();
        }
        return this.localExtents;
    };

    //
    //updateWorldExtents
    //
    SceneNode.prototype.updateWorldExtents = function () {
        if (this.dirtyWorld) {
            this.updateWorldTransform();
        }

        if (this.dirtyWorldExtents) {
            if (this.customWorldExtents) {
                this.worldExtents = this.customWorldExtents;
            } else {
                if (this.dirtyLocalExtents) {
                    this.updateLocalExtents();
                }

                if (this.numCustomRenderableWorldExtents) {
                    this.updateCustomRenderableWorldExtents();
                } else if (this.localExtents) {
                    this.recalculateWorldExtents();
                } else {
                    //no object with size so no extents.
                    delete this.worldExtents;
                }
            }

            this.dirtyWorldExtents = false;
            this.worldExtentsUpdate = true;

            this.checkUpdateRequired();
        }
    };

    //
    //updateCustomRenderableWorldExtents
    //
    SceneNode.prototype.updateCustomRenderableWorldExtents = function () {
        var index, renderable, extents, minX, minY, minZ, maxX, maxY, maxZ;
        var renderables = this.renderables;
        var numRenderables = renderables.length;
        var empty = true;

        for (index = 0; index < numRenderables; index += 1) {
            renderable = renderables[index];
            extents = renderable.getCustomWorldExtents();
            if (extents) {
                minX = extents[0];
                minY = extents[1];
                minZ = extents[2];
                maxX = extents[3];
                maxY = extents[4];
                maxZ = extents[5];
                index += 1;
                empty = false;
                break;
            }
        }

        for (; index < numRenderables; index += 1) {
            renderable = renderables[index];
            extents = renderable.getCustomWorldExtents();
            if (extents) {
                if (minX > extents[0]) {
                    minX = extents[0];
                }
                if (minY > extents[1]) {
                    minY = extents[1];
                }
                if (minZ > extents[2]) {
                    minZ = extents[2];
                }

                if (maxX < extents[3]) {
                    maxX = extents[3];
                }
                if (maxY < extents[4]) {
                    maxY = extents[4];
                }
                if (maxZ < extents[5]) {
                    maxZ = extents[5];
                }
            }
        }

        if (empty) {
            // This should not happen...
            delete this.worldExtents;
        } else {
            var worldExtents = this.worldExtents;
            if (!worldExtents) {
                worldExtents = new this.arrayConstructor(6);
                this.worldExtents = worldExtents;
            }
            worldExtents[0] = minX;
            worldExtents[1] = minY;
            worldExtents[2] = minZ;
            worldExtents[3] = maxX;
            worldExtents[4] = maxY;
            worldExtents[5] = maxZ;
        }
    };

    //
    //recalculateWorldExtents
    //
    SceneNode.prototype.recalculateWorldExtents = function () {
        var localExtentsCenter = this.localExtentsCenter;
        var localHalfExtents = this.localHalfExtents;
        var c0 = localExtentsCenter[0];
        var c1 = localExtentsCenter[1];
        var c2 = localExtentsCenter[2];
        var h0 = localHalfExtents[0];
        var h1 = localHalfExtents[1];
        var h2 = localHalfExtents[2];

        var world = this.world;
        var m0 = world[0];
        var m1 = world[1];
        var m2 = world[2];
        var m3 = world[3];
        var m4 = world[4];
        var m5 = world[5];
        var m6 = world[6];
        var m7 = world[7];
        var m8 = world[8];

        var ct0 = world[9];
        var ct1 = world[10];
        var ct2 = world[11];
        if (c0 !== 0 || c1 !== 0 || c2 !== 0) {
            ct0 += (m0 * c0 + m3 * c1 + m6 * c2);
            ct1 += (m1 * c0 + m4 * c1 + m7 * c2);
            ct2 += (m2 * c0 + m5 * c1 + m8 * c2);
        }

        var ht0 = ((m0 < 0 ? -m0 : m0) * h0 + (m3 < 0 ? -m3 : m3) * h1 + (m6 < 0 ? -m6 : m6) * h2);
        var ht1 = ((m1 < 0 ? -m1 : m1) * h0 + (m4 < 0 ? -m4 : m4) * h1 + (m7 < 0 ? -m7 : m7) * h2);
        var ht2 = ((m2 < 0 ? -m2 : m2) * h0 + (m5 < 0 ? -m5 : m5) * h1 + (m8 < 0 ? -m8 : m8) * h2);

        var worldExtents = this.worldExtents;
        if (!worldExtents) {
            worldExtents = new this.arrayConstructor(6);
            this.worldExtents = worldExtents;
        }
        worldExtents[0] = (ct0 - ht0);
        worldExtents[1] = (ct1 - ht1);
        worldExtents[2] = (ct2 - ht2);
        worldExtents[3] = (ct0 + ht0);
        worldExtents[4] = (ct1 + ht1);
        worldExtents[5] = (ct2 + ht2);
    };

    //
    //getWorldExtents
    //
    SceneNode.prototype.getWorldExtents = function () {
        if (this.dirtyWorldExtents) {
            this.updateWorldExtents();
        }
        return this.worldExtents;
    };

    //
    //addCustomLocalExtents
    //
    SceneNode.prototype.addCustomLocalExtents = function (localExtents) {
        var customLocalExtents = this.customLocalExtents;
        if (!customLocalExtents) {
            this.customLocalExtents = customLocalExtents = new this.arrayConstructor(6);
            customLocalExtents[0] = localExtents[0];
            customLocalExtents[1] = localExtents[1];
            customLocalExtents[2] = localExtents[2];
            customLocalExtents[3] = localExtents[3];
            customLocalExtents[4] = localExtents[4];
            customLocalExtents[5] = localExtents[5];
            this.dirtyLocalExtents = true;
        } else {
            if (customLocalExtents[0] !== localExtents[0] || customLocalExtents[1] !== localExtents[1] || customLocalExtents[2] !== localExtents[2] || customLocalExtents[3] !== localExtents[3] || customLocalExtents[4] !== localExtents[4] || customLocalExtents[5] !== localExtents[5]) {
                customLocalExtents[0] = localExtents[0];
                customLocalExtents[1] = localExtents[1];
                customLocalExtents[2] = localExtents[2];
                customLocalExtents[3] = localExtents[3];
                customLocalExtents[4] = localExtents[4];
                customLocalExtents[5] = localExtents[5];
                this.dirtyLocalExtents = true;
            }
        }
        if (this.dirtyLocalExtents) {
            this.dirtyWorldExtents = true;
            this.updateRequired();
        }
    };

    //
    //removeCustomLocalExtents
    //
    SceneNode.prototype.removeCustomLocalExtents = function () {
        delete this.customLocalExtents;
        this.dirtyWorldExtents = true;
        this.dirtyLocalExtents = true;
        this.updateRequired();
    };

    //
    //getCustomLocalExtents
    //
    SceneNode.prototype.getCustomLocalExtents = function () {
        return this.customLocalExtents;
    };

    //
    //addCustomWorldExtents
    //
    SceneNode.prototype.addCustomWorldExtents = function (worldExtents) {
        var customWorldExtents = this.customWorldExtents;
        if (!customWorldExtents) {
            this.customWorldExtents = customWorldExtents = new this.arrayConstructor(6);
            customWorldExtents[0] = worldExtents[0];
            customWorldExtents[1] = worldExtents[1];
            customWorldExtents[2] = worldExtents[2];
            customWorldExtents[3] = worldExtents[3];
            customWorldExtents[4] = worldExtents[4];
            customWorldExtents[5] = worldExtents[5];
            this.dirtyWorldExtents = true;
        } else {
            if (customWorldExtents[0] !== worldExtents[0] || customWorldExtents[1] !== worldExtents[1] || customWorldExtents[2] !== worldExtents[2] || customWorldExtents[3] !== worldExtents[3] || customWorldExtents[4] !== worldExtents[4] || customWorldExtents[5] !== worldExtents[5]) {
                customWorldExtents[0] = worldExtents[0];
                customWorldExtents[1] = worldExtents[1];
                customWorldExtents[2] = worldExtents[2];
                customWorldExtents[3] = worldExtents[3];
                customWorldExtents[4] = worldExtents[4];
                customWorldExtents[5] = worldExtents[5];
                this.dirtyWorldExtents = true;
            }
        }
        if (this.dirtyWorldExtents) {
            this.updateRequired();
        }
    };

    //
    //removeCustomWorldExtents
    //
    SceneNode.prototype.removeCustomWorldExtents = function () {
        delete this.customWorldExtents;
        this.dirtyWorldExtents = true;
        this.updateRequired();
    };

    //
    //getCustomWorldExtents
    //
    SceneNode.prototype.getCustomWorldExtents = function () {
        return this.customWorldExtents;
    };

    //
    //renderableWorldExtentsUpdated
    //
    SceneNode.prototype.renderableWorldExtentsUpdated = function (wasAlreadyCustom) {
        if (!this.customWorldExtents) {
            this.dirtyWorldExtents = true;
            this.updateRequired();
        }

        if (!wasAlreadyCustom) {
            this.dirtyLocalExtents = true;
            this.numCustomRenderableWorldExtents = this.numCustomRenderableWorldExtents ? this.numCustomRenderableWorldExtents + 1 : 1;
        }
    };

    //
    //renderableWorldExtentsRemoved
    //
    SceneNode.prototype.renderableWorldExtentsRemoved = function () {
        if (!this.customWorldExtents) {
            this.dirtyWorldExtents = true;
            this.updateRequired();
        }
        this.dirtyLocalExtents = true;
        this.numCustomRenderableWorldExtents -= 1;
    };

    //
    //calculateHierarchyWorldExtents
    //
    SceneNode.prototype.calculateHierarchyWorldExtents = function () {
        var calculateNodeExtents = function calculateNodeExtentsFn(sceneNode, totalExtents) {
            var valid = false;

            var worldExtents = sceneNode.getWorldExtents();
            if (worldExtents) {
                totalExtents[0] = (totalExtents[0] < worldExtents[0] ? totalExtents[0] : worldExtents[0]);
                totalExtents[1] = (totalExtents[1] < worldExtents[1] ? totalExtents[1] : worldExtents[1]);
                totalExtents[2] = (totalExtents[2] < worldExtents[2] ? totalExtents[2] : worldExtents[2]);
                totalExtents[3] = (totalExtents[3] > worldExtents[3] ? totalExtents[3] : worldExtents[3]);
                totalExtents[4] = (totalExtents[4] > worldExtents[4] ? totalExtents[4] : worldExtents[4]);
                totalExtents[5] = (totalExtents[5] > worldExtents[5] ? totalExtents[5] : worldExtents[5]);
                valid = true;
            }

            var children = sceneNode.children;
            if (children) {
                var numChildren = children.length;
                for (var n = 0; n < numChildren; n += 1) {
                    valid = (calculateNodeExtents(children[n], totalExtents) || valid);
                }
            }

            return valid;
        };

        var maxValue = Number.MAX_VALUE;
        var totalExtents = new this.arrayConstructor(6);
        totalExtents[0] = maxValue;
        totalExtents[1] = maxValue;
        totalExtents[2] = maxValue;
        totalExtents[3] = -maxValue;
        totalExtents[4] = -maxValue;
        totalExtents[5] = -maxValue;

        if (calculateNodeExtents(this, totalExtents)) {
            return totalExtents;
        } else {
            return undefined;
        }
    };

    //
    //addRenderable
    //
    SceneNode.prototype.addRenderable = function (renderable) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        if (!this.renderables) {
            this.renderables = [];
        }
        this.renderables.push(renderable);
        renderable.setNode(this);
        this.dirtyLocalExtents = true;
    };

    //
    //addRenderableArray
    //
    SceneNode.prototype.addRenderableArray = function (additionalRenderables) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        if (!this.renderables) {
            this.renderables = [];
        }
        var renderables = this.renderables;
        var length = additionalRenderables.length;
        for (var index = 0; index < length; index += 1) {
            renderables.push(additionalRenderables[index]);
            additionalRenderables[index].setNode(this);
        }
        this.dirtyLocalExtents = true;
    };

    //
    //removeRenderable
    //
    SceneNode.prototype.removeRenderable = function (renderable) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        var renderables = this.renderables;
        var numRenderables = renderables.length;
        for (var index = 0; index < numRenderables; index += 1) {
            if (renderables[index] === renderable) {
                renderables[index].setNode(null);
                renderables.splice(index, 1);
                this.dirtyLocalExtents = true;
                return;
            }
        }
        debug.abort("Invalid renderable");
    };

    //
    //hasRenderables
    //
    SceneNode.prototype.hasRenderables = function () {
        return (this.renderables && this.renderables.length) ? true : false;
    };

    //
    //addLightInstance
    //
    SceneNode.prototype.addLightInstance = function (lightInstance) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        if (!this.lightInstances) {
            this.lightInstances = [];
        }
        this.lightInstances.push(lightInstance);
        lightInstance.setNode(this);
        this.dirtyLocalExtents = true;
    };

    //
    //addLightInstanceArray
    //
    SceneNode.prototype.addLightInstanceArray = function (additionalLightInstances) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        if (!this.lightInstances) {
            this.lightInstances = [];
        }

        var lightInstances = this.lightInstances;
        var length = additionalLightInstances.length;
        for (var index = 0; index < length; index += 1) {
            additionalLightInstances[index].setNode(this);
            lightInstances.push(additionalLightInstances[index]);
        }

        this.dirtyLocalExtents = true;
    };

    //
    //removeLightInstance
    //
    SceneNode.prototype.removeLightInstance = function (lightInstance) {
        this.dirtyWorldExtents = true;
        this.updateRequired();
        var lightInstances = this.lightInstances;
        var numLights = lightInstances.length;
        for (var index = 0; index < numLights; index += 1) {
            if (lightInstances[index] === lightInstance) {
                lightInstance.setNode(null);
                lightInstances.splice(index, 1);
                this.dirtyLocalExtents = true;
                return;
            }
        }
        debug.abort("Invalid light");
    };

    //
    //hasLightInstances
    //
    SceneNode.prototype.hasLightInstances = function () {
        return (this.lightInstances && this.lightInstances.length);
    };

    //
    //destroy
    //
    SceneNode.prototype.destroy = function () {
        //Should only be called when parent is null
        debug.assert(!this.parent, "SceneNode should be remove from parent before destroy is called");

        if (this.destroyedObserver) {
            this.destroyedObserver.notify({ node: this });
        }

        var children = this.children;
        if (children) {
            var numChildren = children.length;
            for (var childIndex = numChildren - 1; childIndex >= 0; childIndex -= 1) {
                var child = children[childIndex];
                this.removeChild(child);
                child.destroy();
            }
        }

        var renderables = this.renderables;
        if (renderables) {
            var numRenderables = renderables.length;
            for (var renderableIndex = numRenderables - 1; renderableIndex >= 0; renderableIndex -= 1) {
                var renderable = renderables[renderableIndex];
                if (renderable.destroy) {
                    renderable.destroy();
                }
            }
            this.renderables = [];
        }

        if (this.lightInstances) {
            this.lightInstances = [];
        }

        delete this.scene;

        // Make sure there are no references to any nodes
        var nodes = SceneNode._tempDirtyNodes;
        var numNodes = nodes.length;
        var n;
        for (n = 0; n < numNodes; n += 1) {
            nodes[n] = null;
        }
    };

    //
    //subscribeCloned
    //
    SceneNode.prototype.subscribeCloned = function (observerFunction) {
        if (!this.clonedObserver) {
            this.clonedObserver = Observer.create();
        }
        this.clonedObserver.subscribe(observerFunction);
    };

    //
    //unsubscribeCloned
    //
    SceneNode.prototype.unsubscribeCloned = function (observerFunction) {
        this.clonedObserver.unsubscribe(observerFunction);
    };

    //
    //subscribeDestroyed
    //
    SceneNode.prototype.subscribeDestroyed = function (observerFunction) {
        if (!this.destroyedObserver) {
            this.destroyedObserver = Observer.create();
        }
        this.destroyedObserver.subscribe(observerFunction);
    };

    //
    //unsubscribeDestroyed
    //
    SceneNode.prototype.unsubscribeDestroyed = function (observerFunction) {
        this.destroyedObserver.unsubscribe(observerFunction);
    };

    SceneNode.create = //
    //SceneNode.create
    //
    function (params) {
        return new SceneNode(params);
    };
    SceneNode.version = 1;

    SceneNode._tempDirtyNodes = [];
    return SceneNode;
})();

SceneNode.prototype.mathDevice = null;

// Detect correct typed arrays
((function () {
    SceneNode.prototype.arrayConstructor = Array;
    if (typeof Float32Array !== "undefined") {
        var testArray = new Float32Array(4);
        var textDescriptor = Object.prototype.toString.call(testArray);
        if (textDescriptor === '[object Float32Array]') {
            SceneNode.prototype.arrayConstructor = Float32Array;
        }
    }
})());
// Copyright (c) 2010-2013 Turbulenz Limited
;

var ShadowMapping = (function () {
    function ShadowMapping() {
        this.defaultSizeLow = 512;
        this.defaultSizeHigh = 1024;
        this.blurEnabled = true;
    }
    // Methods
    ShadowMapping.prototype.updateShader = function (sm) {
        var shader = sm.get("shaders/shadowmapping.cgfx");
        if (shader !== this.shadowMappingShader) {
            this.shader = shader;
            this.rigidTechnique = shader.getTechnique("rigid");
            this.skinnedTechnique = shader.getTechnique("skinned");
            this.blurTechnique = shader.getTechnique("blur");
        }
    };

    ShadowMapping.prototype.update = function () {
        this.shadowTechniqueParameters['world'] = this.node.world;
    };

    ShadowMapping.prototype.skinnedUpdate = function () {
        var techniqueParameters = this.shadowTechniqueParameters;
        techniqueParameters['world'] = this.node.world;

        var skinController = this.skinController;
        if (skinController) {
            techniqueParameters['skinBones'] = skinController.output;
            skinController.update();
        }
    };

    ShadowMapping.prototype.destroyBuffers = function () {
        var shadowMaps, numShadowMaps, n, shadowMap, renderTarget, texture;

        shadowMaps = this.shadowMapsLow;
        if (shadowMaps) {
            numShadowMaps = shadowMaps.length;
            for (n = 0; n < numShadowMaps; n += 1) {
                shadowMap = shadowMaps[n];

                renderTarget = shadowMap.renderTarget;
                if (renderTarget) {
                    renderTarget.destroy();
                    shadowMap.renderTarget = null;
                }

                texture = shadowMap.texture;
                if (texture) {
                    texture.destroy();
                    shadowMap.texture = null;
                }
            }
            shadowMaps.length = 0;
        }

        shadowMaps = this.shadowMapsHigh;
        if (shadowMaps) {
            numShadowMaps = shadowMaps.length;
            for (n = 0; n < numShadowMaps; n += 1) {
                shadowMap = shadowMaps[n];

                renderTarget = shadowMap.renderTarget;
                if (renderTarget) {
                    renderTarget.destroy();
                    shadowMap.renderTarget = null;
                }

                texture = shadowMap.texture;
                if (texture) {
                    texture.destroy();
                    shadowMap.texture = null;
                }
            }
            shadowMaps.length = 0;
        }

        if (this.blurRenderTargetLow) {
            this.blurRenderTargetLow.destroy();
            this.blurRenderTargetLow = null;
        }
        if (this.blurRenderTargetHigh) {
            this.blurRenderTargetHigh.destroy();
            this.blurRenderTargetHigh = null;
        }
        if (this.blurTextureLow) {
            this.blurTextureLow.destroy();
            this.blurTextureLow = null;
        }
        if (this.blurTextureHigh) {
            this.blurTextureHigh.destroy();
            this.blurTextureHigh = null;
        }
        if (this.depthBufferLow) {
            this.depthBufferLow.destroy();
            this.depthBufferLow = null;
        }
        if (this.depthBufferHigh) {
            this.depthBufferHigh.destroy();
            this.depthBufferHigh = null;
        }
    };

    ShadowMapping.prototype.updateBuffers = function (sizeLow, sizeHigh) {
        if (this.sizeLow === sizeLow && this.sizeHigh === sizeHigh) {
            return true;
        }
        if (!sizeLow && !sizeHigh) {
            sizeLow = this.sizeLow;
            sizeHigh = this.sizeHigh;
        }

        var gd = this.gd;

        this.shadowMapsHigh = [];
        this.shadowMapsLow = [];

        this.destroyBuffers();
        this.depthBufferLow = gd.createRenderBuffer({
            width: sizeLow,
            height: sizeLow,
            format: "D16"
        });

        this.depthBufferHigh = gd.createRenderBuffer({
            width: sizeHigh,
            height: sizeHigh,
            format: "D16"
        });

        this.blurTextureLow = gd.createTexture({
            width: sizeLow,
            height: sizeLow,
            format: "R5G6B5",
            mipmaps: false,
            renderable: true
        });

        this.blurTextureHigh = gd.createTexture({
            width: sizeHigh,
            height: sizeHigh,
            format: "R5G6B5",
            mipmaps: false,
            renderable: true
        });

        if (this.depthBufferLow && this.depthBufferHigh && this.blurTextureLow && this.blurTextureHigh) {
            this.blurRenderTargetLow = gd.createRenderTarget({
                colorTexture0: this.blurTextureLow
            });

            this.blurRenderTargetHigh = gd.createRenderTarget({
                colorTexture0: this.blurTextureHigh
            });

            if (this.blurRenderTargetLow && this.blurRenderTargetHigh) {
                this.sizeLow = sizeLow;
                this.sizeHigh = sizeHigh;
                return true;
            }
        }

        this.sizeLow = 0;
        this.sizeHigh = 0;
        this.destroyBuffers();
        return false;
    };

    ShadowMapping.prototype.findVisibleRenderables = function (lightInstance) {
        var md = this.md;

        var light = lightInstance.light;
        var node = lightInstance.node;
        var matrix = node.world;
        var occludersDrawArray = lightInstance.occludersDrawArray;
        var origin = lightInstance.lightOrigin;
        var target, up, frustumWorld;
        var halfExtents = light.halfExtents;

        var shadowMapInfo = lightInstance.shadowMapInfo;
        if (!shadowMapInfo) {
            shadowMapInfo = {
                camera: Camera.create(md),
                target: md.v3BuildZero()
            };
            lightInstance.shadowMapInfo = shadowMapInfo;
        }

        target = shadowMapInfo.target;
        var camera = shadowMapInfo.camera;

        if (light.spot) {
            frustumWorld = md.m33MulM43(light.frustum, matrix, shadowMapInfo.frustumWorld);
            md.v3Add(origin, md.m43At(frustumWorld, target), target);
            up = md.m43Up(frustumWorld, this.tempV3Up);
            shadowMapInfo.frustumWorld = frustumWorld;
            camera.parallel = false;
        } else {
            var nodeUp = md.m43Up(matrix, this.tempV3Up);
            var nodeAt = md.m43At(matrix, this.tempV3At);
            var nodePos = md.m43Pos(matrix, this.tempV3Pos);
            var abs = Math.abs;
            var direction;

            if (light.point) {
                md.v3AddScalarMul(nodePos, nodeUp, -halfExtents[1], target);
                direction = md.v3Sub(target, origin, nodePos);
                camera.parallel = false;
            } else {
                direction = light.direction;

                var d0 = direction[0];
                var d1 = direction[1];
                var d2 = direction[2];

                var p0 = halfExtents[0];
                var p1 = halfExtents[1];
                var p2 = halfExtents[2];

                var n0 = -p0;
                var n1 = -p1;
                var n2 = -p2;

                var maxDistance = ((d0 * (d0 > 0 ? p0 : n0)) + (d1 * (d1 > 0 ? p1 : n1)) + (d2 * (d2 > 0 ? p2 : n2)));
                var minDistance = ((d0 * (d0 > 0 ? n0 : p0)) + (d1 * (d1 > 0 ? n1 : p1)) + (d2 * (d2 > 0 ? n2 : p2)));

                direction = md.m43TransformVector(matrix, light.direction);
                md.v3AddScalarMul(nodePos, direction, maxDistance, target);
                origin = md.v3AddScalarMul(nodePos, direction, minDistance);

                camera.parallel = true;
            }

            if (abs(md.v3Dot(direction, nodeAt)) < abs(md.v3Dot(direction, nodeUp))) {
                up = nodeAt;
            } else {
                up = nodeUp;
            }
        }

        // TODO: we do this in the drawShadowMap function as well
        // could we put this on the lightInstance?
        this.lookAt(camera, target, up, origin);
        camera.updateViewMatrix();
        var viewMatrix = camera.viewMatrix;

        if (!lightInstance.lightDepth || light.dynamic) {
            var halfExtents = light.halfExtents;
            var halfExtents0 = halfExtents[0];
            var halfExtents1 = halfExtents[1];
            var halfExtents2 = halfExtents[2];
            var lightDepth, lightViewWindowX, lightViewWindowY;
            if (light.spot) {
                var tan = Math.tan;
                var acos = Math.acos;
                var frustumWorld = shadowMapInfo.frustumWorld;

                var p0 = md.m43TransformPoint(frustumWorld, md.v3Build(-1, -1, 1));
                var p1 = md.m43TransformPoint(frustumWorld, md.v3Build(1, -1, 1));
                var p2 = md.m43TransformPoint(frustumWorld, md.v3Build(-1, 1, 1));
                var p3 = md.m43TransformPoint(frustumWorld, md.v3Build(1, 1, 1));
                var farLightCenter = md.v3Sub(md.v3ScalarMul(md.v3Add4(p0, p1, p2, p3), 0.25), origin);
                lightDepth = md.v3Length(farLightCenter);
                if (lightDepth <= 0.0) {
                    lightInstance.shadows = false;
                    return false;
                }
                farLightCenter = md.v3ScalarMul(farLightCenter, 1.0 / lightDepth);
                var farLightRight = md.v3Normalize(md.v3Sub(md.v3ScalarMul(md.v3Add(p0, p2), 0.5), origin));
                var farLightTop = md.v3Normalize(md.v3Sub(md.v3ScalarMul(md.v3Add(p0, p1), 0.5), origin));
                lightViewWindowX = tan(acos(md.v3Dot(farLightCenter, farLightRight)));
                lightViewWindowY = tan(acos(md.v3Dot(farLightCenter, farLightTop)));
            } else if (light.point) {
                // HACK: as we are only rendering shadowmaps for the lower half
                var lightOrigin = light.origin;
                if (lightOrigin) {
                    var displacedTarget = target.slice();
                    displacedTarget[0] -= lightOrigin[0];
                    displacedTarget[2] -= lightOrigin[2];
                    lightDepth = md.v3Length(md.v3Sub(displacedTarget, origin));
                    lightViewWindowX = (halfExtents0 / lightDepth);
                    lightViewWindowY = (halfExtents2 / lightDepth);
                } else {
                    lightDepth = halfExtents1;
                    lightViewWindowX = (halfExtents0 / halfExtents1);
                    lightViewWindowY = (halfExtents2 / halfExtents1);
                }
                if (lightDepth <= 0.0) {
                    lightInstance.shadows = false;
                    return false;
                }
                lightViewWindowX *= 3;
                lightViewWindowY *= 3;
            } else {
                var m0 = viewMatrix[0];
                var m1 = viewMatrix[1];
                var m3 = viewMatrix[3];
                var m4 = viewMatrix[4];
                var m6 = viewMatrix[6];
                var m7 = viewMatrix[7];
                lightViewWindowX = ((m0 < 0 ? -m0 : m0) * halfExtents0 + (m3 < 0 ? -m3 : m3) * halfExtents1 + (m6 < 0 ? -m6 : m6) * halfExtents2);
                lightViewWindowY = ((m1 < 0 ? -m1 : m1) * halfExtents0 + (m4 < 0 ? -m4 : m4) * halfExtents1 + (m7 < 0 ? -m7 : m7) * halfExtents2);
                lightDepth = md.v3Length(md.v3Sub(target, origin));
            }

            lightInstance.lightViewWindowX = lightViewWindowX;
            lightInstance.lightViewWindowY = lightViewWindowY;
            lightInstance.lightDepth = lightDepth;
        }

        if (!occludersDrawArray) {
            occludersDrawArray = new Array(numOverlappingRenderables);
            lightInstance.occludersDrawArray = occludersDrawArray;

            // Initialize some properties required on the light instance
            lightInstance.minLightDistance = 0;
            lightInstance.maxLightDistance = 0;
            lightInstance.minLightDistanceX = 0;
            lightInstance.maxLightDistanceX = 0;
            lightInstance.minLightDistanceY = 0;
            lightInstance.maxLightDistanceY = 0;

            lightInstance.shadowMap = null;
            lightInstance.shadows = false;
        }

        var numStaticOverlappingRenderables = lightInstance.numStaticOverlappingRenderables;
        var overlappingRenderables = lightInstance.overlappingRenderables;
        var numOverlappingRenderables = overlappingRenderables.length;
        var staticNodesChangeCounter = lightInstance.staticNodesChangeCounter;

        if (node.dynamic || numStaticOverlappingRenderables !== numOverlappingRenderables || shadowMapInfo.staticNodesChangeCounter !== staticNodesChangeCounter) {
            var occludersExtents = this.occludersExtents;
            var numOccluders = this._filterOccluders(overlappingRenderables, numStaticOverlappingRenderables, occludersDrawArray, occludersExtents);
            numOccluders = this._updateOccludersLimits(lightInstance, viewMatrix, occludersDrawArray, occludersExtents, numOccluders);
            occludersDrawArray.length = numOccluders;
            shadowMapInfo.staticNodesChangeCounter = staticNodesChangeCounter;
        }

        return (0 < occludersDrawArray.length);
    };

    ShadowMapping.prototype.drawShadowMap = function (cameraMatrix, minExtentsHigh, lightInstance) {
        var md = this.md;
        var gd = this.gd;
        var node = lightInstance.node;
        var light = lightInstance.light;

        var shadowMapInfo = lightInstance.shadowMapInfo;
        var camera = shadowMapInfo.camera;
        var viewMatrix = camera.viewMatrix;
        var origin = lightInstance.lightOrigin;

        var halfExtents = light.halfExtents;
        var halfExtents0 = halfExtents[0];
        var halfExtents1 = halfExtents[1];
        var halfExtents2 = halfExtents[2];
        var lightOrigin;

        lightInstance.shadows = false;

        var occludersDrawArray = lightInstance.occludersDrawArray;
        var numOccluders;
        if (occludersDrawArray) {
            numOccluders = occludersDrawArray.length;
            if (!numOccluders) {
                return;
            }
        } else {
            return;
        }

        var numStaticOverlappingRenderables = lightInstance.numStaticOverlappingRenderables;
        var numOverlappingRenderables = lightInstance.overlappingRenderables.length;

        var maxExtentSize = Math.max(halfExtents0, halfExtents1, halfExtents2);
        var shadowMap, shadowMapTexture, shadowMapRenderTarget, shadowMapSize;
        if (maxExtentSize >= minExtentsHigh) {
            shadowMapSize = this.sizeHigh;
            var shadowMapsHighIndex = this.highIndex;
            if (shadowMapsHighIndex < this.shadowMapsHigh.length) {
                shadowMap = this.shadowMapsHigh[shadowMapsHighIndex];
                shadowMapTexture = shadowMap.texture;
                shadowMapRenderTarget = shadowMap.renderTarget;
            } else {
                shadowMapTexture = gd.createTexture({
                    width: shadowMapSize,
                    height: shadowMapSize,
                    format: "R5G6B5",
                    mipmaps: false,
                    renderable: true
                });
                if (shadowMapTexture) {
                    shadowMapRenderTarget = gd.createRenderTarget({
                        colorTexture0: shadowMapTexture,
                        depthBuffer: this.depthBufferHigh
                    });
                    if (!shadowMapRenderTarget) {
                        shadowMapTexture = null;
                        return;
                    } else {
                        shadowMap = {
                            texture: shadowMapTexture,
                            renderTarget: shadowMapRenderTarget,
                            lightInstance: lightInstance
                        };
                        this.shadowMapsHigh[shadowMapsHighIndex] = shadowMap;
                    }
                } else {
                    return;
                }
            }

            this.highIndex = (shadowMapsHighIndex + 1);
        } else {
            shadowMapSize = this.sizeLow;
            var shadowMapsLowIndex = this.lowIndex;
            if (shadowMapsLowIndex < this.shadowMapsLow.length) {
                shadowMap = this.shadowMapsLow[shadowMapsLowIndex];
                shadowMapTexture = shadowMap.texture;
                shadowMapRenderTarget = shadowMap.renderTarget;
            } else {
                shadowMapTexture = gd.createTexture({
                    width: shadowMapSize,
                    height: shadowMapSize,
                    format: "R5G6B5",
                    mipmaps: false,
                    renderable: true
                });
                if (shadowMapTexture) {
                    shadowMapRenderTarget = gd.createRenderTarget({
                        colorTexture0: shadowMapTexture,
                        depthBuffer: this.depthBufferLow
                    });
                    if (!shadowMapRenderTarget) {
                        shadowMapTexture = null;
                        return;
                    } else {
                        shadowMap = {
                            texture: shadowMapTexture,
                            renderTarget: shadowMapRenderTarget,
                            lightInstance: lightInstance
                        };
                        this.shadowMapsLow[shadowMapsLowIndex] = shadowMap;
                    }
                } else {
                    return;
                }
            }

            this.lowIndex = (shadowMapsLowIndex + 1);
        }

        lightInstance.shadowMap = shadowMap;
        lightInstance.shadows = true;

        var distanceScale = (1.0 / 65536);
        var minLightDistance = (lightInstance.minLightDistance - distanceScale);
        var maxLightDistance = (lightInstance.maxLightDistance + distanceScale);

        var lightViewWindowX = lightInstance.lightViewWindowX;
        var lightViewWindowY = lightInstance.lightViewWindowY;
        var lightDepth = lightInstance.lightDepth;

        var lightViewOffsetX = 0;
        var lightViewOffsetY = 0;

        if (0 < minLightDistance) {
            var borderPadding = (3 / shadowMapSize);
            var minLightDistanceX = lightInstance.minLightDistanceX;
            var maxLightDistanceX = lightInstance.maxLightDistanceX;
            var minLightDistanceY = lightInstance.minLightDistanceY;
            var maxLightDistanceY = lightInstance.maxLightDistanceY;
            var minimalViewWindowX, minimalViewWindowY;
            if (light.directional) {
                if (minLightDistanceX < -lightViewWindowX) {
                    minLightDistanceX = -lightViewWindowX;
                }
                if (maxLightDistanceX > lightViewWindowX) {
                    maxLightDistanceX = lightViewWindowX;
                }
                if (minLightDistanceY < -lightViewWindowY) {
                    minLightDistanceY = -lightViewWindowY;
                }
                if (maxLightDistanceY > lightViewWindowY) {
                    maxLightDistanceY = lightViewWindowY;
                }
                minimalViewWindowX = Math.max(Math.abs(maxLightDistanceX), Math.abs(minLightDistanceX));
                minimalViewWindowX += 2 * borderPadding * minimalViewWindowX;
                minimalViewWindowY = Math.max(Math.abs(maxLightDistanceY), Math.abs(minLightDistanceY));
                minimalViewWindowY += 2 * borderPadding * minimalViewWindowY;
                if (lightViewWindowX > minimalViewWindowX) {
                    lightViewWindowX = minimalViewWindowX;
                }
                if (lightViewWindowY > minimalViewWindowY) {
                    lightViewWindowY = minimalViewWindowY;
                }
            } else {
                var endLightDistance = (lightDepth < maxLightDistance ? lightDepth : maxLightDistance);
                lightOrigin = light.origin;
                if (lightOrigin) {
                    var displacedExtent0 = (halfExtents0 + Math.abs(origin[0]));
                    var displacedExtent2 = (halfExtents2 + Math.abs(origin[2]));
                    if (minLightDistanceX < -displacedExtent0) {
                        minLightDistanceX = -displacedExtent0;
                    }
                    if (maxLightDistanceX > displacedExtent0) {
                        maxLightDistanceX = displacedExtent0;
                    }
                    if (minLightDistanceY < -displacedExtent2) {
                        minLightDistanceY = -displacedExtent2;
                    }
                    if (maxLightDistanceY > displacedExtent2) {
                        maxLightDistanceY = displacedExtent2;
                    }
                } else {
                    if (minLightDistanceX < -halfExtents0) {
                        minLightDistanceX = -halfExtents0;
                    }
                    if (maxLightDistanceX > halfExtents0) {
                        maxLightDistanceX = halfExtents0;
                    }
                    if (minLightDistanceY < -halfExtents2) {
                        minLightDistanceY = -halfExtents2;
                    }
                    if (maxLightDistanceY > halfExtents2) {
                        maxLightDistanceY = halfExtents2;
                    }
                }
                minLightDistanceX /= (minLightDistanceX <= 0 ? minLightDistance : endLightDistance);
                maxLightDistanceX /= (maxLightDistanceX >= 0 ? minLightDistance : endLightDistance);
                minLightDistanceY /= (minLightDistanceY <= 0 ? minLightDistance : endLightDistance);
                maxLightDistanceY /= (maxLightDistanceY >= 0 ? minLightDistance : endLightDistance);
                minimalViewWindowX = ((0.5 * (maxLightDistanceX - minLightDistanceX)) + borderPadding);
                minimalViewWindowY = ((0.5 * (maxLightDistanceY - minLightDistanceY)) + borderPadding);
                if (lightViewWindowX > minimalViewWindowX) {
                    lightViewWindowX = minimalViewWindowX;
                    lightViewOffsetX = (minimalViewWindowX + minLightDistanceX - borderPadding);
                }
                if (lightViewWindowY > minimalViewWindowY) {
                    lightViewWindowY = minimalViewWindowY;
                    lightViewOffsetY = (minimalViewWindowY + minLightDistanceY - borderPadding);
                }
            }
        }

        camera.aspectRatio = 1;
        camera.nearPlane = (lightDepth * distanceScale);
        camera.farPlane = (lightDepth + distanceScale);
        camera.recipViewWindowX = 1.0 / lightViewWindowX;
        camera.recipViewWindowY = 1.0 / lightViewWindowY;
        camera.viewOffsetX = lightViewOffsetX;
        camera.viewOffsetY = lightViewOffsetY;

        if (minLightDistance > camera.nearPlane) {
            camera.nearPlane = minLightDistance;
        }
        if (camera.farPlane > maxLightDistance) {
            camera.farPlane = maxLightDistance;
        }

        camera.updateProjectionMatrix();
        camera.updateViewProjectionMatrix();
        var shadowProjection = camera.viewProjectionMatrix;

        var maxDepthReciprocal = (1.0 / (maxLightDistance - minLightDistance));
        var techniqueParameters = lightInstance.techniqueParameters;
        techniqueParameters.shadowProjection = md.m43MulM44(cameraMatrix, shadowProjection, techniqueParameters.shadowProjection);
        var viewToShadowMatrix = md.m43Mul(cameraMatrix, viewMatrix, this.tempMatrix43);
        techniqueParameters.shadowDepth = md.v4Build(-viewToShadowMatrix[2] * maxDepthReciprocal, -viewToShadowMatrix[5] * maxDepthReciprocal, -viewToShadowMatrix[8] * maxDepthReciprocal, (-viewToShadowMatrix[11] - minLightDistance) * maxDepthReciprocal, techniqueParameters.shadowDepth);
        techniqueParameters.shadowSize = shadowMapSize;
        techniqueParameters.shadowMapTexture = shadowMapTexture;

        var frameUpdated = lightInstance.frameVisible;

        if (numStaticOverlappingRenderables === numOverlappingRenderables && !node.dynamic) {
            if (shadowMap.numRenderables === numOccluders && shadowMap.lightNode === node && (shadowMap.frameUpdated + 1) === frameUpdated) {
                // No need to update shadowmap
                //Utilities.log(numOccluders);
                shadowMap.frameUpdated = frameUpdated;
                shadowMap.needsBlur = false;
                return;
            } else {
                shadowMap.numRenderables = numOccluders;
                shadowMap.lightNode = node;
                shadowMap.frameUpdated = frameUpdated;
                shadowMap.frameVisible = frameUpdated;
                shadowMap.needsBlur = this.blurEnabled;
            }
        } else {
            shadowMap.numRenderables = numOccluders;
            shadowMap.frameVisible = frameUpdated;
            shadowMap.needsBlur = this.blurEnabled;
        }

        if (!gd.beginRenderTarget(shadowMapRenderTarget)) {
            return;
        }

        gd.clear(this.clearColor, 1.0, 0);

        var shadowMapTechniqueParameters = this.techniqueParameters;
        shadowMapTechniqueParameters['viewTranspose'] = md.m43Transpose(viewMatrix, shadowMapTechniqueParameters['viewTranspose']);
        shadowMapTechniqueParameters['shadowProjectionTranspose'] = md.m44Transpose(camera.projectionMatrix, shadowMapTechniqueParameters['shadowProjectionTranspose']);
        shadowMapTechniqueParameters['shadowDepth'] = md.v4Build(0, 0, -maxDepthReciprocal, -minLightDistance * maxDepthReciprocal, shadowMapTechniqueParameters['shadowDepth']);

        gd.drawArray(occludersDrawArray, [shadowMapTechniqueParameters], 1);

        gd.endRenderTarget();
    };

    ShadowMapping.prototype._filterOccluders = function (overlappingRenderables, numStaticOverlappingRenderables, occludersDrawArray, occludersExtents) {
        var numOverlappingRenderables = overlappingRenderables.length;
        var numOccluders = 0;
        var n, renderable, worldExtents, rendererInfo;
        var drawParametersArray, numDrawParameters, drawParametersIndex;
        for (n = 0; n < numOverlappingRenderables; n += 1) {
            renderable = overlappingRenderables[n];
            if (!(renderable.disabled || renderable.node.disabled || renderable.sharedMaterial.meta.noshadows)) {
                rendererInfo = renderable.rendererInfo;
                if (!rendererInfo) {
                    rendererInfo = renderingCommonCreateRendererInfoFn(renderable);
                }

                if (rendererInfo.shadowMappingUpdate && renderable.shadowMappingDrawParameters) {
                    rendererInfo.shadowMappingUpdate.call(renderable);

                    if (n >= numStaticOverlappingRenderables) {
                        worldExtents = renderable.getWorldExtents();
                    } else {
                        // We can use the property directly because as it is static it should not change!
                        worldExtents = renderable.worldExtents;
                    }

                    drawParametersArray = renderable.shadowMappingDrawParameters;
                    numDrawParameters = drawParametersArray.length;
                    for (drawParametersIndex = 0; drawParametersIndex < numDrawParameters; drawParametersIndex += 1) {
                        occludersDrawArray[numOccluders] = drawParametersArray[drawParametersIndex];
                        occludersExtents[numOccluders] = worldExtents;
                        numOccluders += 1;
                    }
                }
            }
        }
        return numOccluders;
    };

    ShadowMapping.prototype._updateOccludersLimits = function (lightInstance, viewMatrix, occludersDrawArray, occludersExtents, numOccluders) {
        var r0 = -viewMatrix[0];
        var r1 = -viewMatrix[3];
        var r2 = -viewMatrix[6];
        var roffset = viewMatrix[9];

        var u0 = -viewMatrix[1];
        var u1 = -viewMatrix[4];
        var u2 = -viewMatrix[7];
        var uoffset = viewMatrix[10];

        var d0 = -viewMatrix[2];
        var d1 = -viewMatrix[5];
        var d2 = -viewMatrix[8];
        var offset = viewMatrix[11];

        var minLightDistance = Number.MAX_VALUE;
        var maxLightDistance = -minLightDistance;
        var minLightDistanceX = minLightDistance;
        var maxLightDistanceX = -minLightDistance;
        var minLightDistanceY = minLightDistance;
        var maxLightDistanceY = -minLightDistance;

        var n, extents, n0, n1, n2, p0, p1, p2, lightDistance;

        for (n = 0; n < numOccluders;) {
            extents = occludersExtents[n];
            n0 = extents[0];
            n1 = extents[1];
            n2 = extents[2];
            p0 = extents[3];
            p1 = extents[4];
            p2 = extents[5];
            lightDistance = ((d0 * (d0 > 0 ? p0 : n0)) + (d1 * (d1 > 0 ? p1 : n1)) + (d2 * (d2 > 0 ? p2 : n2)));
            if (lightDistance > offset) {
                lightDistance = (lightDistance - offset);
                if (maxLightDistance < lightDistance) {
                    maxLightDistance = lightDistance;
                }

                if (0 < minLightDistance) {
                    lightDistance = ((d0 * (d0 > 0 ? n0 : p0)) + (d1 * (d1 > 0 ? n1 : p1)) + (d2 * (d2 > 0 ? n2 : p2)) - offset);
                    if (lightDistance < minLightDistance) {
                        minLightDistance = lightDistance;
                        if (0 >= minLightDistance) {
                            continue;
                        }
                    }

                    lightDistance = ((r0 * (r0 > 0 ? n0 : p0)) + (r1 * (r1 > 0 ? n1 : p1)) + (r2 * (r2 > 0 ? n2 : p2)) - roffset);
                    if (lightDistance < minLightDistanceX) {
                        minLightDistanceX = lightDistance;
                    }

                    lightDistance = ((r0 * (r0 > 0 ? p0 : n0)) + (r1 * (r1 > 0 ? p1 : n1)) + (r2 * (r2 > 0 ? p2 : n2)) - roffset);
                    if (maxLightDistanceX < lightDistance) {
                        maxLightDistanceX = lightDistance;
                    }

                    lightDistance = ((u0 * (u0 > 0 ? n0 : p0)) + (u1 * (u1 > 0 ? n1 : p1)) + (u2 * (u2 > 0 ? n2 : p2)) - uoffset);
                    if (lightDistance < minLightDistanceY) {
                        minLightDistanceY = lightDistance;
                    }

                    lightDistance = ((u0 * (u0 > 0 ? p0 : n0)) + (u1 * (u1 > 0 ? p1 : n1)) + (u2 * (u2 > 0 ? p2 : n2)) - uoffset);
                    if (maxLightDistanceY < lightDistance) {
                        maxLightDistanceY = lightDistance;
                    }
                }

                n += 1;
            } else {
                numOccluders -= 1;
                if (n < numOccluders) {
                    occludersDrawArray[n] = occludersDrawArray[numOccluders];
                    occludersExtents[n] = occludersExtents[numOccluders];
                } else {
                    break;
                }
            }
        }

        if (minLightDistance < 0) {
            minLightDistance = 0;
        }

        if (maxLightDistance > lightInstance.lightDepth) {
            maxLightDistance = lightInstance.lightDepth;
        }

        lightInstance.minLightDistance = minLightDistance;
        lightInstance.maxLightDistance = maxLightDistance;
        lightInstance.minLightDistanceX = minLightDistanceX;
        lightInstance.maxLightDistanceX = maxLightDistanceX;
        lightInstance.minLightDistanceY = minLightDistanceY;
        lightInstance.maxLightDistanceY = maxLightDistanceY;

        return numOccluders;
    };

    ShadowMapping.prototype.blurShadowMaps = function () {
        var gd = this.gd;
        var numShadowMaps, n, shadowMaps, shadowMap, shadowMapBlurTexture, shadowMapBlurRenderTarget;

        gd.setStream(this.quadVertexBuffer, this.quadSemantics);

        var shadowMappingBlurTechnique = this.blurTechnique;
        gd.setTechnique(shadowMappingBlurTechnique);

        var quadPrimitive = this.quadPrimitive;

        var pixelOffsetH = this.pixelOffsetH;
        var pixelOffsetV = this.pixelOffsetV;

        numShadowMaps = this.highIndex;
        if (numShadowMaps) {
            shadowMaps = this.shadowMapsHigh;
            shadowMapBlurTexture = this.blurTextureHigh;
            shadowMapBlurRenderTarget = this.blurRenderTargetHigh;
            pixelOffsetV[1] = pixelOffsetH[0] = (1.0 / this.sizeHigh);
            for (n = 0; n < numShadowMaps; n += 1) {
                shadowMap = shadowMaps[n];
                if (shadowMap.needsBlur) {
                    if (!gd.beginRenderTarget(shadowMapBlurRenderTarget)) {
                        break;
                    }

                    shadowMappingBlurTechnique['shadowMap'] = shadowMap.texture;
                    shadowMappingBlurTechnique['pixelOffset'] = pixelOffsetH;
                    gd.draw(quadPrimitive, 4);

                    gd.endRenderTarget();

                    if (!gd.beginRenderTarget(shadowMap.renderTarget)) {
                        break;
                    }

                    shadowMappingBlurTechnique['shadowMap'] = shadowMapBlurTexture;
                    shadowMappingBlurTechnique['pixelOffset'] = pixelOffsetV;
                    gd.draw(quadPrimitive, 4);

                    gd.endRenderTarget();
                }
            }
        }

        numShadowMaps = this.lowIndex;
        if (numShadowMaps) {
            shadowMaps = this.shadowMapsLow;
            shadowMapBlurTexture = this.blurTextureLow;
            shadowMapBlurRenderTarget = this.blurRenderTargetLow;
            pixelOffsetV[1] = pixelOffsetH[0] = (1.0 / this.sizeLow);
            for (n = 0; n < numShadowMaps; n += 1) {
                shadowMap = shadowMaps[n];
                if (shadowMap.needsBlur) {
                    if (!gd.beginRenderTarget(shadowMapBlurRenderTarget)) {
                        break;
                    }

                    shadowMappingBlurTechnique['shadowMap'] = shadowMap.texture;
                    shadowMappingBlurTechnique['pixelOffset'] = pixelOffsetH;
                    gd.draw(quadPrimitive, 4);

                    gd.endRenderTarget();

                    if (!gd.beginRenderTarget(shadowMap.renderTarget)) {
                        break;
                    }

                    shadowMappingBlurTechnique['shadowMap'] = shadowMapBlurTexture;
                    shadowMappingBlurTechnique['pixelOffset'] = pixelOffsetV;
                    gd.draw(quadPrimitive, 4);

                    gd.endRenderTarget();
                }
            }
        }
    };

    ShadowMapping.prototype.lookAt = function (camera, lookAt, up, eyePosition) {
        var md = this.md;
        var zaxis = md.v3Sub(eyePosition, lookAt, this.tempV3AxisZ);
        md.v3Normalize(zaxis, zaxis);
        var xaxis = md.v3Cross(md.v3Normalize(up, up), zaxis, this.tempV3AxisX);
        md.v3Normalize(xaxis, xaxis);
        var yaxis = md.v3Cross(zaxis, xaxis, this.tempV3AxisY);
        camera.matrix = md.m43Build(xaxis, yaxis, zaxis, eyePosition, camera.matrix);
    };

    ShadowMapping.prototype.destroy = function () {
        delete this.shader;
        delete this.rigidTechnique;
        delete this.skinnedTechnique;
        delete this.blurTechnique;

        this.destroyBuffers();

        delete this.tempV3AxisZ;
        delete this.tempV3AxisY;
        delete this.tempV3AxisX;
        delete this.tempV3Pos;
        delete this.tempV3At;
        delete this.tempV3Up;
        delete this.tempMatrix43;
        delete this.clearColor;

        delete this.quadPrimitive;
        delete this.quadSemantics;

        if (this.quadVertexBuffer) {
            this.quadVertexBuffer.destroy();
            delete this.quadVertexBuffer;
        }

        delete this.shadowMapsLow;
        delete this.shadowMapsHigh;
        delete this.techniqueParameters;
        delete this.occludersExtents;
        delete this.md;
        delete this.gd;
    };

    ShadowMapping.create = // Constructor function
    function (gd, md, shaderManager, effectsManager, sizeLow, sizeHigh) {
        var shadowMapping = new ShadowMapping();

        shaderManager.load("shaders/shadowmapping.cgfx");

        shadowMapping.gd = gd;
        shadowMapping.md = md;
        shadowMapping.clearColor = md.v4Build(1, 1, 1, 1);
        shadowMapping.tempMatrix43 = md.m43BuildIdentity();
        shadowMapping.tempV3Up = md.v3BuildZero();
        shadowMapping.tempV3At = md.v3BuildZero();
        shadowMapping.tempV3Pos = md.v3BuildZero();
        shadowMapping.tempV3AxisX = md.v3BuildZero();
        shadowMapping.tempV3AxisY = md.v3BuildZero();
        shadowMapping.tempV3AxisZ = md.v3BuildZero();

        shadowMapping.quadPrimitive = gd.PRIMITIVE_TRIANGLE_STRIP;
        shadowMapping.quadSemantics = gd.createSemantics(['POSITION', 'TEXCOORD0']);

        shadowMapping.quadVertexBuffer = gd.createVertexBuffer({
            numVertices: 4,
            attributes: ['FLOAT2', 'FLOAT2'],
            dynamic: false,
            data: [
                -1.0,
                1.0,
                0.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                -1.0,
                -1.0,
                0.0,
                0.0,
                1.0,
                -1.0,
                1.0,
                0.0
            ]
        });

        shadowMapping.pixelOffsetH = [0, 0];
        shadowMapping.pixelOffsetV = [0, 0];

        shadowMapping.bufferWidth = 0;
        shadowMapping.bufferHeight = 0;

        shadowMapping.techniqueParameters = gd.createTechniqueParameters();
        shadowMapping.shader = null;
        shadowMapping.shadowMapsLow = [];
        shadowMapping.shadowMapsHigh = [];

        sizeLow = sizeLow || shadowMapping.defaultSizeLow;
        sizeHigh = sizeHigh || shadowMapping.defaultSizeHigh;
        shadowMapping.updateBuffers(sizeLow, sizeHigh);

        shadowMapping.occludersExtents = [];

        var precision = gd.maxSupported("FRAGMENT_SHADER_PRECISION");
        if (precision && precision < 16) {
            shadowMapping.blurEnabled = false;
        }

        return shadowMapping;
    };
    ShadowMapping.version = 1;
    return ShadowMapping;
})();
// Copyright (c) 2013 Turbulenz Limited
;

var TextureEffects = (function () {
    function TextureEffects() {
    }
    // Methods
    TextureEffects.prototype.grayScaleMatrix = function (dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }
        dst[0] = 0.2126;
        dst[1] = 0.2126;
        dst[2] = 0.2126;
        dst[3] = 0.7152;
        dst[4] = 0.7152;
        dst[5] = 0.7152;
        dst[6] = 0.0722;
        dst[7] = 0.0722;
        dst[8] = 0.0722;
        dst[9] = dst[10] = dst[11] = 0;
        return dst;
    };

    TextureEffects.prototype.sepiaMatrix = function (dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }
        dst[0] = 0.393;
        dst[1] = 0.349;
        dst[2] = 0.272;
        dst[3] = 0.769;
        dst[4] = 0.686;
        dst[5] = 0.534;
        dst[6] = 0.189;
        dst[7] = 0.168;
        dst[8] = 0.131;
        dst[9] = dst[10] = dst[11] = 0;
        return dst;
    };

    TextureEffects.prototype.negativeMatrix = function (dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }
        dst[0] = dst[4] = dst[8] = -1;
        dst[1] = dst[2] = dst[3] = dst[5] = dst[6] = dst[7] = 0;
        dst[9] = dst[10] = dst[11] = 1;
        return dst;
    };

    TextureEffects.prototype.saturationMatrix = function (saturationScale, dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }
        var is = (1 - saturationScale);
        dst[0] = (is * 0.2126) + saturationScale;
        dst[1] = (is * 0.2126);
        dst[2] = (is * 0.2126);
        dst[3] = (is * 0.7152);
        dst[4] = (is * 0.7152) + saturationScale;
        dst[5] = (is * 0.7152);
        dst[6] = (is * 0.0722);
        dst[7] = (is * 0.0722);
        dst[8] = (is * 0.0722) + saturationScale;
        dst[9] = dst[10] = dst[11] = 0;
        return dst;
    };

    TextureEffects.prototype.hueMatrix = function (angle, dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }

        ////
        //// Uncomment to calculate new coeffecients should luminance
        //// values 0.2126 0.7152 0.0722 change.
        //var lumR = 0.2126;
        //var lumG = 0.7152;
        //var lumB = 0.0722;
        ////
        //Var r23 = Math.sqrt(2 / 3);
        //Var r12 = 1 / Math.sqrt(2);
        //Var r13 = 1 / Math.sqrt(3);
        //Var r16 = 1 / Math.sqrt(6);
        //Var M = [r23, 0, r13, -r16, r12, r13, -r16, -r12, r13, 0, 0, 0];
        //Var zx = (r23 * lumR) - (r16 * lumG) - (r16 * lumB);
        //Var zy =                (r12 * lumG) - (r12 * lumB);
        //Var zz = (r13 * lumR) + (r13 * lumG) + (r13 * lumB);
        //Var x = zx / zz;
        //Var y = zy / zz;
        //Var C = [1, 0, x, 0, 1, y, 0, 0, 1, 0, 0, 0];
        //M = this.mathDevice.m43Mul(M, C, M);
        //Console.log("Pre transform = ", M);
        //Var E = [1, 0, -x, 0, 1, -y, 0, 0, 1, 0, 0, 0];
        //Var N = [r23, -r16, -r16, 0, r12, -r12, r13, r13, r13, 0, 0, 0];
        //This.mathDevice.m43Mul(E, N, N);
        //Console.log("Post transform = ", N);
        ////
        //// Final matrix is then: m43Mul(Pre, [c, s, 0, -s, c, 0, 0, 0, 1, 0, 0, 0, ], Post);
        //// for c = cos(angle), s = sin(angle)
        ////
        //Var out = "";
        //Out += "var c = Math.cos(angle);\n";
        //Out += "var s = Math.sin(angle);\n";
        //Out += "dst[0] = (" + (N[0]*M[0]+N[3]*M[1]) + " * c) + (" + (N[3]*M[0]-N[0]*M[1]) + " * s) + " + lumR+";\n";
        //Out += "dst[1] = (" + (-lumR)               + " * c) + (" + (N[4]*M[0]-N[1]*M[1]) + " * s) + " + lumR+";\n";
        //Out += "dst[2] = (" + (-lumR)               + " * c) + (" + (N[5]*M[0]-N[2]*M[1]) + " * s) + " + lumR+";\n";
        //Out += "dst[3] = (" + (-lumG)               + " * c) + (" + (N[3]*M[3]-N[0]*M[4]) + " * s) + " + lumG+";\n";
        //Out += "dst[4] = (" + (N[1]*M[3]+N[4]*M[4]) + " * c) + (" + (N[4]*M[3]-N[1]*M[4]) + " * s) + " + lumG+";\n";
        //Out += "dst[5] = (" + (-lumG)               + " * c) + (" + (N[5]*M[3]-N[2]*M[4]) + " * s) + " + lumG+";\n";
        //Out += "dst[6] = (" + (-lumB)               + " * c) + (" + (N[3]*M[6]-N[0]*M[7]) + " * s) + " + lumB+";\n";
        //Out += "dst[7] = (" + (-lumB)               + " * c) + (" + (N[4]*M[6]-N[1]*M[7]) + " * s) + " + lumB+";\n";
        //Out += "dst[8] = (" + (N[2]*M[6]+N[5]*M[7]) + " * c) + (" + (N[5]*M[6]-N[2]*M[7]) + " * s) + " + lumB+";\n";
        //Console.log(out);
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        dst[0] = (0.7874 * c) + (-0.3712362230889293 * s) + 0.2126;
        dst[1] = (-0.2126 * c) + (0.20611404610069642 * s) + 0.2126;
        dst[2] = (-0.2126 * c) + (-0.9485864922785551 * s) + 0.2126;
        dst[3] = (-0.7152 * c) + (-0.4962902913954023 * s) + 0.7152;
        dst[4] = (0.2848 * c) + (0.08105997779422341 * s) + 0.7152;
        dst[5] = (-0.7152 * c) + (0.6584102469838492 * s) + 0.7152;
        dst[6] = (-0.0722 * c) + (0.8675265144843316 * s) + 0.0722;
        dst[7] = (-0.0722 * c) + (-0.28717402389491986 * s) + 0.0722;
        dst[8] = (0.9278 * c) + (0.290176245294706 * s) + 0.0722;
        dst[9] = dst[10] = dst[11] = 0;

        return dst;
    };

    TextureEffects.prototype.brightnessMatrix = function (brightnessOffset, dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }

        dst[0] = dst[4] = dst[8] = 1;
        dst[1] = dst[2] = dst[3] = dst[5] = dst[6] = dst[7] = 0;
        dst[9] = dst[10] = dst[11] = brightnessOffset;

        return dst;
    };

    TextureEffects.prototype.additiveMatrix = function (additiveRGB, dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }

        dst[0] = dst[4] = dst[8] = 1;
        dst[1] = dst[2] = dst[3] = dst[5] = dst[6] = dst[7] = 0;
        dst[9] = additiveRGB[0];
        dst[10] = additiveRGB[1];
        dst[11] = additiveRGB[2];

        return dst;
    };

    TextureEffects.prototype.contrastMatrix = function (contrastScale, dst) {
        if (dst === undefined) {
            dst = this.mathDevice.m43BuildIdentity();
        }

        dst[0] = dst[4] = dst[8] = contrastScale;
        dst[1] = dst[2] = dst[3] = dst[5] = dst[6] = dst[7] = 0;
        dst[9] = dst[10] = dst[11] = 0.5 * (1 - contrastScale);

        return dst;
    };

    TextureEffects.prototype.applyBloom = function (params) {
        var source = params.source;
        var blur1 = params.blurTarget1;
        var blur2 = params.blurTarget2;
        var dest = params.destination;
        if (!source || !dest || !blur1 || !blur2 || !blur1.colorTexture0 || !blur2.colorTexture0 || blur1 === blur2 || blur1 === dest || source === blur1.colorTexture0 || source === dest.colorTexture0) {
            return false;
        }

        var effectParams = this.effectParams;
        var techparams;

        // Threshold copy.
        techparams = this.bloomThresholdParameters;
        effectParams.technique = this.bloomThresholdTechnique;
        effectParams.params = techparams;

        techparams.bloomThreshold = (params.bloomThreshold !== undefined) ? params.bloomThreshold : 0.65;
        techparams.thresholdCutoff = Math.exp((params.thresholdCutoff !== undefined) ? params.thresholdCutoff : 3);
        techparams.inputTexture0 = source;
        effectParams.destination = blur1;
        this.applyEffect(effectParams);

        // Gaussian blur.
        techparams = this.gaussianBlurParameters;
        effectParams.technique = this.gaussianBlurTechnique;
        effectParams.params = techparams;

        var sampleRadius = (params.blurRadius || 20);
        techparams.sampleRadius[0] = sampleRadius / source.width;
        techparams.sampleRadius[1] = 0;
        techparams.inputTexture0 = blur1.colorTexture0;
        effectParams.destination = blur2;
        this.applyEffect(effectParams);

        techparams.sampleRadius[0] = 0;
        techparams.sampleRadius[1] = sampleRadius / source.height;
        techparams.inputTexture0 = blur2.colorTexture0;
        effectParams.destination = blur1;
        this.applyEffect(effectParams);

        // Merge.
        techparams = this.bloomMergeParameters;
        effectParams.technique = this.bloomMergeTechnique;
        effectParams.params = techparams;

        techparams.bloomIntensity = (params.bloomIntensity !== undefined) ? params.bloomIntensity : 1.2;
        techparams.bloomSaturation = (params.bloomSaturation !== undefined) ? params.bloomSaturation : 1.2;
        techparams.originalIntensity = (params.originalIntensity !== undefined) ? params.originalIntensity : 1.0;
        techparams.originalSaturation = (params.originalSaturation !== undefined) ? params.originalSaturation : 1.0;
        techparams.inputTexture0 = source;
        techparams.inputTexture1 = blur1.colorTexture0;
        effectParams.destination = dest;
        this.applyEffect(effectParams);

        return true;
    };

    TextureEffects.prototype.applyGaussianBlur = function (params) {
        var source = params.source;
        var blur = params.blurTarget;
        var dest = params.destination;
        if (!source || !dest || !blur || !blur.colorTexture0 || blur === dest || source === blur.colorTexture0) {
            return false;
        }

        var effectParams = this.effectParams;
        var techparams = this.gaussianBlurParameters;
        effectParams.technique = this.gaussianBlurTechnique;
        effectParams.params = techparams;

        var sampleRadius = (params.blurRadius || 5);
        techparams['sampleRadius'][0] = sampleRadius / source.width;
        techparams['sampleRadius'][1] = 0;
        techparams['inputTexture0'] = source;
        effectParams['destination'] = blur;
        this.applyEffect(effectParams);

        techparams['sampleRadius'][0] = 0;
        techparams['sampleRadius'][1] = sampleRadius / source.height;
        techparams['inputTexture0'] = blur.colorTexture0;
        effectParams['destination'] = dest;
        this.applyEffect(effectParams);

        return true;
    };

    TextureEffects.prototype.applyColorMatrix = function (params) {
        var source = params.source;
        var dest = params.destination;
        if (!source || !dest || !dest.colorTexture0 || source === dest.colorTexture0) {
            return false;
        }

        var effectParams = this.effectParams;
        var techparams = this.colorMatrixParameters;
        effectParams.technique = this.colorMatrixTechnique;
        effectParams.params = techparams;

        var matrix = params.colorMatrix;

        // TODO: cache 'colorMatrix' here
        techparams['colorMatrix'][0] = matrix[0];
        techparams['colorMatrix'][1] = matrix[3];
        techparams['colorMatrix'][2] = matrix[6];
        techparams['colorMatrix'][3] = matrix[9];
        techparams['colorMatrix'][4] = matrix[1];
        techparams['colorMatrix'][5] = matrix[4];
        techparams['colorMatrix'][6] = matrix[7];
        techparams['colorMatrix'][7] = matrix[10];
        techparams['colorMatrix'][8] = matrix[2];
        techparams['colorMatrix'][9] = matrix[5];
        techparams['colorMatrix'][10] = matrix[8];
        techparams['colorMatrix'][11] = matrix[11];

        techparams['inputTexture0'] = source;
        effectParams.destination = dest;
        this.applyEffect(effectParams);

        return true;
    };

    TextureEffects.prototype.applyDistort = function (params) {
        var source = params.source;
        var dest = params.destination;
        var distort = params.distortion;
        if (!source || !dest || !distort || !dest.colorTexture0 || source === dest.colorTexture0 || distort === dest.colorTexture0) {
            return false;
        }

        // input transform.
        //  a b tx
        //  c d ty
        var a, b, c, d, tx, ty;

        var transform = params.transform;
        if (transform) {
            // transform col-major.
            a = transform[0];
            b = transform[2];
            tx = transform[4];
            c = transform[1];
            d = transform[3];
            ty = transform[5];
        } else {
            a = d = 1;
            b = c = 0;
            tx = ty = 0;
        }

        var effectParams = this.effectParams;
        var techparams = this.distortParameters;
        effectParams.technique = this.distortTechnique;
        effectParams.params = techparams;

        // TODO: Cache 'transform', 'invTransform', etc in the code below
        techparams['transform'][0] = a;
        techparams['transform'][1] = b;
        techparams['transform'][2] = tx;
        techparams['transform'][3] = c;
        techparams['transform'][4] = d;
        techparams['transform'][5] = ty;

        // Compute inverse transform to use in distort texture displacement..
        var idet = 1 / (a * d - b * c);
        var ia = techparams['invTransform'][0] = (idet * d);
        var ib = techparams['invTransform'][1] = (idet * -b);
        var ic = techparams['invTransform'][2] = (idet * -c);
        var id = techparams['invTransform'][3] = (idet * a);

        // Compute max pixel offset after transform for normalisation.
        var x1 = ((ia + ib) * (ia + ib)) + ((ic + id) * (ic + id));
        var x2 = ((ia - ib) * (ia - ib)) + ((ic - id) * (ic - id));
        var x3 = ((-ia + ib) * (-ia + ib)) + ((-ic + id) * (-ic + id));
        var x4 = ((-ia - ib) * (-ia - ib)) + ((-ic - id) * (-ic - id));
        var xmax = 0.5 * Math.sqrt(Math.max(x1, x2, x3, x4));

        var strength = (params.strength || 10);
        techparams['strength'][0] = strength / (source.width * xmax);
        techparams['strength'][1] = strength / (source.height * xmax);

        techparams['inputTexture0'] = source;
        techparams['distortTexture'] = distort;
        effectParams.destination = dest;
        this.applyEffect(effectParams);

        return true;
    };

    TextureEffects.prototype.applyEffect = function (effect) {
        var graphicsDevice = this.graphicsDevice;

        var dest = effect.destination;
        if (graphicsDevice.beginRenderTarget(dest)) {
            graphicsDevice.setTechnique(effect.technique);
            graphicsDevice.setTechniqueParameters(effect.params);

            graphicsDevice.setStream(this.staticVertexBuffer, this.quadSemantics);
            graphicsDevice.draw(this.quadPrimitive, 4);

            graphicsDevice.endRenderTarget();
        }
    };

    TextureEffects.prototype.destroy = function () {
        this.staticVertexBuffer.destroy();

        delete this.graphicsDevice;
        delete this.mathDevice;
    };

    TextureEffects.create = function (params) {
        var e = new TextureEffects();

        var gd = params.graphicsDevice;
        var md = params.mathDevice;

        e.graphicsDevice = gd;
        e.mathDevice = md;

        e.staticVertexBufferParams = {
            numVertices: 4,
            attributes: ['FLOAT2', 'FLOAT2'],
            dynamic: false,
            data: [
                -1,
                -1,
                0,
                0,
                1,
                -1,
                1,
                0,
                -1,
                1,
                0,
                1,
                1,
                1,
                1,
                1
            ]
        };

        e.staticVertexBuffer = gd.createVertexBuffer(e.staticVertexBufferParams);

        e.effectParams = {
            technique: null,
            params: null,
            destination: null
        };

        e.quadSemantics = gd.createSemantics(['POSITION', 'TEXCOORD0']);
        e.quadPrimitive = gd.PRIMITIVE_TRIANGLE_STRIP;

        // Distort effect.
        // ---------------
        e.distortParameters = gd.createTechniqueParameters({
            inputTexture0: null,
            distortTexture: null,
            strength: [0, 0],
            transform: [0, 0, 0, 0, 0, 0],
            invTransform: [0, 0, 0, 0]
        });

        // Color matrix effect.
        // --------------------
        e.colorMatrixParameters = gd.createTechniqueParameters({
            inputTexture0: null,
            colorMatrix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        });

        // Bloom effect.
        // ------------
        e.bloomThresholdParameters = gd.createTechniqueParameters({
            inputTexture0: null,
            bloomThreshold: 0,
            thresholdCuttoff: 0
        });

        e.bloomMergeParameters = gd.createTechniqueParameters({
            inputTexture0: null,
            inputTexture1: null,
            bloomIntensity: 0,
            bloomSaturation: 0,
            originalIntensity: 0,
            originalSaturation: 0
        });

        // Gaussian Blur effect.
        // ---------------------
        // (also used by bloom)
        e.gaussianBlurParameters = gd.createTechniqueParameters({
            inputTexture0: null,
            sampleRadius: [1, 1]
        });

        // Shader embedding.
        // -----------------
        var shader = gd.createShader({
            "version": 1,
            "name": "textureeffects.cgfx",
            "samplers": {
                "inputTexture0": {
                    "MinFilter": 9729,
                    "MagFilter": 9729,
                    "WrapS": 33071,
                    "WrapT": 33071
                },
                "inputTexture1": {
                    "MinFilter": 9729,
                    "MagFilter": 9729,
                    "WrapS": 33071,
                    "WrapT": 33071
                },
                "inputTexture2": {
                    "MinFilter": 9729,
                    "MagFilter": 9729,
                    "WrapS": 33071,
                    "WrapT": 33071
                },
                "distortTexture": {
                    "MinFilter": 9729,
                    "MagFilter": 9729,
                    "WrapS": 10497,
                    "WrapT": 10497
                }
            },
            "parameters": {
                "strength": {
                    "type": "float",
                    "columns": 2
                },
                "transform": {
                    "type": "float",
                    "rows": 2,
                    "columns": 3
                },
                "invTransform": {
                    "type": "float",
                    "rows": 2,
                    "columns": 2
                },
                "colorMatrix": {
                    "type": "float",
                    "rows": 3,
                    "columns": 4
                },
                "sampleRadius": {
                    "type": "float",
                    "columns": 2
                },
                "bloomThreshold": {
                    "type": "float"
                },
                "thresholdCutoff": {
                    "type": "float"
                },
                "bloomSaturation": {
                    "type": "float"
                },
                "originalSaturation": {
                    "type": "float"
                },
                "bloomIntensity": {
                    "type": "float"
                },
                "originalIntensity": {
                    "type": "float"
                },
                "inputTexture0": {
                    "type": "sampler2D"
                },
                "inputTexture1": {
                    "type": "sampler2D"
                },
                "inputTexture2": {
                    "type": "sampler2D"
                },
                "distortTexture": {
                    "type": "sampler2D"
                },
                "Gauss": {
                    "type": "float",
                    "rows": 9,
                    "values": [0.93, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]
                }
            },
            "techniques": {
                "distort": [
                    {
                        "parameters": ["strength", "transform", "invTransform", "inputTexture0", "distortTexture"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_copy", "fp_distort"]
                    }
                ],
                "copyColorMatrix": [
                    {
                        "parameters": ["colorMatrix", "inputTexture0"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_copy", "fp_colorMatrix"]
                    }
                ],
                "bloomThreshold": [
                    {
                        "parameters": ["bloomThreshold", "thresholdCutoff", "inputTexture0"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_copy", "fp_bloom_threshold"]
                    }
                ],
                "bloomMerge": [
                    {
                        "parameters": ["bloomSaturation", "originalSaturation", "bloomIntensity", "originalIntensity", "inputTexture0", "inputTexture1"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_copy", "fp_bloom_merge"]
                    }
                ],
                "gaussianBlur": [
                    {
                        "parameters": ["sampleRadius", "inputTexture0", "Gauss"],
                        "semantics": ["POSITION", "TEXCOORD0"],
                        "states": {
                            "DepthTestEnable": false,
                            "DepthMask": false,
                            "CullFaceEnable": false,
                            "BlendEnable": false
                        },
                        "programs": ["vp_copy", "fp_gaussian_blur"]
                    }
                ]
            },
            "programs": {
                "fp_gaussian_blur": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nvec4 _ret_0;vec4 _TMP2;vec4 _TMP1;vec2 _c0022;vec2 _c0024;uniform vec2 sampleRadius;uniform sampler2D inputTexture0;uniform float Gauss[9];void main()\n{vec2 _step;vec4 _color;vec2 _dir;_step=sampleRadius/9.0;_color=texture2D(inputTexture0,tz_TexCoord[0].xy);_c0022=tz_TexCoord[0].xy+_step;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[0];_c0024=tz_TexCoord[0].xy-_step;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[0];_dir=_step+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[1];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[1];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[2];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[2];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[3];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[3];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[4];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[4];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[5];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[5];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[6];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[6];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[7];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[7];_dir=_dir+_step;_c0022=tz_TexCoord[0].xy+_dir;_TMP1=texture2D(inputTexture0,_c0022);_color=_color+_TMP1*Gauss[8];_c0024=tz_TexCoord[0].xy-_dir;_TMP2=texture2D(inputTexture0,_c0024);_color=_color+_TMP2*Gauss[8];_ret_0=_color*9.94035751E-02;gl_FragColor=_ret_0;}"
                },
                "vp_copy": {
                    "type": "vertex",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];attribute vec4 ATTR0;attribute vec4 ATTR8;\nvec4 _OutPosition1;vec2 _OutUV1;void main()\n{_OutPosition1=ATTR0;_OutUV1=ATTR8.xy;tz_TexCoord[0].xy=ATTR8.xy;gl_Position=ATTR0;}"
                },
                "fp_bloom_merge": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nvec4 _ret_0;vec4 _TMP3;vec4 _TMP5;float _TMP2;vec4 _TMP1;float _TMP0;vec4 _TMP36;uniform float bloomSaturation;uniform float originalSaturation;uniform float bloomIntensity;uniform float originalIntensity;uniform sampler2D inputTexture0;uniform sampler2D inputTexture1;void main()\n{vec4 _orig;vec4 _bloom;_orig=texture2D(inputTexture0,tz_TexCoord[0].xy);_bloom=texture2D(inputTexture1,tz_TexCoord[0].xy);_TMP0=dot(_bloom.xyz,vec3(2.12599993E-01,7.15200007E-01,7.22000003E-02));_TMP1=vec4(_TMP0,_TMP0,_TMP0,_TMP0)+bloomSaturation*(_bloom-vec4(_TMP0,_TMP0,_TMP0,_TMP0));_bloom=_TMP1*bloomIntensity;_TMP2=dot(_orig.xyz,vec3(2.12599993E-01,7.15200007E-01,7.22000003E-02));_TMP3=vec4(_TMP2,_TMP2,_TMP2,_TMP2)+originalSaturation*(_orig-vec4(_TMP2,_TMP2,_TMP2,_TMP2));_TMP5=min(vec4(1.0,1.0,1.0,1.0),_bloom);_TMP36=max(vec4(0.0,0.0,0.0,0.0),_TMP5);_orig=(_TMP3*(1.0-_TMP36))*originalIntensity;_ret_0=_bloom+_orig;gl_FragColor=_ret_0;}"
                },
                "fp_bloom_threshold": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nvec4 _ret_0;float _TMP1;float _TMP0;float _a0025;float _x0027;uniform float bloomThreshold;uniform float thresholdCutoff;uniform sampler2D inputTexture0;void main()\n{vec4 _col;float _luminance;float _x;float _cut;_col=texture2D(inputTexture0,tz_TexCoord[0].xy);_luminance=dot(_col.xyz,vec3(2.12599993E-01,7.15200007E-01,7.22000003E-02));_x=float((_luminance>=bloomThreshold));_a0025=3.14159274*(_luminance/bloomThreshold-0.5);_TMP0=sin(_a0025);_x0027=0.5*(1.0+_TMP0);_TMP1=pow(_x0027,thresholdCutoff);_cut=bloomThreshold*_TMP1;_ret_0=(_x+(1.0-_x)*_cut)*_col;gl_FragColor=_ret_0;}"
                },
                "fp_colorMatrix": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nvec3 _r0019;uniform vec4 colorMatrix[3];uniform sampler2D inputTexture0;void main()\n{vec4 _color;vec4 _mutc;_color=texture2D(inputTexture0,tz_TexCoord[0].xy);_mutc=_color;_mutc.w=1.0;_r0019.x=dot(colorMatrix[0],_mutc);_r0019.y=dot(colorMatrix[1],_mutc);_r0019.z=dot(colorMatrix[2],_mutc);_mutc.xyz=_r0019;_mutc.w=_color.w;gl_FragColor=_mutc;}"
                },
                "fp_distort": {
                    "type": "fragment",
                    "code": "#ifdef GL_ES\n#define TZ_LOWP lowp\nprecision mediump float;\nprecision mediump int;\n#else\n#define TZ_LOWP\n#endif\nvarying vec4 tz_TexCoord[1];\nvec4 _ret_0;vec2 _UV1;vec4 _TMP1;vec2 _r0020;vec2 _r0028;vec2 _v0028;uniform vec2 strength;uniform vec3 transform[2];uniform vec2 invTransform[2];uniform sampler2D inputTexture0;uniform sampler2D distortTexture;void main()\n{vec3 _uvt;_uvt=vec3(tz_TexCoord[0].x,tz_TexCoord[0].y,1.0);_r0020.x=dot(transform[0],_uvt);_r0020.y=dot(transform[1],_uvt);_TMP1=texture2D(distortTexture,_r0020);_v0028=_TMP1.xy-0.5;_r0028.x=dot(invTransform[0],_v0028);_r0028.y=dot(invTransform[1],_v0028);_UV1=tz_TexCoord[0].xy+_r0028*strength;_ret_0=texture2D(inputTexture0,_UV1);gl_FragColor=_ret_0;}"
                }
            }
        });

        e.distortTechnique = shader.getTechnique("distort");
        e.colorMatrixTechnique = shader.getTechnique("copyColorMatrix");
        e.bloomThresholdTechnique = shader.getTechnique("bloomThreshold");
        e.bloomMergeTechnique = shader.getTechnique("bloomMerge");
        e.gaussianBlurTechnique = shader.getTechnique("gaussianBlur");

        return e;
    };
    TextureEffects.version = 1;
    return TextureEffects;
})();
