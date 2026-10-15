"""Small contract shapes shared by the Insights and Careers builders."""

from .choices import Practice


def choice(key: str, label: str) -> dict:
    return {"key": key, "label": label}


def practice_choice(key: str) -> dict | None:
    if key not in Practice.values:
        return None
    return choice(key, Practice(key).label)


def image(url: str, alt: str, width, height, caption: str | None = None) -> dict | None:
    """The contract's Image, or None when there is no usable image."""
    if not url or not width or not height:
        return None
    return {
        "url": url,
        "alt": alt or "",
        "width": int(width),
        "height": int(height),
        "caption": caption or None,
    }
