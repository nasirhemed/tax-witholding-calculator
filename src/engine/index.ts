export * from './types';
export { bracketTax, marginalRate } from './brackets';
export { federalIncomeTax, niit, additionalMedicareTax } from './federal';
export { californiaIncomeTax, californiaExemptionCredit } from './california';
export {
  federalRegularWithholding,
  californiaRegularWithholdingEstimate,
  federalSupplementalWithholding,
  type W4,
} from './withholding';
export { federalSafeHarbor, californiaSafeHarbor, type SafeHarborResult } from './safeHarbor';
export { projectYear, type Projection, type WithheldBySource } from './project';
export { TAX_YEAR_2026 } from './years/2026';
export { recommend, type Recommendations, type FederalRecommendation, type Recommendation, type Target } from './recommend';
