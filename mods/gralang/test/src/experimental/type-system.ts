





class A {
	"__org.my-namespace.myprop" = true;
}


class B {
	"__org.my-namespace.myprop" : boolean;
	f(){
	};
}


let a : A = new B();

//let b : B = new A();

class E {
	r : number;
}


class Obj {
	b : E;
}

class C extends Obj {
	b : E = {
		r : 1,
		"z":5}
}


class D extends Obj {
	b : E = {r : 6}
}


class HasP  {
	b : {
		r : number,
		"p" : boolean
	}
}

let d : D = new C();

let hp : HasP = {
	b : {r :7,
		"p" : false}
}