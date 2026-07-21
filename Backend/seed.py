# backend/seed.py
# ==============================================================================
# Database Seeder — Canopy Restaurant Manager
# ==============================================================================
# This script:
#   1. Drops and recreates all tables (clean slate).
#   2. Populates `menu_items` with 16 items across 4 categories.
#   3. Prints a summary table to confirm everything was inserted correctly.
#
# Run from inside the `backend/` directory:
#   Windows CMD:        python seed.py
#   Windows PowerShell: python seed.py
#   (Virtual env must be activated first)
#
# Per PHASES.md § 1.5:
#   "Write a seed.py script in backend/ that populates the menu_items table
#    with at least 12 sample items across 4 categories (Starters, Mains,
#    Desserts, Beverages). Include a mix of vegetarian, vegan, and gluten-free
#    items. Set realistic prices and stock quantities (e.g., 20–50 units each)."
#
# IMPORTANT: Running this script WIPES the database. Use it only for fresh
# setup or development resets. Never run it against production data.
# ==============================================================================

from __future__ import annotations

import sys
import logging
from pathlib import Path

# Ensure the backend/ directory is on sys.path so `from app.xxx import ...` works
# when the script is run directly with `python seed.py` from within backend/.
sys.path.insert(0, str(Path(__file__).parent))

from app.database import Base, engine, SessionLocal
from app.models.menu_item import MenuItem

# Import all models so their metadata is registered before create_all() runs.
import app.models.user          # noqa: F401
import app.models.order         # noqa: F401
import app.models.order_item    # noqa: F401
import app.models.reward_point  # noqa: F401
import app.models.chat_session  # noqa: F401

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Seed Data — 16 items across 4 categories
# ---------------------------------------------------------------------------
# Column guide:
#   name             — unique display name (matched by the AI's get_item_by_name)
#   description      — shown to customers and used by the AI for context
#   category         — Starters | Mains | Desserts | Beverages
#   price            — in INR (₹)
#   stock_quantity   — how many portions are available today
#   is_vegetarian    — True if no meat/fish
#   is_vegan         — True if no animal products at all
#   is_gluten_free   — True if safe for gluten intolerance
#   is_active        — True = visible to AI and customers
#   is_daily_delight — True for exactly ONE item = today's featured special
#                      (picked as the highest-stock active item on seed;

