# OHMNI — Hackathon Demo Video Script & Storyboard

**Target Duration:** ~2:20–2:35 (Hard maximum: strictly under 3 minutes)
**Format:** YouTube Public Video with Narrated Voiceover (Audio Mandatory)  
**Resolution:** 1920×1080 (1080p60) or 1440×900  
**Tone:** Concise, technical, evidence-first, zero marketing fluff  
**Core Thesis:** Ohmni is NOT the agent. ChatGPT/external WebMCP agent is the agent. Ohmni is the hardware instrument layer, safety boundary, evidence system, and visual workbench.

---

## Storyboard & Voiceover Timeline

### [0:00 – 0:10] HOOK: The Physical Gap
**Visual:**  
Split view or side-by-side: ChatGPT desktop app on one side, Ohmni running at `https://ohmni-three.vercel.app` on the other. Click **[ Launch virtual diagnosis ]**. Point out the active WebMCP connection indicator.

**Voiceover:**  
> *"Coding agents can inspect software, but they cannot inspect the physical board on your desk. Ohmni gives them hardware instruments through WebMCP."*

---

### [0:10 – 0:25] Canonical Problem Prompt
**Visual:**  
Paste the canonical prompt into ChatGPT:
> *"There is a problem with this controller: it resets when the cooling fan turns on. Investigate the root cause using the available hardware instruments. Gather evidence before proposing a diagnosis. You may use read-only measurements autonomously, but ask for my approval before any actuation or physical change. If you identify a repair, ask me to perform it and then experimentally verify that the problem is fixed."*

**Voiceover:**  
> *"We give ChatGPT only the symptom. We give it permission to inspect autonomously, but require human authorization before any physical actuation."*

---

### [0:25 – 0:45] Passive Autonomous Probing: Instruments React Live
**Visual:**  
Watch the Ohmni workbench visibly react in real time as ChatGPT calls passive tools:
- ChatGPT calls `read_device_info`: board identity appears.
- ChatGPT calls `read_reset_history`: Reset history reveals 3 past `BROWNOUT` resets.
- ChatGPT calls `measure_supply_voltage`: 3.31 V nominal baseline measured.
- Right rail streams typed tool calls in the invocation ledger.

**Voiceover:**  
> *"ChatGPT isn't reading screenshots. It's calling typed instruments exposed by the page. It inspects the hardware registers and reset history, finding three past brownouts, and reads a nominal 3.31 volt baseline."*

---

### [0:45 – 1:05] Amber Safety Gate: Human Authorization
**Visual:**  
ChatGPT requests the mutating tool `run_relay_stress_test`.
- Ohmni's **Amber Safety Gate** immediately appears.
- Safety envelope displayed: *500 ms maximum actuation · Auto-abort on reset · Relay returns open automatically*.
- The relay remains safely open; zero load current flows.
- User clicks **[ Approve test ]**.

**Voiceover:**  
> *"Passive reads can execute autonomously. Physical actuation cannot. When the agent requests an electrical load test, the browser halts execution at the Amber safety gate until human approval is granted."*

---

### [1:05 – 1:25] Oscilloscope: 2.72 V Brownout Reset Reproduced
**Visual:**  
Oscilloscope trace activates:
- Relay closes, drawing inrush current.
- Voltage trace collapses from 3.31 V down to **2.72 V**.
- Crosses the amber dashed line at **2.80 V reset threshold**.
- Red fault badge triggers: `BROWNOUT RESET`. Relay safely springs open.
- Trace freezes at 2.72 V minimum sag.

**Voiceover:**  
> *"Under fan relay load, the shared rail sags to 2.72 V, breaching the 2.80 V brownout detector and resetting the MCU. The fault is reproduced experimentally and captured in the immutable evidence ledger."*

---

### [1:25 – 1:40] Evidence-Backed Diagnosis
**Visual:**  
ChatGPT calls `propose_hypothesis` (`H-001`):
- Working diagnosis: *Relay-induced MCU supply brownout due to shared 3.3 V rail*.
- Diagnosis links empirical citations (`E-001`, `E-002`) grounded in real measurement.
- Status: Needs physical verification.

**Voiceover:**  
> *"ChatGPT synthesizes an evidence-backed diagnosis: the relay coil shares the sensitive MCU supply rail instead of an independent supply. But a diagnosis alone is not proof—it must be repaired and verified."*

---

### [1:40 – 1:55] Human Intervention: "Your Agent Needs Your Hands"
**Visual:**  
ChatGPT calls `request_human_intervention`.
- Screen transitions to repair scene: **"Your agent needs your hands"**.
- Instruction: *Move the relay supply from the shared 3.3 V MCU rail to the independent 5 V supply.*
- User clicks **[ Simulate moving JP1 ]** (or physically moves the jumper on real hardware).
- Status changes: `✓ Hardware configuration changed · Waiting for the agent to verify the repair.`

**Voiceover:**  
> *"ChatGPT knows it has no physical hands. It asks the human operator to move jumper JP1 from the shared 3.3 V rail to the independent 5 V supply, isolating the coil from the MCU."*

---

### [1:55 – 2:15] Retest Request & 3.18 V Stable Verification
**Visual:**  
- ChatGPT requests the identical verification stress test: `run_relay_stress_test`.
- Amber gate appears; user clicks **[ Authorize & Energize ]**.
- Retest executes under full load:
  - Voltage sags only to **3.18 V** (well above the 2.80 V reset threshold).
  - Resets: 0. Relay returns safely open.
  - Scene immediately displays empirical result: `Retest passed · rail stable at 3.18 V · Awaiting agent confirmation`.
  - Right rail displays verification pending.

**Voiceover:**  
> *"ChatGPT doesn't assume the repair worked. It requests the identical load test to verify. This time, the rail remains stable at 3.18 V with zero resets. The empirical test passed; now the agent confirms the hypothesis."*

---

### [2:15 – 2:25] Final Reveal: Repair Verified & Diagnosis Match
**Visual:**  
ChatGPT calls `confirm_hypothesis`.
The screen unseals the final comparison:
- **REPAIR VERIFIED**
- **DIAGNOSIS MATCH ✓**
- Before: 2.72 V Brownout → After: 3.18 V Stable
- **SEALED VIRTUAL GROUND TRUTH**: Relay Supply Misconfiguration
- **AGENT DIAGNOSIS**: Relay-induced MCU supply brownout
- Right rail: **COMPLETED**

**Voiceover:**  
> *"ChatGPT calls confirm hypothesis. Ground truth unseals: confirmed diagnosis match. The repair is empirically verified."*

---

### [2:25 – 2:35] Physical Hardware Path & Honest Closing
**Visual:**
Quick 8-second shot of landing page clicking **[ Connect hardware ]**:
- Web Serial modal: 115200 baud, NDJSON v1, dynamic descriptor handshake.
- Open-source ESP32 reference firmware in `firmware/ohmni-esp32-reference/`.
- Return to Ohmni logo at `https://ohmni-three.vercel.app`.

**Voiceover:**
> *"The same instrument interface connects to real boards over Web Serial. Web Serial protocol path is implemented and tested with a simulated serial peer; physical electrical validation remains future work. That's Ohmni. Thank you."*
