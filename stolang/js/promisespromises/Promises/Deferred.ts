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

/// <reference path="Common interfaces.ts" />
/// <reference path="Scheduler.ts" />

module Promises {

    "use strict";

    //#region Interfaces

    interface IPromiseResolver {
        /// <summary>
        /// A method that resolves a Promise with a value.
        /// </summary>
        /// <param name="promise" type="IResolvable">The promise to resolve.</param>
        /// <param name="result" type="any">An optional value that is provided to the promise.</param>

        (promise: IResolvable, result?: any): any;
    }

    export interface IResolvable extends ISpecificationPromise {
        /// <summary>
        /// A Promise or future that exposes control over its resolution (i.e. fulfillment or rejection).
        /// </summary>

        /// <field name="fulfill" type="Function">Fulfills the promise with an optional result.</param>
        fulfill(result?): void;

        /// <field name="reject" type="Function">Rejects the promise with an optional reason.</param>
        reject(reason?): void;
    }

    //#endregion

    //#region Enumerations

    /// <field name="DeferredState" static="true" type="Number">Possible states of a Deferred.</field>
    export enum DeferredState {

        /// <field name="Pending" static="true">Awaiting completion (i.e. neither resolved nor rejected).</field>
        Pending = 0,

        /// <field name="Fulfilled" static="true">Completed successfully (i.e. success).</field>
        Fulfilled = 1,

        /// <field name="Rejected" static="true">Completed erroneously (i.e. failure).</field>
        Rejected = 2

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
        },
        isObject = (itemToCheck: any): Boolean => {
            /// <summary>Determines whether an item represents an Object.</summary>
            /// <param name="itemToCheck" type="any">An item to examine.</param>
            /// <returns type="Boolean">true if the item is an Object; otherwise, false.</returns>

            return itemToCheck && ((typeof itemToCheck) === (typeof {}));
        };

    //#endregion

    //#region The Promise Resolution Procedure

    // This is the implementation of The Promise Resolution Procedure of the Promises/A+ Specification (2.3)
    var resolvePromise: IPromiseResolver = (promise: Deferred, result?: any) => {

        // Take action depending upon the result returned (if any).
        // The specification provides several cases for processing.
        if ((result !== undefined) && (result !== null)) {

            // We have a result of some sort, so take action accordingly.
            if (result instanceof Promise) {

                // The value is our kind of promise, so we assume its state, unless it's the same instance.
                if (promise.then === result.then) {

                    // The value returned by the callback is the continuation promise (which is all we actually would return from this method), so reject the continuation providing a TypeError as a reason, per the specification.
                    // We used a reference test of the "then" method to make this determination quickly.
                    promise.reject(new TypeError());
                }
                else {
                    // We can take this shortcut here since we know it's implemented correctly.
                    // We do take the precaution of fulfilling the promise with the result value via The Promise Resolution Procedure, a choice that is only implied by the specification, but required to pass the tests.
                    result.then((r?) => resolvePromise(promise, r), promise.reject);
                    return;
                }
            }
            else if (isObject(result) || isFunction(result)) {

                // Attempt to import the "thenable."
                var wrapper = Promise.fromThenable(result);

                // If the import succeeded, we assume the state of the wrapper promise.
                // Otherwise, this wasn't a viable "thenable" and we just treat it like an object.
                if (wrapper != null) {
                    wrapper.then((r?) => resolvePromise(promise, r), promise.reject);
                    return;
                }
            }
        }

        // As a final step, we resolve the promise with the result.
        // All the previous logic applies special processing conditionally, returning when appropriate.
        // This handles a large number of cases, acting as the catch-all when we don't handle the value specially.
        promise.fulfill(result);
    };

    //#endregion

    //#region The private InnerDeferred type

    class InnerDeferred implements ISpecificationPromise, IResolvable {
        /// <summary>
        /// The internal representation of an operation that will complete at some later time.
        /// Instances support the registration of continuations for fulfillment and rejection, as well as controlling the fulfillment or rejection of the represented operation.
        /// This is effectively the core implementation of the 
        /// </summary>

        /// <field name="state" type="Number">The state of the deferred object.</field>
        state: DeferredState;

        /// <field name="resultData" type="Object">Any result data associated with this instance, whether for fulfillment or rejection.</field>
        resultData: any;

        /// <field name="fulfilledContinuations" type="Array" elementType="Function">The list of continuation methods to be executed when this instance is rejected.</field>
        fulfilledContinuations: { (result?: any): void }[];

        /// <field name="rejectedContinuations" type="Array" elementType="Function">The list of continuation methods to be executed when this instance is rejected.</field>
        rejectedContinuations: { (reason?: any): void }[];

        constructor() {
            /// <summary>
            /// Initializes a new Deferred that can be fulfilled nor rejected.
            /// </summary>

            // Initialize the member fields.
            this.state = DeferredState.Pending;
            this.fulfilledContinuations = [];
            this.rejectedContinuations = [];
        }

        fulfill(result?) {
            /// <summary>Resolves this Deferred as having been fulfilled, passing an optional result value.</summary>
            /// <param name="result" type="Object">Any data to be passed as the result of this Deferred to its fulfillment handlers.</param>

            if (this.state === DeferredState.Pending) {

                this.state = DeferredState.Fulfilled;
                this.resultData = result;

                // Execute the fulfillment callbacks.
                while (this.fulfilledContinuations.length > 0) {
                    this.fulfilledContinuations.shift()(this.resultData);
                }

                // Clear out the rejection continuations.
                this.rejectedContinuations = null;
            }

        }

