/// <reference path="../../js/com.facebook.immutable/2.0.3/immutable.d.ts" />


declare module Rdfstore {

    export interface RDFEnvironment {
        resolve(url: string): string;
        filters: any;
    }

    export interface RDFNode {
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



    export interface Base {
        create(callback: (store: Store) => void): void;
    }
    /* todo review, it might work now
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

module stolang {
    import Im = Immutable;
    export var STOCAS_PREFIX = "stocas";
    export var STOCAS_IRI = "https://github.com/davidleoni/stocas/";

    export class StoError implements Error {
        name: string;
        message: string;
        stack: any;
        params: any[];

        protoype: TypeError;
        constructor(...params) {

            console.error.apply(null, params)

        this.name = "StoError";
            this.message = params[0];
            this.stack = (<any>new Error()).stack;
            this.params = params;
        }
        toString() {
            return this.params.join();
        }
    }

    /**
     * Visits nodes of type N and outputs type M
     */
    export interface TreeVisitor<N, M> {
        isLeaf(t: N): boolean;
        getChildren(t: N): Im.Sequence<N, number>;
    }

    export class Trees {
        /**
         * @param getChildren if null node is a leaf
         */
        static fold<N, M>(rootNode: N,
            /** if null node is considered a leaf */
            getChildren: (t: N) => N[],
            makeM: (t: N, children: M[]) => M): M {


            var stack1 = [rootNode];
            var stack2: {
                node: N;
                neededChildren: number;
                children: M[]
            }[] = [];


            /**
                inserts node to existing children. If children list is full,
                resolves expressions popping nodes in stack2 until meets a list with not enough children  
            */
            var nodeToStack2 = (node: N): M => {
                var toInsert = makeM(node, []);

                while (stack2.length > 0) {

                    var top2 = stack2[0];
                    top2.children.unshift(toInsert);

                    if (top2.neededChildren == stack2[0].children.length) {
                        var poppedTop2 = stack2.pop();
                        toInsert = makeM(poppedTop2.node, poppedTop2.children);
                    } else {
                        return toInsert;
                    }
                }

                return toInsert;

            }

            var ret: M;

            while (stack1.length > 0) {
                var el = stack1.pop();
                var children = getChildren(el);

                // non-leaf node                                                
                if (children == null || children.length == 0) {
                    ret = nodeToStack2(el);
                    if (stack2.length == 0) {
                        return ret;
                    }
                } else {
                    $.each(children, (i, c) => {
                        stack1.unshift(c);
                    });
                    stack2.unshift({
                        node: el,
                        neededChildren: children.length,
                        children: []
                    });
                }

            }

            throw new Error("Shouldn't arrive till here...");
            return makeM(null, []);
        }

    }

}

