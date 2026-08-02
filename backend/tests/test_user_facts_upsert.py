"""UserFact upsert identity (category + normalized title)."""

import pytest


def test_upsert_merges_on_normalized_title(test_client) -> None:
    first = test_client.post(
        "/api/v1/user-facts",
        json={
            "category": "context",
            "title": "Remote work setup",
            "content": "EOR only",
        },
    )
    assert first.status_code == 201
    fact_id = first.json()["id"]

    second = test_client.post(
        "/api/v1/user-facts",
        json={
            "category": "context",
            "title": "  REMOTE WORK SETUP  ",
            "content": "EOR only — Deel/Remote.com",
        },
    )
    assert second.status_code == 200
    assert second.json()["id"] == fact_id
    assert "Deel" in second.json()["content"]

    listed = test_client.get("/api/v1/user-facts")
    assert listed.status_code == 200
    context_facts = [f for f in listed.json() if f["category"] == "context"]
    matching = [f for f in context_facts if f["id"] == fact_id]
    assert len(matching) == 1


def test_different_titles_remain_separate(test_client) -> None:
    a = test_client.post(
        "/api/v1/user-facts",
        json={"category": "preference", "title": "Tone A", "content": "x"},
    )
    b = test_client.post(
        "/api/v1/user-facts",
        json={"category": "preference", "title": "Tone B", "content": "y"},
    )
    assert a.status_code == 201
    assert b.status_code == 201
    assert a.json()["id"] != b.json()["id"]
