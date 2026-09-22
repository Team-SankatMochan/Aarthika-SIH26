from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.models.evidence import Evidence, validate_canonical_evidence
from app.models.evidence_enums import SourceType, EvidenceType, ProviderStatus, FreshnessStatus, ProviderMode
from app.providers.dto import MarketPriceObservation, ProviderResult, normalize_market_unit
from app.providers.mock_market_provider import MockMarketPriceProvider
from app.providers.live_market_provider import LiveMarketPriceProvider
from app.services.canonical_hash import compute_evidence_content_hash
from app.services.freshness_policy import FreshnessPolicy
from app.services.evidence_service import EvidenceService


# ==============================================================================
# 1. VALIDATION TESTS (Matrix items 6 - 14)
# ==============================================================================

def test_numeric_only_canonical_evidence_accepted():
    """6. Numeric-only canonical evidence is accepted."""
    validate_canonical_evidence(
        source_type=SourceType.USER_ENTERED,
        evidence_type=EvidenceType.MARKET_PRICE,
        numeric_value=Decimal("2500.5000"),
    )


def test_text_only_canonical_evidence_accepted():
    """7. Text-only canonical evidence is accepted."""
    validate_canonical_evidence(
        source_type=SourceType.USER_ENTERED,
        evidence_type=EvidenceType.BUSINESS_CONTEXT,
        text_value="High local demand observed during festival season.",
    )


def test_boolean_only_canonical_evidence_accepted():
    """8. Boolean-only canonical evidence is accepted."""
    validate_canonical_evidence(
        source_type=SourceType.USER_ENTERED,
        evidence_type=EvidenceType.DISTRICT_STATISTIC,
        boolean_value=True,
    )


def test_numeric_and_text_rejected():
    """9. Numeric + text rejected."""
    with pytest.raises(ValueError, match="exactly one"):
        validate_canonical_evidence(
            source_type=SourceType.USER_ENTERED,
            evidence_type=EvidenceType.MARKET_PRICE,
            numeric_value=Decimal("2500.00"),
            text_value="Two thousand five hundred",
        )


def test_numeric_and_boolean_rejected():
    """10. Numeric + boolean rejected."""
    with pytest.raises(ValueError, match="exactly one"):
        validate_canonical_evidence(
            source_type=SourceType.USER_ENTERED,
            evidence_type=EvidenceType.MARKET_PRICE,
            numeric_value=Decimal("2500.00"),
            boolean_value=True,
        )


def test_text_and_boolean_rejected():
    """11. Text + boolean rejected."""
    with pytest.raises(ValueError, match="exactly one"):
        validate_canonical_evidence(
            source_type=SourceType.USER_ENTERED,
            evidence_type=EvidenceType.BUSINESS_CONTEXT,
            text_value="Active",
            boolean_value=True,
        )


def test_all_null_canonical_record_rejected():
    """12. All-null canonical record rejected."""
    with pytest.raises(ValueError, match="none provided"):
        validate_canonical_evidence(
            source_type=SourceType.USER_ENTERED,
            evidence_type=EvidenceType.MARKET_PRICE,
        )


def test_derived_without_parents_rejected():
    """13. DERIVED without parents rejected."""
    with pytest.raises(ValueError, match="parent_evidence_ids"):
        validate_canonical_evidence(
            source_type=SourceType.DERIVED,
            evidence_type=EvidenceType.MARKET_PRICE,
            numeric_value=Decimal("120.00"),
            derivation_type="MOVING_AVERAGE",
            derivation_version="1.0",
            parent_evidence_ids=[],
        )

    with pytest.raises(ValueError, match="derivation_type"):
        validate_canonical_evidence(
            source_type=SourceType.DERIVED,
            evidence_type=EvidenceType.MARKET_PRICE,
            numeric_value=Decimal("120.00"),
            derivation_type=None,
            derivation_version="1.0",
            parent_evidence_ids=["ev_1"],
        )


def test_derived_with_valid_parents_accepted():
    """14. DERIVED with valid parents accepted."""
    validate_canonical_evidence(
        source_type=SourceType.DERIVED,
        evidence_type=EvidenceType.MARKET_PRICE,
        numeric_value=Decimal("120.00"),
        derivation_type="MOVING_AVERAGE",
        derivation_version="1.0",
        parent_evidence_ids=["ev_1", "ev_2"],
    )


# ==============================================================================
# 2. PROVIDER TESTS (Matrix items 24 - 29)
# ==============================================================================

