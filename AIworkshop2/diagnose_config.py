import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Force reload from .env
load_dotenv(override=True)

API_KEY = os.getenv("OPENAI_API_KEY")
API_URL = os.getenv("OPENAI_API_URL")

print(f"--- Environment Diagnosis ---")
print(f"CWD: {os.getcwd()}")
print(f"API_URL: '{API_URL}'")
if API_KEY:
    print(f"API_KEY: '{API_KEY[:15]}...' (Length: {len(API_KEY)})")
else:
    print(f"API_KEY: None")

async def test_conn():
    if not API_KEY:
        print("Cannot test: Key missing.")
        return

    client = AsyncOpenAI(api_key=API_KEY, base_url=API_URL)
    
    extra_headers = {
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Finance App"
    }

    try:
        print("\nSending test request to openai/gpt-4o-mini...")
        resp = await client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "Ping"}],
            extra_headers=extra_headers
        )
        print(f"SUCCESS: {resp.choices[0].message.content}")
    except Exception as e:
        print(f"FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