SEED_MENU: list[dict] = [

    # ── Starters (4 items) ────────────────────────────────────────────────────

    {
        "name":             "Chicken Wings",
        "description":      "Crispy fried chicken wings tossed in a smoky BBQ glaze. "
                            "Served with a side of blue cheese dip.",
        "category":         "Starters",
        "price":            280.00,
        "stock_quantity":   35,
        "is_vegetarian":    False,
        "is_vegan":         False,
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Garlic Bread",
        "description":      "Toasted sourdough slices brushed with herb butter and roasted garlic. "
                            "A classic to start any meal.",
        "category":         "Starters",
        "price":            120.00,
        "stock_quantity":   50,
        "is_vegetarian":    True,
        "is_vegan":         False,    # Contains butter
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Soup of the Day",
        "description":      "Chef's freshly made soup served with a warm dinner roll. "
                            "Ask the AI what today's soup is!",
        "category":         "Starters",
        "price":            150.00,
        "stock_quantity":   20,
        "is_vegetarian":    True,
        "is_vegan":         True,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Paneer Tikka",
        "description":      "Chunks of paneer marinated in spiced yoghurt and grilled in a tandoor. "
                            "Served with mint chutney.",
        "category":         "Starters",
        "price":            220.00,
        "stock_quantity":   5,       # Low stock — will be flagged in the inventory chart
        "is_vegetarian":    True,
        "is_vegan":         False,    # Contains paneer (dairy)
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },

    # ── Mains (5 items) ───────────────────────────────────────────────────────

    {
        "name":             "Butter Chicken",
        "description":      "Tender chicken pieces slow-cooked in a rich, velvety tomato-cream sauce. "
                            "Best enjoyed with garlic naan.",
        "category":         "Mains",
        "price":            380.00,
        "stock_quantity":   30,
        "is_vegetarian":    False,
        "is_vegan":         False,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Margherita Pizza",
        "description":      "Wood-fired pizza with San Marzano tomato sauce, fresh mozzarella, "
                            "and basil leaves.",
        "category":         "Mains",
        "price":            320.00,
        "stock_quantity":   25,
        "is_vegetarian":    True,
        "is_vegan":         False,
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Grilled Salmon",
        "description":      "Norwegian salmon fillet grilled to perfection, served with a lemon butter "
                            "sauce, seasonal vegetables, and garlic mashed potatoes.",
        "category":         "Mains",
        "price":            550.00,
        "stock_quantity":   12,
        "is_vegetarian":    False,
        "is_vegan":         False,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Dal Makhani",
        "description":      "Slow-cooked black lentils in a smoky tomato-cream sauce, "
                            "finished with a knob of butter. A hearty vegetarian classic.",
        "category":         "Mains",
        "price":            280.00,
        "stock_quantity":   40,
        "is_vegetarian":    True,
        "is_vegan":         False,    # Contains butter and cream
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Vegan Buddha Bowl",
        "description":      "A nourishing bowl of quinoa, roasted chickpeas, avocado, "
                            "edamame, and pickled vegetables with a tahini dressing.",
        "category":         "Mains",
        "price":            350.00,
        "stock_quantity":   0,       # Out of stock — is_active=False, invisible to AI
        "is_vegetarian":    True,
        "is_vegan":         True,
        "is_gluten_free":   True,
        "is_active":        False,   # Explicitly deactivated (out of stock)
        "is_daily_delight": False,   # Must never be True if inactive
    },

    # ── Desserts (4 items) ────────────────────────────────────────────────────

    {
        "name":             "Chocolate Lava Cake",
        "description":      "Warm dark chocolate cake with a molten centre, served with a scoop "
                            "of vanilla bean ice cream.",
        "category":         "Desserts",
        "price":            180.00,
        "stock_quantity":   22,
        "is_vegetarian":    True,
        "is_vegan":         False,
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Gulab Jamun",
        "description":      "Soft milk-solid dumplings soaked in rose-flavoured sugar syrup. "
                            "Served warm, two pieces.",
        "category":         "Desserts",
        "price":            110.00,
        "stock_quantity":   60,
        "is_vegetarian":    True,
        "is_vegan":         False,
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Mango Sorbet",
        "description":      "Refreshing alphonso mango sorbet. 100% fruit-based and dairy-free. "
                            "Three scoops.",
        "category":         "Desserts",
        "price":            140.00,
        "stock_quantity":   30,
        "is_vegetarian":    True,
        "is_vegan":         True,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Tiramisu",
        "description":      "Classic Italian dessert with espresso-soaked ladyfingers, "
                            "mascarpone cream, and a dusting of cocoa powder.",
        "category":         "Desserts",
        "price":            200.00,
        "stock_quantity":   3,       # Very low — will show warning yellow in inventory chart
        "is_vegetarian":    True,
        "is_vegan":         False,
        "is_gluten_free":   False,
        "is_active":        True,
        "is_daily_delight": False,
    },

    # ── Beverages (3 items) ───────────────────────────────────────────────────

    {
        # ★ DAILY DELIGHT (seed default) — highest active stock (100 units).
        # The auto-delight route (POST /manager/menu/auto-delight) will re-assign
        # this flag dynamically; this is just the initial seed state.
        "name":             "Fresh Lime Soda",
        "description":      "House-pressed lime juice topped with chilled soda water. "
                            "Available sweet, salted, or mixed.",
        "category":         "Beverages",
        "price":            80.00,
        "stock_quantity":   100,
        "is_vegetarian":    True,
        "is_vegan":         True,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": True,    # ★ Highest stock — today's featured special
    },
    {
        "name":             "Masala Chai",
        "description":      "Freshly brewed tea infused with ginger, cardamom, and cinnamon. "
                            "Served hot with a biscuit.",
        "category":         "Beverages",
        "price":            60.00,
        "stock_quantity":   80,
        "is_vegetarian":    True,
        "is_vegan":         False,   # Contains milk
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
    {
        "name":             "Lemonade",
        "description":      "House-made lemonade with fresh lemon juice, sugar, and mint. "
                            "Served over ice.",
        "category":         "Beverages",
        "price":            90.00,
        "stock_quantity":   90,
        "is_vegetarian":    True,
        "is_vegan":         True,
        "is_gluten_free":   True,
        "is_active":        True,
        "is_daily_delight": False,
    },
]


# ---------------------------------------------------------------------------
# Seeding function
# ---------------------------------------------------------------------------

def seed_database() -> None:
    """
    Drops all existing tables, recreates the schema, and inserts seed data.

    WARNING: This destroys all existing data.  Development use only.
    """
    logger.info("=" * 60)
    logger.info("  Canopy Restaurant Manager — Database Seeder")
    logger.info("=" * 60)

    # Step 1: Drop and recreate all tables.
    logger.info("Step 1/3 — Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    logger.info("Step 1/3 — Recreating schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("Step 1/3 — Schema created successfully.")

    # Step 2: Insert seed menu items.
    logger.info(f"Step 2/3 — Inserting {len(SEED_MENU)} menu items...")

    with SessionLocal() as session:
        menu_objects = [MenuItem(**item) for item in SEED_MENU]
        session.add_all(menu_objects)
        session.commit()

    logger.info("Step 2/3 — Menu items inserted successfully.")

    # Step 3: Verify and print a summary table.
    logger.info("Step 3/3 — Verifying inserted data...")

    with SessionLocal() as session:
        items = session.query(MenuItem).order_by(MenuItem.category, MenuItem.name).all()

    # Group by category for a readable report.
    by_category: dict[str, list[MenuItem]] = {}
    for item in items:
        by_category.setdefault(item.category, []).append(item)

    logger.info("")
    logger.info("  MENU SUMMARY (with Daily Delight)")
    logger.info("  " + "-" * 80)
    logger.info(
        f"  {'Name':<28} {'Category':<12} {'Price':>7} "
        f"{'Stock':>6} {'Veg':>4} {'Vgn':>4} {'GF':>4} {'Active':>7} {'Delight':>8}"
    )
    logger.info("  " + "-" * 80)

    total_active = 0
    for category in ["Starters", "Mains", "Desserts", "Beverages"]:
        for item in by_category.get(category, []):
            active_str = "✓" if item.is_active else "✗"
            if item.is_active:
                total_active += 1
            stock_str = str(item.stock_quantity)
            if item.stock_quantity <= 5 and item.is_active:
                stock_str = f"{item.stock_quantity} ⚠"  # Flag low stock
            logger.info(
                f"  {item.name:<28} {item.category:<12} ₹{float(item.price):>6.2f} "
                f"{stock_str:>6} "
                f"{'\u2713' if item.is_vegetarian else '\u2717':>4} "
                f"{'\u2713' if item.is_vegan else '\u2717':>4} "
                f"{'\u2713' if item.is_gluten_free else '\u2717':>4} "
                f"{active_str:>7} "
                f"{'\u2605' if item.is_daily_delight else '':>8}"
            )

    logger.info("  " + "-" * 80)
    logger.info(
        f"  Total items: {len(items)}  |  "
        f"Active: {total_active}  |  "
        f"Inactive: {len(items) - total_active}  |  "
        f"Daily Delight: {sum(1 for i in items if i.is_daily_delight)}"
    )
    logger.info("")
    logger.info("✅  Seeding complete!  restaurant.db is ready.")
    logger.info("")
    logger.info("  Next step: run the server with —")
    logger.info("    Windows CMD:  .venv\\Scripts\\activate && uvicorn app.main:app --reload")
    logger.info("    PowerShell:   .venv\\Scripts\\Activate.ps1; uvicorn app.main:app --reload")
    logger.info("")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    seed_database()
