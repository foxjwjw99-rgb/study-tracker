## [ERR-20260322-001] second-brain npm/tailwind setup

**Logged**: 2026-03-22T12:06:30Z
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
Next.js app initially failed to install and build due to npm registry connectivity issues and Tailwind v4 PostCSS configuration mismatch.

### Error
```text
npm http fetch GET https://registry.npmjs.org/react attempt 1 failed with ECONNREFUSED
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin.
```

### Context
- Command attempted: `npm install`, `npm run dev`
- Environment could not reach `registry.npmjs.org`
- Installed latest Tailwind, but project used older PostCSS config style

### Suggested Fix
- Use `--registry=https://registry.npmmirror.com` when npmjs is unreachable
- Install `@tailwindcss/postcss`
- Update `postcss.config.js` to use `@tailwindcss/postcss`
- Add tsconfig path alias for `@/*`

### Metadata
- Reproducible: yes
- Related Files: second-brain/postcss.config.js, second-brain/tsconfig.json, second-brain/package.json

### Resolution
- **Resolved**: 2026-03-22T12:06:30Z
- **Notes**: Switched npm registry to npmmirror, installed `@tailwindcss/postcss`, updated PostCSS config, added tsconfig alias, restarted Next dev server.

---
