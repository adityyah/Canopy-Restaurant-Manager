from pydantic import BaseModel, ConfigDict

class MenuItemCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category: str
    stock_quantity: int = 0
    is_active: bool = True
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    is_daily_delight: bool = False

class MenuItemUpdate(BaseModel):
    stock_quantity: int | None = None
    is_active: bool | None = None

class ManagerMenuItemOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    category: str
    stock_quantity: int
    is_active: bool
    is_vegetarian: bool
    is_vegan: bool
    is_gluten_free: bool
    is_daily_delight: bool
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
