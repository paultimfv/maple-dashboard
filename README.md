# maple-dashboard

Maple Finance dashboard reading the Postgres tables built by [maple-pipeline](https://github.com/paultimfv/maple-pipeline).

Live: https://maple-robinhood.vercel.app

## Pages

| Page | Covers |
|---|---|
| Business (`/`) | Revenue by source, AUM, revenue yield, P/S, pools, lenders, borrowers, syrupUSDG on Robinhood Chain |
| Macro (`/macro`) | Global stablecoin supply, Robinhood Earn TVL and syrupUSDG share |
| Model (`/model`) | SYRUP valuation model, also standalone: [maple-model](https://github.com/paultimfv/maple-model) |

Queries: `web/src/lib/queries.ts`. Pages render on request.

Robinhood Earn and Robinhood Chain: [robinhood-earn](https://github.com/paultimfv/robinhood-earn).

## Run

```
cd web
npm install
echo "DATABASE_URL=..." > .env.local
npm run dev
```
