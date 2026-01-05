# **Mathematical Modeling of Fatigue, Readiness, and Performance in Endurance Training: From Foundational Impulse-Response Theory to Frontier Complex Systems**

## **1\. Introduction: The Systems Engineering of Human Adaptation**

The human organism, when subjected to the stress of endurance training, behaves as a complex, dynamic, and adaptive system. The fundamental challenge of sports science and performance engineering is to decipher the transfer function that maps a known input—the training load, characterized by intensity, duration, frequency, and modality—to a measurable output, typically defined as athletic performance (e.g., power output, velocity, time-to-exhaustion). This relationship is neither linear nor time-invariant; it is stochastic, path-dependent, and modulated by a myriad of internal and external state variables ranging from glycogen availability and sleep homeostasis to circadian rhythmicity and psychological motivation.1

For decades, the prediction of athletic readiness relied on empirical intuition or simplified retrospective analysis. However, the rigorous application of systems theory, originating with the seminal work of Eric Banister in the 1970s, transformed this domain into a quantitative science. Banister’s Impulse-Response (IR) model posited that training load acts as a dual stimulus, simultaneously generating "fitness" (positive adaptation) and "fatigue" (negative adaptation), each decaying at different rates.3 This provided the first mathematical justification for periodization and tapering, moving the field from art to engineering.

Yet, the classical Banister model relies on a Linear Time-Invariant (LTI) assumption—that the body’s response coefficients are static. This is a physiological impossibility; the very nature of training is to alter the system's parameters (e.g., faster recovery, higher tolerance). Consequently, frontier mathematical frameworks have emerged to capture the non-linearities of adaptation. These include Busso’s Variable Dose-Response (VDR) models, which introduce time-varying gain terms; Perl’s Performance-Potential (PerPot) metamodel, which uses antagonistic potentials and overflow mechanisms to simulate overtraining collapse; and bioenergetic hydraulic models (Morton, Weigend), which utilize fluid dynamics to represent critical power and anaerobic work capacity ($W'$) depletion.5

Furthermore, the modern "Digital Twin" approach demands the integration of auxiliary datasets. Readiness is not merely the dissipation of training fatigue; it is the reconstruction of homeostasis. This requires coupling the differential equations of training load with the exponential decay models of sleep pressure (Process S), the Michaelis-Menten kinetics of glycogen resynthesis, and the hysteresis loops of psychobiological fatigue.8

This report provides an exhaustive analysis of these mathematical frameworks. It deconstructs the governing equations of each model, explores their implementation in discrete-time simulations, analyzes the algorithms used for parameter optimization (from Non-Linear Least Squares to Evolutionary Computation and Kalman Filtering), and synthesizes a unified vision for the future of performance prediction.

## ---

**2\. Theoretical Foundations: Systems Theory in Physiology**

### **2.1 The Black Box Problem**

In control theory, a system is defined by the relationship between its inputs $u(t)$ and outputs $y(t)$. In the context of endurance training:

* **Input $u(t)$**: The daily dose of training stress (Training Impulse or TRIMP).  
* **Output $y(t)$**: The realized performance capacity.  
* **State $x(t)$**: The hidden internal physiological variables (e.g., mitochondrial density, neuromuscular fatigue, glycogen stores).

The fundamental assumption of the early modeling era was that this system could be approximated as a "grey box"—we may not know every molecular pathway, but we can characterize the macroscopic behavior using transfer functions derived from input-output data.2

### **2.2 The Convolution Integral**

The mathematical bedrock of performance modeling is the **convolution integral**. If we assume the system is linear and causal, the output $p(t)$ at any time $t$ is the accumulation of all past training impulses $w(\\tau)$, weighted by an impulse response function $h(t \- \\tau)$ that describes how the effect of a single training session decays over time.

$$p(t) \= p\_0 \+ \\int\_{0}^{t} w(\\tau) h(t \- \\tau) d\\tau$$  
Where:

* $p\_0$ is the baseline performance level in the untrained state.  
* $w(\\tau)$ is the training load at time $\\tau$.  
* $h(t)$ is the impulse response function.

The shape of $h(t)$ defines the physiology. A simple exponential decay suggests that the training effect is maximal immediately after the session and fades over time. However, observation dictates that performance initially drops (fatigue) before rising (supercompensation). This requires $h(t)$ to be a composite function, leading to the dual-component structure that defines the Banister model.1

## ---

**3\. The Banister Impulse-Response Model: Canonical Derivation**

### **3.1 The Two-Component Differential Equation**

Banister’s pivotal insight was to decompose the single transfer function into two antagonistic first-order systems: **Fitness** ($g\_1$) and **Fatigue** ($g\_2$).

Each component $i$ is modeled as a container that is filled by training load and drains over time. The rate of change of the component level $g\_i(t)$ is proportional to the current level (decay) and the new input (gain). This is expressed by the linear ordinary differential equation (ODE):

$$\\frac{dg\_i(t)}{dt} \= \-\\frac{1}{\\tau\_i} g\_i(t) \+ k\_i w(t)$$  
Where:

* $\\tau\_i$ is the time constant of decay.  
* $k\_i$ is the gain factor (magnitude of effect).

The solution to this first-order linear ODE for a continuous input $w(t)$ is the convolution:

$$g\_i(t) \= k\_i \\int\_{0}^{t} e^{-(t-\\tau)/\\tau\_i} w(\\tau) d\\tau$$  
The net performance $p(t)$ is the algebraic difference between these two components, superimposed on the baseline $p\_0$:

$$p(t) \= p\_0 \+ g\_1(t) \- g\_2(t)$$

$$p(t) \= p\_0 \+ k\_1 \\int\_{0}^{t} e^{-(t-\\tau)/\\tau\_1} w(\\tau) d\\tau \- k\_2 \\int\_{0}^{t} e^{-(t-\\tau)/\\tau\_2} w(\\tau) d\\tau$$

