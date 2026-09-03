# OHMNI — Hackathon Demo Video Script & Storyboard

**Target Duration:** 2:10 (130 seconds) — Strictly under 3 minutes  
**Format:** YouTube Public Video with Narrated Voiceover (Audio Mandatory)  
**Resolution:** 1920×1080 (1080p60) or 1440×900  
**Tone:** Concise, technical, evidence-first, zero marketing fluff  

---

## Storyboard & Voiceover Timeline

### [0:00 – 0:10] Hook & Immediate Payoff
**Visual:**  
Split-screen payoff comparison from the final reveal:  
- **LEFT (Before):** 2.72 V waveform collapse and BROWNOUT RESET marker.  
- **RIGHT (After):** 3.18 V stable line with zero resets under load.  
- Subtitle: *Ohmni: Agent-Native Hardware Diagnostic Workbench*.  

**Voiceover:**  
> *"Coding agents can debug software, but they lose visibility when the bug crosses into hardware. Ohmni lets a browser expose hardware diagnostic instruments directly to agents through WebMCP."*

---

### [0:10 – 0:25] Exposing Native WebMCP
**Visual:**  
Cut to the Ohmni lab interface in Google Chrome with the `Native WebMCP` badge glowing green. Open the Developer Inspector modal:  
- Display `await document.modelContext.getTools()`.  
- Highlight the real registered tool definitions:  
  - `read_reset_history`  
  - `measure_supply_voltage`  
  - `run_relay_stress_test`  
  - `propose_hypothesis`  
- Close inspector.  

**Voiceover:**  
> *"These are real document-dot-modelContext tools registered directly in the browser, not buttons pretending to be agent actions. Today we run this on a virtual ESP32 reference board, using the exact same adapter architecture designed for physical Web Serial hardware."*

---

### [0:25 – 0:55] Live Groq Agent Investigation
**Visual:**  
Show the top bar with **Groq Live** active.  
- Click **[ Start investigation ]** on the center canvas.  
- The narrative rail updates in real time as Groq receives the blind symptom: *"Controller resets when the fan turns on."*  
- Groq autonomously calls `read_reset_history`.  
- The timeline records the executed event: `read_reset_history (142 ms)`.  
- The rail displays the findings: past `BROWNOUT` resets detected in non-volatile logs.  
- Groq next calls `measure_supply_voltage`, noting a nominal baseline of 3.31 V.  

**Voiceover:**  
> *"We launch a blind investigation with a live Groq agent. The model receives only the symptom. It autonomously begins probing passive instruments—reading reset history and baseline voltage—without interrupting us. It notices past brownout records, but needs to test whether the cooling fan load actually collapses the power rail."*

---

### [0:55 – 1:15] The Amber Safety Gate
**Visual:**  
Groq requests the tool `run_relay_stress_test`.  
- The screen transitions into the **Amber Safety Gate** (scene: `approval`).  
- The schematic highlights the GPIO14 cooling fan relay in amber.  
- The safety boundary is clearly displayed: *500 ms maximum actuation • Auto-abort on reset*.  
- Notice: the relay remains open; zero current flows until human approval.  
- Click **[ Approve test ]** (or press key `A`).  

**Voiceover:**  
> *"This is the Amber Safety Gate: our signature safety boundary. Passive reads execute autonomously, but physical side effects require human consent. The browser blocks the relay actuation until I verify the safety envelope and click Approve."*

---

### [1:15 – 1:35] Empirical Fault Reproduction
**Visual:**  
The main canvas activates the 60fps technical oscilloscope:  
- The relay closes.  
- As inductive inrush current hits the shared rail, the voltage trace plummets from 3.31 V to 2.72 V.  
- The waveform crosses the amber dashed line labeled **2.80 V reset threshold**.  
- The MCU hardware brownout detector trips: red fault marker `BROWNOUT RESET TRIGGERED`.  
- Evidence tokens `E-001` (Reset log) and `E-002` (Voltage dip to 2.72 V) appear in the ledger.  
- The narrative rail updates to **DIAGNOSIS FORMED**: Groq registers Hypothesis `H-001` (*Relay-induced MCU supply brownout due to shared 3.3 V rail*).  

**Voiceover:**  
> *"Watch the oscilloscope. Under load, the supply collapses to 2.72 V, breaching the 2.80 V reset threshold and triggering a hardware brownout. The agent records empirical evidence tokens and diagnoses the root cause. But notice: a hypothesis is not proof. It cannot claim the bug is fixed without physical repair."*

---

### [1:35 – 1:50] The Human Collaboration Loop
**Visual:**  
Groq requests human intervention: *"Move jumper JP1 from the shared 3.3 V rail to the independent 5 V auxiliary rail."*  
- Click **[ Proceed to Physical Repair ]**.  
- The coherent shared shell opens: header remains *ESP32-S3 Environmental Controller (Virtual)*.  
- Click **Independent 5 V** on the jumper selector.  
- Click **[ Tell Agent I changed it ]**.  

**Voiceover:**  
> *"The agent recognizes its physical limitation: it has no hands. It asks for physical intervention. In the shared repair workbench, I toggle jumper JP1 from the shared 3.3 V rail to an independent 5 V rail, then notify the agent."*

---

### [1:50 – 2:05] Retest & Empirical Verification
**Visual:**  
Groq re-evaluates the repair and requests an empirical re-test.  
- Click **[ Approve test ]** for the verification run.  
- The verification oscilloscope executes the identical relay stress test.  
- The voltage dips briefly to 3.18 V, staying well above the 2.80 V threshold.  
- Zero resets occur.  
- The screen transitions to the final reveal:  
  - **Repair verified**  
  - **DIAGNOSIS MATCH ✓**  
  - Before: 2.72 V Brownout → After: 3.18 V Stable.  
  - Click **View evidence trail** to reveal the linked empirical records.  

**Voiceover:**  
> *"Groq does not assume the repair worked. It reruns the exact same physical stress test under identical load. This time, the rail stays at a rock-solid 3.18 V with zero resets. When we unseal the ground truth: exact diagnosis match."*

---

### [2:05 – 2:15] Closing
**Visual:**  
Return to Ohmni logo and GitHub repository / live production URL:  
- `https://ohmni-three.vercel.app`  
- `https://github.com/Fadyio/Ohmni`  

**Voiceover:**  
> *"The browser owns the device boundary and safety. The agent owns the investigation. The human owns physical consent and intervention. That's Ohmni. Thank you."*
