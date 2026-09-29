# Run inside Blender (via Blender MCP): exec(open(".../blender/build_b777.py").read())
# Rebuilds scene "B777_Build" from blender/src_b777/scene.gltf and exports
# blender/b777_raw.glb (compressed to public/b777.glb by blender/compress.sh).
import bpy, os, io, re, contextlib
from mathutils import Vector, Matrix

ROOT = "/Users/perry/Documents/Code/game/plane-labs"
SRC = os.path.join(ROOT, "blender/src_b777/scene.gltf")
OUT = os.path.join(ROOT, "blender/b777_raw.glb")
PREFIX = "b777_"

LABELS = {"fuselage": "Fuselage", "wing_L": "Left wing", "wing_R": "Right wing",
          "flaps_L": "Left flaps & slats", "flaps_R": "Right flaps & slats",
          "engine_L": "Left engine (Trent 800)", "engine_R": "Right engine (Trent 800)",
          "nose_gear": "Nose gear", "main_gear": "Main gear", "tail_fin": "Vertical fin",
          "stabilizers": "Horizontal stabilisers"}
CHILD = {"fan_L": "engine_L", "fan_R": "engine_R", "elevator": "stabilizers"}  # movable in Fly
ORDER = ["nose_gear", "main_gear", "engine_L", "engine_R", "flaps_L", "flaps_R",
         "tail_fin", "stabilizers", "wing_L", "wing_R", "fuselage"]
# exploded-diagram layout, Blender axes after orienting: +X nose, +Y left, +Z up
EXPLODE = {
    "fuselage": ((0, 0, -1), 0.0), "wing_L": ((0, 1, 0), 3.2), "wing_R": ((0, -1, 0), 3.2),
    "flaps_L": ((0, 0, 1), 1.8), "flaps_R": ((0, 0, 1), 1.8),
    "engine_L": ((0, 0, -1), 2.2), "engine_R": ((0, 0, -1), 2.2),
    "nose_gear": ((0, 0, -1), 2.2), "main_gear": ((0, 0, -1), 2.2),
    "tail_fin": ((0, 0, 1), 2.4), "stabilizers": ((-1, 0, 0), 2.2),
}
FLAP_COMPONENTS = {"47", "49", "50", "52", "53", "55", "56", "57", "58", "59"}
WING_COMPONENTS = {"48", "62", "63", "64", "65", "66", "67", "68"}  # spoilers / upper-surface panels


def classify(o):
    """Source frame: nose -Y, up +Z, pilot's left = +X, metres."""
    n = o.name
    mats = {s.material.name.split(".")[0] for s in o.material_slots if s.material}
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo, hi = Vector(map(min, zip(*bb))), Vector(map(max, zip(*bb)))
    c = (lo + hi) / 2
    side = "L" if c.x > 0 else "R"
    comp = re.match(r"Component#(\d+)_", n)
    if comp and comp.group(1) == "2": return "tail_fin"
    if comp and comp.group(1) == "71": return "stabilizers"
    if n.startswith("Group_032"): return "elevator"
    if comp and comp.group(1) == "81": return "wing_R"
    if n.startswith("Group_029"): return "wing_L"
    if comp and comp.group(1) in FLAP_COMPONENTS: return "flaps_" + side
    if comp and comp.group(1) in WING_COMPONENTS: return "wing_" + side
    if "Generic Turbofan Fan" in n or "Material6" in mats: return "fan_" + side
    if 7.5 < abs(c.x) < 12 and -13 < c.y < -1 and c.z < 5.6: return "engine_" + side  # nacelle, pylon
    if c.y < -28 and c.z < 3.5: return "nose_gear"
    if 1.5 < abs(c.x) < 7 and -3 < c.y < 3.5 and c.z < 3.3: return "main_gear"
    return "fuselage"


old = bpy.data.scenes.get("B777_Build")
if old:
    for o in list(old.objects): bpy.data.objects.remove(o)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("B777_Build")  # never touches the user's other scenes
bpy.context.window.scene = sc
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.import_scene.gltf(filepath=SRC)
meshes = lambda: [o for o in sc.objects if o.type == "MESH"]

# 1. classify, then flatten the hierarchy
part_for = {o.name: classify(o) for o in meshes()}
for o in meshes():
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in sc.objects if o.type != "MESH"]: bpy.data.objects.remove(o)

# 2. join per part; park same-named objects from other scenes (names are global)
names = list(LABELS) + list(CHILD)
parked = []
for n in names:
    other = bpy.data.objects.get(n)
    if other and sc not in other.users_scene:
        other.name = n + "__parked"; parked.append((other, n))
groups = {}
for o in meshes(): groups.setdefault(part_for[o.name], []).append(o)
missing = set(names) - set(groups)
assert not missing, f"no geometry for {missing}"
for part, objs in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = part
    bpy.context.view_layer.objects.active.data.name = PREFIX + part

# 3. orient nose +X (rotate +90° about Z), centre, longest side = 10
rot = Matrix.Rotation(1.5707963, 4, "Z")
for o in meshes(): o.matrix_world = rot @ o.matrix_world
pts = [o.matrix_world @ Vector(c) for o in meshes() for c in o.bound_box]
lo, hi = Vector(map(min, zip(*pts))), Vector(map(max, zip(*pts)))
norm = Matrix.Scale(10 / max(hi - lo), 4) @ Matrix.Translation(-(lo + hi) / 2)
for o in meshes(): o.matrix_world = norm @ o.matrix_world
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

# elevator: origin on its hinge (front edge = max X); fans spin about their centre
elev = sc.objects["elevator"]
eb = [elev.matrix_world @ Vector(c) for c in elev.bound_box]
sc.cursor.location = (max(p.x for p in eb), sum(p.y for p in eb) / 8, sum(p.z for p in eb) / 8)
bpy.ops.object.select_all(action="DESELECT"); elev.select_set(True); bpy.context.view_layer.objects.active = elev
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
for child, parent in CHILD.items():
    c, p = sc.objects[child], sc.objects[parent]
    c.parent = p
    c.matrix_parent_inverse = p.matrix_world.inverted()

# 4. explode metadata in glTF axes: Blender (x,y,z) -> glTF (x, z, -y)
for name, ((x, y, z), dist) in EXPLODE.items():
    o = sc.objects[name]
    o["explode_dir"] = [x, z, -y]
    o["explode_dist"] = dist
    o["order"] = ORDER.index(name)
    o["label"] = LABELS[name]

with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True, export_yup=True,
                              use_active_scene=True, export_animations=False)
counts = {p: len(v) for p, v in groups.items()}
for o in meshes(): o.name = PREFIX + o.name  # free the shared names, then restore the parked ones
for o, n in parked: o.name = n
print("exported", counts, os.path.getsize(OUT) // 1024, "KB")
