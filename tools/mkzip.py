import zipfile, os

ZIP = '薄肌日记-v8.0-交接包.zip'

z = zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED)

# install-qr.png 已归入 assets/（v8.1 目录整理），随 assets 一起打包
files = ['index.html', 'app.js', 'styles.css', 'sw.js',
         'manifest.json', 'README.md', '.gitignore']
for p in files:
    if os.path.exists(p):
        z.write(p, 'boji-diary/' + p)

for d in ['assets', 'docs', 'tools', 'server', os.path.join('.workbuddy', 'memory')]:
    for root, dirs, fs in os.walk(d):
        for f in fs:
            rel = os.path.join(root, f).replace(os.sep, '/')
            z.write(rel, 'boji-diary/' + rel)

z.close()

zf = zipfile.ZipFile(ZIP)
print('entries:', len(zf.namelist()))
print('size KB:', round(os.path.getsize(ZIP) / 1024))
for n in zf.namelist():
    print(' ', n)
