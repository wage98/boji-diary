'use strict';
const fs = require('fs');
const path = require('path');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'v122-map.json'), 'utf8'));
const f = path.join(__dirname, 'selfcheck-attack.js');
let s = fs.readFileSync(f, 'utf8');

const approved = 'const V122_APPROVED = ' + JSON.stringify(map.approved) + ';';
const dropped = 'const V122_DROPPED = ' + JSON.stringify(map.dropped) + ';';

// 替换两段数组声明
s = s.replace(/const V121_APPROVED = \[[\s\S]*?\];/, approved);
s = s.replace(/const V121_DROPPED = \[[\s\S]*?\];/, dropped);

// 全局改名
s = s.replace(/v121Checks/g, 'v122Checks');
s = s.replace(/V121_APPROVED/g, 'V122_APPROVED');
s = s.replace(/V121_DROPPED/g, 'V122_DROPPED');

// 版本与缓存断言
s = s.replace(/version\s*\n\s*\.indexOf\('v1\.2\.1'\)/g, x => x); // 兼容
s = s.replace(/APP_VERSION = '1\.2\.1'/g, "APP_VERSION = '1.2.2'");
s = s.replace(/boji-1-2-1'/g, "boji-1-2-2'");
s = s.replace(/doc\.indexOf\('v1\.2\.1'\)/g, "doc.indexOf('v1.2.2')");
s = s.replace(/Z5 版本号已升到 1\.2\.1/g, 'Z5 版本号已升到 1.2.2');
s = s.replace(/SW 缓存名同步升级（旧缓存自动清理）/, 'SW 缓存名同步升级（旧缓存自动清理）'); // 维持
s = s.replace(/\/\/ ===== v1\.2\.1 增量/g, '// ===== v1.2.2 增量');
s = s.replace(/\/\* v1\.2\.1 准入视频集合/, '/* v1.2.2 准入视频集合');

fs.writeFileSync(f, s, 'utf8');
console.log('selfcheck patched -> V122');
