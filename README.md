# Tax withholding calculator

A private withholding projector for a single California filer paid in base salary, RSUs and bonus.
Paste in your latest pay stub, add what's still coming, and see what you'll owe or get back in April,
plus how to adjust your W-4, DE 4 or RSU withholding election.

**Privacy:** everything runs in your browser. Nothing is uploaded, nothing goes into browser storage,
and pay stubs never get committed here.

This is an estimator, not tax advice.

## Development

```sh
npm install
npm test
```

The tax rules live in `src/engine`, and each tax year's figures live in `src/engine/years/<year>.ts`,
with their sources listed.
