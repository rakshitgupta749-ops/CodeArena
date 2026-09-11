import json
import os
import sys
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

_model = None
_tokenizer = None
_id2label = None

def load_model():
    global _model, _tokenizer, _id2label
    if _model is None or _tokenizer is None:
        if not os.path.exists(MODEL_DIR):
            raise FileNotFoundError(f"Model directory not found at {MODEL_DIR}. Please run train.py first.")

        label_map_file = os.path.join(MODEL_DIR, "label_mapping.json")
        if os.path.exists(label_map_file):
            with open(label_map_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                _id2label = {int(k): v for k, v in data["id2label"].items()}
        else:
            _id2label = {
                0: "GENUINE_ABUSE", 1: "PROMPT_INJECTION", 2: "SOLUTION_REQUEST",
                3: "EXPLANATION_REQUEST", 4: "NORMAL_TECHNICAL", 5: "WEAK_TECHNICAL",
                6: "NONSENSE_RANDOM", 7: "HARMLESS_UNRELATED"
            }

        _tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        _model.eval()

def predict(text: str):
    load_model()
    if not isinstance(text, str) or not text.strip():
        empty_probs = {label: (1.0 if label == "NORMAL_TECHNICAL" else 0.0) for label in _id2label.values()}
        return {
            "label": "NORMAL_TECHNICAL",
            "confidence": 1.0,
            "probabilities": empty_probs
        }

    inputs = _tokenizer(
        text,
        truncation=True,
        max_length=128,
        padding=True,
        return_tensors="pt"
    )

    with torch.no_grad():
        outputs = _model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]
        pred_id = torch.argmax(probs).item()

    pred_label = _id2label.get(pred_id, "NORMAL_TECHNICAL")
    confidence = float(probs[pred_id].item())
    all_probs = {_id2label[i]: float(probs[i].item()) for i in range(len(probs))}

    return {
        "text": text,
        "label": pred_label,
        "confidence": round(confidence, 4),
        "probabilities": {k: round(v, 4) for k, v in all_probs.items()}
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        input_text = " ".join(sys.argv[1:])
        result = predict(input_text)
        print(json.dumps(result, indent=2))
    else:
        # Default CLI test
        print("Model loaded ready for inference. Pass a string argument to test prediction.")
