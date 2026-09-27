# Run inside Blender (via Blender MCP): exec(open(".../blender/build_f16.py").read())
# Rebuilds scene "F16_Build" from blender/src/scene.gltf and exports public/f16.glb.
import bpy, os
from mathutils import Vector, Matrix

ROOT = "/Users/perry/Documents/Code/game/plane-labs"
SRC = os.path.join(ROOT, "blender/src/scene.gltf")
OUT = os.path.join(ROOT, "blender/f16_raw.glb")  # compressed to public/f16.glb by blender/compress.sh
CX = 0.69  # source model's centreline X (nose points +Y in source)

LABELS = {"fuselage": "Fuselage", "nose_cone": "Nose cone / radome", "canopy": "Canopy",
          "wing_L": "Left wing", "wing_R": "Right wing", "tail_fin": "Vertical tail",
          "stabilizer_L": "Left stabilator", "stabilizer_R": "Right stabilator",
          "engine_nozzle": "Engine nozzle", "stores": "Fuel tanks & stores"}
ORDER = ["stores", "canopy", "nose_cone", "engine_nozzle", "tail_fin",
         "stabilizer_L", "stabilizer_R", "wing_L", "wing_R", "fuselage"]
DIST = 3.0


def bounds(o):
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo, hi = Vector(map(min, zip(*bb))), Vector(map(max, zip(*bb)))
    return (lo + hi) / 2, lo, hi


def src_material(o):
    # Blender renumbers materials on import; the texture file keeps the source name.
    mat = o.material_slots[0].material if o.material_slots else None
    for n in (mat.node_tree.nodes if mat and mat.node_tree else []):
        if n.type == "TEX_IMAGE" and n.image:
            return os.path.basename(n.image.filepath).split("_")[0]
    return ""


def classify(o):
    # Source frame: X lateral (+X = pilot's right), Y forward, Z up.
    c, _, _ = bounds(o)
    X, Y, Z = c.x - CX, c.y, c.z
    m = src_material(o)
    if m == "Material.002": return "canopy"
    if m == "Material.003": return "nose_cone"
    if m in ("Material.005", "Material.006", "Material.007"): return "engine_nozzle"
    if Y < -3.4 and abs(X) < 0.55 and Z < 0.8: return "engine_nozzle"
    if abs(X) < 0.3 and Z > 1.0 and Y < -1.8: return "tail_fin"
    if (Z < -0.62 and abs(X) < 0.4) or (abs(X) > 1.0 and Z < -0.2): return "stores"
    if Y < -2.6 and abs(X) > 0.75: return "stabilizer_R" if X > 0 else "stabilizer_L"
    if abs(X) > 0.8: return "wing_R" if X > 0 else "wing_L"
    return "fuselage"


# 1. fresh scene (never touches the user's other scenes)
old = bpy.data.scenes.get("F16_Build")
if old:
    for o in list(old.objects): bpy.data.objects.remove(o)
    bpy.data.scenes.remove(old)
for name in LABELS:  # our own leftover meshes from earlier runs, so names stay clean
    m = bpy.data.meshes.get(name)
    if m and m.users == 0: bpy.data.meshes.remove(m)
sc = bpy.data.scenes.new("F16_Build")
bpy.context.window.scene = sc
bpy.ops.import_scene.gltf(filepath=SRC)

meshes = lambda: [o for o in sc.objects if o.type == "MESH"]
for o in meshes():
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in sc.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)

# 2. split fused meshes into loose pieces, classify, join per part
bpy.ops.object.select_all(action="DESELECT")
for o in meshes(): o.select_set(True)
bpy.context.view_layer.objects.active = meshes()[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")

groups = {}
for o in meshes(): groups.setdefault(classify(o), []).append(o)
missing = set(LABELS) - set(groups)
assert not missing, f"no geometry for {missing}"
for part, objs in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = part
    bpy.context.view_layer.objects.active.data.name = part

# 3. orient nose +X, centre, scale longest side to 10
rot = Matrix.Rotation(-1.5707963, 4, "Z") @ Matrix.Translation((-CX, 0, 0))
for o in meshes(): o.matrix_world = rot @ o.matrix_world
pts = [o.matrix_world @ Vector(c) for o in meshes() for c in o.bound_box]
lo, hi = Vector(map(min, zip(*pts))), Vector(map(max, zip(*pts)))
centre, k = (lo + hi) / 2, 10 / max(hi - lo)
norm = Matrix.Scale(k, 4) @ Matrix.Translation(-centre)
for o in meshes(): o.matrix_world = norm @ o.matrix_world
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

# 4. explode metadata (stored in glTF axes: Blender (x,y,z) -> glTF (x, z, -y))
fus = sc.objects["fuselage"].location.copy()
for o in meshes():
    d = o.location - fus
    if o.name == "fuselage" or d.length < 1e-4:
        d = Vector((0, 0, -1))
    d.z += 0.35 * d.length
    if o.name == "canopy":  # lifts off like the real hinge, not along the nose
        d = Vector((0.25, 0, 1))
    d.normalize()
    o["explode_dir"] = [round(d.x, 5), round(d.z, 5), round(-d.y, 5)]
    o["explode_dist"] = 0.6 if o.name == "fuselage" else DIST
    o["order"] = ORDER.index(o.name)
    o["label"] = LABELS[o.name]
    o.color = (1, 1, 1, 1)

# 5. export raw (Blender's own WEBP path drops some baseColor images; compress outside)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_extras=True,
                          export_yup=True, use_active_scene=True)
print("exported", sorted(o.name for o in meshes()), os.path.getsize(OUT) // 1024, "KB")
