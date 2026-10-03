"""Shared helpers for the Nexmed Blender build scripts (Blender 5.2, headless).

Every Nexmed 3D asset is generated from code so it is reproducible:
    blender -b --factory-startup -P blender/build_hero.py
Palette mirrors src/app/globals.css (logo blue #3a86bf family on white).
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC_MODELS = os.path.join(ROOT, "public", "models")

# Brand palette (sRGB hex) — same values as the CSS tokens.
PALETTE = {
    "brand": "#3a86bf",
    "brand_deep": "#1f5f94",
    "brand_ink": "#0e2c47",
    "brand_soft": "#e4f0f9",
    "brand_mist": "#f3f8fc",
    "brand_light": "#8dbde3",
    "pearl": "#fbfdff",
    "edge": "#8fbde3",
    "foliage": "#93c2e9",
    "foliage_deep": "#76acd9",
}


def args_after_dashdash():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def hex_to_linear(h, alpha=1.0):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], alpha)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def collection(name, parent=None):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if coll.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


# ---------------------------------------------------------------- materials

def _principled(mat):
    nt = mat.node_tree
    if nt is None:
        try:
            mat.use_nodes = True
        except Exception:
            pass
        nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return bsdf


def material(name, hex_color, roughness=0.45, metallic=0.0, emission_hex=None, emission_strength=0.0, coat=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    bsdf = _principled(mat)
    bsdf.inputs["Base Color"].default_value = hex_to_linear(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emission_hex:
        bsdf.inputs["Emission Color"].default_value = hex_to_linear(emission_hex)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            mat.surface_render_method = "BLENDED"
        except Exception:
            pass
    mat.diffuse_color = hex_to_linear(hex_color)  # viewport/solid colour
    return mat


# ---------------------------------------------------------------- geometry

def mesh_object(name, bm, coll, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if mat is not None:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def bm_icosphere(radius=1.0, subdiv=2, matrix=None, bm=None):
    bm = bm or bmesh.new()
    res = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius, matrix=matrix or Matrix.Identity(4), calc_uvs=False)
    return bm, res["verts"]


def align_z_to(direction):
    """Rotation matrix taking +Z onto `direction`."""
    d = Vector(direction).normalized()
    return Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()


def bm_cylinder_between(bm, a, b, radius, segments=6, cap=True):
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    if length < 1e-6:
        return
    m = Matrix.Translation((a + b) / 2) @ align_z_to(b - a)
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=length, matrix=m, calc_uvs=False)


def curve_tube(name, coll, points, radii=None, bevel=0.03, resolution=3, mat=None, caps=True):
    """Polyline -> beveled tube converted to a mesh object (glTF friendly)."""
    cu = bpy.data.curves.new(name + "_crv", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = bevel
    cu.bevel_resolution = resolution
    cu.use_fill_caps = caps
    cu.twist_mode = "MINIMUM"
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
        sp.points[i].radius = radii[i] if radii else 1.0
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    coll.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    me.name = name
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if mat is not None:
        me.materials.clear()
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def join(objects, name):
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    ctx = bpy.context
    for o in ctx.view_layer.objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    ctx.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = ctx.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)


def triangles(objects):
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for ob in objects:
        if ob.type != "MESH":
            continue
        me = ob.evaluated_get(dg).to_mesh()
        total += sum(len(p.vertices) - 2 for p in me.polygons)
        ob.evaluated_get(dg).to_mesh_clear()
    return total


# ---------------------------------------------------------------- animation

def push_scale_track(ob, track_name, keys):
    """keys: [(frame, scale_float)] -> an NLA track named `track_name` (merged by name on glTF export)."""
    ad = ob.animation_data_create()
    ad.action = None
    rest = ob.scale.copy()
    for frame, s in keys:
        ob.scale = (rest.x * s, rest.y * s, rest.z * s)
        ob.keyframe_insert(data_path="scale", frame=frame)
    act = ad.action
    act.name = f"{track_name}__{ob.name}"
    ad.action = None
    ob.scale = rest
    track = ad.nla_tracks.new()
    track.name = track_name
    strip = track.strips.new(track_name, int(keys[0][0]), act)
    strip.extrapolation = "NOTHING"
    return strip


def push_track(ob, track_name, keyframes):
    """Generic: keyframes = [(frame, {data_path: value, ...})]."""
    ad = ob.animation_data_create()
    ad.action = None
    rest = {"location": ob.location.copy(), "rotation_euler": ob.rotation_euler.copy(), "scale": ob.scale.copy()}
    for frame, values in keyframes:
        for path, val in values.items():
            setattr(ob, path, val)
            ob.keyframe_insert(data_path=path, frame=frame)
    act = ad.action
    act.name = f"{track_name}__{ob.name}"
    ad.action = None
    for path, val in rest.items():
        setattr(ob, path, val)
    track = ad.nla_tracks.new()
    track.name = track_name
    strip = track.strips.new(track_name, int(keyframes[0][0]), act)
    strip.extrapolation = "NOTHING"
    return strip


# ---------------------------------------------------------------- render + export

def setup_cycles(scene, samples=128, width=1500, height=1500, transparent=True):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = backend
                prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == backend]
                if devs:
                    for d in prefs.devices:
                        d.use = d.type == backend
                    scene.cycles.device = "GPU"
                    print(f"[nexmed] cycles device: {backend} {[d.name for d in devs]}")
                    break
            except Exception:
                continue
    except Exception as exc:  # CPU fallback
        print("[nexmed] cycles GPU unavailable:", exc)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 90
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0


def world(scene, hex_color="#f3f8fc", strength=0.7):
    w = bpy.data.worlds.new("WLD-nexmed")
    scene.world = w
    nt = w.node_tree
    if nt is None:
        try:
            w.use_nodes = True
        except Exception:
            pass
        nt = w.node_tree
    bg = next((n for n in nt.nodes if n.type == "BACKGROUND"), None)
    if bg is None:
        bg = nt.nodes.new("ShaderNodeBackground")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_WORLD"), None) or nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bg.inputs["Color"].default_value = hex_to_linear(hex_color)
    bg.inputs["Strength"].default_value = strength


def area_light(name, location, target, energy, size, hex_color="#ffffff", coll=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = hex_to_linear(hex_color)[:3]
    ob = bpy.data.objects.new(name, ld)
    (coll or bpy.context.scene.collection).objects.link(ob)
    ob.location = location
    direction = Vector(target) - Vector(location)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return ob


def camera(name, location, target, lens=50.0, coll=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    ob = bpy.data.objects.new(name, cd)
    (coll or bpy.context.scene.collection).objects.link(ob)
    ob.location = location
    direction = Vector(target) - Vector(location)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


def export_glb(filepath, objects, animations=True, compression="draco"):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    kwargs = dict(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=animations,
    )
    if animations:
        kwargs.update(export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_optimize_animation_size=True)
    if compression == "draco":
        kwargs.update(
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=7,
            export_draco_position_quantization=13,
            export_draco_normal_quantization=9,
        )
    elif compression == "meshopt":
        kwargs.update(export_meshopt_compression_enable=True)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.export_scene.gltf(**kwargs)
    size = os.path.getsize(filepath)
    print(f"[nexmed] exported {filepath} ({size / 1024:.1f} KB, {compression})")
    return size


def rng(seed):
    return random.Random(seed)


__all__ = [n for n in dir() if not n.startswith("_")] + ["math", "Vector", "Matrix", "bmesh", "bpy"]
