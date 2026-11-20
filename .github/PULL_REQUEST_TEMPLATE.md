## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## How it was checked

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Looked at the change at 1440 px and 390 px (no horizontal scroll, no visible scrollbars)

## Clinical change checklist

Complete if this touches agents, the knowledge pack, interaction rules, dose or RECIST code, the safety-critic or the synthesis prompt.

- [ ] Every new claim cites an evidence ID from the registry
- [ ] No dose, drug or trial ID can come from the model
- [ ] New dose logic has a unit test with a hand calculation
- [ ] `npm run eval` still passes (gold cases and 6/6 adversarial drafts)
- [ ] Reviewed by a clinician: <!-- name and role -->

## Data

- [ ] No real patient data, secrets or tokens in the diff
