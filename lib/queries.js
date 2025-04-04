import { sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, uuid } from "mu";
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
import { parseResult } from './utils';
import {
  LANDING_ZONE_GRAPHS,
  DISPATCH_SOURCE_GRAPH,
  CREATOR,
  PUBLIC_GRAPH,
  INITIAL_DISPATCH_ENDPOINT
} from '../config';
import {
  PREFIXES,
  STATUS_SUCCESS
} from '../constants';

export async function updateStatus(subject, status) {
  const modified = new Date();
  const q = `
    ${PREFIXES}
    DELETE {
      GRAPH ?g {
        ?subject adms:status ?status;
          dct:modified ?modified .
      }
    }
    INSERT {
      GRAPH ?g {
        ?subject adms:status ${sparqlEscapeUri(status)};
          dct:modified ${sparqlEscapeDateTime(modified)}.
      }
    }
    WHERE {
      BIND(${sparqlEscapeUri(subject)} as ?subject)
      GRAPH ?g {
        ?subject adms:status ?status .
        OPTIONAL { ?subject dct:modified ?modified . }
      }
    }
  `;
  await update(q);
}

export async function isSubjectPublicAfterAdditionalFilters(subject, publicDispatchConfig) {
  if (!publicDispatchConfig.additionalFilter) {
    return true;
  }

  const existsQuery = `
    ASK {
      BIND(${sparqlEscapeUri(subject)} as ?subject)

      ?subject a ${sparqlEscapeUri(publicDispatchConfig.type)}.
      ${publicDispatchConfig.additionalFilter}
    }
  `;

  return (await query(existsQuery, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT })).boolean;
}

export async function getTypesForSubject(subject) {
  const queryStr = `
    SELECT DISTINCT ?type {
      ${sparqlEscapeUri(subject)} a ?type.
    }
  `;

  return (await query(queryStr, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT })).results.bindings.map(r => r.type.value);
}

export async function getOrganizationForSubject(subject, config) {
  const queryStr = `
    SELECT DISTINCT ?organization WHERE {
      BIND(${sparqlEscapeUri(subject)} as ?subject)

      ?subject a ${sparqlEscapeUri(config.type)}.
      ${config.pathToOrganization}
    }
  `;

  const bindings = (await query(queryStr, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT })).results.bindings;

  if (bindings.length) {
    return bindings[0].organization.value;
  }

  return null;
}

/**
 * We follow a simple rule: data related to an organization should only be dispatched
 * in the graph of that organization.
 */
