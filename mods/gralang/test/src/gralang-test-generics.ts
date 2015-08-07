


interface A<T> {
}
interface B<T> {
	data : T;
}

function trial() {
	let a1 : A<string>;
	let a2 : A<number>;
	a1 = a2;
	
	let b1 : B<string>;
	let b2 : B<number>;
	console.log(b1.data);
	//b1 = b2;
}
