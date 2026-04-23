import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createInjectCdnPlugin, createQiniuUploadPlugin } from './vite-plugins.js'
import pkg from './package.json' assert { type: 'json' }

// CDN 配置
const CDN_CONFIG = {
  scripts: [
    'https://cdn.example.com/lib1@1.0.0.min.js',
    'https://cdn.example.com/lib2@2.0.0.min.js',
  ],
  styles: [
    'https://cdn.example.com/style@1.0.0.min.css',
  ],
}

// 七牛云配置
const QINIU_CONFIG = {
  accessKey: 'CmAKcOAfAkVbuC8zYvM35G5mqwPZQztcvHoLTrep',
  secretKey: 'CwCkODS-aS8V0o44pezTCavhZfC29w341fZTGU2D',
  bucket: 'fe-assets',
  domain: 'https://up-z2.qiniup.com',
  zone: 'Zone_z2',
  pathPrefix: `${pkg.name}/${pkg.version}`,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createInjectCdnPlugin(CDN_CONFIG),
    createQiniuUploadPlugin(QINIU_CONFIG),
  ],
})

