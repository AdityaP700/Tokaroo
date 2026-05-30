try:
	from diagnostics.prompt_failure import analyze_prompt_failure
	from diagnostics.rag_diagnosis import generate_rag_diagnosis
except ModuleNotFoundError:
	from backend.diagnostics.prompt_failure import analyze_prompt_failure
	from backend.diagnostics.rag_diagnosis import generate_rag_diagnosis