### **3.2 Constraints and Physiological Interpretation**

For the model to replicate known biological phenomena (e.g., the "delayed training effect" or supercompensation), specific constraints must be applied to the parameters:

1. **$\\tau\_1 \> \\tau\_2$**: Fitness must be more persistent than fatigue. Typical values found in literature are $\\tau\_1 \\approx 40-50$ days and $\\tau\_2 \\approx 10-15$ days.11 If fatigue lasted longer than fitness, training would be perpetually detrimental.  
2. **$k\_2 \> k\_1$**: The immediate magnitude of fatigue must exceed the immediate magnitude of fitness. If $k\_1 \> k\_2$, performance would improve immediately after an exhausting workout, which contradicts reality. The immediate post-exercise state is dominated by the fatigue term ($g\_2$), suppressing performance. As $g\_2$ decays rapidly (due to small $\\tau\_2$), the more stable $g\_1$ term (fitness) reveals itself, creating the performance peak.12

### **3.3 Discrete-Time Implementation (Recursive Formulation)**

In practice, training load is not a continuous function but a discrete daily sequence $\\{w\_1, w\_2,..., w\_n\\}$. We must discretize the continuous convolution integral into a difference equation suitable for computational simulation.

The exact solution of the ODE over a time step $\\Delta t$ (typically 1 day) assumes the input $w\_n$ is an impulse or constant over the interval. The recursive update for component $g\_i$ on day $n$ is:

$$g\_i(n) \= g\_i(n-1) \\cdot e^{-1/\\tau\_i} \+ w\_n \\cdot k\_i$$  
Here, the term $e^{-1/\\tau\_i}$ acts as a daily decay factor. Let $\\phi\_i \= e^{-1/\\tau\_i}$. The equation becomes:

$$g\_i(n) \= \\phi\_i g\_i(n-1) \+ k\_i w\_n$$  
The predicted performance $\\hat{p}\_n$ is:

$$\\hat{p}\_n \= p\_0 \+ k\_1 \\sum\_{j=1}^{n-1} w\_j e^{-(n-j)/\\tau\_1} \- k\_2 \\sum\_{j=1}^{n-1} w\_j e^{-(n-j)/\\tau\_2}$$  
This summation form is computationally efficient ($O(N)$ complexity) and allows for the retrospective analysis of years of training data.

### **3.4 Model Stability and Parameter Fitting**

Calibrating the Banister model to an individual athlete involves estimating the parameter vector $\\theta \= \\{p\_0, k\_1, \\tau\_1, k\_2, \\tau\_2\\}$. This is an optimization problem where we minimize the residual sum of squares (RSS) between the model prediction $\\hat{p}$ and the observed performance $p\_{obs}$ (e.g., power output in a standardized test or race results).4

$$RSS(\\theta) \= \\sum\_{t} (p\_{obs}(t) \- \\hat{p}(t|\\theta))^2$$  
The optimization landscape for this function is notoriously difficult. It is often non-convex with long, flat valleys, making gradient-based methods like Levenberg-Marquardt sensitive to initial conditions.

* **Multicollinearity**: The parameters are highly correlated. A model with high gain ($k\_1$) and fast decay ($\\tau\_1$) can produce a curve very similar to one with lower gain and slower decay. This "identifiability problem" means different parameter sets can yield identical error statistics but vastly different physiological interpretations.11  
* **Stability**: Cross-validation studies indicate that parameters derived from one season often fail to predict the next. This instability suggests that the static parameter assumption ($\\theta$ is constant) is false—the athlete's physiology changes *because* of the training.11

Table 1 summarizes the typical ranges and interpretations of these parameters found in literature.

| Parameter | Interpretation | Typical Range (Days/Arb) | Biological Correlate |
| :---- | :---- | :---- | :---- |
| $\\tau\_1$ | Fitness Decay | 30 \- 60 days | Mitochondrial half-life, Capillary density stability |
| $\\tau\_2$ | Fatigue Decay | 5 \- 15 days | Glycogen restoration, Neuromuscular recovery, Inflammation resolution |
| $k\_1$ | Fitness Gain | 1.0 (Normalized) | Sensitivity to training stimulus (Responder vs Non-responder) |
| $k\_2$ | Fatigue Gain | 1.5 \- 3.0 x $k\_1$ | Acute stress response, Cortisol spike magnitude |
| $p\_0$ | Baseline | Intercept | Genetic floor of performance without training |

## ---

**4\. Nonlinear Dynamics: The Variable Dose-Response (VDR) Model**

### **4.1 Busso’s Critique of Linearity**

Thierry Busso recognized that the Banister model fails to account for the "diminishing returns" of training or the non-linear accumulation of fatigue during intensification phases. In a linear model, doubling the load doubles the fitness gain forever. In reality, biological systems exhibit saturation and eventually maladaptation (overtraining).

Busso proposed the **Variable Dose-Response (VDR)** model, which alters the fundamental equations to allow the model parameters themselves to vary with time.5

### **4.2 Mathematical Formulation of Time-Varying Parameters**

The VDR model modifies the fatigue impulse response. Instead of a fixed gain $k\_2$, the magnitude of the fatigue response is itself a function of recent training history. This creates a "system within a system."

Let the fatigue component $g\_2(n)$ be:

$$g\_2(n) \= \\sum\_{j=1}^{n-1} k\_2(j) \\cdot w\_j \\cdot e^{-(n-j)/\\tau\_2}$$  
The variable gain $k\_2(j)$ evolves according to a third convolution integral, representing a "stress memory" or "fatigue of fatigue":

$$k\_2(j) \= k\_{base} \+ \\alpha \\sum\_{m=1}^{j-1} w\_m \\cdot e^{-(j-m)/\\tau\_3}$$  
Where:

