"""Nexmed voice agent — the avatar that appears when an AI agent speaks.

A pearl orb (the guide) with two calm eyes, a DNA helix bent into a halo, three atlas nodes on tilted orbits
and a ring of "voice petals" that open while it talks.

    blender -b --factory-startup -P blender/build_agent.py -- [--no-render] [--sheet]

Outputs public/models/nexmed-agent.glb and public/models/nexmed-agent.png (transparent poster).

Animation clips (glTF animations, Blender NLA tracks merged by name). Each clip drives its own layer of the
hierarchy so they compose instead of fighting:
    POP_*   <- "Appear"  (once, 36 f; play reversed to dismiss)
    STATE_* <- "Listen" / "Think" / "Speak" (loops; cross-faded by the app)
    leaves  <- "Idle"    (always on, 120 f loop)
    PETAL_* <- "Speak" (radial wave); the app also multiplies PETAL_* scale.x and CORE scale by the live audio level.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nexmed_lib import *  # noqa: E402,F401,F403

ARGS = args_after_dashdash()
RENDER = "--no-render" not in ARGS
SHEET = "--sheet" in ARGS
TAU = math.tau

scene = reset_scene()
scene.render.fps = 30
C = collection("AGENT")
C_RIG = collection("RIG")

M = {
    "core": None,
    "eye": material("MAT-agent-eye", PALETTE["brand_ink"], roughness=0.3, coat=0.6),
    "strand": material("MAT-agent-strand", PALETTE["brand_deep"], roughness=0.3, coat=0.6),
    "rung": material("MAT-agent-rung", PALETTE["brand_light"], roughness=0.35, coat=0.3),
    "petal": material("MAT-agent-petal", PALETTE["brand"], roughness=0.3, coat=0.4, emission_hex=PALETTE["brand"], emission_strength=0.6),
    "node": material("MAT-agent-node", PALETTE["brand"], roughness=0.2, coat=0.8, emission_hex=PALETTE["brand"], emission_strength=0.9),
}

# core material: vertex-colour gradient (pearl highlight -> soft logo blue), exported as COLOR_0
core_mat = material("MAT-agent-core", PALETTE["pearl"], roughness=0.28, coat=0.7)
bsdf = next(n for n in core_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
vc = core_mat.node_tree.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
core_mat.node_tree.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
M["core"] = core_mat


def empty(name, parent=None, location=(0, 0, 0), rotation=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = 0.2
    C.objects.link(ob)
    ob.parent = parent
    ob.location = location
    ob.rotation_euler = rotation
    return ob


def child_mesh(name, bm, parent, mat, smooth=True):
    ob = mesh_object(name, bm, C, mat, smooth=smooth)
    ob.parent = parent
    return ob


ROOT = empty("AGENT")

# ------------------------------------------------------------------ core + eyes
CORE_R = 0.42
POP_CORE = empty("POP_CORE", ROOT)
STATE_CORE = empty("STATE_CORE", POP_CORE)
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=CORE_R)
CORE = child_mesh("CORE", bm, STATE_CORE, M["core"])
light_dir = Vector((-0.35, -0.45, 0.82)).normalized()
col = CORE.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
top = [int(PALETTE["pearl"][i:i + 2], 16) / 255 for i in (1, 3, 5)]
bot = [int("#b9d8f2"[i:i + 2], 16) / 255 for i in (1, 3, 5)]
for i, v in enumerate(CORE.data.vertices):
    t = max(0.0, min(1.0, 0.5 + 0.55 * v.co.normalized().dot(light_dir)))
    t = t * t * (3 - 2 * t)
    col.data[i].color_srgb = (bot[0] + (top[0] - bot[0]) * t, bot[1] + (top[1] - bot[1]) * t, bot[2] + (top[2] - bot[2]) * t, 1.0)

STATE_EYES = empty("STATE_EYES", CORE)
eyes = []
for side in (-1, 1):
    p = Vector((0.125 * side, -1.0, 0.07)).normalized() * (CORE_R - 0.006)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
    eye = child_mesh(f"EYE_{'L' if side < 0 else 'R'}", bm, STATE_EYES, M["eye"])
    eye.location = p
    eye.rotation_euler = Vector((0, -1, 0)).rotation_difference(p.normalized()).to_euler()
    eye.scale = (0.036, 0.022, 0.062)
    eyes.append(eye)

# ------------------------------------------------------------------ helix halo (DNA bent into a ring)
RING_R, HELIX_r, TWISTS = 0.80, 0.055, 8
POP_HALO = empty("POP_HALO", ROOT, rotation=(math.radians(24), math.radians(-16), 0))
STATE_HALO = empty("STATE_HALO", POP_HALO)
strands = []
for phase in (0.0, 0.78 * math.pi):
    pts = []
    n = 320
    for k in range(n):
        u = TAU * k / n
        radial = Vector((math.cos(u), math.sin(u), 0))
        c = radial * RING_R
        w = TWISTS * u + phase
        pts.append(c + radial * (HELIX_r * math.cos(w)) + Vector((0, 0, HELIX_r * math.sin(w))))
    strands.append(curve_tube(f"HALO_S{len(strands)}", C, pts, None, bevel=0.016, resolution=2, mat=M["strand"], cyclic=True))
bm = bmesh.new()
for k in range(TWISTS * 6):
    u = TAU * k / (TWISTS * 6)
    radial = Vector((math.cos(u), math.sin(u), 0))
    a = radial * RING_R + radial * (HELIX_r * math.cos(TWISTS * u)) + Vector((0, 0, HELIX_r * math.sin(TWISTS * u)))
    w = TWISTS * u + 0.78 * math.pi
    b = radial * RING_R + radial * (HELIX_r * math.cos(w)) + Vector((0, 0, HELIX_r * math.sin(w)))
    bm_cylinder_between(bm, a, b, 0.0075, segments=6)
rungs = mesh_object("HALO_rungs", bm, C, M["rung"])
HALO = join(strands + [rungs], "HALO_RING")
HALO.parent = STATE_HALO

# ------------------------------------------------------------------ atlas nodes on tilted orbits
POP_ORBITS = empty("POP_ORBITS", ROOT)
STATE_ORBITS = empty("STATE_ORBITS", POP_ORBITS)
node_mesh = bpy.data.meshes.new("MESH-agent-node")
bm, _ = bm_icosphere(1.0, 2)
bm.to_mesh(node_mesh)
bm.free()
node_mesh.polygons.foreach_set("use_smooth", [True] * len(node_mesh.polygons))
node_mesh.materials.append(M["node"])
ORBITS = [  # (tilt x, tilt y, radius, node size, phase, turns per Idle loop)
    (math.radians(72), math.radians(25), 0.98, 0.064, 0.0, 1),
    (math.radians(-60), math.radians(40), 1.04, 0.054, 2.1, -1),
    (math.radians(20), math.radians(-70), 0.94, 0.046, 4.2, 1),
]
orbit_spinners = []
for k, (tx, ty, r, size, ph, turns) in enumerate(ORBITS):
    tilt = empty(f"ORBIT_TILT_{k}", STATE_ORBITS, rotation=(tx, ty, 0))
    spin = empty(f"ORBIT_{k}", tilt, rotation=(0, 0, ph))
    node = bpy.data.objects.new(f"ORBIT_NODE_{k}", node_mesh)
    C.objects.link(node)
    node.parent = spin
    node.location = (r, 0, 0)
    node.scale = (size, size, size)
    orbit_spinners.append((spin, ph, turns))

# ------------------------------------------------------------------ voice petals (ring in the screen plane)
POP_PETALS = empty("POP_PETALS", ROOT)
STATE_PETALS = empty("STATE_PETALS", POP_PETALS)
N_PETALS, PETAL_IN, PETAL_LEN, PETAL_REST = 24, 0.50, 0.26, 0.42
petal_mesh = bpy.data.meshes.new("MESH-agent-petal")
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=1.0, matrix=Matrix.Translation((1.0, 0, 0)) @ Matrix.Diagonal((1.0, 0.13, 0.13, 1.0)) @ Matrix.Identity(4))
for v in bm.verts:  # capsule-ish: x in [0, 2] -> [0, 1]
    v.co.x *= 0.5
bm.to_mesh(petal_mesh)
bm.free()
petal_mesh.polygons.foreach_set("use_smooth", [True] * len(petal_mesh.polygons))
petal_mesh.materials.append(M["petal"])
petals = []
for i in range(N_PETALS):
    a = TAU * i / N_PETALS + math.pi / 2
    d = Vector((math.cos(a), 0, math.sin(a)))
    p = bpy.data.objects.new(f"PETAL_{i:02d}", petal_mesh)
    C.objects.link(p)
    p.parent = STATE_PETALS
    p.location = d * PETAL_IN + Vector((0, 0.05, 0))
    p.rotation_euler = (0, -a, 0)
    p.scale = (PETAL_LEN * PETAL_REST, PETAL_LEN * 1.7, PETAL_LEN * 1.7)
    petals.append((p, i))

REST = snapshot_rest(list(C.objects))

# ------------------------------------------------------------------ animation
def ease_keys(ob, track, path, frames_values, spin=False):
    """spin=True: constant angular velocity (LINEAR) — rings and orbits never ease at the loop seam."""
    push_track(ob, track, [(f, {path: v}) for f, v in frames_values], linear={path} if spin else ())


V = lambda *a: Vector(a)  # noqa: E731
E = lambda x, y, z: Vector((x, y, z))  # noqa: E731

# Appear (36 f): pop in, layered
# Appear lives far from the loop clips (frames 500+): while Blender bakes Idle/Listen/Think/Speak, the parents must
# not be at Appear's scale 0 (a zero-scale parent bakes garbage child poses). The export slides every clip to t = 0.
A0 = 500
ease_keys(POP_CORE, "Appear", "scale", [(A0 + 0, V(0, 0, 0)), (A0 + 12, V(1.12, 1.12, 1.12)), (A0 + 18, V(0.97, 0.97, 0.97)), (A0 + 22, V(1, 1, 1)), (A0 + 36, V(1, 1, 1))])
ease_keys(POP_HALO, "Appear", "scale", [(A0 + 0, V(0, 0, 0)), (A0 + 6, V(0, 0, 0)), (A0 + 20, V(1.08, 1.08, 1.08)), (A0 + 26, V(1, 1, 1)), (A0 + 36, V(1, 1, 1))])
ease_keys(POP_ORBITS, "Appear", "scale", [(A0 + 0, V(0, 0, 0)), (A0 + 10, V(0, 0, 0)), (A0 + 26, V(1.05, 1.05, 1.05)), (A0 + 32, V(1, 1, 1)), (A0 + 36, V(1, 1, 1))])
ease_keys(POP_PETALS, "Appear", "scale", [(A0 + 0, V(0, 0, 0)), (A0 + 14, V(0, 0, 0)), (A0 + 28, V(1.1, 1.1, 1.1)), (A0 + 34, V(1, 1, 1)), (A0 + 36, V(1, 1, 1))])

# Idle (120 f loop): breathing core, blinking eyes, halo turns one helix period, nodes orbit at different speeds
ease_keys(CORE, "Idle", "scale", [(0, V(1, 1, 1)), (60, V(1.025, 1.025, 1.025)), (120, V(1, 1, 1))])
for eye in eyes:
    s = eye.scale.copy()
    ease_keys(eye, "Idle", "scale", [(0, s), (74, s), (77, E(s.x, s.y, s.z * 0.12)), (80, s), (120, s)])
ease_keys(HALO, "Idle", "rotation_euler", [(f, E(0, 0, (TAU / TWISTS) * f / 120)) for f in range(0, 121, 10)], spin=True)
for spin, ph, turns in orbit_spinners:
    ease_keys(spin, "Idle", "rotation_euler", [(f, E(0, 0, ph + turns * TAU * f / 120)) for f in range(0, 121, 10)], spin=True)

# Listen (60 f loop): leans in, halo turns toward the user, petals breathe, eyes open wider
ease_keys(STATE_CORE, "Listen", "rotation_euler", [(0, E(math.radians(-7), 0, 0)), (30, E(math.radians(-9), 0, math.radians(2))), (60, E(math.radians(-7), 0, 0))])
ease_keys(STATE_HALO, "Listen", "rotation_euler", [(0, E(math.radians(20), 0, 0)), (30, E(math.radians(24), 0, 0)), (60, E(math.radians(20), 0, 0))])
ease_keys(STATE_PETALS, "Listen", "scale", [(0, V(1.04, 1.04, 1.04)), (30, V(1.1, 1.1, 1.1)), (60, V(1.04, 1.04, 1.04))])
ease_keys(STATE_EYES, "Listen", "scale", [(0, V(1.12, 1.12, 1.12)), (30, V(1.15, 1.15, 1.15)), (60, V(1.12, 1.12, 1.12))])  # widened, gently alive (a constant channel would be optimised away)
ease_keys(STATE_ORBITS, "Listen", "scale", [(0, V(0.9, 0.9, 0.9)), (30, V(0.86, 0.86, 0.86)), (60, V(0.9, 0.9, 0.9))])

# Think (60 f loop): halo + orbits speed up, gaze drifts up, a slow wobble
ease_keys(STATE_HALO, "Think", "rotation_euler", [(f, E(0, 0, (TAU / TWISTS) * 2 * f / 60)) for f in range(0, 61, 5)], spin=True)
ease_keys(STATE_ORBITS, "Think", "rotation_euler", [(f, E(0, 0, TAU * f / 60)) for f in range(0, 61, 5)], spin=True)
ease_keys(STATE_EYES, "Think", "location", [(0, E(0.018, 0.0, 0.03)), (30, E(-0.012, 0.0, 0.034)), (60, E(0.018, 0.0, 0.03))])
ease_keys(STATE_CORE, "Think", "rotation_euler", [(0, E(0, math.radians(4), 0)), (30, E(0, math.radians(-4), 0)), (60, E(0, math.radians(4), 0))])

# Speak (30 f loop): petals ripple round the ring, the core bounces gently, eyes smile
for p, i in petals:
    rest = p.scale.copy()
    keys = []
    for f in range(0, 31, 3):
        w = math.sin(TAU * (f / 30.0) * 2 - i * TAU * 3 / N_PETALS)
        amp = 1.0 + 2.0 * max(0.0, w) ** 1.5
        keys.append((f, E(rest.x * amp, rest.y, rest.z)))
    keys[-1] = (30, keys[0][1])
    ease_keys(p, "Speak", "scale", keys)
ease_keys(STATE_CORE, "Speak", "scale", [(0, V(1, 1, 1)), (8, V(1.035, 1.035, 1.035)), (15, V(1, 1, 1)), (23, V(1.03, 1.03, 1.03)), (30, V(1, 1, 1))])
ease_keys(STATE_EYES, "Speak", "scale", [(0, E(1.05, 1.0, 0.78)), (15, E(1.06, 1.0, 0.72)), (30, E(1.05, 1.0, 0.78))])  # smiling squint

scene.frame_start, scene.frame_end = 0, 120
exportables = [o for o in C.objects]
print(f"[nexmed] agent objects={len(exportables)} triangles={triangles(exportables)}")

glb_path = os.path.join(PUBLIC_MODELS, "nexmed-agent.glb")
export_glb(glb_path, exportables, animations=True, compression="draco")
patch_glb(glb_path, REST)

blend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nexmed-agent.blend")

# ------------------------------------------------------------------ poster (rest pose: only Idle active)
world(scene, PALETTE["brand_mist"], 0.4)
area_light("LGT-key", (-2.4, -3.2, 3.2), (0, 0, 0), 260, 2.5, "#fffaf2", C_RIG)
area_light("LGT-fill", (3.0, -2.0, 0.6), (0, 0, 0), 90, 3.0, "#eef5ff", C_RIG)
area_light("LGT-rim", (0.6, 3.0, 2.2), (0, 0, 0), 300, 2.0, "#cfe6ff", C_RIG)
camera("CAM-agent", (0, -4.5, 0.3), (0, 0, 0), lens=60, coll=C_RIG)


def solo(names):
    for ob in C.objects:
        if ob.animation_data:
            for tr in ob.animation_data.nla_tracks:
                tr.mute = tr.name not in names
    restore_rest(REST)


bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
print(f"[nexmed] saved {blend_path}")

if RENDER:
    setup_cycles(scene, samples=96, width=768, height=768, transparent=True)
    solo({"Idle"})
    scene.frame_set(20)
    png_path = os.path.join(PUBLIC_MODELS, "nexmed-agent.png")
    scene.render.filepath = png_path
    bpy.ops.render.render(write_still=True)
    print(f"[nexmed] poster {png_path} ({os.path.getsize(png_path) / 1024:.0f} KB)")
    if SHEET:  # QA contact sheet of the states
        out_dir = ARGS[ARGS.index("--sheet") + 1] if len(ARGS) > ARGS.index("--sheet") + 1 else HERE
        setup_cycles(scene, samples=24, width=360, height=360, transparent=False)
        for state, frame in (("Appear", A0 + 8), ("Appear", A0 + 16), ("Idle", 76), ("Listen", 15), ("Think", 20), ("Speak", 6)):
            solo({state, "Idle"} if state != "Appear" else {state})
            scene.frame_set(frame)
            scene.render.filepath = os.path.join(out_dir, f"agent_{state}_{frame}.png")
            bpy.ops.render.render(write_still=True)
        print("[nexmed] contact sheet rendered")

# ------------------------------------------------------------------ optional: state reel for the submission videos
#   blender -b --factory-startup -P blender/build_agent.py -- --no-render --reel blender/renders/nexmed-agent-states.mp4
if "--reel" in ARGS:
    out_mp4 = os.path.abspath(ARGS[ARGS.index("--reel") + 1])
    frames_dir = os.path.join(os.path.dirname(out_mp4), "_frames_agent")
    setup_cycles(scene, samples=32, width=720, height=720, transparent=True)
    i = 0
    for state, frames in (
        ({"Appear", "Idle"}, range(A0, A0 + 37)),
        ({"Idle"}, range(37, 97)),
        ({"Listen", "Idle"}, range(0, 90)),
        ({"Think", "Idle"}, range(0, 90)),
        ({"Speak", "Idle"}, list(range(0, 30)) * 3),
        ({"Appear", "Idle"}, range(A0 + 36, A0 - 1, -1)),
    ):
        solo(state)
        i = render_frames(scene, frames, frames_dir, i)
    encode_mp4(frames_dir, out_mp4, fps=30)