        reject(reason?) {
            /// <summary>Resolves this Deferred as having been rejected, passing an optional result value.</summary>
            /// <param name="result" type="Object">Any data to be passed as the result of this Deferred to its rejection handlers.</param>

            if (this.state === DeferredState.Pending) {

                this.state = DeferredState.Rejected;
                this.resultData = reason;

                // Execute the rejection continuations.
                while (this.rejectedContinuations.length > 0) {
                    this.rejectedContinuations.shift()(this.resultData);
                }

                // Clear the fulfillment continuations.
                this.fulfilledContinuations = null;
            }
        }

        then(onFulfilled?: IPromiseContinuation, onRejected?: IPromiseContinuation) {
            /// <summary>Registers a continuation for this promise using the specified handlers, both of which are optional, following the Promises/A+ specification.</summary>
            /// <param name="onFulfilled" type="function">A method that is executed if this promise is resolved successfully, accepting the result of the promise (if any) as a parameter.</param>
            /// <param name="onRejected" type="function">A method that is executed if this promise is resolved unsuccessfully (i.e. rejected), accepting the result of the promise (if any) as a parameter.</param>
            /// <returns type="Promise">A Promise with the characteristics defined by the Promises/A+ specification. If neither onFulfilled nor onRejected are valid functions, this method returns the current Promise; otherwise, a new Promise is returned.</returns>

            // Define a method to create handlers for a callback.
            var createHandler = (continuation: Deferred, callback: IPromiseContinuation) => {

                // Return a handler that processes the provided data with the callback, calling appropriate methods on the continuation as a result.
                return (callbackData?) => {

                    // Queue the execution, capturing the relevant parameters.
                    Scheduler.scheduleExecution.call(null, () => {

                        // Try to get the result to pass to the continuation from the handler.
                        var callbackResult;
                        try {
                            // Execute the callback, providing it the given data. This constitutes the callback result (if any).
                            callbackResult = callback(callbackData);
                        }
                        catch (failureHandlerError) {

                            // The failure handler threw an error, so we fail the continuation and pass it the exception as data, terminating execution.
                            continuation.reject(failureHandlerError);
                            return;
                        }

                        // Resolve the continuation with the result.
                        resolvePromise(continuation, callbackResult);
                    });
                };
            };

            // If we aren't passed any valid callbacks, just return the current Promise to save on allocations.
            if (!isFunction(onFulfilled) && !isFunction(onRejected)) {

                // Return the current instance as a Promise, capturing the context of the current "then" method.
                return new Promise((onF?, onR?) => this.then(onF, onR));
            }

            // Per the Promise/A specification:
            //  This function should return a new promise that is fulfilled when the given success or failure callback is finished.
            //  This allows promise operations to be chained together.
            //  The value returned from the callback handler is the fulfillment value for the returned promise. If the callback throws an error, the returned promise will be moved to failed state. 
            var continuation = new Deferred();

            // If we have no valid onFulfilled method, use the fulfill method of the Deferred to allow chaining.
            if (!isFunction(onFulfilled)) {
                onFulfilled = continuation.fulfill;
            }

            // If we have no valid onRejected method, use the reject method of the Deferred to allow chaining.
            if (!isFunction(onRejected)) {
                onRejected = continuation.reject;
            }

            // Define the action to take upon successful resolution, wrapping the success handler within the continuation appropriately.
            var successHandler = createHandler(continuation, onFulfilled);

            // Take appropriate action based upon whether this operation has already been resolved.
            if (this.state === DeferredState.Fulfilled) {
                // Invoke the handler, sending in the completion data.
                successHandler(this.resultData);
            }
            else if (this.state === DeferredState.Pending) {
                // The operation hasn't been resolved, so we queue it up.
                this.fulfilledContinuations.push(successHandler);
            }


            // Define the action to take when the Deferred fails, wrapping the success handler appropriately.
            var failureHandler = createHandler(continuation, onRejected);

            // Take appropriate action based upon whether this operation has already been resolved.
            if (this.state === DeferredState.Rejected) {
                // Invoke the handler, sending in the completion data.
                failureHandler(this.resultData);
            }
            else if (this.state === DeferredState.Pending) {
                // The operation hasn't been resolved, so we queue it up.
                this.rejectedContinuations.push(failureHandler);
            }

            // Return the promise object for the continuation.
            return continuation.promise();
        }
    }

    //#endregion

    //#region Deferred

    export class Deferred implements ISpecificationPromise, IResolvable {

        getState: () => DeferredState;
        promise: () => IPromise;
        reject: (reason?) => void;
        fulfill: (result?) => void;
        then: IRegisterPromiseContinuations;

        constructor() {

            // Initialize the Deferred using an InnerDeferred, which defines all the operations and contains all the state.
            // This wrapper simply exposes selective pieces of it.
            var inner = new InnerDeferred();

            this.getState = function () {
                /// <summary>
                /// Gets the state of this Deferred.
                /// </summary>
                /// <returns type="Number">A value from the Deferred.States enumeration.</returns>

                return inner.state;
            };

            // Forward the inner functions, creating closures around them (I'd love to use bind, but it's an ECMA5 standard, plus closures seem to be a lot faster).

            this.promise = () => new Promise(this.then);

            this.reject = (data?) => inner.reject(data);

            this.fulfill = (result?) => inner.fulfill(result);

            this.then = (onFulfilled?, onRejected?) => inner.then(onFulfilled, onRejected);

        }
    }

    //#endregion

} 