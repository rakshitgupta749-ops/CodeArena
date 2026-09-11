import json
import os
import difflib

def load_data(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def jaccard_similarity(str1, str2):
    s1 = set(str1.lower().split())
    s2 = set(str2.lower().split())
    if not s1 or not s2: return 0.0
    return len(s1.intersection(s2)) / float(len(s1.union(s2)))

def main():
    train_data = load_data("data/train_v2.json")
    test_data = load_data("data/test_v2.json")
    
    train_texts = set([s["text"] for s in train_data])
    test_texts = [s["text"] for s in test_data]
    
    exact_duplicates = 0
    near_duplicates = 0
    
    for t in test_texts:
        if t in train_texts:
            exact_duplicates += 1
            continue
        
        # very basic check for near duplicates
        # since we generated the data, we want to ensure there is no massive leakage.
        # This can be slow O(N*M), so we'll just sample 100 test items
        pass

    # For a fast near duplicate check, let's use a simpler approach on a subset
    subset = test_texts[:100]
    for t in subset:
        for tr in list(train_texts)[:500]: # check against 500 train samples
            sim = jaccard_similarity(t, tr)
            if sim > 0.9 and sim < 1.0:
                near_duplicates += 1
                break

    print(f"Total Train Samples: {len(train_texts)}")
    print(f"Total Test Samples: {len(test_texts)}")
    print(f"Exact Leakage (Train vs Test): {exact_duplicates} examples ({exact_duplicates/len(test_texts)*100:.2f}%)")
    print(f"Estimated Near-Duplicate Leakage (Sampled): ~{near_duplicates}%")

if __name__ == "__main__":
    main()
