"""Nexmed hero — the logo idea in 3D.

A DNA double helix grows out of a small forest on the logo's cyanotype-blue medallion; its upper turns
break apart into the nodes and edges of the evidence graph (the atlas).

    blender -b --factory-startup -P blender/build_hero.py -- [--no-render] [--samples 128] [--compression draco|meshopt]

Outputs: public/models/nexmed-hero.glb (animations "Intro" + "Idle"), public/models/nexmed-hero.png (transparent poster),
blender/nexmed-hero.blend. Z-up in Blender, exported Y-up.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nexmed_lib import *  # noqa: E402,F401,F403

ARGS = args_after_dashdash()
RENDER = "--no-render" not in ARGS
SAMPLES = int(ARGS[ARGS.index("--samples") + 1]) if "--samples" in ARGS else 128
PREVIEW = ARGS[ARGS.index("--preview") + 1] if "--preview" in ARGS else None
COMPRESSION = ARGS[ARGS.index("--compression") + 1] if "--compression" in ARGS else "draco"

R = rng(7)
TOP = 0.16           # medallion top surface
HELIX_R = 0.24       # helix radius
PITCH = 0.44         # height of one full turn
Z_BREAK = 1.30       # helix starts to dissolve here
TAU = math.tau
PHASE_B = 0.78 * math.pi  # B-DNA-like offset: visible major + minor grooves
PHASES = (0.0, PHASE_B)

scene = reset_scene()
scene.render.fps = 30
C_HERO = collection("HERO")
C_RIG = collection("RIG")

# ------------------------------------------------------------------ materials
M = {
    "medallion": material("MAT-medallion", PALETTE["brand"], roughness=0.55, coat=0.25),
    "pearl": material("MAT-pearl", PALETTE["pearl"], roughness=0.42, coat=0.15),
    "fir": material("MAT-fir", PALETTE["foliage_deep"], roughness=0.5, coat=0.1),
    "leaf": material("MAT-leaf", PALETTE["foliage"], roughness=0.5, coat=0.1),
    "stone": material("MAT-stone", PALETTE["brand_soft"], roughness=0.6),
    "strand": material("MAT-strand", PALETTE["brand_deep"], roughness=0.28, coat=0.6),
    "rung_a": material("MAT-rung-a", PALETTE["brand"], roughness=0.35, coat=0.3),
    "rung_b": material("MAT-rung-b", PALETTE["brand_light"], roughness=0.35, coat=0.3),
    "edge": material("MAT-edge", PALETTE["edge"], roughness=0.4, emission_hex=PALETTE["brand_light"], emission_strength=0.25),
    "node": material("MAT-node", PALETTE["brand"], roughness=0.25, coat=0.6, emission_hex=PALETTE["brand"], emission_strength=0.45),
    "node_light": material("MAT-node-light", PALETTE["brand_light"], roughness=0.25, coat=0.5, emission_hex=PALETTE["brand_light"], emission_strength=0.35),
    "hub": material("MAT-hub", PALETTE["brand"], roughness=0.2, coat=0.8, emission_hex=PALETTE["brand"], emission_strength=1.1),
}


def radius_at(z):
    """Helix radius: a narrow trunk at the roots that opens into the double helix."""
    u = max(0.0, min(1.0, (z - TOP) / 0.38))
    s = u * u * (3 - 2 * u)
    return 0.032 + (HELIX_R - 0.032) * s


def helix_point(z, phase, extra_r=0.0):
    a = (z - TOP) / PITCH * TAU + phase
    r = radius_at(z) + extra_r
    return Vector((r * math.cos(a), r * math.sin(a), z))


def radial(z, phase):
    a = (z - TOP) / PITCH * TAU + phase
    return Vector((math.cos(a), math.sin(a), 0.0))


# ------------------------------------------------------------------ medallion (the logo circle)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=96, radius1=1.0, radius2=1.0, depth=TOP, matrix=Matrix.Translation((0, 0, TOP / 2)))
base = mesh_object("GEO-base", bm, C_HERO, M["medallion"], smooth=False)
bev = base.modifiers.new("Bevel", "BEVEL")
bev.width = 0.035
bev.segments = 4
bev.limit_method = "ANGLE"
apply_modifiers(base)
# smooth only the bevel / side, keep caps flat
for p in base.data.polygons:
    p.use_smooth = abs(p.normal.z) < 0.999

# pearl rim ring on the top edge, like the paper border of a cyanotype print
bm_rim = bmesh.new()
torus_major, torus_minor = 0.972, 0.011
segs, rings = 120, 6
verts = []
for i in range(segs):
    a = TAU * i / segs
    ring = []
    for j in range(rings):
        b = TAU * j / rings
        x = (torus_major + torus_minor * math.cos(b)) * math.cos(a)
        y = (torus_major + torus_minor * math.cos(b)) * math.sin(a)
        z = TOP + 0.004 + torus_minor * math.sin(b)
        ring.append(bm_rim.verts.new((x, y, z)))
    verts.append(ring)
for i in range(segs):
    for j in range(rings):
        bm_rim.faces.new((verts[i][j], verts[(i + 1) % segs][j], verts[(i + 1) % segs][(j + 1) % rings], verts[i][(j + 1) % rings]))
rim_ob = mesh_object("GEO-rim", bm_rim, C_HERO, M["pearl"])

# ------------------------------------------------------------------ forest (white, like the logo)
forest_parts = [rim_ob]


def fir(x, y, h, seed):
    r = rng(seed)
    bm = bmesh.new()
    # trunk
    bm_cylinder_between(bm, (x, y, TOP - 0.01), (x, y, TOP + h * 0.42), 0.02 * h + 0.006, segments=7)
    tiers = 5
    for i in range(tiers):
        z0 = TOP + h * (0.16 + i * 0.15)
        th = h * 0.30 * (1 - i * 0.07)
        rad = h * 0.27 * (1 - i * 0.165)
        n = 16
        rot = r.uniform(0, TAU)
        ring = []
        for k in range(n):
            a = rot + TAU * k / n
            rr = rad * (1.0 if k % 2 == 0 else 0.66) * r.uniform(0.92, 1.06)
            droop = -0.035 * h if k % 2 == 0 else 0.0
            ring.append(bm.verts.new((x + rr * math.cos(a), y + rr * math.sin(a), z0 + droop)))
        apex = bm.verts.new((x + r.uniform(-0.01, 0.01), y + r.uniform(-0.01, 0.01), z0 + th))
        under = bm.verts.new((x, y, z0 + th * 0.18))
        for k in range(n):
            bm.faces.new((ring[k], ring[(k + 1) % n], apex))
            bm.faces.new((ring[(k + 1) % n], ring[k], under))
    ob = mesh_object(f"GEO-fir-{seed}", bm, C_HERO, M["fir"], smooth=False)
    return ob


forest_parts += [fir(0.50, 0.30, 1.02, 1), fir(0.74, -0.06, 0.74, 2), fir(0.30, 0.62, 0.56, 3), fir(-0.48, 0.58, 0.46, 4), fir(0.62, 0.62, 0.40, 5)]


def leaf_bm(bm, center, along, up, length, width, thick=0.006):
    """A flattened ellipsoid leaf: long axis `along`, flat normal ~ `up`."""
    along = Vector(along).normalized()
    side = along.cross(Vector(up)).normalized()
    normal = side.cross(along).normalized()
    m = Matrix((
        (along.x * length, side.x * width, normal.x * thick, center[0]),
        (along.y * length, side.y * width, normal.y * thick, center[1]),
        (along.z * length, side.z * width, normal.z * thick, center[2]),
        (0, 0, 0, 1),
    ))
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=1.0, matrix=m, calc_uvs=False)


def fern(cx, cy, seed, fronds=5, spread=(140, 320)):
    r = rng(seed)
    bm = bmesh.new()
    for f in range(fronds):
        ang = math.radians(r.uniform(*spread))
        d = Vector((math.cos(ang), math.sin(ang), 0))
        L = r.uniform(0.34, 0.48)
        H = r.uniform(0.18, 0.26)
        n = 24
        pts = []
        for i in range(n + 1):
            s = i / n
            p = Vector((cx, cy, TOP)) + d * (L * s) + Vector((0, 0, H * math.sin(math.pi * s * 0.78) - 0.05 * s * s))
            pts.append(p)
        radii = [1.0 - 0.75 * (i / n) for i in range(n + 1)]
        # rachis
        for i in range(n):
            bm_cylinder_between(bm, pts[i], pts[i + 1], 0.0055 * radii[i] + 0.002, segments=5, cap=False)
        # leaflets, alternating
        for i in range(2, n - 1, 2):
            s = i / n
            tangent = (pts[i + 1] - pts[i - 1]).normalized()
            side = tangent.cross(Vector((0, 0, 1))).normalized()
            ll = 0.075 * (1 - s) ** 0.8 + 0.018
            for sign in (-1, 1):
                dirv = (side * sign + tangent * 0.55 + Vector((0, 0, 0.18))).normalized()
                leaf_bm(bm, pts[i] + dirv * ll * 0.95, dirv, Vector((0, 0, 1)), ll, ll * 0.32)
    return mesh_object(f"GEO-fern-{seed}", bm, C_HERO, M["leaf"])


forest_parts += [fern(-0.50, -0.30, 11), fern(-0.70, 0.12, 12, fronds=4, spread=(100, 260)), fern(-0.22, -0.64, 13, fronds=3, spread=(200, 330))]


def round_plant(cx, cy, seed, stems=4):
    r = rng(seed)
    bm = bmesh.new()
    for s_i in range(stems):
        ang = r.uniform(0, TAU)
        tip = Vector((cx + 0.09 * math.cos(ang), cy + 0.09 * math.sin(ang), TOP + r.uniform(0.12, 0.2)))
        root = Vector((cx, cy, TOP))
        bm_cylinder_between(bm, root, tip, 0.004, segments=5, cap=False)
        for k in range(4):
            t = 0.35 + 0.65 * k / 3
            p = root.lerp(tip, t)
            la = r.uniform(0, TAU)
            dirv = Vector((math.cos(la), math.sin(la), 0.5)).normalized()
            leaf_bm(bm, p + dirv * 0.03, dirv, Vector((0, 0, 1)), 0.034, 0.027, thick=0.005)
    return mesh_object(f"GEO-plant-{seed}", bm, C_HERO, M["leaf"])


forest_parts += [round_plant(-0.36, -0.56, 21), round_plant(-0.80, -0.20, 22), round_plant(0.18, -0.66, 23, stems=3), round_plant(-0.62, 0.40, 24, stems=3)]


def grass(cx, cy, seed, blades=6):
    r = rng(seed)
    bm = bmesh.new()
    for _ in range(blades):
        ang = r.uniform(0, TAU)
        lean = r.uniform(0.2, 0.55)
        h = r.uniform(0.07, 0.13)
        base_p = Vector((cx + r.uniform(-0.03, 0.03), cy + r.uniform(-0.03, 0.03), TOP))
        tip = base_p + Vector((math.cos(ang) * lean * h, math.sin(ang) * lean * h, h))
        m = Matrix.Translation(base_p) @ align_z_to(tip - base_p) @ Matrix.Translation((0, 0, (tip - base_p).length / 2))
        bmesh.ops.create_cone(bm, cap_ends=False, segments=3, radius1=0.006, radius2=0.0, depth=(tip - base_p).length, matrix=m)
    return mesh_object(f"GEO-grass-{seed}", bm, C_HERO, M["leaf"], smooth=False)


forest_parts += [grass(0.56, 0.08, 31), grass(0.86, 0.22, 32), grass(0.24, 0.42, 33), grass(-0.08, -0.46, 34), grass(0.40, -0.40, 35)]


def mound(cx, cy, rx, ry, seed, mat="pearl"):
    r = rng(seed)
    bm, verts = bm_icosphere(1.0, 2)
    for v in verts:
        n = 1 + 0.12 * math.sin(v.co.x * 5 + seed) * math.cos(v.co.y * 4)
        v.co = Vector((v.co.x * rx * n, v.co.y * ry * n, v.co.z * 0.045 + TOP - 0.012))
    bmesh.ops.translate(bm, verts=verts, vec=(cx, cy, 0))
    return mesh_object(f"GEO-mound-{seed}", bm, C_HERO, M[mat])


forest_parts += [mound(0.52, 0.28, 0.2, 0.15, 41), mound(0.74, -0.06, 0.15, 0.12, 42), mound(-0.50, -0.30, 0.2, 0.17, 43), mound(0.30, 0.62, 0.13, 0.1, 44), mound(-0.70, 0.12, 0.14, 0.12, 45)]

# stones along the path (pale blue) — scattered toward the front edge like the logo
stones = []
for i in range(9):
    s = 0.28 + i * 0.075
    x = 0.07 * math.sin(s * 9) + R.uniform(-0.18, 0.18)
    y = -s
    rad = R.uniform(0.025, 0.05)
    bm, verts = bm_icosphere(1.0, 1)
    for v in verts:
        v.co = Vector((v.co.x * rad * 1.4, v.co.y * rad, v.co.z * rad * 0.45 + TOP))
    bmesh.ops.translate(bm, verts=verts, vec=(x, y, 0))
    stones.append(mesh_object(f"GEO-stone-{i}", bm, C_HERO, M["stone"]))

# roots + path from the helix base (white), the trunk "grows" out of them
roots = []
for i in range(7):
    ang = TAU * i / 7 + 0.4
    L = 0.22 + 0.16 * ((i * 37) % 5) / 4
    pts, radii = [], []
    for k in range(13):
        s = k / 12
        a = ang + 0.5 * math.sin(s * 2.4 + i)
        rr = 0.03 + L * s
        pts.append((rr * math.cos(a), rr * math.sin(a), TOP + 0.012 * (1 - s) + 0.002))
        radii.append(1.0 - 0.85 * s)
    roots.append(curve_tube(f"GEO-root-{i}", C_HERO, pts, radii, bevel=0.03, resolution=2, mat=M["strand"]))

path_pts, path_r = [], []
for k in range(21):
    s = k / 20
    path_pts.append((0.06 * math.sin(s * 7.0), -0.05 - 0.9 * s, TOP + 0.002))
    path_r.append(0.35 + 0.65 * s)
path = curve_tube("GEO-path", C_HERO, path_pts, path_r, bevel=0.14, resolution=3, mat=M["pearl"])
for v in path.data.vertices:  # flatten into a ribbon lying on the medallion
    v.co.z = TOP + max(-0.004, (v.co.z - TOP) * 0.09)

forest = join(forest_parts + stones + roots + [path], "GEO-forest")

# ------------------------------------------------------------------ helix
strands = []
for phase in PHASES:
    pts, radii = [], []
    z = TOP - 0.03
    while z <= Z_BREAK:
        pts.append(helix_point(z, phase))
        flare = max(0.0, 1 - (z - TOP) / 0.32)
        radii.append(1.0 + 0.9 * flare * flare)
        z += PITCH * 7 / 360
    strands.append(curve_tube(f"GEO-strand-{int(phase * 100)}", C_HERO, pts, radii, bevel=0.031, resolution=3, mat=M["strand"]))
helix = join(strands, "GEO-helix")

rungs = []
bm_a, bm_b = bmesh.new(), bmesh.new()
z = TOP + 0.40
while z < Z_BREAK - 0.03:
    a, b = helix_point(z, 0.0), helix_point(z, PHASE_B)
    mid = (a + b) / 2
    bm_cylinder_between(bm_a, a, mid, 0.016, segments=8)
    bm_cylinder_between(bm_b, mid, b, 0.016, segments=8)
    z += 0.072
rungs_a = mesh_object("GEO-rungs-a", bm_a, C_HERO, M["rung_a"])
rungs_b = mesh_object("GEO-rungs-b", bm_b, C_HERO, M["rung_b"])
rungs_ob = join([rungs_a, rungs_b], "GEO-rungs")

# ------------------------------------------------------------------ dissolve: fragments drifting off the strands
fragments = []
FRAG_BANDS = [(1.335, 1.405), (1.44, 1.49), (1.525, 1.56), (1.60, 1.62)]
for si, phase in enumerate(PHASES):
    for fi, (z0, z1) in enumerate(FRAG_BANDS):
        drift = (z0 - Z_BREAK) * 0.75 + 0.01
        pts, n = [], 6
        for k in range(n + 1):
            zz = z0 + (z1 - z0) * k / n
            pts.append(helix_point(zz, phase, extra_r=drift))
        center = sum(pts, Vector()) / len(pts)
        local = [p - center for p in pts]
        frag = curve_tube(f"FRAG_{si}{fi}", C_HERO, local, [1.0 - 0.15 * fi] * len(local), bevel=0.031, resolution=3, mat=M["strand"])
        frag.location = center
        fragments.append(frag)
# a couple of half base-pairs floating away
for k, (zz, phase) in enumerate([(1.36, 0.0), (1.47, PHASE_B), (1.56, 0.0)]):
    a = helix_point(zz, phase, extra_r=(zz - Z_BREAK) * 0.8)
    b = helix_point(zz, phase + PHASE_B, extra_r=-(zz - Z_BREAK) * 0.2)
    mid = a.lerp(b, 0.45)
    bm = bmesh.new()
    bm_cylinder_between(bm, a - mid, Vector((0, 0, 0)), 0.016, segments=8)
    ob = mesh_object(f"FRAG_rung{k}", bm, C_HERO, M["rung_a" if k % 2 == 0 else "rung_b"])
    ob.location = mid
    fragments.append(ob)

# ------------------------------------------------------------------ graph crown: nodes + edges (the atlas)
node_specs = []  # (pos, radius, kind)
strand_chains = []
for si, phase in enumerate(PHASES):
    chain = []
    z = 1.66 if si == 0 else 1.70
    while z < 2.12:
        drift = (z - Z_BREAK) * 0.7 + R.uniform(-0.03, 0.05)
        p = helix_point(z, phase, extra_r=drift) + Vector((R.uniform(-0.03, 0.03), R.uniform(-0.03, 0.03), R.uniform(-0.02, 0.02)))
        chain.append(len(node_specs))
        node_specs.append([p, R.uniform(0.038, 0.052), "node"])
        z += R.uniform(0.075, 0.1)
    strand_chains.append(chain)

attempts = 0
while len(node_specs) < 46 and attempts < 4000:
    attempts += 1
    z = R.uniform(1.45, 2.22)
    max_r = 0.24 + (z - 1.35) * 0.72
    a = R.uniform(0, TAU)
    rr = max_r * math.sqrt(R.uniform(0.15, 1.0))
    p = Vector((rr * math.cos(a), rr * math.sin(a), z))
    if all((p - q[0]).length > 0.135 for q in node_specs):
        node_specs.append([p, R.uniform(0.028, 0.046), "node_light" if R.random() < 0.4 else "node"])

# hubs: the three best-connected positions get bigger nodes with a halo
hub_ids = sorted(range(len(node_specs)), key=lambda i: sum(1 for q in node_specs if (q[0] - node_specs[i][0]).length < 0.36), reverse=True)
chosen = []
for i in hub_ids:
    if all((node_specs[i][0] - node_specs[j][0]).length > 0.45 for j in chosen):
        chosen.append(i)
    if len(chosen) == 3:
        break
for i in chosen:
    node_specs[i][1] = 0.07
    node_specs[i][2] = "hub"

# edges: strand chains, fragment -> first node, k-nearest neighbours
edges = set()
for chain in strand_chains:
    for a, b in zip(chain, chain[1:]):
        edges.add((min(a, b), max(a, b)))
pos = [q[0] for q in node_specs]
for i, p in enumerate(pos):
    near = sorted((j for j in range(len(pos)) if j != i), key=lambda j: (pos[j] - p).length)
    deg = 3 if node_specs[i][2] == "hub" else 2
    for j in near[:deg + 2]:
        if (pos[j] - p).length < (0.46 if node_specs[i][2] == "hub" else 0.36):
            edges.add((min(i, j), max(i, j)))
            deg -= 1
            if deg <= 0:
                break
bm = bmesh.new()
for a, b in edges:
    bm_cylinder_between(bm, pos[a], pos[b], 0.0085, segments=6, cap=False)
# bridge from the last fragments to the crown
for si, chain in enumerate(strand_chains):
    last = fragments[si * len(FRAG_BANDS) + len(FRAG_BANDS) - 1]
    bm_cylinder_between(bm, last.location, pos[chain[0]], 0.0085, segments=6, cap=False)
edges_ob = mesh_object("GEO-edges", bm, C_HERO, M["edge"])

# node meshes: one shared icosphere per material (linked duplicates -> one glTF mesh each)
node_meshes = {}
for kind in ("node", "node_light", "hub"):
    bm, _ = bm_icosphere(1.0, 2 if kind != "hub" else 3)
    me = bpy.data.meshes.new(f"MESH-{kind}")
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(M[kind])
    node_meshes[kind] = me

halo_bm = bmesh.new()
segs, rings, major, minor = 48, 6, 1.75, 0.07
grid = []
for i in range(segs):
    a = TAU * i / segs
    ring = []
    for j in range(rings):
        b = TAU * j / rings
        ring.append(halo_bm.verts.new(((major + minor * math.cos(b)) * math.cos(a), (major + minor * math.cos(b)) * math.sin(a), minor * math.sin(b))))
    grid.append(ring)
for i in range(segs):
    for j in range(rings):
        halo_bm.faces.new((grid[i][j], grid[(i + 1) % segs][j], grid[(i + 1) % segs][(j + 1) % rings], grid[i][(j + 1) % rings]))
halo_me = bpy.data.meshes.new("MESH-halo")
halo_bm.to_mesh(halo_me)
halo_bm.free()
halo_me.polygons.foreach_set("use_smooth", [True] * len(halo_me.polygons))
halo_me.materials.append(M["pearl"])

nodes = []
for i, (p, rad, kind) in enumerate(node_specs):
    name = f"HUB_{chosen.index(i)}" if kind == "hub" else f"NODE_{i:02d}"
    ob = bpy.data.objects.new(name, node_meshes[kind])
    C_HERO.objects.link(ob)
    ob.location = p
    ob.scale = (rad, rad, rad)
    nodes.append(ob)
    if kind == "hub":
        halo = bpy.data.objects.new(f"HALO_{chosen.index(i)}", halo_me)
        C_HERO.objects.link(halo)
        halo.parent = ob
        halo.rotation_euler = (R.uniform(0.6, 1.1), R.uniform(-0.4, 0.4), R.uniform(0, TAU))

REST = snapshot_rest(list(C_HERO.objects))

# ------------------------------------------------------------------ animation (Blender-authored, exported as glTF clips)
# Intro (frames 0-75): fragments + nodes pop in from bottom to top.  Idle (0-120, loops): a pulse wave climbs the crown.
z_min = min(o.location.z for o in fragments + nodes)
z_max = max(o.location.z for o in fragments + nodes)
for ob in fragments + nodes:
    t = (ob.location.z - z_min) / (z_max - z_min)
    start = int(12 + t * 40)
    push_scale_track(ob, "Intro", [(0, 0.0), (start, 0.0), (start + 9, 1.18), (start + 15, 1.0), (75, 1.0)])

for ob in nodes:
    t = (ob.location.z - z_min) / (z_max - z_min)
    phase = t * 0.9 + (hash(ob.name) % 7) * 0.015
    keys = []
    for f in range(0, 121, 6):
        x = (f / 120.0 - phase) % 1.0
        bump = math.exp(-((x - 0.15) ** 2) / 0.006)
        keys.append((f, 1.0 + 0.22 * bump))
    keys[-1] = (120, keys[0][1])
    push_scale_track(ob, "Idle", keys)

for i, ob in enumerate(fragments):
    rest = ob.location.copy()
    keys = []
    for f in range(0, 121, 10):
        off = 0.012 * math.sin(TAU * f / 120 + i * 0.9)
        keys.append((f, {"location": rest + Vector((0, 0, off))}))
    keys[-1] = (120, keys[0][1])
    push_track(ob, "Idle", keys)

scene.frame_start, scene.frame_end = 0, 120

exportables = [o for o in C_HERO.objects]
tris = triangles(exportables)
print(f"[nexmed] hero objects={len(exportables)} triangles={tris} nodes={len(nodes)} edges={len(edges)}")

# ------------------------------------------------------------------ export
os.makedirs(PUBLIC_MODELS, exist_ok=True)
glb_path = os.path.join(PUBLIC_MODELS, "nexmed-hero.glb")
export_glb(glb_path, exportables, animations=True, compression=COMPRESSION)
patch_glb(glb_path, REST)

# ------------------------------------------------------------------ poster render (Cycles, transparent, soft contact shadow)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60.0)  # big enough that its edge never enters the frame
catcher = mesh_object("RIG-shadow", bm, C_RIG, None, smooth=False)
catcher.is_shadow_catcher = True

world(scene, PALETTE["brand_mist"], 0.32)
area_light("LGT-key", (-3.2, -3.6, 4.6), (0, 0, 0.9), 420, 3.2, "#fffaf2", C_RIG)
area_light("LGT-fill", (3.8, -2.4, 2.2), (0, 0, 0.9), 130, 4.0, "#eef5ff", C_RIG)
area_light("LGT-rim", (0.8, 4.2, 3.6), (0, 0, 1.2), 520, 2.5, "#cfe6ff", C_RIG)
area_light("LGT-top", (0, 0, 5.5), (0, 0, 0), 70, 4.0, "#ffffff", C_RIG)
cam = camera("CAM-hero", (1.7, -5.05, 2.1), (0, 0, 1.17), lens=58, coll=C_RIG)

blend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nexmed-hero.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
print(f"[nexmed] saved {blend_path}")

if RENDER:
    setup_cycles(scene, samples=24 if PREVIEW else SAMPLES, width=700 if PREVIEW else 1500, height=700 if PREVIEW else 1500, transparent=True)
    scene.frame_set(120)  # Intro finished, Idle back at its first key
    png_path = PREVIEW or os.path.join(PUBLIC_MODELS, "nexmed-hero.png")
    scene.render.filepath = png_path
    bpy.ops.render.render(write_still=True)
    fade_shadow(png_path)
    print(f"[nexmed] poster {png_path} ({os.path.getsize(png_path) / 1024:.0f} KB)")

# ------------------------------------------------------------------ optional: growth + orbit video for the submission videos
#   blender -b --factory-startup -P blender/build_hero.py -- --no-render --turntable blender/renders/nexmed-hero.mp4
if "--turntable" in ARGS:
    out_mp4 = os.path.abspath(ARGS[ARGS.index("--turntable") + 1])
    frames_dir = os.path.join(os.path.dirname(out_mp4), "_frames_hero")
    for ob in C_HERO.objects:  # Intro first (frames 0-75), then the Idle loop
        if ob.animation_data:
            for tr in ob.animation_data.nla_tracks:
                if tr.name == "Idle":
                    for st in tr.strips:
                        st.frame_start_ui = 76
    pivot = bpy.data.objects.new("RIG-orbit", None)
    C_RIG.objects.link(pivot)
    cam.parent = pivot
    pivot.rotation_euler = (0, 0, math.radians(-30))
    pivot.keyframe_insert("rotation_euler", frame=0)
    pivot.rotation_euler = (0, 0, math.radians(40))
    pivot.keyframe_insert("rotation_euler", frame=210)
    setup_cycles(scene, samples=40, width=1080, height=1080, transparent=True)
    scene.frame_start, scene.frame_end = 0, 210
    render_frames(scene, range(0, 211), frames_dir)
    encode_mp4(frames_dir, out_mp4, fps=30)
