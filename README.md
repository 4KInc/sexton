# sexton
A public register of retired geostationary satellites: buried in the graveyard orbit, or still drifting in the GEO protected zone. Kiroween 2026.

## Census
<!-- census:start -->
Counts from the snapshot of 2026-11-22. Run `npm run census` to refresh them.

- Objects near GEO in the register: 1764
- Retired payloads with a verdict: 696
  - fallen: 3
  - unquiet: 312
  - shallow grave: 30
  - restless: 21
  - uncertain: 50
  - buried: 280
- Retired payloads close to a threshold (borderline): 141
- Objects where SATCAT and the GPZ table disagree on status: 48
  - of these, SATCAT lists a payload but gives no status, so the GPZ table's status is used: 48

Verdicts assume a C_R·A/m range of 0.012 to 0.045 m²/kg and a ±25 km uncertainty in mean elements. The IADC guidelines are voluntary. The register only sees objects still near GEO. Satellites sent much higher, or that left GEO, may be missing.
<!-- census:end -->

## Use it from an AI assistant

`scripts/mcp/server.ts` is a small [MCP](https://modelcontextprotocol.io) server. It talks over stdio, reads `data/register.json` and `data/cases/` only, and makes no network calls and no writes. It needs Node 24 and `npm install`.

It has four read-only tools:

- `is_buried(norad)`: the verdict word, the borderline flag, p and q, the margins and the data age. "Buried" is one of six verdicts, so the answer is never a bare yes or no.
- `census()`: verdict counts as "n of N", the borderline count, and where orbits and statuses come from.
- `explain(norad)`: the ledger text, with assumptions and data age, and the case file if there is one.
- `list(verdict, limit?)`: objects with one verdict, sorted by NORAD id, with the total.

In Kiro, put this in `.kiro/settings/mcp.json`. Other MCP clients use the same `command` and `args`. `autoApprove` lists tool names, and these four only read.

```json
{
  "mcpServers": {
    "sexton": {
      "command": "node",
      "args": ["scripts/mcp/server.ts"],
      "disabled": false,
      "autoApprove": ["is_buried", "census", "explain", "list"]
    }
  }
}
```

The replies carry the same assumptions as the site: a C_R·A/m range and a ±25 km mean-element uncertainty. The IADC guidelines are voluntary. The register only sees objects still near GEO.
