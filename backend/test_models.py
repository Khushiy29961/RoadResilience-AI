import google.generativeai as genai
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

# Candidates worth testing, based on what's available to your key
candidates = [
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite-preview",
]

test_tool = [
    {
        "function_declarations": [
            {
                "name": "get_weather",
                "description": "Get the weather for a city.",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            }
        ]
    }
]

for model_name in candidates:
    print(f"\n--- Testing {model_name} ---")
    try:
        model = genai.GenerativeModel(model_name, tools=test_tool)
        chat = model.start_chat()
        response = chat.send_message("What's the weather in Paris?")

        if not response.candidates:
            print("FAILED: no candidates returned")
            continue

        finish_reason = response.candidates[0].finish_reason
        parts = response.candidates[0].content.parts

        has_function_call = any(
            hasattr(p, "function_call") and p.function_call and p.function_call.name
            for p in parts
        )

        if has_function_call:
            print(f"SUCCESS: made a proper function call. finish_reason={finish_reason}")
        else:
            print(f"NO FUNCTION CALL. finish_reason={finish_reason}, parts={parts}")

    except Exception as e:
        print(f"ERROR: {str(e)[:200]}")