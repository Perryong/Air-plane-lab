# usage: python3 tests/check_cockpit_glb.py public/cockpit.glb
import json, os, struct, sys

MAX_BYTES = 20 * 1024 * 1024

def load(path):
    b = open(path, "rb").read()
    magic, _, _ = struct.unpack_from("<4sII", b, 0)
    assert magic == b"glTF", "not a GLB"
    n, kind = struct.unpack_from("<I4s", b, 12)
    assert kind == b"JSON"
    return json.loads(b[20:20 + n])

def check(path):
    size = os.path.getsize(path)
    assert size <= MAX_BYTES, f"{size / 1e6:.1f} MB > 20 MB"
    g = load(path)
    assert any(n.get("name") == "eye_captain" for n in g["nodes"]), "no eye_captain node"
    assert g.get("images"), "textures not embedded"
    return size

if __name__ == "__main__":
    print(f"COCKPIT GLB OK ({check(sys.argv[1]) / 1e6:.1f} MB)")
