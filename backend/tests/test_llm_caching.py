"""Tests for LLM context caching."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.services.llm.anthropic import AnthropicProvider
from src.services.llm.google import GoogleProvider
from src.services.llm.base import LLMMessage, CacheInfo


class TestAnthropicCaching:
    """Tests for Claude prompt caching."""
    
    @pytest.fixture
    def provider(self):
        """Create Anthropic provider for testing."""
        return AnthropicProvider(api_key="test-key", model="claude-sonnet-4-5")
    
    @pytest.mark.asyncio
    async def test_cache_control_in_system_block(self, provider):
        """System content must have cache_control marker."""
        with patch.object(provider.client.messages, "create", new_callable=AsyncMock) as mock:
            # Mock response
            mock.return_value = MagicMock(
                content=[MagicMock(type="text", text="Test response")],
                usage=MagicMock(
                    input_tokens=100,
                    output_tokens=50,
                    cache_read_input_tokens=0
                ),
                stop_reason="stop",
                model="claude-sonnet-4-5"
            )
            
            await provider.generate_with_cache(
                static_content="System prompt and documents...",
                dynamic_messages=[LLMMessage(role="user", content="Hello")]
            )
            
            # Verify cache_control in system block
            call_kwargs = mock.call_args.kwargs
            assert "system" in call_kwargs
            assert isinstance(call_kwargs["system"], list)
            assert call_kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
            assert call_kwargs["system"][0]["text"] == "System prompt and documents..."
    
    @pytest.mark.asyncio
    async def test_cache_hit_detection(self, provider):
        """Second request with same content should detect cache hit."""
        with patch.object(provider.client.messages, "create", new_callable=AsyncMock) as mock:
            # First request - no cache hit
            mock.return_value = MagicMock(
                content=[MagicMock(type="text", text="Response 1")],
                usage=MagicMock(
                    input_tokens=100,
                    output_tokens=50,
                    cache_read_input_tokens=0  # No cache hit
                ),
                stop_reason="stop",
                model="claude-sonnet-4-5"
            )
            
            response1 = await provider.generate_with_cache(
                static_content="Same static content",
                dynamic_messages=[LLMMessage(role="user", content="Q1")]
            )
            
            assert response1.cache_info is not None
            assert response1.cache_info.is_cache_hit is False  # No cached tokens
            
            # Second request - cache hit (85 tokens from cache)
            mock.return_value = MagicMock(
                content=[MagicMock(type="text", text="Response 2")],
                usage=MagicMock(
                    input_tokens=20,
                    output_tokens=50,
                    cache_read_input_tokens=85  # Cache hit!
                ),
                stop_reason="stop",
                model="claude-sonnet-4-5"
            )
            
            response2 = await provider.generate_with_cache(
                static_content="Same static content",
                dynamic_messages=[LLMMessage(role="user", content="Q2")]
            )
            
            # Cache keys should match
            assert response1.cache_info.cache_key == response2.cache_info.cache_key
            # Second request should report cache hit
            assert response2.cache_info.is_cache_hit is True
            assert response2.cache_info.cached_tokens == 85


class TestGeminiCaching:
    """Tests for Gemini context caching."""
    
    @pytest.fixture
    def provider(self):
        """Create Google provider for testing."""
        return GoogleProvider(api_key="test-key", model="gemini-3-flash-preview")
    
    @pytest.mark.asyncio
    async def test_cache_created_once(self, provider):
        """Cache should only be created once per unique content."""
        with patch.object(provider.client.aio.caches, "create", new_callable=AsyncMock) as mock_cache:
            with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
                # Mock cache creation - name must be a string!
                cache_mock = MagicMock()
                cache_mock.name = "cache-abc123"
                mock_cache.return_value = cache_mock
                
                # Mock generation
                mock_gen.return_value = MagicMock(
                    text="Response",
                    usage_metadata=MagicMock(
                        prompt_token_count=20,
                        candidates_token_count=50,
                        total_token_count=70,
                        cached_content_token_count=0
                    )
                )
                
                # Two requests with same static content
                await provider.generate_with_cache(
                    static_content="Same static content",
                    dynamic_messages=[LLMMessage(role="user", content="Q1")]
                )
                await provider.generate_with_cache(
                    static_content="Same static content",
                    dynamic_messages=[LLMMessage(role="user", content="Q2")]
                )
                
                # Cache.create should only be called once
                assert mock_cache.call_count == 1
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, provider):
        """Cache can be explicitly invalidated."""
        with patch.object(provider.client.aio.caches, "create", new_callable=AsyncMock) as mock_cache:
            with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
                with patch.object(provider.client.caches, "delete") as mock_delete:
                    # Mock cache creation
                    cache_mock = MagicMock()
                    cache_mock.name = "cache-abc123"
                    mock_cache.return_value = cache_mock
                    
                    # Mock generation
                    mock_gen.return_value = MagicMock(
                        text="Response",
                        usage_metadata=MagicMock(
                            prompt_token_count=20,
                            candidates_token_count=50,
                            total_token_count=70,
                            cached_content_token_count=0
                        )
                    )
                    
                    # Create cache
                    await provider.generate_with_cache(
                        static_content="Old docs",
                        dynamic_messages=[LLMMessage(role="user", content="Q")]
                    )
                    
                    # Get cache key
                    cache_key = list(provider._cache_store.keys())[0]
                    
                    # Invalidate
                    provider.invalidate_cache(cache_key)
                    
                    # Cache should be removed from store
                    assert cache_key not in provider._cache_store
                    
                    # Delete should have been called
                    assert mock_delete.call_count == 1
    
    @pytest.mark.asyncio
    async def test_cache_hit_detection(self, provider):
        """Cache hit detection via is_cache_hit flag."""
        with patch.object(provider.client.aio.caches, "create", new_callable=AsyncMock) as mock_cache:
            with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
                # Mock cache creation
                cache_mock = MagicMock()
                cache_mock.name = "cache-xyz789"
                mock_cache.return_value = cache_mock
                
                # First request - no cache hit
                mock_gen.return_value = MagicMock(
                    text="Response 1",
                    usage_metadata=MagicMock(
                        prompt_token_count=20,
                        candidates_token_count=50,
                        total_token_count=70,
                        cached_content_token_count=0  # No cache hit yet
                    )
                )
                
                response1 = await provider.generate_with_cache(
                    static_content="Static content",
                    dynamic_messages=[LLMMessage(role="user", content="Q1")]
                )
                
                # First request creates cache
                assert response1.cache_info.is_cache_hit is False
                
                # Second request - cache hit
                mock_gen.return_value = MagicMock(
                    text="Response 2",
                    usage_metadata=MagicMock(
                        prompt_token_count=20,
                        candidates_token_count=50,
                        total_token_count=70,
                        cached_content_token_count=5000  # Cache hit!
                    )
                )
                
                response2 = await provider.generate_with_cache(
                    static_content="Static content",
                    dynamic_messages=[LLMMessage(role="user", content="Q2")]
                )
                
                # Second request uses existing cache
                assert response2.cache_info.is_cache_hit is True
                assert response2.cache_info.cached_tokens == 5000


class TestCacheableContext:
    """Tests for context builder caching."""
    
    @pytest.mark.asyncio
    async def test_cacheable_context_structure(self):
        """Test that CacheableContext dataclass works correctly."""
        from src.services.context_builder import CacheableContext
        from src.services.llm.base import LLMMessage
        
        # Create context
        context = CacheableContext(
            static_content="System prompt and documents...",
            dynamic_messages=[
                LLMMessage(role="user", content="Hello"),
                LLMMessage(role="assistant", content="Hi!")
            ]
        )
        
        # Verify structure
        assert isinstance(context.static_content, str)
        assert len(context.static_content) > 0
        assert isinstance(context.dynamic_messages, list)
        assert len(context.dynamic_messages) == 2
        assert context.dynamic_messages[0].role == "user"
