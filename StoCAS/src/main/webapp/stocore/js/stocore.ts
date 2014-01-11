

declare module Rdfstore {

    export interface RDFEnvironment {
        resolve(url:string):string;
        filters: any;
    }

    export interface Base {
        create(callback : (store : Store)=>void):void ;
    }
    /* Got tired of bugged compiler
    export interface Store {
        rdf: RDFEnvironment;        
        execute(query: string, callback: (success?, results?) => void);
        setPrefix(prefix: string, URIFragment: string);
        node(nodeURI: string, callback: (success, graph) => void);
        node(nodeURI : string, graphUri:string, callback: (success, graph)=>void);

    } */
    export interface Store {
        rdf: any;
        execute: any;
        setPrefix: any;
        node: any;
        

    }

    //function create : 
}

declare var rdfstore: Rdfstore.Base;

