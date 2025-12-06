# AIworkshop2/vlm.py
import requests
import json
import base64
import os
from pathlib import Path
from typing import List, Dict, Any, Literal
from pydantic import BaseModel, Field
from pdf2image import convert_from_path # 需要安装 poppler
import tempfile
import asyncio 
from dotenv import load_dotenv

# Load .env
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = os.getenv("OPENAI_API_URL")

# === 修复: 确保 URL 指向 chat/completions ===
# 如果 .env 里只有 /v1，我们需要手动补全路径
if OPENAI_API_URL and not OPENAI_API_URL.endswith("/chat/completions"):
    CHAT_API_URL = f"{OPENAI_API_URL.rstrip('/')}/chat/completions"
else:
    CHAT_API_URL = OPENAI_API_URL

MODEL = "gpt-4o-mini" 

VLM_TransactionType = Literal["Income", "Expense"]
# 这里的 Category 需要和前端/数据库保持一致，否则 Pydantic 校验会失败
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
    # balance 字段有时候票据上没有，AI 可能会瞎编或者报错，如果是必须字段请保留，否则建议 Optional
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
    # 简单的逻辑增强
    if amount > 0 and any(k in merchant for k in income_keywords):
        tx["type"] = "Income"
    
    expense_categories = ["Food", "Shopping", "Transportation", "Entertainment", "Housing"]
    if category in expense_categories:
        tx["type"] = "Expense"

    if "type" not in tx or tx["type"] == "":
        tx["type"] = "Income" if amount > 0 else "Expense"

    return tx


async def extract_transactions_from_image(data_url: str) -> List[Dict[str, Any]]:
    """Calls the OpenAI VLM API."""

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
            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}} # 建议用 high detail 识别文字更准
        ]}
    ]

    payload = {
        "model": MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"}, 
        "temperature": 0.0
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    for attempt in range(3):
        try:
            print(f"Requesting OpenAI VLM... Attempt {attempt+1}")
            # === 使用修正后的 CHAT_API_URL ===
            # 这里虽然是 requests (同步)，但在外层 async 函数中运行
            response = requests.post(CHAT_API_URL, headers=headers, data=json.dumps(payload), timeout=30)
            response.raise_for_status()

            result = response.json()
            json_text = result["choices"][0]["message"]["content"]
            
            # print(f"DEBUG JSON: {json_text}") # 调试用

            parsed = VLMResponse.model_validate_json(json_text)
            final_list = []

            for tx in parsed.transactions:
                item = tx.model_dump()
                item = auto_classify(item)
                final_list.append(item)

            return final_list

        except requests.exceptions.RequestException as e:
            print(f"API Error on attempt {attempt + 1}: {e}")
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
            else:
                return []

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Parsing Error: {e}")
            # 如果解析失败，通常重试也没用，直接返回空或继续
            return []

    return []


async def extract_transactions_from_data(base64_data: str, mime_type: str) -> List[Dict[str, Any]]:
    """
    Called by main.py with base64 + mime_type.
    """
    transactions: List[Dict[str, Any]] = []
    tmp_path = None

    try:
        # 创建临时文件
        suffix = ".pdf" if mime_type == "application/pdf" else ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(base64.b64decode(base64_data))
            tmp_path = tmp.name

        if mime_type == "application/pdf":
            # PDF 处理：转为图片
            try:
                # 注意：Windows 上需要 poppler 路径，Linux/Mac 通常不需要
                pages = convert_from_path(tmp_path, dpi=300)
            except Exception as e:
                print(f"PDF Conversion failed (Poppler installed?): {e}")
                raise

            for i, page in enumerate(pages):
                img_path = f"{tmp_path}_page_{i}.png"
                page.save(img_path, "PNG")

                data_url = encode_image_to_data_url(img_path)
                
                # 必须 await
                txs = await extract_transactions_from_image(data_url)
                transactions.extend(txs)

                if os.path.exists(img_path):
                    os.remove(img_path)

        else:
            # 图片直接处理
            data_url = encode_image_to_data_url(tmp_path)
            transactions = await extract_transactions_from_image(data_url)

    except Exception as e:
        print(f"Error during file processing: {e}")
        # 这里可以选择 raise 抛给 main.py 处理，或者返回空列表
        return [] 

    finally:
        # 清理临时文件
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except PermissionError:
                pass # Windows 有时候文件锁释放慢

    return transactions