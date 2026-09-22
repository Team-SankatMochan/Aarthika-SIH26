import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List
import httpx
from app.core.config import settings
from app.models.evidence_enums import SourceType, ProviderStatus
from app.providers.base import BaseMarketPriceProvider
from app.providers.dto import ProviderResult, MarketPriceObservation, normalize_market_unit

logger = logging.getLogger(__name__)


class MockMarketPriceProvider(BaseMarketPriceProvider):
    def __init__(self, base_url: Optional[str] = None, timeout: float = 5.0):
        # Base URL loaded from backend configuration/env, never hardcoded
        self.base_url = (base_url or settings.MOCK_PROVIDER_URL).rstrip("/")
        self.timeout = timeout
        self.provider_id = "MOCK_AGMARKNET_PROVIDER"

    def fetch_market_prices(
        self,
        commodity: str,
        state: Optional[str] = None,
        district: Optional[str] = None,
        market: Optional[str] = None,
    ) -> ProviderResult[MarketPriceObservation]:
        url = f"{self.base_url}/api/v1/market-prices"
        params = {"commodity": commodity}
        if state:
            params["state"] = state
        if market:
            params["market"] = market

        source_url = f"{url}?commodity={commodity}"
        retrieved_at = datetime.now(timezone.utc)

        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, params=params)

            if res.status_code != 200:
                return ProviderResult(
                    provider_id=self.provider_id,
                    source_type=SourceType.MOCK_DEMO,
                    source_name="AARTHIKA Mock Government Data Provider",
                    source_url=source_url,
                    retrieved_at=retrieved_at,
                    status=ProviderStatus.INVALID_RESPONSE,
                    warnings=[f"Mock API returned HTTP {res.status_code}"],
                    observations=[],
                )

            try:
                payload = res.json()
            except Exception as e:
                return ProviderResult(
                    provider_id=self.provider_id,
                    source_type=SourceType.MOCK_DEMO,
                    source_name="AARTHIKA Mock Government Data Provider",
                    source_url=source_url,
                    retrieved_at=retrieved_at,
                    status=ProviderStatus.INVALID_RESPONSE,
                    warnings=[f"Failed to parse JSON response: {str(e)}"],
                    observations=[],
                )

            data_list = payload.get("data")
            if not isinstance(data_list, list):
                return ProviderResult(
                    provider_id=self.provider_id,
                    source_type=SourceType.MOCK_DEMO,
                    source_name="AARTHIKA Mock Government Data Provider",
                    source_url=source_url,
                    retrieved_at=retrieved_at,
                    status=ProviderStatus.INVALID_RESPONSE,
                    warnings=["Invalid schema: 'data' is not a list"],
                    observations=[],
                )

            if len(data_list) == 0:
                return ProviderResult(
                    provider_id=self.provider_id,
                    source_type=SourceType.MOCK_DEMO,
                    source_name="AARTHIKA Mock Government Data Provider",
                    source_url=source_url,
                    retrieved_at=retrieved_at,
                    status=ProviderStatus.NO_DATA,
                    warnings=[f"No market price records found for commodity '{commodity}'"],
                    observations=[],
                )

            observations: List[MarketPriceObservation] = []
            for item in data_list:
                raw_unit = item.get("unit")
                curr, qty_unit = normalize_market_unit(raw_unit)

                obs_date_str = item.get("arrival_date")
                try:
                    obs_date = date.fromisoformat(obs_date_str) if obs_date_str else date.today()
                except Exception:
                    obs_date = date.today()

                item_state = item.get("state", state or "UNKNOWN")
                item_district = item.get("district", district or item.get("market") or "UNKNOWN")
                item_market = item.get("market", market)
                item_comm = item.get("commodity", commodity)

                # Each record in mock API contains modal_price, min_price, max_price
                price_mappings = [
                    ("MODAL", item.get("modal_price")),
                    ("MIN", item.get("min_price")),
                    ("MAX", item.get("max_price")),
                ]

                for price_type, price_val in price_mappings:
                    if price_val is not None:
                        try:
                            num_val = Decimal(str(price_val))
                            observations.append(
                                MarketPriceObservation(
                                    provider_id=self.provider_id,
                                    provider_record_id=f"{item_comm}_{item_state}_{item_market}_{price_type}_{obs_date}",
                                    commodity=item_comm,
                                    market_id=item_market,
                                    market_name=item_market,
                                    state=item_state,
                                    district=item_district,
                                    observation_date=obs_date,
                                    price_type=price_type,
                                    currency=curr,
                                    quantity_unit=qty_unit,
                                    numeric_value=num_val,
                                    provider_original_unit=raw_unit,
                                )
                            )
                        except Exception as parse_err:
                            logger.warning(f"Error parsing price value {price_val}: {parse_err}")

            return ProviderResult(
                provider_id=self.provider_id,
                source_type=SourceType.MOCK_DEMO,
                source_name="AARTHIKA Mock Government Data Provider",
                source_url=source_url,
                retrieved_at=retrieved_at,
                status=ProviderStatus.SUCCESS if observations else ProviderStatus.NO_DATA,
                warnings=[],
                observations=observations,
            )

        except httpx.TimeoutException:
            return ProviderResult(
                provider_id=self.provider_id,
                source_type=SourceType.MOCK_DEMO,
                source_name="AARTHIKA Mock Government Data Provider",
                source_url=source_url,
                retrieved_at=retrieved_at,
                status=ProviderStatus.TIMEOUT,
                warnings=["Provider request timed out"],
                observations=[],
            )
        except httpx.RequestError as req_err:
            return ProviderResult(
                provider_id=self.provider_id,
                source_type=SourceType.MOCK_DEMO,
                source_name="AARTHIKA Mock Government Data Provider",
                source_url=source_url,
                retrieved_at=retrieved_at,
                status=ProviderStatus.NETWORK_ERROR,
                warnings=[f"Network error communicating with mock provider: {str(req_err)}"],
                observations=[],
            )
        except Exception as e:
            return ProviderResult(
                provider_id=self.provider_id,
                source_type=SourceType.MOCK_DEMO,
                source_name="AARTHIKA Mock Government Data Provider",
                source_url=source_url,
                retrieved_at=retrieved_at,
                status=ProviderStatus.INVALID_RESPONSE,
                warnings=[f"Unexpected provider error: {str(e)}"],
                observations=[],
            )
