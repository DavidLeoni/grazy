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

    export interface IPromise extends ISpecificationPromise {
        /// <summary>
        /// An enhanced Promise or future that meets and exceeds the functionality of the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/).
        /// </summary>

        /// <field name="always" type="Function(IPromiseContinuation): IPromise">Registers a continuation for this Promise for both fulfillment and rejection. This is a convenience wrapper for the "then" method that is not a part of the specification.</field>
        always(onFulfilledOrRejected: IPromiseContinuation): IPromise;

        /// <field name="then" type="IRegisterPromiseContinuations">Registers continuations or callbacks for this Promise that are executed when the Promise is fulfilled or rejected.</field>
        then: IRegisterPromiseContinuations;
    }

    export interface IPromiseContinuation {
        /// <summary>
        /// A continuation or callback method for fulfillment or rejection as defined by the Promises/A+ specification.
        /// </summary>
        /// <param name="result" type="any">The optionally-provided result of fulfillment or reason for rejection (as appropriate) provided by a fulfilled or rejected Promise.</param>
        (result?): any;
    }

    export interface IRegisterPromiseContinuations extends IRegisterPromiseSpecificationContinuations {
        /// <summary>
        /// A method that supports the registration of fulfillment and / or rejection continuations to an enhanced Promise.
        /// </summary>
        /// <param name="onFulfilled" type="IPromiseContinuation">The optional method that is executed if the Promise is fulfilled, accepting the result of the promise (if any) as a parameter.</param>
        /// <param name="onRejected" type="IPromiseContinuation">The optional method that is executed if the Promise is rejected, accepting the reason for rejection (if any) as a parameter.</param>
        /// <returns type="IPromise">
        /// An enhanced Promise that exceeds the characteristics defined by the Promises/A + specification.
        /// </returns >
        (onFulfilled?: IPromiseContinuation, onRejected?: IPromiseContinuation): IPromise;
    }

    export interface IRegisterPromiseSpecificationContinuations {
        /// <summary>
        /// A method that supports the registration of fulfillment and / or rejection continuations to a Promise, as defined by the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/).
        /// </summary>
        /// <param name="onFulfilled" type="IPromiseContinuation">The optional method that is executed if the Promise is fulfilled, accepting the result of the promise (if any) as a parameter.</param>
        /// <param name="onRejected" type="IPromiseContinuation">The optional method that is executed if the Promise is rejected, accepting the reason for rejection (if any) as a parameter.</param>
        /// <returns type="ISpecificationPromise">
        /// A Promise with the characteristics defined by the Promises/A + specification.
        /// If neither onFulfilled nor onRejected are valid functions, this method returns the current Promise; otherwise, a new Promise is created.
        /// The returned Promise is fulfilled after either onFulfilled or onRejected is executed.
        /// The fulfillment result or rejection reason provided for the returned Promise is the return value of the associated callback, if any return value is provided.
        /// </returns >
        (onFulfilled?: IPromiseContinuation, onRejected?: IPromiseContinuation): ISpecificationPromise;
    }

    export interface ISpecificationPromise {
        /// <summary>
        /// A Promise or future - as defined by the Promise/A+ specification (http://promises-aplus.github.io/promises-spec/) - which represents an operation that will complete (possibly producing a value) in the future.
        /// </summary>

        /// <field name="then" type="IRegisterPromiseSpecificationContinuations">Registers continuations or callbacks for this Promise that are executed when the Promise is fulfilled or rejected.</field>
        then: IRegisterPromiseSpecificationContinuations;
    }

}