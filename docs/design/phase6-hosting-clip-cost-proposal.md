# Phase 6 hosting and clip cost proposal

**Preparation only — no implementation, account, resource, payment or deployment.** Consulted 2026-09-07; prices in USD before tax unless stated. Read against main 0513b8c [PLAN.md](../../PLAN.md), [RUNBOOK.md](../../RUNBOOK.md), the [production qualification protocol](phase6-production-load-protocol.md) and [local recorder design](phase3-local-recorder.md). This proposal changes no guard or gameplay setting. All new limits below are illustrative approval inputs, not executable defaults; approved values must later live in root tuning.ts.

**Recommendation:** evaluate a fixed-size US VPS fleet for Colyseus and **Option B, private R2 behind Workers Free plus one SQLite Durable Object**, for hosted clips. It avoids metered game egress and separates clip storage from a game host. Option A keeps clip requests and transfers within a fixed VPS invoice but has weaker storage recovery and more operations work. Neither option qualifies 300 rooms. Hosted uploads stay disabled until cost controls, media validation and all required phase/load gates pass.

## Workload before hardware sizing

Contract population: 300 rooms × six clients = 1,800 connections, 30 authoritative ticks/s and 60 input messages/s/client. One snapshot per tick implies 9,000 room ticks/s, 54,000 delivered snapshots/s and 108,000 incoming inputs/s. Each sustained hour contains 194.4 million snapshot deliveries and 388.8 million input messages. These are WebSocket messages, not automatically separately billed HTTP requests.

Snapshot sizes are **assumed complete encoded payloads per recipient**, not measured production sizes. The illustrative 1.20 wire factor covers a planning allowance for framing/TLS/packet overhead; it is not an upper bound on retransmission or reconnect traffic.

| Assumed snapshot | Fleet outbound rate | Outbound GiB/hour | Outbound TiB at 300 full rooms for 30 days |
|---|---:|---:|---:|
| 2 KiB | 1.062 Gbit/s | 444.95 | 312.85 |
| 8 KiB | 4.247 Gbit/s | 1,779.79 | 1,251.41 |
| 32 KiB | 16.987 Gbit/s | 7,119.14 | 5,005.65 |

Sensitivity anchor: the root's `reports/phase2-live-browser-baseline.json` records 2,924 actual snapshot deliveries and 24,775,733 estimated UTF-8 JSON bytes during a six-body capture: about **8.47 kB/delivery**, with **9.81 kB** in the last snapshot. This supports keeping the 8 KiB scenario in the sensitivity range. It excludes actual Colyseus encoding, framing and TLS and is **not measured wire egress**, a full-load distribution or a production guarantee. Its source revision, exact fields and file hash are preserved in the arithmetic artifact.

Formula: `egressBytes = 300 × 6 × snapshotHz × payloadBytes × wireFactor × fullEquivalentSeconds`. Multiply the 30-day column by average occupancy fraction and by actual snapshot frequency / 30. Do not lower either merely to make a quote fit. At assumed input **wire** sizes of 128/256/512 bytes, ingress is 110.59/221.18/442.37 Mbit/s; unlike the snapshot column, no extra wire factor is applied. Heartbeats, joins, HTTP assets, telemetry and cross-host coordination remain additional.

At 60 Hz, room ticks and per-tick snapshot egress double; input rate remains the configured 60 Hz. Internet latency, port throughput and CPU deadlines require measurement. A low storage bill says nothing about whether the game fleet can deliver these rates.

