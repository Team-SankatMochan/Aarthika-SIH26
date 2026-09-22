from decimal import Decimal
from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """Test /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data


def test_users_crud_api(client: TestClient):
    """Test user creation and retrieval via API."""
    user_payload = {
        "name": "Kavita Rao",
        "phone": "+919833445566",
        "available_capital": 35000.00,
        "skills": ["tailoring", "embroidery"],
        "risk_tolerance": "MODERATE",
    }
    create_resp = client.post("/users", json=user_payload)
    assert create_resp.status_code == 201
    created_user = create_resp.json()
    assert created_user["name"] == "Kavita Rao"
    user_id = created_user["id"]

    get_resp = client.get(f"/users/{user_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == user_id


def test_schemes_api(client: TestClient, seeded_schemes):
    """Test schemes listing and retrieval via API."""
    list_resp = client.get("/schemes")
    assert list_resp.status_code == 200
    schemes = list_resp.json()
    assert len(schemes) >= 2

    scheme_id = schemes[0]["id"]
    get_resp = client.get(f"/schemes/{scheme_id}")
    assert get_resp.status_code == 200
    assert len(get_resp.json()["rules"]) >= 1


def test_business_and_assumptions_api(client: TestClient, sample_business):
    """Test business assumptions submission and retrieval."""
    biz_id = sample_business["business"].id

    assumption_payload = {
        "business_id": biz_id,
        "expected_customers": 50,
        "selling_price": 55.00,
        "production_volume": 100.00,
        "raw_material_cost": 32.00,
        "labour_cost": 5000.00,
        "rent": 2000.00,
        "transport_cost": 1500.00,
        "working_capital": 20000.00,
        "proposed_loan_amount": 100000.00,
    }

    create_resp = client.post(f"/businesses/{biz_id}/assumptions", json=assumption_payload)
    assert create_resp.status_code == 201
    assert create_resp.json()["expected_customers"] == 50

    list_resp = client.get(f"/businesses/{biz_id}/assumptions")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1


# Obsolete Phase 0 endpoints removed from test suite for Phase 1 verification


def test_watermelon_sync_api(client: TestClient):
    """Test POST /sync endpoint with WatermelonDB payload."""
    sync_payload = {
        "sync_request_id": "test_req_api_1",
        "changes": {
            "users": {
                "created": [
                    {
                        "id": "loc_api_1",
                        "name": "Test User",
                        "phone": "9999999999",
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        },
        "lastPulledAt": 1724920000000,
    }

    resp = client.post("/sync", json=sync_payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "success"
    assert "timestamp" in res_data
