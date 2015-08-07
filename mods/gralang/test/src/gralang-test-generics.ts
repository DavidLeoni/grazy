

interface A<T> {
}

interface AI<T> {
	f():T;
}


class AC<T> {
	f():T{return null;};
}

/**
 * Without fields or functions, strange assignments can happen!
 */
function testA() {
	
	let a1 : A<string>;
	let a2 : A<string>;
	a1 = a2;
	
	let ai1 : AI<string>;
	let ai2 : AI<number>;
	// cannot ai1 = ai2;
	
	let ac1 : AC<string>;
	let ac2 : AC<number>;		
	// cannot ac1 = ac2;
	
}


class B<T> {
	data : T;
	f() : T{
		return null;
	};
}

class Z extends B<string>{
	
	// cannot do this: f() : number{ return null;};
}

/**
 * B has field, we can't do it: 
 */
function testB() {
	let b1 : B<string> = new B<string>();
	let b2 : B<number> = new B<number>();
	console.log(b1.data);
	//b1 = b2;		
}


/* cannot do this:
class C extends B<string> {	
	f() : number{
		return null;
	};
} */

class E extends B<number> {	
}

class D<T extends B<string>>{
	x : T;
}

function testD(){
	// doesn't work: let d1 : D<C>;
}	

interface WithProperty {
	prop : number;
}

class WithPropertyImpl implements WithProperty{
	/**
	 * Need to implement at least the getter:
	 */
	get prop() : number{
		return 3;	
	}
	
}

function testWithProperty(){
	// can't do it (of course!) let wp1 : WithProperty = new WithProperty();	
	let wp2 : WithProperty = new WithPropertyImpl();
} 
	
	

