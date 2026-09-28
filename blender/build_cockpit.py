# Run inside Blender (via Blender MCP): exec(open(".../blender/build_cockpit.py").read())
# Rebuilds scene "Cockpit_Build" from blender/src_cockpit/scene.gltf, adds the
# captain's eye point and exports blender/cockpit_raw.glb (compressed by compress.sh).
import bpy, os, io, contextlib
from mathutils import Vector, Matrix

ROOT = "/Users/perry/Documents/Code/game/plane-labs"
SRC = os.path.join(ROOT, "blender/src_cockpit/scene.gltf")
OUT = os.path.join(ROOT, "blender/cockpit_raw.glb")
FORWARD_ROT_Z = -1.5707963  # source faces +Y (panel at +Y, cabin door at -Y); turn to +X
PANEL = "757inst"           # main instrument panel group; seats are merged meshes, so the eye is placed from the panel
EYE_BEHIND_PANEL = 0.60     # m, eye to panel face
EYE_ABOVE_PANEL = 0.30      # m, above the panel's centre line
EYE_LEFT = 0.52             # m left of centreline: middle of the captain's displays

old = bpy.data.scenes.get("Cockpit_Build")
if old:
    for o in list(old.objects): bpy.data.objects.remove(o)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("Cockpit_Build")  # never touches the user's other scenes
bpy.context.window.scene = sc
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.import_scene.gltf(filepath=SRC)

# orient: windscreen along +X, up +Z (source is already metres, Z-up)
rot = Matrix.Rotation(FORWARD_ROT_Z, 4, "Z")
for o in [o for o in sc.objects if o.parent is None]:
    o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()

def world_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector(map(min, zip(*pts))), Vector(map(max, zip(*pts)))

panel = next(o for o in sc.objects if o.name.startswith(PANEL))
lo, hi = world_bounds([c for c in panel.children_recursive if c.type == "MESH"])
eye = bpy.data.objects.new("eye_captain", None)
sc.collection.objects.link(eye)
# facing +X, the captain's (left) side is +Y
eye.location = Vector((lo.x - EYE_BEHIND_PANEL, (lo.y + hi.y) / 2 + EYE_LEFT, (lo.z + hi.z) / 2 + EYE_ABOVE_PANEL))

with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True,
                              use_active_scene=True, export_extras=True)
print("eye", tuple(round(v, 3) for v in eye.location), os.path.getsize(OUT) // 1024, "KB")
