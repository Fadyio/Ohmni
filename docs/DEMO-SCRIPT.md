# OHMNI — Hackathon Demo Video Script & Storyboard

**Target Duration:** 2:15 (135 seconds) — Strictly under 3 minutes  
**Format:** YouTube Public Video with Narrated Voiceover (Audio Mandatory)  
**Resolution:** 1920×1080 (1080p60) or 1440×900  
**Tone:** Concise, technical, evidence-first, zero marketing fluff  

---

## Storyboard & Voiceover Timeline

### [0:00 – 0:08] Payoff First: Brownout vs Stable Rail
**Visual:**  
Split-screen payoff comparison from the final reveal:
- **LEFT (Before):** 2.72 V waveform collapse and red `BROWNOUT RESET` fault marker.
- **RIGHT (After):** 3.18 V stable trace under load with 0 resets.
- Text: *Ohmni: Agent-Native Hardware Diagnostic Workbench via WebMCP*.

**Voiceover:**  
> *"Coding agents can inspect software, but they cannot inspect the physical board on your desk. Here is the payoff: an AI agent diagnosing an electrical brownout down to 2.72 V, guiding a repair, and verifying 3.18 V rail stability under identical load."*

---

### [0:08 – 0:25] Native WebMCP Inspector & Registered Tools
**Visual:**  
Cut to the Ohmni lab interface in Google Chrome with the `Native WebMCP` badge glowing green. Open the WebMCP Developer Inspector drawer:
- Point out `document.modelContext.registerTool(...)` registrations.
- Highlight the active registered tool definitions:
  - `read_reset_history`
  - `measure_supply_voltage`
  - `run_relay_stress_test`
  - `propose_hypothesis`
  - `confirm_hypothesis`
- Close the inspector.

**Voiceover:**  
> *"These are real browser-native tools registered directly on document-dot-modelContext, not simulated buttons. The browser exposes structured hardware instruments to the agent runtime while managing safety boundaries."*

---

### [0:25 – 0:50] Live Groq Agent: Autonomous Passive Probing
**Visual:**  
Show top bar with **Groq Live** active.
- Start the deterministic virtual ESP32 challenge.
- The sealed symptom appears: *"Controller resets when fan starts."*
- Groq autonomously calls `read_reset_history`.
- Narrative timeline shows executed call: `read_reset_history (138 ms)`.
- Finding appears: past `BROWNOUT` resets logged in non-volatile memory.
- Groq autonomously calls `measure_supply_voltage`: nominal baseline reading of 3.31 V.

**Voiceover:**  
> *"We launch an unscripted investigation with a live Groq agent. Given only the symptom, the model autonomously probes passive instruments—reading the non-volatile reset history and baseline rail voltage—without interrupting us. It sees past brownout flags, but needs to test if the fan load causes the rail collapse."*

---

### [0:50 – 1:10] The Amber Safety Gate
**Visual:**  
Groq requests the mutating tool `run_relay_stress_test`.
- The screen transitions into the **Amber Safety Gate** (scene: `approval`).
- The schematic highlights the GPIO14 cooling fan relay in amber.
- The safety boundary is displayed: *500 ms maximum actuation • Auto-abort on reset*.
- Notice: the relay remains open; zero current flows until human approval.
- Click **[ Approve test ]**.

**Voiceover:**  
> *"When the agent requests an electrical load test, execution halts at the Amber Safety Gate. Passive reads execute autonomously, but physical actuation requires human consent. The browser blocks relay energization until I review the safety envelope and click Approve."*

---

### [1:10 – 1:30] Oscilloscope Fault Reproduction & Empirical Evidence
**Visual:**  
The main canvas activates the 60fps technical oscilloscope:
- Relay closes.
- Inrush current hits the shared rail: voltage drops from 3.31 V to 2.72 V.
- Waveform breaches the amber dashed line at **2.80 V reset threshold**.
- Hardware brownout detector trips: red fault marker `BROWNOUT RESET TRIGGERED`.
- Evidence tokens `E-001` (Reset log) and `E-002` (2.72 V dip) commit to the immutable ledger.
- Narrative rail updates: Groq registers Hypothesis `H-001` (*Relay-induced MCU supply brownout due to shared 3.3 V rail*).

**Voiceover:**  
> *"Watch the oscilloscope. Under load, the supply rail collapses to 2.72 V, crossing the 2.80 V brownout threshold and tripping an MCU hardware reset. The agent records empirical evidence tokens and diagnoses the root cause. But a hypothesis is not proof—it cannot claim the bug is fixed without retesting."*

---

### [1:30 – 1:45] Diagnosis & Human Intervention Request
**Visual:**  
Groq requests human intervention: *"Move jumper JP1 from the shared 3.3 V rail to the independent 5 V auxiliary rail."*
- Click **[ Proceed to Physical Repair ]**.
- In the virtual challenge workbench, the jumper selector displays options.

**Voiceover:**  
> *"The agent recognizes its physical limitation: it has no hands. It asks for human intervention to isolate the fan power. In our virtual challenge workbench, we move jumper JP1 from the shared 3.3 V rail to the independent 5 V auxiliary rail, then notify the agent."*

---

### [1:45 – 2:02] Virtual Jumper Change, Retest, & 3.18 V Stable Verification
**Visual:**  
- Select **Independent 5 V** on jumper selector.
- Click **[ Tell Agent I changed it ]**.
- Groq evaluates the observation and requests an empirical verification retest.
- Click **[ Approve test ]**.
- Oscilloscope executes the identical stress test under load.
- Voltage dips only to 3.18 V, staying well above the 2.80 V threshold with 0 resets.
- Final reveal unseals ground truth:
  - **Repair verified**
  - **DIAGNOSIS MATCH ✓**
  - Before: 2.72 V Brownout → After: 3.18 V Stable.

**Voiceover:**  
> *"The agent does not assume the repair worked. It requests the identical stress test under full load. This time, the rail stays stable at 3.18 V with zero resets. When we unseal the ground truth: confirmed diagnosis match."*

---

### [2:02 – 2:12] Connect Hardware: Web Serial & Physical Truthfulness
**Visual:**  
Quick cut to the landing page and the **Connect hardware** modal:
- Show Web Serial option: 115200 baud, NDJSON v1, device descriptor handshake.
- Show reference firmware folder: `firmware/ohmni-esp32-reference/`.

**Voiceover:**  
> *"The same device interface also supports real boards over Web Serial. The transport and protocol path are verified in Chrome with a simulated serial peer; electrical behavior still requires validation on an attached board."*

---

### [2:12 – 2:18] Value Proposition & Closing
**Visual:**  
Return to Ohmni logo and links:
- `https://ohmni-three.vercel.app`
- `https://github.com/Fadyio/Ohmni`

**Voiceover:**  
> *"The browser owns the device boundary and safety. The agent owns the investigation. The human owns physical consent and intervention. That's Ohmni. Thank you."*
