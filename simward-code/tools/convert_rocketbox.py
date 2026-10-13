import bpy, sys, os, re
src, texdir, out = sys.argv[-3], sys.argv[-2], sys.argv[-1]
KEEP = re.compile(r'^(Basis|AA_VI_|AK_(01|02|03|04|05|06|09|10|19|20|21|22|25|27|30|31|34|35|44|45|46|47|50|51)_)')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, use_anim=False)
# drop lower LODs if present
for o in list(bpy.data.objects):
    if o.type == 'MESH' and any(k in o.name.lower() for k in ('midpoly', 'lowpoly', 'ultralow')):
        bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.shape_keys:
        for kb in list(o.data.shape_keys.key_blocks):
            if not KEEP.match(kb.name): o.shape_key_remove(kb)
# relink textures, downscale to 1024
for img in bpy.data.images:
    base = os.path.basename(img.filepath.replace('\\', '/'))
    p = os.path.join(texdir, base)
    if os.path.exists(p):
        img.filepath = p; img.reload()
        if img.size[0] > 1024: img.scale(1024, 1024)
        img.pack()
# materials: remove specular maps, set opacity blend
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf: continue
    for inp in ('Specular IOR Level', 'Specular', 'Roughness'):
        if inp in bsdf.inputs:
            for l in list(bsdf.inputs[inp].links): nt.links.remove(l)
    bsdf.inputs['Roughness'].default_value = 0.62
    if 'opacity' in m.name.lower() or any('opacity' in (n.image.name.lower() if n.type=='TEX_IMAGE' and n.image else '') for n in nt.nodes):
        tex = next((n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image and 'opacity' in n.image.name.lower()), None)
        if tex:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            try: m.blend_method = 'HASHED'
            except Exception: pass
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82,
    export_morph_normal=False, export_animations=False, export_skins=True, export_apply=False, export_yup=True)
print('MATS', [(m.name, [n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]) for m in bpy.data.materials if m.use_nodes])
