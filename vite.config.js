import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createInjectCdnPlugin, createQiniuUploadPlugin } from './vite-plugins.js'

// CDN 配置
const CDN_CONFIG = {
  scripts: [],
  styles: [],
}

// 七牛云配置 — 从环境变量读取
const QINIU_CONFIG = {
  accessKey: process.env.QINIU_ACCESS_KEY || '',
  secretKey: process.env.QINIU_SECRET_KEY || '',
  bucket: process.env.QINIU_BUCKET || 'fe-assets',
  domain: process.env.QINIU_DOMAIN || 'https://up-z2.qiniup.com',
  zone: process.env.QINIU_ZONE || 'Zone_z2',
  pathPrefix: `test/${process.env.DEPLOY_VERSION || pkg.version}`,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createInjectCdnPlugin(CDN_CONFIG),
    ...(QINIU_CONFIG.accessKey ? [createQiniuUploadPlugin(QINIU_CONFIG)] : []),
  ],
})
