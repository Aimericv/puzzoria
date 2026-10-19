import {
  validateSocialCatalog,
  rankingDatasets,
  dilemmas,
  rankingPools,
} from "../src/lib/social-data";
validateSocialCatalog();
console.log(
  `Validated ${rankingDatasets.length} legacy ranking datasets, ${rankingPools.length} expanded pools (${rankingPools.reduce((n, p) => n + p.items.length, 0)} items) and ${dilemmas.length} dilemmas in four languages.`,
);
