# contact-data-dispatcher-service

Microservice that listens to the delta notifier and dispatches consumed data to the correct public or organization graphs.
In this case, we dispatch organizations in the public graph and contact data in the graph of their organization. See `dispatch-config.js` for more details on the exact dispatching rules.

Highly inspired by the `worship-positions-graph-dispatcher-service`, adapted to this use case.

:warning: For now, this service works under the assumption that the application using it is a read-only application. When app-contactgegevens-loket will be reworked to be read-and-write, the service will have to be rethinked to avoid deleting too much data :warning:

## Installation
Add the following snippet to your `docker-compose.yml`:

```yml
contact-data-dispatcher:
  image: lblod/contact-data-dispatcher-service
  environment:
    DIRECT_DATABASE_ENDPOINT: "http://virtuoso:8890/sparql"
    SUDO_QUERY_RETRY: "true"
    SUDO_QUERY_RETRY_FOR_HTTP_STATUS_CODES: "404,500,503"
```

Configure the delta-notification service to send notifications on the `/delta` endpoint by adding the following rules in `./delta/rules.js`:

```javascript
export default [
  {
    match: {
      predicate: {
        type: 'uri',
        value: 'http://www.w3.org/ns/adms#status',
      },
      object: {
        type: 'uri',
        value: 'http://redpencil.data.gift/id/concept/JobStatus/success',
      },
    },
    callback: {
      url: 'http://contact-data-dispatcher/initial-dispatch',
      method: 'POST'
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 10000,
      ignoreFromSelf: true
    }
  },
  {
    match: {
      graph: {
        type: 'uri',
        value: 'http://mu.semte.ch/graphs/ingest'
      }
    },
    callback: {
      url: 'http://contact-data-dispatcher/delta',
      method: 'POST'
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 10000,
      ignoreFromSelf: true
    }
  }
]
```

## Environment variables

The following environment variables can be configured:

- `LANDING_ZONE_GRAPHS`: The graphs where the consumers first put the consumed data, separated by a ",". Defaults to `http://mu.semte.ch/graphs/landing-zone/op-consumer`
- `DISPATCH_SOURCE_GRAPH`: The graphs from which we want to dispatch the triples. Defaults to `http://mu.semte.ch/graphs/ingest`
- `DIRECT_DATABASE_ENDPOINT`: A direct database endpoint can be defined to speed up initial sync. Defaults to `http://database:8890/sparql`

## Initial dispatch

When starting the service, before dispatching the incoming deltas to the proper graphs, the service will check if an initial dispatching needs to happen. For this, it will check if the related consumer (`op-consumer`) of the application [app-contactgegevens-loket](https://github.com/lblod/app-contactgegevens-loket) has finished putting all ingested data into the ingest graph.

The service then proceeds to doing an initial dispatching. The goal is to reduce the time needed for the initial sync : bypassing mu-auth for this step makes the initial sync substantially faster.

## API

### POST /delta

Triggers the processing and dispatching of data following configuration in `dispatch-config.js`

## Configuration

The dispatching can be customized in the `dispatch-config.js` file. Below you can find a commented exemple of how the configuration works.

```
// Objects to dispatch to the organization graphs
export const dispatchToOrgGraphsConfig = [
  // An object per requirement
  {
    // The type to dispatch
    type: `http://data.lblod.info/vocabularies/erediensten/CentraalBestuurVanDeEredienst`,
    // In the case of org dispatching, we need the path from the current resource to the associted organization
    pathToOrg: `?organization a <http://data.lblod.info/vocabularies/erediensten/CentraalBestuurVanDeEredienst> .\n FILTER(?organization = ?subject)`
  }
];

// Objects to dispatch to the public graph
export const dispatchToPublicGraphConfig = [
  // An object per requirement
  {
    // The type to dispatch
    type: `http://data.vlaanderen.be/ns/besluit#Bestuurseenheid`,
    // Optional filter that can be applied
    additionalFilter: `
      ?subject <http://www.w3.org/ns/org#classification> ?bestuurClassification .
      FILTER (?bestuurClassification IN (
          <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000001>,
          <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000000>
        )
      )
    `,
    // Subjects for which we should trigger organization dispatching after ingested this subject
    // For example, municipalities are required to be able to dispatch sites. So when a
    // municipality gets ingested, we need to trigger a dispatching for the sites related to it
    triggersRedispatchFor: [
      `?ingestedSubject <http://www.w3.org/ns/org#hasSite> ?subject`
    ]
  }
];
```
