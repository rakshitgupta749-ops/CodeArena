import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request


def load_config(path):
    with open(path, "r", encoding="utf-8") as file:
        config = json.load(file)

    api = config.get("api", {})
    generation = config.get("generation", {})
    prompts = config.get("prompts", {})

    api_key = api.get("key") or api.get("api_key") or config.get("api_key")
    api_key_env = (
        api.get("key_env")
        or api.get("api_key_env")
        or config.get("api_key_env")
    )
    if not api_key and api_key_env:
        api_key = os.getenv(api_key_env)

    normalized = {
        "api_key": api_key,
        "api_url": api.get("url") or config.get("api_url"),
        "model": api.get("model") or config.get("model"),
        "temperature": generation.get("temperature", config.get("temperature", 0.7)),
        "max_tokens": generation.get("max_tokens", config.get("max_tokens", 1200)),
        "retry_attempts": api.get(
            "retry_attempts",
            generation.get("retry_attempts", config.get("retry_attempts", 2)),
        ),
        "timeout_seconds": api.get(
            "timeout_seconds",
            generation.get("timeout_seconds", config.get("timeout_seconds", 60)),
        ),
        "system_prompt": prompts.get("system") or config.get("system_prompt"),
        "user_prompt_template": (
            prompts.get("user_template")
            or config.get("user_prompt_template")
            or config.get("user_prompt")
        ),
        "validation": config.get("validation", {}),
    }

    user_agent = api.get("user_agent") or config.get("user_agent")
    if user_agent:
        normalized["user_agent"] = user_agent

    required = ["api_key", "api_url", "model", "system_prompt", "user_prompt_template"]
    missing = [key for key in required if not normalized.get(key)]
    if "api_key" in missing and api_key_env:
        missing[missing.index("api_key")] = f"api key from ${api_key_env}"
    if missing:
        raise ValueError("Missing required config values: " + ", ".join(missing))

    return normalized


def build_prompt(template, question, submitted_solution):
    variation_seed = f"{time.time_ns()}-{os.getpid()}"
    replacements = {
        "{{QUESTION}}": question,
        "{{SUBMITTED_SOLUTION}}": submitted_solution,
        "{{CODE_SNIPPET}}": submitted_solution,
        "{{VARIATION_SEED}}": variation_seed,
        "{question}": question,
        "{QUESTION}": question,
        "{submitted_solution}": submitted_solution,
        "{SUBMITTED_SOLUTION}": submitted_solution,
        "{code_snippet}": submitted_solution,
        "{CODE_SNIPPET}": submitted_solution,
        "{variation_seed}": variation_seed,
        "{VARIATION_SEED}": variation_seed,
    }

    prompt = template
    for placeholder, value in replacements.items():
        prompt = prompt.replace(placeholder, value)

    return prompt


def read_text_arg(value, file_path):
    if file_path:
        return Path(file_path).read_text(encoding="utf-8")

    return value or ""


def read_inputs(args):
    question = read_text_arg(args.question, args.question_file)
    submitted_solution = read_text_arg(args.solution, args.solution_file)

    if not question:
        raise ValueError("Provide the original Java question with --question-file or --question.")

    if not submitted_solution:
        submitted_solution = read_text_arg(args.code, args.code_file)

    if not submitted_solution and args.topic:
        submitted_solution = args.topic

    if not submitted_solution:
        raise ValueError("Provide the submitted Java solution with --solution-file, --solution, --code-file, or --code.")

    return question, submitted_solution


def get_rate_limit_wait_seconds(error, body):
    retry_after = error.headers.get("Retry-After")
    if retry_after:
        try:
            return max(1.0, float(retry_after))
        except ValueError:
            pass

    match = re.search(r"try again in\s+([0-9.]+)s", body, flags=re.IGNORECASE)
    if match:
        return max(1.0, float(match.group(1)) + 1.0)

    return 30.0

DEFAULT_EXPECTED_COUNT = 7
DEFAULT_EXPECTED_LEVELS = {
    1: "Basic",
    2: "Basic",
    3: "Intermediate",
    4: "Intermediate",
    5: "Intermediate",
    6: "Advanced",
    7: "Advanced",
}
DEFAULT_ALLOWED_TOPICS = [
    "Class / Object / Constructor",
    "Control Structures / Loops",
    "Functions / Methods / Parameters / Return Type",
    "Variables / Data Types",
    "Exception Handling / Runtime Safety",
    "Array / ArrayList",
    "IS-A / HAS-A Relationship, Inheritance / Association",
]

