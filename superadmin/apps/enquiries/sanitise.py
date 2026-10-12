"""HTML email sanitising. Raw HTML is stored; only the sanitised copy is ever rendered.

nh3 (ammonia) removes scripts, event handlers, forms, iframes, embeds and javascript: URLs. The copy is
then shown inside a sandboxed iframe served with its own strict CSP (views.message_body), which also
blocks remote images until the reader chooses "Load images".
"""

import nh3

ALLOWED_TAGS = {
    "a", "abbr", "b", "blockquote", "br", "caption", "center", "code", "col", "colgroup", "dd", "del", "div",
    "dl", "dt", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "li", "ol", "p",
    "pre", "q", "s", "small", "span", "strike", "strong", "sub", "sup", "table", "tbody", "td", "tfoot",
    "th", "thead", "tr", "u", "ul",
}  # fmt: skip
GENERIC_ATTRIBUTES = {
    "align",
    "bgcolor",
    "border",
    "color",
    "dir",
    "height",
    "lang",
    "style",
    "title",
    "valign",
    "width",
}
ALLOWED_ATTRIBUTES = {
    "*": GENERIC_ATTRIBUTES,
    "a": {"href", "name"},
    "img": {"alt", "src", "height", "width"},
    "font": {"face", "size"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
    "table": {"cellpadding", "cellspacing"},
}


def sanitise_html(html: str) -> str:
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto", "cid", "data"},
        link_rel="noopener noreferrer nofollow",
        strip_comments=True,
    )
