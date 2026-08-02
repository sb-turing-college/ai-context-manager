"""Anthropic Claude LLM provider implementation."""

import hashlib
from collections.abc import AsyncGenerator

from anthropic import AsyncAnthropic

from src.services.llm.base import LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk, CacheInfo


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider implementation.
    
    Supports Claude 4.5 Sonnet and other Claude models.
    """
    
    def __init__(self, api_key: str, model: str):
        """Initialize Anthropic provider.
        
        Args:
            api_key: Anthropic API key
            model: Model name (e.g., "claude-4.5-sonnet")
        """
        super().__init__(api_key, model)
        self.client = AsyncAnthropic(api_key=api_key)
        self._last_cache_key: str | None = None  # Track cache key for hit detection
    
    async def generate_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate a complete response from Claude.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (0-1 for Claude)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Complete LLM response
            
        Raises:
            Exception: On API errors
        """
        # Separate system message from chat messages
        system_content, chat_messages = self._convert_messages(messages)
        
        try:
            # Build request params
            params = {
                "model": self.model,
                "messages": chat_messages,
                "temperature": temperature,
                "max_tokens": max_tokens or 4096  # Claude requires max_tokens
            }
            
            if system_content:
                params["system"] = system_content
            
            # Generate response
            response = await self.client.messages.create(**params)
            
            # Extract content
            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            
            # Extract usage stats
            usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
            
            return LLMResponse(
                content=content,
                model=response.model,
                usage=usage,
                finish_reason=response.stop_reason or "stop"
            )
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}") from e
    
    async def generate_with_cache(
        self,
        static_content: str,
        dynamic_messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate response with Anthropic prompt caching.
        
        Claude caching works by marking content blocks with cache_control.
        The system parameter is converted to a block array with cache_control marker,
        and Anthropic automatically caches identical content.
        
        IMPORTANT: Cache is stable for 5 minutes and refreshed on each hit.
        Minimum 1024 tokens required for caching.
        
        Args:
            static_content: Stable content to cache (system prompt + docs + summaries)
            dynamic_messages: Dynamic chat history (not cached)
            temperature: Sampling temperature (0-1 for Claude)
            max_tokens: Maximum tokens to generate
            
        Returns:
            LLMResponse with cache_info populated
            
        Raises:
            Exception: On API errors
        """
        # 1. Calculate cache key from static content
        cache_key = hashlib.sha256(static_content.encode()).hexdigest()[:16]
        is_cache_hit = (cache_key == self._last_cache_key)
        self._last_cache_key = cache_key
        
        # 2. Format system content as cached block
        # CRITICAL: Must be array with cache_control for caching to work!
        system_blocks = [
            {
                "type": "text",
                "text": static_content,
                "cache_control": {"type": "ephemeral"}  # 5-minute cache
            }
        ]
        
        # 3. Convert dynamic messages (without system)
        chat_messages = []
        for msg in dynamic_messages:
            if msg.role in ("user", "assistant"):
                chat_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # 4. API Request with caching
        try:
            response = await self.client.messages.create(
                model=self.model,
                system=system_blocks,  # Block array instead of string!
                messages=chat_messages,
                temperature=temperature,
                max_tokens=max_tokens or 4096
            )
            
            # 5. Extract content
            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            
            # 6. Extract usage stats including cache info
            usage_obj = response.usage
            cached_tokens = getattr(usage_obj, "cache_read_input_tokens", 0)
            
            usage = {
                "prompt_tokens": usage_obj.input_tokens,
                "completion_tokens": usage_obj.output_tokens,
                "total_tokens": usage_obj.input_tokens + usage_obj.output_tokens,
                "cached_tokens": cached_tokens
            }
            
            return LLMResponse(
                content=content,
                model=response.model,
                usage=usage,
                finish_reason=response.stop_reason or "stop",
                cache_info=CacheInfo(
                    cache_key=cache_key,
                    cached_tokens=cached_tokens,
                    is_cache_hit=cached_tokens > 0  # Cache hit if tokens were read
                )
            )
        
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}") from e
    
    async def stream_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Generate a streaming response from Claude.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (0-1 for Claude)
            max_tokens: Maximum tokens to generate
            
        Yields:
            LLMStreamChunk: Partial responses as they're generated
            
        Raises:
            Exception: On API errors
        """
        # Separate system message from chat messages
        system_content, chat_messages = self._convert_messages(messages)
        
        try:
            # Build request params
            params = {
                "model": self.model,
                "messages": chat_messages,
                "temperature": temperature,
                "max_tokens": max_tokens or 4096,  # Claude requires max_tokens
                "stream": True
            }
            
            if system_content:
                params["system"] = system_content
            
            # Generate streaming response
            async with self.client.messages.stream(**params) as stream:
                async for chunk in stream:
                    # Handle different event types
                    if chunk.type == "content_block_delta":
                        if hasattr(chunk.delta, "text"):
                            yield LLMStreamChunk(
                                content=chunk.delta.text,
                                finish_reason=None
                            )
                    elif chunk.type == "message_stop":
                        # Final chunk with stop reason
                        yield LLMStreamChunk(
                            content="",
                            finish_reason="stop"
                        )
        
        except Exception as e:
            raise Exception(f"Anthropic API streaming error: {str(e)}") from e
    
    def supports_streaming(self) -> bool:
        """Check if provider supports streaming.
        
        Returns:
            True (Claude supports streaming)
        """
        return True
    
    def _convert_messages(self, messages: list[LLMMessage]) -> tuple[str, list]:
        """Convert messages to Claude format.
        
        Claude uses a different message format with separate system parameter.
        
        Args:
            messages: Generic LLM messages
            
        Returns:
            Tuple of (system_content, chat_messages)
        """
        system_content = ""
        chat_messages = []
        
        for msg in messages:
            if msg.role == "system":
                system_content += msg.content + "\n\n"
            elif msg.role in ("user", "assistant"):
                chat_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        return system_content.strip(), chat_messages
