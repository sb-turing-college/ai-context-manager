"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Literal


@dataclass
class LLMMessage:
    """Message for LLM conversation.
    
    Attributes:
        role: Message role (user, assistant, system)
        content: Message content
    """
    
    role: Literal["user", "assistant", "system"]
    content: str


@dataclass
class CacheInfo:
    """Cache information for cost tracking.
    
    Attributes:
        cache_key: Hash of cached content for identification
        cached_tokens: Number of tokens that were cached
        is_cache_hit: True if cache was reused (not created)
    """
    
    cache_key: str
    cached_tokens: int
    is_cache_hit: bool


@dataclass
class LLMResponse:
    """Complete response from LLM.
    
    Attributes:
        content: Generated text
        model: Model that generated the response
        usage: Token usage statistics
        finish_reason: Why generation stopped
        cache_info: Optional cache information for cost tracking
    """
    
    content: str
    model: str
    usage: dict[str, int]  # {prompt_tokens, completion_tokens, total_tokens, cached_tokens}
    finish_reason: str  # "stop", "length", "content_filter", etc.
    cache_info: CacheInfo | None = None


@dataclass
class LLMStreamChunk:
    """Streaming chunk from LLM.
    
    Attributes:
        content: Partial text content
        finish_reason: Set on last chunk
    """
    
    content: str
    finish_reason: str | None = None


class LLMProvider(ABC):
    """Abstract base class for LLM providers.
    
    All LLM providers (Google, Anthropic, etc.) must implement this interface.
    """
    
    def __init__(self, api_key: str, model: str):
        """Initialize provider.
        
        Args:
            api_key: API key for the provider
            model: Model name/identifier
        """
        self.api_key = api_key
        self.model = model
    
    @abstractmethod
    async def generate_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate a complete response.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Complete LLM response
            
        Raises:
            Exception: On API errors
            
        Example:
            >>> provider = GoogleProvider(api_key="...", model="gemini-3-pro")
            >>> response = await provider.generate([
            ...     LLMMessage(role="user", content="Hello!")
            ... ])
            >>> print(response.content)
            'Hello! How can I help you?'
        """
        pass
    
    @abstractmethod
    async def stream_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Generate a streaming response.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            
        Yields:
            LLMStreamChunk: Partial responses as they're generated
            
        Raises:
            Exception: On API errors
            
        Example:
            >>> provider = GoogleProvider(api_key="...", model="gemini-3-pro")
            >>> async for chunk in provider.generate_stream([
            ...     LLMMessage(role="user", content="Tell me a story")
            ... ]):
            ...     print(chunk.content, end="", flush=True)
        """
        pass
    
    @abstractmethod
    def supports_streaming(self) -> bool:
        """Check if provider supports streaming.
        
        Returns:
            True if streaming is supported
            
        Example:
            >>> provider.supports_streaming()
            True
        """
        pass
    
    @abstractmethod
    async def generate_with_cache(
        self,
        static_content: str,
        dynamic_messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate response with context caching.
        
        Separates context into static (cached) and dynamic (not cached) parts
        for cost optimization. Static content (system prompt, documents, summaries)
        is cached by the provider, while dynamic content (chat history, status)
        is sent fresh each time.
        
        Args:
            static_content: Stable content to be cached (system prompt + docs + summaries)
            dynamic_messages: Dynamic chat history (not cached)
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            
        Returns:
            LLMResponse with cache_info populated
            
        Raises:
            Exception: On API errors
            
        Example:
            >>> response = await provider.generate_with_cache(
            ...     static_content="You are a helpful assistant. Here are docs...",
            ...     dynamic_messages=[
            ...         LLMMessage(role="user", content="Hello!"),
            ...         LLMMessage(role="assistant", content="Hi! How can I help?"),
            ...         LLMMessage(role="user", content="What's in the docs?")
            ...     ]
            ... )
            >>> response.cache_info.is_cache_hit
            True
            >>> response.cache_info.cached_tokens
            5000
        """
        pass
    
    def get_model_name(self) -> str:
        """Get the model name.
        
        Returns:
            Model identifier
            
        Example:
            >>> provider.get_model_name()
            'gemini-3-pro'
        """
        return self.model
