try:
	from core.attention import calculate_attention_weights
except ModuleNotFoundError:
	from backend.core.attention import calculate_attention_weights