#!/bin/bash
# Ollama Benchmark Script
# Tests prompt processing speed and generation speed for each model

PROMPT_SHORT="Hello, how are you?"
PROMPT_MEDIUM="Explain the key differences between revenue, gross profit, and net income in a company's financial statements. Keep it under 200 words."
MODELS=("qwen3.5:4b" "qwen3.5:9b" "qwen3:30b-a3b" "qwen3.5:30b-a3b" "qwen3.5:35b")

echo "============================================="
echo "  OLLAMA BENCHMARK - $(date)"
echo "============================================="
echo ""

for MODEL in "${MODELS[@]}"; do
    echo "---------------------------------------------"
    echo "  MODEL: $MODEL"
    echo "---------------------------------------------"

    # Check if model exists
    if ! ollama list 2>/dev/null | grep -q "$(echo $MODEL | cut -d: -f1).*$(echo $MODEL | cut -d: -f2)"; then
        echo "  [SKIPPED] Model not installed"
        echo ""
        continue
    fi

    # Short prompt test (measures generation speed)
    echo "  Test 1: Short prompt"
    ollama run "$MODEL" "$PROMPT_SHORT" --verbose 2>&1 | grep -E "total duration|prompt eval|eval count|eval duration|eval rate"
    echo ""

    # Medium prompt test (measures both prompt processing and generation)
    echo "  Test 2: Medium prompt"
    ollama run "$MODEL" "$PROMPT_MEDIUM" --verbose 2>&1 | grep -E "total duration|prompt eval|eval count|eval duration|eval rate"
    echo ""

    # Unload model to free memory for next test
    ollama stop "$MODEL" 2>/dev/null
    sleep 2
done

echo "============================================="
echo "  BENCHMARK COMPLETE"
echo "============================================="
