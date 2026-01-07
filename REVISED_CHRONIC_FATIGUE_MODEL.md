# Revised Mathematical Specification: Chronic Fatigue & Readiness Model

## 1. Executive Summary
This model provides a **Chronic Fatigue and Readiness** tracking system that operates on a daily timeline but derives its precision from **high-resolution intra-session data**.

**Key Features:**
1.  **No Testing Required**: Critical Power (CP) is auto-estimated from training history (Mean Maximal Power) and anchored by RPE data.
2.  **High-Definition Load**: Daily Training Load is not based on "Average Power" but on the integral of **Physiological Cost**, capturing the non-linear stress of intervals/variance.
3.  **Dual-Decay Chronic State**: Fatigue is split into **Metabolic Freshness** (fast recovery) and **Structural Health** (slow recovery), providing a more nuanced Readiness Score.

---

## 2. The Engine: Auto-Estimating Critical Power (eCP)

Since we cannot rely on frequent testing, we implement a **Continuous Estimation Engine** that listens to session data.

### 2.1 Data Sources
*   $P_{record}(T)$: The user's best average power for duration $T$ (e.g., 10s, 1m, 5m, 20m) over the trailing window (e.g., 8 weeks).
*   $RPE_{session}$: Session Rating of Perceived Exertion (1-10).

### 2.2 The Algorithm: "eCP" (Estimated Critical Power)
We fit a 2-parameter data envelope to the user's **Mean Maximal Power (MMP)** curve.

