"""Section 1 company context. Loaded by ``manage.py seed_architecture``.

Company fields and the six service lines come from the approved brief. Service line taglines, mode
mapping, colours and icons are working assumptions recorded in docs/DECISIONS.md; they are only
written when a record is first created, so edits made in the app are never overwritten.
"""

COMPANY = {
    "name": "Vitalos",
    "tagline": "From strategy to production.",
    "vision": "Build one of the world's most trusted AI-centred technology consulting and engineering "
    "companies.",
    "mission": "Help organisations turn technology and AI into measurable business advantage.",
    "business_modes": ["ADVISE", "BUILD", "OPERATE", "CREATE"],
    "classification": "public",
}

SERVICE_LINES = [
    {
        "name": "Vitalos Consulting",
        "slug": "consulting",
        "tagline": "Strategy, architecture and transformation advisory.",
        "business_modes": ["ADVISE"],
        "colour": "#2457FF",
        "icon": "compass",
    },
    {
        "name": "Vitalos Engineering",
        "slug": "engineering",
        "tagline": "Product, platform and cloud engineering.",
        "business_modes": ["BUILD"],
        "colour": "#0F766E",
        "icon": "code",
    },
    {
        "name": "Vitalos AI & Data",
        "slug": "ai-data",
        "tagline": "Data foundations and responsible AI in production.",
        "business_modes": ["ADVISE", "BUILD"],
        "colour": "#7C3AED",
        "icon": "sparkles",
    },
    {
        "name": "Vitalos Experience",
        "slug": "experience",
        "tagline": "Service, product and interface design.",
        "business_modes": ["ADVISE", "BUILD"],
        "colour": "#DB2777",
        "icon": "pen",
    },
    {
        "name": "Vitalos Managed Services",
        "slug": "managed-services",
        "tagline": "Run, support and continuously improve live services.",
        "business_modes": ["OPERATE"],
        "colour": "#0891B2",
        "icon": "shield",
    },
    {
        "name": "Vitalos Labs",
        "slug": "labs",
        "tagline": "Ventures, prototypes and new Vitalos products.",
        "business_modes": ["CREATE"],
        "colour": "#EA580C",
        "icon": "flask",
    },
]
