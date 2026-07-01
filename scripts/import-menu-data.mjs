#!/usr/bin/env node
/**
 * 红灯笼食府 - 菜单与原料数据导入脚本
 *
 * 使用 Playwright 启动浏览器登录 admin 面板，提取认证 Cookie 后，
 * 用 Node.js 原生 fetch 批量调用后端 API 完成：
 *  - 8 个菜品分类的创建
 *  - 103 道菜品（含图片）的导入
 *  - 221 个原料的导入
 */

import { chromium } from '@playwright/test'
import { readFile, readdir } from 'fs/promises'
import { resolve, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const BASE_URL = 'http://localhost:3000'
const IMAGES_DIR = resolve(rootDir, '菜单+原料', '红灯笼食府菜单配图')

// ============================================================
// 数据准备：菜品分类
// ============================================================
const CATEGORIES = [
  { name: '招牌硬菜', sort_order: 1 },
  { name: '精品热菜', sort_order: 2 },
  { name: '家常小炒', sort_order: 3 },
  { name: '凉菜冷盘', sort_order: 4 },
  { name: '汤羹类', sort_order: 5 },
  { name: '主食小吃', sort_order: 6 },
  { name: '卤味', sort_order: 7 },
  { name: '饮品', sort_order: 8 },
]

// ============================================================
// 数据准备：菜品列表（名称、价格、分类）
// 价格为 "时价" 的保留字符串，其他为数字
// ============================================================
const DISHES = [
  // 招牌硬菜 (24道)
  { name: '红烧大甲鱼', price: 298, category: '招牌硬菜', imgIdx: '01' },
  { name: '叶集风干羊', price: 158, category: '招牌硬菜', imgIdx: '02' },
  { name: '红烧老公鸡', price: 168, category: '招牌硬菜', imgIdx: '03' },
  { name: '农家土公鸡', price: 168, category: '招牌硬菜', imgIdx: '04' },
  { name: '黄鳝鸡腰', price: 128, category: '招牌硬菜', imgIdx: '05' },
  { name: '黄山臭桂鱼', price: 128, category: '招牌硬菜', imgIdx: '06' },
  { name: '萧县手抓羊排', price: 128, category: '招牌硬菜', imgIdx: '07' },
  { name: '红烧老鹅', price: 128, category: '招牌硬菜', imgIdx: '08' },
  { name: '农家土公鸡煲', price: 128, category: '招牌硬菜', imgIdx: '09' },
  { name: '红烧小公鸡', price: 118, category: '招牌硬菜', imgIdx: '10' },
  { name: '牛腩烧牛筋', price: 118, category: '招牌硬菜', imgIdx: '11' },
  { name: '美极罗氏虾', price: 118, category: '招牌硬菜', imgIdx: '12' },
  { name: '农家葱爆小野鸭', price: 118, category: '招牌硬菜', imgIdx: '13' },
  { name: '砂锅焗鱼头', price: 108, category: '招牌硬菜', imgIdx: '14' },
  { name: '野生杂鱼锅', price: 98, category: '招牌硬菜', imgIdx: '15' },
  { name: '秘制酱排', price: 98, category: '招牌硬菜', imgIdx: '16' },
  { name: '酱排', price: 98, category: '招牌硬菜', imgIdx: '17' },
  { name: '红烧猪蹄', price: 88, category: '招牌硬菜', imgIdx: '18' },
  { name: '酸汤牛蛙', price: 88, category: '招牌硬菜', imgIdx: '19' },
  { name: '红烧牛肉', price: 88, category: '招牌硬菜', imgIdx: '20' },
  { name: '白灼基围虾', price: 88, category: '招牌硬菜', imgIdx: '21' },
  { name: '生焗虾仁', price: 88, category: '招牌硬菜', imgIdx: '22' },
  { name: '功夫鲈鱼', price: 88, category: '招牌硬菜', imgIdx: '23' },
  { name: '双椒鱼头', price: '时价', category: '招牌硬菜', imgIdx: '24' },

  // 精品热菜 (36道)
  { name: '干煸剥皮鱼', price: 88, category: '精品热菜', imgIdx: '25' },
  { name: '啤酒焗猪手', price: 88, category: '精品热菜', imgIdx: '26' },
  { name: '招牌红烧肉', price: 88, category: '精品热菜', imgIdx: '27' },
  { name: '红烧牛肉煲', price: 78, category: '精品热菜', imgIdx: '28' },
  { name: '红烧肥肠', price: 78, category: '精品热菜', imgIdx: '29' },
  { name: '黄山笋烧肉', price: 78, category: '精品热菜', imgIdx: '30' },
  { name: '韭黄炒大肠', price: 78, category: '精品热菜', imgIdx: '31' },
  { name: '干烧扒皮鱼', price: 68, category: '精品热菜', imgIdx: '32' },
  { name: '地锅鸡', price: 68, category: '精品热菜', imgIdx: '33' },
  { name: '红烧猪手', price: 68, category: '精品热菜', imgIdx: '34' },
  { name: '红烧大肠', price: 68, category: '精品热菜', imgIdx: '35' },
  { name: '老鸭锅巴汤', price: 68, category: '精品热菜', imgIdx: '36' },
  { name: '卤水拼盘', price: 58, category: '精品热菜', imgIdx: '37' },
  { name: '农家干渣肉', price: 68, category: '精品热菜', imgIdx: '38' },
  { name: '干蒸咸猪脸', price: 68, category: '精品热菜', imgIdx: '39' },
  { name: '腊味锅巴饭', price: 68, category: '精品热菜', imgIdx: '40' },
  { name: '老鸹汤', price: 68, category: '精品热菜', imgIdx: '41' },
  { name: '特色酸菜鱼', price: 58, category: '精品热菜', imgIdx: '42' },
  { name: '农家米粉肉', price: 58, category: '精品热菜', imgIdx: '43' },
  { name: '粉丝圆子煲', price: 58, category: '精品热菜', imgIdx: '44' },
  { name: '农家蒸蛋饺', price: 58, category: '精品热菜', imgIdx: '45' },
  { name: '蚕豆米毛圆锅', price: 58, category: '精品热菜', imgIdx: '46' },
  { name: '青椒炒白米虾', price: 58, category: '精品热菜', imgIdx: '47' },
  { name: '蚕豆米毛圆汤', price: 58, category: '精品热菜', imgIdx: '48' },
  { name: '新派酱牛肉', price: 58, category: '精品热菜', imgIdx: '49' },
  { name: '小炒黄牛肉', price: 58, category: '精品热菜', imgIdx: '50' },
  { name: '自制手工蛋饺', price: 58, category: '精品热菜', imgIdx: '51' },
  { name: '蚕豆米毛圆滑蛋', price: 58, category: '精品热菜', imgIdx: '52' },
  { name: '糖酥排骨', price: '时价', category: '精品热菜', imgIdx: '53' },
  { name: '狮子头', price: '时价', category: '精品热菜', imgIdx: '54' },
  { name: '嫩笋烧肉', price: '时价', category: '精品热菜', imgIdx: '55' },
  { name: '红烧鸡', price: '时价', category: '精品热菜', imgIdx: '56' },
  { name: '水阳三宝', price: '时价', category: '精品热菜', imgIdx: '57' },
  { name: '花蛤', price: '时价', category: '精品热菜', imgIdx: '58' },
  { name: '鱼丸煲', price: '时价', category: '精品热菜', imgIdx: '59' },
  { name: '河虾', price: '时价', category: '精品热菜', imgIdx: '60' },

  // 家常小炒 (28道)
  { name: '金汤肥羊', price: 48, category: '家常小炒', imgIdx: '61' },
  { name: '木桶肥羊', price: 48, category: '家常小炒', imgIdx: '62' },
  { name: '外婆菜窝窝头', price: 38, category: '家常小炒', imgIdx: '63' },
  { name: '干锅脆笋', price: 38, category: '家常小炒', imgIdx: '64' },
  { name: '腊味糍粑', price: 38, category: '家常小炒', imgIdx: '65' },
  { name: '白葱圆子', price: 38, category: '家常小炒', imgIdx: '66' },
  { name: '海皇干捞粉丝煲', price: 38, category: '家常小炒', imgIdx: '67' },
  { name: '京酱肉丝', price: 32, category: '家常小炒', imgIdx: '68' },
  { name: '小炒鸡杂', price: 36, category: '家常小炒', imgIdx: '69' },
  { name: '香卤牛肉饼', price: 36, category: '家常小炒', imgIdx: '70' },
  { name: '腊味荷兰豆', price: 28, category: '家常小炒', imgIdx: '71' },
  { name: '干锅有机花菜', price: 28, category: '家常小炒', imgIdx: '72' },
  { name: '油渣大白菜粉丝', price: 28, category: '家常小炒', imgIdx: '73' },
  { name: '山药木耳', price: 28, category: '家常小炒', imgIdx: '74' },
  { name: '干锅豆浆皮', price: 28, category: '家常小炒', imgIdx: '75' },
  { name: '红薯丸子', price: 28, category: '家常小炒', imgIdx: '76' },
  { name: '韭菜末炒蛋', price: 28, category: '家常小炒', imgIdx: '77' },
  { name: '大锅豆腐', price: 28, category: '家常小炒', imgIdx: '78' },
  { name: '菜梗肉丝', price: 28, category: '家常小炒', imgIdx: '79' },
  { name: '地瓜丸', price: 28, category: '家常小炒', imgIdx: '80' },
  { name: '小炒猪肝', price: 28, category: '家常小炒', imgIdx: '81' },
  { name: '麻辣猪肝', price: 28, category: '家常小炒', imgIdx: '82' },
  { name: '七彩果仁', price: 28, category: '家常小炒', imgIdx: '83' },
  { name: '菜根肉丝', price: 26, category: '家常小炒', imgIdx: '84' },
  { name: '蔬菜羹', price: 26, category: '家常小炒', imgIdx: '85' },
  { name: '时令蔬菜粥', price: 26, category: '家常小炒', imgIdx: '86' },
  { name: '炒青菜', price: 22, category: '家常小炒', imgIdx: '87' },
  { name: '大锅萝卜', price: '时价', category: '家常小炒', imgIdx: '88' },

  // 凉菜冷盘 (5道)
  { name: '酸辣凉皮', price: 16, category: '凉菜冷盘', imgIdx: '89' },
  { name: '凉拌黄瓜', price: 16, category: '凉菜冷盘', imgIdx: '90' },
  { name: '刮油海草', price: 16, category: '凉菜冷盘', imgIdx: '91' },
  { name: '纯薯小芋头', price: 16, category: '凉菜冷盘', imgIdx: '92' },
  { name: '拌海带丝', price: 16, category: '凉菜冷盘', imgIdx: '93' },

  // 汤羹类 (2道)
  { name: '酸辣汤', price: 19, category: '汤羹类', imgIdx: '94' },
  { name: '紫菜蛋汤', price: 15, category: '汤羹类', imgIdx: '95' },

  // 主食小吃 (3道)
  { name: '蛋炒饭', price: 10, category: '主食小吃', imgIdx: '96' },
  { name: '白米饭', price: 3, category: '主食小吃', imgIdx: '97' },
  { name: '馓子', price: '时价', category: '主食小吃', imgIdx: '98' },

  // 卤味 (2道)
  { name: '卤鹅爪', price: '时价', category: '卤味', imgIdx: '99' },
  { name: '卤鸭头', price: 8, category: '卤味', imgIdx: '100' },

  // 饮品 (3道)
  { name: '维他柠檬茶', price: '时价', category: '饮品', imgIdx: '101' },
  { name: '王老吉', price: 6, category: '饮品', imgIdx: '102' },
  { name: '勇闯天涯', price: 8, category: '饮品', imgIdx: '103' },
]

// ============================================================
// 数据准备：原料清单（221 种）
// ============================================================
const MATERIALS = [
  'XO酱', '丁香', '五花肉', '五花肉丁', '五香粉', '仙草', '八角', '冰块', '冰糖',
  '凉皮', '剁椒', '剥皮鱼', '南瓜', '卤牛肉', '卤猪耳朵', '卤肥肠', '卤豆干',
  '卤鸡翅', '卤鸡蛋', '味精', '咸猪脸', '啤酒', '啤酒花', '土公鸡', '土豆', '土鸡',
  '基围虾', '夏枯草', '外婆菜', '大白菜', '大米', '大葱', '大蒜', '姜', '嫩笋',
  '小公鸡', '小杂鱼', '小米椒', '小米辣', '小芋头', '小苏打', '小茴香', '小葱',
  '小野鸭', '山药', '布渣叶', '干辣椒', '扒皮鱼', '排骨', '料酒', '时令蔬菜',
  '有机花菜', '木耳', '杏仁', '柠檬', '核桃', '桂皮', '桂花', '榨菜', '水',
  '水阳香干', '河虾', '泡打粉', '泡椒', '洋葱', '海带丝', '海草', '淀粉', '牛筋',
  '牛肉', '牛肉馅', '牛腩', '牛腱子肉', '牛蛙', '猪大肠', '猪手', '猪油', '猪油渣',
  '猪肉丝', '猪肉馅', '猪肝', '猪蹄', '猪里脊肉', '玉米粉', '瓜子仁', '甘草',
  '甜面酱', '生姜', '生姜丁', '生抽', '生粉', '甲鱼', '番茄酱', '白米虾', '白糖',
  '白胡椒粉', '白芷', '白菜', '白菜梗', '白萝卜', '白醋', '盐', '笋片', '米饭',
  '粉丝', '粉条', '糯米', '糯米粉', '紫菜', '红椒', '红茶', '红薯', '红辣椒',
  '罗氏虾', '羊排', '美极鲜酱油', '老公鸡', '老抽', '老母鸡', '老鸭', '老鹅',
  '肥羊卷', '胡椒粉', '胡萝卜', '脆笋', '腊肉', '腊肠', '腰果', '臭鳜鱼', '芝麻',
  '芝麻酱', '芥末', '花椒', '花椒粉', '花生', '花蛤', '芹菜', '草果', '荞麦粉',
  '荷兰豆', '莴笋', '菊花', '菜心', '萝卜', '葡萄干', '葱', '葱花', '蒜', '蒜子',
  '蒜末', '蒜苗', '蒸鱼豉油', '蘸料', '虾仁', '虾皮', '蚕豆', '蚕豆米', '蚝油',
  '蛋清', '蜂蜜', '豆浆皮', '豆瓣酱', '豆腐', '豆腐皮', '豆芽', '豆角', '豌豆',
  '辣椒', '辣椒油', '辣椒粉', '酱椒', '酵母', '酸菜', '酸辣汤料', '醋', '金针菇',
  '金银花', '锅巴', '青椒', '青红椒', '青菜', '面粉', '韭菜', '韭黄', '风干羊肉',
  '食用油', '香叶', '香油', '香菇', '香菇丁', '香菜', '香菜梗', '香醋', '马蹄',
  '高汤', '鱼丸', '鱼头', '鱿鱼', '鲈鱼', '鸡杂', '鸡精', '鸡肉', '鸡腰', '鸡蛋',
  '鸡蛋花', '鸭头', '鸭翅', '鸭脚包', '鸭血', '鹅爪', '麦芽', '黄山笋', '黄油',
  '黄牛肉', '黄瓜', '黄豆', '黄豆酱', '黄酒', '黄鳝', '黑胡椒', '黑鱼',
]

// ============================================================
// 原料单位/数量/阈值估算函数
// ============================================================
function estimateMaterial(name) {
  // 个/枚类
  if (name === '鸡蛋' || name === '鸡蛋花') return { unit: '个', quantity: 200, threshold: 50 }
  if (name === '蛋清') return { unit: '个', quantity: 150, threshold: 40 }
  if (['鸭头', '鸭翅', '鹅爪', '鸭脚包'].includes(name)) return { unit: '个', quantity: 50, threshold: 15 }
  if (name === '卤鸡翅') return { unit: '个', quantity: 60, threshold: 20 }
  if (name === '卤鸡蛋') return { unit: '个', quantity: 80, threshold: 30 }
  if (name === '鸡腰') return { unit: '个', quantity: 80, threshold: 25 }

  // 瓶装/罐装饮品
  if (['啤酒', '王老吉', '维他柠檬茶', '勇闯天涯'].includes(name)) {
    return { unit: '瓶', quantity: 60, threshold: 20 }
  }

  // 液体调料（L）
  const liquids = ['食用油', '生抽', '老抽', '料酒', '黄酒', '醋', '白醋', '香醋', '蚝油',
    '甜面酱', '豆瓣酱', '黄豆酱', '番茄酱', '芝麻酱', '辣椒油', '香油', '蜂蜜',
    '美极鲜酱油', '蒸鱼豉油']
  if (liquids.includes(name)) return { unit: 'L', quantity: 8, threshold: 2 }
  if (name === 'XO酱') return { unit: 'kg', quantity: 2, threshold: 0.5 }

  // 香料（kg）
  const spices = ['八角', '桂皮', '花椒', '花椒粉', '黑胡椒', '白胡椒粉', '胡椒粉', '五香粉',
    '小茴香', '香叶', '草果', '丁香', '甘草', '白芷']
  if (spices.includes(name)) return { unit: 'kg', quantity: 1, threshold: 0.3 }

  // 干货主食（大包装）
  const staples = ['大米', '面粉', '糯米', '糯米粉', '玉米粉', '荞麦粉', '粉丝', '粉条']
  if (staples.includes(name)) return { unit: 'kg', quantity: 30, threshold: 8 }

  // 调料粉末
  const powders = ['盐', '白糖', '冰糖', '味精', '鸡精', '淀粉', '生粉', '小苏打', '泡打粉', '酵母']
  if (powders.includes(name)) return { unit: 'kg', quantity: 5, threshold: 1.5 }

  // 海鲜水产
  const seafood = ['基围虾', '罗氏虾', '河虾', '白米虾', '虾皮', '虾仁', '甲鱼', '鲈鱼', '黑鱼',
    '臭鳜鱼', '扒皮鱼', '剥皮鱼', '鱼头', '鱿鱼', '鱼丸', '黄鳝', '小杂鱼', '牛蛙', '花蛤']
  if (seafood.includes(name)) return { unit: 'kg', quantity: 10, threshold: 3 }

  // 鲜肉类
  const meat = ['五花肉', '五花肉丁', '排骨', '猪肉丝', '猪肉馅', '猪里脊肉', '猪肝', '猪大肠',
    '猪手', '猪蹄', '牛肉', '牛筋', '牛腩', '牛腱子肉', '牛肉馅', '黄牛肉',
    '土公鸡', '土鸡', '小公鸡', '老公鸡', '老母鸡', '鸡肉', '鸡杂', '老鸭', '老鹅',
    '小野鸭', '风干羊肉', '肥羊卷', '鸭血', '咸猪脸', '卤牛肉', '卤肥肠',
    '卤猪耳朵', '卤豆干', '羊排']
  if (meat.includes(name)) return { unit: 'kg', quantity: 20, threshold: 5 }

  // 蔬菜类
  const vegetables = ['大白菜', '白菜', '白菜梗', '青菜', '青椒', '红椒', '红辣椒', '青红椒', '辣椒',
    '有机花菜', '山药', '木耳', '土豆', '红薯', '白萝卜', '萝卜', '胡萝卜', '洋葱',
    '莴笋', '荷兰豆', '豆角', '豌豆', '蚕豆', '蚕豆米', '黄瓜', '南瓜', '马蹄',
    '菜心', '芹菜', '韭菜', '韭黄', '蒜苗', '蒜', '蒜子', '蒜末', '生姜',
    '生姜丁', '香菇', '香菇丁', '金针菇', '豆芽', '豆腐', '豆腐皮', '豆浆皮',
    '海带丝', '海草', '小芋头', '嫩笋', '笋片', '脆笋', '黄山笋', '榨菜', '酸菜',
    '时令蔬菜', '菜根', '菜梗', '葱花', '葱', '大葱', '小葱', '香菜', '香菜梗']
  if (vegetables.includes(name)) return { unit: 'kg', quantity: 15, threshold: 4 }

  // 半成品/熟食
  if (['锅巴', '凉皮', '米饭', '酸辣汤料', '蘸料', '高汤', '水阳香干'].includes(name)) {
    return { unit: 'kg', quantity: 8, threshold: 2 }
  }

  // 干货/坚果
  const dryFoods = ['花生', '瓜子仁', '腰果', '核桃', '杏仁', '葡萄干', '芝麻', '黄豆']
  if (dryFoods.includes(name)) return { unit: 'kg', quantity: 5, threshold: 1.5 }

  // 茶饮/花草
  if (['红茶', '仙草', '麦芽', '啤酒花', '夏枯草', '布渣叶', '金银花', '菊花', '桂花'].includes(name)) {
    return { unit: 'kg', quantity: 2, threshold: 0.5 }
  }

  // 其他液体
  if (['水', '冰块'].includes(name)) return { unit: 'L', quantity: 50, threshold: 10 }

  // 默认
  return { unit: 'kg', quantity: 5, threshold: 1.5 }
}

// ============================================================
// HTTP 工具函数
// ============================================================
async function apiCall(path, options = {}, cookieHeader) {
  const url = `${BASE_URL}${path}`
  const headers = { ...options.headers }
  if (cookieHeader) headers.Cookie = cookieHeader
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok || (data && data.success === false)) {
    throw new Error(`API ${path} 失败: ${data?.error || text} (status ${res.status})`)
  }
  return data
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log('🚀 启动数据导入流程...\n')

  // ---------- 1. 启动 Playwright 浏览器并登录 ----------
  console.log('步骤 1: 启动浏览器并登录管理面板...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' })

  // 检查是否在登录页（第一个 input 通常是用户名）
  const usernameInput = await page.$('input[autocomplete="username"]')
  if (usernameInput) {
    await page.fill('input[autocomplete="username"]', 'admin')
    await page.fill('input[autocomplete="current-password"]', 'admin123')
    await page.click('button[type="submit"]')
    // 等待登录完成（URL 变化或网络空闲）
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('  ✓ 登录成功')
  } else {
    console.log('  ✓ 已登录（之前会话保持）')
  }

  // 提取 admin_token cookie
  const cookies = await context.cookies()
  const tokenCookie = cookies.find(c => c.name === 'admin_token')
  if (!tokenCookie) {
    throw new Error('无法获取 admin_token cookie，登录可能失败')
  }
  const cookieHeader = `admin_token=${tokenCookie.value}`
  console.log(`  ✓ 获取 Cookie: admin_token=${tokenCookie.value.substring(0, 20)}...`)

  // 不再需要浏览器，关闭以节省资源
  await browser.close()
  console.log('  ✓ 浏览器已关闭，继续使用 HTTP API\n')

  // ---------- 2. 清理现有空分类 ----------
  console.log('步骤 2: 清理现有空分类...')
  const existingCats = await apiCall('/api/admin/categories', { method: 'GET' }, cookieHeader)
  for (const cat of existingCats.data) {
    // 检查分类下是否有菜品
    const dishesInCat = await apiCall(`/api/dishes?category=${encodeURIComponent(cat.name)}`, { method: 'GET' }, null)
    if (dishesInCat.data.length === 0) {
      await apiCall(`/api/admin/categories/${cat.id}`, { method: 'DELETE' }, cookieHeader)
      console.log(`  ✓ 删除空分类: ${cat.name}`)
    } else {
      console.log(`  - 跳过非空分类: ${cat.name} (${dishesInCat.data.length} 道菜品)`)
    }
  }
  console.log('')

  // ---------- 3. 创建 8 个新分类 ----------
  console.log('步骤 3: 创建 8 个新分类...')
  const categoryNameToId = {}
  for (const cat of CATEGORIES) {
    try {
      const res = await apiCall('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: cat.name, sort_order: cat.sort_order }),
      }, cookieHeader)
      categoryNameToId[cat.name] = res.data.id
      console.log(`  ✓ 创建分类: ${cat.name} (sort_order=${cat.sort_order})`)
    } catch (e) {
      if (e.message.includes('已存在')) {
        // 已存在，查询获取 id
        const allCats = await apiCall('/api/admin/categories', { method: 'GET' }, cookieHeader)
        const found = allCats.data.find(c => c.name === cat.name)
        if (found) {
          categoryNameToId[cat.name] = found.id
          console.log(`  - 分类已存在: ${cat.name}`)
        }
      } else {
        throw e
      }
    }
  }
  console.log('')

  // ---------- 4. 上传图片并创建菜品 ----------
  console.log('步骤 4: 上传图片并创建菜品...')
  console.log(`  共 ${DISHES.length} 道菜品待导入\n`)

  // 列出图片目录，构建 imgIdx -> 文件名 映射
  const imageFiles = await readdir(IMAGES_DIR)
  const imgIdxToFile = {}
  for (const f of imageFiles) {
    // 文件名格式: 01_红烧大甲鱼.jpg
    const match = f.match(/^(\d+)_.+\.(jpg|jpeg|png|gif|webp)$/i)
    if (match) {
      imgIdxToFile[match[1]] = f
    }
  }

  const dishStats = { success: 0, failed: 0, noImage: 0, skipped: 0 }
  const dishFailures = []

  // 一次性获取已有菜品列表（用于幂等性检查）
  const existingDishes = await apiCall('/api/admin/dishes', { method: 'GET' }, cookieHeader)
  const existingDishNames = new Set(existingDishes.data.map(d => d.name))

  for (let i = 0; i < DISHES.length; i++) {
    const dish = DISHES[i]
    const imgFile = imgIdxToFile[dish.imgIdx]

    try {
      if (existingDishNames.has(dish.name)) {
        dishStats.skipped++
        console.log(`  [${i + 1}/${DISHES.length}] 跳过已存在: ${dish.name}`)
        continue
      }

      // 上传图片（如果存在）
      let imageUrl = null
      if (imgFile) {
        const imagePath = resolve(IMAGES_DIR, imgFile)
        const imageBuffer = await readFile(imagePath)
        const formData = new FormData()
        formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), imgFile)
        const uploadRes = await apiCall('/api/admin/upload', {
          method: 'POST',
          body: formData,
        }, cookieHeader)
        imageUrl = uploadRes.data.url
      } else {
        dishStats.noImage++
        console.log(`  [${i + 1}/${DISHES.length}] 未找到图片: ${dish.name} (idx=${dish.imgIdx})`)
      }

      // 创建菜品
      const categoryId = categoryNameToId[dish.category]
      await apiCall('/api/admin/dishes', {
        method: 'POST',
        body: JSON.stringify({
          name: dish.name,
          price: dish.price,
          category_id: categoryId,
          image_url: imageUrl,
          description: '',
          tags: [],
          specs: [],
        }),
      }, cookieHeader)

      dishStats.success++
      if ((i + 1) % 10 === 0 || i === DISHES.length - 1) {
        console.log(`  [${i + 1}/${DISHES.length}] 已导入: ${dish.name} (¥${dish.price})`)
      }
    } catch (e) {
      dishStats.failed++
      dishFailures.push({ name: dish.name, error: e.message })
      console.error(`  [${i + 1}/${DISHES.length}] 失败: ${dish.name} - ${e.message}`)
    }
  }
  console.log(`\n  菜品导入汇总: 成功 ${dishStats.success}, 跳过 ${dishStats.skipped}, 失败 ${dishStats.failed}, 无图片 ${dishStats.noImage}\n`)

  // ---------- 5. 创建原料库存 ----------
  console.log('步骤 5: 创建原料库存...')
  console.log(`  共 ${MATERIALS.length} 种原料待导入\n`)

  const matStats = { success: 0, failed: 0 }
  const matFailures = []

  for (let i = 0; i < MATERIALS.length; i++) {
    const name = MATERIALS[i]
    const est = estimateMaterial(name)
    try {
      await apiCall('/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          material_name: name,
          quantity: est.quantity,
          unit: est.unit,
          warning_threshold: est.threshold,
        }),
      }, cookieHeader)
      matStats.success++
      if ((i + 1) % 20 === 0 || i === MATERIALS.length - 1) {
        console.log(`  [${i + 1}/${MATERIALS.length}] 已导入: ${name} (${est.quantity}${est.unit}, 阈值 ${est.threshold})`)
      }
    } catch (e) {
      matStats.failed++
      matFailures.push({ name, error: e.message })
      if ((i + 1) % 20 === 0 || i === MATERIALS.length - 1) {
        console.log(`  [${i + 1}/${MATERIALS.length}] 失败: ${name} - ${e.message}`)
      }
    }
  }
  console.log(`\n  原料导入汇总: 成功 ${matStats.success}, 失败 ${matStats.failed}\n`)

  // ---------- 6. 最终汇总 ----------
  console.log('═══════════════════════════════════════════')
  console.log('📊 导入完成汇总')
  console.log('═══════════════════════════════════════════')
  console.log(`分类: ${CATEGORIES.length} 个`)
  console.log(`菜品: ${dishStats.success}/${DISHES.length} 成功, ${dishStats.skipped} 跳过, ${dishStats.failed} 失败`)
  console.log(`原料: ${matStats.success}/${MATERIALS.length} 成功, ${matStats.failed} 失败`)
  if (dishFailures.length > 0) {
    console.log('\n菜品失败明细:')
    dishFailures.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
  }
  if (matFailures.length > 0) {
    console.log('\n原料失败明细:')
    matFailures.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
  }
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('❌ 导入失败:', err)
  process.exit(1)
})
