/**
 * 格式化价格显示
 * 数字（含数字字符串如"25"）追加"元"，非数字文字（如"时价"）原样返回
 */
export function formatPrice(price: number | string): string {
  const str = String(price)
  const num = Number(str)
  if (str !== '' && !isNaN(num)) {
    return `${str}元`
  }
  return str
}
