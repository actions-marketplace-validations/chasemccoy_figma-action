const got = require('got')
const {ensureDir, writeFile} = require('fs-extra')
const {join, resolve} = require('path')
const Figma = require('figma-js')
const {FIGMA_TOKEN, FIGMA_FILE_URL} = process.env
const PQueue = require('p-queue')

const options = {
  format: 'jpg',
  outputDir: './build/',
  scale: '1'
}

for(const arg of process.argv.slice(2)) {
  const [param, value] = arg.split('=')
  if(options[param]) {
    options[param] = value
  }
}

if(!FIGMA_TOKEN) {
  throw Error('Cannot find FIGMA_TOKEN in process!')
}

const client = Figma.Client({
  personalAccessToken: FIGMA_TOKEN
})

// Fail if there's no figma file key
let fileId = null
if (!fileId) {
  try {
    fileId = FIGMA_FILE_URL.match(/file\/([a-z0-9]+)\//i)[1]
  } catch (e) {
    throw Error('Cannot find FIGMA_FILE_URL key in process!')
  }
}

console.log(`Exporting ${FIGMA_FILE_URL} slices`)
client.file(fileId)
  .then(({ data }) => {
    console.log('Processing response')
    const slices = {}

    function check(c) {
      if (c.type === 'SLICE') {
        const {name, id} = c
        const {width, height} = c.absoluteBoundingBox

        slices[id] = {
          name,
          id,
          file: fileId,
          width,
          height
        }
      } else if (c.children) {
        // eslint-disable-next-line github/array-foreach
        c.children.forEach(check)
      }
    }

    data.document.children.forEach(check)
    if (Object.values(slices).length === 0) {
      throw Error('No slices found!')
    }
    console.log(`${Object.values(slices).length} slices found in the Figma file`)
    return slices
  })
  .then(slices => {
    console.log('Getting export urls')
    return client.fileImages(
      fileId,
      {
        format: options.format,
        ids: Object.keys(slices),
        scale: options.scale
      }
    ).then(({data}) => {
      for(const id of Object.keys(data.images)) {
        slices[id].image = data.images[id]
      }
      return slices
    })
  })
  .then(slices => {
    return ensureDir(join(options.outputDir))
      .then(() => writeFile(resolve(options.outputDir, 'data.json'), JSON.stringify(slices), 'utf8'))
      .then(() => slices)
  })
  .then(slices => {
    const contentTypes = {
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg'
    }
    return queueTasks(Object.values(slices).map(slice => () => {
      return got.get(slice.image, {
        headers: {
          'Content-Type': contentTypes[options.format]
        },
        encoding: (options.format === 'svg' ? 'utf8' : null)
      })
      .then(response => {
        return ensureDir(join(options.outputDir, options.format))
          .then(() => writeFile(join(options.outputDir, options.format, `${slice.name}.${options.format}`), response.body, (options.format === 'svg' ? 'utf8' : 'binary')))
      })
    }))
  })
  .catch(error => {
    throw Error(`Error fetching slices from Figma: ${error}`)
  })

function queueTasks(tasks, options) {
  const queue = new PQueue(Object.assign({concurrency: 3}, options))
  for (const task of tasks) {
    queue.add(task)
  }
  queue.start()
  return queue.onIdle()
}
