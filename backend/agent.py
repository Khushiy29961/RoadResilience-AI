import json
import google.generativeai as genai

from config import GEMINI_API_KEY
from tools.satellite_tool import get_satellite_evidence
from tools.road_network_tool import check_road_network
from tools.geo_context_tool import get_geo_context

genai.configure(api_key=GEMINI_API_KEY)

TOOL_MAP = {
    "get_satellite_evidence": get_satellite_evidence,
    "check_road_network": check_road_network,
    "get_geo_context": get_geo_context,
}

tools_config = [
    {
        "function_declarations": [
            {
                "name": "get_satellite_evidence",
                "description": "Analyze satellite imagery to detect a possible road continuation at a suspected gap.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "lat": {"type": "number"},
                        "lon": {"type": "number"},
                        "radius_m": {"type": "integer"},
                    },
                    "required": ["lat", "lon"],
                },
            },
            {
                "name": "check_road_network",
                "description": "Check existing mapped road segments near a point using OpenStreetMap data.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "lat": {"type": "number"},
                        "lon": {"type": "number"},
                        "radius_m": {"type": "integer"},
                    },
                    "required": ["lat", "lon"],
                },
            },
            {
                "name": "get_geo_context",
                "description": "Check for vegetation, water, and building obstructions near a point that might explain a missing road.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "lat": {"type": "number"},
                        "lon": {"type": "number"},
                        "radius_m": {"type": "integer"},
                    },
                    "required": ["lat", "lon"],
                },
            },
        ]
    }
]

SYSTEM_PROMPT = """You are investigating a suspected gap in an automatically extracted road map.
A gap does not necessarily mean the real road is missing — it may just be poorly detected due to
vegetation, shadows, buildings, or image quality.

Use the available tools to gather evidence:
- get_satellite_evidence: checks if satellite imagery shows a road-like feature
- check_road_network: checks existing mapped road data
- get_geo_context: checks for obstructions like vegetation, water, or buildings

Call as many tools as needed to reach a confident conclusion. You may call tools in any order,
and you may call a tool more than once with different parameters if needed.

Once you have enough evidence, respond with ONLY a JSON object in this exact format, with no
extra text, no markdown formatting, and no code fences:

{"final_answer": "LIKELY_EXISTS", "confidence": 0.8, "evidence": ["reason 1", "reason 2"]}

final_answer must be one of: "LIKELY_EXISTS", "UNLIKELY", "UNCERTAIN"
confidence must be a number between 0 and 1
evidence must be a list of short strings summarizing what was found
"""


def run_agent(lat: float, lon: float, radius_m: int = 200) -> dict:
    model = genai.GenerativeModel(
        "gemini-3.5-flash-lite",
        tools=tools_config,
        system_instruction=SYSTEM_PROMPT,
        generation_config={"temperature": 0.2},
    )
    chat = model.start_chat()
    steps = []

    try:
        response = chat.send_message(
            f"Investigate suspected road gap at lat={lat}, lon={lon}, radius_m={radius_m}."
        )
    except Exception as e:
        return {
            "final_answer": "UNCERTAIN",
            "confidence": 0.0,
            "evidence": [f"Model call failed: {str(e)}"],
            "steps": steps,
        }

    max_iterations = 8
    for _ in range(max_iterations):
        if not response.candidates or not response.candidates[0].content.parts:
            return {
                "final_answer": "UNCERTAIN",
                "confidence": 0.0,
                "evidence": [f"Empty response from model. Raw response: {response}"],
                "steps": steps,
            }

        function_call_part = None
        text_parts = []

        for part in response.candidates[0].content.parts:
            if getattr(part, "thought", False):
                continue
            if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                function_call_part = part.function_call
                break
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        if function_call_part:
            fn_name = function_call_part.name
            fn_args = dict(function_call_part.args)
            steps.append(f"Called {fn_name} with {fn_args}")

            if fn_name in TOOL_MAP:
                try:
                    result = TOOL_MAP[fn_name](**fn_args)
                except Exception as e:
                    result = {"error": str(e)}
            else:
                result = {"error": f"Unknown tool: {fn_name}"}

            try:
                response = chat.send_message(
                    genai.protos.Content(
                        parts=[
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=fn_name, response=result
                                )
                            )
                        ]
                    )
                )
            except Exception as e:
                return {
                    "final_answer": "UNCERTAIN",
                    "confidence": 0.0,
                    "evidence": [f"Model call failed after tool execution: {str(e)}"],
                    "steps": steps,
                }
        elif text_parts:
            raw_text = "".join(text_parts).strip()

            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`")
                raw_text = raw_text.replace("json", "", 1).strip()

            try:
                final = json.loads(raw_text)
            except Exception:
                final = {
                    "final_answer": "UNCERTAIN",
                    "confidence": 0.0,
                    "evidence": [f"Could not parse model output: {raw_text}"],
                }

            final["steps"] = steps
            return final
        else:
            try:
                response = chat.send_message(
                    "Please continue and provide your final JSON answer now."
                )
            except Exception as e:
                return {
                    "final_answer": "UNCERTAIN",
                    "confidence": 0.0,
                    "evidence": [f"Model call failed while continuing: {str(e)}"],
                    "steps": steps,
                }

    return {
        "final_answer": "UNCERTAIN",
        "confidence": 0.0,
        "evidence": ["Max iterations reached without a final answer"],
        "steps": steps,
    }