const WordCategory  = require("../../models/wordCategory");
const Word = require("../../models/word");

async function transformCategoryData(flatData) {
    const categoryMap = new Map();
    const subcategorySet = new Set();
    
    // 第一遍：构建分类结构和收集子分类
    for (const item of flatData) {
        const { category, categoryName, subcategory, subcategoryName } = item;
        
        if (!categoryMap.has(category)) {
            categoryMap.set(category, {
                category: category,
                categoryName: categoryName,
                subcategories: []
            });
        }
        
        subcategorySet.add(subcategory);
        
        const categoryObj = categoryMap.get(category);
        const existingSubcategory = categoryObj.subcategories.find(
            sub => sub.id === subcategory
        );
        
        if (!existingSubcategory) {
            categoryObj.subcategories.push({
                id: subcategory,
                name: subcategoryName,
                total: 0 // 先设为0，后面再更新
            });
        }
    }
    
    // 批量查询所有子分类的单词数量
    const subcategoryArray = Array.from(subcategorySet);
    const wordCounts = await Word.aggregate([
        {
            $match: {
                subcategory: { $in: subcategoryArray }
            }
        },
        {
            $group: {
                _id: "$subcategory",
                total: { $sum: 1 }
            }
        }
    ]);
    
    // 创建子分类到总数的映射
    const countMap = new Map();
    wordCounts.forEach(item => {
        countMap.set(item._id, item.total);
    });
    
    // 更新每个子分类的总数
    for (const category of categoryMap.values()) {
        for (const subcategory of category.subcategories) {
            subcategory.total = countMap.get(subcategory.id) || 0;
        }
    }
    
    return Array.from(categoryMap.values());
}

exports.word_category_list = async function(req, res, next) {
    try {
        const originData = await WordCategory.find().exec();
        const newData = await transformCategoryData(originData);

        res.json({
            code: 200,
            success: true,
            categoryList: newData,
        });
    } catch (err) {
        return next(err);
    }
};