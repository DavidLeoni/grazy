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

/* License (MIT) and copyright information: http://promises.codeplex.com */
/// <reference path="Common interfaces.ts" />
/// <reference path="Scheduler.ts" />
/// <reference path="Deferred.ts" />
module Promises {

    "use strict";

    //#region Utility Methods

    var
        isFunction = (itemToCheck: any): Boolean => {
            /// <summary>Determines whether an item represents a function.</summary>
            /// <param name="itemToCheck" type="any">An item to examine.</param>
            /// <returns type="Boolean">true if the item is a function; otherwise, false.</returns>

            var f = () => { };
            return itemToCheck && ((typeof itemToCheck) === (typeof f));
        };

    //#endregion

    //#region The Promise type

    export class Promise implements IPromise {
        /// <summary>
        /// An enhanced Promise or future the meets and exceeds the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/), representing an operation that will complete (possibly producing a value) in the future.
        /// </summary>

        /// <field name="always" type="Function(IPromiseContinuation): IPromise">Registers a continuation for this Promise for both fulfillment and rejection. This is a convenience wrapper for the "then" method.</field>
        always(onFulfilledOrRejected: IPromiseContinuation): IPromise {
            return this.then(onFulfilledOrRejected, onFulfilledOrRejected);
        }

        /// <field name="then" type="IRegisterPromiseContinuations">Registers continuations for this Promise for fulfillment and / or rejection.</field>
        then: IRegisterPromiseContinuations;

        constructor(thenMethod: IRegisterPromiseContinuations) {
            /// <summary>
            /// Initializes a new Promise that utilizes the provided method to register continuations.
            /// </summary>
            /// <param name="thenMethod" type="IRegisterPromiseContinuations">A method that fulfills the requirements of the Promise/A+ "then" method.</param>
            // Store the "then" method.
            this.then = thenMethod;
        }

        //#region Static Members

        /// <field name="rejected" type="IPromise">A Promise that has been rejected (i.e. completed with an error).</field>
        static rejected: IPromise;

        /// <field name="never" type="IPromise">A Promise that will never be completed.</field>
        static never = new Promise(function () {

            // We ignore any parameters since they'll never be executed and we don't need memory consumption to grow unnecessarily.
            // To ensure we return a proper Promise, we return this Promise.never instance.
            return Promise.never;
        });

        /// <field name="fulfilled" type="IPromise">A Promise that has been fulfilled.</field>
        static fulfilled: IPromise;

        //#endregion

        //#region Static Methods

        static fromThenable(thenable: any): IPromise {
            /// <summary>
            /// Attempts to consume a "thenable" (i.e. promise-like object), transforming it into a specification-compliant Promise.
            /// This method allows non-compliant promise implementations (e.g. jQuery promises & Deferreds) to be consumed in such a way that their behavior is standardized in a specification-compliant way, ensuring fulfillment and rejection propagation, as well as scheduling compliance.
            /// </summary>
            /// <param name="thenable" type="any">A promise-like entity.</param>
            /// <returns type="Promise">
            /// If 'thenable' does not possess a "then" method, then null.
            /// If attempting to access the "then" method of 'thenable' produces an exception, then a new, rejected Promise is returned whose rejection reason is the exception encountered.
            /// Otherwise, a Promise that represents 'thenable', conveying the fulfillment or rejection values (as produced) by that object.
            /// </returns>

            // Attempt to access the "then" method on the result, if it is present.
            // We perform this action once, safely, since the result may be volatile.
            var thenProperty;
            try {
                thenProperty = thenable.then;
            }
            catch (thenError) {

                // We received an error trying to access the "then" method, so we reject the continuation with this error.
                // Note that this does not occur if the "then" method does not exist.
                return Promise.rejectedWith(thenError);
            }

            // If the "then" property is a function, wrap it.
            if (isFunction(thenProperty)) {

                // The return value is promise-like, so, per the specification, we have to try to assume its value.
                // We leverage one of our own Deferred instances as a proxy, wiring it up to the "then" method.
                var proxy = new Deferred();

                // The handlers passes the arguments object if there is more than 1 value passed to the fulfillment / rejection method by the thenable (this helps with jQuery and other thenables that supply multiple result values); otherwise, it simply passes the single (or undefined) result.
                var createArgumentFilterWrapper = (wrapped) => {
                    return (r?) => {
                        (arguments.length > 1) ? wrapped(arguments) : wrapped(r)
                    };
                };

                // Try to invoke the "then" method using the context of the original object.
                // We have to specifically re-apply it in case the original object was mutated, per the specification.
                // We schedule the execution of this method to ensure that we don't get blocked here by the "thenable."
                Scheduler.scheduleExecution(() => {
                    try {
                        thenProperty.call(thenable, createArgumentFilterWrapper(proxy.fulfill), createArgumentFilterWrapper(proxy.reject));
                    }
                    catch (thenError) {

                        // We encountered an exception and haven't executed a resolver, reject the promise.
                        proxy.reject(thenError);
                    }
                });

                // Return the proxy.
                return proxy.promise();
            }
            else {

                // This isn't a "thenable," so we return null.
                return null;
            }

        }

