import fs from 'fs';
import path from 'path';
import qiniu from 'qiniu';

// 获取所有需要上传的文件
export function getFilesToUpload(dir, prefix = '') {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    if (item === '.DS_Store') continue;

    const filePath = path.join(dir, item);
    const stat = fs.statSync(filePath);
    const key = prefix ? `${prefix}/${item}` : item;

    if (stat.isDirectory()) {
      files.push(...getFilesToUpload(filePath, key));
    } else {
      files.push({
        filePath,
        key,
      });
    }
  }

  return files;
}

// 生成上传 token
export function generateUploadToken(qiniuConfig) {
  console.log(qiniuConfig)
  // 检查配置是否有效
  if (!qiniuConfig.accessKey || qiniuConfig.accessKey === 'your-access-key') {
    throw new Error('❌ 七牛云 accessKey 未配置或配置不正确');
  }
  if (!qiniuConfig.secretKey || qiniuConfig.secretKey === 'your-secret-key') {
    throw new Error('❌ 七牛云 secretKey 未配置或配置不正确');
  }
  if (!qiniuConfig.bucket || qiniuConfig.bucket === 'your-bucket') {
    throw new Error('❌ 七牛云 bucket 未配置或配置不正确');
  }

  const mac = new qiniu.auth.digest.Mac(qiniuConfig.accessKey, qiniuConfig.secretKey);
  const options = {
    scope: qiniuConfig.bucket,
  };
  const putPolicy = new qiniu.rs.PutPolicy(options);
  return putPolicy.uploadToken(mac);
}

// 上传单个文件到七牛云
export async function uploadFile(filePath, key, uploadToken, qiniuConfig) {
  return new Promise((resolve, reject) => {
    // 根据配置选择正确的 zone
    let zone;
    switch (qiniuConfig.zone) {
      case 'Zone_z2':
        zone = qiniu.zone.Zone_z2;
        break;
      case 'Zone_as0':
        zone = qiniu.zone.Zone_as0;
        break;
      case 'Zone_na0':
        zone = qiniu.zone.Zone_na0;
        break;
      default:
        zone = qiniu.zone.Zone_as0;
    }

    const config = new qiniu.conf.Config({
      zone: zone,
    });
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    formUploader.putFile(uploadToken, key, filePath, putExtra, (err, body, info) => {
      if (err) {
        reject(err);
      } else if (info.statusCode !== 200) {
        reject(new Error(`上传失败: HTTP ${info.statusCode} - ${body?.error || '未知错误'}`));
      } else {
        resolve();
      }
    });
  });
}

// 替换 HTML 中的路径
export function replaceHtmlPaths(htmlPath, fileMapping) {
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // 替换 JS 和 CSS 文件的路径
  for (const [localPath, remoteUrl] of Object.entries(fileMapping)) {
    const relativePath = localPath.replace(path.resolve('dist') + '/', '');
    // 替换 src= 和 href= 中的路径
    html = html.replace(
      new RegExp(`(src|href)=["']/?${relativePath.replace(/\./g, '\\.')}["']`, 'g'),
      `$1="${remoteUrl}"`
    );
  }

  return html;
}

// CDN 注入插件
export function createInjectCdnPlugin(cdnConfig) {
  return {
    name: 'inject-cdn',
    transformIndexHtml(html) {
      // 生成 CDN 脚本标签
      const scriptTags = cdnConfig.scripts
        .map(url => `<script src="${url}"><\/script>`)
        .join('\n  ');

      // 生成 CDN 样式标签
      const styleTags = cdnConfig.styles
        .map(url => `<link rel="stylesheet" href="${url}">`)
        .join('\n  ');

      // 在 </head> 前注入样式
      let result = html.replace('</head>', `  ${styleTags}\n</head>`);

      // 在 </body> 前注入脚本
      result = result.replace('</body>', `  ${scriptTags}\n</body>`);

      return result;
    },
  };
}

// 七牛云上传插件
export function createQiniuUploadPlugin(qiniuConfig) {
  return {
    name: 'qiniu-upload',
    async writeBundle() {
      const distDir = path.resolve('dist');

      if (!fs.existsSync(distDir)) {
        console.error('dist 目录不存在');
        return;
      }

      try {
        console.log('\n🚀 开始上传文件到七牛云...');

        // 先验证配置
        try {
          const uploadToken = generateUploadToken(qiniuConfig);
          console.log('✅ 七牛云配置验证成功\n');
        } catch (configErr) {
          console.error(configErr.message);
          console.error('请检查 vite.config.js 中的 QINIU_CONFIG 配置');
          return;
        }

        // 获取所有文件
        const allFiles = getFilesToUpload(distDir);

        // 过滤掉 index.html，只上传其他资源
        const files = allFiles.filter(f => !f.key.includes('index.html'));

        console.log(`📦 发现 ${files.length} 个文件待上传\n`);

        // 生成一次上传 token
        const uploadToken = generateUploadToken(qiniuConfig);

        const fileMapping = {};
        let uploadedCount = 0;
        let failedCount = 0;

        for (const { filePath, key } of files) {
          try {
            // 添加路径前缀
            const prefixedKey = qiniuConfig.pathPrefix
              ? `${qiniuConfig.pathPrefix}/${key}`
              : key;

            await uploadFile(filePath, prefixedKey, uploadToken, qiniuConfig);
            const remoteUrl = `${qiniuConfig.domain}/${prefixedKey}`;
            fileMapping[filePath] = remoteUrl;
            uploadedCount++;
            console.log(`✅ 已上传: ${prefixedKey}`);
          } catch (err) {
            console.error(`❌ 上传失败: ${key}`);
            console.error(`   原因: ${err.message}`);
            failedCount++;
          }
        }

        if (failedCount === 0 && uploadedCount > 0) {
          console.log(`\n✨ 资源上传完成！共上传 ${uploadedCount} 个文件`);
          console.log(`\n📋 HTML 文件未上传，请通过 API 提交清单`);
        } else if (failedCount > 0) {
          console.error(`\n❌ 上传失败！共有 ${failedCount} 个文件上传失败`);
        } else {
          console.warn('\n⚠️ 未发现需要上传的文件');
        }
      } catch (err) {
        console.error('上传过程中出错:', err.message);
      }
    },
  };
}



