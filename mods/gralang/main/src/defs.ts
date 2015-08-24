

declare let Object : any;



export var GRAZY_PREFIX = 'grazy';
export var GRAZY_IRI = 'https://github.com/DavidLeoni/grazy/';


/**
 * Usage: callConstructor(MyConstructor, arg1, arg2);
 */
export var callConstructor = function(constr) {
  var factoryFunction = constr.bind.apply(constr, arguments);
  return new factoryFunction();

};

/**
    Immutable. Adopts JsonLD tags.
*/
export class GraphNode {
  "@id": string;
  "@reverse": { [key: string]: GraphNode[] };
}

export var EmptyGraph: GraphNode = {
  "@id": GRAZY_IRI + "empty-node",
  "@reverse": <any>[]
};


/**
 * Usage: applyToConstructor(MyConstructor, [arg1, arg2]);
 */
export var applyToConstructor = function(constr, argArray) {
  var args = [null].concat(argArray);
  var factoryFunction = constr.bind.apply(constr, args);
  return new factoryFunction();
};


export enum ObjStatus {
  COMPLETED,
  TO_CALCULATE,
  ERROR
} 


/**
 * todo p1 add decorator for creating withers, 
 * see http://stackoverflow.com/questions/31224574/generate-generic-getters-and-setters-for-entity-properties-using-decorators
 */
export class Obj<T> { // cannot write T extends Obj...
  
  private __status = ObjStatus.TO_CALCULATE;
  
  /**
   * Eventual error is status is 'ERROR'
   */
  private __error: Err = Errors.NONE;


  private __clone(): T {
    let ret: T = <any> {};
    for (let k of Object.keys(this)) {
      ret[k] = this[k];
    }
    return ret;
  }

  protected _as(err: Err): T {
    let ret: Obj<{}> = <any> this.__clone();

    ret.__status = ObjStatus.ERROR;
    if (err) {
      ret.__error = err;
    } else {
      ret.__error = new Err(new Error(), "Tried to set error on ", this, " but forgot to pass Err object!!");
    }
    return <any> ret;
  }

  protected _error(): Err {
    return this.__error;
  }

  protected _status(): ObjStatus {
    return this.__status;
  }


  constructor() {
    this.__status = ObjStatus.TO_CALCULATE;
    this.__error = Errors.NONE;
  }

  /**
   * Returns new object with property prop set to v. Property MUST belong to object type definition propoerties
   * TODO this currently doesn't do any type checking (sic), maybe maybe we can fix it.
   * Also, for output type, see https://github.com/Microsoft/TypeScript/issues/285
   * See also 'Compile-time checking of string literal arguments based on type': https://github.com/Microsoft/TypeScript/issues/394
   * 'nameof' operator support: https://github.com/Microsoft/TypeScript/issues/1579
   * 
   */
  with(prop: string, v: any): T {
    let ret: T = this.__clone();
    ret[prop] = v;
    return <T> ret;
  }
}

/**
 * This class encapsulates Javascript Error object. It doesn't extend it because all the error inheritance stuff
 * in Javascript is really fucked up.
 *
 */
export class Err extends Obj<Err> {

  name: string;
  message: string;
  error: Error;
  params: any[];

  /**
   * You must pass a JavaScript Error so browser can keep track of stack execution. Message in original error is not considered.
   * Usage example: new GrazyErr(new Error(), "We got a problem!", "This object looks fishy: ", {a:666});
   * @param message Overrides message in Error.
   */
  constructor(error: Error, message, ...params) {
    super();
    // console.error.apply(null, params);
    this.name = (<any>this.constructor).name;
    this.message = message;
    this.error = error;
    this.params = params;
  }


  toString() {
    return this.allParams().join("");
  }


  /**
   * Returns array with name, message plus all params
   */
  allParams(): any[] {
    var ret = this.params.slice(0)
    var afterMsg = "\n";
    if (this.params.length > 0) {
      afterMsg = "\n";
    }
    ret.unshift(this.message + afterMsg);
    ret.unshift(this.name + ":");
    return ret;
  }

