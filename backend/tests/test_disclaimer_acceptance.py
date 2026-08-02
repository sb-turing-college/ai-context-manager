"""Tests for disclaimer acceptance helpers."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src import disclaimer_acceptance as da


@pytest.fixture(autouse=True)
def _isolate_marker(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    marker = tmp_path / ".disclaimer_accepted"
    monkeypatch.setattr(da, "DISCLAIMER_MARKER", marker)
    monkeypatch.setattr(da.settings, "disclaimer_accepted", False)
    if marker.exists():
        marker.unlink()
    yield
    if marker.exists():
        marker.unlink()


def test_not_accepted_by_default():
    assert da.is_disclaimer_accepted() is False


def test_accept_creates_marker():
    da.accept_disclaimer()
    assert da.DISCLAIMER_MARKER.is_file()
    assert da.is_disclaimer_accepted() is True


def test_env_bypass(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(da.settings, "disclaimer_accepted", True)
    assert da.is_disclaimer_accepted() is True


def test_require_raises_when_missing():
    with pytest.raises(HTTPException) as exc:
        da.require_disclaimer_accepted()
    assert exc.value.status_code == 403
