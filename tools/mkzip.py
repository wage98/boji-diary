import zipfile, os

ZIP = '训练日记-交接包.zip'

z = zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED)

# 构建产物（dist/offline.html）与下载二维码随包交付
files = ['index.html', 'app.js', 'styles.css', 'sw.js',
         'manifest.json', 'README.md', '.gitignore',
         '训练日记-下载二维码.png']
for p in files:
    if os.path.exists(p):
        z.write(p, 'boji-diary/' + p)

for d in ['assets', 'docs', 'tools', 'server', 'dist', os.path.join('.workbuddy', 'memory')]:
    if not os.path.isdir(d):
        continue
    for root, dirs, fs in os.walk(d):
        for f in fs:
            rel = os.path.join(root, f).replace(os.sep, '/')
            # 临时/调试产物不入包
            if os.path.basename(f).startswith('_') or f.endswith(('.log', '.tmp')):
                continue
            z.write(rel, 'boji-diary/' + rel)

z.close()

zf = zipfile.ZipFile(ZIP)
print('entries:', len(zf.namelist()))
print('size KB:', round(os.path.getsize(ZIP) / 1024))
for n in zf.namelist():
    print(' ', n)