  /** Reports the error to console with console.log */
  consoleLog(): void {
    console.log.apply(console, this.allParams());
    console.log(this.error);
  }

  /** Reports the error to console with console.error */
  consoleError(): void {
    var completeParams = this.allParams().slice(0);
    completeParams.push(" \n", this.error);
    console.error.apply(console, completeParams);
  }
}


export module Errors {
  export let NONE = new Err(null, "");

}

export class EqErr extends Err {
  constructor(error: Error, actual) {
    super(error, "Failed assertion!",
      "  Expected something different than ->", actual, "<-\n");
    this.actual = actual;
  }
  actual: any;
}

export class NotEqErr extends Err {
  constructor(error: Error, expected, actual) {
    super(error, "Failed assertion!",
      "  Expected ->", expected, "<-\n",
      "  Actual   ->", actual, "<-");
    this.expected = expected;
    this.actual = actual;
  }
  actual: any;
  expected: any;
}



/**
 * A lazy sequence, possibly infinite
 */
export class Seq<T extends Obj<{}>> extends Obj<Seq<T>> {
  first(): T {
    throw new Error("Subclasses must implment me!");
  };
  next(): Seq<T> {
    throw new Error("Subclasses must implment me!");
  };
  size(): SuperNat {
    throw new Error("Subclasses must implment me!");
  };
}






/** 
 * A possibly infinite natural number >= 0
 */
export class SuperNat extends Seq<Nil> {
  next(): SuperNat {
    throw new Error("Subclasses must implment me!");
  };
  plus(n: SuperNat): SuperNat {
    throw new Error("Subclasses must implment me!");
  };

  size(): SuperNat {
    return this;
  }
}

/** 
 * Here it is, the evil infinity
 */
export class InfinityNat extends SuperNat {

  first(): Nil {
    return nil;
  }
  next(): InfinityNat {
    return this;
  }

  plus(n: SuperNat): InfinityNat {
    return this;
  }

  size() {
    return this;
  }
}


export class Bool extends Obj<Bool> {
}

/*
export function if_(c: Bool, th: Expr, el: Expr) {

}
*/
     
/** 
 * A finite natural number >= 0
 */
export class Nat extends SuperNat {              
  // Should return itself!        
  size(): Nat {
    return this;
  }


  plus(n: Nat): Nat
  plus(n: SuperNat): SuperNat {
    return this;
  }

}

export class NatZero extends Nat {
        
  constructor (){
    super();    
  }        
        
  //plus(n: NatZero): NatZero
  //plus(n: PositiveNat): PositiveNat
  plus(n: Nat|NatZero|PositiveNat): Nat  
  plus(n: SuperNat): SuperNat {
    if (n instanceof NatZero) {
      return this;
    } else {
      return <any> n;
    }
  }

  first(): Nil {
    return <any> this._as(new Err(new Error(), "Tried to get next() of zero!"));
  }

  next(): Nat {
    return <any> this._as(new Err(new Error(), "Tried to get next() of zero!"));
  }

  size(): NatZero {
    return this;
  }
}

export class NatOne extends PositiveNat {

  constructor(){
    super(Nats.zero);
  }

  first(): Nil {
    return nil;
  }

  next(): NatZero {
    return Nats.zero;
  }

  size(): NatOne {
    return this;
  }
}


export class PositiveNat extends Nat {

  private _next: Nat;

  constructor(n: Nat) {
    super();
    this._next = n;
  }  
  
  //plus(n: Nat): PositiveNat;      
  plus(n: SuperNat): SuperNat {
            
    if (n instanceof InfinityNat) {
      return n;
    } else if (eq(this._next, Nats.zero)) {
      return new PositiveNat(<Nat> n);
    } else {
      return new PositiveNat(this._next.plus(<Nat> n));
    }            

  }

  first(): Nil {
    return <any> this._as(new Err(new Error(), "Tried to get next() of zero!"));
  }

  next(): Nat {
    return <any> this._as(new Err(new Error(), "Tried to get next() of zero!"));
  }

  size(): PositiveNat {
    return this;
  }
}

