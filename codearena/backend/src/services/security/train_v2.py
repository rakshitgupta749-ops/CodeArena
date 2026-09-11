import json
import os
import random
import numpy as np
import torch
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

set_seed(42)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_DATA_PATH = os.path.join(BASE_DIR, "data", "train_v2.json")
VAL_DATA_PATH = os.path.join(BASE_DIR, "data", "val_v2.json")
MODEL_OUTPUT_DIR = os.path.join(BASE_DIR, "model")

LABEL2ID = {
    "GENUINE_ABUSE": 0,
    "PROMPT_INJECTION": 1,
    "SOLUTION_REQUEST": 2,
    "EXPLANATION_REQUEST": 3,
    "NORMAL_TECHNICAL": 4,
    "WEAK_TECHNICAL": 5,
    "NONSENSE_RANDOM": 6,
    "HARMLESS_UNRELATED": 7
}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

class ModerationDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )

        item = {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(label, dtype=torch.long)
        }
        return item

def main():
    print("--- Starting DistilBERT Moderation Model Training (v2) ---")
    
    with open(TRAIN_DATA_PATH, "r", encoding="utf-8") as f:
        train_samples = json.load(f)
        
    with open(VAL_DATA_PATH, "r", encoding="utf-8") as f:
        val_samples = json.load(f)

    train_texts = [s["text"] for s in train_samples]
    train_labels = [LABEL2ID[s["label"]] for s in train_samples]
    
    val_texts = [s["text"] for s in val_samples]
    val_labels = [LABEL2ID[s["label"]] for s in val_samples]

    print(f"Train split size: {len(train_texts)}, Validation split size: {len(val_texts)}")

    MODEL_NAME = "distilbert-base-uncased"
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABEL2ID),
        id2label=ID2LABEL,
        label2id=LABEL2ID
    )

    train_dataset = ModerationDataset(train_texts, train_labels, tokenizer)
    val_dataset = ModerationDataset(val_texts, val_labels, tokenizer)

    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    model.to(device)

    optimizer = AdamW(model.parameters(), lr=3e-5, weight_decay=0.01)
    epochs = 2

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0
        for batch in train_loader:
            optimizer.zero_grad()
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels_tensor = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels_tensor
            )
            loss = outputs.loss
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_train_loss = total_loss / len(train_loader)

        model.eval()
        val_preds = []
        val_targets = []
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels_tensor = batch["labels"].to(device)

                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                logits = outputs.logits
                preds = torch.argmax(logits, dim=-1)

                val_preds.extend(preds.cpu().numpy())
                val_targets.extend(labels_tensor.cpu().numpy())

        acc = accuracy_score(val_targets, val_preds)
        print(f"Epoch {epoch}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Accuracy: {acc * 100:.2f}%")

    os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
    model.save_pretrained(MODEL_OUTPUT_DIR)
    tokenizer.save_pretrained(MODEL_OUTPUT_DIR)

    label_map_file = os.path.join(MODEL_OUTPUT_DIR, "label_mapping.json")
    with open(label_map_file, "w", encoding="utf-8") as f:
        json.dump({"label2id": LABEL2ID, "id2label": ID2LABEL}, f, indent=2)

    print(f"\nModel and Tokenizer successfully saved to: {MODEL_OUTPUT_DIR}")

    precision, recall, f1, _ = precision_recall_fscore_support(val_targets, val_preds, average="weighted")
    print("\n--- Final Validation Metrics ---")
    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {precision * 100:.2f}%")
    print(f"Recall:    {recall * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    print("\nClassification Report:")
    target_names = [ID2LABEL[i] for i in range(len(LABEL2ID))]
    print(classification_report(val_targets, val_preds, target_names=target_names, digits=4))

if __name__ == "__main__":
    main()
