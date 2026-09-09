# MSProjects

Personlig portefølje-manager. Se [MASTER.md](MASTER.md) for design og datamodel.

## Kom i gang

```bash
npm install
npm run dev
```

`.env.local` skal indeholde:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database

Skemaet ligger i `supabase/migrations/`, testdata i `supabase/seed.sql`.

**Nemmest:** åbn SQL Editor i Supabase-dashboardet, indsæt først
`supabase/migrations/20260901000001_init.sql`, kør, indsæt derefter
`supabase/seed.sql`, kør.

**Med CLI** (kræver personal access token og databaseadgangskode):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase link --project-ref hinilzjtqxhjxxokorpq
npx supabase db push
```

`seed.sql` kan køres igen når som helst — den rydder `node` først, og resten
følger med via cascade.

## Bruger

Appen er enkeltbruger. Opret kontoen under Authentication → Users i Supabase,
med e-mail og adgangskode. Alt indhold ligger bag `/login`, og RLS kræver en
gyldig session.
