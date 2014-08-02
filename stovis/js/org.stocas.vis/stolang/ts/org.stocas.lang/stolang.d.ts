declare module Rdfstore {
    interface RDFEnvironment {
        resolve(url: string): string;
        filters: any;
    }
    interface RDFNode {
        nominalValue: string;
        interfaceName: string;
        /**
        Returns the N-Triples representation of the RDFNode.
        */ 
        toNT(): string;
        equals(obj: any): boolean;
    }
    /**
    A node identified by an International Resource Identifier (IRI)
    */
    interface NamedNode extends RDFNode {
    }
    /**
    A BlankNode is a reference to an unnamed resource (one for which an IRI is not known), and may be used in a Triple as a unique reference to that unnamed resource.
    
    BlankNodes are stringified by prepending "_:" to a unique value, for instance _:b142 or _:me, this stringified form is referred to as a "blank node identifier".
    */
    interface BlankNode extends RDFNode {
        language?: string;
        datatype?: NamedNode;
    }
    interface Base {
        create(callback: (store: Store) => void): void;
    }
    interface Store {
        rdf: any;
        execute: any;
        setPrefix: any;
        node: any;
    }
}
declare var rdfstore: Rdfstore.Base;
declare module stolang {
    var STOCAS_PREFIX: string;
    var STOCAS_IRI: string;
}