* $\\tau\_3$ is a third time constant (often short, e.g., 5-10 days), representing the accumulation of training intolerance.  
* $\\alpha$ scales the sensitivity of the fatigue system to training density.

### **4.3 The Inverted-U Relationship**

This recursive dependency introduces a quadratic nonlinearity.

* At **low loads**, the $\\alpha$ term is negligible; $k\_2$ remains near $k\_{base}$. Fitness ($g\_1$) dominates, and performance improves.  
* At **high loads**, the cumulative sum in the $k\_2(j)$ equation grows large. This inflates the fatigue gain for subsequent training sessions. A standard workout now triggers a massive fatigue response ($g\_2$), overwhelming the fitness gain ($g\_1$).5

This mathematically generates an inverted-U curve for performance vs. training load. It predicts that beyond a critical training tolerance, further volume leads to performance decline—a phenomenon the linear Banister model explicitly cannot predict (as it would simply predict slower improvement, not decline, unless $k\_2 \\tau\_2 \> k\_1 \\tau\_1$, which violates basic constraints).15

### **4.4 Implementation Algorithms**

Implementing the VDR model requires iteratively calculating $k\_2(n)$ at each time step before calculating $g\_2(n)$. Because of the nested sums, the computational complexity increases. Furthermore, fitting this model requires estimating extra parameters ($\\tau\_3$, $\\alpha$, $k\_{base}$).

Research by Busso and others suggests using **Recursive Least Squares (RLS)** with a forgetting factor to estimate these time-varying parameters online, rather than batch processing a whole season. This allows the model to adapt to the athlete's changing phenotype week-by-week.16

## ---

**5\. The Performance-Potential (PerPot) Metamodel**

### **5.1 System Dynamics and Antagonism**

While Banister and Busso focus on impulse-response filters, Jürgen Perl’s PerPot model adopts a **System Dynamics** architecture, viewing the athlete as a set of interacting reservoirs or "potentials." It is specifically designed to model the non-linear collapse phenomena associated with overreaching and overtraining.18

The model consists of three main components:

1. **Performance Potential ($PP$)**: The current capacity to perform work.  
2. **Response Potential ($RP$)**: A buffer of positive adaptation (fitness).  
3. **Strain Potential ($SP$)**: A buffer of negative stress (fatigue).

### **5.2 Governing Difference Equations**

The system evolves through discrete time steps ($\\Delta t$). The load input feeds into both the Response and Strain potentials, but with different delays and rates.19

Let $L(t)$ be the load. The change in potentials is governed by inflows and outflows:

$$RP(t \+ \\Delta t) \= RP(t) \+ \\Delta t \\cdot (L(t) \- Flow\_{RP \\to PP}(t))$$

$$SP(t \+ \\Delta t) \= SP(t) \+ \\Delta t \\cdot (L(t) \- Flow\_{SP \\to PP}(t))$$  
The antagonistic effect on the Performance Potential ($PP$) is:

$$PP(t \+ \\Delta t) \= PP(t) \+ \\Delta t \\cdot (Rate\_{in} \\cdot Flow\_{RP \\to PP}(t) \- Rate\_{out} \\cdot Flow\_{SP \\to PP}(t))$$  
The flows are typically modeled as proportional to the potential level (first-order kinetics), but modified by delay functions.

### **5.3 The Overflow Mechanism: Modeling Collapse**

The defining feature of PerPot is the **Strain Overflow**. Unlike Banister’s fatigue, which can grow infinitely, PerPot’s Strain Potential has a finite capacity, $SP\_{max}$. This represents the biological limit of stress tolerance (e.g., glycogen depletion limit, hormonal axis exhaustion).

If the Strain Potential fills up ($SP(t) \> SP\_{max}$), an overflow occurs. This overflow ($OR$) is not merely "lost" strain; it becomes a destructive feedback signal 21:

$$OR(t) \= \\max(0, SP(t) \- SP\_{max})$$  
This overflow term is subtracted from the Performance Potential with a high weighting factor ($W\_{collapse}$), or it is used to inhibit the inflow from the Response Potential:

$$PP\_{new} \= PP\_{old} \- W\_{collapse} \\cdot OR(t)$$  
This mechanism mathematically reproduces the **Sudden Collapse** phenomenon. An athlete might be stable at a high load (Strain near capacity), but a tiny increment in load pushes $SP$ over $SP\_{max}$. The resulting overflow triggers a massive negative term in the performance equation, causing a rapid, non-linear drop in performance that persists even if the load is reduced, because the Strain Potential must drain below threshold to stop the overflow.6 This models the "hysteresis" of overtraining—it takes far longer to recover from overtraining than to induce it.

## ---

**6\. Bioenergetic and Hydraulic Models: Physics of the Engine**

Moving deeper into the mechanism, Hydraulic models attempt to simulate the underlying bioenergetics—the flow of metabolic energy—rather than just the phenomenological outcome.

### **6.1 Morton’s Three-Component Hydraulic Analog**

R.H. Morton proposed a hydraulic system to represent the three energy pathways:

1. **Aerobic ($Ae$)**: An infinite tank (representing atmospheric oxygen).  
2. **Anaerobic Fast ($AnF$)**: A small, finite tank (ATP-PCr).  
3. **Anaerobic Slow ($AnS$)**: A larger finite tank (Glycolytic/Lactate).7

The tanks are connected by pipes. The fluid levels ($h$) represent the availability of energy, and the flows ($p$) represent metabolic rates.

* **Pipe $Ae \\to AnF$**: Represented by maximal conductance $M\_{Ae}$ ($\\dot{V}O\_{2max}$). The flow is driven by the pressure difference (fluid height) between the infinite $Ae$ source and the current level of $AnF$.  
* **Pipe $AnS \\to AnF$**: Represents glycolytic flux.  
* **Tap $AnF \\to Out$**: Represents the power demand ($P$) of the exercise.

