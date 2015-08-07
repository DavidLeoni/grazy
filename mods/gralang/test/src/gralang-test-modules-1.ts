module A {
  export interface Z {}
  export var x : string;
  export var y;  
}

module B {
  export var x : string;  
}

function testAB(){
  let a = A;
  let b = B;
    
  // doesn't work a = b;
  // doesn't work a.Z
  
  b = a;
}


module C {
  
  let _impl = D;  

  export function setImplementation(implementation){ // cannot specify the type. Well, who cares
    _impl = implementation;
  }
  
  /**
   * This could be a class
   */
  export interface Z {
    f() : string;
  }

  export function Z() : Z {
   return _impl.Z(); 
  }; 
  
  
  /**
   * This could be a library 
   */
  export interface WS {
    print(s : string) : void;
  }     
  
  export var WS = _impl.WS;
  
  /**
   * Mmm, what about submodule? 
   */
  export module YS {
    export declare function pri(s : string) : void;
  }    
  
  export declare class X {
     f():string;
     static of() : X;
  }
  
  export interface V {
     f():string;     
  }  
    
  export declare function V() : V; 
}



module D {
  
  let _impl = D;  
  
  /**
   * Need to replicate it to respect typing
   */
  export function setImplementation(implementation){ // cannot specify the type. Well, who cares
    _impl = implementation;
  }
  
  /** 
   * With underscore so doesn't clash with function Z()
   */
  class _Z implements C.Z { 
    f():string{
      return "";
    }
  }
     
  export function Z() : _Z {
   return new _Z();  
  };
  
  
  class _WS implements C.WS {     
    print(s : string) : void{
      console.log(s);
    }
  }
     
  export var WS = new _WS();
  
  /**
   * Mmm, what about submodule? 
   */
  export module YS {
    export function pri(s : string) : void {
      console.log(s);
    }
  }      
    
  export class X implements C.X {
     f():string{
        return "a";
     }
     static of() : X {
        return new X();
     };
         
     constructor(){
       return new X();
     }  
  }  
    
  class _V implements C.V{
    f():string{
      return "ciao";     
    }
  }
    
  export function V() : _V{
    return new _V();
  }
   
  
}

function testCD(){
   
   // c will be the namespace
   var c = C;
   // d will be the implementation
   var d = D;
   
   // this is what happens on import
   c = d; // this is fundamental to prove D respects all requirements of C, if not Typescript will complain.
   
   // let's try it out:
   let z = c.Z();
   c.WS.print("hello");
   
   let v = c.V();
   console.log(v.f());
   
   
     
   // note it is also possible to do the other way around (probably not useful):
   d = c;
      
}

let c = C;
c = D;

export default c;