def test_mock_provider_returns_success_and_mock_demo():
    """24. Mock provider returns SUCCESS + MOCK_DEMO."""
    provider = MockMarketPriceProvider(base_url="http://mock-test:8001")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "SUCCESS",
        "source": "AGMARKNET_MOCK",
        "data": [
            {
                "commodity": "Tomato",
                "state": "Karnataka",
                "district": "Kolar",
                "market": "Kolar",
                "arrival_date": "2026-09-02",
                "unit": "Rs/quintal",
                "min_price": 1800,
                "max_price": 2600,
                "modal_price": 2200,
            }
        ],
    }

    with patch("httpx.Client.get", return_value=mock_response):
        result = provider.fetch_market_prices(commodity="Tomato", state="Karnataka")

    assert result.status == ProviderStatus.SUCCESS
    assert result.source_type == SourceType.MOCK_DEMO
    assert len(result.observations) == 3
    modal_obs = next(o for o in result.observations if o.price_type == "MODAL")
    assert modal_obs.numeric_value == Decimal("2200")
    assert modal_obs.currency == "INR"
    assert modal_obs.quantity_unit == "QUINTAL"


def test_mock_provider_timeout_handling():
    """25. Provider timeout returns TIMEOUT status."""
    provider = MockMarketPriceProvider(base_url="http://mock-test:8001")
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Read timeout")):
        result = provider.fetch_market_prices(commodity="Tomato")

    assert result.status == ProviderStatus.TIMEOUT
    assert result.source_type == SourceType.MOCK_DEMO
    assert len(result.observations) == 0


def test_mock_provider_invalid_json_and_schema():
    """26. Invalid JSON / schema returns INVALID_RESPONSE."""
    provider = MockMarketPriceProvider(base_url="http://mock-test:8001")
    
    # Non-JSON response
    mock_res_bad_json = MagicMock()
    mock_res_bad_json.status_code = 200
    mock_res_bad_json.json.side_effect = ValueError("Invalid JSON")
    with patch("httpx.Client.get", return_value=mock_res_bad_json):
        result = provider.fetch_market_prices(commodity="Tomato")
    assert result.status == ProviderStatus.INVALID_RESPONSE

    # Bad schema (data is not a list)
    mock_res_bad_schema = MagicMock()
    mock_res_bad_schema.status_code = 200
    mock_res_bad_schema.json.return_value = {"status": "SUCCESS", "data": "not a list"}
    with patch("httpx.Client.get", return_value=mock_res_bad_schema):
        result2 = provider.fetch_market_prices(commodity="Tomato")
    assert result2.status == ProviderStatus.INVALID_RESPONSE


def test_mock_provider_no_data():
    """27. Empty data list returns NO_DATA."""
    provider = MockMarketPriceProvider(base_url="http://mock-test:8001")
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {"status": "SUCCESS", "data": []}

    with patch("httpx.Client.get", return_value=mock_res):
        result = provider.fetch_market_prices(commodity="Dragonfruit")

    assert result.status == ProviderStatus.NO_DATA
    assert len(result.observations) == 0


def test_live_with_no_configured_provider_returns_unavailable():
    """28. LIVE mode with no configured live provider returns PROVIDER_UNAVAILABLE."""
    live_prov = LiveMarketPriceProvider(provider_url=None)
    res = live_prov.fetch_market_prices(commodity="Tomato")
    assert res.status == ProviderStatus.PROVIDER_UNAVAILABLE
    assert res.source_type == SourceType.GOVERNMENT


def test_live_mode_never_falls_back_to_mock(db_session):
    """29. LIVE mode never falls back to mock provider."""
    mock_prov = MagicMock()
    live_prov = LiveMarketPriceProvider(provider_url=None)

    service = EvidenceService(
        db=db_session,
        provider_mode="LIVE",
        mock_provider=mock_prov,
        live_provider=live_prov,
    )
    result = service.get_market_price(commodity="Tomato")

    # Mock provider must NEVER be called in LIVE mode
    mock_prov.fetch_market_prices.assert_not_called()
    assert result.status == ProviderStatus.PROVIDER_UNAVAILABLE
    assert result.evidence is None


# ==============================================================================
# 3. PRECISION & DECIMAL TESTS (Matrix items 30 - 31)
# ==============================================================================

def test_decimal_market_price_survives_roundtrip_exactly(db_session):
    """30. Decimal market price survives provider -> DB -> serialization roundtrip exactly."""
    exact_price = Decimal("2750.1250")
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="TEST_PROVIDER",
        commodity="Onion",
        numeric_value=exact_price,
        currency="INR",
        quantity_unit="QUINTAL",
        retrieved_at=datetime.now(timezone.utc),
    )
    db_session.add(ev)
    db_session.commit()
    db_session.refresh(ev)

    assert ev.numeric_value == exact_price
    d = ev.to_dict()
    # 31. Canonical decimal JSON string verified
    assert d["numeric_value"] == "2750.1250"
    assert isinstance(d["numeric_value"], str)


# ==============================================================================
# 4. CACHE & FRESHNESS TESTS (Matrix items 32 - 38)
# ==============================================================================

