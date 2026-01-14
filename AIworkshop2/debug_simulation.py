import asyncio
import os
from dotenv import load_dotenv

# Force reload to be sure
load_dotenv(override=True)

# Import exactly what simulation.py uses
from simulation import openai_client, MODEL_MINI, OPENAI_API_KEY, OPENAI_API_URL

async def debug_sim():
    print(f"--- Debugging Simulation Configuration ---")
    print(f"API_KEY From Module: {bool(OPENAI_API_KEY)}")
    print(f"API_URL From Module: {OPENAI_API_URL}")
    print(f"Model Name: {MODEL_MINI}")
    
    if openai_client:
        print(f"Client Base URL: {openai_client.base_url}")
    else:
        print("Client is None!")
        return

    print("\nAttempting API Call (JSON Mode) with this config...")
    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": "You are a helper. Respond in JSON."},
                {"role": "user", "content": "Give me a dummy JSON object."}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        print(f"SUCCESS: {response.choices[0].message.content}")
    except Exception as e:
        print(f"FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(debug_sim())
