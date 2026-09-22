import logging
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.evidence import Evidence, validate_canonical_evidence
from app.models.evidence_enums import SourceType, EvidenceType, ProviderStatus, FreshnessStatus, ProviderMode
from app.repositories.evidence_repository import EvidenceRepository
from app.services.freshness_policy import FreshnessPolicy
from app.services.canonical_hash import compute_evidence_content_hash
from app.providers.mock_market_provider import MockMarketPriceProvider
from app.providers.live_market_provider import LiveMarketPriceProvider
from app.providers.base import BaseMarketPriceProvider

logger = logging.getLogger(__name__)


class EvidenceServiceResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    evidence: Optional[Evidence] = None
    all_evidence: List[Evidence] = Field(default_factory=list)
    freshness: FreshnessStatus
    from_cache: bool = False
    status: ProviderStatus
    warnings: List[str] = Field(default_factory=list)


class EvidenceService:
    """Service orchestrating evidence retrieval, caching, freshness checks, dedup, and persistence."""

    def __init__(
        self,
        db: Session,
        provider_mode: Optional[str] = None,
        mock_provider: Optional[BaseMarketPriceProvider] = None,
        live_provider: Optional[BaseMarketPriceProvider] = None,
        freshness_policy: Optional[FreshnessPolicy] = None,
    ):
        self.db = db
        self.repository = EvidenceRepository(db)
        self.provider_mode = provider_mode or settings.PROVIDER_MODE
        self.freshness_policy = freshness_policy or FreshnessPolicy()
        self.mock_provider = mock_provider or MockMarketPriceProvider()
        self.live_provider = live_provider or LiveMarketPriceProvider()

    def _get_active_provider(self) -> tuple[BaseMarketPriceProvider, str]:
        if self.provider_mode.upper() == ProviderMode.MOCK.value:
            return self.mock_provider, "MOCK_AGMARKNET_PROVIDER"
        elif self.provider_mode.upper() == ProviderMode.LIVE.value:
            return self.live_provider, "LIVE_AGMARKNET_PROVIDER"
        else:
            raise ValueError(f"Invalid PROVIDER_MODE: {self.provider_mode}. Must be MOCK or LIVE.")

    def get_market_price(
        self,
        commodity: str,
        price_type: str = "MODAL",
        currency: str = "INR",
        quantity_unit: str = "QUINTAL",
        state: Optional[str] = None,
        district: Optional[str] = None,
        market_id: Optional[str] = None,
        force_refresh: bool = False,
    ) -> EvidenceServiceResult:
        """Retrieves market price evidence following the strict P2 orchestration contract.
        
        1. Cache query (domain-specific)
        2. Freshness evaluation (dynamic)
        3. Provider call if stale or missing
        4. In LIVE mode: never fallback to mock
        5. Dedup: SHA-256 canonical hash prevents duplicates
        6. Append-only persistence for changed/new observations
        """
        provider, provider_id = self._get_active_provider()

        # 1. Check cache
        cached_record = self.repository.find_market_price_cache(
            provider_id=provider_id,
            commodity=commodity,
            price_type=price_type,
            currency=currency,
            quantity_unit=quantity_unit,
            state=state,
            district=district,
            market_id=market_id,
        )

        # 2. Freshness check
        if cached_record and not force_refresh:
            freshness = self.freshness_policy.evaluate(cached_record)
            if freshness == FreshnessStatus.VERIFIED_FRESH:
                return EvidenceServiceResult(
                    evidence=cached_record,
                    all_evidence=[cached_record],
                    freshness=FreshnessStatus.VERIFIED_FRESH,
                    from_cache=True,
                    status=ProviderStatus.SUCCESS,
                    warnings=[],
                )

        # 3. Provider call needed (cache missing, stale, or forced)
        provider_result = provider.fetch_market_prices(
            commodity=commodity,
            state=state,
            district=district,
            market=market_id,
        )

        # If provider call fails:
        if provider_result.status != ProviderStatus.SUCCESS:
            if cached_record:
                # Return stale cache with explicit warning
                return EvidenceServiceResult(
                    evidence=cached_record,
                    all_evidence=[cached_record],
                    freshness=FreshnessStatus.VERIFIED_STALE,
                    from_cache=True,
                    status=provider_result.status,
                    warnings=[
                        f"Provider returned status {provider_result.status.value}; returning stale cached evidence.",
                        *provider_result.warnings,
                    ],
                )
            else:
                # No cache and provider failure
                return EvidenceServiceResult(
                    evidence=None,
                    all_evidence=[],
                    freshness=FreshnessStatus.UNKNOWN,
                    from_cache=False,
                    status=provider_result.status,
                    warnings=provider_result.warnings,
                )

        # 4. Normalize and dedup observations
        matching_observations = [
            obs for obs in provider_result.observations
            if obs.price_type.upper() == price_type.upper()
        ]
        if not matching_observations:
            # Fall back to any observation from the result if exact price_type isn't matched
            matching_observations = provider_result.observations

        persisted_evidence_list: List[Evidence] = []
        for obs in matching_observations:
            # Compute canonical content hash
            chash = compute_evidence_content_hash(
                provider_id=obs.provider_id,
                evidence_type=EvidenceType.MARKET_PRICE.value,
                commodity=obs.commodity,
                state=obs.state,
                district=obs.district,
                market_id=obs.market_id,
                market_name=obs.market_name,
                price_type=obs.price_type,
                observation_date=str(obs.observation_date),
                numeric_value=obs.numeric_value,
                currency=obs.currency,
                quantity_unit=obs.quantity_unit,
                provider_record_id=obs.provider_record_id,
            )

            # Check for existing snapshot with identical hash (DEDUP)
            existing = self.repository.find_by_content_hash(chash)
            if existing:
                persisted_evidence_list.append(existing)
            else:
                # Validate typed-value invariant
                validate_canonical_evidence(
                    source_type=provider_result.source_type,
                    evidence_type=EvidenceType.MARKET_PRICE,
                    numeric_value=obs.numeric_value,
                )

                # Insert new immutable evidence snapshot
                new_evidence = Evidence(
                    provider_id=obs.provider_id,
                    provider_record_id=obs.provider_record_id,
                    evidence_type=EvidenceType.MARKET_PRICE.value,
                    source_type=provider_result.source_type.value,
                    source_name=provider_result.source_name,
                    source_url=provider_result.source_url,
                    metric_name="MARKET_PRICE",
                    numeric_value=obs.numeric_value,
                    observation_date=obs.observation_date,
                    retrieved_at=provider_result.retrieved_at,
                    state=obs.state,
                    district=obs.district,
                    commodity=obs.commodity,
                    market_id=obs.market_id,
                    market_name=obs.market_name,
                    price_type=obs.price_type,
                    currency=obs.currency,
                    quantity_unit=obs.quantity_unit,
                    provider_original_unit=obs.provider_original_unit,
                    content_hash=chash,
                )
                inserted = self.repository.insert(new_evidence)
                persisted_evidence_list.append(inserted)

        primary_evidence = persisted_evidence_list[0] if persisted_evidence_list else None
        return EvidenceServiceResult(
            evidence=primary_evidence,
            all_evidence=persisted_evidence_list,
            freshness=FreshnessStatus.VERIFIED_FRESH,
            from_cache=False,
            status=ProviderStatus.SUCCESS,
            warnings=provider_result.warnings,
        )
