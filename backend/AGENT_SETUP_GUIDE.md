# LlamaCloud Agent Setup Guide for FIR Extraction

This guide walks you through creating your own FIR extraction agent in LlamaCloud that matches the behavior of the website's agent.

## Overview

Your backend code (`app.py`) uses `LlamaExtract` to call an agent configured in LlamaCloud. The agent must be:
- Named exactly as specified in your `.env` file (`FIR_AGENT_NAME`)
- Configured to output JSON matching the `FIR_SCHEMA` structure
- Set up with Urdu OCR capabilities (GPT-4o recommended)
- Given detailed parsing instructions for FIR documents

## Step 1: Access LlamaCloud Dashboard

1. Go to https://cloud.llamaindex.ai
2. Log in with the account that owns your `LLAMA_CLOUD_API_KEY`
3. Navigate to **Agents** or **Extraction Agents** section

## Step 2: Create New Extraction Agent

1. Click **"Create New Agent"** or **"New Extraction Agent"**
2. Choose **"Structured Extraction"** or **"JSON Extraction"** type
3. Name your agent (e.g., `FIR_TextExtraction` or any name you prefer)

**Important**: The name you choose here must match what you set in `SpecterApp/backend/.env` as `FIR_AGENT_NAME`.

## Step 3: Configure Agent Output Format

1. **Output Type**: Select **JSON** (not plain text)
2. **Schema**: Paste the JSON schema from `fir_schema.json` into the schema field
   - This tells the agent exactly what structure to output
   - The schema defines `raw_urdu_text` and `fir_structured_data` with all nested fields

## Step 4: Configure OCR Model (Critical for Urdu)

1. **Enable Multimodal/Vision Model**: Turn ON
2. **Model Selection**: Choose **GPT-4o** (best for Urdu) or **GPT-4o-mini** (cheaper alternative)
3. **Language**: Set to **Urdu ("ur")**
4. **Vendor API Key**: If using GPT-4o, you may need to provide your OpenAI API key here (separate from LlamaCloud key)

**Why GPT-4o?**
- Superior Urdu OCR compared to basic OCR engines
- Understands context and document layout
- Handles both printed and handwritten Urdu text
- Preserves diacritics and special characters

## Step 5: Add Parsing Instructions

In the **"Parsing Instructions"** or **"System Prompt"** field, add detailed instructions like:

```
You are extracting structured data from Urdu FIR (First Information Report) documents.

REQUIREMENTS:
1. Extract the complete Urdu text exactly as it appears in the document (preserve all characters, diacritics, and formatting)
2. Parse the following structured fields from the Urdu text:

FIELD MAPPING:
- FIR Number: Look for patterns like "FIR No.", "فارم نمبر", or similar
- Police Station: Look for "تھانہ", "پولیس سٹیشن", or station names
- District: Look for "ضلع", district names
- Registration Date/Time: Extract dates and times in standard format
- Sections of Law: Extract law section numbers (e.g., "376 تپ", "302 تپ")
- Complainant Details:
  - Name: Look for "مدعی", "شاکی", complainant names
  - Father/Husband Name: Usually follows the name
  - Address: Full address in Urdu
  - Contact: Phone numbers if present
- Accused Details: Look for "مجرم", "ملزم", accused names and details (can be multiple)
- Occurrence Details:
  - Date/Time: When the incident occurred
  - Place: Location of occurrence
  - Distance: Distance from police station if mentioned
- Brief Facts: The narrative description of the case
- Witnesses: Look for "گواہ", witness names and details
- Investigating Officer: Officer name, rank, badge number

URDU CHARACTER PRESERVATION:
- Preserve all Urdu characters exactly as they appear
- Maintain proper Urdu punctuation (۔ for period, ، for comma, ؟ for question mark)
- Do not transliterate Urdu to English
- Keep all diacritics and special characters

OUTPUT FORMAT:
Return a JSON object with:
- "raw_urdu_text": The complete extracted Urdu text
- "fir_structured_data": An object containing all the structured fields above

If a field is not found in the document, use null or empty string as appropriate.
```

## Step 6: Configure Advanced Settings

1. **Temperature**: 0.0-0.2 (lower = more deterministic, better for structured extraction)
2. **Max Tokens**: Sufficient for complete FIR text (e.g., 4000-8000)
3. **Retry Logic**: Enable automatic retries for failed extractions
4. **Validation**: Enable JSON schema validation to ensure output matches structure

## Step 7: Save and Test

1. **Save** the agent configuration
2. **Note the agent name** (or agent ID if provided)
3. Update your `.env` file with the agent name:

```env
LLAMA_CLOUD_API_KEY=your_key_here
FIR_AGENT_NAME=your_agent_name_here
```

## Step 8: Verify Agent in Backend

1. Start your backend:
   ```bash
   cd ~/Downloads/SpecterApp/backend
   source venv/bin/activate
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

2. Test the agent connection:
   ```bash
   curl http://localhost:8000/
   ```

3. If you see the API response, the backend is running. The agent will be tested when you upload a file.

## Troubleshooting

### Error: "Agent not found"
- Verify `FIR_AGENT_NAME` in `.env` matches the exact name in LlamaCloud dashboard
- Check that you're logged into the correct LlamaCloud account
- Ensure the agent is saved and published (not in draft mode)

### Error: "Agent returned invalid JSON"
- Check that the agent's output format is set to JSON
- Verify the schema in LlamaCloud matches `fir_schema.json`
- Review parsing instructions for clarity

### Poor Urdu OCR Quality
- Ensure GPT-4o (or GPT-4o-mini) is enabled as the vision model
- Set language to Urdu ("ur")
- Upload higher resolution images (minimum 1200px width recommended)
- Check that OpenAI API key is provided if required by GPT-4o

### Missing Fields in Output
- Review and enhance parsing instructions with more Urdu keyword examples
- Test with a known-good FIR image to verify extraction
- Check that the schema includes all fields you need

## Schema Reference

The complete schema is available in `fir_schema.json`. Key fields:

- **Top level**: `raw_urdu_text` (string), `fir_structured_data` (object)
- **Structured fields**: FIR number, police station, district, dates, complainant, accused (array), occurrence, brief facts, witnesses (array), investigating officer

## Cost Optimization

- **GPT-4o**: ~$0.10-0.30 per FIR (best quality)
- **GPT-4o-mini**: ~$0.04-0.12 per FIR (60% cheaper, slightly lower quality)
- Each extraction uses **one agent call** (~20 credits in LlamaCloud terms)

## Next Steps

After creating the agent:

1. Update `SpecterApp/backend/.env` with your agent name
2. Restart the backend server
3. Test with a sample FIR image from your mobile app
4. Compare output with the website to verify parity

## Support

If you encounter issues:
- Check LlamaCloud dashboard for agent status and logs
- Review backend terminal output for detailed error messages
- Verify all environment variables are set correctly
- Ensure your LlamaCloud account has sufficient credits