export async function getDestinationGraphs(organization) {
  const queryStr = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX org: <http://www.w3.org/ns/org#>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX ere: <http://data.lblod.info/vocabularies/erediensten/>

    SELECT DISTINCT ?graph WHERE {
      {
        ${sparqlEscapeUri(organization)} a org:Organization ;
          mu:uuid ?uuid .
      }
      BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?uuid)) AS ?graph)
    }
  `;

  const result = await query(queryStr, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT });
  return parseResult(result).map(res => res.graph);
}

/**
 * Get the subjects which have some triples to move in org graphs
 * For this, we take:
 * - all triples that are in a wrong graph (so that they get removed)
 * - all triples that are in the ingest graph but not yet in the destination graphs (insert case)
 * - all triples that are in an org graph but not anymore in the ingest graph (delete case)
 */
export async function getRelatedSubjectsForOrganization(
  organization,
  subjectType,
  pathToOrganization,
  destinationGraphs
) {
  const graphsToExclude = `<${[...destinationGraphs, DISPATCH_SOURCE_GRAPH, ...LANDING_ZONE_GRAPHS.split(',')].join('>, <')}>`;

  let destinationGraphBlocks = '';
  for (const destinationGraph of destinationGraphs) {
    destinationGraphBlocks += `
      GRAPH ${sparqlEscapeUri(destinationGraph)} {
        ?subject ?p ?o .
      }
    `;
  }

  const queryStr = `
    SELECT DISTINCT ?subject WHERE {
      BIND(${sparqlEscapeUri(organization)} as ?organization)
      ?subject a ${sparqlEscapeUri(subjectType)}.

      ${pathToOrganization}

      {
        GRAPH ?g {
          ?subject ?p ?o .
        }
        FILTER (?g NOT IN ( ${graphsToExclude} ))
      }
      UNION
      {
        GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
          ?subject ?p ?o .
        }
        MINUS
        {
          ${destinationGraphBlocks}
        }
      }
      UNION
      {
        {
          ${destinationGraphBlocks}
        }
        MINUS
        {
          GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
            ?subject ?p ?o .
          }
        }
      }
    }
  `;

  const result = await query(queryStr, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT });
  const subjects = result.results.bindings.map(r => r.subject.value);

  return [...new Set(subjects)];
}

export async function moveSubjectDataToDestinationGraphs(subject, destinationGraphs) {
  // Delete triples in all non-internal graphs (ingest graph and landing zones)
  const graphsToKeep = `<${[DISPATCH_SOURCE_GRAPH, ...LANDING_ZONE_GRAPHS.split(',')].join('>, <')}>`;

  const deleteQueryStr = `
    DELETE {
      GRAPH ?g {
        ?s ?p ?o .
      }
    }
    WHERE {
      GRAPH ?g {
        BIND(${sparqlEscapeUri(subject)} as ?s)
        ?s ?p ?o .
      }
      FILTER (?g NOT IN ( ${graphsToKeep} ))
    }
  `;
  await update(deleteQueryStr);

  // Insert in the destination graphs
  let insertInGraphs = '';
  for (const destinationGraph of destinationGraphs) {
    insertInGraphs += `
      GRAPH ${sparqlEscapeUri(destinationGraph)} {
        ?s ?p ?o .
      }
    `;
  }

  const insertQueryStr = `
    INSERT {
      ${insertInGraphs}
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
        BIND(${sparqlEscapeUri(subject)} as ?s)
        ?s ?p ?o .
      }
    }
  `;
  await update(insertQueryStr);
}

export async function allInitialSyncsDone() {
  try {
    for (const operation of [
      'http://redpencil.data.gift/id/jobs/concept/JobOperation/deltas/consumer/op'
    ]) {

      const operationStatusQuery = `
        ${PREFIXES}
        SELECT DISTINCT ?s ?created WHERE {
          VALUES ?operation { ${sparqlEscapeUri(operation)} }
          VALUES ?status { ${sparqlEscapeUri(STATUS_SUCCESS)} }

          ?s a <http://vocab.deri.ie/cogs#Job> ;
            task:operation ?operation ;
            adms:status ?status ;
            dct:created ?created.
        }
        ORDER BY DESC(?created)
        LIMIT 1
      `;

      const result = await query(operationStatusQuery, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT });

      console.log(`Result for ${operation}: ${JSON.stringify(result)} `);

      const initial_sync_done = !!(result && result.results.bindings.length);
      if (!initial_sync_done) {
        console.log(`Initial sync for ${operation} not done yet.`);
        return false;
      } else {
        console.log(`Initial sync for ${operation} done.`);
      }
    }
    return true;
  } catch (e) {
    const error_message = `Error while checking if initial syncs are done: ${e.message ? e.message : e} `;
    console.log(error_message);
    sendErrorAlert({
      message: error_message
    });
    return false;
  }
}

export async function sendErrorAlert({ message, detail, reference }) {
  if (!message)
    throw 'Error needs a message describing what went wrong.';
  const id = uuid();
  const uri = `http://data.lblod.info/errors/${id}`;
  const q = `
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX oslc: <http://open-services.net/ns/core#>
      PREFIX dct: <http://purl.org/dc/terms/>

      INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/error> {
            ${sparqlEscapeUri(uri)} a oslc:Error ;
                    mu:uuid ${sparqlEscapeString(id)} ;
                    dct:subject ${sparqlEscapeString('Dispatch contact data')} ;
                    oslc:message ${sparqlEscapeString(message)} ;
                    dct:created ${sparqlEscapeDateTime(new Date().toISOString())} ;
                    dct:creator ${sparqlEscapeUri(CREATOR)} .
            ${reference ? `${sparqlEscapeUri(uri)} dct:references ${sparqlEscapeUri(reference)} .` : ''}
            ${detail ? `${sparqlEscapeUri(uri)} oslc:largePreview ${sparqlEscapeString(detail)} .` : ''}
        }
      }
  `;
  try {
    await update(q);
  } catch (e) {
    console.error(`[WARN] Something went wrong while trying to store an error.\nMessage: ${e}\nQuery: ${q}`);
  }
}

// Redispatch all subjects that are linked to an ingested subject and that are not in its org graph yet
export async function getSubjectsToRedispatchToOrgGraph(ingestedSubject, path) {
  const queryStr = `
    PREFIX org: <http://www.w3.org/ns/org#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT DISTINCT ?subject WHERE {
      BIND(${sparqlEscapeUri(ingestedSubject)} as ?ingestedSubject)

      ${path}

      GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
        ?subject ?p ?o .
      }
    }
  `;

  const result = await query(queryStr, {},{ sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT });
  const subjects = result.results.bindings.map(r => r.subject.value);

  return [...new Set(subjects)];
}

// Directly execute the query (bypassing mu-auth) when DIRECT_DATABASE_ENDPOINT is set
export async function moveSubjectsToPublicGraph(config) {
  const queryStr = `
    INSERT {
      GRAPH ${sparqlEscapeUri(PUBLIC_GRAPH)} {
        ?subject ?p ?o .
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
        ?subject a ${sparqlEscapeUri(config.type)} ;
          ?p ?o .

        ${config.additionalFilter ? config.additionalFilter : ''}
      }
    }
  `;
  await update(
    queryStr,
    {
      // no extraheaders
    },
    {
      sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT
    }
  );
}

// Directly execute the query (bypassing mu-auth) when DIRECT_DATABASE_ENDPOINT is set
export async function moveSubjectsToOrgGraphs(config) {
  const queryStr = `
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX org: <http://www.w3.org/ns/org#>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX ere: <http://data.lblod.info/vocabularies/erediensten/>

    INSERT {
      GRAPH ?graph {
        ?subject ?p ?o .
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(DISPATCH_SOURCE_GRAPH)} {
        ?subject a ${sparqlEscapeUri(config.type)} ;
          ?p ?o .

        ${config.pathToOrganization}

        ?organization mu:uuid ?uuid .
      }

      BIND(IRI(CONCAT("http://mu.semte.ch/graphs/organizations/", ?uuid)) AS ?graph)    
    }
  `;
  await update(
    queryStr,
    {
      // no extraheaders
    },
    {
      sparqlEndpoint: INITIAL_DISPATCH_ENDPOINT
    }
  );
}
