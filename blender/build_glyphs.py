"""Nexmed graph glyphs — one small 3D symbol per entity type, for the 3D evidence graph.

    blender -b --factory-startup -P blender/build_glyphs.py -- [--no-render]

Outputs public/models/nexmed-glyphs.glb with meshes GLYPH_<type> (each centred, bounding radius 1,
smooth normals, no textures — the app colours them) and public/models/nexmed-glyphs.png (contact sheet).
Types match src/lib/atlas/types.ts EntityType.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nexmed_lib import *  # noqa: E402,F401,F403

ARGS = args_after_dashdash()
RENDER = "--no-render" not in ARGS
TAU = math.tau

scene = reset_scene()
C = collection("GLYPHS")
C_RIG = collection("RIG")
MAT = material("MAT-glyph", PALETTE["brand"], roughness=0.35, coat=0.4)


def finish(name, bm, smooth=True):
    """Centre on the bounding-sphere centre and scale to radius 1."""
    bm.verts.ensure_lookup_table()
    lo = Vector((min(v.co.x for v in bm.verts), min(v.co.y for v in bm.verts), min(v.co.z for v in bm.verts)))
    hi = Vector((max(v.co.x for v in bm.verts), max(v.co.y for v in bm.verts), max(v.co.z for v in bm.verts)))
    c = (lo + hi) / 2
    r = max((v.co - c).length for v in bm.verts)
    for v in bm.verts:
        v.co = (v.co - c) / r
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    ob = mesh_object(f"GLYPH_{name}", bm, C, MAT, smooth=smooth)
    return ob


def uv_sphere(bm, center, radius, segs=16, rings=10, scale=(1, 1, 1)):
    m = Matrix.Translation(center) @ Matrix.Diagonal((radius * scale[0], radius * scale[1], radius * scale[2], 1))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0, matrix=m)


def tube(bm, pts, r, segs=6):
    """Swept tube with parallel-transport frames (no joints, no gaps) and flat caps."""
    pts = [Vector(p) for p in pts]
    t0 = (pts[1] - pts[0]).normalized()
    n = t0.orthogonal().normalized()
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        rings.append([bm.verts.new(p + (n * math.cos(TAU * k / segs) + b * math.sin(TAU * k / segs)) * r) for k in range(segs)])
    for a, c in zip(rings, rings[1:]):
        for k in range(segs):
            bm.faces.new((a[k], a[(k + 1) % segs], c[(k + 1) % segs], c[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


glyphs = []

# disease — the hub: a smooth sphere wrapped by an equatorial band (a "cell")
bm = bmesh.new()
uv_sphere(bm, (0, 0, 0), 1.0, 32, 20)
segs, rings, major, minor = 48, 6, 1.0, 0.09
grid = []
for i in range(segs):
    a = TAU * i / segs
    ring = []
    for j in range(rings):
        b = TAU * j / rings
        ring.append(bm.verts.new(((major + minor * math.cos(b)) * math.cos(a), (major + minor * math.cos(b)) * math.sin(a), minor * math.sin(b))))
    grid.append(ring)
for i in range(segs):
    for j in range(rings):
        bm.faces.new((grid[i][j], grid[(i + 1) % segs][j], grid[(i + 1) % segs][(j + 1) % rings], grid[i][(j + 1) % rings]))
glyphs.append(finish("disease", bm))

# gene — a short double-helix segment with base pairs
bm = bmesh.new()
for phase in (0.0, 0.78 * math.pi):
    pts = [Vector((0.45 * math.cos(t * 1.6 * TAU / 24 + phase), 0.45 * math.sin(t * 1.6 * TAU / 24 + phase), -1.1 + 2.2 * t / 24)) for t in range(25)]
    tube(bm, pts, 0.13, 7)
for k in range(1, 6):
    t = k * 4
    a = Vector((0.45 * math.cos(t * 1.6 * TAU / 24), 0.45 * math.sin(t * 1.6 * TAU / 24), -1.1 + 2.2 * t / 24))
    b = Vector((0.45 * math.cos(t * 1.6 * TAU / 24 + 0.78 * math.pi), 0.45 * math.sin(t * 1.6 * TAU / 24 + 0.78 * math.pi), -1.1 + 2.2 * t / 24))
    bm_cylinder_between(bm, a, b, 0.07, segments=6)
glyphs.append(finish("gene", bm))

# variant — a cut crystal (one change in the code)
bm = bmesh.new()
top, bot = bm.verts.new((0, 0, 1.25)), bm.verts.new((0, 0, -1.25))
ring = [bm.verts.new((0.75 * math.cos(TAU * i / 6), 0.75 * math.sin(TAU * i / 6), 0.15)) for i in range(6)]
for i in range(6):
    bm.faces.new((ring[i], ring[(i + 1) % 6], top))
    bm.faces.new((ring[(i + 1) % 6], ring[i], bot))
glyphs.append(finish("variant", bm, smooth=False))

# phenotype — a drop (a sign or symptom someone can observe)
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
for v in bm.verts:
    z = v.co.z
    if z > 0:
        k = 1 - z ** 1.3
        v.co.x *= k
        v.co.y *= k
        v.co.z = z * 1.6
glyphs.append(finish("phenotype", bm))

# pathway (mechanism) — a cycle: ring with three beads
bm = bmesh.new()
segs, rings, major, minor = 32, 6, 0.8, 0.13
grid = []
for i in range(segs):
    a = TAU * i / segs
    ring = []
    for j in range(rings):
        b = TAU * j / rings
        ring.append(bm.verts.new(((major + minor * math.cos(b)) * math.cos(a), (major + minor * math.cos(b)) * math.sin(a), minor * math.sin(b))))
    grid.append(ring)
for i in range(segs):
    for j in range(rings):
        bm.faces.new((grid[i][j], grid[(i + 1) % segs][j], grid[(i + 1) % segs][(j + 1) % rings], grid[i][(j + 1) % rings]))
for k in range(3):
    a = TAU * k / 3 + 0.3
    uv_sphere(bm, (major * math.cos(a), major * math.sin(a), 0), 0.3, 12, 8)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))  # face the camera
glyphs.append(finish("pathway", bm))

# trial — a flask
bm = bmesh.new()
prof = [(0.0, -1.0), (0.85, -1.0), (0.95, -0.9), (0.9, -0.7), (0.35, 0.35), (0.3, 0.95), (0.38, 1.05), (0.38, 1.12), (0.0, 1.12)]
n = 20
rows = []
for (r, z) in prof:
    rows.append([bm.verts.new((r * math.cos(TAU * i / n), r * math.sin(TAU * i / n), z)) for i in range(n)])
for a, b in zip(rows, rows[1:]):
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
glyphs.append(finish("trial", bm))

# study (paper) — a page with a folded corner on a second page
bm = bmesh.new()
for dz, dx in ((0.0, 0.0), (-0.16, 0.12)):
    m = Matrix.Translation((dx, -dx, dz)) @ Matrix.Diagonal((0.72, 1.0, 0.05, 1))
    bmesh.ops.create_cube(bm, size=2.0, matrix=m)
tri = [bm.verts.new(p) for p in ((0.72, 1.0, 0.06), (0.32, 1.0, 0.06), (0.72, 0.6, 0.06))]
bm.faces.new(tri)
for y in (0.55, 0.25, -0.05, -0.35, -0.65):  # lines of text, embossed
    m = Matrix.Translation((-0.08, y, 0.07)) @ Matrix.Diagonal((0.48, 0.035, 0.02, 1))
    bmesh.ops.create_cube(bm, size=2.0, matrix=m)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))  # stand the page up
glyphs.append(finish("study", bm, smooth=False))

# treatment — a capsule pill
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=0.42)
for v in bm.verts:
    v.co.z += 0.55 if v.co.z > 0 else -0.55
rot = Matrix.Rotation(math.radians(55), 4, "Y")
bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
glyphs.append(finish("treatment", bm))


def pawn(bm, x, y, s=1.0):
    uv_sphere(bm, (x, y, 0.55 * s), 0.3 * s, 14, 10)
    prof = [(0.0, -0.6), (0.42, -0.6), (0.4, -0.35), (0.22, 0.1), (0.16, 0.25), (0.0, 0.3)]
    n = 16
    rows = [[bm.verts.new((x + r * s * math.cos(TAU * i / n), y + r * s * math.sin(TAU * i / n), z * s)) for i in range(n)] for (r, z) in prof]
    for a, b in zip(rows, rows[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))


# organization (patient group / research org) — three people together
bm = bmesh.new()
for k in range(3):
    a = TAU * k / 3 + math.pi / 2
    pawn(bm, 0.5 * math.cos(a), 0.5 * math.sin(a), 0.85 if k else 1.0)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
glyphs.append(finish("organization", bm))

# investigator — one person
bm = bmesh.new()
pawn(bm, 0, 0, 1.0)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
glyphs.append(finish("investigator", bm))

for ob in glyphs:
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()

print(f"[nexmed] glyphs={len(glyphs)} triangles={triangles(glyphs)} " + " ".join(f"{o.name}:{triangles([o])}" for o in glyphs))
glb = os.path.join(PUBLIC_MODELS, "nexmed-glyphs.glb")
export_glb(glb, glyphs, animations=False, compression="none")

blend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nexmed-glyphs.blend")
# contact sheet layout: 5 x 2 grid facing the camera
for i, ob in enumerate(glyphs):
    ob.location = ((i % 5) * 2.6 - 5.2, 0, -(i // 5) * 2.6 + 1.3)
    ob.rotation_euler = (math.radians(15), 0, math.radians(25))
bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)

if RENDER:
    world(scene, PALETTE["brand_mist"], 0.6)
    area_light("LGT-key", (-6, -8, 7), (0, 0, 0), 2500, 6, "#fffaf2", C_RIG)
    area_light("LGT-rim", (4, 6, 5), (0, 0, 0), 1200, 5, "#cfe6ff", C_RIG)
    camera("CAM-glyphs", (0, -16, 0), (0, 0, 0), lens=40, coll=C_RIG)
    setup_cycles(scene, samples=48, width=1300, height=620, transparent=True)
    png = os.path.join(PUBLIC_MODELS, "nexmed-glyphs.png")
    scene.render.filepath = png
    bpy.ops.render.render(write_still=True)
    print(f"[nexmed] glyph sheet {png}")

# ------------------------------------------------------------------ optional: one transparent icon per glyph (static UI use)
#   blender -b --factory-startup -P blender/build_glyphs.py -- --no-render --icons
if "--icons" in ARGS:
    icon_dir = os.path.join(PUBLIC_MODELS, "glyphs")
    os.makedirs(icon_dir, exist_ok=True)
    if not scene.world:
        world(scene, PALETTE["brand_mist"], 0.6)
    if not any(o.type == "LIGHT" for o in scene.objects):
        area_light("LGT-key", (-6, -8, 7), (0, 0, 0), 2500, 6, "#fffaf2", C_RIG)
        area_light("LGT-rim", (4, 6, 5), (0, 0, 0), 1200, 5, "#cfe6ff", C_RIG)
    cam = scene.camera or camera("CAM-glyphs", (0, -16, 0), (0, 0, 0), lens=40, coll=C_RIG)
    setup_cycles(scene, samples=48, width=256, height=256, transparent=True)
    for ob in glyphs:
        for other in glyphs:
            other.hide_render = other is not ob
        ob.location = (0, 0, 0)
        ob.rotation_euler = (math.radians(12), 0, math.radians(28))
        cam.location = (0, -6.2, 1.2)
        cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 72
        scene.render.filepath = os.path.join(icon_dir, ob.name.replace("GLYPH_", "") + ".png")
        bpy.ops.render.render(write_still=True)
    print(f"[nexmed] glyph icons -> {icon_dir}")
