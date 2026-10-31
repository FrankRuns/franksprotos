"""Run: python -m unittest discover -s tests -v"""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from run_graph import validate

class GraphValidationTests(unittest.TestCase):
    def setUp(self):
        self.evidence = [{"id": "e1", "url": "https://example.org"}]
        self.nodes = [{"id": "a", "status": "verified", "evidence_ids": ["e1"]},
                      {"id": "b", "status": "inferred", "evidence_ids": []}]
    def test_valid(self):
        graph = {"nodes": self.nodes, "edges": [{"source": "a", "target": "b", "status": "inferred", "evidence_ids": []}]}
        self.assertIs(validate(graph, self.evidence), graph)
    def test_unreferenced_verified_claim(self):
        graph = {"nodes": [{"id": "a", "status": "verified", "evidence_ids": []}], "edges": []}
        with self.assertRaises(ValueError): validate(graph, self.evidence)
    def test_unknown_edge_endpoint(self):
        graph = {"nodes": self.nodes, "edges": [{"source": "a", "target": "missing", "status": "inferred"}]}
        with self.assertRaises(ValueError): validate(graph, self.evidence)
    def test_unknown_source(self):
        graph = {"nodes": [{"id": "a", "status": "verified", "evidence_ids": ["fake"]}], "edges": []}
        with self.assertRaises(ValueError): validate(graph, self.evidence)

if __name__ == "__main__":
    unittest.main()
