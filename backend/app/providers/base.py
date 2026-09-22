from abc import ABC, abstractmethod
from typing import Optional
from app.providers.dto import ProviderResult, MarketPriceObservation


class BaseMarketPriceProvider(ABC):
    @abstractmethod
    def fetch_market_prices(
        self,
        commodity: str,
        state: Optional[str] = None,
        district: Optional[str] = None,
        market: Optional[str] = None,
    ) -> ProviderResult[MarketPriceObservation]:
        """Fetch market prices from the provider.
        
        Must return typed ProviderResult. Must NOT access database.
        """
        pass
