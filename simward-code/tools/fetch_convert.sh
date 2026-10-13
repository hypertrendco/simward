#!/bin/bash
# usage: fetch_convert.sh <Category> <Name>
cat=$1; n=$2; B=https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Avatars/$cat/$n
d=/tmp/rb/work/$n; mkdir -p $d/tex; cd $d
[ -f /tmp/rb/glb/$n.glb ] && exit 0
curl -sfL -o src.fbx $B/Export/${n}_facial.fbx || curl -sfL -o src.fbx $B/Export/$n.fbx || { echo "NOFBX $n"; exit 1; }
for f in $(strings src.fbx | grep -ioE "[a-z0-9_]+\.tga" | sort -u); do curl -sfL -o tex/$f $B/Textures/$f || echo "missing $n/$f"; done
python3 -c "import sys; sys.argv=['x','$d/src.fbx','$d/tex','/tmp/rb/glb/$n.glb']; exec(open('/tmp/rb/convert.py').read())" > log.txt 2>&1
rm -rf tex src.fbx
ls -la /tmp/rb/glb/$n.glb 2>/dev/null | awk '{print $5, $9}' || echo "FAIL $n"
