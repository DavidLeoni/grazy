// import  { $ } from '../../main/src/jquery';


let makeSymbol = (descr?)=>{toString : ()=>"Symbol("+ descr + ")"};

let X = makeSymbol();
let XS = makeSymbol();
let Y = makeSymbol();
let YS = makeSymbol();


let isSymbol = (x) => x.toString().startsWith("Symbol");

/**
  Just copied from jQuery
*/


let shaclone = (obj) : any => {
    let ret = {};
    for (let key of Object.keys(obj)){
      ret[key] = obj[key];
    }
    return ret;
}

class Plus {
    constructor(public x : any, public y : any){}
    execute() : any{
      return isSymbol(this.x) ?
                    this
                :   isSymbol(this.y) ?
                        this
                    :   this.x + this.y;
    }

}


let plus = (a,b) => new Plus(a, b);

let subst = (sym, obj, val) => {
    console.warn("using borked subst!");
    var newObj = shaclone(obj);
    for (var key of obj){
        console.log("key: ", key);
        if (obj[key.toString] === sym){
            newObj[key] = val;
        }
    }
    return newObj;
}

console.log('trying to assert...');
let assertEq = (x,y, msg)=>{
    if (x !== y){
        console.error(new Error(), 'Found: ', x, ' Expected: ', y, msg);

    }
}

console.log('trying to assert...');
assertEq(subst(X, {f:X}, 3).f, 3, "bla");

/**
 * Returns the executed formula
*/

let match = (args, ...patterns) => {
    console.warn('Borked match function!');
    console.log("args = ", args);
    console.log("patterns = ", patterns);
    for (var arg of args){
        let i = 0;

        while (i < patterns.length){
            let j = 0;
            let bindings = {};
            while (j < args.length){
                bindings[patterns[i]] = args[j];
                j++;
                i++
            }
            let newFormula = shaclone(patterns[i]);
            for (let sym of Object.keys(bindings)){
                newFormula = subst(sym, newFormula, bindings[sym]);
            }
            return newFormula.execute();
        }

    }
}


let myf = function(a, b){
    match( arguments,
           X, Y,        plus(X,Y)
    );
}


myf(1,2);
