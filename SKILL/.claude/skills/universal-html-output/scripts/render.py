#!/usr/bin/env python3
"""Render JSON data into the supplied, original HTML template, without rewriting layout code.

Python standard library only. The source template under assets/template.html is retained unchanged.
"""
from __future__ import annotations

import argparse
import copy
import html
from html.parser import HTMLParser
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "assets" / "template.html"
# Scope replacement to the constant immediately before the known renderer-start marker.
DATA_RE = re.compile(
    r"(?ms)^const TEMPLATE = \{.*?^\};\s*(?=/\* ここから下は表示処理。通常は変更不要です。 \*/)"
)
ALLOWED_STYLES = {
    "d-light", "d-focus", "d-undecided", "st-done", "st-wip", "st-todo",
    "j-ok", "j-defect", "j-undef", "j-pending", "j-na",
}
ALLOWED_TAGS = {
    "strong", "b", "em", "i", "u", "s", "del", "mark", "br", "p",
    "ul", "ol", "li", "blockquote", "code", "pre", "a", "span", "small",
    "sup", "sub", "div", "kbd", "q",
}
VOID_TAGS = {"br"}
# Text inside these elements is never displayed (not just their tags).
DROP_TAGS = {"script", "style", "iframe", "object", "embed", "svg", "math", "form", "textarea", "template", "noscript"}
CSS_VALUE = re.compile(
    r"^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,24}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|"
    r"rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*\))$"
)


class ValidationError(ValueError):
    pass


def safe_href(value: str) -> str | None:
    value = value.strip()
    if not value or any(ord(ch) < 32 for ch in value) or value.startswith("//"):
        return None
    parts = urlsplit(value)
    if parts.scheme and parts.scheme.lower() not in {"https", "http", "mailto"}:
        return None
    if parts.netloc and not parts.scheme:
        return None
    return value


def safe_css(value: str) -> str:
    result = []
    for decl in value.split(";"):
        if ":" not in decl:
            continue
        prop, val = [s.strip().lower() for s in decl.split(":", 1)]
        if prop in {"color", "background-color"} and CSS_VALUE.fullmatch(val):
            result.append(f"{prop}: {val}")
        elif prop == "font-weight" and val in {"normal", "bold", "bolder", "lighter", "400", "500", "600", "700", "800", "900"}:
            result.append(f"{prop}: {val}")
        elif prop == "text-decoration" and val in {"underline", "line-through", "none"}:
            result.append(f"{prop}: {val}")
    return "; ".join(result)


class SafeRichHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open_tags: list[str] = []
        self.drop_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if self.drop_stack:
            if tag in DROP_TAGS:
                self.drop_stack.append(tag)
            return
        if tag in DROP_TAGS:
            self.drop_stack.append(tag)
            return
        if tag not in ALLOWED_TAGS:
            return
        d = dict(attrs)
        emitted = []
        if tag == "a":
            href = safe_href(d.get("href") or "")
            if href is not None:
                emitted.append(f' href="{html.escape(href, quote=True)}"')
            if d.get("title"):
                emitted.append(f' title="{html.escape(d["title"], quote=True)}"')
            if d.get("target") == "_blank" and href is not None:
                emitted.append(' target="_blank" rel="noopener noreferrer"')
        if tag in {"span", "div"}:
            classes = (d.get("class") or "").split()
            safe_classes = [c for c in classes if c in {"rich-red", "rich-highlight"}]
            if safe_classes:
                emitted.append(f' class="{" ".join(safe_classes)}"')
        if tag in {"span", "div", "p", "strong", "b", "em", "u"}:
            style = safe_css(d.get("style") or "")
            if style:
                emitted.append(f' style="{html.escape(style, quote=True)}"')
        self.out.append(f"<{tag}{''.join(emitted)}>")
        if tag not in VOID_TAGS:
            self.open_tags.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str):
        if self.drop_stack:
            if tag == self.drop_stack[-1]:
                self.drop_stack.pop()
            return
        if tag not in ALLOWED_TAGS or tag in VOID_TAGS or tag not in self.open_tags:
            return
        # Close up to matching node to keep HTML balanced.
        while self.open_tags:
            current = self.open_tags.pop()
            self.out.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data: str):
        if not self.drop_stack:
            self.out.append(html.escape(data, quote=False))

    def handle_entityref(self, name: str):
        self.handle_data(f"&{name};")

    def handle_charref(self, name: str):
        self.handle_data(f"&#{name};")

    def finish(self) -> str:
        while self.open_tags:
            self.out.append(f"</{self.open_tags.pop()}>")
        return "".join(self.out)


