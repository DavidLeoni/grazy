declare module Promises {
    interface IPromise extends ISpecificationPromise {
        always(onFulfilledOrRejected: IPromiseContinuation): IPromise;
        then: IRegisterPromiseContinuations;
    }
    interface IPromiseContinuation {
        (result?: any): any;
    }
    interface IRegisterPromiseContinuations extends IRegisterPromiseSpecificationContinuations {
        (onFulfilled?: IPromiseContinuation, onRejected?: IPromiseContinuation): IPromise;
    }
    interface IRegisterPromiseSpecificationContinuations {
        (onFulfilled?: IPromiseContinuation, onRejected?: IPromiseContinuation): ISpecificationPromise;
    }
    interface ISpecificationPromise {
        then: IRegisterPromiseSpecificationContinuations;
    }
}
declare module Promises {
    interface IScheduler {
        (func: Function): void;
    }
    class Scheduler {
        static scheduleExecution: IScheduler;
    }
}
declare module Promises {
    interface IResolvable extends ISpecificationPromise {
        fulfill(result?: any): void;
        reject(reason?: any): void;
    }
    enum DeferredState {
        Pending = 0,
        Fulfilled = 1,
        Rejected = 2,
    }
    class Deferred implements ISpecificationPromise, IResolvable {
        public getState: () => DeferredState;
        public promise: () => IPromise;
        public reject: (reason?: any) => void;
        public fulfill: (result?: any) => void;
        public then: IRegisterPromiseContinuations;
        constructor();
    }
}
declare module Promises {
    class Promise implements IPromise {
        public always(onFulfilledOrRejected: IPromiseContinuation): IPromise;
        public then: IRegisterPromiseContinuations;
        constructor(thenMethod: IRegisterPromiseContinuations);
        static rejected: IPromise;
        static never: Promise;
        static fulfilled: IPromise;
        static fromThenable(thenable: any): IPromise;
        static fulfilledWith(result?: any): IPromise;
        static rejectedWith(reason?: any): IPromise;
        static whenAll(promises: IPromise[]): IPromise;
        static whenAny(promises: IPromise[]): IPromise;
    }
}
declare module Promises {
}
declare module Promises {
    interface IPromiseFactory {
        (...args: any[]): IPromise;
    }
    interface IAsynchronousMethodWrapper {
        (fulfillmentMethod: (result?: any) => void, rejectionMethod: (reason?: any) => void, ...normalArgs: any[]): void;
    }
    class Convert {
        static objectMethods(source: any, methodNames: string[], factory: (f: Function, c?: any) => IPromiseFactory, suffix?: string, context?: any): void;
        static objectNodeAsyncMethods(source: any, methodNames: string[], suffix?: string, context?: any): void;
        static objectSyncMethods(source: any, methodNames: string[], suffix?: string, context?: any): void;
        static fromAsyncMethod(wrapperMethod: IAsynchronousMethodWrapper, context?: any): IPromiseFactory;
        static fromNodeAsyncMethod(nodeMethod: Function, context?: any): IPromiseFactory;
        static fromSyncMethod(method: Function, context?: any): IPromiseFactory;
    }
}