export module Nats {
  export const zero: NatZero = new NatZero();
  export const one: NatOne = new NatOne();
  export const two: PositiveNat = <any> one.plus(one); // todo remove stupid any
  export const infinity: InfinityNat = new NatZero();
}
     
/**
 * A finite list
 */
export class List<T extends Obj<{}>> extends Seq<T > {
  next(): List<T> {
    throw new Error("Descendants should implement this method!");
  };
  size(): Nat {
    throw new Error("Descendants should implement this method!");
  }
}

export class Cons<T extends Obj<{}>> extends List<T> {
  _next: List<T>;
  next(): List<T> {
    return this._next;
  }
  size(): Nat {
    return Nats.one.plus(this.next().size());
  }

}


export class TNil<T extends Obj<{}>> extends List<T> {

  /**
      [].pop() returns undefined . I will be less forgiving.
  */
  first(): T {
    return <any> this._as(new Err(new Error(), "Tried to call first() on empty list!"));
  };

  size(): NatZero {
    return Nats.zero;
  }

  /**
      [1,2].slice(2,2) returns [] . I will be less forgiving.
  */
  next(): List<T> {
    return this._as(new Err(new Error(), "Tried to call next() on empty list!"));
  };
}

export type Nil = TNil<any>;

export let nil: Nil = new TNil();

export let list = function <T extends Obj<{}>>(...args: T[]): List<T> {
  if (args.length === 0) {
    return nil;
  }
}

/**
 * Returns true if two objects are structurally equal.
 * todo need spec-like version, this one is already 'too efficient'
 */
export let eq = function (a : Obj<any>, b : Obj<any>) : boolean {
  let t = Object.is(a,  b);
  if (!t){
    for (let key of Object.keys(a)){
        if (!eq(a[key], a[key])){
          return false;
        }        
    }    
  }  
  return true;
}  


/**
 * Takes a variable number of arguments and displays them as concatenated strings in an alert message, plus it calls console.error with the same arguments. Usage example:
 * signal(new Error(), "We got a problem", "Expected: ", 3, " got:", 2 + 2);
 * @returns {GrazyErr}
 */
export var report = function(error: Error, ...args) {
  var i;
  var arr = [];
  for (i = 0; i < arguments.length; i++) {
    arr.push(arguments[i]);
  }
  var exc = applyToConstructor(Err, arr);

  exc.toConsole();
  alert(exc.toString() + "\n\nLook in the console for more details.");
  return exc;
};



/**
 * Visits nodes of type N and outputs type M
 */
export interface TreeVisitor<N, M> {
  getChildren(t: N): N[];
}



export module test {
  
  
 
  /**
   * Uses Javascript's Object.is
   * 
   * Doesn't throw any exception,
   * @return null if no error occurred
  */
  export function assertIs(expected, actual): Err {
    var res = Object.is(actual, expected);
    if (res) {
      return null;
    } else {
      return new NotEqErr(new Error(), expected, actual);
    }
  }
  
  /**   
   * Returns EqErr in case actual is equals to notExpected. Uses Javascript Object.is
   * Doesn't throw any exception
   * @return null if no error occurred
  */
  export function assertNotIs(notExpected, actual): Err {
    var res = Object.is(actual, notExpected);
    if (res) {
      return new EqErr(new Error(), actual);
    } else {
      return null;
    }
  }
  

  /**
   * Doesn't throw any exception,
   * @return null if no error occurred
  */
  export function assertEq(expected, actual): Err {
    var res = eq(actual, expected);
    if (res) {
      return null;
    } else {
      return new NotEqErr(new Error(), expected, actual);
    }
  }
  
  /**   
   * Returns EqErr in case actual is equals to notExpected.
   * Doesn't throw any exception
   * @return null if no error occurred
  */
  export function assertNotEq(notExpected, actual): Err {
    var res = eq(actual, notExpected);
    if (res) {
      return new EqErr(new Error(), actual);
    } else {
      return null;
    }
  }
  


  export class TestResult {
    testName: string
    test: any; // todo should be a method sig
    error: Err;

    constructor(testName, test, error?: Err) {
      this.testName = testName;
      this.test = test;
      this.error = error;
    }
  }

