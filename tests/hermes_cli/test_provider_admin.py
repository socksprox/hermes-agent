"""Tests for provider_admin dashboard helpers."""

from __future__ import annotations

import pytest


@pytest.fixture
def isolated_home(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    monkeypatch.setenv("HERMES_HOME", str(home))
    (home / "config.yaml").write_text(
        "model:\n  default: gpt-4o\n  provider: openrouter\n",
        encoding="utf-8",
    )
    return home


def test_build_provider_schema_returns_sources(isolated_home):
    from hermes_cli.provider_admin import build_provider_schema

    payload = build_provider_schema()
    assert "sources" in payload
    assert isinstance(payload["sources"], list)
    assert "main" in payload
    assert payload["main"]["provider"] == "openrouter"


def test_upsert_and_delete_custom_source(isolated_home):
    from hermes_cli.config import load_config
    from hermes_cli.provider_admin import delete_custom_source, upsert_custom_source

    upsert_custom_source(
        name="local-llm",
        base_url="http://127.0.0.1:8080/v1",
        model="llama-3",
    )
    cfg = load_config()
    entries = cfg.get("custom_providers") or []
    assert any(e.get("name") == "local-llm" for e in entries if isinstance(e, dict))

    delete_custom_source("local-llm")
    cfg = load_config()
    entries = cfg.get("custom_providers") or []
    assert not any(e.get("name") == "local-llm" for e in entries if isinstance(e, dict))
