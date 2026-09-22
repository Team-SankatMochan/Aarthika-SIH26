import json
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ArthSetu / Vyapar Crash Test API"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    GROQ_API_KEY: str | None = None

    # PostgreSQL Database Configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "arthsetu_user"
    POSTGRES_PASSWORD: str = "arthsetu_password"
    POSTGRES_DB: str = "arthsetu_db"
    DATABASE_URL: str = "postgresql://arthsetu_user:arthsetu_password@localhost:5432/arthsetu_db"

    # Phase 2 P2: Evidence Provider Configuration
    PROVIDER_MODE: str = "MOCK"  # "MOCK" or "LIVE"
    MOCK_PROVIDER_URL: str = "http://127.0.0.1:8001"
    LIVE_PROVIDER_URL: str | None = None

    # Security & CORS
    SECRET_KEY: str = "dev_secret_key_change_in_production_phase2"
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19000",
        "http://localhost:19006",
        "exp://localhost:8081",
        "*",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
