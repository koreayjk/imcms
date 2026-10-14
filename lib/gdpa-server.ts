import { headers } from 'next/headers'
import { gdpaBaseFor } from './gdpa'

// 서버 화면에서 링크 앞에 붙일 주소 ('' 또는 '/gdpa')
export const gdpaBase = async () => gdpaBaseFor((await headers()).get('host'))

// 영문판 화면의 링크 앞부분 ('/en' 또는 '/gdpa/en')
export const gdpaBaseEn = async () => `${await gdpaBase()}/en`
