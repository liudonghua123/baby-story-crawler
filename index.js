const fs = require('fs');
const path = require('path');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const fetch = require('node-fetch');

const parseUrl = imageFilePath => {
  const data = fs.readFileSync(imageFilePath);
  const { data: imageData, width, height } = PNG.sync.read(data);
  const code = jsQR(imageData, width, height);
  if (code) {
    return code.data;
  }
  return null;
};

const parseMediaInfo = async (url, fileName) => {
  let res = await fetch(url);
  let body = await res.text();
  const regex = /jump_url="(?<redirect_url>.*)";/gm;
  // extract jump_url
  let match = regex.exec(body);
  if (match === null) {
    console.info(`jump_url not found`);
    return null;
  }
  const {
    groups: { redirect_url },
  } = match;
  res = await fetch(redirect_url);
  body = await res.text();
  //   console.info(body);
  const titleRegex = /<title>(?<title>.*)<\/title>/gm;
  const dataRegex = /var data=(?<data>.*);/gm;
  // extract title info
  match = titleRegex.exec(body);
  let title = fileName;
  if (match !== null) {
    title = match.groups.title;
  }
  // extract data info
  match = dataRegex.exec(body);
  if (match === null) {
    console.info(`data not found`);
    return null;
  }
  const {
    groups: { data },
  } = match;
  return {
    title,
    items: JSON.parse(data)
      .tree_list.splice(1)
      .map(item => item.item.play_url),
  };
};

const download = async (url, fileName) => {
  const res = await fetch(url);
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(fileName);
    res.body.pipe(fileStream);
    res.body.on('error', err => {
      reject(err);
    });
    fileStream.on('finish', function() {
      resolve();
    });
  });
};

(async () => {
  const files = fs.readdirSync('input').filter(file => file.endsWith('.png'));
  for (const file of files) {
    console.info(`processing input/${file}`);
    const url = parseUrl(`input/${file}`);
    const fileName = path.parse(file).name;
    if (url !== null) {
      console.info(`for input/${file}, got url ${url}`);
      const mediaInfo = await parseMediaInfo(url, fileName);
      if (mediaInfo !== null) {
        console.info(`for input/${file}, got mediaInfo ${mediaInfo}`);
        if (!fs.existsSync(`output/${mediaInfo.title}`)) {
          fs.mkdirSync(`output/${mediaInfo.title}`);
        }
        console.info(`for input/${file}, downloading files`);
        await Promise.all([
          download(mediaInfo.items[0], `output/${mediaInfo.title}/${mediaInfo.title}-中文版.mp3`),
          download(mediaInfo.items[1], `output/${mediaInfo.title}/${mediaInfo.title}-中英双语.mp3`),
          download(mediaInfo.items[2], `output/${mediaInfo.title}/${mediaInfo.title}-英文版.mp3`),
        ]);
      }
    }
  }
})();
