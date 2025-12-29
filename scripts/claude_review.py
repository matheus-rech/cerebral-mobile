#!/usr/bin/env python3
"""Use Claude API to review and fix CEREBRAL Mobile code."""
import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Read key files
files_to_review = [
    "app/(tabs)/index.tsx",
    "app/analysis.tsx", 
    "app/viewer-3d.tsx",
    "components/niivue-viewer.tsx",
    "services/huggingface.ts",
    "services/dicom-parser.ts",
]

code_content = ""
for f in files_to_review:
    path = f"/home/ubuntu/cerebral-mobile/{f}"
    if os.path.exists(path):
        with open(path, "r") as file:
            code_content += f"\n\n=== {f} ===\n{file.read()}"

prompt = f"""You are a senior React Native/Expo developer. Review this CEREBRAL Mobile brain MRI analysis app code and identify ALL issues that would prevent buttons from working or cause crashes.

The app should:
1. Load brain MRI images from HuggingFace datasets
2. Support DICOM file upload
3. Show 3D brain viewer with axial/coronal/sagittal slice sliders
4. Navigate to analysis screen when user taps a dataset

CODE TO REVIEW:
{code_content}

PROVIDE:
1. List of ALL bugs/issues found (be specific with line numbers)
2. COMPLETE FIXED CODE for each file that has issues
3. Focus on: button handlers, navigation, async/await, imports

Output the fixed code in full - do not truncate."""

print("Sending to Claude for review...")
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8000,
    messages=[{"role": "user", "content": prompt}]
)

print("\n" + "="*60)
print("CLAUDE CODE REVIEW RESULTS")
print("="*60)
print(message.content[0].text)

# Save results
with open("/home/ubuntu/cerebral-mobile/CLAUDE_REVIEW.md", "w") as f:
    f.write(message.content[0].text)
print("\nReview saved to CLAUDE_REVIEW.md")
