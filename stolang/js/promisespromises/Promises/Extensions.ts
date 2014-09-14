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

    //#region Static Member Implementations
    
    // These have to be instantiated after the Promise class has defined them and itself.

    Promise.rejected = (function () {
        /// <summary>Creates a single instance of a Promise that has been rejected (i.e. completed with an error).</summary>
        /// <returns type="Promise">A Promise that has been rejected (i.e. completed with an error).</returns>

        // Resolve a Deferred to represent a failed one, returning it.
        var completed = new Deferred();
        completed.reject();
        return completed.promise();
    } ());


    Promise.fulfilled = (function () {
        /// <summary>Creates a single instance of a fulfilled (i.e. successfully-resolved) Promise.</summary>
        /// <returns type="Promise">A Promise that has been fulfilled.</returns>

        // Resolve a Deferred to represent a completed one, returning it.
        var completed = new Deferred();
        completed.fulfill();
        return completed.promise();
    } ());

    //#endregion

}