# maple-dashboard

Two Next.js dashboards reading the Postgres tables built by [maple-pipeline](https://github.com/paultimfv/maple-pipeline).

| App | Live | Pages |
|---|---|---|
| `web/` | https://maple-robinhood.vercel.app | Maple business (revenue, AUM, lenders, borrowers, syrupUSDG), macro, SYRUP model |
| `robinhood/` | https://robinhood-earn.vercel.app | Robinhood Chain (stablecoins, activity, fees, capital), Robinhood Earn, who gets paid |

Queries: `src/lib/queries.ts` in each app. Pages render on request.

Standalone model: [maple-model](https://github.com/paultimfv/maple-model).

## Run

```
cd web          # or robinhood
npm install
echo "DATABASE_URL=..." > .env.local
npm run dev
```
