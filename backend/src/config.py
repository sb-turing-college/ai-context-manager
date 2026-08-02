"""Application configuration using Pydantic Settings.

Loads configuration from environment variables (.env file).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.
    
    Attributes:
        database_url: SQLAlchemy database connection string
        google_api_key: Google Gemini API key
        anthropic_api_key: Anthropic Claude API key
        host: Server host address
        port: Server port number
        debug: Debug mode flag
        reload: Auto-reload on code changes (dev only)
        cors_origins: Allowed CORS origins (comma-separated)
        enable_streaming: Enable streaming responses
        enable_tool_use: Enable AI tool use
        enable_context_cache: Enable context caching
        log_level: Logging level
    """
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./app.db"
    
    # API Keys
    google_api_key: str = ""
    anthropic_api_key: str = ""
    mistral_api_key: str = ""

    # Disclaimer / API terms (CI bypass: DISCLAIMER_ACCEPTED=1)
    disclaimer_accepted: bool = False

    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    debug: bool = True
    reload: bool = True
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # Features
    enable_streaming: bool = True
    enable_tool_use: bool = True
    enable_context_cache: bool = False
    
    # Logging
    log_level: str = "INFO"

    # Vector Search (Chroma + fastembed)
    chroma_path: str = "./chroma_data"
    # fastembed model – BAAI/bge-small-en-v1.5 is compact and fast;
    # swap for "intfloat/multilingual-e5-small" for better German support
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string.
        
        Returns:
            List of allowed origin URLs
        """
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Global settings instance
settings = Settings()
