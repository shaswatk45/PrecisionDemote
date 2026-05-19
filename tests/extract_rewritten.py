import json, sys
with open('tests/analysis_result.json') as f:
    d = json.load(f)
print("=== REWRITTEN SOURCE ===")
print(d['rewrittenSource'])
print("\n=== SUMMARY ===")
for func in d['functions']:
    safe_names = [n['name'] for n in func['nodes'] if n['isSafe']]
    unsafe_names = [n['name'] for n in func['nodes'] if not n['isSafe']]
    print(f"{func['name']}(): safe={safe_names} | kept={unsafe_names}")
