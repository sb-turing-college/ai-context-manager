"""LLM Provider factory."""

from src.config import settings
from src.services.llm.base import LLMProvider
from src.services.llm.google import GoogleProvider
from src.services.llm.anthropic import AnthropicProvider


# Model prefix mapping
MODEL_PROVIDERS = {
    "gemini": "google",
    "claude": "anthropic",
}


def create_provider(model: str) -> LLMProvider:
    """Create an LLM provider based on model name.
    
    Args:
        model: Model identifier (e.g., "gemini-2.5-flash", "claude-4.5-sonnet")
        
    Returns:
        Initialized LLM provider
        
    Raises:
        ValueError: If model is not supported
        
    Example:
        >>> provider = create_provider("gemini-2.5-flash")
        >>> isinstance(provider, GoogleProvider)
        True
        
        >>> provider = create_provider("claude-4.5-sonnet")
        >>> isinstance(provider, AnthropicProvider)
        True
    """
    # Determine provider from model name
    model_lower = model.lower()
    provider_type = None
    
    for prefix, provider_name in MODEL_PROVIDERS.items():
        if model_lower.startswith(prefix):
            provider_type = provider_name
            break
    
    if not provider_type:
        raise ValueError(
            f"Unknown model: {model}. "
            f"Supported prefixes: {', '.join(MODEL_PROVIDERS.keys())}"
        )
    
    # Create provider with appropriate API key
    if provider_type == "google":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY not configured")
        return GoogleProvider(api_key=settings.google_api_key, model=model)
    
    elif provider_type == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured")
        return AnthropicProvider(api_key=settings.anthropic_api_key, model=model)
    
    else:
        raise ValueError(f"Provider {provider_type} not implemented")


def get_default_model() -> str:
    """Get the default model for Chat A.
    
    Returns:
        Default model identifier (Gemini 3 Flash)
        
    Example:
        >>> get_default_model()
        'gemini-3-flash-preview'
    """
    return "gemini-3-flash-preview"


def list_supported_models() -> dict[str, list[str]]:
    """List all supported models by provider.
    
    Must stay in sync with ui/src/config/models.ts and MODEL_PRICING.
    All listed models are available for both Chat A and Chat B.
    
    Returns:
        Dictionary of provider -> list of models
        
    Example:
        >>> models = list_supported_models()
        >>> "gemini-3-pro-preview" in models["google"]
        True
    """
    return {
        "google": [
            "gemini-3-flash-preview",  # Default Chat A - fast & intelligent
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-3-pro-preview",    # Max reasoning depth
            "gemini-3.1-pro-preview",
        ],
        "anthropic": [
            "claude-haiku-4-5",        # Fastest & cheapest
            "claude-sonnet-4-5",       # Balanced (prev. gen)
            "claude-sonnet-4-6",       # Best speed/intelligence – default
            "claude-sonnet-5",
            "claude-opus-4-5",         # Max quality (prev. gen)
            "claude-opus-4-6",
            "claude-opus-5",           # Max quality – latest
        ]
    }
