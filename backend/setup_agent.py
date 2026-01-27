"""
Setup Script: Create FIR_TextExtraction Agent in LlamaCloud
============================================================
Run this ONCE to create the extraction agent in your LlamaCloud account.

Usage:
    cd /Users/mac/Downloads/SpecterApp/backend
    source venv/bin/activate
    python setup_agent.py
"""

import os
from dotenv import load_dotenv
from llama_cloud_services import LlamaExtract

# Load environment variables
load_dotenv()

LLAMA_CLOUD_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY")
if not LLAMA_CLOUD_API_KEY:
    raise ValueError("LLAMA_CLOUD_API_KEY not found in .env file")

# Agent configuration
AGENT_NAME = "FIR_TextExtraction"

# FIR Document Schema - defines what data to extract
FIR_SCHEMA = {
    "type": "object",
    "properties": {
        "raw_urdu_text": {
            "type": "string",
            "description": "Complete unedited Urdu text extracted via OCR from the FIR document. Preserve all characters, diacritics, and formatting exactly as they appear in the image."
        },
        "fir_structured_data": {
            "type": "object",
            "properties": {
                "fir_number": {
                    "type": "string",
                    "description": "FIR registration number"
                },
                "police_station": {
                    "type": "string",
                    "description": "Name of the police station"
                },
                "district": {
                    "type": "string",
                    "description": "District name"
                },
                "registration_date": {
                    "type": "string",
                    "description": "Date of FIR registration"
                },
                "registration_time": {
                    "type": "string",
                    "description": "Time of FIR registration"
                },
                "sections_of_law": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Applicable sections of law (e.g., PPC sections)"
                },
                "complainant_details": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "father_or_husband_name": {"type": "string"},
                        "address": {"type": "string"},
                        "contact_number": {"type": ["string", "null"]}
                    },
                    "description": "Details of the person filing the FIR"
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
                    },
                    "description": "Details of accused persons"
                },
                "occurrence_details": {
                    "type": "object",
                    "properties": {
                        "date_of_occurrence": {"type": "string"},
                        "time_of_occurrence": {"type": "string"},
                        "place_of_occurrence": {"type": "string"},
                        "distance_from_police_station": {"type": ["string", "null"]}
                    },
                    "description": "When and where the incident occurred"
                },
                "brief_facts_of_case": {
                    "type": "string",
                    "description": "Detailed description of the incident in Urdu"
                },
                "witnesses": {
                    "type": ["array", "null"],
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "father_or_husband_name": {"type": ["string", "null"]},
                            "address": {"type": "string"}
                        }
                    },
                    "description": "List of witnesses"
                },
                "investigating_officer_details": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "rank": {"type": "string"},
                        "badge_number": {"type": ["string", "null"]}
                    },
                    "description": "Details of the investigating officer"
                }
            }
        }
    },
    "required": ["raw_urdu_text", "fir_structured_data"]
}

# Agent instructions for Urdu FIR extraction
AGENT_INSTRUCTIONS = """You are an expert Urdu OCR and document analysis agent specialized in Pakistani First Information Reports (FIR).

Your task:
1. Extract ALL Urdu text from the FIR image exactly as written - preserve every character, diacritic, and punctuation mark
2. Parse the FIR into structured fields (FIR number, complainant, accused, occurrence details, etc.)
3. The 'brief_facts_of_case' field should contain the complete incident description in Urdu

Important:
- Preserve original Urdu text exactly - do not modify, summarize, or translate
- Handle handwritten and printed Urdu text
- Extract dates in their original format
- If a field is not present or illegible, use null
- The raw_urdu_text should be the complete OCR output before any parsing"""


def main():
    print("=" * 60)
    print("FIR_TextExtraction Agent Setup")
    print("=" * 60)
    
    # Initialize LlamaExtract client
    client = LlamaExtract(api_key=LLAMA_CLOUD_API_KEY)
    
    # Check if agent already exists
    print(f"\n📋 Checking for existing agents...")
    existing_agents = client.list_agents()
    agent_names = [a.name for a in existing_agents]
    
    print(f"   Found {len(agent_names)} agent(s): {agent_names if agent_names else 'None'}")
    
    if AGENT_NAME in agent_names:
        print(f"\n✅ Agent '{AGENT_NAME}' already exists!")
        print("   No action needed. Your app should work now.")
        return
    
    # Create the agent
    print(f"\n🔧 Creating agent '{AGENT_NAME}'...")
    
    try:
        agent = client.create_agent(
            name=AGENT_NAME,
            data_schema=FIR_SCHEMA
        )
        
        print(f"\n✅ SUCCESS! Agent '{AGENT_NAME}' created!")
        print(f"   Agent ID: {agent.id if hasattr(agent, 'id') else 'Created'}")
        print("\n" + "=" * 60)
        print("You can now run your SpecterApp - the backend will work!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Failed to create agent: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Check your LLAMA_CLOUD_API_KEY is valid")
        print("2. Verify you have permissions to create agents")
        print("3. Try creating the agent manually at cloud.llamaindex.ai")
        raise


if __name__ == "__main__":
    main()
