"""RythuMitra backend integration tests."""
from __future__ import annotations

import os
import time
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env to get public backend url
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TEST_MOBILE = "9876543210"
TEST_PASSWORD = "pass1234"
TEST_NAME = "Ramesh Kumar"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    """Ensure seeded user exists, return {token, user}."""
    # try register
    r = session.post(f"{API}/auth/register", json={
        "full_name": TEST_NAME,
        "mobile": TEST_MOBILE,
        "password": TEST_PASSWORD,
        "email": "ramesh@example.com",
    })
    if r.status_code == 200:
        return r.json()
    # else login
    r = session.post(f"{API}/auth/login", json={"mobile": TEST_MOBILE, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def token(auth):
    return auth["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------------------------------------------------
# Auth tests
# ------------------------------------------------------------
class TestAuth:
    def test_register_duplicate_returns_409(self, session, auth):
        r = session.post(f"{API}/auth/register", json={
            "full_name": TEST_NAME,
            "mobile": TEST_MOBILE,
            "password": TEST_PASSWORD,
        })
        assert r.status_code == 409, f"Expected 409 got {r.status_code}: {r.text}"

    def test_login_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"mobile": TEST_MOBILE, "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_returns_token_and_user(self, session):
        r = session.post(f"{API}/auth/login", json={"mobile": TEST_MOBILE, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert "user" in data
        assert data["user"]["mobile"] == TEST_MOBILE
        assert "_id" not in data["user"]
        assert "password_hash" not in data["user"]

    def test_me_without_token_401(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token_ok(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "user" in body
        assert body["user"]["mobile"] == TEST_MOBILE
        assert "_id" not in body["user"]
        assert "password_hash" not in body["user"]

    def test_patch_me_updates_language(self, auth_headers):
        r = requests.patch(f"{API}/auth/me", json={"preferred_language": "te"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["user"]["preferred_language"] == "te"
        # verify via GET
        r2 = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r2.json()["user"]["preferred_language"] == "te"
        # revert
        requests.patch(f"{API}/auth/me", json={"preferred_language": "en"}, headers=auth_headers)


# ------------------------------------------------------------
# Fields & Devices
# ------------------------------------------------------------
class TestFieldsDevices:
    def test_fields_seeded(self, auth_headers):
        r = requests.get(f"{API}/fields", headers=auth_headers)
        assert r.status_code == 200
        fields = r.json()["fields"]
        names = {f["name"] for f in fields}
        assert {"North Field", "South Field", "East Field"}.issubset(names), f"Got: {names}"
        for f in fields:
            assert "_id" not in f

    def test_devices_seeded(self, auth_headers):
        r = requests.get(f"{API}/devices", headers=auth_headers)
        assert r.status_code == 200
        devices = r.json()["devices"]
        assert len(devices) >= 1
        for d in devices:
            assert "_id" not in d

    def test_toggle_device_flips_connected(self, auth_headers):
        r = requests.get(f"{API}/devices", headers=auth_headers)
        dev = r.json()["devices"][0]
        initial = dev["connected"]
        r2 = requests.post(f"{API}/devices/{dev['id']}/toggle", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["device"]["connected"] == (not initial)
        # toggle back
        r3 = requests.post(f"{API}/devices/{dev['id']}/toggle", headers=auth_headers)
        assert r3.json()["device"]["connected"] == initial

    @pytest.mark.parametrize("action,expected_status", [
        ("start", "running"),
        ("pause", "paused"),
        ("stop", "stopped"),
        ("refresh", None),
        ("sync", None),
    ])
    def test_control_device_actions(self, auth_headers, action, expected_status):
        r = requests.get(f"{API}/devices", headers=auth_headers)
        dev = r.json()["devices"][0]
        # control endpoint expects form data
        headers = {"Authorization": auth_headers["Authorization"]}
        r2 = requests.post(f"{API}/devices/{dev['id']}/control", data={"action": action}, headers=headers)
        assert r2.status_code == 200, f"{action}: {r2.status_code} {r2.text}"
        d = r2.json()["device"]
        if expected_status:
            assert d["status"] == expected_status, f"action {action} -> {d['status']}"


# ------------------------------------------------------------
# Sensors
# ------------------------------------------------------------
class TestSensors:
    def test_live_sensors_returns_full_payload(self, auth_headers):
        fr = requests.get(f"{API}/fields", headers=auth_headers).json()["fields"]
        fid = fr[0]["id"]
        r = requests.get(f"{API}/sensors/live", params={"field_id": fid}, headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "field" in body and "readings" in body and "alerts" in body
        readings = body["readings"]
        for key in ("nitrogen", "phosphorus", "potassium", "moisture"):
            assert key in readings
            assert "value" in readings[key]
            assert "status" in readings[key]
            assert readings[key]["status"] in ("Low", "Good", "High")
        assert "_id" not in body["field"]

    def test_live_sensors_values_change_over_time(self, auth_headers):
        fr = requests.get(f"{API}/fields", headers=auth_headers).json()["fields"]
        fid = fr[0]["id"]
        r1 = requests.get(f"{API}/sensors/live", params={"field_id": fid}, headers=auth_headers).json()
        time.sleep(5)
        r2 = requests.get(f"{API}/sensors/live", params={"field_id": fid}, headers=auth_headers).json()
        # snapshot bucket is 4s so 5s gap should shift values in at least one metric
        changed = any(
            r1["readings"][k]["value"] != r2["readings"][k]["value"]
            for k in ("nitrogen", "phosphorus", "potassium", "moisture")
        )
        assert changed, "Sensor readings did not change after 5s"


# ------------------------------------------------------------
# Advice
# ------------------------------------------------------------
class TestAdvice:
    def test_rule_based_advice(self, auth_headers):
        fr = requests.get(f"{API}/fields", headers=auth_headers).json()["fields"]
        fid = fr[0]["id"]
        r = requests.post(f"{API}/advice/generate", json={
            "field_id": fid, "recommendation_type": "fertilizer", "model": "rule"
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["model_used"] == "rule"
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) >= 1
        for rec in body["recommendations"]:
            assert "title" in rec and "detail" in rec and "priority" in rec
        assert "_id" not in body

    def test_claude_advice_returns_recommendations(self, auth_headers):
        fr = requests.get(f"{API}/fields", headers=auth_headers).json()["fields"]
        fid = fr[0]["id"]
        r = requests.post(f"{API}/advice/generate", json={
            "field_id": fid, "recommendation_type": "fertilizer", "model": "claude"
        }, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["model_used"] == "claude"
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) >= 1, "Claude/fallback produced no recommendations"
        assert isinstance(body.get("summary", ""), str)


# ------------------------------------------------------------
# Planner
# ------------------------------------------------------------
class TestPlanner:
    def test_planner_returns_wheat_cycle(self, auth_headers):
        r = requests.get(f"{API}/planner", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["cycle"] is not None
        cycle = body["cycle"]
        assert cycle["crop"] == "Wheat"
        assert cycle["duration_days"] == 120
        assert cycle["progress"] > 0
        assert len(body["tasks"]) >= 10
        assert body["today_task"] is not None
        assert "_id" not in cycle

    def test_planner_complete_task(self, auth_headers):
        planner = requests.get(f"{API}/planner", headers=auth_headers).json()
        # find first not-completed task
        pending = next((t for t in planner["tasks"] if not t["completed"]), None)
        assert pending is not None
        tid = pending["id"]
        r = requests.post(f"{API}/planner/complete", json={"task_id": tid}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # verify completion via GET
        planner2 = requests.get(f"{API}/planner", headers=auth_headers).json()
        task = next(t for t in planner2["tasks"] if t["id"] == tid)
        assert task["completed"] is True

    def test_planner_reminders_toggle(self, auth_headers):
        headers = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{API}/planner/reminders", data={"enabled": "false"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["enabled"] is False
        r = requests.post(f"{API}/planner/reminders", data={"enabled": "true"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["enabled"] is True


# ------------------------------------------------------------
# ObjectId leak check across all endpoints
# ------------------------------------------------------------
class TestNoObjectIdLeak:
    def test_no_underscore_id_in_any_response(self, auth_headers):
        endpoints = ["/fields", "/devices", "/planner", "/auth/me"]
        for ep in endpoints:
            r = requests.get(f"{API}{ep}", headers=auth_headers)
            assert r.status_code == 200
            assert '"_id"' not in r.text, f"_id leaked in {ep}"
