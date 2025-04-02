export const dispatchToOrgGraphsConfig = [
  {
    type: `http://www.w3.org/ns/adms#Identifier`, // Identifier of an organization
    pathToOrganization: `
      ?organization a <http://data.vlaanderen.be/ns/besluit#Bestuurseenheid> ;
        <http://www.w3.org/ns/adms#identifier> ?subject .
    `,
    triggersRedispatchToOrgGraph: [ // Structured identifier
      `?ingestedSubject <https://data.vlaanderen.be/ns/generiek#gestructureerdeIdentificator> ?subject`
    ]
  },
  {
    type: `https://data.vlaanderen.be/ns/generiek#GestructureerdeIdentificator`, // Structured id of an organization
    pathToOrganization: `
      ?organization a <http://data.vlaanderen.be/ns/besluit#Bestuurseenheid> ;
        <http://www.w3.org/ns/adms#identifier> ?id .
      ?id <https://data.vlaanderen.be/ns/generiek#gestructureerdeIdentificator> ?subject .
    `
  },
  {
    type: `http://www.w3.org/ns/org#Site`, // Site of an organization
    pathToOrganization: `
      ?organization a <http://data.vlaanderen.be/ns/besluit#Bestuurseenheid> ;
        <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?subject .
    `,
    triggersRedispatchToOrgGraph: [ // Address and contact point
      `?ingestedSubject <https://data.vlaanderen.be/ns/organisatie#bestaatUit> ?subject`,
      `?ingestedSubject <http://www.w3.org/ns/org#siteAddress> ?subject`
    ]
  },
  {
    type: `http://www.w3.org/ns/locn#Address`, // Address of an organization
    pathToOrganization: `
      ?organization a <http://data.vlaanderen.be/ns/besluit#Bestuurseenheid> ;
        <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?site .
      ?site <https://data.vlaanderen.be/ns/organisatie#bestaatUit> ?subject .
    `
  },
  {
    type: `http://schema.org/ContactPoint`, // Contact point linked to an organization
    pathToOrganization: `
      ?organization a <http://data.vlaanderen.be/ns/besluit#Bestuurseenheid> ;
        <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?site .
      ?site <http://www.w3.org/ns/org#siteAddress> ?subject .
    `
  }
];

export const dispatchToPublicGraphConfig = [
  {
    type: `http://data.lblod.info/vocabularies/erediensten/CentraalBestuurVanDeEredienst`,
    triggersRedispatchToOrgGraph: [ // Site and identifier
      `?ingestedSubject <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?subject`,
      `?ingestedSubject <http://www.w3.org/ns/adms#identifier> ?subject`
    ]
  },
  {
    type: `http://data.lblod.info/vocabularies/erediensten/BestuurVanDeEredienst`,
    triggersRedispatchToOrgGraph: [ // Site and identifier
      `?ingestedSubject <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?subject`,
      `?ingestedSubject <http://www.w3.org/ns/adms#identifier> ?subject`
    ]
  },
  {
    type: `http://data.lblod.info/vocabularies/erediensten/RepresentatiefOrgaan`,
    triggersRedispatchToOrgGraph: [ // Site and identifier
      `?ingestedSubject <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?subject`,
      `?ingestedSubject <http://www.w3.org/ns/adms#identifier> ?subject`
    ]
  },
  {
    type: `http://data.vlaanderen.be/ns/besluit#Bestuurseenheid`,
    triggersRedispatchToOrgGraph: [ // Site and identifier
      `?ingestedSubject <http://www.w3.org/ns/org#hasPrimarySite>|<http://www.w3.org/ns/org#hasSite> ?subject`,
      `?ingestedSubject <http://www.w3.org/ns/adms#identifier> ?subject`
    ]
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/BestuurseenheidClassificatieCode`,
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/TypeVestiging`
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/OrganisatieStatusCode`
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/TypeEredienst`
  },
  {
    type: `http://publications.europa.eu/ontology/euvoc#Country`
  },
  {
    type: `http://www.w3.org/2004/02/skos/core#Concept`
  },
  {
    type: `http://www.w3.org/2004/02/skos/core#ConceptScheme`
  },
  {
    type: `http://www.w3.org/ns/prov#Location`
  },
  {
    type: `http://www.w3.org/ns/org#ChangeEvent`
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/VeranderingsgebeurtenisResultaat`
  },
  {
    type: `http://lblod.data.gift/vocabularies/organisatie/Veranderingsgebeurtenis`
  }
];
