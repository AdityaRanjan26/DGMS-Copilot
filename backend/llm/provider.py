"""
llm/provider.py

LLM provider for DGMS Copilot — Production Edition.

Supports:
  - Non-streaming generation via generate()
  - Token-by-token streaming via generate_stream()
  - Automatic primary/fallback model selection
  - 5-minute model availability cache
  - keep_alive=1h to prevent model eviction between requests
"""

from __future__ import annotations

import os
import time
import logging
import json
from abc import ABC, abstractmethod
from typing import Iterator

import httpx

logger = logging.getLogger(__name__)

# ── Model availability cache ──────────────────────────────────────────────────
_model_cache: dict[str, tuple[bool, float]] = {}
_MODEL_CACHE_TTL = 300.0


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str | None:
        pass

    @abstractmethod
    def generate_stream(self, prompt: str) -> Iterator[str]:
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        pass


class OllamaProvider(LLMProvider):
    def __init__(self):
        self.url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
        self.primary_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        self.fallback_model = os.getenv("OLLAMA_FALLBACK_MODEL", "qwen3:8b")
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "2048"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
        self._active_model: str | None = None

    def _check_model_exists(self, model: str) -> bool:
        now = time.monotonic()
        cached = _model_cache.get(model)
        if cached is not None:
            exists, ts = cached
            if now - ts < _MODEL_CACHE_TTL:
                return exists
        try:
            res = httpx.get(f"{self.url}/api/tags", timeout=5.0)
            res.raise_for_status()
            tags = res.json().get("models", [])
            available = {t.get("name", "") for t in tags}
            exists = any(
                t == model or t.startswith(model.split(":")[0] + ":")
                for t in available
            )
            _model_cache[model] = (exists, now)
            return exists
        except Exception as e:
            logger.error("Error checking Ollama tags: %s", e)
            _model_cache[model] = (False, now)
            return False

    def _ollama_options(self) -> dict:
        return {
            "num_predict": self.num_predict,
            "num_ctx": self.num_ctx,
            "temperature": 0.15,
            "top_k": 20,
            "top_p": 0.9,
            "num_thread": 8,
            "stop": ["CONTEXT:", "QUESTION:", "USER QUESTION:", "CONVERSATION HISTORY:"],
        }

    def _effective_prompt(self, model: str, prompt: str) -> str:
        if "qwen3" in model.lower():
            return prompt + " /no_think"
        return prompt

    def _call_ollama(self, model: str, prompt: str) -> str | None:
        if not self._check_model_exists(model):
            logger.error("Model %s not found. Run: ollama pull %s", model, model)
            return None

        try:
            response = httpx.post(
                f"{self.url}/api/generate",
                json={
                    "model": model,
                    "prompt": self._effective_prompt(model, prompt),
                    "stream": False,
                    "keep_alive": "1h",
                    "options": self._ollama_options(),
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()

            text = (data.get("response") or "").strip()
            if not text:
                thinking = (data.get("thinking") or "").strip()
                if thinking:
                    logger.warning("Model %s: using `thinking` field as fallback.", model)
                    text = thinking

            if text:
                self._active_model = model
                return text

            logger.warning("Model %s returned empty response.", model)
            return None

        except httpx.TimeoutException:
            logger.warning("Ollama timed out for model %s.", model)
        except httpx.HTTPStatusError as e:
            logger.error("Ollama HTTP error with %s: %s", model, e)
        except httpx.RequestError as e:
            logger.error("Ollama request error: %s", e)
        except Exception as e:
            logger.error("Unexpected Ollama error with %s: %s", model, e)
        return None

    def _call_ollama_stream(self, model: str, prompt: str) -> Iterator[str]:
        """Stream tokens from Ollama one by one."""
        if not self._check_model_exists(model):
            logger.error("Model %s not found for streaming.", model)
            return

        try:
            with httpx.stream(
                "POST",
                f"{self.url}/api/generate",
                json={
                    "model": model,
                    "prompt": self._effective_prompt(model, prompt),
                    "stream": True,
                    "keep_alive": "1h",
                    "options": self._ollama_options(),
                },
                timeout=self.timeout,
            ) as response:
                response.raise_for_status()
                self._active_model = model

                for line in response.iter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    token = (data.get("response") or "").replace('/no_think', '')
                    if token:
                        yield token

                    if data.get("done"):
                        break

        except httpx.TimeoutException:
            logger.warning("Ollama stream timed out for model %s.", model)
        except httpx.HTTPStatusError as e:
            logger.error("Ollama stream HTTP error with %s: %s", model, e)
        except httpx.RequestError as e:
            logger.error("Ollama stream request error: %s", e)
        except Exception as e:
            logger.error("Unexpected Ollama stream error with %s: %s", model, e)

    def generate(self, prompt: str) -> str | None:
        result = self._call_ollama(self.primary_model, prompt)
        if result:
            return result
        if self.fallback_model and self.fallback_model != self.primary_model:
            logger.warning("Primary %s failed. Trying fallback %s.", self.primary_model, self.fallback_model)
            return self._call_ollama(self.fallback_model, prompt)
        return None

    def generate_stream(self, prompt: str) -> Iterator[str]:
        """
        Stream tokens from the primary model. Falls back to non-streaming
        if the primary fails, yielding the full response at once.
        """
        had_output = False
        try:
            for token in self._call_ollama_stream(self.primary_model, prompt):
                had_output = True
                yield token
        except Exception as e:
            logger.error("Primary stream failed: %s", e)

        if not had_output:
            # Fallback: non-streaming
            logger.warning("Streaming failed — falling back to non-streaming.")
            result = self.generate(prompt)
            if result:
                # Simulate streaming word-by-word
                words = result.split(' ')
                for word in words:
                    yield word + ' '

    def get_model_name(self) -> str:
        return self._active_model or self.primary_model


# ── Module-level singleton ─────────────────────────────────────────────────────
_active_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _active_provider
    if _active_provider is None:
        _active_provider = OllamaProvider()
    return _active_provider
