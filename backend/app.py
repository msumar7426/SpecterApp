import os
import re
import nest_asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from llama_cloud_services import LlamaExtract
from dotenv import load_dotenv
import tempfile
import json

# Load environment variables
load_dotenv()

# Apply nest_asyncio only when running on the standard asyncio loop (uvloop can't be patched).
import asyncio
try:
    loop = asyncio.get_event_loop()
    is_uvloop = loop and loop.__class__.__module__.startswith("uvloop")
    if not is_uvloop:
        nest_asyncio.apply()
except Exception:
    nest_asyncio.apply()


# No spell checker - LlamaCloud agent handles everything
# This saves you from additional processing and costs


# Initialize FastAPI app
app = FastAPI(title="LlamaCloud Text Extractor")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize LlamaExtract with API key
LLAMA_CLOUD_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY")

# Initialize the extractor
extractor = LlamaExtract(api_key=LLAMA_CLOUD_API_KEY)

# FIR Extraction Schema (for reference)
FIR_SCHEMA = {
    "type": "object",
    "properties": {
        "raw_urdu_text": {
            "type": "string",
            "description": "The complete, unedited Urdu text extracted directly from the FIR image via OCR, preserving all characters and formatting as much as possible."
        },
        "fir_structured_data": {
            "type": "object",
            "properties": {
                "fir_number": {"type": "string"},
                "police_station": {"type": "string"},
                "district": {"type": "string"},
                "registration_date": {"type": "string"},
                "registration_time": {"type": "string"},
                "sections_of_law": {"type": "array", "items": {"type": "string"}},
                "complainant_details": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "father_or_husband_name": {"type": "string"},
                        "address": {"type": "string"},
                        "contact_number": {"type": ["string", "null"]}
                    }
                },
                "accused_details": {
                    "type": ["array", "null"],
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": ["string", "null"]},
                            "father_or_husband_name": {"type": ["string", "null"]},
                            "address": {"type": ["string", "null"]},
                            "description": {"type": ["string", "null"]}
                        }
                    }
                },
                "occurrence_details": {
                    "type": "object",
                    "properties": {
                        "date_of_occurrence": {"type": "string"},
                        "time_of_occurrence": {"type": "string"},
                        "place_of_occurrence": {"type": "string"},
                        "distance_from_police_station": {"type": ["string", "null"]}
                    }
                },
                "brief_facts_of_case": {"type": "string"},
                "witnesses": {
                    "type": ["array", "null"],
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "father_or_husband_name": {"type": ["string", "null"]},
                            "address": {"type": "string"}
                        }
                    }
                },
                "investigating_officer_details": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "rank": {"type": "string"},
                        "badge_number": {"type": ["string", "null"]}
                    }
                }
            }
        }
    },
    "required": ["raw_urdu_text", "fir_structured_data"]
}

# Agent name for FIR extraction - read from .env, fallback to default
FIR_AGENT_NAME = os.getenv("FIR_AGENT_NAME", "FIR_TextExtraction")

# No spell checker needed - agent handles everything


async def extract_text_with_llamaindex(file_path: str) -> dict:
    """
    Extract structured FIR data from file using LlamaExtract Agent
    
    NOTE: This function makes ONLY ONE agent.extract() call (~20 credits)
    If you're seeing 60-70 credits usage, check your LlamaCloud agent configuration
    """
    try:
        print(f"🔍 LlamaExtract starting extraction for: {file_path}")
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            print(f"❌ ERROR: File does not exist at {abs_path}")
            raise FileNotFoundError(f"File not found: {abs_path}")
            
        # Get the FIR extraction agent
        agent = extractor.get_agent(name=FIR_AGENT_NAME)
        
        if agent is None:
            raise HTTPException(status_code=500, detail=f"Agent '{FIR_AGENT_NAME}' not found")
        
        print(f"🤖 Using agent: {FIR_AGENT_NAME}")
        print(f"⚡ Making SINGLE extraction call (should use ~20 credits)")
        
        # ⚠️ THIS IS THE ONLY PLACE WE CALL THE AGENT - ONE TIME ONLY
        result = agent.extract(abs_path)
        
        if not result or not result.data:
            print("❌ LlamaExtract returned no data")
            raise HTTPException(status_code=400, detail="No data could be extracted from the file")
        
        print(f"✅ LlamaExtract successfully extracted data")
        
        # Parse the result data (agent returns structured JSON)
        extracted_data = result.data
        
        # If it's a string, parse it as JSON
        if isinstance(extracted_data, str):
            extracted_data = json.loads(extracted_data)
        
        # Ensure we have the required structure
        if not isinstance(extracted_data, dict):
            extracted_data = {'raw_urdu_text': str(extracted_data), 'fir_structured_data': None}
        
        return extracted_data
        
    except Exception as e:
        print(f"❌ LlamaExtract error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"LlamaExtract extraction failed: {str(e)}")


@app.get("/")
async def root():
    return {
        "message": "LlamaCloud Text Extractor API",
        "version": "2.0",
        "urdu_support": True
    }


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload FIR image and extract structured data
    
    CREDIT USAGE BREAKDOWN:
    - LlamaExtract Agent: ~20 credits (ONLY ONE CALL)
    - Urdu Spell Checker: FREE (FuzzyWuzzy - runs locally, no API costs)
    
    If seeing 60-70 credits: Check your LlamaCloud agent's internal configuration
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Read file content
    content = await file.read()
    
    # Create a local temp directory within the project
    upload_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Create a unique filename to avoid collisions
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    safe_filename = "".join([c if c.isalnum() or c in ".-_" else "_" for c in file.filename])
    tmp_file_path = os.path.join(upload_dir, f"{timestamp}_{safe_filename}")
    
    try:
        # Write content and close the file handle
        with open(tmp_file_path, "wb") as f:
            f.write(content)
        
        # Verify file exists and has content
        if not os.path.exists(tmp_file_path):
            raise HTTPException(status_code=500, detail="Failed to save uploaded file locally")
        
        # 🔥 SINGLE AGENT CALL - Extract structured data using LlamaIndex Cloud (~20 credits)
        abs_file_path = os.path.abspath(tmp_file_path)
        extracted_data = await extract_text_with_llamaindex(abs_file_path)
        
        # Get raw text from extraction (already processed by agent)
        raw_text = extracted_data.get('raw_urdu_text', '')
        
        # Return data as-is from agent - NO additional processing needed
        return {
            "filename": file.filename,
            "file_size": len(content),
            "extracted_data": extracted_data,
            "raw_urdu_text": raw_text,
            "corrected_urdu_text": raw_text,  # Agent already handles corrections
            "fir_structured_data": extracted_data.get('fir_structured_data'),
            "corrections_applied": False,
            "correction_stats": {
                "note": "Configure your LlamaCloud agent to handle spell/grammar corrections",
                "agent_handles_correction": True
            },
            "timestamp": datetime.now().isoformat(),
            "extraction_type": "structured_fir",
            "credit_info": {
                "agent_calls": 1,
                "spell_checker": "Agent handles everything",
                "expected_credits": "~20 credits (agent does both extraction + correction)"
            }
        }
    
    except Exception as e:
        # Log the error for more debugging information
        print(f"❌ Error during upload/processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Clean up temporary file
        try:
            if tmp_file_path and os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)
        except Exception as cleanup_err:
            print(f"⚠️ Warning: Failed to clean up temp file {tmp_file_path}: {cleanup_err}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
