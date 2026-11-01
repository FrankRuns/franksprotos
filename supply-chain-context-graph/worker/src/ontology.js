// Versioned domain priors. These guide searches, never establish company facts.
export const ontologyVersion="1.0.0";
export const facilityRoles={
 manufacturing:"Transforms inputs into products",import_warehouse:"Receives and stages imported goods",
 upstream_distribution_center:"Holds and allocates inventory upstream of regional nodes",
 regional_distribution_center:"Replenishes stores or downstream facilities",
 food_distribution_center:"Handles grocery/temperature-sensitive inventory",
 cross_dock:"Transfers freight with little or no storage",
 fulfillment_center:"Picks and packs customer orders",flow_center:"Supports omnichannel inventory and fulfillment",
 sortation_center:"Sorts outbound parcels",delivery_station:"Stages final-mile delivery",
 distribution_center:"Distribution function not further specified",warehouse:"Storage function not further specified"
};
export const businessModels={
 omnichannel_retail:{description:"Stores, replenishment and digital fulfillment coexist",roles:["regional_distribution_center","import_warehouse","fulfillment_center","sortation_center"],search:["regional distribution center locations city state","import warehouse upstream receive center locations","store fulfillment sortation center locations"]},
 grocery_retail:{description:"Perishable and ambient replenishment require specialized handling",roles:["food_distribution_center","cross_dock"],search:["food distribution center cold chain locations city state"]},
 manufacturer:{description:"Production plants with raw-material and finished-goods logistics",roles:["manufacturing","warehouse","distribution_center"],search:["manufacturing plants factory sites city state","finished goods distribution centers locations"]},
 marketplace:{description:"Third-party sellers, fulfillment services and parcel networks may differ",roles:["fulfillment_center","sortation_center","delivery_station"],search:["fulfillment center sortation delivery station locations"]},
 wholesale_distributor:{description:"Supplier consolidation and distribution to business customers",roles:["distribution_center","cross_dock","warehouse"],search:["distribution centers cross docks warehouse locations"]},
 consumer_brand:{description:"May use contract manufacturing and both wholesale and direct-to-consumer channels",roles:["manufacturing","import_warehouse","distribution_center","fulfillment_center"],search:["contract manufacturing suppliers production sites","import distribution center direct to consumer fulfillment locations"]}
};
export function chooseModels(host){
 if(host==="target.com")return ["omnichannel_retail","grocery_retail"];
 if(host==="3m.com")return ["manufacturer"];
 if(host==="amazon.com")return ["marketplace"];
 if(host==="nike.com")return ["consumer_brand"];
 return ["manufacturer","wholesale_distributor"]; // provisional; never asserted as company fact
}
export function researchPlan(host){
 const models=chooseModels(host),terms=[...new Set(models.flatMap(m=>businessModels[m].search))];
 const name=host.split(".")[0];
 const queries=terms.slice(0,4).map(term=>name+" "+term);
 return {ontology_version:ontologyVersion,business_models_hypothesized:models,queries,role_candidates:[...new Set(models.flatMap(m=>businessModels[m].roles))],caveat:"These are search hypotheses, not evidence about the company."};
}