def sanitize_rich(raw: str) -> str:
    p = SafeRichHTML()
    p.feed(raw)
    p.close()
    return p.finish()


def rich(value, location: str):
    """Validate a rich-text slot, returning a normalized safe representation."""
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return value
    if isinstance(value, dict):
        if set(value) == {"html"} and isinstance(value["html"], str):
            return {"html": sanitize_rich(value["html"])}
        if set(value) == {"text"} and isinstance(value["text"], str):
            return {"text": value["text"]}
    raise ValidationError(f"{location}: 文字列、{{'text': ...}} または {{'html': ...}} が必要です")


def object_keys(o: dict, allowed: set, loc: str):
    unknown = set(o) - allowed
    if unknown:
        raise ValidationError(f"{loc}: 未対応のフィールド {sorted(unknown)}")


def normalize_label(value, loc: str):
    if isinstance(value, dict) and ("style" in value or "text" in value and "html" not in value):
        object_keys(value, {"text", "style"}, loc)
        if "text" not in value:
            raise ValidationError(f"{loc}: text を指定してください")
        style = value.get("style", "d-light")
        if style not in ALLOWED_STYLES:
            raise ValidationError(f"{loc}: 不明なラベルスタイル {style!r}")
        return {"text": rich(value["text"], loc + ".text"), "style": style}
    return {"text": rich(value, loc), "style": "d-light"}


def normalize_refs(value, loc: str):
    if not isinstance(value, list):
        raise ValidationError(f"{loc}: 参照は配列で指定してください")
    out = []
    for i, item in enumerate(value):
        p = f"{loc}[{i}]"
        if isinstance(item, dict) and ("style" in item or "title" in item):
            object_keys(item, {"text", "style", "title"}, p)
            if "text" not in item:
                raise ValidationError(f"{p}: text を指定してください")
            val = {"text": rich(item["text"], p + ".text")}
            if "style" in item:
                if item["style"] not in ALLOWED_STYLES:
                    raise ValidationError(f"{p}: 不明なタグスタイル {item['style']!r}")
                val["style"] = item["style"]
            if "title" in item:
                val["title"] = rich(item["title"], p + ".title")
            out.append(val)
        else:
            out.append({"text": rich(item, p)})
    return out


