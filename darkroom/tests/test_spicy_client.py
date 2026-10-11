"""Unit tests for the SpicyAPI client helpers (no network)."""
import pytest

from spicy_client import FRAME_SIZES, SpicyClient, SpicyRejected, estimate_cost, is_public_https


def test_estimate_cost_table():
    e = estimate_cost("spicy-motion-3", 10, "720P")
    assert e["usd"] == pytest.approx(2.001) and not e["smart"]
    assert estimate_cost("spicy-motion-3", 10, "720P", fps60=True)["usd"] == pytest.approx(2.401)
    assert estimate_cost("spicy-motion-3-fast", 5, "1080P")["usd"] == pytest.approx(2.801)
    smart = estimate_cost("spicy-motion-3", -1, "480P", frame_model="spicy-image-1")
    assert smart["smart"] and smart["usd"] == pytest.approx(30 * 0.10 + 0.06 + 0.002) and "refunded" in smart["breakdown"]
    assert estimate_cost("unknown-model", 1, "nope")["usd"] == pytest.approx(2 * 0.20 + 0.001)  # clamps to defaults


def test_frame_sizes_are_the_documented_eleven():
    assert len(FRAME_SIZES) == 11 and "1440*1440" in FRAME_SIZES and "832*1216" in FRAME_SIZES


def test_moderation_problem_mapping():
    assert SpicyClient.moderation_problem({"outcome": "allow", "flagged": False}) is None
    review = SpicyClient.moderation_problem({"outcome": "review", "flagged": True, "category": "minor", "categories": {"minor": 0.55, "gore": 0.0}})
    assert isinstance(review, SpicyRejected) and review.kind == "moderation_review" and "minor 55%" in str(review)
    block = SpicyClient.moderation_problem({"outcome": "block", "flagged": True, "category": "real_person"})
    assert block.kind == "moderation_blocked" and block.status == 422
    legacy = SpicyClient.moderation_problem({"flagged": True})  # no outcome field at all
    assert legacy is not None and legacy.kind == "moderation_blocked"


def test_download_host_policy():
    assert is_public_https("https://cdn.spicyapi.com/outputs/a/b.mp4")
    assert is_public_https("https://some-other-cdn.example.net/x.mp4")
    assert not is_public_https("http://cdn.spicyapi.com/x.mp4")          # plain http
    assert not is_public_https("https://127.0.0.1/x.mp4")
    assert not is_public_https("https://192.168.1.5/x.mp4")
    assert not is_public_https("https://[::1]/x.mp4")
    assert not is_public_https("https://localhost/x.mp4")
    assert not is_public_https("https://169.254.169.254/latest")         # link-local / metadata


def test_client_rejects_empty_key_and_normalises_base_url():
    with pytest.raises(ValueError):
        SpicyClient("  ")
    c = SpicyClient("sk-spicy-abcdefghijklmnopqrstuvwxyz", "http://127.0.0.1:1/")
    assert c.base_url.endswith("/v1") and c.key_hint.startswith("sk-spicy-") and "…" in c.key_hint
