# OHMNI — 3-Minute Hackathon Demo Video Script & Storyboard

**Target Duration:** 2:40 (160 seconds)  
**Tone:** Confident, technical, crisp, evidence-first.  
**Resolution:** 1920×1080 (1080p60) or 1440×900 Retina.  
**Audio:** Clear voiceover with subtle lab background sound.

---

### [0:00 – 0:20] The Hook: The Physical Blind Spot

**Visual:**  
Camera starts on a physical microcontroller board on a workbench, then cuts to a developer asking an AI coding assistant to debug it. The assistant shows code snippets, but cannot interact with the actual hardware.

**Voiceover:**  
*"AI coding agents can debug software, refactor services, and write unit tests. But when code meets the physical world—an IoT controller, a motor driver, a sensor board—AI is completely blind. It cannot touch the device sitting on your desk. WebMCP changes that."*

---

### [0:20 – 0:45] What is WebMCP?

**Visual:**  
Cut to the Ohmni landing screen. Show the restrained 3D OHMNI wordmark, the light precision workbench, and the native WebMCP indicator badge in Google Chrome. Open Developer Inspector briefly to show `document.modelContext` exposing 19 live hardware instruments.

**Voiceover:**  
*"This is Ohmni: a browser-native AI hardware investigation lab. A remote MCP server can reach your cloud database. WebMCP reaches the hardware connected to your browser. By exposing browser-owned diagnostic instruments directly through document-dot-modelContext, Gemini can safely inspect, actuate, and verify real devices."*

---

### [0:45 – 1:10] The Blind Mystery Challenge

**Visual:**  
Click **[ Start Mystery Diagnosis ]**.  
The Mystery Challenge modal appears:  
- **Mystery Device #A7F2**  
- **Symptom:** *"The controller unexpectedly restarts when the cooling fan turns on."*  
- **Sealed Ground Truth:** 🔒 *"Ground truth hidden outside model and tool context."*  
Click **[ Begin Investigation ]**.

**Voiceover:**  
*"To prove this isn't scripted, we run a blind challenge. A fault has been injected into this controller. Neither I nor Gemini has been told what it is. The ground truth is sealed outside the agent's context."*

---

### [1:10 – 1:35] Autonomous Observation & The Amber Safety Gate

**Visual:**  
Gemini begins investigating.  
1. Gemini autonomously queries `read_device_info` and `read_reset_history`. The narrative rail highlights the tool execution, and the Observing Scene displays past BROWNOUT reset entries.  
2. Gemini decides to test the hypothesis under load and requests `run_relay_stress_test`.  
3. The screen shifts to the **Amber Safety Gate**:  
   - Large physical relay highlighted in amber.  
   - Safety envelope: *"Maximum actuation 500ms • Automatic abort on reset."*  
   - Click **[ Approve test ]** (or press key `A`).

**Voiceover:**  
*"Gemini begins with passive observation—reading device configuration and reset registers without asking for approval. It notices past brownout flags. But when it wants to physically cycle the high-load cooling fan relay, the browser's safety boundary engages. Physical actuation requires human consent. I approve."*

---

### [1:35 – 2:00] Live Oscilloscope & Hypothesis Synthesis

**Visual:**  
The main surface expands into the hero 60fps technical oscilloscope.  
1. The relay armature moves with a tactile click.  
2. The blue trace samples the supply rail in real time. The voltage collapses from 3.31V down to 2.72V, crossing the 2.80V threshold.  
3. A red fault marker illuminates: `BROWNOUT RESET TRIGGERED`.  
4. Evidence tokens `E-001` and `E-002` animate into the ledger.  
5. Gemini proposes Hypothesis `H-001`: *"Relay-induced supply brownout on 3.3V rail."* (HIGH Confidence, citing E-001 and E-002).

**Voiceover:**  
*"Watch the live telemetry. The relay coil inrush current pulls the MCU supply rail below the 2.80V safe threshold, reproducing the reset. Gemini records empirical evidence tokens and elevates its hypothesis to High confidence. But notice: it does not claim the bug is fixed. A hypothesis is not proof."*

---

### [2:00 – 2:20] The Human Collaboration Loop

**Visual:**  
Gemini requests human intervention: *"I need your hands. Relocate jumper JP1 from shared 3.3V to the external 5V auxiliary rail."*  
Click **[ Proceed to physical verification & repair ]**.  
The Repair Verification scene mounts:  
- Click **External 5 V** jumper toggle.  
- Click **[ Tell Gemini I changed it ]**.

**Voiceover:**  
*"Gemini recognizes its own physical limitation. It cannot reach out and move a wire. It asks for my hands. In the repair workbench, I toggle jumper JP1 from the shared 3.3V rail to the external 5V auxiliary supply, and notify the agent."*

---

### [2:20 – 2:40] Experimental Verification & Ground Truth Reveal

**Visual:**  
1. Gemini immediately requests a post-intervention re-test (`run_relay_stress_test`).  
2. Click **[ Approve Retest ]**.  
3. The split-screen oscilloscope renders the comparison:  
   - **BEFORE:** 2.72V minimum, BROWNOUT.  
   - **AFTER:** 3.18V minimum, STABLE, 0 resets.  
4. Gemini calls `confirm_hypothesis`.  
5. Ground truth is unsealed:  
   - **GROUND TRUTH:** Relay powered from shared 3.3V microcontroller rail.  
   - **AGENT DIAGNOSIS:** Relay-induced MCU supply brownout.  
   - **MATCH ✓** — Repair Experimentally Verified.

**Voiceover:**  
*"Gemini does not guess. It reruns the exact same physical stress test on the reconfigured system. This time, the rail stays at a rock-solid 3.18V with zero resets. Gemini confirms the repair. And when we unseal the ground truth: exact match. An autonomous AI agent, live browser instruments, human hands, and verifiable truth."*

---

### [2:40 – 2:50] The Closer

**Visual:**  
Return to the Ohmni logo and GitHub repository link.

**Voiceover:**  
*"A remote MCP server can reach your cloud. WebMCP can reach the device on your desk. That's Ohmni. Thank you."*