Colyseus assigns each room to one process and connects clients to that owning process. The proposed topology uses pinned Node/Colyseus/Rapier builds, several bounded processes per host, per-process routing/public addresses behind TLS, and shared RedisPresence/RedisDriver. A gateway and a separate Redis host are included in the cost model; their sizing is also unqualified. They are not a replicated high-availability control plane. Redis stores coordination, not a recoverable live physics world. [Colyseus 0.18 scalability](https://docs.colyseus.io/scalability) and [Presence](https://docs.colyseus.io/server/presence), consulted 2026-09-07.

Use encrypted private connectivity between services; do not expose Redis or route every snapshot through one small central gateway. No Kubernetes, managed load balancer or autoscaling service is required for this candidate. New dependency/topology integration is later implementation work.

## Two options, same priced game fleet

OVHcloud's US catalog 3701 lists VPS-3 2027 at **$14.50/month, default month-to-month, zero setup**, versus the website's $12.32 starting price linked to 12-month prepayment. VPS-1 is $5.35/month; an additional 50 GB disk is $2.60/month. Linux/local storage are $0; the standard backup add-on currently discounts to $0. Recheck the final all-in quote and promotion terms. Exact selected catalog rows are preserved in the [arithmetic artifact](phase6-hosting-clip-cost-model.json). [Public price catalog, retrieved 2026-09-07 23:17 UTC](https://api.us.ovhcloud.com/v1/order/catalog/public/vps?ovhSubsidiary=US).

VPS-3 advertises six shared vCores, 12 GB RAM, 100 GB NVMe and 2 Gbit/s public bandwidth. VPS-1 offers two vCores, 4 GB and 500 Mbit/s. US plans include traffic and IPv4; these are port specifications, not measured sustained throughput or dedicated CPU guarantees. Use Virginia or Oregon standard regions; do not substitute Asia-Pacific's traffic-quota terms or a Local Zone configuration. [OVHcloud US VPS specifications](https://us.ovhcloud.com/vps/), consulted 2026-09-07.

| | Option A: VPS clips | Option B: private R2 clips |
|---|---|---|
| Game authority | N × VPS-3; fixed process/room admission | Same |
| Shared services | Two VPS-1 hosts: gateway and Redis; $10.70/month | Same |
| Clip bytes / quota | Separate VPS-1 gateway, transactional SQLite ledger, extra 50 GB disk; application still caps clip bytes at 256 MiB | Private R2 Standard; one SQLite Durable Object owns the global ledger |
| Extra fixed clip cost | $5.35 + $2.60 = **$7.95/month** | **$0 Worker/DO subscription**, only while both remain Free |
| Upload/read requests | No per-operation provider fee; bounded CPU, I/O, descriptors and queues still required | R2 Class A/B charges; Worker/DO hard free quotas and precharged application permits |
| Ingress/egress | Included US VPS traffic; no metered CDN/proxy in this path | R2 internet egress $0; game traffic remains direct to VPS fleet |
| Recovery / tradeoff | One clip host/disk can lose availability or data; no automatic failover claimed | Persistent object storage survives replacement of a game host; global coordinator/free quotas can deliberately stop sharing |

For A, keep clip bytes on the additional disk, outside automatic system-disk backups, and verify that exclusion before enabling uploads. Extra disks are not included in the documented VPS system-disk backup. Otherwise old backups could retain expired clips or bypass the counted byte budget. A failed exclusion/retention check keeps uploads off. Ledger restores must reconcile actual disk objects before serving or accepting reservations. [OVHcloud backup description](https://us.ovhcloud.com/vps/), consulted 2026-09-07. A permanent slot has no scheduled seven-day expiry; the proposed single-disk option is not an archival durability guarantee.

For both, let `r` be **measured safe rooms per chosen host under the complete production protocol**, after process/shared overhead. `N = ceil(300/r)`; memory and network constraints can require more. Neither r nor attributed per-room memory is known. The following are invoice sensitivities, not capacity predictions:

| Game hosts | Required rooms/host, unproved | A/month | B/month with unused R2 free allowance | B/month with no R2 free allowance |
|---|---:|---:|---:|---:|
| 10 | 30 | $163.65 | $155.70 | ≤$160.58 |
| 20 | 15 | $308.65 | $300.70 | ≤$305.58 |
| 60 | 5 | $888.65 | $880.70 | ≤$885.58 |

Formulas: `A = 14.50N + 10.70 + 7.95`; `B = 14.50N + 10.70 + boundedR2`. The R2 bound is derived below. These exclude tax, domain, separately quoted Sites frontend hosting, extra regions, replication/failover and optional paid logging/monitoring. Do not call them the final all-in launch bill. Frontend deployment remains Phase 7.

Why use included traffic: DigitalOcean's current regular CPU-optimized 4-vCPU/8-GiB plan is $84/month with 5,000 GiB transfer, and inbound traffic is free. It is a reasonable dedicated-CPU comparison if shared-CPU qualification fails, but would need a new outbound-spend design and actual bandwidth price/allowance model; it is not silently interchangeable with this unmetered candidate. [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets), consulted 2026-09-07. A provider's compute marketing or a failed local profile supplies no safe room density.

## Clip demand, retention and bandwidth

Keep the exact contract: **15 seconds, complete file ≤2 MiB, seven-day normal retention, one permanent slot per browser identity, three uploads per identity per UTC day, 256 MiB globally including pending uploads and permanent files.** No hosted transcoding is proposed. Encoding/compression stays local; server validation of actual duration/container/bytes is still required before publication.

At maximum size, 256 MiB fits only **128 files**, before pending/replacement overlap. With no permanent files and seven-day retention, average sustained admission is at most 128/7 ≈ **18.29 full-size clips/day**. Only six identities could each sustain their full three-per-day allowance for seven days. If 1,800 distinct daily identities all requested three uploads, demand would be 5,400/day, 10.55 GiB/day ingress and 73.83 GiB retained after seven days. Most requests must therefore fall back to local downloads. “Three” and “one permanent” are per-identity maxima, not promised reserved global capacity.

At 128 full-size permanent slots, ordinary uploads have no remaining capacity. Do not evict permanent saves or shorten normal retention to hide this constraint. A slot replacement counts old and new bytes until the old copy is actually deleted. New anonymous identities can farm identity limits; global byte/request/cost controls remain necessary.

Storage and bandwidth are independent:
- One 2 MiB file downloaded 1,000 / 100,000 / 1,000,000 times transfers **1.95 / 195.31 / 1,953.13 GiB**.
- Replaying the entire 256 MiB library once transfers 0.25 GiB; no storage rule limits how often that happens.
- Range requests, HEADs, thumbnails, retries and cache misses can create more requests than completed video plays. A CDN cache hit can reduce origin reads without enforcing a total request bill or making an existing public URL revocable.

## Option B prices and a bounded request envelope

R2 Standard costs $0.015/GB-month, $4.50/million Class A operations and $0.36/million Class B operations; egress is free. Monthly included amounts are 10 GB-month, 1 million A and 10 million B. Usage rounds up to GB/million-operation units. PUT/LIST/COPY count as A; GET/HEAD as B; deletes are free. Use Standard, avoiding Infrequent Access's retrieval charges/minimum retention. [R2 pricing, updated 2026-08-07; consulted 2026-09-07](https://developers.cloudflare.com/r2/pricing/).

Illustrative approval envelope: at most **100,000 A attempts and 1,000,000 B attempts per provider billing period**, counting administration, validation, reconciliation and retries, with ≤256 MiB stored. Even if another project consumes all included R2 allowance:

```text
R2 upper cost = 0.015 × ceil(0.268435456 GB-month)
             + 4.50 × ceil(100000 / 1000000)
             + 0.36 × ceil(1000000 / 1000000)
             = $4.875 before tax
```

This is a proposed **$5 variable clip allowance**, not approval and not a provider-native R2 spend cap. With unused included allowance the modeled charge is $0. The proof depends on the sole-access, precharged-operation design below. Headroom must include tax if approving an all-in $5 limit.

Workers Free permits 100,000 inbound requests/day and 10 ms CPU/invocation. Exceeding requests returns error 1027; configure **fail closed**, so a route never bypasses the Worker to an unguarded origin. Paid Workers start at $5/month with metered requests/CPU; rejecting a request inside paid code does not undo its invocation cost. A per-invocation CPU limit is not a total request-spend cap. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [pricing](https://developers.cloudflare.com/workers/platform/pricing/), consulted 2026-09-07.

SQLite Durable Objects are available on Workers Free: 100,000 requests/day, 13,000 GB-s/day, five million row reads/day, 100,000 row writes/day and 5 GB stored. Exceeding a free limit fails operations; daily allowances reset at UTC midnight. Requests include RPC sessions and alarms. These are account-wide constraints, not a guarantee of availability to this app. Indexed ledger mutations and alarm/delete writes must be counted. [Durable Objects pricing, updated 2026-08-25; consulted 2026-09-07](https://developers.cloudflare.com/durable-objects/platform/pricing/).

For arithmetic illustration, 18 uploads/day over 30 days plus 100,000 media requests could use 540 PUTs, 540 validation GETs, 720 hourly LIST sweeps and 100,000 media GET/HEADs: **A=1,260; B=100,540**, before retries/administration. Coordinator demand might be 100,000 view permits + 1,080 reserve/finalize calls + 720 cleanup calls, rather than 100,000 “plays” alone. A malicious burst can exhaust daily free quotas and stop hosted sharing even while monthly R2 permits remain. This availability loss is preferable to automatic paid upgrade.

Do not decode/transcode media inside an assumed 10 ms Worker budget. Quarantine the bounded private upload, then use a bounded validator on the already-priced control infrastructure; its R2 read consumes a B permit. Only validated files become visible. Extra CPU/hardware required by validation must be qualified and repriced.

## What actually enforces download-only fallback

Both options need a **durable single writer for global admission**, not per-process counters, localStorage or eventually consistent cache. A uses a SQLite transaction at its sole clip gateway; B uses one global SQLite Durable Object. The latter's transaction API provides the required atomic storage primitive; application invariants still need tests. [Durable Object SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), consulted 2026-09-07.

1. In one transaction, check the server-established browser identity and UTC-day reserved/committed count, global occupied bytes, pending capacity, replacement overlap, operation allowances and enabled state. Reserve the full 2 MiB before accepting bytes, plus an upload slot. Use immutable object IDs, idempotency keys and a fenced ledger generation.
2. Enforce byte limits while streaming, not merely Content-Length. At 2 MiB, use one bounded PUT, with no multipart uploads. On success, reconcile actual size and validate duration/container before publication. Keep unknown/outstanding writes charged; never free an expired reservation while a late upload may still materialize. Cleanup confirms deletion before capacity is released.
3. Store expiration and permanent-slot ownership centrally. Reject reads at normal expiry even if physical deletion is delayed. Track undeleted expired/quarantined/orphan objects within the quota. Retention failure disables new uploads; it does not silently pretend bytes were deleted. Pinning/promotion/replacement must preserve one slot and account for any copied bytes.
4. Before **every** R2 call, durably debit its class-specific attempt allowance. Before each media response, reserve an independent read-request and byte permit, conservatively up to the full object size. HEAD/Range/retries consume permits too. Ambiguous failures do not refund monetary permits. Retain billing-period state across deploys, midnight, process crashes and restores; an old-period permit cannot be executed uncharged in a new period.
5. Keep all media behind this gate: no public R2 custom domain, r2.dev, presigned bypass URL, public disk directory or unauthenticated alternate hostname. Stream through the permitted gateway. Disable shared CDN caching initially; do not serve cached media before budget/expiry checks. R2 is private by default, and r2.dev is an independent exposure that must stay disabled. [R2 public buckets, updated 2026-06-16; consulted 2026-09-07](https://developers.cloudflare.com/r2/buckets/public-buckets/).
6. On byte, identity, request, cost, validator or coordinator failure, deny upload/link creation. On request/cost/authorization failure, also deny hosted reads. The independently functioning local Blob download remains available; changing a button or stopping uploads alone cannot stop existing-link spending. Already admitted responses may finish because their full permits were precharged. Already downloaded copies cannot be revoked.

Keep metadata and logs separately bounded: expire old daily identity counters only after their pending work is resolved, retain billing-period totals through reconciliation, and cap idempotency records. Do not store video blobs in the ledger or duplicate them in diagnostics/backups. Native provider replication is not extra user-upload capacity; separately created application copies count toward the global clip-byte reservation.

The kill switch is server-enforced and durable. Runtime credentials cannot alter billing plans, enable public buckets, provision fleet members or reset the ledger. Alerts are supplementary. If Workers is already Paid, free-tier eligibility cannot be verified, or any alternate object access can evade accounting, B's hard-cost argument fails and hosted paths stay off. Changing plan/tier/prices requires a new cost review.

R2 lifecycle cleanup may be delayed and cannot replace the ledger or immediate authorization expiry. It is a backstop, not proof that capacity has already been freed. [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), consulted 2026-09-07.

## Finite qualification and spend cutoff

Draft approval input: **$500 all-in for one qualification billing period**, no automatic expansion; not authorized by this document. Bind approved host IDs/counts/SKUs, taxes, auxiliary services and worst-case clip permits before provisioning. Missing price or count means no launch. Reserve all committed invoice amounts up front; an admission controller cannot reverse a monthly purchase.

At the illustrative 20-game-host row and 8 KiB snapshots, five separate VPS-3 generator hosts supply 5 Gbit/s at a deliberately assumed 50% of their advertised aggregate port limits. This is network-planning arithmetic, not proof of generator or game CPU capacity. It costs $72.50 for the billing period. A total is **$381.15**; B is **$373.20–$378.08**, before tax and excluded services. At 32 KiB the same network heuristic requires 17 generators; a $500 envelope may fail before CPU is considered.

The protocol has five sustained scenario types, each requiring its own 60-minute interval plus frozen ramp/warm-up, and separate boundary checks. It is not one aggregate hour. VPS billing is monthly: do not divide the monthly price by 720 and call that the test invoice. Host count, room density, generator capacity, all-in quote and raw-evidence disk budget must be resolved before cost approval.

The hard **variable-spend** boundary is fixed US traffic/invoice terms in A, and free-plan rejection plus precharged R2 permits in B. No app-controlled autoscaling, paid analytics/transcoding or metered fallback route is permitted. The full budget gate rejects extra resource commitments; capacity failure stops the test rather than increasing the fleet.

A fixed monthly invoice is **not** a lifetime spending cap. OVH US automatically renews VPS services; shutdown does not establish cancellation. The finite test runbook must cancel/delete owned services and verify provider cancellation receipts before renewal. Do not report total-spend closure until every renewal is canceled. A service-level request kill switch cannot cancel a subscription; preserving permanent saves beyond a test requires an explicitly budgeted ongoing storage policy. [OVH US billing/cancellation, updated 2026-04-02; consulted 2026-09-07](https://support.us.ovhcloud.com/hc/en-us/articles/360002306224-Overview-of-Billing-with-OVHcloud-US).

Before enabling hosted clips, test parallel reservations at 256 MiB, three simultaneous uploads across UTC midnight, permanent replacement at full capacity, late/duplicated PUTs, ledger restore, orphan cleanup, all URL/Range/HEAD bypasses, exhausted Worker/DO quotas, billing-period rollover and in-flight cutoff accounting. Verify local download still works with every hosted endpoint unavailable. These are required future checks, not passed tests here.

Production release additionally requires the existing 300×6 deadline/memory/reconnect gate. The guarded local load aborts, mixed runtime experiment and shared-process profiles provide no instance sizing or CPU-capacity certification. This proposal leaves all current guards and uploadsEnabled=false intact.