        static fulfilledWith(result?: any) {
            /// <summary>
            /// Creates a Promise that has been fulfilled with the (optional) provided result.
            /// This method provides a convenient mechanism for creating a fulfilled Promise when the resulting value is known immediately.
            /// </summary>
            /// <param name="result" type="any">The optional result.</param>
            /// <returns type="Promise">A Promise that is fulfilled with the provided result.</returns>

            // If there is no result provided, use the "fulfilled" static instance to save on allocations.
            // Otherwise, we pass along the provided value.
            if (arguments.length == 0) {
                return Promise.fulfilled;
            }
            else {
                // Create a Deferred, fulfill it with the result, and return the Promise form.
                var fulfilled = new Deferred();
                fulfilled.fulfill(result);
                return fulfilled.promise();
            }
        }

        static rejectedWith(reason?: any) {
            /// <summary>
            /// Creates a Promise that has been rejected with the (optional) provided reason.
            /// This method provides a convenient mechanism for creating a rejected Promise when the reason for rejection is known immediately.
            /// </summary>
            /// <param name="reason" type="any">The optional reason.</param>
            /// <returns type="Promise">A Promise that is rejected for the specified reason.</returns>

            // If there is no reason provided, use the "rejected" static instance to save on allocations.
            // Otherwise, we pass along the provided value.
            if (arguments.length == 0) {
                return Promise.rejected;
            }
            else {
                // Create a Deferred, reject it for the reason, and return the Promise form.
                var rejected = new Deferred();
                rejected.reject(reason);
                return rejected.promise();
            }
        }

        static whenAll(promises: IPromise[]) {
            /// <summary>
            /// Creates a Promise that is fulfilled when all the specified Promises are fulfilled, or rejected when one of the Promises is rejected.
            /// </summary>
            /// <param name="promises" type="Array" elementType="Promise">A set of promises to represent.</param>
            /// <returns type="Promise">
            /// A Promise that is fulfilled when all the specified Promises are fulfilled, or rejected when one of the Promises is rejected.
            /// The fulfillment value is an array of all fulfillment values from the constituient promises, so long as at least one promise produces a result; otherwise, the fulfillment vaue is undefined.
            /// </returns>

            // Take action depending upon the number of Promises passed.
            if (promises.length == 0) {

                // There are no arguments, so we return a completed Promise.
                return Promise.fulfilled;
            }
            else if (promises.length == 1) {

                // There's only one Promise, so return it.
                return promises[0];
            }
            else {

                // Create a new Deferred to represent the entire process.
                var whenAll = new Deferred();

                // Wire into each Promise, counting them as they complete.
                // We count manually to filter out any odd, null entries.
                var pendingPromises = 0;

                // We also holdon to any results that we seso that we can fulfill the whole promise with the result set.
                var promiseResults = [];

                for (var i = 0; i < promises.length; i++) {
                    var promise = promises[i];

                    // Increment the total count and store the promise, then wire-up the promise.
                    pendingPromises++;

                    promise.then(
                        (result?) => {

                            // Completed successfully, so decrement the count.
                            pendingPromises--;

                            // If we have a result (i.e. not undefined), add it to the result list.
                            if (result !== undefined) {
                                promiseResults.push(result);
                            }

                            // If this is the last promise, resolve it, passing the promises.
                            // If a failure occurred already, this will have no effect.
                            if (pendingPromises == 0) {

                                // If we have rsults to pass as a fulfillment value, do so; otherwise, leave it undefined.
                                if (promiseResults.length > 0) {
                                    whenAll.fulfill(promiseResults);
                                }
                                else {
                                    whenAll.fulfill();
                                }
                            }
                        },
                        (reason?) => {

                            // A failure occurred, so decrement the count and reject the Deferred, passing the error / data that caused the rejection.
                            // A single failure will cause the whole set to fail.
                            pendingPromises--;
                            whenAll.reject(reason);
                        });
                }

                // Return the promise.
                return whenAll.promise();
            }
        }

        static whenAny(promises: IPromise[]) {
            /// <summary>
            /// Creates a Promise that is fulfilled when any of the specified Promises are completed.
            /// </summary>
            /// <param name="promises" type="Array" elementType="Promise">A set of promises to represent.</param>
            /// <returns type="Promise">A Promise that is fulfilled when any of the specified Promises are fulfilled or rejected. The returned Promise assumes the state / value of the first completed Promise (i.e. becomes the completed Promise).</returns>

            // Take action depending upon the number of Promises passed.
            if (promises.length == 0) {

                // There are no arguments, so we return a completed Promise.
                return Promise.fulfilled;
            }
            else if (promises.length == 1) {

                // There's only one Promise, so return it.
                return promises[0];
            }
            else {

                // Create a new Deferred to represent the entire process.
                var whenAny = new Deferred();

                // Iterate over each Promise, attaching to it.
                // This becomes a race!
                for (var i = 0; i < promises.length; i++) {

                    // Fulfill or reject the returned promise using the resurn data of the first to complete.
                    var promise = promises[i];
                    promise.then((result?) => { whenAny.fulfill(result); }, (reason?) => { whenAny.reject(reason); });
                }

                // Return the promise.
                return whenAny.promise();
            }
        }

        //#endregion
    }

    //#endregion

}