def test_fresh_cache_avoids_provider_call(db_session):
    """32. Fresh cache avoids provider call."""
    now = datetime.now(timezone.utc)
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Tomato",
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("2200.0000"),
        retrieved_at=now,
    )
    db_session.add(ev)
    db_session.commit()

    mock_prov = MagicMock()
    service = EvidenceService(
        db=db_session,
        provider_mode="MOCK",
        mock_provider=mock_prov,
    )

    res = service.get_market_price(commodity="Tomato", price_type="MODAL")
    assert res.from_cache is True
    assert res.freshness == FreshnessStatus.VERIFIED_FRESH
    assert res.evidence.numeric_value == Decimal("2200.0000")
    mock_prov.fetch_market_prices.assert_not_called()


def test_stale_cache_triggers_provider_call(db_session):
    """33. Stale cache triggers provider call."""
    stale_time = datetime.now(timezone.utc) - timedelta(days=5)
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Tomato",
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("1500.0000"),
        retrieved_at=stale_time,
    )
    db_session.add(ev)
    db_session.commit()

    mock_prov = MagicMock()
    mock_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        source_type=SourceType.MOCK_DEMO,
        status=ProviderStatus.SUCCESS,
        observations=[
            MarketPriceObservation(
                provider_id="MOCK_AGMARKNET_PROVIDER",
                commodity="Tomato",
                state="Karnataka",
                district="Kolar",
                observation_date=date.today(),
                price_type="MODAL",
                currency="INR",
                quantity_unit="QUINTAL",
                numeric_value=Decimal("2400.0000"),
            )
        ],
    )

    service = EvidenceService(
        db=db_session,
        provider_mode="MOCK",
        mock_provider=mock_prov,
    )

    res = service.get_market_price(commodity="Tomato", price_type="MODAL")
    assert res.from_cache is False
    assert res.freshness == FreshnessStatus.VERIFIED_FRESH
    assert res.evidence.numeric_value == Decimal("2400.0000")
    mock_prov.fetch_market_prices.assert_called_once()


def test_live_failure_with_stale_cache_returns_stale_warning(db_session):
    """34. Live failure + stale cache returns stale warning."""
    stale_time = datetime.now(timezone.utc) - timedelta(days=3)
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.GOVERNMENT.value,
        provider_id="LIVE_AGMARKNET_PROVIDER",
        commodity="Wheat",
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("2100.0000"),
        retrieved_at=stale_time,
    )
    db_session.add(ev)
    db_session.commit()

    live_prov = MagicMock()
    live_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="LIVE_AGMARKNET_PROVIDER",
        source_type=SourceType.GOVERNMENT,
        status=ProviderStatus.NETWORK_ERROR,
        warnings=["Gateway timeout upstream"],
        observations=[],
    )

    service = EvidenceService(
        db=db_session,
        provider_mode="LIVE",
        live_provider=live_prov,
    )

    res = service.get_market_price(commodity="Wheat", price_type="MODAL")
    assert res.from_cache is True
    assert res.freshness == FreshnessStatus.VERIFIED_STALE
    assert res.evidence is not None
    assert any("returning stale" in w for w in res.warnings)


def test_live_failure_with_no_cache_returns_explicit_failure(db_session):
    """35. Live failure + no cache returns explicit provider failure / no data."""
    live_prov = MagicMock()
    live_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="LIVE_AGMARKNET_PROVIDER",
        source_type=SourceType.GOVERNMENT,
        status=ProviderStatus.PROVIDER_UNAVAILABLE,
        warnings=["No live provider configured"],
        observations=[],
    )

    service = EvidenceService(
        db=db_session,
        provider_mode="LIVE",
        live_provider=live_prov,
    )

    res = service.get_market_price(commodity="Mustard", price_type="MODAL")
    assert res.evidence is None
    assert res.status == ProviderStatus.PROVIDER_UNAVAILABLE
    assert res.from_cache is False


def test_onion_does_not_hit_tomato_cache(db_session):
    """36. Onion does not hit Tomato cache."""
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Tomato",
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("2200.0000"),
        retrieved_at=datetime.now(timezone.utc),
    )
    db_session.add(ev)
    db_session.commit()

    service = EvidenceService(db=db_session, provider_mode="MOCK")
    cached = service.repository.find_market_price_cache(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Onion",
        price_type="MODAL",
    )
    assert cached is None


def test_differing_market_does_not_collide(db_session):
    """37. Differing market does not collide."""
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Onion",
        market_id="Lasalgaon",
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("2800.0000"),
        retrieved_at=datetime.now(timezone.utc),
    )
    db_session.add(ev)
    db_session.commit()

    service = EvidenceService(db=db_session, provider_mode="MOCK")
    cached = service.repository.find_market_price_cache(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Onion",
        market_id="Kolar",
        price_type="MODAL",
    )
    assert cached is None


