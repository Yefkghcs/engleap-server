const multer = require('multer');
const XLSX = require('xlsx');

const Word  = require("../../models/word");

exports.view_word_list = async function(req, res, next) {
    try {
        const words = await Word.find()
            .populate('category')
            .exec();
        res.render("word_list", {
            title: "Word List",
            words,
        });
    } catch (err) {
        return next(err);
    }
};

// 配置 multer 用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 Excel 文件'), false);
    }
  }
});

// 处理上传的数据
async function processUploadedData(data) {
  const processedData = [];
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i];
      
      // 数据验证
      const requiredFields = ['id', 'category', 'subcategory', 'word', 'meaning', 'phonetic', 'example', 'exampleCn'];
      const missingFields = requiredFields.filter(field => !row[field]);
      if (missingFields.length > 0) {
          // errors.push(`第 ${i + 1} 行: 缺少 ${missingFields.join(' | ')}`);
          errors.push(`${row?.['subcategory']}-${row?.['id']}: 缺少 ${missingFields.join(' | ')}`);
          continue;
      }

      const wordData = {
        id: row.id,
        category: row.category || '',
        subcategory: row.subcategory || '',
        word: row.word || '',
        meaning: row.meaning || '',
        phonetic: row.phonetic || '',
        audio: row.audio || '',
        partOfSpeech: row.partOfSpeech?.split?.(',')?.filter?.(Boolean) || [],
        example: row.example || '',
        exampleCn: row.exampleCn || '',
        exampleAudio: row.exampleAudio || '',
        collocation: row.collocation || '',
        collocationCn: row.collocationCn || '',
        collocationAudio: row.collocationAudio || '',
      };

      // 保存到数据库
      const word = new Word(wordData);
      await word.save();
      processedData.push(wordData);

    } catch (error) {
      errors.push(`第 ${i + 1} 行处理失败: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`处理完成，但有 ${errors.length} 个错误: ${errors.join('; ')}`);
  }

  return processedData;
}

exports.words_upload_get = (req, res) => {
  res.render('word_upload', { title: '更新单词库' });
};

exports.words_upload_post = [
    upload.single('file'), 
    async (req, res) => {
        try {
            if (!req.file) {
                return res.render('word_upload', {
                    title: '更新单词库',
                    errors: [{ msg: '请选择要上传的文件' }]
                });
            }

            const { headerRows } = req.body;
            const file = req.file;
            let data = [];

            // 处理 Excel 文件
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });

            const dataForAllSheets = [];
            for ( sheetName in workbook.SheetNames ) {

                const sheet = workbook.Sheets[workbook.SheetNames[sheetName]];

                data = XLSX.utils.sheet_to_json(sheet, {
                    header: headerRows ?? 0,
                    defval: ''
                }).slice(headerRows > 0 ? headerRows - 1 : 0);

                dataForAllSheets.push(...data);
            }

            // 数据验证和处理
            const processedData = await processUploadedData(dataForAllSheets);

            // 生成预览数据（前5行）
            const previewData = {
                headers: Object.keys(processedData[0] || {}),
                rows: processedData.slice(0, 5).map(row => Object.values(row))
            };

            res.render('word_upload', {
                title: '更新单词库',
                success: `成功处理 ${processedData.length} 条数据`,
                previewData: previewData
            });

        } catch (error) {
            console.error('文件处理错误:', error);
            res.render('word_upload', {
                title: '更新单词库',
                errors: [{ msg: `文件处理失败: ${error.message}` }]
            });
        }
    }
];

// 删除所有单词处理
exports.words_delete_all_get = (req, res) => {
  res.render('word_upload', { title: '更新单词库' });
};

exports.words_delete_all_post = async (req, res) => {
    try {
        // 获取删除前的数据量
        const beforeCount = await Word.countDocuments();
        
        if (beforeCount === 0) {
            return res.render('word_upload', {
                title: '更新单词库',
                warnings: ['数据库中没有单词数据，无需删除'],
                wordCount: 0
            });
        }

        // 执行删除操作
        const result = await Word.deleteMany({});
        
        res.render('word_upload', {
            title: '更新单词库',
            deleteSuccess: `成功删除所有单词数据，共 ${result.deletedCount} 条记录`,
            wordCount: 0
        });

    } catch (error) {
        console.error('删除单词数据错误:', error);
        res.render('word_upload', {
            title: '更新单词库',
            errors: [{ msg: `删除数据失败: ${error.message}` }],
            wordCount: await Word.countDocuments()
        });
    }
};

exports.words_delete_by_category_get = (req, res) => {
  res.render('word_upload', { title: '更新单词库' });
};

exports.words_delete_by_category_post = async (req, res) => {
    try {
        const { category, subcategory } = req.body;

        const query = {};
        if (category) query.category = category;
        if (subcategory) query.subcategory = subcategory;

        if (Object.keys(query).length === 0) {
            return res.render('word_upload', {
                title: '更新单词库',
                warnings: ['请至少填写一个分类条件'],
                wordCount: await Word.countDocuments()
            });
        }

        // 获取删除前的数据量
        const beforeCount = await Word.countDocuments(query);
        
        if (beforeCount === 0) {
            return res.render('word_upload', {
                title: '更新单词库',
                warnings: [`没有找到匹配的单词数据 (category: ${category || '任意'}, subcategory: ${subcategory || '任意'})`],
                wordCount: 0
            });
        }

        // 执行删除操作
        const result = await Word.deleteMany(query);
        
        res.render('word_upload', {
            title: '更新单词库',
            deleteSuccess: `成功删除分类单词数据，共 ${result.deletedCount} 条记录 (category: ${category || '任意'}, subcategory: ${subcategory || '任意'})`,
            wordCount: await Word.countDocuments()
        });

    } catch (error) {
        console.error('删除分类单词数据错误:', error);
        res.render('word_upload', {
            title: '更新单词库',
            errors: [{ msg: `删除数据失败: ${error.message}` }],
            wordCount: await Word.countDocuments()
        });
    }
};
