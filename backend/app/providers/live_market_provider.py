from datetime import datetime, timezone
from typing import Optional
from app.core.config import settings
from app.models.evidence_enums import SourceType, ProviderStatus
from app.providers.base import BaseMarketPriceProvider
from app.providers.dto import ProviderResult, MarketPriceObservation


class LiveMarketPriceProvider(BaseMarketPriceProvider):
    """Live market price provider adapter.
    
    If no live external API is configured or verified, returns PROVIDER_UNAVAILABLE.
    Never invents fake live data or silently falls back to mock.
    """

    def __init__(self, provider_url: Optional[str] = None):
        self.provider_url = provider_url or settings.LIVE_PROVIDER_URL
        self.provider_id = "LIVE_AGMARKNET_PROVIDER"

    def fetch_market_prices(
        self,
        commodity: str,
        state: Optional[str] = None,
        district: Optional[str] = None,
        market: Optional[str] = None,
    ) -> ProviderResult[MarketPriceObservation]:
        retrieved_at = datetime.now(timezone.utc)

        if not self.provider_url:
            return ProviderResult(
                provider_id=self.provider_id,
                source_type=SourceType.GOVERNMENT,
                source_name="Official Live Market Provider (Unconfigured)",
                source_url=None,
                retrieved_at=retrieved_at,
                status=ProviderStatus.PROVIDER_UNAVAILABLE,
                warnings=["Live provider is not configured or authenticated in this environment"],
                observations=[],
            )

        # In case a live provider URL is configured in future:
        # Implementation would call official Agmarknet/data.gov.in API with API key.
        # But if none is implemented/verified:
        return ProviderResult(
            provider_id=self.provider_id,
            source_type=SourceType.GOVERNMENT,
            source_name="Official Live Market Provider",
            source_url=self.provider_url,
            retrieved_at=retrieved_at,
            status=ProviderStatus.PROVIDER_UNAVAILABLE,
            warnings=["Live provider endpoint is not yet connected to an authenticated live upstream"],
            observations=[],
        )
