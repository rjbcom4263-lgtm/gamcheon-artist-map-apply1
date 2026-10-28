// 자동 생성 파일입니다(art-map 저장소의 server/env.ts, server/index.ts). Bundled from https://github.com/InSeok211/art-map at dbf41c8 + uncommitted changes.
export interface MapEnv {
  busanBusApiKey?: string
  /** 홈페이지 D1 */
  DB: object
  /** 홈페이지 R2(3D 모델은 map-models/ 아래) */
  MODELS: object
  /** 이 요청이 홈페이지 운영자로 로그인한 사람의 것인지 */
  isAdmin: (request: Request) => Promise<boolean>
}
export declare function handleApi(request: Request, env: MapEnv, url?: URL): Promise<Response>
