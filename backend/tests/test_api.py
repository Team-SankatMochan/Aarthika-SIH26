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


def test_stress_test_api(client: TestClient, sample_business):
    """Test crash test execution and retrieval via API."""
    biz_id = sample_business["business"].id

    run_resp = client.post(f"/businesses/{biz_id}/stress-tests", json={})
    assert run_resp.status_code == 201
    st_data = run_resp.json()
    assert len(st_data["scenarios"]) >= 6
    st_id = st_data["id"]

    get_resp = client.get(f"/stress-tests/{st_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == st_id


def test_pilot_and_results_api(client: TestClient, sample_business):
    """Test pilot experiment creation and result logging via API."""
    biz_id = sample_business["business"].id

    pilot_payload = {
        "business_id": biz_id,
        "objective": "Validate morning fresh milk doorstep demand in Ausa ward",
        "hypothesis": "At least 25 households will purchase 1L daily at Rs 55",
        "duration_days": 14,
    }
    p_resp = client.post(f"/businesses/{biz_id}/pilots", json=pilot_payload)
    assert p_resp.status_code == 201
    pilot_id = p_resp.json()["id"]

    # Record results
    result_payload = {
        "target_customers": 30,
        "actual_customers": 28,
        "repeat_purchase_rate": 75.00,
        "price_acceptance": 90.00,
        "actual_revenue": 21560.00,
        "actual_cost": 13320.00,
        "customer_feedback": "Milk quality was appreciated by local families.",
    }
    r_resp = client.post(f"/pilots/{pilot_id}/results", json=result_payload)
    assert r_resp.status_code == 201
    assert r_resp.json()["actual_customers"] == 28


def test_finance_assessment_api(client: TestClient, sample_business, seeded_schemes):
    """Test financial calculation endpoint via API."""
    biz_id = sample_business["business"].id

    calc_payload = {
        "project_cost": 140000.00,
        "monthly_net_cash_flow": 12000.00,
    }
    fa_resp = client.post(f"/businesses/{biz_id}/finance-assessment", json=calc_payload)
    assert fa_resp.status_code == 201
    fa_data = fa_resp.json()
    assert Decimal(str(fa_data["maximum_loan"])) == Decimal("125000.00")
    assert Decimal(str(fa_data["emi"])) > 0
    assert fa_data["debt_affordability_status"] in ["AFFORDABLE", "STRETCHED", "UNSUSTAINABLE"]

    get_resp = client.get(f"/businesses/{biz_id}/finance-assessment")
    assert get_resp.status_code == 200
    assert Decimal(str(get_resp.json()["maximum_loan"])) == Decimal("125000.00")


def test_pre_investment_decision_api(client: TestClient, sample_business, seeded_schemes):
    """Test decision endpoint (GO / MODIFY / DO_NOT_INVEST_YET)."""
    biz_id = sample_business["business"].id

    # Run stress test and finance assessment first
    client.post(f"/businesses/{biz_id}/stress-tests", json={})
    client.post(f"/businesses/{biz_id}/finance-assessment", json={"project_cost": 140000.00})

    dec_resp = client.post(f"/businesses/{biz_id}/decision")
    assert dec_resp.status_code == 201
    data = dec_resp.json()
    assert data["decision"] in ["GO", "MODIFY", "DO_NOT_INVEST_YET"]
    assert len(data["rationale"]) > 10


def test_watermelon_sync_api(client: TestClient):
    """Test POST /sync endpoint with WatermelonDB payload."""
    sync_payload = {
        "changes": {
            "locations": {
                "created": [
                    {
                        "id": "loc_api_1",
                        "state": "Maharashtra",
                        "district": "Solapur",
                        "village_or_city": "Pandharpur",
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
