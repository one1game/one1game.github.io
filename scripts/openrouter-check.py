#!/usr/bin/env python3
"""Разовая проверка ключа OpenRouter: что за ключ, баланс, доступные модели.

Сам ключ никуда не печатается — только префикс и данные о лимитах.
Результат складывается в openrouter-check.json.
"""
import json
import os
import pathlib
import urllib.error
import urllib.request

KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
out = {"key_present": bool(KEY), "key_prefix": (KEY[:9] + "…") if KEY else ""}

POPULAR = {
    "google/gemini-3.5-flash", "anthropic/claude-haiku-4.5", "openai/gpt-5.4",
    "anthropic/claude-sonnet-4.6", "openai/gpt-5.5", "deepseek/deepseek-chat",
}


def api(path):
    req = urllib.request.Request(f"https://openrouter.ai/api/v1{path}",
                                 headers={"Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


if KEY:
    try:
        out["key"] = api("/key").get("data", {})
    except urllib.error.HTTPError as err:
        out["key_error"] = f"HTTP {err.code}: {err.read().decode()[:200]}"
    except Exception as err:  # noqa: BLE001
        out["key_error"] = str(err)

    try:
        out["credits"] = api("/credits").get("data", {})
    except urllib.error.HTTPError as err:
        out["credits_error"] = f"HTTP {err.code}"
    except Exception as err:  # noqa: BLE001
        out["credits_error"] = str(err)

    try:
        models = api("/models").get("data", [])
        out["models_total"] = len(models)
        out["models_free"] = sum(1 for m in models if str(m.get("id", "")).endswith(":free"))
        out["models_with_native_web_search"] = sum(
            1 for m in models if (m.get("pricing") or {}).get("web_search"))
        ids = {m.get("id") for m in models}
        out["popular_available"] = sorted(ids & POPULAR)
        out["popular_missing"] = sorted(POPULAR - ids)
    except urllib.error.HTTPError as err:
        out["models_error"] = f"HTTP {err.code}"
    except Exception as err:  # noqa: BLE001
        out["models_error"] = str(err)

pathlib.Path("openrouter-check.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(out, ensure_ascii=False)[:1200])
