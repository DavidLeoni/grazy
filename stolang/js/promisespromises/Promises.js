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
var Promises;
(function (Promises) {
    "use strict";

    

    

    //#endregion
    //#region Utility Methods
    var isFunction = function (itemToCheck) {
        /// <summary>Determines whether an item represents a function.</summary>
        /// <param name="itemToCheck" type="any">An item to examine.</param>
        /// <returns type="Boolean">true if the item is a function; otherwise, false.</returns>
        var f = function () {
        };
        return itemToCheck && ((typeof itemToCheck) === (typeof f));
    };

    var Scheduler = (function () {
        function Scheduler() {
        }
        Scheduler.scheduleExecution = (function () {
            // Determine what's available (safely) by testing whether "setImmediate" is actually available.
            var setImmediateExists = false;
            try  {
                setImmediateExists = isFunction(setImmediate);
            } catch (doesntExist) {
            }

            // If setImmediate is available, use that.
            // Otherwise, use setTimeout as our fallback.
            // In either case, we ensure that our execution context is the global scope (i.e. null).
            if (setImmediateExists) {
                return function (f) {
                    setImmediate.call(null, f);
                };
            } else {
                // We have to check for the presence of the "call" method since old IE doesn't provide it for setTimeout.
                if (setTimeout.call) {
                    return function (f) {
                        setTimeout.call(null, f, 0);
                    };
                } else {
                    return function (f) {
                        setTimeout(f, 0);
                    };
                }
            }
        })();
        return Scheduler;
    })();
    Promises.Scheduler = Scheduler;
})(Promises || (Promises = {}));
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
var Promises;
(function (Promises) {
    "use strict";

    

    //#endregion
    //#region Enumerations
    /// <field name="DeferredState" static="true" type="Number">Possible states of a Deferred.</field>
    (function (DeferredState) {
        /// <field name="Pending" static="true">Awaiting completion (i.e. neither resolved nor rejected).</field>
        DeferredState[DeferredState["Pending"] = 0] = "Pending";

        /// <field name="Fulfilled" static="true">Completed successfully (i.e. success).</field>
        DeferredState[DeferredState["Fulfilled"] = 1] = "Fulfilled";

        /// <field name="Rejected" static="true">Completed erroneously (i.e. failure).</field>
        DeferredState[DeferredState["Rejected"] = 2] = "Rejected";
    })(Promises.DeferredState || (Promises.DeferredState = {}));
    var DeferredState = Promises.DeferredState;

    //#endregion
    //#region Utility Methods
    var isFunction = function (itemToCheck) {
        /// <summary>Determines whether an item represents a function.</summary>
        /// <param name="itemToCheck" type="any">An item to examine.</param>
        /// <returns type="Boolean">true if the item is a function; otherwise, false.</returns>
        var f = function () {
        };
        return itemToCheck && ((typeof itemToCheck) === (typeof f));
    }, isObject = function (itemToCheck) {
        /// <summary>Determines whether an item represents an Object.</summary>
        /// <param name="itemToCheck" type="any">An item to examine.</param>
        /// <returns type="Boolean">true if the item is an Object; otherwise, false.</returns>
        return itemToCheck && ((typeof itemToCheck) === (typeof {}));
    };

    //#endregion
    //#region The Promise Resolution Procedure
    // This is the implementation of The Promise Resolution Procedure of the Promises/A+ Specification (2.3)
    var resolvePromise = function (promise, result) {
        // Take action depending upon the result returned (if any).
        // The specification provides several cases for processing.
        if ((result !== undefined) && (result !== null)) {
            // We have a result of some sort, so take action accordingly.
            if (result instanceof Promises.Promise) {
                // The value is our kind of promise, so we assume its state, unless it's the same instance.
                if (promise.then === result.then) {
                    // The value returned by the callback is the continuation promise (which is all we actually would return from this method), so reject the continuation providing a TypeError as a reason, per the specification.
                    // We used a reference test of the "then" method to make this determination quickly.
                    promise.reject(new TypeError());
                } else {
                    // We can take this shortcut here since we know it's implemented correctly.
                    // We do take the precaution of fulfilling the promise with the result value via The Promise Resolution Procedure, a choice that is only implied by the specification, but required to pass the tests.
                    result.then(function (r) {
                        return resolvePromise(promise, r);
                    }, promise.reject);
                    return;
                }
            } else if (isObject(result) || isFunction(result)) {
                // Attempt to import the "thenable."
                var wrapper = Promises.Promise.fromThenable(result);

                // If the import succeeded, we assume the state of the wrapper promise.
                // Otherwise, this wasn't a viable "thenable" and we just treat it like an object.
                if (wrapper != null) {
                    wrapper.then(function (r) {
                        return resolvePromise(promise, r);
                    }, promise.reject);
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
    var InnerDeferred = (function () {
        function InnerDeferred() {
            /// <summary>
            /// Initializes a new Deferred that can be fulfilled nor rejected.
            /// </summary>
            // Initialize the member fields.
            this.state = 0 /* Pending */;
            this.fulfilledContinuations = [];
            this.rejectedContinuations = [];
        }
        InnerDeferred.prototype.fulfill = function (result) {
            /// <summary>Resolves this Deferred as having been fulfilled, passing an optional result value.</summary>
            /// <param name="result" type="Object">Any data to be passed as the result of this Deferred to its fulfillment handlers.</param>
            if (this.state === 0 /* Pending */) {
                this.state = 1 /* Fulfilled */;
                this.resultData = result;

                while (this.fulfilledContinuations.length > 0) {
                    this.fulfilledContinuations.shift()(this.resultData);
                }

                // Clear out the rejection continuations.
                this.rejectedContinuations = null;
            }
        };

        InnerDeferred.prototype.reject = function (reason) {
            /// <summary>Resolves this Deferred as having been rejected, passing an optional result value.</summary>
            /// <param name="result" type="Object">Any data to be passed as the result of this Deferred to its rejection handlers.</param>
            if (this.state === 0 /* Pending */) {
                this.state = 2 /* Rejected */;
                this.resultData = reason;

                while (this.rejectedContinuations.length > 0) {
                    this.rejectedContinuations.shift()(this.resultData);
                }

                // Clear the fulfillment continuations.
                this.fulfilledContinuations = null;
            }
        };

        InnerDeferred.prototype.then = function (onFulfilled, onRejected) {
            /// <summary>Registers a continuation for this promise using the specified handlers, both of which are optional, following the Promises/A+ specification.</summary>
            /// <param name="onFulfilled" type="function">A method that is executed if this promise is resolved successfully, accepting the result of the promise (if any) as a parameter.</param>
            /// <param name="onRejected" type="function">A method that is executed if this promise is resolved unsuccessfully (i.e. rejected), accepting the result of the promise (if any) as a parameter.</param>
            /// <returns type="Promise">A Promise with the characteristics defined by the Promises/A+ specification. If neither onFulfilled nor onRejected are valid functions, this method returns the current Promise; otherwise, a new Promise is returned.</returns>
            var _this = this;
            // Define a method to create handlers for a callback.
            var createHandler = function (continuation, callback) {
                // Return a handler that processes the provided data with the callback, calling appropriate methods on the continuation as a result.
                return function (callbackData) {
                    // Queue the execution, capturing the relevant parameters.
                    Promises.Scheduler.scheduleExecution.call(null, function () {
                        // Try to get the result to pass to the continuation from the handler.
                        var callbackResult;
                        try  {
                            // Execute the callback, providing it the given data. This constitutes the callback result (if any).
                            callbackResult = callback(callbackData);
                        } catch (failureHandlerError) {
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
                return new Promises.Promise(function (onF, onR) {
                    return _this.then(onF, onR);
                });
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
            if (this.state === 1 /* Fulfilled */) {
                // Invoke the handler, sending in the completion data.
                successHandler(this.resultData);
            } else if (this.state === 0 /* Pending */) {
                // The operation hasn't been resolved, so we queue it up.
                this.fulfilledContinuations.push(successHandler);
            }

            // Define the action to take when the Deferred fails, wrapping the success handler appropriately.
            var failureHandler = createHandler(continuation, onRejected);

            // Take appropriate action based upon whether this operation has already been resolved.
            if (this.state === 2 /* Rejected */) {
                // Invoke the handler, sending in the completion data.
                failureHandler(this.resultData);
            } else if (this.state === 0 /* Pending */) {
                // The operation hasn't been resolved, so we queue it up.
                this.rejectedContinuations.push(failureHandler);
            }

            // Return the promise object for the continuation.
            return continuation.promise();
        };
        return InnerDeferred;
    })();

    //#endregion
    //#region Deferred
    var Deferred = (function () {
        function Deferred() {
            var _this = this;
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
            this.promise = function () {
                return new Promises.Promise(_this.then);
            };

            this.reject = function (data) {
                return inner.reject(data);
            };

            this.fulfill = function (result) {
                return inner.fulfill(result);
            };

            this.then = function (onFulfilled, onRejected) {
                return inner.then(onFulfilled, onRejected);
            };
        }
        return Deferred;
    })();
    Promises.Deferred = Deferred;
})(Promises || (Promises = {}));
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
var Promises;
(function (Promises) {
    "use strict";

    //#region Utility Methods
    var isFunction = function (itemToCheck) {
        /// <summary>Determines whether an item represents a function.</summary>
        /// <param name="itemToCheck" type="any">An item to examine.</param>
        /// <returns type="Boolean">true if the item is a function; otherwise, false.</returns>
        var f = function () {
        };
        return itemToCheck && ((typeof itemToCheck) === (typeof f));
    };

    //#endregion
    //#region The Promise type
    var Promise = (function () {
        function Promise(thenMethod) {
            /// <summary>
            /// Initializes a new Promise that utilizes the provided method to register continuations.
            /// </summary>
            /// <param name="thenMethod" type="IRegisterPromiseContinuations">A method that fulfills the requirements of the Promise/A+ "then" method.</param>
            // Store the "then" method.
            this.then = thenMethod;
        }
        /// <summary>
        /// An enhanced Promise or future the meets and exceeds the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/), representing an operation that will complete (possibly producing a value) in the future.
        /// </summary>
        /// <field name="always" type="Function(IPromiseContinuation): IPromise">Registers a continuation for this Promise for both fulfillment and rejection. This is a convenience wrapper for the "then" method.</field>
        Promise.prototype.always = function (onFulfilledOrRejected) {
            return this.then(onFulfilledOrRejected, onFulfilledOrRejected);
        };

        //#endregion
        //#region Static Methods
        Promise.fromThenable = function (thenable) {
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
            try  {
                thenProperty = thenable.then;
            } catch (thenError) {
                // We received an error trying to access the "then" method, so we reject the continuation with this error.
                // Note that this does not occur if the "then" method does not exist.
                return Promise.rejectedWith(thenError);
            }

            // If the "then" property is a function, wrap it.
            if (isFunction(thenProperty)) {
                // The return value is promise-like, so, per the specification, we have to try to assume its value.
                // We leverage one of our own Deferred instances as a proxy, wiring it up to the "then" method.
                var proxy = new Promises.Deferred();

                // The handlers passes the arguments object if there is more than 1 value passed to the fulfillment / rejection method by the thenable (this helps with jQuery and other thenables that supply multiple result values); otherwise, it simply passes the single (or undefined) result.
                var createArgumentFilterWrapper = function (wrapped) {
                    return function (r) {
                        (arguments.length > 1) ? wrapped(arguments) : wrapped(r);
                    };
                };

                // Try to invoke the "then" method using the context of the original object.
                // We have to specifically re-apply it in case the original object was mutated, per the specification.
                // We schedule the execution of this method to ensure that we don't get blocked here by the "thenable."
                Promises.Scheduler.scheduleExecution(function () {
                    try  {
                        thenProperty.call(thenable, createArgumentFilterWrapper(proxy.fulfill), createArgumentFilterWrapper(proxy.reject));
                    } catch (thenError) {
                        // We encountered an exception and haven't executed a resolver, reject the promise.
                        proxy.reject(thenError);
                    }
                });

                // Return the proxy.
                return proxy.promise();
            } else {
                // This isn't a "thenable," so we return null.
                return null;
            }
        };

        Promise.fulfilledWith = function (result) {
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
            } else {
                // Create a Deferred, fulfill it with the result, and return the Promise form.
                var fulfilled = new Promises.Deferred();
                fulfilled.fulfill(result);
                return fulfilled.promise();
            }
        };

        Promise.rejectedWith = function (reason) {
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
            } else {
                // Create a Deferred, reject it for the reason, and return the Promise form.
                var rejected = new Promises.Deferred();
                rejected.reject(reason);
                return rejected.promise();
            }
        };

        Promise.whenAll = function (promises) {
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
            } else if (promises.length == 1) {
                // There's only one Promise, so return it.
                return promises[0];
            } else {
                // Create a new Deferred to represent the entire process.
                var whenAll = new Promises.Deferred();

                // Wire into each Promise, counting them as they complete.
                // We count manually to filter out any odd, null entries.
                var pendingPromises = 0;

                // We also holdon to any results that we seso that we can fulfill the whole promise with the result set.
                var promiseResults = [];

                for (var i = 0; i < promises.length; i++) {
                    var promise = promises[i];

                    // Increment the total count and store the promise, then wire-up the promise.
                    pendingPromises++;

                    promise.then(function (result) {
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
                            } else {
                                whenAll.fulfill();
                            }
                        }
                    }, function (reason) {
                        // A failure occurred, so decrement the count and reject the Deferred, passing the error / data that caused the rejection.
                        // A single failure will cause the whole set to fail.
                        pendingPromises--;
                        whenAll.reject(reason);
                    });
                }

                // Return the promise.
                return whenAll.promise();
            }
        };

        Promise.whenAny = function (promises) {
            /// <summary>
            /// Creates a Promise that is fulfilled when any of the specified Promises are completed.
            /// </summary>
            /// <param name="promises" type="Array" elementType="Promise">A set of promises to represent.</param>
            /// <returns type="Promise">A Promise that is fulfilled when any of the specified Promises are fulfilled or rejected. The returned Promise assumes the state / value of the first completed Promise (i.e. becomes the completed Promise).</returns>
            // Take action depending upon the number of Promises passed.
            if (promises.length == 0) {
                // There are no arguments, so we return a completed Promise.
                return Promise.fulfilled;
            } else if (promises.length == 1) {
                // There's only one Promise, so return it.
                return promises[0];
            } else {
                // Create a new Deferred to represent the entire process.
                var whenAny = new Promises.Deferred();

                for (var i = 0; i < promises.length; i++) {
                    // Fulfill or reject the returned promise using the resurn data of the first to complete.
                    var promise = promises[i];
                    promise.then(function (result) {
                        whenAny.fulfill(result);
                    }, function (reason) {
                        whenAny.reject(reason);
                    });
                }

                // Return the promise.
                return whenAny.promise();
            }
        };
        Promise.never = new Promise(function () {
            // We ignore any parameters since they'll never be executed and we don't need memory consumption to grow unnecessarily.
            // To ensure we return a proper Promise, we return this Promise.never instance.
            return Promise.never;
        });
        return Promise;
    })();
    Promises.Promise = Promise;
})(Promises || (Promises = {}));
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
/// <reference path="Promise.ts" />
var Promises;
(function (Promises) {
    "use strict";

    //#region Static Member Implementations
    // These have to be instantiated after the Promise class has defined them and itself.
    Promises.Promise.rejected = (function () {
        /// <summary>Creates a single instance of a Promise that has been rejected (i.e. completed with an error).</summary>
        /// <returns type="Promise">A Promise that has been rejected (i.e. completed with an error).</returns>
        // Resolve a Deferred to represent a failed one, returning it.
        var completed = new Promises.Deferred();
        completed.reject();
        return completed.promise();
    }());

    Promises.Promise.fulfilled = (function () {
        /// <summary>Creates a single instance of a fulfilled (i.e. successfully-resolved) Promise.</summary>
        /// <returns type="Promise">A Promise that has been fulfilled.</returns>
        // Resolve a Deferred to represent a completed one, returning it.
        var completed = new Promises.Deferred();
        completed.fulfill();
        return completed.promise();
    }());
})(Promises || (Promises = {}));
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
/// <reference path="Promise.ts" />
var Promises;
(function (Promises) {
    "use strict";

    

    //#endregion
    var Convert = (function () {
        function Convert() {
        }
        /// <summary>
        /// Provides mechanisms for converting (i.e. encapsulating) various types of non-Promise methods into Promises/A+-compliant forms.
        /// </summary>
        //#region Multiple Methods on an Object
        Convert.objectMethods = function (source, methodNames, factory, suffix, context) {
            /// <summary>
            ///     Creates Promise-generating versions of a set of named functions on an object using the specified factory method, naming convention, and context.
            ///     This provides a flexible means of instantly converting a set of methods with similar signatures or conversion patterns into a Promise pattern.
            ///     The ideal situation is one in which the source is a prototype for a type, which would immediately and efficiently Promise-enable all instances.
            /// </summary>
            /// <param name="source" type="any">
            ///     The source entity from which the methods specified by <paramref name="methodNames" /> are accessed, and to which the resulting Promise - generating methods are assigned.
            /// </param>
            /// <param name="methodNames" type="Array" arrayType="string">
            ///     The names of the methods present on <paramref name="source" /> that will be converted to Promise-generating versions.
            /// </param>
            /// <param name="factory" type="Function">
            ///     The method that will be executed on every method of <paramref name="source" /> named by <paramref name="methodNames" /> to produce a PromiseFactory (i.e. Promise-generating version of the method).
            ///     This method will be supplied a single method reference from <paramref name="source" /> and the value of <paramref name="context" />.
            /// </param>
            /// <param name="suffix" type="String">
            ///     The suffix that will be applied to the original method name to form the destination method name on the <paramref name="source" /> entity.
            ///     The default value is 'Async'.
            ///     For example, a method named 'myMethod' would be converted to a Promise-generating method named 'myMethodAsync'.
            /// </param>
            /// <param name="context" type="any">
            ///     The optional context to which all created Promise-generating methods will be bound by <paramref name="factory" />.
            ///     Though the precise effect depends upon the implementation of <paramref name="factory" /> provided, this parameter should
            ///     be left undefined / unspecified in almost all circumstances to ensure that the Promise-generating methods will not be bound to any specific instance,
            ///     but rather their normal 'this' context. This provides the greatest flexibility.
            /// </param>
            /// <exception>One or more methods specified by <paramref name="methodNames" /> are not present on <paramref name="source" />.</exception>
            /// <exception>One or more target method names are already present on <paramref name="source" />.</exception>
            if (typeof suffix === "undefined") { suffix = 'Async'; }
            // Create some arrays to store names that are either not present or collide, preventing us from doing anything.
            var undefinedMethods = [], collidingTargetMethodNames = [];

            // Iterate over each method name.
            // We choose this single-iteration pattern because the far more common case should be that this method executes with no errors (error should only occur during development).
            methodNames.forEach(function (methodName) {
                // If the named method exists, wrap it.
                if (methodName in source) {
                    // Form the target method name, proceeding only if the target name doesn't exist.
                    var targetName = methodName + suffix;
                    if (targetName in source) {
                        // Record the target name collision.
                        collidingTargetMethodNames.push(targetName);
                    } else {
                        // Create the target method on the source object using the appropriate factory method and context.
                        source[targetName] = factory(source[methodName], context);
                    }
                } else {
                    // Add this method name to the list of those that could not be found.
                    undefinedMethods.push(methodName);
                }
            });

            // If we had undefined methods, throw an exception.
            if (undefinedMethods.length > 0) {
                throw new Error("The following method names were not found on the source object: " + undefinedMethods.join(', ') + ".");
            }

            // If we had target name collisions, throw an exception.
            if (collidingTargetMethodNames.length > 0) {
                throw new Error("The following target method names are already present on the source object: " + collidingTargetMethodNames.join(', ') + ".");
            }
        };

        Convert.objectNodeAsyncMethods = function (source, methodNames, suffix, context) {
            /// <summary>
            ///     Creates Promise-generating versions of a set of named Node.js-style asynchronous functions on an object using the specified naming convention and context.
            ///     This provides a flexible means of instantly converting a set of asynchronous methods with Node.js-style signatures into a Promise pattern.
            ///     The ideal situation is one in which the source is a prototype for a type, which would immediately and efficiently Promise-enable all named methods.
            /// </summary>
            /// <param name="source" type="any">
            ///     The source entity from which the methods specified by <paramref name="methodNames" /> are accessed, and to which the resulting Promise - generating methods are assigned.
            /// </param>
            /// <param name="methodNames" type="Array" arrayType="string">
            ///     The names of the asynchronous Node.js-style methods present on <paramref name="source" /> that will be converted to Promise-generating versions.
            /// </param>
            /// <param name="suffix" type="String">
            ///     The suffix that will be applied to the original method name to form the destination method name on the <paramref name="source" /> entity.
            ///     The default value is 'Async'.
            ///     For example, a method named 'myMethod' would be converted to a Promise-generating method named 'myMethodAsync'.
            /// </param>
            /// <param name="context" type="any">
            ///     The optional context (i.e. value of 'this') to which all created Promise-generating methods will be bound.
            ///     If not specified (i.e.undefined), the "this" value under which the generated methods execute is used.
            ///     Leaving this value undefined is highly-recommended, especially when <paramref name="source" /> is a function prototype.
            ///     It may, however, be advantageous to pass a value of null or an empty object when it is known that all methods require no context for proper execution.
            /// </param>
            /// <exception>One or more methods specified by <paramref name="methodNames" /> are not present on <paramref name="source" />.</exception>
            /// <exception>One or more target method names are already present on <paramref name="source" />.</exception>
            if (typeof suffix === "undefined") { suffix = 'Async'; }
            // Use the more flexible, central method, using the Node.js method factory.
            Convert.objectMethods(source, methodNames, Convert.fromNodeAsyncMethod, suffix, context);
        };

        Convert.objectSyncMethods = function (source, methodNames, suffix, context) {
            /// <summary>
            ///     Creates Promise-generating versions of a set of named synchronous functions on an object using the specified naming convention and context.
            ///     This provides a flexible means of instantly converting a set of synchronous methods into a Promise pattern.
            ///     The ideal situation is one in which the source is a prototype for a type, which would immediately and efficiently Promise-enable all named methods.
            /// </summary>
            /// <param name="source" type="any">
            ///     The source entity from which the methods specified by <paramref name="methodNames" /> are accessed, and to which the resulting Promise - generating methods are assigned.
            /// </param>
            /// <param name="methodNames" type="Array" arrayType="string">
            ///     The names of the synchronous methods present on <paramref name="source" /> that will be converted to Promise-generating versions.
            /// </param>
            /// <param name="suffix" type="String">
            ///     The suffix that will be applied to the original method name to form the destination method name on the <paramref name="source" /> entity.
            ///     The default value is 'Async'.
            ///     For example, a method named 'myMethod' would be converted to a Promise-generating method named 'myMethodAsync'.
            /// </param>
            /// <param name="context" type="any">
            ///     The optional context (i.e. value of 'this') to which all created Promise-generating methods will be bound.
            ///     If not specified (i.e.undefined), the "this" value under which the generated methods execute is used.
            ///     Leaving this value undefined is highly-recommended, especially when <paramref name="source" /> is a function prototype.
            ///     It may, however, be advantageous to pass a value of null or an empty object when it is known that all methods require no context for proper execution.
            /// </param>
            /// <exception>One or more methods specified by <paramref name="methodNames" /> are not present on <paramref name="source" />.</exception>
            /// <exception>One or more target method names are already present on <paramref name="source" />.</exception>
            if (typeof suffix === "undefined") { suffix = 'Async'; }
            // Use the more flexible, central method, using the synchronous method factory.
            Convert.objectMethods(source, methodNames, Convert.fromSyncMethod, suffix, context);
        };

        //#endregion
        //#region From Specific Method Signatures
        Convert.fromAsyncMethod = function (wrapperMethod, context) {
            /// <summary>
            /// Creates a Promise-generating version of an asynchronous method from a standardized wrapper around that method.
            /// This method is intended to provide a flexible mechanism for wrapping existing asynchronous or deferred operations within a Promise.
            /// </summary>
            /// <param name="wrapperMethod" type="Function">
            ///     A method that wraps / maps an asynchronous method such that, in addition to the normal arguments of the wrapped method, <paramref name="wrapperMethod" /> accepts two additional parameters that are invoked to indicate that the asynchronous operation has been fulfilled or rejected.
            ///     <paramref name="wrapperMethod" /> must properly ensure that the provided methods for fulfillment or rejection are invoked properly.
            /// </param>
            /// <param name="context" type="any">
            ///     The context (i.e."this" value) applied to each execution of the <paramref name="wrapperMethod" />.
            ///     If not specified (i.e. undefined), the "this" value under which the returned IPromiseFactory executes is used.
            ///     This latter option is useful for encapsulating prototype-defined methods.
            ///     Also note that a value of null is allowed and different from a value of undefined.
            /// </param>
            /// <returns type="IPromiseFactory">
            ///     A function that wraps <paramref name="wrapperMethod" /> and, upon each invocation, is supplied appropriate methods to indicate fulfillment or rejection of the operation in addition to the (normal) invocation parameters and executed under the appropriate context, representing its fulfillment or rejection with a Promise.
            ///     Upon each execution of the IPromiseFactory, <paramref name="wrapperMethod" /> is executed and its return value (if any) is provided as the fulfillment value when it completes.
            ///     If <paramref name="wrapperMethod" /> throws an exception when it is invoked, the exception is immediately propagated; any later exception generated by the wrapped method should cause the returned Promise to be rejected with the exception provided as the reason.
            /// </returns>
            // Return a function that wraps the original method appropriately, producing a new Promise for each invocation.
            // Note that we need to avoid the arrow syntax to avoid capturing the outer context.
            return function () {
                var args = [];
                for (var _i = 0; _i < (arguments.length - 0); _i++) {
                    args[_i] = arguments[_i + 0];
                }
                // Determine and capture the execution context at the point of invocation, defaulting to the "this" object if the original parameter was undefined.
                var executionContext = (context === undefined) ? this : context;

                // Create the Deferred that we use to represent the operation.
                var def = new Promises.Deferred();

                // Attempt to execute the method and give it control of its fulfillment / rejection.
                // We presume that the method itself will execute asynchronously, so we can execute it now to (in theory) start the asynchronous operation.
                // Execute the method, passing the Deferred fulfillment and rejection functions to the wrapper method.
                // This give the method full control of its outcome.
                wrapperMethod.apply(executionContext, [def.fulfill, def.reject].concat(args));

                // Return the promise.
                return def.promise();
            };
        };

        Convert.fromNodeAsyncMethod = function (nodeMethod, context) {
            /// <summary>
            ///     Creates a Promise-generating, asynchronous method from an asynchronous method having a Node.js-style signature.
            ///     This specifically means that the method ends with a "(error, ...results)"  or similar callback.
            /// </summary>
            /// <param name="nodeMethod" type="Function">
            ///     An asynchronous Node.js-style function to encapsulate.
            /// </param>
            /// <param name="context" type="any">
            ///     The context (i.e."this" value) applied to each execution of the <paramref name="nodeMethod" />.
            ///     If not specified (i.e.undefined), the "this" value under which the returned IPromiseFactory executes is used.
            ///     This latter option is useful for encapsulating prototype-defined methods.
            ///     Also note that a value of null is allowed and different from a value of undefined.
            /// </param>
            /// <returns type="IPromiseFactory">
            ///     <para>
            ///         A function that wraps <paramref name="nodeMethod" /> and, upon each invocation, applies the invocation parameters and the appropriate context to <paramref name="nodeMethod" />, representing its fulfillment or rejection with a Promise.
            ///         Upon each execution of the IPromiseFactory, <paramref name="nodeMethod" /> is executed and its return value (if any) is provided as the fulfillment value when it completes.
            ///     </para>
            ///     <para>
            ///         If the <paramref name="nodeMethod" /> immediately throws an exception when it is invoked, the exception is propagated;
            ///         otherwise, any exception or error the method produced is encapsulated within the Promise as a rejection and provided reason.
            ///     </para>
            ///     <para>
            ///         The fulfillment value of the Promises created by this factory will vary depending upon the results provided to the callback of <paramref name="nodeMethod" />.
            ///         If the callback provides no result value(s), the Promises is fulfilled with no result.
            ///         If the callback is fulfilled with one result value (e.g. a callback that accepts "(error, value)"), the Promise is fulfilled with that one result value.
            ///         Otherwise, the callback produces multiple result values (e.g. a callback that accepts "(error, arg1, arg2, arg3, ...)") and the Promise will be fulfilled with a single array of those result values (e.g. [arg1, arg2, arg3, ...]).
            ///     </para>
            ///     <para>
            ///         Note that invocations of the returned IPromiseFactory should always omit the last argument of <paramref name="nodeMethod" /> (i.e. the completion callback) as it is being handled by this factory.
            ///     </para>
            /// </returns>
            // Create the Node.js-style wrapper, returning the factory using the generic async method.
            return Convert.fromAsyncMethod(function (fulfill, reject) {
                var args = [];
                for (var _i = 0; _i < (arguments.length - 2); _i++) {
                    args[_i] = arguments[_i + 2];
                }
                // Create a callback that's bound to our current values, taking the error (e) and value (v) result values and passing them accordingly.
                var callback = function (e) {
                    var values = [];
                    for (var _i = 0; _i < (arguments.length - 1); _i++) {
                        values[_i] = arguments[_i + 1];
                    }
                    // If we have an error, we reject the Promise; otherwise, we fulfill it.
                    // In both cases, we pass the values along.
                    if (!((e === undefined) || (e === null))) {
                        reject(e);
                    } else {
                        // Get the proper fulfillment value, defaulting to undefined.
                        var result;

                        // If there is only one result value, fulfill the Promise with it (to keep things simple).
                        // Otherwise, return the array of result values that the wrapped method provided.
                        if (values.length === 1) {
                            result = values[0];
                        } else {
                            result = values;
                        }

                        // Fulfill the Promise with the result.
                        fulfill(result);
                    }
                };

                // Call the method under the current context, but with the Node.js callback appended to the arguments list - the last argument is always the callback.
                nodeMethod.apply(this, args.concat([callback]));
            }, context);
        };

        Convert.fromSyncMethod = function (method, context) {
            /// <summary>
            ///     Creates a Promise-generating, asynchronous method from a synchronous method.
            /// </summary>
            /// <param name="method" type="Function">
            ///     A function to execute that optionally produces a value.
            /// </param>
            /// <param name="context" type="any">
            ///     The context (i.e."this" value) applied to each execution of the <paramref name="method" />.
            ///     If not specified (i.e.undefined), the "this" value under which the returned IPromiseFactory executes is used.
            ///     This latter option is useful for encapsulating prototype-defined methods.
            ///     Also note that a value of null is allowed and different from a value of undefined.
            /// </param>
            /// <returns type="IPromiseFactory">
            ///     A function that wraps <paramref name="method" /> and, upon each invocation, applies the invocation parameters and the appropriate context to the wrapped method, representing its fulfillment or rejection with a Promise.
            ///     Upon each execution of the IPromiseFactory, <paramref name="method" /> is scheduled for future execution and its return value (if any) is provided as the fulfillment value when it completes.
            ///     If the <paramref name="method" /> throws an exception, the promise is rejected with the exception as the provided reason.
            /// </returns>
            // Provide a mapping function to make the synchronous method asynchronous and use the formAsyncMethod implementation.
            return Convert.fromAsyncMethod(function (fulfill, reject) {
                var args = [];
                for (var _i = 0; _i < (arguments.length - 2); _i++) {
                    args[_i] = arguments[_i + 2];
                }
                // Capture the current context, since we're scheduling things for later.
                var executionContext = this;

                // Schedule execution of the method to ensure that the method behaves asynchronously, which handles the bulk of the work.
                Promises.Scheduler.scheduleExecution(function () {
                    try  {
                        fulfill(method.apply(executionContext, args));
                    } catch (methodError) {
                        reject(methodError);
                    }
                });
            }, context);
        };
        return Convert;
    })();
    Promises.Convert = Convert;
})(Promises || (Promises = {}));
//# sourceMappingURL=Promises.js.map
