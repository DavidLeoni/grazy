

declare var Proxy : any;

let makeVar_1 = (context, varName) =>
{
    if (context[varName]){
        return context[varName];
    } else {
        var handler = {
            get: function(target, name){
                return name;
            }
        };
        let ret = new Proxy({}, handler);

        ret["@type"]="Var";
        context[varName] = ret;

        return ret;
    }

}


let Var = function(name){
    this.name = name;
}


let makeVar = (name)=>{

    let Z : any = {}
    Z["@type"] = "Var";
    Z.restVar = false;
    Z.name = name;
    Z[Symbol.iterator] = function(){
        let isDone = false;
        return {
                    next:function(){
                           let ret = {
                                    done: isDone,
                                    value : Z
                            }
                            Z["@restVar"] = true;
                            isDone = !isDone;
                            return ret;
                    }

                };

    };

    return Z;
};




let Grazy : any = {}
Grazy.matchStack = [];

let isVar = (v)=> v && v["@type"] === "Var";

let PatternErr = function(err, patternNum, ...args){
    this.err = err;
    this.patternNum = patternNum;
    this.args = args;
    console.error(args);
}

let match = (args, ...patterns)=>{
    let ctx = {};
    Grazy.matchStack.push(ctx);

    let isPattern = true;
    let p = null;
    let e = null;
    let patternCount = 0;
    for (let arg of args){
        for (let ps of patterns){

            if (patternCount % 2 === 0){
                p = ps;
                continue;
            } else {
                e = ps;

                if (Array.isArray(p)){
                    if (!Array.isArray(arg)){
                        return new PatternErr(new Error(),
                                                patternCount,
                                                "found array in pattern ",
                                                patternCount,
                                                "but not in argument ", arg);
                    }
                }

                patternCount += 1;
            }


        }
    }


    Grazy.matchStack.pop();
};



let Person = function() {

}

let _ = makeVar("any");
let X = makeVar("X");
let Y = makeVar("Y");
let XS = makeVar("XS");

match([1,2],
      [[],X], 4);


let mres = match(  [1,2],
                    [X, Y], [X,X],
                    _, 3
    );

console.log("mres = ", mres);

let myf = (a,b)=>
    match(arguments,
          [X], [X,X],
          _, 3
    );
