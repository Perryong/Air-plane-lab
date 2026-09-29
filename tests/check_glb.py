# usage: python3 tests/check_glb.py public/f16.glb [f16|c172|b777]
import json, struct, sys, math

AIRCRAFT = {
    "f16": {"fuselage", "nose_cone", "canopy", "wing_L", "wing_R", "tail_fin",
            "stabilizer_L", "stabilizer_R", "engine_nozzle", "stores"},
    "c172": {"fuselage", "wing", "struts", "propeller", "cowling", "windows",
             "door_L", "door_R", "interior", "main_gear", "nose_gear", "tail"},
    "b777": {"fuselage", "wing_L", "wing_R", "flaps_L", "flaps_R", "engine_L", "engine_R",
             "nose_gear", "main_gear", "tail_fin", "stabilizers"},
}
CHILDREN = {"c172": {"tail": "elevator"},
            "b777": {"engine_L": "fan_L", "engine_R": "fan_R", "stabilizers": "elevator"}}  # movable surfaces kept as named child nodes

def load(path):
    b = open(path, "rb").read()
    magic, _, _ = struct.unpack_from("<4sII", b, 0)
    assert magic == b"glTF", "not a GLB"
    n, kind = struct.unpack_from("<I4s", b, 12)
    assert kind == b"JSON"
    return json.loads(b[20:20+n])

def lateral_half_width(g, node):
    # glTF z = sideways; POSITION accessors carry min/max even when Draco-compressed
    tz = node.get("translation", [0, 0, 0])[2]
    zs = []
    for prim in g["meshes"][node["mesh"]]["primitives"]:
        acc = g["accessors"][prim["attributes"]["POSITION"]]
        zs += [acc["min"][2] + tz, acc["max"][2] + tz]
    return max(abs(v) for v in zs)


def check(g, kind="f16"):
    PARTS = AIRCRAFT[kind]
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
    if kind != "b777":  # the 777 is colour materials only (no textures in the source)
        assert g.get("images"), "textures not embedded"
    if kind == "b777":  # wing surfaces (spoilers) must not be left on the fuselage
        half = lateral_half_width(g, nodes["fuselage"])
        assert half < 2.7, f"fuselage spans ±{half:.2f} u sideways: wing panels were classified as fuselage"
    for part, child in CHILDREN.get(kind, {}).items():
        kids = [g["nodes"][i].get("name") for i in nodes[part].get("children", [])]
        assert child in kids, f"{part} has no child node {child!r}"

if __name__ == "__main__":
    kind = sys.argv[2] if len(sys.argv) > 2 else "f16"
    check(load(sys.argv[1]), kind); print(f"GLB OK ({kind})")
