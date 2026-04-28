#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../package.json' assert { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || 'http://localhost:3000/api';
const DEPLOY_VERSION = process.env.DEPLOY_VERSION || pkg.version;

async function generateManifest() {
  console.log('📝 生成版本清单...');

  const distDir = path.resolve(__dirname, 'dist');
  const htmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(htmlPath)) {
    console.error('❌ index.html 文件不存在');
    process.exit(1);
  }

  const manifest = {
    appName: pkg.name,
    version: DEPLOY_VERSION,
    assetsUrl: `https://up-z2.qiniup.com/${pkg.name}/${DEPLOY_VERSION}`,
    buildTime: new Date().toISOString(),
    buildCommit: process.env.GITHUB_SHA || 'unknown',
  };

  const manifestPath = path.join(distDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ 清单已生成: ${manifestPath}`);

  return manifest;
}

async function uploadManifest(manifest) {
  console.log('📤 上传清单到部署平台...');

  try {
    const response = await fetch(`${DEPLOY_API_URL}/releases/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ 版本已登记！版本 ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`❌ 上传失败: ${err.message}`);
    console.error(`请确保 DEPLOY_API_URL 配置正确: ${DEPLOY_API_URL}`);
    process.exit(1);
  }
}

async function main() {
  try {
    const manifest = await generateManifest();

    if (process.env.DEPLOY_API_URL && process.env.SKIP_UPLOAD !== 'true') {
      await uploadManifest(manifest);
    } else {
      console.log('⏭️  跳过上传（未设置 DEPLOY_API_URL 或 SKIP_UPLOAD=true）');
    }

    console.log('\n✨ 完成！');
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

main();