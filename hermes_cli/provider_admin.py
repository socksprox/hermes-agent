"""Dashboard provider administration — schema + CRUD for the Models & Providers UI.

Orchestrates inventory, config, env, and OAuth without duplicating
``hermes_cli/models.py`` catalogs in the frontend.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

import httpx


def build_provider_schema(*, profile: Optional[str] = None) -> dict:
    """Return the full provider workbench payload for GET /api/providers/schema."""
    from hermes_cli.config import get_compatible_custom_providers, load_config
    from hermes_cli.inventory import build_models_payload, load_picker_context

    ctx = load_picker_context()
    picker = build_models_payload(
        ctx,
        max_models=50,
        include_unconfigured=True,
        picker_hints=True,
        canonical_order=True,
        pricing=True,
        capabilities=True,
    )

    cfg = load_config()
    model_cfg = cfg.get("model", {}) if isinstance(cfg.get("model"), dict) else {}
    custom_entries = get_compatible_custom_providers(cfg)

    sources: List[dict] = []
    for row in picker.get("providers") or []:
        slug = str(row.get("slug") or row.get("name") or "").strip()
        if not slug:
            continue
        sources.append(_row_to_source(row, custom_entries))

    return {
        "sources": sources,
        "main": {
            "provider": picker.get("provider") or "",
            "model": picker.get("model") or "",
        },
        "fallback_model": str(cfg.get("fallback_model") or ""),
        "model_context_length": int(model_cfg.get("context_length") or 0),
        "custom_providers": _serialize_custom_entries(custom_entries),
    }


def _row_to_source(row: dict, custom_entries: list) -> dict:
    slug = str(row.get("slug") or row.get("name") or "").lower()
    custom = _find_custom_by_slug(slug, custom_entries)
    return {
        "id": slug,
        "name": row.get("name") or slug,
        "slug": slug,
        "authenticated": bool(row.get("authenticated", True)),
        "auth_type": row.get("auth_type"),
        "key_env": row.get("key_env"),
        "warning": row.get("warning"),
        "base_url": (custom or {}).get("base_url") or row.get("base_url") or "",
        "api_mode": (custom or {}).get("api_mode") or row.get("api_mode") or "",
        "is_current": bool(row.get("is_current")),
        "is_user_defined": bool(row.get("is_user_defined")),
        "models": list(row.get("models") or []),
        "total_models": int(row.get("total_models") or len(row.get("models") or [])),
        "capabilities": row.get("capabilities") or {},
        "pricing": row.get("pricing"),
        "free_tier": row.get("free_tier"),
        "unavailable_models": row.get("unavailable_models") or [],
    }


def _find_custom_by_slug(slug: str, entries: list) -> Optional[dict]:
    slug_l = slug.lower()
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").lower()
        if name == slug_l or name == f"custom:{slug_l}":
            return entry
    return None


def _serialize_custom_entries(entries: list) -> List[dict]:
    out: List[dict] = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        out.append(
            {
                "name": entry.get("name", ""),
                "base_url": entry.get("base_url", ""),
                "model": entry.get("model", ""),
                "api_mode": entry.get("api_mode", ""),
                "models": entry.get("models") or {},
            }
        )
    return out


def _auto_provider_name(base_url: str) -> str:
    from hermes_cli.main import _auto_provider_name as _cli_auto

    return _cli_auto(base_url)


def upsert_custom_source(
    *,
    name: Optional[str] = None,
    base_url: str,
    model: str = "",
    api_mode: str = "",
    api_key: str = "",
) -> dict:
    """Create or update a custom_providers entry."""
    from hermes_cli.config import load_config, save_config

    base_url = base_url.rstrip("/")
    if not base_url:
        raise ValueError("base_url is required")

    cfg = load_config()
    providers = cfg.get("custom_providers") or []
    if not isinstance(providers, list):
        providers = []

    entry_name = (name or _auto_provider_name(base_url)).strip()
    matched = None
    for entry in providers:
        if not isinstance(entry, dict):
            continue
        if entry.get("base_url", "").rstrip("/") == base_url:
            matched = entry
            break
        if entry.get("name", "").lower() == entry_name.lower():
            matched = entry
            break

    if matched is None:
        matched = {"name": entry_name, "base_url": base_url}
        providers.append(matched)
    else:
        matched["name"] = entry_name
        matched["base_url"] = base_url

    if model:
        matched["model"] = model
    if api_mode:
        matched["api_mode"] = api_mode
    elif "api_mode" in matched:
        matched.pop("api_mode", None)

    if api_key:
        matched["api_key"] = api_key

    cfg["custom_providers"] = providers
    save_config(cfg)
    return {"ok": True, "name": entry_name, "base_url": base_url}


def delete_custom_source(source_id: str) -> dict:
    """Remove a custom_providers entry by name or slug."""
    from hermes_cli.config import load_config, save_config

    sid = source_id.strip().lower()
    cfg = load_config()
    providers = cfg.get("custom_providers") or []
    if not isinstance(providers, list):
        providers = []

    kept = []
    removed = None
    for entry in providers:
        if not isinstance(entry, dict):
            kept.append(entry)
            continue
        name = str(entry.get("name") or "").lower()
        if name == sid or name == f"custom:{sid}":
            removed = entry
            continue
        kept.append(entry)

    if removed is None:
        raise KeyError(f"Custom provider not found: {source_id}")

    cfg["custom_providers"] = kept
    save_config(cfg)
    return {"ok": True, "removed": removed.get("name", source_id)}


def fetch_live_models_for_source(source_id: str) -> dict:
    """Enumerate models from a provider's live API."""
    from hermes_cli.config import get_compatible_custom_providers, load_config

    sid = source_id.strip().lower()
    cfg = load_config()
    custom_entries = get_compatible_custom_providers(cfg)
    custom = _find_custom_by_slug(sid, custom_entries)

    base_url = ""
    api_key = ""
    if custom:
        base_url = str(custom.get("base_url") or "").rstrip("/")
        api_key = str(custom.get("api_key") or "").strip()
    elif sid == "custom" or sid.startswith("custom:"):
        model_cfg = cfg.get("model", {})
        if isinstance(model_cfg, dict):
            base_url = str(model_cfg.get("base_url") or "").rstrip("/")
            api_key = str(model_cfg.get("api_key") or "").strip()

    if not base_url:
        from hermes_cli.inventory import build_models_payload, load_picker_context

        ctx = load_picker_context()
        payload = build_models_payload(ctx, include_unconfigured=True, picker_hints=True)
        for row in payload.get("providers") or []:
            if str(row.get("slug") or "").lower() == sid:
                return {
                    "source_id": sid,
                    "models": list(row.get("models") or []),
                    "live": False,
                }
        return {"source_id": sid, "models": [], "live": False}

    url = base_url + "/models"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    try:
        with httpx.Client(timeout=httpx.Timeout(12.0)) as client:
            resp = client.get(url, headers=headers)
        ids = _parse_model_ids(resp)
        return {"source_id": sid, "models": ids, "live": True, "reachable": resp.is_success}
    except Exception as exc:
        return {
            "source_id": sid,
            "models": [],
            "live": True,
            "reachable": False,
            "error": str(exc),
        }


