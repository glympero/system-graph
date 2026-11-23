import unittest

from sysgraph.miniyaml import load_all


class MiniYamlTest(unittest.TestCase):
    def test_k8s_style_multi_document(self):
        text = """\
apiVersion: apps/v1   # comment
kind: Deployment
metadata:
  name: "orders"
spec:
  replicas: 3
  ports: [80, 443]
---
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  enabled: true
  metrics:
    - type: Resource
      resource:
        name: cpu
    - type: Pods
"""
        first, second = load_all(text)
        self.assertEqual(first["metadata"]["name"], "orders")
        self.assertEqual(first["spec"], {"replicas": 3, "ports": [80, 443]})
        self.assertEqual(second["spec"]["minReplicas"], 2)
        self.assertIs(second["spec"]["enabled"], True)
        self.assertEqual(second["spec"]["metrics"], [
            {"type": "Resource", "resource": {"name": "cpu"}},
            {"type": "Pods"},
        ])

    def test_sequence_at_parent_indent_and_scalars(self):
        text = "depends_on:\n- a\n- 'b # not a comment'\nempty: []\nnothing:\nname: x\n"
        (doc,) = load_all(text)
        self.assertEqual(doc, {"depends_on": ["a", "b # not a comment"], "empty": [], "nothing": None, "name": "x"})


if __name__ == "__main__":
    unittest.main()
