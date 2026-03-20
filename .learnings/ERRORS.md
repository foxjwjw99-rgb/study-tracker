## [ERR-20260320-001] openclaw config unset nvidia models

**Logged**: 2026-03-20T18:46:05.474102+00:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Unsetting `models.providers.nvidia.models` failed because the OpenClaw config schema requires that field to remain an array.

### Error
```
Error: Config validation failed: models.providers.nvidia.models: Invalid input: expected array, received undefined
```

### Context
- Command attempted: `openclaw config unset models.providers.nvidia.models`
- Goal: remove duplicate NVIDIA model entry shown once as raw provider id and once as configured custom provider id
- Environment: OpenClaw 2026.3.13 local config at `/Users/huli/.openclaw/openclaw.json`

### Suggested Fix
Instead of unsetting the field, set it to an empty array (`[]`) or replace the array contents with the desired non-duplicate entries.

### Metadata
- Reproducible: yes
- Related Files: /Users/huli/.openclaw/openclaw.json

---
