import { emailTheme, FONT, MONO } from "./theme";

/**
 * The markup of every Vitalos email, as plain strings with `[[slot]]` placeholders. These strings
 * are the single source of the layout: the TypeScript renderer (`render.ts`) fills them, and they
 * are exported verbatim in the language-neutral spec for the Super Admin's Python renderer.
 *
 * Slot values are always HTML produced by a renderer: plain values are escaped before they are put
 * in a slot, so a snippet never escapes anything itself.
 */
const L = emailTheme.light;

const CELL = `border-top:1px solid ${L.rule};font-size:16px;line-height:20px;vertical-align:top;`;
const WRAP = "word-break:break-word;overflow-wrap:anywhere;";

export const snippets = {
  shell: `<!DOCTYPE html>
<html lang="en-GB" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>[[title]]</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
[[style_blocks]]
</head>
<body class="v-page" style="margin:0;padding:0;background-color:${L.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;">[[preheader]]</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" class="v-page" style="width:100%;background-color:${L.page};">
<tr><td align="center" style="padding:16px 8px 24px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT};">
[[header]]
<tr><td bgcolor="${L.surface}" class="v-card v-pad" style="padding:24px;background-color:${L.surface};border:1px solid ${L.rule};border-top:0;border-radius:0 0 12px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${FONT};">
[[body]]
</table>
</td></tr>
[[footer]]
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`,

  style: `<style>
[[css]]
</style>`,

  // The gradient keeps the midnight fill when Gmail force-inverts colours, so the white logo shows.
  header: `<tr><td bgcolor="${L.headBg}" class="v-pad" style="padding:16px 24px;background-color:${L.headBg};background-image:linear-gradient(${L.headBg},${L.headBg});border-radius:12px 12px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr>
<td style="font-family:${FONT};font-size:20px;line-height:24px;font-weight:700;color:${L.headText};">[[logo]]</td>
<td align="right" style="font-family:${FONT};"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${L.headLabelBg};color:${L.headLabelText};font-size:14px;line-height:20px;font-weight:600;">[[label]]</span></td>
</tr></table>
</td></tr>`,

  image: `<img src="cid:[[content_id]]" width="[[width]]" height="[[height]]" alt="[[alt]]" style="display:block;width:[[width]]px;height:[[height]]px;border:0;outline:none;text-decoration:none;">`,

  // Every body block sits in one row; `pad` is the space above it in px.
  row: `<tr><td style="padding:[[pad]]px 0 0;">
[[content]]
</td></tr>`,

  heading: `<h1 class="v-h v-name" style="margin:0;font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;color:${L.heading};${WRAP}">[[text]]</h1>`,

  section: `<h2 class="v-h" style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${L.heading};">[[text]]</h2>`,

  paragraph: `<p class="v-t" style="margin:[[margin]];font-size:16px;line-height:24px;color:${L.text};${WRAP}">[[text]]</p>`,

  paragraph_muted: `<p class="v-m" style="margin:[[margin]];font-size:16px;line-height:24px;color:${L.muted};${WRAP}">[[text]]</p>`,

  list: `<ul class="v-t" style="margin:[[margin]];padding:0 0 0 20px;font-size:16px;line-height:24px;color:${L.text};${WRAP}">[[items]]</ul>`,

  list_item: `<li style="margin:0 0 4px;">[[text]]</li>`,

  missing: `<span class="v-m" style="color:${L.muted};font-style:italic;">[[text]]</span>`,

  button: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr><td align="center" bgcolor="${L.action}" class="v-btn" style="background-color:${L.action};border-radius:8px;">
<a href="[[href]]" class="v-btn-a" style="display:block;padding:14px 20px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${L.actionText};text-decoration:none;border-radius:8px;">[[label]]</a>
</td></tr></table>`,

  badges: `<div>[[items]]</div>`,

  badge_intent: `<span class="v-b-intent" style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${L.intentBorder};border-radius:999px;background-color:${L.intentBg};color:${L.intentText};font-size:14px;line-height:20px;font-weight:600;white-space:nowrap;">[[text]]</span>`,

  badge_time: `<span class="v-b-time" style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${L.timeBorder};border-radius:999px;background-color:${L.timeBg};color:${L.timeText};font-size:14px;line-height:20px;font-weight:600;white-space:nowrap;">[[text]]</span>`,

  badge_none: `<span class="v-b-none" style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${L.rule};border-radius:999px;background-color:${L.surface};color:${L.muted};font-size:14px;line-height:20px;font-weight:600;white-space:nowrap;">[[text]]</span>`,

  quote: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr><td class="v-quote v-t" style="padding:12px 16px;background-color:${L.quoteBg};border-left:4px solid ${L.quoteBar};font-family:${FONT};font-size:16px;line-height:24px;color:${L.text};${WRAP}">[[text]]</td></tr>
</table>`,

  details: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:${FONT};">
[[rows]]
</table>`,

  // `padding` is "12px 0", or "0" when the value is a link that carries its own tap-target padding.
  details_row: `<tr>
<th scope="row" align="left" valign="top" width="128" class="v-m v-rule v-label" style="${CELL}width:128px;padding:12px 12px 12px 0;font-weight:400;font-size:14px;color:${L.muted};">[[label]]</th>
<td valign="top" class="v-t v-rule" style="${CELL}padding:[[padding]];color:${L.text};${WRAP}">[[value]]</td>
</tr>`,

  // inline-block with 12px vertical padding: a tap target of at least 44px.
  link: `<a href="[[href]]" class="v-link" style="display:inline-block;padding:12px 0;color:${L.link};text-decoration:underline;${WRAP}">[[text]]</a>`,

  note: ` <span class="v-m" style="color:${L.muted};font-family:${MONO};font-size:13px;">([[text]])</span>`,

  subvalue: `<br><span class="v-m" style="color:${L.muted};font-family:${MONO};font-size:13px;line-height:20px;">[[text]]</span>`,

  hint: `<div style="padding:0 0 12px;"><span class="v-hint" style="display:inline-block;padding:2px 8px;border:1px solid ${L.hintBorder};border-radius:999px;background-color:${L.hintBg};color:${L.hintText};font-size:14px;line-height:20px;font-weight:600;">[[text]]</span></div>`,

  code: `<span class="v-code" style="display:inline-block;padding:4px 8px;border-radius:6px;background-color:${L.codeBg};color:${L.heading};font-family:${MONO};font-size:16px;line-height:20px;letter-spacing:0.5px;-webkit-user-select:all;user-select:all;">[[text]]</span>`,

  // Keeps a plain value aligned with linked values in the same table.
  padded: `<span style="display:inline-block;padding:12px 0;">[[text]]</span>`,

  divider: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr><td class="v-rule" style="border-top:1px solid ${L.rule};font-size:1px;line-height:1px;">&nbsp;</td></tr>
</table>`,

  signature: `<p class="v-t" style="margin:0;font-size:16px;line-height:24px;color:${L.text};">Kind regards,<br><strong class="v-h" style="color:${L.heading};">[[name]]</strong>[[title]]<br>Vitalos Technologies</p>`,

  signature_title: `<br><span class="v-m" style="color:${L.muted};">[[text]]</span>`,

  footer_text: `<tr><td class="v-m v-pad" style="padding:[[pad]]px 24px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${L.muted};">[[text]]</td></tr>`,

  footer_social: `<tr><td class="v-pad" style="padding:12px 18px 0;">[[links]]</td></tr>`,

  footer_social_link: `<a href="[[href]]" style="display:inline-block;padding:6px;text-decoration:none;">[[image]]</a>`,

  footer_link: `<a href="[[href]]" class="v-m" style="color:${L.muted};text-decoration:underline;">[[text]]</a>`,
} as const;

export type SnippetName = keyof typeof snippets;
