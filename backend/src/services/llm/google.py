"""Google Gemini LLM provider implementation."""

import hashlib
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

from src.services.llm.base import LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk, CacheInfo


class GoogleProvider(LLMProvider):
    """Google Gemini provider implementation.
    
    Supports Gemini 3.x and Gemini 2.5 models.
    """
    
    def __init__(self, api_key: str, model: str):
        """Initialize Google provider.
        
        Args:
            api_key: Google AI API key
            model: Model name (e.g., "gemini-2.5-flash-lite", "gemini-3-flash-preview")
        """
        super().__init__(api_key, model)
        self.client = genai.Client(api_key=api_key)
        self._cache_store: dict[str, str] = {}  # cache_key -> cache_name mapping
    
    async def generate_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 1.0,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate a complete response from Gemini.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (default 1.0 for Gemini 3)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Complete LLM response
            
        Raises:
            Exception: On API errors
        """
        # Extract system instruction and convert messages
        system_instruction, contents = self._extract_system_and_convert(messages)
        
        # Build generation config
        config = types.GenerateContentConfig(
            temperature=temperature
        )
        if system_instruction:
            config.system_instruction = system_instruction
        if max_tokens:
            config.max_output_tokens = max_tokens
        
        try:
            # Generate response
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            # Extract text from response
            response_text = None
            if hasattr(response, 'text') and response.text:
                response_text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                # Try to extract from candidates
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    parts = candidate.content.parts
                    if parts:
                        response_text = "".join(
                            part.text for part in parts if hasattr(part, 'text') and part.text
                        )
            
            # Handle empty response
            if not response_text:
                # Check for safety/blocked response
                if hasattr(response, 'prompt_feedback'):
                    feedback = response.prompt_feedback
                    # Enhanced error message with details
                    error_msg = f"Response blocked by Gemini. Feedback: {feedback}"
                    if hasattr(feedback, 'block_reason'):
                        error_msg += f" | Reason: {feedback.block_reason}"
                    raise Exception(error_msg)
                raise Exception("Empty response from Gemini API")
            
            # Extract usage stats if available
            usage = {}
            if hasattr(response, "usage_metadata"):
                metadata = response.usage_metadata
                usage = {
                    "prompt_tokens": getattr(metadata, "prompt_token_count", 0),
                    "completion_tokens": getattr(metadata, "candidates_token_count", 0),
                    "total_tokens": getattr(metadata, "total_token_count", 0)
                }
            
            return LLMResponse(
                content=response_text,
                model=self.model,
                usage=usage,
                finish_reason="stop"
            )
        
        except Exception as e:
            raise Exception(f"Google API error: {str(e)}")
    
    async def generate_with_cache(
        self,
        static_content: str,
        dynamic_messages: list[LLMMessage],
        temperature: float = 1.0,
        max_tokens: int | None = None
    ) -> LLMResponse:
        """Generate response with Gemini context caching.
        
        Gemini caching requires explicit cache creation via CachedContent.create().
        The cache has a TTL and storage costs ($1/MTok/hour), but provides 90% discount
        on cache hits ($0.05/MTok vs $0.50/MTok for Gemini 3 Flash).
        
        IMPORTANT: Cache must be created once and referenced in subsequent requests.
        Gemini tracks cache usage separately from prompt tokens.
        
        Args:
            static_content: Stable content to cache (system prompt + docs + summaries)
            dynamic_messages: Dynamic chat history (not cached)
            temperature: Sampling temperature (0-2 for Gemini)
            max_tokens: Maximum tokens to generate
            
        Returns:
            LLMResponse with cache_info populated
            
        Raises:
            Exception: On API errors
        """
        # 1. Calculate cache key
        cache_key = hashlib.sha256(static_content.encode()).hexdigest()[:16]
        is_cache_hit = cache_key in self._cache_store
        
        # 2. Create cache if not exists (Gemini requires explicit creation)
        if not is_cache_hit:
            try:
                # Create cached content with system prompt
                cached_content = await self.client.aio.caches.create(
                    model=self.model,
                    config=types.CreateCachedContentConfig(
                        system_instruction=static_content,
                        ttl="3600s",  # 1 hour
                        display_name=f"session-cache-{cache_key}"
                    )
                )
                self._cache_store[cache_key] = cached_content.name
            except Exception as e:
                # If cache creation fails, fall back to non-cached generation
                raise Exception(f"Failed to create Gemini cache: {str(e)}")
        
        cache_name = self._cache_store[cache_key]
        
        # 3. Convert dynamic messages to Gemini format
        contents = []
        for msg in dynamic_messages:
            if msg.role in ("user", "assistant"):
                # Map "assistant" to "model" for Gemini
                role = "model" if msg.role == "assistant" else "user"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.content}]
                })
        
        # 4. Build config with cache reference
        config = types.GenerateContentConfig(
            temperature=temperature,
            cached_content=cache_name  # Reference to cached content
        )
        if max_tokens:
            config.max_output_tokens = max_tokens
        
        # 5. API Request with cache
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            # 6. Extract usage metadata including cache info
            usage = {}
            cached_tokens = 0
            if hasattr(response, "usage_metadata"):
                metadata = response.usage_metadata
                usage = {
                    "prompt_tokens": getattr(metadata, "prompt_token_count", 0),
                    "completion_tokens": getattr(metadata, "candidates_token_count", 0),
                    "total_tokens": getattr(metadata, "total_token_count", 0)
                }
                # Gemini provides cached_content_token_count
                cached_tokens = getattr(metadata, "cached_content_token_count", 0)
                usage["cached_tokens"] = cached_tokens
            
            return LLMResponse(
                content=response.text,
                model=self.model,
                usage=usage,
                finish_reason="stop",
                cache_info=CacheInfo(
                    cache_key=cache_key,
                    cached_tokens=cached_tokens,
                    is_cache_hit=is_cache_hit  # True if cache existed before this request
                )
            )
        
        except Exception as e:
            raise Exception(f"Google API error: {str(e)}")
    
    def invalidate_cache(self, cache_key: str) -> None:
        """Invalidate cache explicitly (e.g., when documents are updated).
        
        Gemini requires explicit cache deletion, unlike Claude which
        auto-invalidates on content change.
        
        Args:
            cache_key: Cache key to invalidate
        """
        if cache_key in self._cache_store:
            cache_name = self._cache_store.pop(cache_key)
            try:
                # Delete cache from Gemini (async operation, but we don't await)
                # Note: This is synchronous in the SDK
                self.client.caches.delete(name=cache_name)
            except Exception:
                # Cache might already be expired - ignore errors
                pass
    
    async def stream_text(
        self,
        messages: list[LLMMessage],
        temperature: float = 1.0,
        max_tokens: int | None = None
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """Generate a streaming response from Gemini.
        
        Args:
            messages: Conversation history
            temperature: Sampling temperature (default 1.0 for Gemini 3)
            max_tokens: Maximum tokens to generate
            
        Yields:
            Streaming chunks
            
        Raises:
            Exception: On API errors
        """
        # Extract system instruction and convert messages
        system_instruction, contents = self._extract_system_and_convert(messages)
        
        # Build config
        config = types.GenerateContentConfig(
            temperature=temperature
        )
        if system_instruction:
            config.system_instruction = system_instruction
        if max_tokens:
            config.max_output_tokens = max_tokens
        
        try:
            # Stream response
            async for chunk in self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=config
            ):
                if hasattr(chunk, "text") and chunk.text:
                    yield LLMStreamChunk(
                        content=chunk.text,
                        finish_reason=None
                    )
            
            # Send final chunk
            yield LLMStreamChunk(content="", finish_reason="stop")
        
        except Exception as e:
            raise Exception(f"Google API streaming error: {str(e)}")
    
    def supports_streaming(self) -> bool:
        """Check if provider supports streaming.
        
        Returns:
            True (Gemini supports streaming)
        """
        return True
    
    def _extract_system_and_convert(self, messages: list[LLMMessage]) -> tuple[str | None, str | list]:
        """Extract system instruction and convert messages to Gemini format.
        
        Args:
            messages: List of LLM messages
            
        Returns:
            Tuple of (system_instruction, contents)
        """
        system_instruction = None
        contents = []
        
        for msg in messages:
            if msg.role == "system":
                # Extract system instruction for config
                system_instruction = msg.content
            elif msg.role == "user":
                contents.append({
                    "role": "user",
                    "parts": [{"text": msg.content}]
                })
            elif msg.role == "assistant":
                # Map "assistant" to "model" for Gemini
                contents.append({
                    "role": "model",
                    "parts": [{"text": msg.content}]
                })
        
        # If single user message without system instruction, return simple string
        if len(contents) == 1 and contents[0]["role"] == "user" and not system_instruction:
            return None, contents[0]["parts"][0]["text"]
        
        # If no contents (only system message), create a minimal user message
        if len(contents) == 0:
            contents = [{"role": "user", "parts": [{"text": "Hello"}]}]
        
        return system_instruction, contents
    
    def _convert_messages(self, messages: list[LLMMessage]) -> str | list:
        """Convert LLMMessage list to Gemini format (legacy method for tool orchestrator).
        
        Args:
            messages: List of LLM messages
            
        Returns:
            Gemini-formatted contents
        """
        _, contents = self._extract_system_and_convert(messages)
        return contents
