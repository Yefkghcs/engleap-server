const multer = require('multer');
const XLSX = require('xlsx');

const WordCategory  = require("../../models/wordCategory");

exports.view_word_Category_list = async function(req, res, next) {
    try {
        const categories = await WordCategory.find().exec();
        res.render("word_category_list", {
            title: "Word Category List",
            categories,
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
      const requiredFields = ['category', 'categoryName', 'subcategory', 'subcategoryName'];
      const missingFields = requiredFields.filter(field => !row[field]);
      if (missingFields.length > 0) {
          errors.push(`第 ${i + 1} 行: 缺少 ${missingFields.join(' | ')}`);
          continue;
      }

      // 保存到数据库
      const category = new WordCategory(row);
      await category.save();
      processedData.push(row);

    } catch (error) {
      errors.push(`第 ${i + 1} 行处理失败: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`处理完成，但有 ${errors.length} 个错误: ${errors.join('; ')}`);
  }

  return processedData;
}

exports.word_category_upload_get = (req, res) => {
  res.render('word_category_upload', { title: '更新单词分类' });
};

exports.word_category_upload_post = [
    upload.single('file'), 
    async (req, res) => {
        try {
            if (!req.file) {
                return res.render('word_category_upload', {
                    title: '更新单词分类',
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

                const names = workbook.SheetNames[sheetName].split('(').map(item => item.replace(')', ''));
                
                data = data.map((item) => ({
                    category: names[0],
                    categoryName: names[1],
                    subcategory: item?.id || '',
                    subcategoryName: item?.name || ''
                }))
                dataForAllSheets.push(...data);
            }

            // 数据验证和处理
            const processedData = await processUploadedData(dataForAllSheets);

            // 生成预览数据（前5行）
            const previewData = {
                headers: Object.keys(processedData[0] || {}),
                rows: processedData.slice(0, 5).map(row => Object.values(row))
            };

            res.render('word_category_upload', {
                title: '更新单词分类',
                success: `成功处理 ${processedData.length} 条数据`,
                previewData: previewData
            });

        } catch (error) {
            console.error('文件处理错误:', error);
            res.render('word_category_upload', {
                title: '更新单词分类',
                errors: [{ msg: `文件处理失败: ${error.message}` }]
            });
        }
    }
];

exports.word_category_delete_get = (req, res) => {
  res.render('word_category_upload', { title: '更新单词分类' });
};

exports.word_category_delete_post = async (req, res) => {
    try {
        // 获取删除前的数据量
        const beforeCount = await WordCategory.countDocuments();
        
        if (beforeCount === 0) {
            return res.render('word_category_upload', {
                title: '更新单词分类',
                warnings: ['数据库中没有分类数据，无需删除'],
                count: 0
            });
        }

        // 执行删除操作
        const result = await WordCategory.deleteMany({});
        
        res.render('word_category_upload', {
            title: '更新单词分类',
            deleteSuccess: `成功删除所有单词分类，共 ${result.deletedCount} 条记录`,
            count: 0
        });

    } catch (error) {
        console.error('删除单词分类错误:', error);
        res.render('word_category_upload', {
            title: '更新单词分类',
            errors: [{ msg: `删除数据失败: ${error.message}` }],
            count: await WordCategory.countDocuments()
        });
    }
};