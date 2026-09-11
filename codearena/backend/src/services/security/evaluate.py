import json
import os
import torch
import time
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_PATH = os.path.join(BASE_DIR, "data", "test_v2.json")
ADV_DATA_PATH = os.path.join(BASE_DIR, "data", "adversarial.json")
MODEL_OUTPUT_DIR = os.path.join(BASE_DIR, "model")

def evaluate_on_file(file_path, model, tokenizer, device, label2id, id2label, dataset_name):
    print(f"\n--- Evaluating on {dataset_name} ({os.path.basename(file_path)}) ---")
    
    with open(file_path, "r", encoding="utf-8") as f:
        samples = json.load(f)
        
    texts = [s["text"] for s in samples]
    labels = [label2id.get(s["label"], -1) for s in samples]

    preds = []
    
    # Batch predict for speed
    batch_size = 32
    
    start_time = time.time()
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        encoding = tokenizer(
            batch_texts,
            truncation=True,
            max_length=128,
            padding=True,
            return_tensors="pt"
        ).to(device)

        with torch.no_grad():
            outputs = model(**encoding)
            logits = outputs.logits
            batch_preds = torch.argmax(logits, dim=-1).cpu().numpy()
            preds.extend(batch_preds)
            
    end_time = time.time()
    
    if len(texts) > 0:
        latency_ms = ((end_time - start_time) / len(texts)) * 1000
        print(f"Average pure model inference latency: {latency_ms:.2f} ms per sample")

    # Evaluate metrics
    valid_indices = [i for i, lbl in enumerate(labels) if lbl != -1]
    
    val_targets = [labels[i] for i in valid_indices]
    val_preds = [preds[i] for i in valid_indices]
    
    if len(valid_indices) == 0:
        print("No valid labels found for evaluation.")
        return

    acc = accuracy_score(val_targets, val_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(val_targets, val_preds, average="weighted")

    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {precision * 100:.2f}%")
    print(f"Recall:    {recall * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    
    print("\nClassification Report:")
    
    # Only pass target names that actually exist in the targets
    present_labels = sorted(list(set(val_targets + val_preds)))
    target_names = [id2label[i] for i in present_labels]
    
    try:
        print(classification_report(val_targets, val_preds, labels=present_labels, target_names=target_names, digits=4))
    except Exception as e:
        print(f"Could not print classification report: {e}")

    # Analyze False Positives/Negatives (Specifically for SECURITY vs NON-SECURITY)
    # Security classes: 0 (ABUSE), 1 (PROMPT_INJECTION)
    # We want to know if something benign was blocked, or if something malicious was allowed.
    print("\n--- Error Analysis (Security vs Benign) ---")
    false_positives = 0
    false_negatives = 0
    
    for i, (tgt, prd) in enumerate(zip(val_targets, val_preds)):
        tgt_sec = tgt in [0, 1]
        prd_sec = prd in [0, 1]
        
        if tgt_sec and not prd_sec:
            false_negatives += 1
            print(f"❌ False Negative: '{texts[valid_indices[i]]}' | True: {id2label[tgt]}, Pred: {id2label[prd]}")
        elif not tgt_sec and prd_sec:
            false_positives += 1
            print(f"⚠️ False Positive: '{texts[valid_indices[i]]}' | True: {id2label[tgt]}, Pred: {id2label[prd]}")

    print(f"\nTotal Security False Positives (Benign blocked): {false_positives}")
    print(f"Total Security False Negatives (Malicious allowed): {false_negatives}")


def main():
    label_map_file = os.path.join(MODEL_OUTPUT_DIR, "label_mapping.json")
    with open(label_map_file, "r") as f:
        maps = json.load(f)
        LABEL2ID = maps["label2id"]
        # JSON keys are strings, convert to int
        ID2LABEL = {int(k): v for k, v in maps["id2label"].items()}
        
    print(f"Loaded {len(LABEL2ID)} labels.")
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading model from {MODEL_OUTPUT_DIR} to {device}...")
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_OUTPUT_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_OUTPUT_DIR)
    model.to(device)
    model.eval()
    
    evaluate_on_file(TEST_DATA_PATH, model, tokenizer, device, LABEL2ID, ID2LABEL, "Test Set (10% Split)")
    evaluate_on_file(ADV_DATA_PATH, model, tokenizer, device, LABEL2ID, ID2LABEL, "Adversarial Set (Hard Negatives)")

if __name__ == "__main__":
    main()