BANNED_QUESTION_WORDS = [
    "implications",
    "benefits",
    "drawbacks",
    "discuss",
    "explain in detail",
    "compare theoretically",
    "advantages",
]


def get_expected_count(config):
    validation = (config or {}).get("validation", {})
    if validation.get("expected_count"):
        return int(validation["expected_count"])

    layout = validation.get("expected_layout")
    if layout:
        return len(layout)

    expected_levels = validation.get("expected_levels")
    if expected_levels:
        return len(expected_levels)

    return DEFAULT_EXPECTED_COUNT


def get_expected_levels(config):
    validation = (config or {}).get("validation", {})
    layout = validation.get("expected_layout")
    if layout:
        return {
            int(item["number"]): item["level"]
            for item in layout
            if "number" in item and "level" in item
        }

    expected_levels = validation.get("expected_levels")
    if expected_levels:
        return {
            int(item["number"]): item["level"]
            for item in expected_levels
            if "number" in item and "level" in item
        }

    return DEFAULT_EXPECTED_LEVELS


def get_expected_topics(config):
    layout = (config or {}).get("validation", {}).get("expected_layout")
    if not layout:
        return {}

    return {
        int(item["number"]): item["topic"]
        for item in layout
        if "number" in item and "topic" in item
    }


def get_allowed_topics(config):
    validation = (config or {}).get("validation", {})
    if validation.get("allowed_topics"):
        return validation["allowed_topics"]

    expected_topics = get_expected_topics(config)
    if expected_topics:
        return sorted(set(expected_topics.values()))

    return DEFAULT_ALLOWED_TOPICS


def get_banned_question_words(config):
    return (config or {}).get("validation", {}).get(
        "banned_question_words",
        BANNED_QUESTION_WORDS,
    )


def get_banned_vocabulary_scope(config):
    return str(
        (config or {}).get("validation", {}).get("banned_vocabulary_scope", "question")
    ).lower()


def requires_separator_lines(config):
    return bool((config or {}).get("validation", {}).get("require_separators", False))


def question_contains_banned_word(question, banned_word):
    banned_word = banned_word.strip().lower()
    if not banned_word:
        return False

    escaped_terms = [re.escape(term) for term in banned_word.split()]
    pattern = r"(?<![A-Za-z0-9_])" + r"\s+".join(escaped_terms) + r"(?![A-Za-z0-9_])"
    return re.search(pattern, question.lower()) is not None


def split_question_blocks(text):
    matches = list(re.finditer(r"(?m)^Q(\d+)\.\s+\[(Basic|Intermediate|Advanced)\]", text))
    blocks = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((int(match.group(1)), match.group(2), text[match.start():end].strip()))
    return blocks


def extract_field(block, field_name):
    pattern = rf"(?ms)^{re.escape(field_name)}:\s*(.*?)(?=^\w[\w ]*:\s|\Z)"
    match = re.search(pattern, block)
    return match.group(1).strip() if match else ""


def clean_snippet(snippet):
    cleaned = snippet.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_+-]*\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    if cleaned.startswith("`") and cleaned.endswith("`") and len(cleaned) >= 2:
        cleaned = cleaned[1:-1]
    return cleaned.strip()


def snippet_exists_in_solution(snippet, solution):
    snippet = clean_snippet(snippet)
    if not snippet:
        return False

    normalized_solution = solution.replace("\r\n", "\n").replace("\r", "\n")
    normalized_snippet = snippet.replace("\r\n", "\n").replace("\r", "\n")
    if normalized_snippet in normalized_solution:
        return True

    snippet_lines = [line.strip() for line in normalized_snippet.split("\n") if line.strip()]
    solution_lines = [line.strip() for line in normalized_solution.split("\n") if line.strip()]
    if len(snippet_lines) == 1:
        return snippet_lines[0] in solution_lines

    for start in range(0, len(solution_lines) - len(snippet_lines) + 1):
        if solution_lines[start:start + len(snippet_lines)] == snippet_lines:
            return True

    return False


