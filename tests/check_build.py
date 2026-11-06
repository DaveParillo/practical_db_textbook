"""Audit the built book and extract SQL for the bundled-engine check."""

from pathlib import Path
from collections import Counter
import base64
import json

from bs4 import BeautifulSoup


def main():
    root = Path(__file__).resolve().parents[1]
    build = root / "build/html"
    seed = (root / "src/_static/textbook.sqlite3").read_bytes()
    records = []
    counts = Counter()
    for path in sorted(build.rglob("*.html")):
        soup = BeautifulSoup(path.read_text(), "html.parser")
        for kind in ("tb-code", "tb-reveal", "tb-choice", "tb-match", "tb-blank"):
            counts[kind] += len(soup.find_all(kind))
        for node in soup.find_all("tb-code"):
            config = json.loads(node.find("script", class_="tb-code__config").string)
            assert config["runner"] == "browser"
            assert config["language"] == "sql"
            assert len(config["files"]) == 1
            attached = config["files"][0]
            assert attached["hidden"] is True
            assert attached["editable"] is False and attached["is_text"] is False
            assert base64.b64decode(attached["data_url"].split(",", 1)[1]) == seed
            answers = []
            if config["source"].strip() == "-- Write your query here.":
                reveal = node.find_next(["tb-code", "tb-reveal"])
                assert reveal is not None and reveal.name == "tb-reveal", node["id"]
                answers = [block.get_text() for block in reveal.select("div.highlight pre")]
                assert answers, f"No SQL answer found for {node['id']}"
            records.append({
                "name": node["id"], "document": str(path.relative_to(build)),
                "source": config["source"],
                "runBefore": config.get("runBefore", []),
                "runAfter": config.get("runAfter", []),
                "answers": answers,
            })
    assert len({record["name"] for record in records}) == len(records), "Duplicate SQL editor identifiers"
    assert counts == {"tb-code": 107, "tb-reveal": 63, "tb-choice": 17,
                      "tb-match": 4, "tb-blank": 4}, counts
    assert sum(bool(record["answers"]) for record in records) == 58
    by_name = {record["name"]: record for record in records}
    create = by_name["table-creation-self-test-create"]
    drop = by_name["table-creation-self-test-drop"]
    assert drop["runBefore"] == [create["answers"][0].strip()]
    assert drop["source"].strip() == "-- Write your query here."
    (root / "build/sql-inputs.json").write_text(json.dumps({
        "seed": base64.b64encode(seed).decode(), "exercises": records,
    }, indent=2) + "\n")
    print(json.dumps(dict(counts), indent=2))
    print("All SQL identifiers and read-only database attachments verified.")


if __name__ == "__main__":
    main()