def normalize_data(data: dict) -> tuple[dict, dict]:
    if not isinstance(data, dict):
        raise ValidationError("入力JSONの最上位はオブジェクトである必要があります")
    object_keys(data, {"title", "banner", "meta", "legend", "columns", "rows"}, "root")
    if "title" not in data:
        raise ValidationError("root.title が必要です")
    result = {
        "title": rich(data["title"], "root.title"),
        "banner": rich(data.get("banner", ""), "root.banner"),
        "legend": rich(data.get("legend", ""), "root.legend"),
        "meta": [], "columns": [], "rows": [],
    }
    meta = data.get("meta", [])
    if not isinstance(meta, list):
        raise ValidationError("root.meta は配列です")
    for i, m in enumerate(meta):
        if not isinstance(m, dict) or set(m) != {"label", "value"}:
            raise ValidationError(f"root.meta[{i}]: label と value が必要です")
        result["meta"].append({"label": rich(m["label"], f"meta[{i}].label"), "value": rich(m["value"], f"meta[{i}].value")})
    cols = data.get("columns")
    if not isinstance(cols, list) or not cols:
        raise ValidationError("root.columns は1列以上の配列で指定してください")
    known = set()
    special = []
    for i, col in enumerate(cols):
        if not isinstance(col, dict):
            raise ValidationError(f"columns[{i}]: オブジェクトが必要です")
        object_keys(col, {"key", "label", "kind"}, f"columns[{i}]")
        key = col.get("key")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", key):
            raise ValidationError(f"columns[{i}].key: 英数字で構成されるキーが必要です")
        if key in known:
            raise ValidationError(f"columns[{i}]: 重複キー {key!r}")
        known.add(key)
        kind = col.get("kind", "text")
        if kind not in {"text", "badge", "chips"}:
            raise ValidationError(f"columns[{i}].kind: text/badge/chips のいずれかです")
        if kind != "text":
            special.append((i, kind))
        result["columns"].append({"key": key, "label": rich(col.get("label", key), f"columns[{i}].label"), **({"kind": kind} if kind != "text" else {})})
    if cols[0]["key"] != "name" or cols[0].get("kind", "text") != "text":
        raise ValidationError("最初の列は key='name' の階層名列にしてください")
    # Historically established layout: all badge/chips columns are at the right.
    if special and min(i for i, _ in special) != len(cols) - len(special):
        raise ValidationError("ラベル・参照の列（badge/chips）は通常の列の右側に並べてください")
    if [kind for _, kind in special] != sorted([kind for _, kind in special], key={"badge": 0, "chips": 1}.get):
        raise ValidationError("右端のラベル（badge）→参照（chips）の順で指定してください")
    col_map = {col["key"]: col.get("kind", "text") for col in result["columns"]}
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValidationError("root.rows は1件以上の配列で指定してください")
    metrics = {"rows": 0, "groups": 0, "leaves": 0, "depth": 0}

    def walk(nodes: list, depth: int):
        if depth > 100:
            raise ValidationError("階層が深すぎます（100階層を超えています）")
        out = []
        for i, row in enumerate(nodes):
            p = f"rows(depth={depth})[{i}]"
            if not isinstance(row, dict):
                raise ValidationError(f"{p}: オブジェクトが必要です")
            object_keys(row, {"name", "children", "cells"}, p)
            if "name" not in row:
                raise ValidationError(f"{p}.name が必要です")
            value = {"name": rich(row["name"], p + ".name")}
            children = row.get("children")
            is_group = isinstance(children, list) and len(children) > 0
            if children is not None and not isinstance(children, list):
                raise ValidationError(f"{p}.children: 配列が必要です")
            if is_group and row.get("cells"):
                raise ValidationError(f"{p}: 分類行は統合セルのため cells と children を併用できません")
            if is_group:
                value["children"] = walk(children, depth + 1)
                metrics["groups"] += 1
            else:
                cells = row.get("cells", {})
                if not isinstance(cells, dict):
                    raise ValidationError(f"{p}.cells: オブジェクトが必要です")
                if "name" in cells:
                    raise ValidationError(f"{p}.cells.name: 項目名は row.name で指定してください")
                extra = set(cells) - set(col_map)
                if extra:
                    raise ValidationError(f"{p}.cells: 未定義の列キー {sorted(extra)}")
                processed = {}
                for key, content in cells.items():
                    kind = col_map[key]
                    if kind == "badge":
                        processed[key] = normalize_label(content, f"{p}.cells.{key}")
                    elif kind == "chips":
                        processed[key] = normalize_refs(content, f"{p}.cells.{key}")
                    else:
                        processed[key] = rich(content, f"{p}.cells.{key}")
                value["cells"] = processed
                metrics["leaves"] += 1
            metrics["rows"] += 1
            metrics["depth"] = max(metrics["depth"], depth + 1)
            out.append(value)
        return out

    result["rows"] = walk(rows, 0)
    return result, metrics


def embed(template: str, data: dict) -> str:
    # HTML's script parser terminates at </script> regardless of JS string quoting.
    # Escaping markup in the serialized JSON prevents premature script closure.
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    for ch, val in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"), ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        payload = payload.replace(ch, val)
    replacement = f"const TEMPLATE = {payload};\n\n"
    merged, count = DATA_RE.subn(lambda _m: replacement, template)
    if count != 1:
        raise ValidationError("テンプレートのデータ領域を特定できません。元のHTMLが改変されている可能性があります")
    return merged


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="元の階層HTMLレイアウトを保ったHTMLを生成する")
    parser.add_argument("--input", "-i", required=True, help="JSONファイルのパス（標準入力は -）")
    parser.add_argument("--output", "-o", help="出力HTMLのパス（--validate-only の場合は省略可）")
    parser.add_argument("--validate-only", action="store_true", help="構造とHTMLの検証のみ実行")
    parser.add_argument("--overwrite", action="store_true", help="既存の出力HTMLを明示的に上書き")
    args = parser.parse_args(argv)
    try:
        raw = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8-sig")
        data, metrics = normalize_data(json.loads(raw))
        template = TEMPLATE.read_text(encoding="utf-8")
        generated = embed(template, data)
        if not args.validate_only:
            if not args.output:
                raise ValidationError("--output で出力先を指定してください")
            dest = Path(args.output).expanduser().resolve()
            if dest == TEMPLATE.resolve():
                raise ValidationError("assets/template.html は上書き禁止です")
            if dest.exists() and not args.overwrite:
                raise ValidationError(f"出力先が存在します: {dest}（上書きする場合は --overwrite）")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(generated, encoding="utf-8")
            print(f"CREATED {dest}")
        print(f"VALID: {metrics['rows']} 行 / {metrics['groups']} 分類 / {metrics['leaves']} 項目 / 最大 {metrics['depth']} 階層 / {len(data['columns'])} 列")
        return 0
    except (OSError, ValidationError, json.JSONDecodeError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