def topic_has_evidence(topic, solution):
    text = solution or ""
    compact = re.sub(r"\s+", " ", text)

    if topic == "Class / Object / Constructor":
        return (
            re.search(r"\bclass\s+[A-Za-z_]\w*", text) is not None
            or re.search(r"\bnew\s+[A-Za-z_]\w*\s*\(", text) is not None
            or re.search(r"\b(public|private|protected)?\s*[A-Z][A-Za-z0-9_]*\s*\(", text) is not None
        )

    if topic == "Control Structures / Loops":
        return (
            re.search(r"\b(if|switch|for|while)\s*\(", text) is not None
            or re.search(r"\bdo\s*\{", text) is not None
            or re.search(r"\bbreak\s*;", text) is not None
            or re.search(r"\bcontinue\s*;", text) is not None
            or " ? " in compact
        )

    if topic == "Functions / Methods / Parameters / Return Type":
        return (
            re.search(r"\b(public|private|protected|static|final|synchronized)\b[\w\s<>\[\],.?]*\s+[A-Za-z_]\w*\s*\(", text) is not None
            or re.search(r"\breturn\b", text) is not None
            or re.search(r"\.[A-Za-z_]\w*\s*\(", text) is not None
        )

    if topic == "Variables / Data Types":
        return (
            re.search(r"\b(byte|short|int|long|float|double|char|boolean|String|Integer|Long|Double|Float|Boolean|Character|var)\b\s+[\w<>\[\],\s]+[;=]", text) is not None
            or re.search(r"\b[A-Z][A-Za-z0-9_<>]*\s+[a-zA-Z_]\w*\s*[;=,)]", text) is not None
        )

    if topic == "Exception Handling / Runtime Safety":
        return (
            re.search(r"\b(try|catch|finally|throw|throws)\b", text) is not None
            or re.search(r"\.[A-Za-z_]\w*\s*\(", text) is not None
            or re.search(r"\[[^\]]+\]", text) is not None
            or re.search(r"\bparse[A-Za-z]*\s*\(", text) is not None
            or re.search(r"/\s*[A-Za-z0-9_(]", text) is not None
        )

    if topic == "Array / ArrayList":
        return (
            re.search(r"\[\]", text) is not None
            or re.search(r"\b(ArrayList|List|Collection|Map|Set|Queue|Deque|HashMap|HashSet)\s*<", text) is not None
            or re.search(r"\.(add|get|put|remove|contains|size)\s*\(", text) is not None
            or re.search(r"\bfor\s*\([^:]+:\s*[^)]+\)", text) is not None
        )

    if topic == "IS-A / HAS-A Relationship, Inheritance / Association":
        return (
            re.search(r"\b(extends|implements)\b", text) is not None
            or re.search(r"\b[A-Z][A-Za-z0-9_<>]*\s+[a-zA-Z_]\w*\s*[,);=]", text) is not None
        )

    return False


def validate_questions(text, submitted_solution, config=None):
    errors = []
    expected_count = get_expected_count(config)
    expected_levels = get_expected_levels(config)
    expected_topics = get_expected_topics(config)
    allowed_topics = get_allowed_topics(config)
    banned_question_words = get_banned_question_words(config)
    banned_vocabulary_scope = get_banned_vocabulary_scope(config)
    blocks = split_question_blocks(text)
    if len(blocks) != expected_count:
        errors.append(f"Expected {expected_count} questions, found {len(blocks)}.")

    if requires_separator_lines(config):
        separator_count = len(re.findall(r"(?m)^---$", text))
        expected_separator_count = max(0, expected_count - 1)
        if separator_count != expected_separator_count:
            errors.append(
                f"Expected {expected_separator_count} separator lines containing only '---', "
                f"found {separator_count}."
            )

    seen_numbers = set()
    seen_snippets = {}
    for number, tier, block in blocks:
        seen_numbers.add(number)
        if number < 1 or number > expected_count:
            errors.append(f"Q{number}: unexpected question number.")
            continue

        expected_tier = expected_levels.get(number)
        if tier != expected_tier:
            errors.append(f"Q{number}: expected tier [{expected_tier}], found [{tier}].")

        topic = extract_field(block, "Topic")
        expected_topic = expected_topics.get(number)
        if expected_topic and topic != expected_topic:
            errors.append(f"Q{number}: expected topic '{expected_topic}', found '{topic or 'missing'}'.")
        elif not expected_topic and topic not in allowed_topics:
            errors.append(f"Q{number}: topic '{topic or 'missing'}' is not in allowed topics.")
        elif topic in allowed_topics and not topic_has_evidence(topic, submitted_solution):
            errors.append(f"Q{number}: topic '{topic}' has no detected evidence in the submitted solution.")

        snippet = clean_snippet(extract_field(block, "Code Snippet"))
        if not snippet:
            errors.append(f"Q{number}: missing Code Snippet.")
        else:
            snippet_key = re.sub(r"\s+", " ", snippet).strip()
            if "..." in snippet or "placeholder" in snippet.lower():
                errors.append(f"Q{number}: Code Snippet contains placeholder text or ellipses.")
            if not snippet_exists_in_solution(snippet, submitted_solution):
                errors.append(f"Q{number}: Code Snippet is not copied from the submitted solution: {snippet!r}.")
            if snippet_key in seen_snippets:
                errors.append(f"Q{number}: Code Snippet duplicates Q{seen_snippets[snippet_key]}.")
            else:
                seen_snippets[snippet_key] = number

        field_values = {
            "Topic": topic,
            "Question": extract_field(block, "Question"),
            "Expected Answer": extract_field(block, "Expected Answer"),
            "Evaluator Guide": extract_field(block, "Evaluator Guide"),
            "Evaluates": extract_field(block, "Evaluates"),
        }
        for field_name, field_text in field_values.items():
            if not field_text:
                errors.append(f"Q{number}: missing {field_name}.")

        if banned_vocabulary_scope in {"all", "all_fields", "all_output_fields", "global"}:
            fields_to_check = field_values
        else:
            fields_to_check = {"Question": field_values["Question"]}

        for field_name, field_text in fields_to_check.items():
            for banned_word in banned_question_words:
                if question_contains_banned_word(field_text, banned_word):
                    errors.append(f"Q{number}: {field_name} uses banned wording '{banned_word}'.")

    missing_numbers = [number for number in range(1, expected_count + 1) if number not in seen_numbers]
    if missing_numbers:
        errors.append("Missing question numbers: " + ", ".join(f"Q{number}" for number in missing_numbers) + ".")

    return errors


