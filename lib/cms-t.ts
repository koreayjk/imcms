import { getCmsContext } from './cms'
import { makeT, type CmsLang, type T } from './cms-i18n'

// 서버 화면·서버 함수(액션)에서 쓰는 번역 도우미: const { t, lang } = await getT()
export async function getT(): Promise<{ t: T; lang: CmsLang }> {
  const { lang } = await getCmsContext()
  return { t: makeT(lang), lang }
}
