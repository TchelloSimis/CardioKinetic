---
title: Building a Monte Carlo-Powered Training App: How I Replaced Subscriptions with Science
published: false
description: How I built an open-source fitness app that uses 100,000 simulations to personalize training, dual-compartment fatigue modeling, and Critical Power estimation—all running locally on your phone.
tags: opensource, fitness, typescript, react
cover_image: https://raw.githubusercontent.com/TchelloSimis/CardioKinetic/main/assets/github-banner.svg
---

# Building a Monte Carlo-Powered Training App

I got tired of paying $20/month for training apps that told me to "rest when tired" and "push when fresh." That's not science—that's common sense wrapped in a subscription.

So I built **CardioKinetic**, an open-source Android app that uses actual sports science to manage training load. No subscriptions. No cloud accounts. No data harvesting. Just math.

Here's how it works.

## The Problem with Simple Training Load

Most apps track "Training Stress Score" or similar single-number metrics. They sum up your workouts and tell you when you're overreaching.

The problem? **Fatigue isn't one thing.**

When you finish a hard interval session, you're depleted in two distinct ways:

1. **Metabolic depletion** — Your glycogen stores are empty, your hormones are disrupted, your central nervous system is fried. This recovers in 1-2 days.

2. **Structural damage** — Your muscle fibers have micro-tears, your connective tissue is inflamed, your joints are stressed. This takes 10-20 days to fully resolve.

Ever felt "ready to train" but got injured anyway? That's metabolic recovery outpacing structural recovery. Your energy came back before your muscles healed.

## Dual-Compartment Fatigue Model

CardioKinetic tracks these separately:

```typescript
interface ChronicFatigueState {
  met: number;  // Metabolic tank (0-100%)
  msk: number;  // Musculoskeletal tank (0-100%)
}
```

Each compartment has its own decay constant:

```typescript
const TAU_MET = 2;   // 2-day recovery
const TAU_MSK = 15;  // 15-day recovery
```

After each session, both tanks fill based on training load. Then they drain exponentially:

```
MET(t+1) = MET(t) × e^(-1/τ_MET) + Load × impact_MET
MSK(t+1) = MSK(t) × e^(-1/τ_MSK) + Load × impact_MSK
```

But here's where it gets interesting: **recovery efficiency isn't constant.**

## Questionnaire-Modulated Recovery

Every day, you can optionally answer 8 wellness questions about sleep, nutrition, stress, and physical state. These responses calculate a **recovery efficiency factor** (φ):

```typescript
// Poor sleep + high stress = slower recovery
const phi = calculateRecoveryEfficiency(questionnaire);
// φ ranges from 0.5 (impaired) to 1.2 (enhanced)

// Modified decay
MET(t+1) = MET(t) × e^(-φ/τ_MET) + Load × impact_MET
```

Bad sleep doesn't just make you feel tired—it mathematically slows how fast your tanks drain.

## Estimating Critical Power Without a Lab

Your **Critical Power (CP)** is the maximum intensity you can sustain indefinitely. It's your aerobic ceiling. Knowing it unlocks everything:

- Training zones become physiologically meaningful
- Session "cost" can be calculated relative to your actual capacity
- Recovery predictions become personalized

Labs charge hundreds for this test. CardioKinetic estimates it from your training history.

### The Algorithm

1. **Extract Mean Maximal Power (MMP)** — For each session with granular power data, find the highest average power you held for 3, 5, 10, 20, 30, 40 minutes.

2. **Fit the Hyperbolic Model** — CP and W' (your anaerobic reserve) relate to duration by:
   ```
   P(t) = CP + W'/t
   ```
   Linear regression on the points gives CP as the slope.

3. **Submaximal Anchor** — Here's the key insight: you don't need all-out efforts. If you did a steady 30-minute ride at RPE 7, that power is probably ~85% of CP. The algorithm uses RPE proximity scoring to weight moderate efforts.

4. **Decay** — If you haven't tested recently, CP estimates degrade toward population defaults. This prevents stale data from skewing recommendations.

```typescript
function calculateECP(sessions: SessionResult[]): CPEstimate {
  const mmps = extractMMPs(sessions);
  const anchors = extractSubmaximalAnchors(sessions);
  
  // Weighted regression with recency decay
  const { cp, wPrime } = fitHyperbolicModel([...mmps, ...anchors]);
  
  return { cp, wPrime, confidence: calculateConfidence(mmps) };
}
```

## Monte Carlo: Why 100,000 Simulations?

When you start a training program, CardioKinetic runs 100,000 simulations of that program to establish statistical baselines.

Each simulation:
1. Adds ±5% random variability to session durations
2. Runs the full fatigue model forward
3. Records fatigue/readiness at each week

From 100k runs, we extract percentile bands:
- **P15/P85** — Extreme states (critical intervention needed)
- **P30/P70** — Notable deviation (adjust training)
- **P50** — Expected baseline

When your actual fatigue deviates from these bands, the app automatically adjusts your training:

```typescript
if (fatigue > p85) {
  // Critical: Force 20% power reduction
  return { powerMultiplier: 0.80, message: "High fatigue detected" };
} else if (fatigue > p70) {
  // Stressed: Moderate 12% reduction
  return { powerMultiplier: 0.88, message: "Consider lighter session" };
}
```

This isn't a rule-based system—it's a statistically-grounded adaptive engine.

## The Stack

| Layer | Tech |
|-------|------|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Mobile | Capacitor 6 (Android) |
| State | React Hooks + LocalStorage |
| Testing | Vitest + Testing Library |

Everything runs locally. No backend. No accounts. Data never leaves your device.

## Try It

- **GitHub**: [TchelloSimis/CardioKinetic](https://github.com/TchelloSimis/CardioKinetic)
- **Direct APK**: [Download v1.8.0](https://github.com/TchelloSimis/CardioKinetic/releases/latest/download/CardioKinetic.apk)

It's GPLv3 licensed. Fork it, improve it, or just use it to train smarter.

---

*What training metrics do you wish apps tracked better? I'm always looking for ways to improve the model.*
