# Run inside Blender (via Blender MCP): exec(open(".../blender/build_cessna.py").read())
# Rebuilds scene "Cessna_Build" from blender/src_cessna/scene.gltf and exports
# blender/cessna_raw.glb (compressed to public/cessna.glb by blender/compress.sh).
import bpy, os, io, re, contextlib
from mathutils import Vector, Matrix

ROOT = "/Users/perry/Documents/Code/game/plane-labs"
SRC = os.path.join(ROOT, "blender/src_cessna/scene.gltf")
OUT = os.path.join(ROOT, "blender/cessna_raw.glb")

# Parent-empty base names in the source (nose -Y, left +X, up +Z).
DROP = {"Cube.010", "Plane.030", "Circle.002", "Circle.005"}  # chocks, remove-before-flight tags, tie-downs
PART_OF = {
    "wing": ["Plane.005", "Plane.020", "Plane.021", "Plane.022", "Plane.029"],
    "struts": ["Circle.004", "Plane.031"],
    "propeller": ["Plane", "Plane.011"],
    "cowling": ["Plane.006"],
    "windows": ["Plane.016"],
    "door_L": ["Plane.013"],
    "door_R": ["Plane.014"],
    "interior": ["Plane.028", "Plane.037", "Plane.041", "Plane.038", "Plane.039", "Plane.033",
                 "Plane.036", "Plane.040", "Plane.034", "Plane.035", "Circle.003", "Plane.027",
                 "Plane.032", "Plane.023", "Plane.024", "Cube.004", "Cube.006", "Cube.007",
                 "Cube.005", "Circle.001"],
    "main_gear": ["Cube.002", "Cube.001", "Circle"],
    "nose_gear": ["Cube.003", "Cube.009", "Plane.007", "Plane.017"],
    "tail": ["Plane.004", "Plane.009", "Plane.003"],
    "elevator": ["Plane.010"],  # kept as a child of tail so Fly can deflect it
}
LABELS = {"fuselage": "Fuselage", "wing": "Wing & flaps", "struts": "Wing struts",
          "propeller": "Propeller", "cowling": "Engine cowling", "windows": "Windscreen & windows",
          "door_L": "Left door", "door_R": "Right door", "interior": "Cabin interior",
          "main_gear": "Main landing gear", "nose_gear": "Nose gear", "tail": "Tail & elevator"}
ORDER = ["propeller", "cowling", "door_L", "door_R", "windows", "struts", "wing",
         "tail", "nose_gear", "main_gear", "interior", "fuselage"]
# exploded-diagram layout, Blender axes after step 3: +X nose, +Y left, +Z up
EXPLODE = {
    "fuselage": ((0, 0, -1), 0.0), "wing": ((0, 0, 1), 3.2), "struts": ((0, 0, 1), 1.7),
    "propeller": ((1, 0, 0), 3.2), "cowling": ((1, 0, 0), 1.7), "windows": ((0, 0, 1), 1.6),
    "door_L": ((0, 1, 0), 2.6), "door_R": ((0, -1, 0), 2.6), "interior": ((0, 0, -1), 1.9),
    "main_gear": ((0, 0, -1), 3.3), "nose_gear": ((0, 0, -1), 3.3), "tail": ((-1, 0, 0), 3.0),
}

base = lambda name: re.sub(r"\.\d{3}$", "", name).rsplit("_", 1)[0]
lookup = {src: part for part, srcs in PART_OF.items() for src in srcs}

old = bpy.data.scenes.get("Cessna_Build")
if old:
    for o in list(old.objects): bpy.data.objects.remove(o)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("Cessna_Build")  # never touches the user's other scenes
bpy.context.window.scene = sc
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.import_scene.gltf(filepath=SRC)
meshes = lambda: [o for o in sc.objects if o.type == "MESH"]

# 1. classify by parent, then flatten the hierarchy
part_for = {}
for o in meshes():
    b = base(o.parent.name) if o.parent else ""
    part_for[o.name] = None if b in DROP else lookup.get(b, "fuselage")
for o in meshes():
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in sc.objects if o.type != "MESH"]: bpy.data.objects.remove(o)
for o in meshes():
    if part_for.get(o.name) is None: bpy.data.objects.remove(o)
for o in meshes():
    if o.animation_data: o.animation_data_clear()

# 2. join per part. Object names are global in a .blend: park same-named objects
#    from other scenes (e.g. the F-16's "fuselage") and restore them after export.
parked = []
for n in list(LABELS) + ["elevator"]:
    other = bpy.data.objects.get(n)
    if other and sc not in other.users_scene:
        other.name = n + "__parked"; parked.append((other, n))
groups = {}
for o in meshes(): groups.setdefault(part_for[o.name], []).append(o)
missing = (set(LABELS) | {"elevator"}) - set(groups)
assert not missing, f"no geometry for {missing}"
for part, objs in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = part
    bpy.context.view_layer.objects.active.data.name = "c172_" + part

# 3. orient nose +X (rotate +90° about Z: -Y -> +X, +X (left) -> +Y), centre, longest side = 10
rot = Matrix.Rotation(1.5707963, 4, "Z")
for o in meshes(): o.matrix_world = rot @ o.matrix_world
pts = [o.matrix_world @ Vector(c) for o in meshes() for c in o.bound_box]
lo, hi = Vector(map(min, zip(*pts))), Vector(map(max, zip(*pts)))
norm = Matrix.Scale(10 / max(hi - lo), 4) @ Matrix.Translation(-(lo + hi) / 2)
for o in meshes(): o.matrix_world = norm @ o.matrix_world
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

# elevator: origin on its hinge (front edge = max X), child of tail
elev, tail = sc.objects["elevator"], sc.objects["tail"]
eb = [elev.matrix_world @ Vector(c) for c in elev.bound_box]
sc.cursor.location = (max(p.x for p in eb), sum(p.y for p in eb) / 8, sum(p.z for p in eb) / 8)
bpy.ops.object.select_all(action="DESELECT"); elev.select_set(True); bpy.context.view_layer.objects.active = elev
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
elev.parent = tail
elev.matrix_parent_inverse = tail.matrix_world.inverted()

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
for o in meshes(): o.name = "c172_" + o.name  # free the shared names first
for o, n in parked: o.name = n
print("exported", sorted(o.name[5:] for o in meshes()), os.path.getsize(OUT) // 1024, "KB")
