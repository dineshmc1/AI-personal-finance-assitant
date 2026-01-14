import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

async def verify():
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_API_URL")
    
    print(f"Checking configuration...")
    print(f"API_KEY present: {bool(api_key)}")
    print(f"BASE_URL: {base_url}")
    
    if not api_key:
        print("ERROR: OPENAI_API_KEY is missing.")
        return

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    
    print("\nAttempting to connect to OpenRouter (openai/gpt-4o-mini)...")
    try:
        response = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello, are you working?"}],
        )
        print(f"\nSUCCESS! Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"\nFAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