def test_differing_quantity_unit_does_not_collide(db_session):
    """38. Differing quantity unit does not collide."""
    ev = Evidence(
        evidence_type=EvidenceType.MARKET_PRICE.value,
        source_type=SourceType.MOCK_DEMO.value,
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Dairy",
        price_type="MODAL",
        currency="INR",
        quantity_unit="LITRE",
        numeric_value=Decimal("55.0000"),
        retrieved_at=datetime.now(timezone.utc),
    )
    db_session.add(ev)
    db_session.commit()

    service = EvidenceService(db=db_session, provider_mode="MOCK")
    cached = service.repository.find_market_price_cache(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        commodity="Dairy",
        quantity_unit="QUINTAL",
        price_type="MODAL",
    )
    assert cached is None


# ==============================================================================
# 5. DEDUP & CONTENT HASH TESTS (Matrix items 39 - 41)
# ==============================================================================

def test_identical_provider_observation_is_not_duplicated(db_session):
    """39. Identical provider observation is not duplicated."""
    obs = MarketPriceObservation(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        provider_record_id="rec_1",
        commodity="Tomato",
        market_id="Kolar",
        market_name="Kolar",
        state="Karnataka",
        district="Kolar",
        observation_date=date(2026, 9, 2),
        price_type="MODAL",
        currency="INR",
        quantity_unit="QUINTAL",
        numeric_value=Decimal("2200.0000"),
    )

    mock_prov = MagicMock()
    mock_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        source_type=SourceType.MOCK_DEMO,
        status=ProviderStatus.SUCCESS,
        observations=[obs],
    )

    service = EvidenceService(db=db_session, provider_mode="MOCK", mock_provider=mock_prov)
    
    # First call persists
    r1 = service.get_market_price(commodity="Tomato", force_refresh=True)
    assert r1.evidence is not None
    ev1_id = r1.evidence.id

    # Second call with identical observation does not insert a new row
    r2 = service.get_market_price(commodity="Tomato", force_refresh=True)
    assert r2.evidence is not None
    assert r2.evidence.id == ev1_id


def test_canonical_hash_stable_regardless_dict_key_order():
    """40. Canonical hash is stable regardless of key ordering."""
    hash1 = compute_evidence_content_hash(
        provider_id="PROV_1",
        evidence_type="MARKET_PRICE",
        commodity="Tomato",
        state="Karnataka",
        numeric_value=Decimal("2200.0000"),
    )
    hash2 = compute_evidence_content_hash(
        state="Karnataka",
        commodity="Tomato",
        provider_id="PROV_1",
        numeric_value=Decimal("2200.0000"),
        evidence_type="MARKET_PRICE",
    )
    assert hash1 == hash2


def test_changed_value_creates_new_snapshot(db_session):
    """41. Same natural observation but changed value creates a new snapshot."""
    mock_prov = MagicMock()
    
    # Observation with value 2200
    mock_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        source_type=SourceType.MOCK_DEMO,
        status=ProviderStatus.SUCCESS,
        observations=[
            MarketPriceObservation(
                provider_id="MOCK_AGMARKNET_PROVIDER",
                commodity="Tomato",
                market_id="Kolar",
                state="Karnataka",
                district="Kolar",
                observation_date=date(2026, 9, 2),
                price_type="MODAL",
                currency="INR",
                quantity_unit="QUINTAL",
                numeric_value=Decimal("2200.0000"),
            )
        ],
    )
    service = EvidenceService(db=db_session, provider_mode="MOCK", mock_provider=mock_prov)
    r1 = service.get_market_price(commodity="Tomato", force_refresh=True)

    # Observation for same natural observation with changed value 2500
    mock_prov.fetch_market_prices.return_value = ProviderResult(
        provider_id="MOCK_AGMARKNET_PROVIDER",
        source_type=SourceType.MOCK_DEMO,
        status=ProviderStatus.SUCCESS,
        observations=[
            MarketPriceObservation(
                provider_id="MOCK_AGMARKNET_PROVIDER",
                commodity="Tomato",
                market_id="Kolar",
                state="Karnataka",
                district="Kolar",
                observation_date=date(2026, 9, 2),
                price_type="MODAL",
                currency="INR",
                quantity_unit="QUINTAL",
                numeric_value=Decimal("2500.0000"),
            )
        ],
    )
    r2 = service.get_market_price(commodity="Tomato", force_refresh=True)

    assert r1.evidence.id != r2.evidence.id
    assert r1.evidence.content_hash != r2.evidence.content_hash
    assert r1.evidence.numeric_value == Decimal("2200.0000")
    assert r2.evidence.numeric_value == Decimal("2500.0000")
