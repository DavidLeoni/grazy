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

module Promises {

    "use strict";

    //#region Interfaces

    export interface IPromiseFactory {
        /// <summary>
        /// A method that generates a new Promise upon each invocation.
        /// Implementators of this interface encapsulate non-promise methods in such a way that each execution of the implementor executes the wrapped method in a Promises/A+-compliant manner and represents the result as a Promise.
        /// </summary>
        /// <param name="args" type="any">Any arguments to be passed to the encapsulated method upon invocation.</param>
        /// <returns type="IPromise">A Promise that represents the result of the current invocation of the method given the provided arguments.</returns>

        (...args: any[]): IPromise
    }

    export interface IAsynchronousMethodWrapper {
        /// <summary>
        /// A wrapper method that encapsulates an asynchronous operation, translating it to a common signature for conversion to a Promise.
        /// Implementators of this interface encapsulate non-Promise, asynchronous methods in such a way that each execution of the implementor executes the wrapped method in a Promises/A+-compliant manner and represents the result as a Promise.
        /// Implementations must meet the following requirements / design guidelines:
        ///     * The implementation must call the provided <paramref name="fulfillmentMethod" /> if / when the wrapped method completes successfully, optionally supplying a fulfillment value.
        ///     * The implementation must call the provided <paramref name="rejectionMethod" /> if / when the wrapped method encounters an error or does not complete successfully, optionally supplying a reason.
        ///     * Implementors must ensure that the method it encapsulates is executed under the context under which the implementor is invoked - that is, that execution context is properly propagated as necessary.
        ///     * If the invocation of the wrapped method immediately throws an exception, that exception should be allowed to propagate to the caller; all other exceptions should cause the returned Promise to be rejected.
        /// </summary>
        /// <param name="fulfillmentMethod" type="function">A function passed to the wrapper method that it can call to indicate that the wrapped asynchronous operation has completed (i.e. been fulfilled), optionally providing a resulting value.</param>
        /// <param name="rejectionMethod" type="function">A function passed to the wrapper method that it can call to indicate that the wrapped asynchronous operation has failed (i.e. been rejected), optionally providing a reason for the failure.</param>
        /// <param name="normalArgs" type="any">Any arguments normally passed to the wrapped method.</param>

        (fulfillmentMethod: (result?) => void, rejectionMethod: (reason?) => void, ...normalArgs: any[]): void
    }

    //#endregion

    export class Convert {
        /// <summary>
        /// Provides mechanisms for converting (i.e. encapsulating) various types of non-Promise methods into Promises/A+-compliant forms.
        /// </summary>

        //#region Multiple Methods on an Object

        static objectMethods(source: any, methodNames: string[], factory: (f: Function, c?: any) => IPromiseFactory, suffix: string = 'Async', context?: any) {
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

            // Create some arrays to store names that are either not present or collide, preventing us from doing anything.
            var undefinedMethods = [],
                collidingTargetMethodNames = [];

            // Iterate over each method name.
            // We choose this single-iteration pattern because the far more common case should be that this method executes with no errors (error should only occur during development).
            methodNames.forEach((methodName) => {

                // If the named method exists, wrap it.
                if (methodName in source) {

                    // Form the target method name, proceeding only if the target name doesn't exist.
                    var targetName = methodName + suffix;
                    if (targetName in source) {
                        // Record the target name collision.
                        collidingTargetMethodNames.push(targetName);
                    }
                    else {
                        // Create the target method on the source object using the appropriate factory method and context.
                        source[targetName] = factory(source[methodName], context);
                    }
                }
                else {
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

        }

        static objectNodeAsyncMethods(source: any, methodNames: string[], suffix: string = 'Async', context?: any): void {
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
            
            // Use the more flexible, central method, using the Node.js method factory.
            Convert.objectMethods(source, methodNames, Convert.fromNodeAsyncMethod, suffix, context);
        }

        static objectSyncMethods(source: any, methodNames: string[], suffix: string = 'Async', context?: any): void {
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

            // Use the more flexible, central method, using the synchronous method factory.
            Convert.objectMethods(source, methodNames, Convert.fromSyncMethod, suffix, context);
        }

        //#endregion

        //#region From Specific Method Signatures

        static fromAsyncMethod(wrapperMethod: IAsynchronousMethodWrapper, context?: any): IPromiseFactory {
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
            return function (...args: any[]) {

                // Determine and capture the execution context at the point of invocation, defaulting to the "this" object if the original parameter was undefined.
                var executionContext = (context === undefined) ? this : context;

                // Create the Deferred that we use to represent the operation.
                var def = new Deferred();

                // Attempt to execute the method and give it control of its fulfillment / rejection.
                // We presume that the method itself will execute asynchronously, so we can execute it now to (in theory) start the asynchronous operation.

                // Execute the method, passing the Deferred fulfillment and rejection functions to the wrapper method.
                // This give the method full control of its outcome.
                wrapperMethod.apply(executionContext, [def.fulfill, def.reject].concat(args));

                // Return the promise.
                return def.promise();
            };
        }

        static fromNodeAsyncMethod(nodeMethod: Function, context?: any): IPromiseFactory {
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
            return Convert.fromAsyncMethod(function (fulfill, reject, ...args: any[]) {

                // Create a callback that's bound to our current values, taking the error (e) and value (v) result values and passing them accordingly.
                var callback = (e, ...values: any[]) => {

                    // If we have an error, we reject the Promise; otherwise, we fulfill it.
                    // In both cases, we pass the values along.
                    if (!((e === undefined) || (e === null))) {
                        reject(e);
                    }
                    else {
                        // Get the proper fulfillment value, defaulting to undefined.
                        var result;

                        // If there is only one result value, fulfill the Promise with it (to keep things simple).
                        // Otherwise, return the array of result values that the wrapped method provided.
                        if (values.length === 1) {
                            result = values[0];
                        }
                        else {
                            result = values;
                        }

                        // Fulfill the Promise with the result.
                        fulfill(result);
                    }
                };

                // Call the method under the current context, but with the Node.js callback appended to the arguments list - the last argument is always the callback.
                nodeMethod.apply(this, args.concat([callback]));
            }, context);
        }

        static fromSyncMethod(method: Function, context?: any): IPromiseFactory {
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
            return Convert.fromAsyncMethod(function (fulfill, reject, ...args) {

                // Capture the current context, since we're scheduling things for later.
                var executionContext = this;

                // Schedule execution of the method to ensure that the method behaves asynchronously, which handles the bulk of the work.
                Scheduler.scheduleExecution(() => {

                    // Attempt to execute the method in the appropriate context and return any result.
                    // If we fail, return the exception as the reason.
                    try {
                        fulfill(method.apply(executionContext, args));
                    }
                    catch (methodError) {
                        reject(methodError);
                    }
                });
            }, context);
        }

        //#endregion
    }

} 