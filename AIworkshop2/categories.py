# AI workshop 2/categories.py
import firebase_admin
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated
from models import CategoryCreate, CategoryDB
from auth_deps import get_current_user_id

categories_router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

# === 静态默认分类 (存在代码里，不存数据库) ===
DEFAULT_CATEGORIES = [
    {"name": "Food", "type": "Expense", "icon": "food", "color": "#FF6B6B"},
    {"name": "Transport", "type": "Expense", "icon": "car", "color": "#4ECDC4"},
    {"name": "Shopping", "type": "Expense", "icon": "cart", "color": "#45B7D1"},
    {"name": "Bills", "type": "Expense", "icon": "file-document", "color": "#FFA07A"},
    {"name": "Entertainment", "type": "Expense", "icon": "movie", "color": "#9B59B6"},
    {"name": "Healthcare", "type": "Expense", "icon": "hospital", "color": "#E74C3C"},
    {"name": "Education", "type": "Expense", "icon": "school", "color": "#F1C40F"},
    {"name": "Salary", "type": "Income", "icon": "cash", "color": "#27AE60"},
    {"name": "Freelance", "type": "Income", "icon": "laptop", "color": "#2980B9"},
    {"name": "Investment", "type": "Income", "icon": "chart-line", "color": "#8E44AD"},
    {"name": "Savings", "type": "Expense", "icon": "piggy-bank", "color": "#FFD700"},
    {"name": "Housing", "type": "Expense", "icon": "home", "color": "#E67E22"},
    {"name": "Vehicle", "type": "Expense", "icon": "car", "color": "#95A5A6"},
    {"name": "Travel", "type": "Expense", "icon": "airplane", "color": "#3498DB"},
    {"name": "Other", "type": "Expense", "icon": "dots-horizontal", "color": "#95A5A6"},
]

@categories_router.get("/", response_model=List[CategoryDB])
async def list_categories(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Returns: Default Categories (Memory) + User Categories (Firestore)
    """
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        # 1. 准备默认分类 (给它们生成临时的 ID，标记为 default)
        final_list = []
        for cat in DEFAULT_CATEGORIES:
            # 构造 CategoryDB 对象
            # id 使用 'default_名字'，方便前端识别和防止 ID 冲突
            final_list.append(CategoryDB(
                id=f"default_{cat['name']}", 
                user_id=user_id, # 虚拟归属给当前用户，方便前端处理
                is_default=True,
                **cat
            ))

        # 2. 从数据库获取用户自定义分类
        cats_ref = db.collection('categories').where("user_id", "==", user_id)
        docs = cats_ref.stream()
        
        for doc in docs:
            # 数据库里的肯定是自定义的，is_default=False
            data = doc.to_dict()
            # 确保 data 里没有 is_default 脏数据干扰，强制设为 False
            data['is_default'] = False 
            final_list.append(CategoryDB(id=doc.id, **data))
                
        return final_list
        
    except Exception as e:
        print(f"Error listing categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve categories.")


@categories_router.post("/", response_model=CategoryDB, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Add a new custom category to Firestore."""
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        cat_dict = category_data.model_dump()
        cat_dict['user_id'] = user_id
        cat_dict['is_default'] = False # 强制标记为自定义

        # 检查名字是否和默认分类冲突 (可选，为了避免混淆)
        for default in DEFAULT_CATEGORIES:
            if default['name'].lower() == cat_dict['name'].lower() and default['type'] == cat_dict['type']:
                 raise HTTPException(status_code=400, detail="This category already exists as a default.")

        doc_ref = db.collection('categories').add(cat_dict)
        return CategoryDB(id=doc_ref[1].id, **cat_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating category: {e}")
        raise HTTPException(status_code=500, detail="Failed to create category.")


@categories_router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Delete a custom category from Firestore."""
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    # 1. 拦截：绝对不允许删除默认分类
    if category_id.startswith("default_"):
        raise HTTPException(status_code=403, detail="Default categories cannot be deleted.")
    
    try:
        doc_ref = db.collection('categories').document(category_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Category not found")
            
        if doc.to_dict().get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        doc_ref.delete()
        return
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting category: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete category.")