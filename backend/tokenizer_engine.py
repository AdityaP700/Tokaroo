try:
	from core.tokenization import decode_tokens, get_tokens
except ModuleNotFoundError:
	from backend.core.tokenization import decode_tokens, get_tokens