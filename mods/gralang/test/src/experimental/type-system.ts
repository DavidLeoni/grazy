





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


class I {
	static  c : string = "stupid";
}



// refining methods types test

class Y_1 {
	f(){}
}

class Y_2 extends Y_1 {
	
}


interface X_1 {
	m() : Y_1;
}

class X_2 implements X_1{
	m() : Y_2{
		return new Y_1();
	};
}