**Equation:**
$$ P(t) = \frac{W'}{t} + CP $$

**Estimation Logic:**
1.  **Extract Bests**: Identify best efforts for $T \in [3m, 5m, 12m, 20m, 40m]$.
2.  **RPE Filter**: Only consider efforts where $RPE \ge 9$ (Maximal efforts) for the "Upper Bound" fit.
3.  **Regression**: Perform a weighted least-squares regression on $P$ vs $1/t$ to find the slope ($W'$) and intercept ($CP$).

**The RPE Cross-Check (Calibration):**
*   **Submaximal Anchor**: If a user holds power $P_{sub}$ for $>20$ mins and reports $RPE \le 5$, the model enforces $CP \ge P_{sub}$.
*   **Supra-maximal Flag**: If a user holds $P_{supra}$ for $<10$ mins and fails (stopping or dropping power hugely) with $RPE=10$, that data point reinforces the $W'$ cap.
*   **Decay**: If no max efforts (> 90% previously estimated CP) are seen for 28 days, apply a specific decay coefficient (e.g., $-0.5\%$ per week) to $CP$.

---

## 3. The Input: Daily Physiological Cost ($Cost_{day}$)

Standard metrics (like TSS) use "Normalized Power" which mathematically smooths variability. We ostensibly calculate the **Accumulated Physiological Cost** by iterating through the second-by-second data $P(t)$.

### 3.1 The Cost Function
The cost of generating power is non-linear and state-dependent. Generating 300W when "fresh" is cheaper than generating 300W when "depleted".

**Step 1: Track Acute Deficit ($D_{acute}$)**
This is a purely internal variable (similar to $W'$ bal) used *only* to weight the cost, not displayed as a chronic metric.
*   If $P(t) > CP$: $\Delta D = (P(t) - CP) \cdot \Delta t$
*   If $P(t) < CP$: $\Delta D = (P(t) - CP) \cdot \frac{W'_{remain}}{W'_{total}} \cdot \Delta t$ (Recovery)

**Step 2: Calculate Instantaneous Cost**
$$ Cost(t) = P(t) \cdot \left( 1 + K_{fatigue} \cdot \frac{D_{acute}(t)}{W'} \right) $$

*   $K_{fatigue} \approx 1.5$: Stress multiplier. When the athlete is depleted ($D \approx W'$), every Watt costs 2.5x more "physiological credits" than when fresh.

**Step 3: Integrate for Daily Load**
$$ Load_{daily} = \frac{1}{ReferenceScale} \int_0^{T_{end}} Cost(t) dt $$
*   This ensures that **variable/stochastic** riding (which depletes $W'$) generates a higher Chronic Load than steady riding at the same average power.

---

## 4. The State: Chronic Fatigue Compartments

We feed $Load_{daily}$ into two chronic reservoirs that represent the user's long-term state.

### 4.1 Compartment 1: Metabolic Freshness ($S_{meta}$)
*Represents glycogen stores, hormonal balance, and acute energy system status.*
*   **Feedback**: "Do I have the *energy* to train?"
*   **Dynamics**:
    $$ S_{meta}(t) = S_{meta}(t-1) \cdot e^{-1/\tau_{meta}} + Load_{daily} $$
*   **Time Constant ($\tau_{meta}$)**: $\approx 2 \text{ days}$ (Fast recovery).

### 4.2 Compartment 2: Structural Health ($S_{struct}$)
*Represents muscle fiber integrity, inflammation, and joint/tendon stress.*
*   **Feedback**: "Does my body *hurt*? Am I at injury risk?"
*   **Dynamics**:
    $$ S_{struct}(t) = S_{struct}(t-1) \cdot e^{-1/\tau_{struct}} + Load_{daily} \cdot \sigma_{impact} $$
*   **Time Constant ($\tau_{struct}$)**: $\approx 15 \text{ days}$ (Slow recovery).
*   **$\sigma_{impact}$**: Impact multiplier (Default 1.0, but can be higher for running/high-torque activities).

---

## 5. The Outputs: Readiness & Feedback

### 5.1 Readiness Score (0-100)
A composite score checking both tanks.
$$ Readiness = 100 - \min\left(100, \left( w_1 \frac{S_{meta}}{Cap_{meta}} + w_2 \frac{S_{struct}}{Cap_{struct}} \right) \cdot 100 \right) $$
*   $w_1 \approx 0.6$: Metabolic state is the primary driver of "feeling" ready.
*   $w_2 \approx 0.4$: Structural state provides the "brakes" to prevent overuse.

### 5.2 Interpretive Logic
*   **High Readiness (>80)**: Both tanks low. Green light for high intensity.
*   **Metabolic Fatigue (Low $S_{meta}$, High $S_{struct}$)**: "Legs exist, but energy is low." Suggest: Zone 2 / Endurance.
*   **Structural Fatigue (High $S_{meta}$, Low $S_{struct}$)**: "Energy is high, but injury risk involved." Suggest: Active Recovery or Non-impact cross-training.

### 5.3 RPE Correction Loop
If $RPE_{session}$ is significantly higher than the Model Predicted Difficulty:
1.  **Implication**: The user is more fatigued than the model thinks, OR their CP has dropped.
2.  **Action**: Apply a "Penalty Load" to $S_{meta}$ for the next 24 hours to force a simplified recovery recommendation.
3.  **Learning**: If this mismatch persists for $>3$ sessions, trigger a CP downgrade ($\downarrow 2\%$).

---

## 6. Implementation Strategy

1.  **Backfill**: Run the "eCP" algorithm on the last 60 days of JSON session data to establish baseline CP and $W'$.
2.  **Initialize States**: Run the $Load_{daily}$ integration from $t_{-60}$ to $t_{now}$ to seed $S_{meta}$ and $S_{struct}$.
3.  **Forward Simulation**:
    *   On new session upload -> Parse $P(t)$ array.
    *   Update $CP$ (if best effort detected).
    *   Calculate $Load_{daily}$.
    *   Update $S_{meta}, S_{struct}$.
    *   Recalculate Readiness.

---

## 7. Integration with Readiness Questionnaire

The existing "Intelligence Layer" questionnaires (Sleep, Nutrition, Stress, Physical, Motivation) are repurposed to drive **State Corrections** and **Recovery Modulation**.

Instead of arbitrarily adding points to a final score, questionnaire answers directly influence the **dynamical parameters** for that day.

### 7.1 Recovery Efficiency Modulation ($\phi_{recovery}$)
We define a daily efficiency scalar $\phi \in [0.5, 1.5]$ based on "Recovery Inputs" (Sleep, Nutrition, Stress).
*   **Logic**:
    *   Perfect Sleep (5/5) & Nutrition (5/5) $\rightarrow \phi = 1.25$ (Faster recovery).
    *   Terrible Sleep (1/5) & High Stress (1/5) $\rightarrow \phi = 0.6$ (Slower recovery).
*   **Application**:
    $$ S_{meta}(t) = S_{meta}(t-1) \cdot e^{-1/(\tau_{meta} \cdot \phi_{recovery})} + Load $$
    *   *Effect*: A user with poor sleep will essentially "retain" more metabolic fatigue for the next day.

### 7.2 State Correction (Bayesian Update)
We use "State Inputs" (Soreness, Energy) as **Measurement Updates** to correct the model's open-loop estimation.

#### A. Structural Correction (Soreness)
*   **Model Prediction**: $S_{struct}$
*   **Observation**: User reports "Extreme Soreness" (1/5).
*   **Logic**:
    *   If Model says "Fresh" ($S_{struct} < 20\%$) BUT User says "Painful" (1/5):
    *   **Action**: Force-inject Structural Load.
    $$ \Delta S_{struct} = \max(0, 0.5 \cdot Cap_{struct} - S_{struct}) $$
    *   This ensures the model aligns with reality: "You are sore, so the model assumes damage exists."

#### B. Metabolic Correction (Energy)
*   **Observation**: User reports "Exhausted" (1/5).
*   **Action**: If $S_{meta}$ is low (model thinks you are energetic), we apply a **Fatigue Penalty**.
    $$ S_{meta} \leftarrow S_{meta} + 0.3 \cdot Cap_{meta} $$
    *   This captures "hidden fatigue" (e.g., mental burnout, immune system stress) that power data didn't see.

### 7.3 Compatibility with Existing "Intelligence Layers"
We retain the **Synergy & Cascade** logic from the existing `questionnaireConfig.ts` but map their outputs to these new dynamical targets:
*   **Synergy**: If multiple categories align negative $\rightarrow$ Apply a stronger penalty to $\phi_{recovery}$.
*   **Trends**: If 7-day trend is declining $\rightarrow$ Reduce $CP$ estimate slightly (assuming under-recovery is affecting performance capacity).

