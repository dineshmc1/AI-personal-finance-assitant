# AIworkshop2/vlm.py

import json
import base64
import os
from pathlib import Path
from typing import List, Dict, Any, Literal
from pydantic import BaseModel, Field
from pdf2image import convert_from_path
import tempfile
import asyncio 
from dotenv import load_dotenv

load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = os.getenv("OPENAI_API_URL")

print(f"DEBUG: vlm.py loaded. Key: {str(OPENAI_API_KEY)[:10]}... URL: {OPENAI_API_URL}")

from openai import AsyncOpenAI

# Initialize OpenAI Client matching simulation.py logic
client_kwargs = {"api_key": OPENAI_API_KEY}
if OPENAI_API_URL:
    client_kwargs["base_url"] = OPENAI_API_URL

openai_client = AsyncOpenAI(**client_kwargs)

MODEL = "gpt-4o-mini"

VLM_TransactionType = Literal["Income", "Expense"]
VLM_TransactionCategory = Literal[
    "Food", "Transportation", "Housing", "Shopping", "Vehicle",
    "Investments", "Financial Expenses", "Entertainment", "Other", "Salary"
]

class VLMTransaction(BaseModel):
    date: str = Field(..., description="Date of the transaction in YYYY-MM-DD format.")
    type: VLM_TransactionType
    amount: float
    category: VLM_TransactionCategory
    merchant: str = Field(..., description="Name of the merchant or source.")
    balance: float = Field(0.0) 

class VLMResponse(BaseModel):
    transactions: List[VLMTransaction]


def encode_image_to_data_url(image_path: str) -> str:
    """Reads image bytes from a path and returns a base64 data URL string."""
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    ext = Path(image_path).suffix.lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"

    return f"data:{mime};base64,{b64}"


def auto_classify(tx: dict) -> dict:
    """Applies simple rules if VLM classification is incomplete."""
    amount = tx.get("amount", 0)
    merchant = tx.get("merchant", "").lower()
    category = tx.get("category", "")

    income_keywords = ["salary", "deposit", "transfer in", "received", "bonus"]
    if amount > 0 and any(k in merchant for k in income_keywords):
        tx["type"] = "Income"
    
    expense_categories = ["Food", "Shopping", "Transportation", "Entertainment", "Housing"]
    if category in expense_categories:
        tx["type"] = "Expense"

    if "type" not in tx or tx["type"] == "":
        tx["type"] = "Income" if amount > 0 else "Expense"

    return tx

async def extract_transactions_from_image(data_url: str) -> List[Dict[str, Any]]:
    """Calls the OpenAI VLM API using AsyncOpenAI client."""
    
    if not openai_client:
        print("OpenAI client not initialized.")
        return []

    schema_definition = VLMResponse.model_json_schema()

    system_prompt = f"""
    You are a meticulous financial data extraction assistant.
    Your task is to analyze the provided financial document image (receipt, bank statement, or invoice).
    Extract all transaction data.
    
    RULES:
    1. If the year is missing, assume the current year.
    2. Convert categories to the closest match in the schema options.
    3. Return the output STRICTLY in a JSON object matching the schema.
    
    SCHEMA: {json.dumps(schema_definition)}
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [
            {"type": "text", "text": "Extract all transactions from this document. Respond with JSON ONLY."},
            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}} 
        ]}
    ]
    
    try:
        print(f"Requesting OpenAI VLM ({MODEL})...")
        response = await openai_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.0
        )

        json_text = response.choices[0].message.content
        # Clean potential markdown
        json_text = json_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.startswith("```"):
            json_text = json_text[3:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()

        parsed = VLMResponse.model_validate_json(json_text)
        final_list = []

        for tx in parsed.transactions:
            item = tx.model_dump()
            item = auto_classify(item)
            final_list.append(item)

        return final_list

    except Exception as e:
        print(f"VLM API Error: {e}")
        return []


async def extract_transactions_from_data(base64_data: str, mime_type: str) -> List[Dict[str, Any]]:
    """
    Called by main.py with base64 + mime_type.
    """
    transactions: List[Dict[str, Any]] = []
    tmp_path = None

    try:
        suffix = ".pdf" if mime_type == "application/pdf" else ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(base64.b64decode(base64_data))
            tmp_path = tmp.name

        if mime_type == "application/pdf":
            try:
                pages = convert_from_path(tmp_path, dpi=300)
            except Exception as e:
                print(f"PDF Conversion failed (Poppler installed?): {e}")
                raise

            for i, page in enumerate(pages):
                img_path = f"{tmp_path}_page_{i}.png"
                page.save(img_path, "PNG")

                data_url = encode_image_to_data_url(img_path)
                
                txs = await extract_transactions_from_image(data_url)
                transactions.extend(txs)

                if os.path.exists(img_path):
                    os.remove(img_path)

        else:
            data_url = encode_image_to_data_url(tmp_path)
            transactions = await extract_transactions_from_image(data_url)

    except Exception as e:
        print(f"Error during file processing: {e}")
        return [] 

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except PermissionError:
                pass 

    return transactions