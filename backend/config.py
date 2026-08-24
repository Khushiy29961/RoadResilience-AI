import os
from dotenv import load_dotenv

# Load variables from .env into the environment
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is not set. Make sure it's defined in your .env file."
    )