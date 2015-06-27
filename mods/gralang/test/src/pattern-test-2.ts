declare var Symbol : any;


let W = Symbol();

let Z : any = {}
Z[Symbol.iterator] = function(){
    return {
                next:function(){
                       return {
                                done:true,
                                value : 3
                        }



                }

            };

};

var WS = function(){};

WS[Symbol.iterator] = Z[Symbol.iterator];

/* generator currently not supported by typescript
    WS[Symbol.iterator] = function* () {
    yield new WS();
}; */

WS.prototype.toString = ()=>"bla WS";

let [a,b] = [1,2];
let v = [1,2];

var myg = function(...vs){
    console.log(vs);
}

myg(1,2,3);

myg(...[1,2]); // nothing to output

myg(...v);

myg(...[1,2]); // 1 2

myg(...W); // a b

myg([X, ...WS])

console.log(WS);
