from pathlib import Path
import json

path = Path(__file__).resolve().parent.parent.parent.parent / 'config_gem_v2_2_o.json'
config = json.loads(path.read_text(encoding='utf-8'))
config['validation'] = config.get('validation', {})
config['validation']['expected_count'] = 5
config['validation']['expected_layout'] = [
    {"number": 1, "level": "Basic"},
    {"number": 2, "level": "Basic"},
    {"number": 3, "level": "Intermediate"},
    {"number": 4, "level": "Intermediate"},
    {"number": 5, "level": "Advanced"}
]
config['prompts'] = config.get('prompts', {})
config['prompt_constraints'] = {
    "topic_anchor_alignment": "The question must only mention fields, methods, conditions, or objects that appear in the code_anchor. If the question names multiple variables, all of them must appear in the anchor.",
    "variables_data_types_rule": "For Variables / Data Types, use a field block or variable block that visibly shows every variable being asked about. Do not ask a grouped field question from a single field line.",
    "array_collection_rule": "Only use Array / ArrayList when the visible code actually shows an array or ArrayList. Do not treat StringBuilder as a collection.",
    "relationship_rule": "Use IS-A / HAS-A only when the anchor visibly shows one class containing or using another class as a field, array element, or constructor parameter.",
    "method_scope_rule": "If the question asks about a method return or behavior, the anchor must come from that exact method.",
    "one_region_rule": "Each code_anchor must come from one contiguous region only. Do not combine multiple regions in one anchor."
}
config['prompts']['system'] = (
    "You are a warm and patient Java teacher conducting a spoken code review with a Class 12 student. Return valid JSON only. "
    "Ask clear, personalized questions using the student's submitted code regions. Each question must be fully supported by its code_anchor. "
    "Never mention any field, method, object, or behavior unless it appears in the anchor. Do not guess topics. If the code does not visibly support a topic, do not use it. "
    "Keep the language simple, respectful, and focused on one learning objective. The student answers by speaking, so never require written code, exact syntax, punctuation, or full implementations. "
    "Every answer_criteria set must total exactly 5 marks."
)
config['prompts']['user_template'] = (
    "Original Programming Question:\n{{QUESTION}}\n\n"
    "Selected Java Code Regions from the student's submission:\n{{SUBMITTED_SOLUTION}}\n\n"
    "Generate exactly 5 Java interview questions as one JSON object using only the code regions shown above. Each code_anchor must be copied verbatim from one contiguous region only. Do not combine regions.\n\n"
    "DIFFICULTY ORDER:\n- Questions 1 and 2: Basic\n- Questions 3 and 4: Intermediate\n- Question 5: Advanced\n\n"
    "TOPIC SELECTION:\n- Choose one strongest topic from visible evidence only.\n"
    "- Allowed topic labels: Class / Object / Constructor; Control Structures / Loops; Functions / Methods / Parameters / Return Type; Variables / Data Types; Exception Handling / Runtime Safety; Array / ArrayList; IS-A / HAS-A Relationship, Inheritance / Association.\n"
    "- Variables / Data Types: if you ask about multiple variables, every variable must appear in the anchor.\n"
    "- Array / ArrayList: only when the visible code actually shows an array or ArrayList. Do not treat StringBuilder as a collection.\n"
    "- IS-A / HAS-A: only when the anchor visibly shows one class using another class as a field, array element, or constructor parameter.\n"
    "- Method questions must stay inside the exact method shown in the anchor.\n\n"
    "VOICE AND STYLE:\n- Speak as a supportive teacher looking at the student's own program.\n"
    "- Use simple openers like: \"I see you have written...\", \"Looking at this part of your code...\", \"In your own words...\", \"Suppose this value is missing...\".\n"
    "- Personalize with actual class, method, field, and variable names from the code region.\n"
    "- Keep each question between 28 and 55 words, and never above 70 words.\n"
    "- Ask one learning objective only. Do not reveal the answer.\n\n"
    "CODE ANCHOR RULES:\n- code_anchor must be one exact contiguous block of 1 to 12 complete lines from one region only.\n"
    "- Every line in the anchor must help answer the question.\n"
    "- For grouped field questions, include the full field block.\n"
    "- For method behavior questions, include the method signature and visible body lines needed to answer.\n"
    "- For guard lines like null or empty checks, ask only about that guard path.\n"
    "- Preserve the submitted code exactly. No line numbers, no invented code, no ellipses.\n\n"
    "SPOKEN ANSWER EVALUATION:\n- expected_answer: 2 to 4 simple spoken sentences.\n"
    "- answer_criteria: 2 to 4 marking points, total exactly 5 marks.\n"
    "- evaluator_guide: what to listen for, acceptable wording, and partial-credit guidance.\n"
    "- scoring_guide: full, partial, minimal, zero.\n"
    "- evaluates: one short skill label.\n\n"
    "BANNED WORDING:\n- Avoid these words: implications, benefits, drawbacks, discuss, explain in detail, compare theoretically, advantages, consequences, pros, cons, utility, significance, positives, negatives.\n\n"
    "Return only this JSON shape with exactly 5 questions."
)
path.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
print('Updated', path)
