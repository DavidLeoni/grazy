import * as nice from "./test-modules-3";

/**
 * The reference gralang implementation 
 */

class _Trial implements nice.Trial {
  _s: string;
  constructor(s: string) {
    this._s = s;
  }
  sing(): string {
    return this._s;
  }
}

export function Trial(z?: string): _Trial {
  if (z) {
    return new _Trial(z);
  } else {
    return new _Trial("bah");
  }

}

export module Trials {
  export function println(s : string) {
    console.log(s);
  };
}