  export class TestSuite {
    tests: any;
    name: string;
    testResults: TestResult[];
    passedTests: TestResult[];
    failedTests: TestResult[];

    constructor(name: string, tests) {
      this.testResults = [];
      this.passedTests = [];
      this.failedTests = [];
      this.name = name;
      this.tests = tests;
    }

    run() {
      this.testResults = [];
      this.passedTests = [];
      this.failedTests = [];

      for (var key in this.tests) {
        var grazyErr: Err = null;
        try {
          grazyErr = this.tests[key]();
        } catch (catchedError) {
          if (catchedError instanceof Err) {
            grazyErr = catchedError;
          } else {
            grazyErr = new Err(catchedError, "Test threw an Error!");
          }
        }
        var testRes = new TestResult(key, this.tests[key], grazyErr);
        this.testResults.push(testRes);

        if (grazyErr) {
          this.failedTests.push(testRes);
        } else {
          this.passedTests.push(testRes);
        }
      }

    }
  }
}

export module Trees {
  /**
   * Recursively applies function makeM to a node of type N and
   * M-fied children of type M, so the resulting tree will have type M
   * @param getChildren leaf nodes have zero children
   * @param makeM function that takes node to M-ify,
   *        the field name (or index) that was holding it
   *        and its now M-fied children
   */
  export function fold<N, M>(rootNode: N,
    getChildren: (t: N) => N[],
    makeM: (field, t: N, children: M[]) => M): M {

    var processedNodesCounter = 0;

    /** Holds original nodes */
    var stack1 = [{
      key: null,
      node: rootNode
    }]; // only rootNode should have null as key

    /** Holds nodes-as-expressions that still need to be completely filled with
      M-fied children */
    var stack2: {
      key: any;
      node: N;
      neededChildren: number;
      children: any[]; //[<any, M>]
    }[] = [];


    /**
        Inserts node to existing children container in top entry of stack2.
        If inserting the node fills the children container,
        resolves expressions popping nodes in stack2. If stack2 gets empty
        returns last calculated expression, otherwise return null.
    */
    var nodeToStack2 = (key: any, node: N): M => {

      var toInsert = makeM(key,
        node,
        []);
      var curKey = key;

      while (stack2.length > 0) {

        var top2 = stack2[0];

        top2.children.unshift([curKey, toInsert]);

        if (top2.children.length > top2.neededChildren) {
          throw new Err(new Error(), "Found more children in top2 than the needed ones!",
            "stack1: ", stack1, "top2 =", top2, "stack2: ", stack2);
        }

        if (top2.neededChildren === top2.children.length) {
          stack2.shift();


          toInsert = makeM(top2.key, top2.node, top2.children);
          curKey = top2.key;
        } else {
          return null;
        }

      }


      return toInsert; // stack2.length = 0

    }

    var ret: M;


    while (stack1.length > 0) {

      var el = stack1.shift();

      var children = getChildren(el.node);


      if (children.length === 0) { // leaf node
        ret = nodeToStack2(el.key, el.node);
        if (stack1.length === 0) {
          if (stack2.length > 0) {
            throw new Err(new Error(), "Found non-empty stack2: ", stack2);
          }
          return ret;
        } else {
          if (stack2.length === 0) {
            return ret;
          } else {
            if (ret) {
              throw new Err(new Error(), "ret should be null, found instead ", ret);
            }
          }
        }
      } else {  // non-leaf nosde
        children.forEach((c, k) => {
          stack1.unshift({
            node: c,
            key: k
          });
        });
        var childrenContainer = [];
        var toStack2 = {
          node: el.node,
          key: el.key,
          neededChildren: children.length,
          children: childrenContainer
        };
        stack2.unshift(toStack2);
      }

    }

    throw new Error("Shouldn't arrive till here...");

    return makeM(null, null, null);
  }

  export function height<N>(node: N,
    getChildren: (t: N) => N[]): number {
    return Trees.fold(node, getChildren, (parentField, n, cs: number[]) => {
      return cs.length === 0 ?
        0
        : Math.max.apply(null, cs) + 1;
    })
  }

}

