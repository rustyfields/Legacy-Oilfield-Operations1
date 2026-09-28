# Cloudflare Pages parallel deployment

This branch prepares CrudeForce for a parallel Cloudflare Pages test deployment. It does not replace or modify Vercel production.

Cloudflare Pages setup:
- Repository: rustyfields/Legacy-Oilfield-Operations1
- Framework preset: None
- Build command: exit 0
- Build output directory: .
- Root directory: repository root
- Use preview/parallel deployment only until approved.

Compatibility:
- _headers mirrors the two response headers currently defined in vercel.json.
- Supabase configuration remains unchanged in the existing client application.
- sw.js uses same-origin relative asset paths and requires no host-specific changes.

Cutover rule:
Do not change DNS, Supabase auth settings, Vercel production, or the permanent CrudeForce URL until the Cloudflare deployment has passed login and module regression testing.
