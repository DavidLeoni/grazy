import * as interfaces from "./test-modules-3";
import * as impl from "./test-modules-3-impl";


let c = interfaces;
c = impl;

// export default c; this still confuses poor typescript 1.5.3 
export default c;
