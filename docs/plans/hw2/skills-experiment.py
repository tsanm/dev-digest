#!/usr/bin/env python3
"""
API Contract Reviewer — with-vs-without-skills experiment harness (HW-2).

Runs the SAME agent on the SAME PR twice — once with its skills unlinked, once
with them linked — and prints a side-by-side diff of the findings. The point:
show that skills make the review catch a breaking change it otherwise misses.

Usage:
    python3 skills-experiment.py <agentId> <prId> <skillId,skillId,...>

Env: API base defaults to http://localhost:3001 (override with API_BASE).
"""
import json, os, sys, time, urllib.request

B = os.environ.get("API_BASE", "http://localhost:3001")


def call(method, path, body=None):
    # NOTE: only send a content-type when there IS a body — a body-less POST/PUT
    # with content-type: application/json trips Fastify's 415 guard.
    headers = {"content-type": "application/json"} if body is not None else {}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B + path, data=data, headers=headers, method=method)
    return json.load(urllib.request.urlopen(req))


def run_review(agent_id, pr_id):
    before = len(call("GET", f"/pulls/{pr_id}/reviews"))
    resp = call("POST", f"/pulls/{pr_id}/review", {"agentId": agent_id})
    run_id = resp["runs"][0]["run_id"]
    reviews = []
    for _ in range(90):  # wait for a NEW review row to land (run is fire-and-forget)
        reviews = call("GET", f"/pulls/{pr_id}/reviews")
        if len(reviews) > before:
            break
        time.sleep(2)
    review = sorted(reviews, key=lambda r: r.get("created_at", ""))[-1]
    trace = call("GET", f"/runs/{run_id}/trace")
    skills_len = len((trace.get("prompt_assembly") or {}).get("skills") or "")
    return review, skills_len


# Keywords that indicate the review actually spotted the API-contract break
# (field rename/removal, schema change, missing deprecation) — vs generic noise.
BREAKING_KW = ("renam", "remov", "breaking", "contract", "deprecat", "schema", "field", "backward")


def caught_breaking(findings):
    for f in findings:
        hay = f"{f.get('title','')} {f.get('rationale','')}".lower()
        if any(k in hay for k in BREAKING_KW):
            return True
    return False


def summarize(label, review, skills_len):
    fs = review.get("findings", [])
    hit = "YES ✅" if caught_breaking(fs) else "NO ❌"
    print(f"\n=== {label} (skills block in prompt: {skills_len} chars) ===")
    print(f"verdict={review.get('verdict')}  score={review.get('score')}  findings={len(fs)}  breaking-change caught: {hit}")
    for f in fs:
        print(f"  [{f.get('severity')}] {f.get('title')}  ({f.get('file')}:{f.get('start_line')})")
    return fs


def main():
    agent_id, pr_id, skills_csv = sys.argv[1], sys.argv[2], sys.argv[3]
    skill_ids = [s for s in skills_csv.split(",") if s]

    # --- Run A: WITHOUT skills (unlink all) ---
    call("POST", f"/agents/{agent_id}/skills", {"skill_ids": []})
    a_review, a_len = run_review(agent_id, pr_id)
    a_findings = summarize("WITHOUT skills", a_review, a_len)

    # --- Run B: WITH skills (link them) ---
    call("POST", f"/agents/{agent_id}/skills", {"skill_ids": skill_ids})
    b_review, b_len = run_review(agent_id, pr_id)
    b_findings = summarize("WITH skills", b_review, b_len)

    # --- Diff ---
    print("\n===================  DIFF  ===================")
    print(f"findings:   without={len(a_findings)}   with={len(b_findings)}")
    def sevset(fs):
        return sorted({f.get("severity") for f in fs})
    print(f"severities: without={sevset(a_findings)}   with={sevset(b_findings)}")
    a_titles = {f.get("title", "").lower() for f in a_findings}
    new = [f for f in b_findings if f.get("title", "").lower() not in a_titles]
    if new:
        print("NEW findings the skills surfaced:")
        for f in new:
            print(f"  + [{f.get('severity')}] {f.get('title')}")
    else:
        print("(no net-new titles — compare severities/rationale above)")


if __name__ == "__main__":
    main()