### **6.2 Emergence of Critical Power (CP) and W'**

This hydraulic structure naturally gives rise to the **Critical Power (CP)** concept. CP corresponds to the maximal steady-state flow rate where the input from $Ae$ (plus any sustainable trickle from $AnS$) matches the output demand. If demand $P \> CP$, the level in the $AnF$ tank ($W'$) must drop to sustain the flow. When $AnF$ empties ($h\_{AnF} \= 0$), failure occurs.24

The differential equation for the depletion of the Anaerobic Work Capacity ($W'$) derived from this model is:

$$\\frac{dW'}{dt} \= \-(P(t) \- CP) \\quad \\text{for } P \> CP$$  
For recovery ($P \< CP$), the hydraulic model predicts an exponential recharge driven by the pressure head. The recharge rate depends on the difference between CP and the current low intensity $P$:

$$\\frac{dW'}{dt} \= (CP \- P(t)) \\cdot e^{-t/\\tau\_{rec}}$$  
However, Morton’s full model is more complex, involving coupled differential equations for the heights $h\_{AnF}$ and $h\_{AnS}$.

### **6.3 Weigend’s Discrete-Time Formulation**

Fabian Weigend et al. (2021) formalized this hydraulic analog into a discrete-time simulation for modern computational use. This allows the model to handle variable-intensity interval training (HIIT) where power fluctuates rapidly.26

The update logic for a time step $\\Delta t$ involves calculating intermediate flows. For the Anaerobic Fast tank ($AnF$):

$$h\_{AnF}(t) \= h\_{AnF}(t-1) \+ \\frac{1}{A\_{AnF}} (p\_{Ae}(t) \+ p\_{An}(t) \- P\_{demand}(t)) \\Delta t$$  
Where $p\_{Ae}(t)$ (aerobic contribution) is a function of the current tank depletion:

$$p\_{Ae}(t) \= M\_{Ae} \\cdot \\left( 1 \- \\frac{h\_{AnF}(t-1)}{h\_{max}} \\right)$$  
This equation mirrors the kinetic uptake of oxygen: as the tank empties (energy debt increases), the aerobic drive increases until it hits $\\dot{V}O\_{2max}$.

**Robustness Limitations**: Weigend introduced algorithmic constraints to prevent "physics violations" in discrete simulation:

1. **Capacity Capping**: Flow cannot exceed the remaining volume of a tank in a single $\\Delta t$.  
2. **Refill Capping**: A tank cannot fill beyond $100\\%$.  
3. **Equilibrium Constraints**: Flow between $AnS$ and $AnF$ stops if their levels equalize, modeling chemical equilibrium.26

These constraints make the Weigend model superior to simple integral-balance models for predicting recovery during intermittent sprints, as it accounts for the slowing of recovery as $W'$ fills up (back-pressure).27

## ---

**7\. Frontier Implementation: State-Space and Stochastic Control**

The future of performance modeling lies in combining these physiological equations with the rigorous estimation frameworks of control engineering. The **State-Space** approach transforms the deterministic Banister/Busso equations into a probabilistic framework that can handle noise and uncertainty.

### **7.1 State-Space Representation**

We define the athlete's state vector $\\mathbf{x}\_k$ at day $k$ as:

$$\\mathbf{x}\_k \= \\begin{bmatrix} g\_1(k) \\\\ g\_2(k) \\end{bmatrix}$$

(Fitness and Fatigue).  
The system dynamics are described by the matrix difference equation:

$$\\mathbf{x}\_{k+1} \= \\mathbf{A} \\mathbf{x}\_k \+ \\mathbf{B} u\_k \+ \\mathbf{w}\_k$$  
Where:

* $\\mathbf{A} \= \\begin{bmatrix} e^{-1/\\tau\_1} & 0 \\\\ 0 & e^{-1/\\tau\_2} \\end{bmatrix}$ is the State Transition Matrix (Decay).  
* $\\mathbf{B} \= \\begin{bmatrix} k\_1 \\\\ k\_2 \\end{bmatrix}$ is the Control Matrix (Gain).  
* $u\_k$ is the training load (TRIMP).  
* $\\mathbf{w}\_k \\sim N(0, \\mathbf{Q})$ is the **Process Noise**. This is critical: it acknowledges that biology is noisy. Sleep, nutrition, and stress add random perturbations to the fitness/fatigue states every day.28

The observation (measurement) equation relates the hidden state to the actual performance test $y\_k$:

$$y\_k \= \\mathbf{C} \\mathbf{x}\_k \+ v\_k$$

Where $\\mathbf{C} \= \[1, \-1\]$ and $v\_k \\sim N(0, R)$ is the Measurement Noise (error in the test itself).

### **7.2 The Kalman Filter Algorithm**

The Kalman Filter is the optimal recursive estimator for this system. It operates in a Predict-Correct cycle:

1. Time Update (Prediction):

   $$\\hat{\\mathbf{x}}\_{k|k-1} \= \\mathbf{A} \\hat{\\mathbf{x}}\_{k-1|k-1} \+ \\mathbf{B} u\_k$$  
   $$\\mathbf{P}\_{k|k-1} \= \\mathbf{A} \\mathbf{P}\_{k-1|k-1} \\mathbf{A}^T \+ \\mathbf{Q}$$

   (Where $\\mathbf{P}$ is the error covariance matrix—the "uncertainty" of the estimate).  
2. Measurement Update (Correction):  
   When a test $y\_k$ occurs, we calculate the Kalman Gain $\\mathbf{K}\_k$:

   $$\\mathbf{K}\_k \= \\mathbf{P}\_{k|k-1} \\mathbf{C}^T (\\mathbf{C} \\mathbf{P}\_{k|k-1} \\mathbf{C}^T \+ R)^{-1}$$  
   Then update the state estimate:

   $$\\hat{\\mathbf{x}}\_{k|k} \= \\hat{\\mathbf{x}}\_{k|k-1} \+ \\mathbf{K}\_k (y\_k \- \\mathbf{C} \\hat{\\mathbf{x}}\_{k|k-1})$$

**Implication**: The term $(y\_k \- \\mathbf{C} \\hat{\\mathbf{x}}\_{k|k-1})$ is the **Innovation**—the difference between reality and the model's prediction. The Kalman Gain $\\mathbf{K}\_k$ determines how much to "trust" this new data.

* If the test is noisy (high $R$), $\\mathbf{K}$ is small; the model ignores the outlier.  
* If the physiology is volatile (high $\\mathbf{Q}$), $\\mathbf{K}$ is large; the model aggressively adapts to the new performance level.28

This allows the model to track an athlete's changing readiness in real-time, effectively "auto-correcting" the fitness/fatigue estimates whenever a race or test result is entered.

### **7.3 Bayesian Inference**

While Kalman filtering estimates the states, Bayesian Inference (e.g., using Markov Chain Monte Carlo or JAGS) is used to estimate the parameters ($\\tau, k$). Unlike NLLS which gives a single "best fit" value, Bayesian methods yield a Posterior Distribution for each parameter.  
This quantifies uncertainty: "There is a 95% probability that $\\tau\_1$ is between 42 and 48 days." This is crucial for risk management in high-performance sport, allowing coaches to make probabilistic decisions ("There is a 20% chance this load will cause overtraining").12

## ---

**8\. Artificial Intelligence: Learning from High-Dimensional Data**

Traditional differential equations require specific assumptions about structure. Machine Learning (ML) approaches, conversely, learn the structure from the data itself.

### **8.1 Recurrent Neural Networks (LSTMs)**

The accumulation of fatigue is fundamentally a time-series problem with long-term dependencies. A hard training block three weeks ago influences today's performance. **Long Short-Term Memory (LSTM)** networks are explicitly designed for this.

An LSTM unit replaces the simple decay $\\tau$ with a learned **Forget Gate** ($f\_t$):

$$f\_t \= \\sigma(W\_f \\cdot \[h\_{t-1}, x\_t\] \+ b\_f)$$  
The cell state $C\_t$ (analogous to the Fitness/Fatigue state) is updated as:

$$C\_t \= f\_t \* C\_{t-1} \+ i\_t \* \\tilde{C}\_t$$  
Unlike the fixed $\\phi \= e^{-1/\\tau}$ in Banister’s model, the forget gate $f\_t$ is dynamic. It is a function of the current input $x\_t$ (load) and the previous context $h\_{t-1}$. This means the neural network can *learn* to decay fatigue slower after a marathon than after a 5k run, without being explicitly programmed with different $\\tau$ values. It captures the context-dependent recovery kinetics that linear models miss.31

### **8.2 Random Forests for Injury Modeling**

While performance is continuous, injury is often categorical (Injured / Not Injured). The relationship between Load and Injury is highly non-linear and threshold-based. **Random Forests** (RF) are effective here.

RF models aggregate decision trees. Feature engineering is critical. Key features derived from the Banister concepts include:

* **Acute Load**: Exponentially weighted moving average (EWMA) with $\\tau \\approx 7$ days.  
* **Chronic Load**: EWMA with $\\tau \\approx 28$ days.  
* **Acute:Chronic Workload Ratio (ACWR)**: The ratio of the two.  
* **Monotony**: Mean Load / Standard Deviation of Load.

RF models can identify interaction effects: "If ACWR \> 1.5 AND Sleep \< 6h, risk spikes." Linear regression cannot capture this logical "AND" easily. Studies show RFs outperform simple moving averages in predicting non-contact soft tissue injuries.33

## ---

**9\. Integrative Physiology: Sleep, Fuel, and Mind**

A complete "Digital Twin" of athletic readiness cannot rely on training load alone. It must integrate the "invisible" state variables.

### **9.1 Sleep Homeostasis: The Two-Process Model**

Recovery is biologically regulated by sleep. The **Two-Process Model** (Borbély) provides the equations to integrate sleep into readiness.

1. **Process S (Homeostatic Pressure)**: Rises during wake, falls during sleep.  
   * Wake ($t\_{awake}$): $S(t) \= 1 \- (1 \- S\_0) e^{-t/\\tau\_w}$  
   * Sleep ($t\_{asleep}$): $S(t) \= S\_{high} e^{-t/\\tau\_s}$  
     ($\\tau\_w \\approx 18.2h, \\tau\_s \\approx 4.2h$).  
2. Process C (Circadian): A sine wave representing the body clock.  
   $C(t) \= \\sin(\\frac{2\\pi}{24} (t \- \\phi))$

Performance decrement is proportional to $S(t) \+ C(t)$.  
Integration: In a Banister model, the fatigue decay constant $\\tau\_2$ is not fixed. It is a function of sleep quality.

$$\\tau\_2(n) \= \\tau\_{2,base} \\cdot (1 \+ \\beta \\cdot \\text{SleepDebt}\_n)$$

If Sleep Debt is high, $\\tau\_2$ increases, meaning fatigue lingers longer.8

### **9.2 Glycogen Dynamics: The Li Metabolic Module**

Fuel availability dictates the capacity to tolerate strain. The Li Metabolic Module provides ODEs for glycogen depletion.  
Rate of depletion depends on intensity ($W$):

$$\\frac{d\[Gly\]}{dt} \= \- k\_{cat} \\cdot (1 \+ \\alpha W (1 \- e^{-t/\\tau\_{met}})) \\cdot \[Gly\]$$

This equation models the acceleration of glycogenolysis as exercise intensity increases.  
**Integration**: This couples with the PerPot model. The capacity of the Strain Potential ($SP\_{max}$) is effectively the Glycogen store. As $\[Gly\]$ drops, $SP\_{max}$ decreases. This explains why a standard workout (load) causes "Overflow" (bonking/collapse) when performed in a glycogen-depleted state.9

### **9.3 The Psychobiological Model: Hysteresis Loops**

Finally, readiness is constrained by the brain. The **Psychobiological Model** posits that exhaustion is a decision based on **Rating of Perceived Exertion (RPE)** vs. **Motivation**.

Fatigue is not just physiological loss; it is RPE Drift. For the same power output $P$, RPE increases over time. This is quantified by the Hysteresis Area ($H\_{area}$) in a pyramidal test (ramp up, ramp down).

$$H\_{area} \= \\sum\_{P} (RPE\_{down}(P) \- RPE\_{up}(P))$$

A large positive area means the athlete perceives the same load as much harder during the decline—a marker of central fatigue accumulation.  
Integration: This acts as a gain dampener on the output.

$$Performance(t) \= (Fitness(t) \- Fatigue(t)) \\cdot \\text{Motivation}(t)$$

Where Motivation is suppressed by accumulated mental load (cognitive fatigue).10

## ---

**10\. Conclusion**

The mathematical modeling of endurance training has evolved from the elegant simplicity of Banister's linear convolution integrals to the complex, non-linear, and stochastic frameworks of the modern era. We now understand that the "black box" of the human body is time-varying (Busso), susceptible to chaotic overflow (PerPot), governed by fluid-dynamic bioenergetics (Hydraulic), and actively regulated by central and homeostatic controllers (Sleep/Psychobiology).

The future of high-performance engineering lies in the **Hybrid Model**: using Kalman filters to track the daily drift of fitness/fatigue states, while using Hydraulic equations to model minute-by-minute interval capacities, all constrained by the boundaries of sleep and nutrition. This mathematical synthesis transforms the athlete from a subject of intuition into a quantifiable, optimizable dynamical system.

---

| Model Framework | Governing Logic | Key Equation Structure | Parameter Type | Use Case |
| :---- | :---- | :---- | :---- | :---- |
| **Banister IR** | Linear Systems | Convolution/Recurrence | Static LTI ($\\tau, k$) | General periodization, Tapering |
| **Busso VDR** | Non-Linear Feedback | Time-varying Gain $k(t)$ | Dynamic ($\\tau\_3, \\alpha$) | Overtraining prevention, Non-linear response |
| **PerPot** | System Dynamics | Potentials & Overflow | Capacities & Delays | Modeling collapse, Shock microcycles |
| **Hydraulic** | Fluid Physics | Coupled ODEs (Flow/Pressure) | Tank Sizes ($W'$), Conductance | Critical Power, HIIT recovery, Pacing |
| **State-Space** | Stochastic Control | $x\_{k+1} \= Ax\_k \+ Bu\_k$ | Matrices ($A, B, K$) | Real-time tracking, Sensor fusion (HR+Power) |

**Citations**:.1

#### **Referências citadas**

1. The Science of the TrainingPeaks Performance Manager, acessado em janeiro 2, 2026, [https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/](https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/)  
2. Rationale and resources for teaching the mathematical modeling of athletic training and performance, acessado em janeiro 2, 2026, [https://journals.physiology.org/doi/pdf/10.1152/advan.00078.2011](https://journals.physiology.org/doi/pdf/10.1152/advan.00078.2011)  
3. The three-dimensional impulse-response model: Modeling the training process in accordance with energy system-specific adaptation \- arXiv, acessado em janeiro 2, 2026, [https://arxiv.org/pdf/2503.14841](https://arxiv.org/pdf/2503.14841)  
4. Modeling human performance in running \- PubMed, acessado em janeiro 2, 2026, [https://pubmed.ncbi.nlm.nih.gov/2246166/](https://pubmed.ncbi.nlm.nih.gov/2246166/)  
5. Variable Dose-Response Relationship between ... \- Paulo Gentil, acessado em janeiro 2, 2026, [https://www.paulogentil.com/pdf/Variable%20dose-response%20relationship%20between%20exercise%20training%20and%20performance.pdf](https://www.paulogentil.com/pdf/Variable%20dose-response%20relationship%20between%20exercise%20training%20and%20performance.pdf)  
6. PerPot – a meta-model and software tool for analysis and optimisation of load-performance-interaction \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/233607920\_PerPot\_a\_meta-model\_and\_software\_tool\_for\_analysis\_and\_optimisation\_of\_load-performance-interaction](https://www.researchgate.net/publication/233607920_PerPot_a_meta-model_and_software_tool_for_analysis_and_optimisation_of_load-performance-interaction)  
7. A hydraulic model outperforms work-balance models for predicting recovery kinetics from intermittent exercise \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/353818909\_A\_hydraulic\_model\_outperforms\_work-balance\_models\_for\_predicting\_recovery\_kinetics\_from\_intermittent\_exercise](https://www.researchgate.net/publication/353818909_A_hydraulic_model_outperforms_work-balance_models_for_predicting_recovery_kinetics_from_intermittent_exercise)  
8. Mathematical Models for Sleep-Wake Dynamics: Comparison of the Two-Process Model and a Mutual Inhibition Neuronal Model \- NIH, acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC4118955/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4118955/)  
9. A Modular Mathematical Model of Exercise-Induced Changes in ..., acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8508736/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8508736/)  
10. Hysteresis Area of Psychobiological Variables. A New Non-Invasive Biomarker of Effort Accumulation? \- INEFC \- Revista apunts, acessado em janeiro 2, 2026, [https://revista-apunts.com/en/hysteresis-area-of-psychobiological-variables-a-new-non-invasive-biomarker-of-effort-accumulation/](https://revista-apunts.com/en/hysteresis-area-of-psychobiological-variables-a-new-non-invasive-biomarker-of-effort-accumulation/)  
11. Assessing the limitations of the Banister model in monitoring training \- PMC \- NIH, acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC1974899/](https://pmc.ncbi.nlm.nih.gov/articles/PMC1974899/)  
12. 1 Bayesian inference of the impulse-response model of athlete training and performance 1 Kangyi Peng1,2, Ryan T. Brodie2,3,4, Ti \- Simon Fraser University, acessado em janeiro 2, 2026, [https://www.sfu.ca/\~tswartz/papers/impulse.pdf](https://www.sfu.ca/~tswartz/papers/impulse.pdf)  
13. Training load responses modelling and model generalisation in elite sports \- PMC \- NIH, acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8799698/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8799698/)  
14. Validity and Accuracy of Impulse-Response Models for Modeling and Predicting Training Effects on Performance of Swimmers \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/368542079\_Validity\_and\_Accuracy\_of\_Impulse-Response\_Models\_for\_Modeling\_and\_Predicting\_Training\_Effects\_on\_Performance\_of\_Swimmers](https://www.researchgate.net/publication/368542079_Validity_and_Accuracy_of_Impulse-Response_Models_for_Modeling_and_Predicting_Training_Effects_on_Performance_of_Swimmers)  
15. \[PDF\] Variable dose-response relationship between exercise training and performance., acessado em janeiro 2, 2026, [https://www.semanticscholar.org/paper/Variable-dose-response-relationship-between-and-Busso/0bd345f2702852b1f7f6a6b10b5f3c9d912fa482](https://www.semanticscholar.org/paper/Variable-dose-response-relationship-between-and-Busso/0bd345f2702852b1f7f6a6b10b5f3c9d912fa482)  
16. Modeling of performance and ANS activity for predicting future responses to training, acessado em janeiro 2, 2026, [https://pubmed.ncbi.nlm.nih.gov/25359446/](https://pubmed.ncbi.nlm.nih.gov/25359446/)  
17. Optimizing the Parameters of A Physical Exercise Dose-Response Model: An Algorithmic Comparison \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/347438920\_Optimizing\_the\_Parameters\_of\_A\_Physical\_Exercise\_Dose-Response\_Model\_An\_Algorithmic\_Comparison](https://www.researchgate.net/publication/347438920_Optimizing_the_Parameters_of_A_Physical_Exercise_Dose-Response_Model_An_Algorithmic_Comparison)  
18. PerPot – a meta-model and software tool for analysis and optimisation of load-performance-interaction (2004) | Jürgen Perl | 19 Citations \- SciSpace, acessado em janeiro 2, 2026, [https://scispace.com/papers/perpot-a-meta-model-and-software-tool-for-analysis-and-1tektsxxsk](https://scispace.com/papers/perpot-a-meta-model-and-software-tool-for-analysis-and-1tektsxxsk)  
19. PerPot: A metamodel for simulation of load performance interaction, acessado em janeiro 2, 2026, [https://www.tandfonline.com/doi/pdf/10.1080/17461390100071202](https://www.tandfonline.com/doi/pdf/10.1080/17461390100071202)  
20. The PerPot Simulated Anaerobic Threshold – A Comparison to Typical Lactate-based Thresholds \- Gutenberg Open Science, acessado em janeiro 2, 2026, [https://openscience.ub.uni-mainz.de/bitstreams/363a256d-ba8f-4a8f-b4f6-0471c0c07920/download](https://openscience.ub.uni-mainz.de/bitstreams/363a256d-ba8f-4a8f-b4f6-0471c0c07920/download)  
21. Computer Science in Sport \- National Academic Digital Library of Ethiopia, acessado em janeiro 2, 2026, [http://ndl.ethernet.edu.et/bitstream/123456789/42878/1/42.pdf](http://ndl.ethernet.edu.et/bitstream/123456789/42878/1/42.pdf)  
22. International Journal of Computer Science in Sport Volume 7/Edition 2 \- IACSS, acessado em janeiro 2, 2026, [https://iacss.org/wp-content/uploads/2024/09/IJCSS-Volume7\_Edition2.pdf](https://iacss.org/wp-content/uploads/2024/09/IJCSS-Volume7_Edition2.pdf)  
23. A Mathematical and computer simulation model of the running athlete \- Cambridge University Press & Assessment, acessado em janeiro 2, 2026, [https://www.cambridge.org/core/services/aop-cambridge-core/content/view/3F145663806E1C3831E9E7666AEB17FC/S0004972700002574a.pdf/mathematical\_and\_computer\_simulation\_model\_of\_the\_running\_athlete.pdf](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/3F145663806E1C3831E9E7666AEB17FC/S0004972700002574a.pdf/mathematical_and_computer_simulation_model_of_the_running_athlete.pdf)  
24. Critical power (CP) concept using Morton's hydraulic vessel analogy \[38\] \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/figure/Critical-power-CP-concept-using-Mortons-hydraulic-vessel-analogy-38-Energy-domains\_fig9\_338202390](https://www.researchgate.net/figure/Critical-power-CP-concept-using-Mortons-hydraulic-vessel-analogy-38-Energy-domains_fig9_338202390)  
25. The Application of Critical Power, the Work Capacity above Critical Power (W′), and Its Reconstitution: A Narrative Review of Current Evidence and Implications for Cycling Training Prescription \- MDPI, acessado em janeiro 2, 2026, [https://www.mdpi.com/2075-4663/8/9/123](https://www.mdpi.com/2075-4663/8/9/123)  
26. A New Pathway to Approximate Energy Expenditure and Recovery ..., acessado em janeiro 2, 2026, [https://arxiv.org/pdf/2104.07903](https://arxiv.org/pdf/2104.07903)  
27. (PDF) A hydraulic model outperforms work-balance models for predicting recovery kinetics from intermittent exercise \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/363524730\_A\_hydraulic\_model\_outperforms\_work-balance\_models\_for\_predicting\_recovery\_kinetics\_from\_intermittent\_exercise](https://www.researchgate.net/publication/363524730_A_hydraulic_model_outperforms_work-balance_models_for_predicting_recovery_kinetics_from_intermittent_exercise)  
28. Kalman Filtering \- MATLAB & Simulink \- MathWorks, acessado em janeiro 2, 2026, [https://www.mathworks.com/help/control/ug/kalman-filtering.html](https://www.mathworks.com/help/control/ug/kalman-filtering.html)  
29. International Journal of Computer Science in Sport Performance Estimation using the Fitness-Fatigue Model with Kalman Filter Fee, acessado em janeiro 2, 2026, [https://d-nb.info/1252868200/34](https://d-nb.info/1252868200/34)  
30. Bayesian inference of the impulse-response model of athlete training and performance, acessado em janeiro 2, 2026, [https://sportrxiv.org/index.php/server/preprint/view/246](https://sportrxiv.org/index.php/server/preprint/view/246)  
31. Predicting Peek Readiness-to-Train of Soccer Players Using Long Short-Term Memory Recurrent Neural Networks \- SciSpace, acessado em janeiro 2, 2026, [https://scispace.com/pdf/predicting-peek-readiness-to-train-of-soccer-players-using-2nu6o0cq33.pdf](https://scispace.com/pdf/predicting-peek-readiness-to-train-of-soccer-players-using-2nu6o0cq33.pdf)  
32. Predicting Peak Readiness-to-Train of Soccer Players Using Long Short-Term Memory Recurrent Neural Networks \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/335692147\_Predicting\_Peak\_Readiness-to-Train\_of\_Soccer\_Players\_Using\_Long\_Short-Term\_Memory\_Recurrent\_Neural\_Networks](https://www.researchgate.net/publication/335692147_Predicting_Peak_Readiness-to-Train_of_Soccer_Players_Using_Long_Short-Term_Memory_Recurrent_Neural_Networks)  
33. Prediction of Running Injuries from Training Load: a Machine Learning Approach. \- UPV, acessado em janeiro 2, 2026, [https://personales.upv.es/thinkmind/dl/conferences/etelemed/etelemed\_2017/etelemed\_2017\_10\_30\_48023.pdf](https://personales.upv.es/thinkmind/dl/conferences/etelemed/etelemed_2017/etelemed_2017_10_30_48023.pdf)  
34. Monitoring Variables Influence on Random Forest Models to Forecast Injuries in Short-Track Speed Skating \- Frontiers, acessado em janeiro 2, 2026, [https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.896828/full](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.896828/full)  
35. Machine learning approaches to injury risk prediction in sport: a scoping review with evidence synthesis \- PMC \- NIH, acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12013557/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12013557/)  
36. Individualized performance prediction of sleep-deprived individuals with the two-process model | Journal of Applied Physiology, acessado em janeiro 2, 2026, [https://journals.physiology.org/doi/full/10.1152/japplphysiol.00877.2007?utm\_source=TrendMD\&utm\_medium=cpc\&utm\_campaign=Journal\_of\_Applied\_Physiology\_TrendMD\_1](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00877.2007?utm_source=TrendMD&utm_medium=cpc&utm_campaign=Journal_of_Applied_Physiology_TrendMD_1)  
37. The psychobiological model: a new explanation to intensity regulation and (in)tolerance in endurance exercise \- SciELO, acessado em janeiro 2, 2026, [https://www.scielo.br/j/rbefe/a/WcpYxrMPvt6NQWQbHkDjtsz/?lang=en](https://www.scielo.br/j/rbefe/a/WcpYxrMPvt6NQWQbHkDjtsz/?lang=en)  
38. Hysteresis area of psychobiological variables. A new non-invasive biomarker of effort accumulation? \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/369730337\_Hysteresis\_area\_of\_psychobiological\_variables\_A\_new\_non-invasive\_biomarker\_of\_effort\_accumulation](https://www.researchgate.net/publication/369730337_Hysteresis_area_of_psychobiological_variables_A_new_non-invasive_biomarker_of_effort_accumulation)  
39. Validity and Reliability of Hydraulic-Analogy Bioenergetic Models in Sprint Roller Skiing, acessado em janeiro 2, 2026, [https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.726414/full](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.726414/full)  
40. An Improved Version of the Classical Banister Model to Predict Changes in Physical Condition \- ResearchGate, acessado em janeiro 2, 2026, [https://www.researchgate.net/publication/331230495\_An\_Improved\_Version\_of\_the\_Classical\_Banister\_Model\_to\_Predict\_Changes\_in\_Physical\_Condition](https://www.researchgate.net/publication/331230495_An_Improved_Version_of_the_Classical_Banister_Model_to_Predict_Changes_in_Physical_Condition)  
41. Research on prediction and evaluation algorithm of sports athletes performance based on neural network \- PMC \- NIH, acessado em janeiro 2, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11612954/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11612954/)  
42. Does Your Brain Control Fatigue? | Polar Global, acessado em janeiro 2, 2026, [https://www.polar.com/en/journal/central-governor-theory](https://www.polar.com/en/journal/central-governor-theory)  
43. Variable dose-response relationship between exercise training and performance \- PubMed, acessado em janeiro 2, 2026, [https://pubmed.ncbi.nlm.nih.gov/12840641/](https://pubmed.ncbi.nlm.nih.gov/12840641/)  
44. The W′ Balance Model: Mathematical and Methodological Considerations in \- Human Kinetics Journals, acessado em janeiro 2, 2026, [https://journals.humankinetics.com/view/journals/ijspp/16/11/article-p1561.xml](https://journals.humankinetics.com/view/journals/ijspp/16/11/article-p1561.xml)