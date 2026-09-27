import zipfile, os

ZIP = '薄肌日记-v7.7-交接包.zip'

z = zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED)

files = ['index.html', 'app.js', 'styles.css', 'sw.js',
         'manifest.json', 'README.md', '.gitignore', 'install-qr.png']
for p in files:
    if os.path.exists(p):
        z.write(p, 'boji-diary/' + p)

for d in ['assets', 'docs', 'tools', os.path.join('.workbuddy', 'memory')]:
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
