import os
import json
import base64
import asyncio
import requests
from dotenv import load_dotenv

load_dotenv()

from openai import AsyncOpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = os.getenv("OPENAI_API_URL")

# Initialize OpenAI Client matching simulation.py logic
client_kwargs = {"api_key": OPENAI_API_KEY}
if OPENAI_API_URL:
    client_kwargs["base_url"] = OPENAI_API_URL

openai_client = AsyncOpenAI(**client_kwargs)

MODEL = "openai/gpt-4o-mini" 

def create_dummy_image_url():
    # 10x10 red square
    base64_img = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGklEQVR42mP8z8AARIQB4///D+MQ4///DwMAtCkEAxsTvXYAAAAASUVORK5CYII="
    return f"data:image/png;base64,{base64_img}"

async def verify_vlm():
    print(f"Testing VLM with AsyncOpenAI Client...")
    print(f"Base URL: {openai_client.base_url}")
    print(f"Model: {MODEL}")
    
    data_url = create_dummy_image_url()
    
    messages = [
        {"role": "user", "content": [
            {"type": "text", "text": "Describe this image in 5 words."},
            {"type": "image_url", "image_url": {"url": data_url}} 
        ]}
    ]
    
    extra_headers = {
         "HTTP-Referer": "http://localhost:8000",
         "X-Title": "AI Personal Finance Assistant"
    }

    try:
        print("Sending request...")
        response = await openai_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            # response_format={"type": "json_object"}, # Text mode for verify is safer to see desc
            temperature=0.0,
            extra_headers=extra_headers
        )
        
        content = response.choices[0].message.content
        print(f"SUCCESS! Response: {content}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_vlm())
