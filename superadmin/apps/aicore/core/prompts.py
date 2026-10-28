"""Versioned prompt and model configurations (CORE-01: prompt, model and configuration versioning).

A configuration is data (``prompt_configs/<id>@<version>.json``): id, version, description, system
message, user template, output JSON Schema and model parameters. Its ``content_hash`` (SHA-256 of the
canonical JSON) is recorded on every execution, so a silent edit to a released version is visible.

Untrusted text (a supplier statement, an email) is never spliced into instructions. ``render`` puts
it in a delimited data block, removes anything in the text that looks like the delimiters, and the
template tells the model that the block is data, never instructions (blueprint §13.4).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent / "prompt_configs"
DATA_OPEN = "<<<UNTRUSTED_DATA"
DATA_CLOSE = "UNTRUSTED_DATA>>>"
_DELIMITER_LIKE = re.compile(r"<<<\s*/?\s*UNTRUSTED_DATA|UNTRUSTED_DATA\s*>>>", re.IGNORECASE)


@dataclass(frozen=True)
class PromptConfig:
    id: str
    version: int
    description: str
    system: str
    template: str
    output_schema: dict
    model_params: dict = field(default_factory=dict)

    @property
    def ref(self) -> str:
        return f"{self.id}@{self.version}"

    @property
    def content_hash(self) -> str:
        canonical = json.dumps(
            {
                "id": self.id,
                "version": self.version,
                "description": self.description,
                "system": self.system,
                "template": self.template,
                "output_schema": self.output_schema,
                "model_params": self.model_params,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @property
    def temperature(self) -> float:
        return float(self.model_params.get("temperature", 0.0))

    @property
    def max_output_tokens(self) -> int:
        return int(self.model_params.get("max_output_tokens", 1024))

    def render(self, *, data: str, **variables: str) -> tuple[dict, ...]:
        """Chat messages for this prompt. ``data`` is untrusted and goes in the delimited block."""
        block = f"{DATA_OPEN}\n{neutralise(data)}\n{DATA_CLOSE}"
        user = self.template.format(data_block=block, **variables)
        return ({"role": "system", "content": self.system}, {"role": "user", "content": user})


def neutralise(text: str) -> str:
    """Remove delimiter look-alikes so untrusted text cannot close the data block early."""
    return _DELIMITER_LIKE.sub("[removed delimiter]", text)


def input_hash(messages: tuple[dict, ...]) -> str:
    canonical = json.dumps(list(messages), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def from_dict(data: dict) -> PromptConfig:
    required = ("id", "version", "system", "template", "output_schema")
    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError(f"Prompt configuration is missing {', '.join(missing)}.")
    if "{data_block}" not in data["template"]:
        raise ValueError("A prompt template must place untrusted input with {data_block}.")
    return PromptConfig(
        id=str(data["id"]),
        version=int(data["version"]),
        description=str(data.get("description", "")),
        system=str(data["system"]),
        template=str(data["template"]),
        output_schema=dict(data["output_schema"]),
        model_params=dict(data.get("model_params") or {}),
    )


@cache
def load_prompt(prompt_id: str, version: int, directory: Path = CONFIG_DIR) -> PromptConfig:
    path = directory / f"{prompt_id}@{int(version)}.json"
    if not path.is_file():
        raise LookupError(f"No prompt configuration {prompt_id}@{version}.")
    config = from_dict(json.loads(path.read_text(encoding="utf-8")))
    if config.id != prompt_id or config.version != int(version):
        raise ValueError(f"{path.name} declares {config.ref}.")
    return config


def available(directory: Path = CONFIG_DIR) -> list[str]:
    return sorted(path.stem for path in directory.glob("*@*.json"))
