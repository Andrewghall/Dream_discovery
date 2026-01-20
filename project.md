# Project Definition for Windsurf

## Non-overwrite rule (must follow)

NOTHING IN CODE CAN BE OVERWRITTEN. EXISTING FUNCTIONALITY IS FIXED AND CANNOT BE CHANGED OTHER THAN IN THE DIRECT AREA WE ARE ADDRESSING HERE.

This includes (but is not limited to):
- Discovery hemisphere
- Word cloud
- Spider diagram in discovery summaries
- Existing discovery summaries

If a change risks impacting existing functionality, stop and ask before proceeding.

---

## Overall Goal

Rebuild the live session functionality, including microphone input, real-time intent interpretation, and visualization in the hemisphere and spider diagrams. Ensure all previous functionality is preserved and that the system can track progress step-by-step.

---

## Step-by-Step Plan

### 1. Set Up Project Memory
Create or update the project memory file with the current project context. Include details on the live session goals, the `prelive` branch for Vercel deployments, and instructions that Windsurf should follow.

### 2. Restore Microphone Functionality
Start by ensuring the microphone input is correctly capturing audio.
- Confirm the correct input device is selected.
- Resume the `AudioContext` if needed.
- Verify that utterances appear in real time on the hemisphere.

### 3. Reimplement Intent Interpretation
After audio capture works, rebuild the logic for interpreting utterances into intents.
- Classify each utterance into categories like dreams, constraints, ideas, and assumptions.
- Map these intents to the five domains (People, Operations, Customer, Technology, Regulation).
- Store this logic in a new, clearly marked section of the code and not overwrite any previous stable code.

### 4. Populate the Hemisphere and Spider Diagrams
Ensure that each interpreted intent is visualized in the hemisphere and that the spider diagram updates in real time.
- Add nodes to the hemisphere based on the categorized intents.
- Update the spider diagram to reflect the distribution of insights across the five domains.
- Confirm that all visualizations match the interpreted data.

### 5. Implement a Step-by-Step Checklist
Use the checklist below to track progress.

### 6. Generate a Final Summary
At the end, produce a concise summary of the session’s insights based on the categorized intents. This summary should match the previously defined structure and be presented at the end of the session.

---

## Checklist (tick off as we go)

- [ ] Set up project memory file + rules confirmed
- [ ] Microphone input working
- [ ] Utterances appear live in hemisphere
- [ ] Utterances categorized into intents
- [ ] Intents mapped to domains (People / Ops / Customer / Tech / Regs)
- [ ] Hemisphere updated with intent nodes (without breaking discovery hemisphere)
- [ ] Spider diagram reflecting insights (without breaking discovery spider)
- [ ] Final summary generated in expected structure
