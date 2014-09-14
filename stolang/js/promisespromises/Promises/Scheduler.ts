/*
    Promises, Promises...
    A light-weight implementation of the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/) and an underlying deferred-execution (i.e. future) provider and useful extensions.
    This library is meant to provide core functionality required to leverage Promises / futures within larger libraries via bundling or otherwise inclusion within larger files.

    Author:     Mike McMahon
    Created:    September 5, 2013

    Version:    3.0.3
    Updated:    June 15, 2014

    Project homepage: http://promises.codeplex.com
*/

module Promises {

    "use strict";

    //#region External Entities

    // Declare the setImmediate function here, which may or may not be available via the context (e.g. window).
    declare var setImmediate: (f: Function) => void;

    //#endregion

    //#region Interfaces

    export interface IScheduler {
        /// <summary>
        /// A method that supports scheduling functions for execution.
        /// </summary>
        /// <param name="func" type="Function">The method to schedule for execution.</param>

        (func: Function): void;
    }

    //#endregion

    //#region Utility Methods

    var
        isFunction = (itemToCheck: any): Boolean => {
            /// <summary>Determines whether an item represents a function.</summary>
            /// <param name="itemToCheck" type="any">An item to examine.</param>
            /// <returns type="Boolean">true if the item is a function; otherwise, false.</returns>

            var f = () => { };
            return itemToCheck && ((typeof itemToCheck) === (typeof f));
        };

    export class Scheduler {
        /// <summary>
        /// The scheduling mechanism used to execute Promise callbacks and continuations asynchronously.
        /// </summary>

        // Define the scheduleExecution method for our asynchronous scheduler.
        // Ideally, we'd use a native implementation of setImmediate (https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/setImmediate/Overview.html).
        // We prefer setImmediate if it's defined on the container (explicit), then the window (ambient), falling-back to a setTimeout wrapper.
        // This allows other, bundled or ambiently-present implementations of setImmediate to be leveraged (e.g. https://github.com/NobleJS/setImmediate).
        // The end result is that the callbacks here are executed as quickly (yet efficiently) as possible.

        ///<field name="scheduleExecution" type="Function" static="true">Gets or sets the method used to schedule a continuation or callback for execution at the next possible moment.</var>
        static scheduleExecution: IScheduler = (() => {

            // Determine what's available (safely) by testing whether "setImmediate" is actually available.
            var setImmediateExists: Boolean = false;
            try {
                setImmediateExists = isFunction(setImmediate);
            }
            catch (doesntExist) { }

            // If setImmediate is available, use that.
            // Otherwise, use setTimeout as our fallback.
            // In either case, we ensure that our execution context is the global scope (i.e. null).
            if (setImmediateExists) {
                return (f) => { setImmediate.call(null, f); };
            }
            else {
                // We have to check for the presence of the "call" method since old IE doesn't provide it for setTimeout.
                if (setTimeout.call) {
                    return (f) => { setTimeout.call(null, f, 0); };
                }
                else {
                    return (f) => { setTimeout(f, 0); };
                }
            }
        })();
    }
} 