def call_model(config, user_prompt):
    payload = {
        "model": config["model"],
        "temperature": config.get("temperature", 0.7),
        "max_tokens": config.get("max_tokens", 1200),
        "messages": [
            {"role": "system", "content": config["system_prompt"]},
            {"role": "user", "content": user_prompt},
        ],
    }

    request_data = json.dumps(payload).encode("utf-8")
    retry_attempts = max(0, int(config.get("retry_attempts", 2)))

    for attempt in range(retry_attempts + 1):
        request = urllib.request.Request(
            config["api_url"],
            data=request_data,
            headers={
                "Authorization": "Bearer " + config["api_key"],
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": config.get("user_agent", "JavaInterviewQuestionGenerator/1.0"),
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=config.get("timeout_seconds", 60)) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code == 429 and attempt < retry_attempts:
                wait_seconds = get_rate_limit_wait_seconds(error, body)
                print(
                    f"Rate limit reached. Waiting {wait_seconds:.1f}s before retrying...",
                    file=sys.stderr,
                )
                time.sleep(wait_seconds)
                continue

            if "error code: 1010" in body.lower():
                raise RuntimeError(
                    "API request failed with HTTP 403: provider gateway rejected the request signature "
                    "(error code 1010). Try again with the updated User-Agent header; if it still fails, "
                    "the API key, account, network, VPN, or provider-side firewall may be blocking access."
                ) from error
            raise RuntimeError(f"API request failed with HTTP {error.code}: {body}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"API request failed: {error.reason}") from error

    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("Unexpected API response: " + json.dumps(data, indent=2)) from error


def main():
    parser = argparse.ArgumentParser(description="Generate Java interview questions from a code snippet.")
    parser.add_argument("--config", default="config.json", help="Path to the JSON config file.")
    parser.add_argument("--question-file", help="Path to a file containing the original Java question.")
    parser.add_argument("--question", help="Inline original Java question.")
    parser.add_argument("--solution-file", help="Path to a file containing the submitted Java solution.")
    parser.add_argument("--solution", help="Inline submitted Java solution.")
    parser.add_argument("--code-file", help="Backward-compatible alias for --solution-file.")
    parser.add_argument("--code", help="Backward-compatible alias for --solution.")
    parser.add_argument("--topic", help="Backward-compatible alias for inline submitted Java solution.")
    args = parser.parse_args()

    config = load_config(args.config)
    try:
        question, submitted_solution = read_inputs(args)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

    user_prompt = build_prompt(config["user_prompt_template"], question, submitted_solution)
    try:
        questions = call_model(config, user_prompt)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    validation_errors = validate_questions(questions, submitted_solution, config)
    if validation_errors:
        print("Generated output failed validation:", file=sys.stderr)
        for error in validation_errors:
            print(f"- {error}", file=sys.stderr)
        print(questions)
        return 1

    print(questions)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
