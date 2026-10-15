// Construit les croupiers .glb (HD 2048 / SD 1024) à partir des exports FBX2glTF des avatars Rocketbox.
// Usage : node tools/build-avatars.mjs <dossier_out_gltf> <dossier_textures_webp> <dossier_sortie>
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [inDir, texDir, outDir] = process.argv.slice(2);
const AVATARS = {
  Business_Male_04: 'gilet',
  Business_Male_01: 'smoking',
  Business_Male_06: 'chemise',
  Business_Male_02: 'marine',
  Business_Female_01: 'croupiere',
  Business_Female_02: 'bordeaux',
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(outDir, { recursive: true });

for (const [src, id] of Object.entries(AVATARS)) {
  for (const [q, size] of [['hd', 2048], ['sd', 1024]]) {
    const doc = await io.read(path.join(inDir, `${src}_out`, `${src}.gltf`));
    const root = doc.getRoot();
    // Pas de morph targets (on anime les os du visage) : fichier bien plus léger
    for (const mesh of root.listMeshes()) {
      mesh.setWeights([]);
      for (const prim of mesh.listPrimitives()) for (const t of prim.listTargets()) { prim.removeTarget(t); t.dispose(); }
    }
    for (const tex of root.listTextures()) tex.dispose();
    const tex = (file) => {
      const p = path.join(texDir, `${file}_${size}.webp`);
      if (!fs.existsSync(p)) return null;
      return doc.createTexture(file).setImage(fs.readFileSync(p)).setMimeType('image/webp').setURI(`${file}.webp`);
    };
    for (const m of root.listMaterials()) {
      const name = m.getName();
      const alpha = name.endsWith('_opacity') || name.endsWith('_glasses');
      const colorName = name.endsWith('_glasses') ? `${name}_opacity_color` : `${name}_color`;
      const c = tex(colorName);
      const n = tex(`${name}_normal`);
      m.setBaseColorTexture(c).setBaseColorFactor([1, 1, 1, 1]);
      if (n) m.setNormalTexture(n).setNormalScale(1);
      else m.setNormalTexture(null);
      m.setMetallicFactor(0).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
      m.setRoughnessFactor(name.endsWith('_head') ? 0.55 : name.endsWith('_body') ? 0.78 : 0.6);
      if (alpha) { m.setAlphaMode('MASK').setAlphaCutoff(0.35).setDoubleSided(true); }
      else m.setAlphaMode('OPAQUE');
    }
    await doc.transform(
      weld(),
      dedup(),
      prune(),
      reorder({ encoder: MeshoptEncoder }),
      quantize({ quantizeNormal: 10, quantizePosition: 14, quantizeTexcoord: 12 }),
    );
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const out = path.join(outDir, `${id}_${q}.glb`);
    await io.write(out, doc);
    console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + ' Mo');
  }
}
