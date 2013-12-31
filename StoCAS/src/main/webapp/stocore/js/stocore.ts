

declare module Rdfstore {
    export interface Base {
        create: any;
    }
    export interface Store {
        execute: any;
        setPrefix: any;
        node: any;

    } 
    //function create : 
}

declare var rdfstore: Rdfstore.Base;


rdfstore.create(function (store) {
    // don't know, get "303 See other" error but link is valid..
   // store.execute('LOAD <http://dbpedia.org/resource/Tim_Berners-Lee> INTO GRAPH <http://example.org/people>', function () {  
    store.execute('LOAD <../stocore/test/Tim_Berners-Lee.n3> INTO GRAPH <http://example.org/people>', function () { 

        store.setPrefix('dbp', 'http://dbpedia.org/resource/');

        store.node(store.rdf.resolve('dbp:Tim_Berners-Lee'), "http://example.org/people", function (success, graph) {

            console.log('Graph is ', graph);

            var peopleGraph = graph.filter(store.rdf.filters.type(store.rdf.resolve("foaf:Person")));

            store.execute('PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\
                     PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
                     PREFIX : <http://example.org/>\
                     SELECT ?s FROM NAMED :people { GRAPH ?g { ?s rdf:type foaf:Person } }',
                function (success, results) {

                    console.log(peopleGraph.toArray()[0].subject.valueOf() === results[0].s.value);

                });

        });

    });
})