def _parse_model_ids(resp: Any) -> List[str]:
    """Extract model ids from an OpenAI-compatible ``/v1/models`` response."""
    try:
        if not resp.is_success:
            return []
        payload = resp.json()
    except Exception:
        return []
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, list):
        return []
    ids: List[str] = []
    for item in data:
        if isinstance(item, dict):
            mid = str(item.get("id") or "").strip()
        else:
            mid = str(item or "").strip()
        if mid:
            ids.append(mid)
    return ids


def clear_provider_account(provider_id: str) -> dict:
    """Remove the first credential pool entry and run source-specific cleanup."""
    from agent.credential_sources import find_removal_step
    from hermes_cli.auth import suppress_credential_source
    from agent.credential_pool import load_pool

    pid = provider_id.strip().lower()
    pool = load_pool(pid)
    if not pool.entries:
        return {"ok": False, "message": "No credentials found for this provider."}

    removed = pool.remove_index(1)
    if removed is None:
        return {"ok": False, "message": "Could not remove credential."}

    step = find_removal_step(pid, removed.source)
    if step is not None:
        result = step.remove_fn(pid, removed)
        for line in result.cleaned:
            pass  # dashboard returns structured response only
        if result.suppress:
            suppress_credential_source(pid, removed.source)

    return {"ok": True, "provider": pid, "removed_label": removed.label}
