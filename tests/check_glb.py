# usage: python3 tests/check_glb.py public/f16.glb
import json, struct, sys, math

PARTS = {"fuselage","nose_cone","canopy","wing_L","wing_R","tail_fin",
         "stabilizer_L","stabilizer_R","engine_nozzle","stores"}

def load(path):
    b = open(path, "rb").read()
    magic, _, _ = struct.unpack_from("<4sII", b, 0)
    assert magic == b"glTF", "not a GLB"
    n, kind = struct.unpack_from("<I4s", b, 12)
    assert kind == b"JSON"
    return json.loads(b[20:20+n])

def check(g):
    scene = g["scenes"][g.get("scene", 0)]
    nodes = {g["nodes"][i]["name"]: g["nodes"][i] for i in scene["nodes"]}
    assert set(nodes) == PARTS, f"parts mismatch: {sorted(set(nodes) ^ PARTS)}"
    orders = []
    for name, nd in nodes.items():
        ex = nd.get("extras", {})
        d = ex["explode_dir"]
        assert len(d) == 3 and abs(math.hypot(*d) - 1) < 1e-3, f"{name} dir not unit"
        if name == "fuselage":
            assert ex["explode_dist"] == 0, "fuselage is the diagram anchor; it must not move"
        else:
            assert ex["explode_dist"] > 0, name
            # exploded-diagram layout: every part moves along exactly one axis
            assert sorted(abs(round(v, 4)) for v in d) == [0, 0, 1], f"{name} dir {d} not axis-aligned"
        assert ex["label"], name
        orders.append(ex["order"])
    assert sorted(orders) == list(range(len(PARTS))), "order must be 0..n-1"
    assert g.get("images"), "textures not embedded"

if __name__ == "__main__":
    check(load(sys.argv[1])); print("GLB OK")
